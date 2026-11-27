/**
 * Real-time 1v1 rooms on Cloud Firestore (no game server required).
 *
 *   rooms/{roomCode}                          -> RoomRecord (see game/roomEngine.ts)
 *   matchmaking/{minigameType}/queue/{player} -> quick match queue entries
 *
 * Every state change runs inside a Firestore transaction using the pure
 * functions from `roomEngine`, and both devices follow the document through
 * `onSnapshot`. Works the same in the browser and inside the Capacitor APK.
 */
import { FirebaseError } from 'firebase/app';
import { signInAnonymously, User } from 'firebase/auth';
import {
  DocumentReference,
  FieldPath,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  ONLINE_MATCHMAKING_TIMEOUT_MS,
  SmartBotOpponent,
  generateSixCharRoomCode,
} from '../game/realtimeSyncHelpers';
import { getAuthoritativeServerNowMs } from '../game/serverTime';
import { sanitizePublicDisplayName } from '../game/usernameFilter';
import { getRosterHydrationStatus } from '../game/rosterLoader';
import {
  ROSTER_DATA_VERSION,
  ROSTER_VERSION_MISMATCH_ERROR,
  areRosterVersionsCompatible,
  normalizeRosterVersion,
} from '../game/rosterVersion';
import {
  MatchmakingQueueCandidate,
  RoomAnswerOutcome,
  RoomJoinResult,
  RoomPhase,
  RoomRecord,
  RoomState,
  applyRoomAdvance,
  applyRoomAbandon,
  applyRoomAnswer,
  applyRoomBeginRound,
  applyRoomDisconnectForfeit,
  applyRoomDisconnectGrace,
  applyRoomExpire,
  applyRoomJoin,
  applyRoomRematch,
  applyRoomRematchResponse,
  applyRoomResumeFromDisconnect,
  createRoomRecord,
  getRoomPlayerKey,
  isValidRoomCode,
  normalizeRoomCode,
  normalizeRoomRecord,
  selectMatchmakingCandidates,
  validateRematchRosterCompatibility,
} from '../game/roomEngine';

function getActiveClientRosterVersion(explicitVersion?: string | null): string {
  return (
    normalizeRosterVersion(explicitVersion) ||
    normalizeRosterVersion(getRosterHydrationStatus().version) ||
    ROSTER_DATA_VERSION
  );
}
import { MinigameType, PlayerProfile } from '../game/types';

const ROOMS_COLLECTION = 'rooms';
/** Optional Firestore TTL policy on `expiresAt` deletes abandoned rooms automatically. */
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const QUEUE_TTL_MS = 60 * 1000;
const PRESENCE_HEARTBEAT_MS = 4000;
/** Short disconnect triggers pause + 45s grace; stale hard drop backs it up cleanly after grace ends. */
const PRESENCE_SUSPECTED_DROP_MS = 12000;
const PRESENCE_STALE_MS = 75000;
const MATCHMAKING_QUERY_LIMIT = 20;
const ACTIVE_ROOM_SESSION_KEY = '321_active_online_room_v1';
const ACTIVE_ROOM_PERSISTED_KEY = '321_active_online_room_v2';

export interface PersistedActiveRoomSession {
  code: string;
  minigameType?: MinigameType;
  source?: 'private' | 'matchmaking';
  playerKey?: string;
  playerId?: string;
  memberUid?: string | null;
  opponentName?: string;
  myScore?: number;
  opponentScore?: number;
  disconnectGraceExpiresAt?: number | null;
  matchSeq?: number;
  matchSessionId?: string | null;
  savedAt: number;
}

export function saveActiveRoomSession(
  input: string | Partial<PersistedActiveRoomSession> | null
): void {
  if (typeof window === 'undefined') return;
  try {
    if (!input) {
      window.sessionStorage?.removeItem(ACTIVE_ROOM_SESSION_KEY);
      window.localStorage?.removeItem(ACTIVE_ROOM_PERSISTED_KEY);
      return;
    }
    const rawCode = typeof input === 'string' ? input : input.code || '';
    const cleanCode = normalizeRoomCode(rawCode);
    if (!isValidRoomCode(cleanCode)) return;
    window.sessionStorage?.setItem(ACTIVE_ROOM_SESSION_KEY, cleanCode);
    const prev = loadActiveRoomSessionMeta();
    const payload: PersistedActiveRoomSession = {
      ...(prev && prev.code === cleanCode ? prev : {}),
      ...(typeof input === 'string' ? {} : input),
      code: cleanCode,
      savedAt: Date.now(),
    };
    window.localStorage?.setItem(ACTIVE_ROOM_PERSISTED_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function updateActiveRoomSessionMeta(
  partial: Partial<PersistedActiveRoomSession>
): void {
  const existing = loadActiveRoomSessionMeta();
  if (!existing) return;
  saveActiveRoomSession({ ...existing, ...partial, code: existing.code });
}

export function loadActiveRoomSessionMeta(): PersistedActiveRoomSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawJson = window.localStorage?.getItem(ACTIVE_ROOM_PERSISTED_KEY);
    if (rawJson) {
      const parsed = JSON.parse(rawJson) as PersistedActiveRoomSession;
      const clean = normalizeRoomCode(parsed?.code || '');
      if (isValidRoomCode(clean)) {
        const ageMs = Date.now() - (Number(parsed?.savedAt) || 0);
        if (ageMs >= 0 && ageMs <= ROOM_TTL_MS) {
          return { ...parsed, code: clean };
        }
        window.localStorage?.removeItem(ACTIVE_ROOM_PERSISTED_KEY);
      }
    }
    const raw = window.sessionStorage?.getItem(ACTIVE_ROOM_SESSION_KEY);
    if (!raw) return null;
    const clean = normalizeRoomCode(raw);
    return isValidRoomCode(clean) ? { code: clean, savedAt: Date.now() } : null;
  } catch {
    return null;
  }
}

export function loadActiveRoomSession(): string | null {
  return loadActiveRoomSessionMeta()?.code ?? null;
}

let activeQueueCleanup: (() => void) | null = null;

/** Cancels any active matchmaking queue search cleanly so a player is never in two queues at once. */
export function cleanupActiveMatchmakingQueue(): void {
  if (activeQueueCleanup) {
    try {
      activeQueueCleanup();
    } catch {
      // ignore
    }
    activeQueueCleanup = null;
  }
}

export class RoomServiceError extends Error {
  constructor(
    public readonly code: 'auth' | 'code_generation',
    message: string
  ) {
    super(message);
    this.name = 'RoomServiceError';
  }
}

/** Turkish, user-facing message for any room/matchmaking failure. */
export function describeRoomError(err: unknown): string {
  if (err instanceof RoomServiceError) return err.message;
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'permission-denied':
      case 'firestore/permission-denied':
        return 'Oda sunucusu erişimi reddetti. Lütfen uygulamayı güncelleyip tekrar dene.';
      case 'unavailable':
      case 'firestore/unavailable':
      case 'deadline-exceeded':
        return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.';
      case 'auth/operation-not-allowed':
      case 'auth/admin-restricted-operation':
        return 'Çevrim içi oturum açılamadı (misafir girişi kapalı).';
      case 'auth/network-request-failed':
        return 'İnternet bağlantısı yok! Bağlantını kontrol edip tekrar dene.';
      default:
        break;
    }
  }
  return 'Firebase oda bağlantısı başlatılamadı. Lütfen tekrar dene!';
}

/**
 * Firestore security rules require a signed-in user. Reuse the persisted
 * session (Google / e-mail / anonymous) and only fall back to an anonymous
 * sign-in when there is none — waiting for `authStateReady` first so a
 * restored Google session is never replaced by an anonymous one.
 */
export async function ensureRoomAuthUser(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.warn('[rooms] anonymous sign-in failed', err);
    if (err instanceof FirebaseError) {
      throw new RoomServiceError('auth', describeRoomError(err));
    }
    throw new RoomServiceError('auth', 'Çevrim içi oturum açılamadı. Lütfen tekrar dene.');
  }
}

function roomRef(code: string): DocumentReference {
  return doc(db, ROOMS_COLLECTION, code);
}

/** Firestore rejects `undefined`; drop such keys from plain objects (Timestamps untouched). */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripUndefined(v)) as unknown as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

function toRoomDocument(room: RoomRecord): Record<string, unknown> {
  return stripUndefined({ ...room }) as unknown as Record<string, unknown>;
}

/**
 * Read-modify-write a room atomically. `mutate` returns the next record (or
 * null to write nothing) plus a result; Firestore retries the whole function
 * on contention, so it must stay pure.
 */
async function mutateRoom<T>(
  code: string,
  mutate: (room: RoomRecord) => { next: RoomRecord | null; result: T },
  missingResult: T
): Promise<T> {
  const ref = roomRef(code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return missingResult;
    const { next, result } = mutate(normalizeRoomRecord(snap.data()));
    if (next) tx.set(ref, toRoomDocument(next));
    return result;
  });
}

// ── Private rooms ──

export async function createRoom(
  hostProfile: PlayerProfile,
  minigameType: MinigameType = 'two_clubs',
  rosterVersion?: string
): Promise<{ code: string; room: RoomRecord }> {
  const user = await ensureRoomAuthUser();
  const activeRosterVersion = getActiveClientRosterVersion(rosterVersion);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSixCharRoomCode();
    const now = getAuthoritativeServerNowMs();
    const room: RoomRecord = {
      ...createRoomRecord({
        code,
        source: 'private',
        minigameType,
        host: hostProfile,
        hostUid: user.uid,
        now,
        rosterVersion: activeRosterVersion,
      }),
      expiresAt: Timestamp.fromMillis(now + ROOM_TTL_MS),
    };
    const ref = roomRef(code);
    const created = await runTransaction(db, async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists()) return false;
      tx.set(ref, toRoomDocument(room));
      return true;
    });
    if (created) return { code, room };
  }
  throw new RoomServiceError('code_generation', 'Oda kodu oluşturulamadı. Lütfen tekrar dene!');
}

export async function joinRoom(
  rawCode: string,
  guestProfile: PlayerProfile,
  rosterVersion?: string
): Promise<RoomJoinResult> {
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) {
    return { ok: false, error: 'Geçersiz oda kodu! Oda kodu 6 karakter olmalı.' };
  }
  const user = await ensureRoomAuthUser();
  const activeRosterVersion = getActiveClientRosterVersion(rosterVersion);
  const notFound: RoomJoinResult = {
    ok: false,
    error: 'Oda bulunamadı. Lütfen 6 haneli oda kodunu kontrol et!',
  };

  return mutateRoom<RoomJoinResult>(
    code,
    (room) => {
      const res = applyRoomJoin(
        room,
        guestProfile,
        user.uid,
        getAuthoritativeServerNowMs(),
        activeRosterVersion
      );
      if (!res.ok) return { next: null, result: res };
      // Re-join of an existing member writes nothing
      const changed = res.room !== room;
      return { next: changed ? res.room : null, result: res };
    },
    notFound
  );
}

/**
 * Live room listener. `onChange(null)` means the room was deleted or is no longer accessible.
 * Transient network listener errors call `onError` so an active match is NOT killed immediately.
 */
export function subscribeRoom(
  code: string,
  onChange: (room: RoomRecord | null) => void,
  onError?: (err: unknown) => void
): () => void {
  const cleanCode = normalizeRoomCode(code);
  return onSnapshot(
    roomRef(cleanCode),
    (snap) => {
      if (!snap.exists()) {
        // A cache-only "missing" snapshot can precede the server copy of a just-created room
        if (snap.metadata.fromCache) return;
        onChange(null);
        return;
      }
      onChange(normalizeRoomRecord(snap.data()));
    },
    (err) => {
      console.warn('[rooms] room listener error', err);
      if (onError) {
        onError(err);
      } else {
        onChange(null);
      }
    }
  );
}

export type ActiveRoomResumeCheck =
  | { status: 'active'; room: RoomRecord }
  | { status: 'finished' | 'not_found' | 'not_member' }
  | { status: 'network_error'; error: string };

/**
 * Authoritatively verifies an active match session against Firestore + Firebase Auth UID.
 * Never trusts localStorage timestamps or client clock alone.
 */
export async function fetchActiveRoomForResume(
  rawCode: string,
  playerId: string
): Promise<ActiveRoomResumeCheck> {
  const cleanCode = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(cleanCode)) return { status: 'not_found' };
  try {
    const user = await ensureRoomAuthUser();
    const snap = await getDoc(roomRef(cleanCode));
    if (!snap.exists()) return { status: 'not_found' };
    let room = normalizeRoomRecord(snap.data());
    const playerKey = getRoomPlayerKey(playerId);
    const isMemberUid = Array.isArray(room.memberUids) && room.memberUids.includes(user.uid);
    const isMemberPlayer = Boolean(room.players?.[playerKey]);
    if (!isMemberUid && !isMemberPlayer) {
      return { status: 'not_member' };
    }
    if (!isMemberUid) {
      return { status: 'not_member' };
    }
    if (
      room.disconnectGrace &&
      getAuthoritativeServerNowMs() >= room.disconnectGrace.expiresAt &&
      room.state !== 'game_over'
    ) {
      await forfeitRoomAfterDisconnectGrace(cleanCode).catch(() => {});
      const refreshed = await getDoc(roomRef(cleanCode));
      if (!refreshed.exists()) return { status: 'not_found' };
      room = normalizeRoomRecord(refreshed.data());
    }
    if (room.state === 'game_over') {
      return { status: 'finished' };
    }
    return { status: 'active', room };
  } catch (err) {
    if (
      err instanceof FirebaseError &&
      (err.code === 'permission-denied' || err.code === 'firestore/permission-denied')
    ) {
      return { status: 'not_member' };
    }
    return { status: 'network_error', error: describeRoomError(err) };
  }
}

export function beginRoomRound(code: string, phase: RoomPhase): Promise<void> {
  return mutateRoom(
    code,
    (room) => ({ next: applyRoomBeginRound(room, phase, getAuthoritativeServerNowMs()), result: undefined }),
    undefined
  );
}

export function submitRoomAnswer(
  code: string,
  rawPlayerId: string,
  answer: string,
  options: { elapsedSec?: number; cellPos?: { row: number; col: number } } = {}
): Promise<RoomAnswerOutcome> {
  return mutateRoom(
    code,
    (room) => {
      const { next, outcome } = applyRoomAnswer(
        room,
        rawPlayerId,
        answer,
        options,
        getAuthoritativeServerNowMs()
      );
      return { next, result: outcome };
    },
    { accepted: false, reason: 'not_playing' } as RoomAnswerOutcome
  );
}

export function expireRoomRound(code: string, phase: RoomPhase): Promise<void> {
  return mutateRoom(
    code,
    (room) => ({ next: applyRoomExpire(room, phase, getAuthoritativeServerNowMs()), result: undefined }),
    undefined
  );
}

export function advanceRoomRound(code: string, phase: RoomPhase): Promise<void> {
  return mutateRoom(
    code,
    (room) => ({ next: applyRoomAdvance(room, phase, getAuthoritativeServerNowMs()), result: undefined }),
    undefined
  );
}

export function requestRoomRematch(
  code: string,
  rawPlayerId: string,
  rosterVersion?: string
): Promise<{ ok: boolean; error?: string }> {
  const activeRosterVersion = getActiveClientRosterVersion(rosterVersion);
  return mutateRoom<{ ok: boolean; error?: string }>(
    code,
    (room) => {
      const compat = validateRematchRosterCompatibility(room, activeRosterVersion);
      if (!compat.ok) {
        return { next: null, result: { ok: false, error: compat.error } };
      }
      const next = applyRoomRematch(
        room,
        rawPlayerId,
        getAuthoritativeServerNowMs(),
        undefined,
        activeRosterVersion
      );
      return { next, result: { ok: Boolean(next) } };
    },
    { ok: false, error: 'Oda bulunamadı.' }
  );
}

export function respondRoomRematch(
  code: string,
  rawPlayerId: string,
  action: 'accept' | 'decline' | 'expire',
  rosterVersion?: string
): Promise<{ ok: boolean; error?: string }> {
  const activeRosterVersion = getActiveClientRosterVersion(rosterVersion);
  return mutateRoom<{ ok: boolean; error?: string }>(
    code,
    (room) => {
      if (action === 'accept') {
        const compat = validateRematchRosterCompatibility(room, activeRosterVersion);
        if (!compat.ok) {
          return { next: null, result: { ok: false, error: compat.error } };
        }
      }
      const next = applyRoomRematchResponse(
        room,
        rawPlayerId,
        action,
        getAuthoritativeServerNowMs(),
        undefined,
        activeRosterVersion
      );
      return { next, result: { ok: Boolean(next) } };
    },
    { ok: false, error: 'Oda bulunamadı.' }
  );
}

export function pauseRoomForDisconnect(
  code: string,
  disconnectedRawPlayerId: string,
  remainingMs: number
): Promise<void> {
  return mutateRoom(
    code,
    (room) => ({
      next: applyRoomDisconnectGrace(
        room,
        disconnectedRawPlayerId,
        remainingMs,
        getAuthoritativeServerNowMs()
      ),
      result: undefined,
    }),
    undefined
  );
}

export function resumeRoomFromDisconnect(code: string, returningRawPlayerId: string): Promise<void> {
  return mutateRoom(
    code,
    (room) => ({
      next: applyRoomResumeFromDisconnect(
        room,
        returningRawPlayerId,
        getAuthoritativeServerNowMs()
      ),
      result: undefined,
    }),
    undefined
  );
}

export function forfeitRoomAfterDisconnectGrace(code: string): Promise<void> {
  return mutateRoom(
    code,
    (room) => ({
      next: applyRoomDisconnectForfeit(room, getAuthoritativeServerNowMs()),
      result: undefined,
    }),
    undefined
  );
}

/**
 * Explicitly abandons a room on user confirmation: deletes waiting rooms or
 * commits a clean forfeit on active 2-player matches without stranding the opponent.
 */
export async function abandonRoomMatch(
  code: string,
  abandoningRawPlayerId: string
): Promise<void> {
  const clean = normalizeRoomCode(code);
  if (!isValidRoomCode(clean)) return;
  const action = await mutateRoom<'delete' | 'forfeited' | 'noop'>(
    clean,
    (room) => {
      if (room.state === 'waiting') {
        return { next: null, result: 'delete' };
      }
      const next = applyRoomAbandon(
        room,
        abandoningRawPlayerId,
        getAuthoritativeServerNowMs()
      );
      return { next, result: next ? 'forfeited' : 'noop' };
    },
    'noop'
  ).catch(() => 'noop' as const);

  if (action === 'delete') {
    await deleteRoom(clean);
  }
}

/** Deletes the room; the other device's listener receives `null` and leaves. */
export async function deleteRoom(code: string): Promise<void> {
  const clean = normalizeRoomCode(code);
  if (!isValidRoomCode(clean)) return;
  try {
    await deleteDoc(roomRef(clean));
  } catch {
    // already deleted or not a member anymore
  }
}

// ── Presence (Firestore has no onDisconnect, so use a heartbeat) ──

/**
 * Writes `presence.{playerKey}` every few seconds and reports when the
 * opponent's heartbeat stops changing. Staleness is measured with the LOCAL
 * clock between observed changes, so device clock differences don't matter.
 */
export function startRoomPresence(params: {
  code: string;
  playerKey: string;
  onOpponentSuspectedDrop?: (oppKey: string) => void;
  onOpponentResumed?: (oppKey: string) => void;
  onOpponentLost: () => void;
}): () => void {
  const ref = roomRef(params.code);
  const presencePath = new FieldPath('presence', params.playerKey);
  let stopped = false;
  let lostFired = false;
  let suspectedFired = false;
  let roomState: RoomState | null = null;
  let oppKey: string | null = null;
  let oppLastValue: number | undefined;
  let oppLastChangeAt = Date.now();
  let lastWatchdogTick = Date.now();

  const beat = () => {
    if (stopped) return;
    void updateDoc(ref, presencePath, Date.now()).catch(() => {});
  };
  beat();
  const heartbeat = setInterval(beat, PRESENCE_HEARTBEAT_MS);

  const unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const room = normalizeRoomRecord(snap.data());
      roomState = room.state;
      const nextOpp = Object.keys(room.players).find((k) => k !== params.playerKey) || null;
      if (nextOpp !== oppKey) {
        oppKey = nextOpp;
        oppLastValue = undefined;
        oppLastChangeAt = Date.now();
        suspectedFired = false;
      }
      if (oppKey) {
        const value = room.presence?.[oppKey];
        if (value !== oppLastValue) {
          oppLastValue = value;
          oppLastChangeAt = Date.now();
          if (suspectedFired) {
            suspectedFired = false;
            params.onOpponentResumed?.(oppKey);
          }
        }
      }
    },
    () => {}
  );

  const watchdog = setInterval(() => {
    const now = Date.now();
    // This device was suspended (app in background): give the opponent a fresh grace period
    if (now - lastWatchdogTick > PRESENCE_HEARTBEAT_MS + 2500) oppLastChangeAt = now;
    lastWatchdogTick = now;
    if (stopped || lostFired || !oppKey || roomState === null || roomState === 'waiting') return;
    const elapsed = now - oppLastChangeAt;
    if (!suspectedFired && elapsed > PRESENCE_SUSPECTED_DROP_MS) {
      suspectedFired = true;
      params.onOpponentSuspectedDrop?.(oppKey);
    }
    if (elapsed > PRESENCE_STALE_MS) {
      lostFired = true;
      params.onOpponentLost();
    }
  }, 1500);

  return () => {
    stopped = true;
    clearInterval(heartbeat);
    clearInterval(watchdog);
    unsub();
  };
}

// ── Quick match (12s real online 1v1 queue; zero secret bot fallback) ──

function readQueueEntry(raw: Record<string, unknown>): MatchmakingQueueCandidate | null {
  if (typeof raw.playerKey !== 'string' || typeof raw.uid !== 'string') return null;
  const profile = raw.profile as MatchmakingQueueCandidate['profile'] | undefined;
  if (!profile || typeof profile.id !== 'string') return null;
  const joinedAt = raw.joinedAt as Timestamp | null | undefined;
  const expiresAt = raw.expiresAt as Timestamp | null | undefined;
  return {
    playerKey: raw.playerKey,
    uid: raw.uid,
    minigameType: raw.minigameType as MinigameType,
    rosterVersion: normalizeRosterVersion(raw.rosterVersion) || undefined,
    profile,
    joinedAtMs:
      joinedAt && typeof joinedAt.toMillis === 'function'
        ? joinedAt.toMillis()
        : getAuthoritativeServerNowMs(),
    expiresAtMs:
      expiresAt && typeof expiresAt.toMillis === 'function' ? expiresAt.toMillis() : null,
    matchedRoomCode: typeof raw.matchedRoomCode === 'string' ? raw.matchedRoomCode : null,
  };
}

export function startRoomMatchmaking(params: {
  profile: PlayerProfile;
  minigameType: MinigameType;
  rosterVersion?: string;
  onRoomMatched: (code: string) => void;
  onNoOpponentTimeout?: () => void;
  onMatchmakingError?: (message: string) => void;
  onFallbackToBot?: (bot: SmartBotOpponent) => void;
}): () => void {
  // Always clean up any existing matchmaking search first so the user is never in 2 queues
  cleanupActiveMatchmakingQueue();

  const myRosterVersion = getActiveClientRosterVersion(params.rosterVersion);
  const myKey = getRoomPlayerKey(params.profile.id);
  const queueCol = collection(db, 'matchmaking', params.minigameType, 'queue');
  const myRef = doc(queueCol, myKey);

  let settled = false;
  /** Room we ended up in (set only by finishWithRoom) */
  let settledRoomCode: string | null = null;
  let claiming = false;
  let myUid: string | null = null;
  let unsubQueue: (() => void) | null = null;
  let unsubMine: (() => void) | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const stopListening = () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
    unsubQueue?.();
    unsubQueue = null;
    unsubMine?.();
    unsubMine = null;
  };
  const removeMyEntry = () => {
    void deleteDoc(myRef).catch(() => {});
  };
  const cancelFn = () => {
    if (settled) return;
    settled = true;
    if (activeQueueCleanup === cancelFn) activeQueueCleanup = null;
    stopListening();
    removeMyEntry();
  };
  activeQueueCleanup = cancelFn;

  const finishWithRoom = (code: string) => {
    if (settled) return;
    settled = true;
    settledRoomCode = code;
    if (activeQueueCleanup === cancelFn) activeQueueCleanup = null;
    stopListening();
    removeMyEntry();
    params.onRoomMatched(code);
  };
  const finishNoOpponent = () => {
    if (settled) return;
    settled = true;
    if (activeQueueCleanup === cancelFn) activeQueueCleanup = null;
    stopListening();
    removeMyEntry();
    params.onNoOpponentTimeout?.();
  };

  const claimOpponent = async (opp: MatchmakingQueueCandidate): Promise<boolean> => {
    if (!myUid || settled) return false;
    if (opp.uid === myUid || opp.playerKey === myKey || opp.profile.id === params.profile.id) {
      return false;
    }
    if (!areRosterVersionsCompatible(myRosterVersion, opp.rosterVersion)) {
      return false;
    }
    const oppRef = doc(queueCol, opp.playerKey);
    const code = generateSixCharRoomCode();
    const rRef = roomRef(code);
    const now = getAuthoritativeServerNowMs();
    const room: RoomRecord = {
      ...createRoomRecord({
        code,
        source: 'matchmaking',
        minigameType: params.minigameType,
        host: params.profile,
        hostUid: myUid,
        guest: { ...opp.profile, score: 0 },
        guestUid: opp.uid,
        now,
        rosterVersion: myRosterVersion,
      }),
      expiresAt: Timestamp.fromMillis(now + ROOM_TTL_MS),
    };

    const claimed = await runTransaction(db, async (tx) => {
      const mine = await tx.get(myRef);
      const theirs = await tx.get(oppRef);
      const existingRoom = await tx.get(rRef);
      if (!mine.exists() || mine.data().matchedRoomCode) return false;
      if (!theirs.exists() || theirs.data().matchedRoomCode) return false;
      if (!areRosterVersionsCompatible(myRosterVersion, theirs.data().rosterVersion)) return false;
      if (existingRoom.exists()) return false;
      tx.set(rRef, toRoomDocument(room));
      tx.update(oppRef, { matchedRoomCode: code });
      tx.update(myRef, { matchedRoomCode: code });
      return true;
    }).catch(() => false);

    if (!claimed) return false;
    if (settled && settledRoomCode !== code) {
      // Cancelled or timed out while the claim was in flight:
      // delete the room immediately so the opponent is not stranded alone
      void deleteRoom(code);
      return true;
    }
    finishWithRoom(code);
    return true;
  };

  const tryClaimFromEntries = async (entries: MatchmakingQueueCandidate[]) => {
    if (!myUid || settled || claiming) return;
    const candidates = selectMatchmakingCandidates({
      entries,
      myKey,
      myUid,
      myProfileId: params.profile.id,
      minigameType: params.minigameType,
      myRosterVersion,
      now: getAuthoritativeServerNowMs(),
    });
    if (candidates.length === 0) return;

    claiming = true;
    try {
      for (const candidate of candidates) {
        if (settled) break;
        const ok = await claimOpponent(candidate);
        if (ok) break;
      }
    } finally {
      claiming = false;
    }
  };

  void (async () => {
    try {
      const user = await ensureRoomAuthUser();
      if (settled) return;
      myUid = user.uid;
      const cleanName = sanitizePublicDisplayName(params.profile.name, params.profile.id).slice(0, 32);
      const profile: MatchmakingQueueCandidate['profile'] = {
        id: params.profile.id,
        name: cleanName,
        avatar: String(params.profile.avatar || '⚽'),
      };
      if (params.profile.favoriteClubId) profile.favoriteClubId = params.profile.favoriteClubId;

      await setDoc(myRef, {
        playerKey: myKey,
        uid: user.uid,
        minigameType: params.minigameType,
        rosterVersion: myRosterVersion,
        profile,
        joinedAt: serverTimestamp(),
        matchedRoomCode: null,
        expiresAt: Timestamp.fromMillis(getAuthoritativeServerNowMs() + QUEUE_TTL_MS),
      });
      if (settled) {
        removeMyEntry();
        return;
      }

      // Someone else claimed us
      unsubMine = onSnapshot(
        myRef,
        (snap) => {
          if (settled || !snap.exists()) return;
          const code = snap.data().matchedRoomCode;
          if (typeof code === 'string' && code) finishWithRoom(code);
        },
        () => {}
      );

      // Watch waiting queue for compatible opponents
      unsubQueue = onSnapshot(
        query(queueCol, orderBy('joinedAt', 'desc'), limit(MATCHMAKING_QUERY_LIMIT)),
        (snap) => {
          if (settled || claiming) return;
          const entries = snap.docs
            .map((d) => readQueueEntry(d.data({ serverTimestamps: 'estimate' })))
            .filter((e): e is MatchmakingQueueCandidate => Boolean(e));
          void tryClaimFromEntries(entries);
        },
        () => {}
      );
    } catch (err) {
      console.warn('[rooms] matchmaking unavailable', err);
      if (params.onMatchmakingError) {
        settled = true;
        if (activeQueueCleanup === cancelFn) activeQueueCleanup = null;
        stopListening();
        removeMyEntry();
        params.onMatchmakingError(describeRoomError(err));
      } else {
        finishNoOpponent();
      }
    }
  })();

  // Strictly 12 seconds real-player search; never start a bot automatically
  timeoutTimer = setTimeout(() => {
    timeoutTimer = null;
    if (settled) return;
    void runTransaction(db, async (tx) => {
      const snap = await tx.get(myRef);
      if (!snap.exists()) return null;
      const code = snap.data().matchedRoomCode;
      if (typeof code === 'string' && code) return code;
      tx.delete(myRef);
      return null;
    })
      .then((matchedCode) => {
        if (matchedCode) finishWithRoom(matchedCode);
        else finishNoOpponent();
      })
      .catch(() => finishNoOpponent());
  }, ONLINE_MATCHMAKING_TIMEOUT_MS);

  return cancelFn;
}
