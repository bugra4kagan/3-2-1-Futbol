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
  ONLINE_MATCHMAKING_FALLBACK_MS,
  SmartBotOpponent,
  generateSixCharRoomCode,
  pickSmartBotOpponent,
} from '../game/realtimeSyncHelpers';
import {
  RoomAnswerOutcome,
  RoomJoinResult,
  RoomPhase,
  RoomRecord,
  RoomState,
  applyRoomAdvance,
  applyRoomAnswer,
  applyRoomBeginRound,
  applyRoomExpire,
  applyRoomJoin,
  applyRoomRematch,
  createRoomRecord,
  getRoomPlayerKey,
  isValidRoomCode,
  normalizeRoomCode,
  normalizeRoomRecord,
} from '../game/roomEngine';
import { MinigameType, PlayerProfile } from '../game/types';

const ROOMS_COLLECTION = 'rooms';
/** Optional Firestore TTL policy on `expiresAt` deletes abandoned rooms automatically. */
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const QUEUE_TTL_MS = 10 * 60 * 1000;
const PRESENCE_HEARTBEAT_MS = 5000;
/** Generous so a short app switch (WhatsApp, a call) doesn't end the match. */
const PRESENCE_STALE_MS = 60000;
const MATCHMAKING_FRESH_WINDOW_MS = 10000;
const MATCHMAKING_QUERY_LIMIT = 20;

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
  minigameType: MinigameType = 'two_clubs'
): Promise<{ code: string; room: RoomRecord }> {
  const user = await ensureRoomAuthUser();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSixCharRoomCode();
    const now = Date.now();
    const room: RoomRecord = {
      ...createRoomRecord({
        code,
        source: 'private',
        minigameType,
        host: hostProfile,
        hostUid: user.uid,
        now,
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
  guestProfile: PlayerProfile
): Promise<RoomJoinResult> {
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) {
    return { ok: false, error: 'Geçersiz oda kodu! Oda kodu 6 karakter olmalı.' };
  }
  const user = await ensureRoomAuthUser();
  const notFound: RoomJoinResult = {
    ok: false,
    error: 'Oda bulunamadı. Lütfen 6 haneli oda kodunu kontrol et!',
  };

  return mutateRoom<RoomJoinResult>(
    code,
    (room) => {
      const res = applyRoomJoin(room, guestProfile, user.uid, Date.now());
      if (!res.ok) return { next: null, result: res };
      // Re-join of an existing member writes nothing
      const changed = res.room !== room;
      return { next: changed ? res.room : null, result: res };
    },
    notFound
  );
}

/**
 * Live room listener. `onChange(null)` means the room was deleted (cancelled /
 * opponent left) or became unreadable.
 */
export function subscribeRoom(
  code: string,
  onChange: (room: RoomRecord | null) => void
): () => void {
  return onSnapshot(
    roomRef(code),
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
      onChange(null);
    }
  );
}

export function beginRoomRound(code: string, phase: RoomPhase): Promise<void> {
  return mutateRoom(code, (room) => ({ next: applyRoomBeginRound(room, phase, Date.now()), result: undefined }), undefined);
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
      const { next, outcome } = applyRoomAnswer(room, rawPlayerId, answer, options, Date.now());
      return { next, result: outcome };
    },
    { accepted: false, reason: 'not_playing' } as RoomAnswerOutcome
  );
}

export function expireRoomRound(code: string, phase: RoomPhase): Promise<void> {
  return mutateRoom(code, (room) => ({ next: applyRoomExpire(room, phase, Date.now()), result: undefined }), undefined);
}

export function advanceRoomRound(code: string, phase: RoomPhase): Promise<void> {
  return mutateRoom(code, (room) => ({ next: applyRoomAdvance(room, phase, Date.now()), result: undefined }), undefined);
}

export function requestRoomRematch(code: string, rawPlayerId: string): Promise<void> {
  return mutateRoom(
    code,
    (room) => ({ next: applyRoomRematch(room, rawPlayerId, Date.now()), result: undefined }),
    undefined
  );
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
  onOpponentLost: () => void;
}): () => void {
  const ref = roomRef(params.code);
  const presencePath = new FieldPath('presence', params.playerKey);
  let stopped = false;
  let lostFired = false;
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
      }
      if (oppKey) {
        const value = room.presence?.[oppKey];
        if (value !== oppLastValue) {
          oppLastValue = value;
          oppLastChangeAt = Date.now();
        }
      }
    },
    () => {}
  );

  const watchdog = setInterval(() => {
    const now = Date.now();
    // This device was suspended (app in background): give the opponent a fresh grace period
    if (now - lastWatchdogTick > PRESENCE_HEARTBEAT_MS + 2000) oppLastChangeAt = now;
    lastWatchdogTick = now;
    if (stopped || lostFired || !oppKey || roomState === null || roomState === 'waiting') return;
    if (now - oppLastChangeAt > PRESENCE_STALE_MS) {
      lostFired = true;
      params.onOpponentLost();
    }
  }, 2000);

  return () => {
    stopped = true;
    clearInterval(heartbeat);
    clearInterval(watchdog);
    unsub();
  };
}

// ── Quick match (online 1v1 queue with smart-bot fallback) ──

interface QueueEntry {
  playerKey: string;
  uid: string;
  minigameType: MinigameType;
  profile: { id: string; name: string; avatar: string; favoriteClubId?: string };
  joinedAtMs: number;
  matchedRoomCode: string | null;
}

function readQueueEntry(raw: Record<string, unknown>): QueueEntry | null {
  if (typeof raw.playerKey !== 'string' || typeof raw.uid !== 'string') return null;
  const profile = raw.profile as QueueEntry['profile'] | undefined;
  if (!profile || typeof profile.id !== 'string') return null;
  const joinedAt = raw.joinedAt as Timestamp | null | undefined;
  return {
    playerKey: raw.playerKey,
    uid: raw.uid,
    minigameType: raw.minigameType as MinigameType,
    profile,
    joinedAtMs: joinedAt && typeof joinedAt.toMillis === 'function' ? joinedAt.toMillis() : Date.now(),
    matchedRoomCode: typeof raw.matchedRoomCode === 'string' ? raw.matchedRoomCode : null,
  };
}

export function startRoomMatchmaking(params: {
  profile: PlayerProfile;
  minigameType: MinigameType;
  onRoomMatched: (code: string) => void;
  onFallbackToBot: (bot: SmartBotOpponent) => void;
}): () => void {
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
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const stopListening = () => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    unsubQueue?.();
    unsubQueue = null;
    unsubMine?.();
    unsubMine = null;
  };
  const removeMyEntry = () => {
    void deleteDoc(myRef).catch(() => {});
  };
  const finishWithRoom = (code: string) => {
    if (settled) return;
    settled = true;
    settledRoomCode = code;
    stopListening();
    removeMyEntry();
    params.onRoomMatched(code);
  };
  const finishWithBot = () => {
    if (settled) return;
    settled = true;
    stopListening();
    removeMyEntry();
    params.onFallbackToBot(pickSmartBotOpponent());
  };

  const claimOpponent = async (opp: QueueEntry) => {
    if (!myUid || settled) return;
    const oppRef = doc(queueCol, opp.playerKey);
    const code = generateSixCharRoomCode();
    const rRef = roomRef(code);
    const now = Date.now();
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
      }),
      expiresAt: Timestamp.fromMillis(now + ROOM_TTL_MS),
    };

    const claimed = await runTransaction(db, async (tx) => {
      const mine = await tx.get(myRef);
      const theirs = await tx.get(oppRef);
      const existingRoom = await tx.get(rRef);
      if (!mine.exists() || mine.data().matchedRoomCode) return false;
      if (!theirs.exists() || theirs.data().matchedRoomCode) return false;
      if (existingRoom.exists()) return false;
      tx.set(rRef, toRoomDocument(room));
      tx.update(oppRef, { matchedRoomCode: code });
      tx.update(myRef, { matchedRoomCode: code });
      return true;
    }).catch(() => false);

    if (!claimed) return;
    if (settled && settledRoomCode !== code) {
      // Cancelled (or fell back to a bot) while the claim was in flight:
      // remove the room so the claimed opponent is sent back instead of waiting alone
      void deleteRoom(code);
      return;
    }
    finishWithRoom(code);
  };

  void (async () => {
    try {
      const user = await ensureRoomAuthUser();
      if (settled) return;
      myUid = user.uid;
      const profile: QueueEntry['profile'] = {
        id: params.profile.id,
        name: String(params.profile.name || 'Oyuncu').slice(0, 32),
        avatar: String(params.profile.avatar || '⚽'),
      };
      if (params.profile.favoriteClubId) profile.favoriteClubId = params.profile.favoriteClubId;

      await setDoc(myRef, {
        playerKey: myKey,
        uid: user.uid,
        minigameType: params.minigameType,
        profile,
        joinedAt: serverTimestamp(),
        matchedRoomCode: null,
        expiresAt: Timestamp.fromMillis(Date.now() + QUEUE_TTL_MS),
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

      // We claim opponents whose key sorts after ours (deterministic, avoids double rooms)
      unsubQueue = onSnapshot(
        query(queueCol, orderBy('joinedAt', 'desc'), limit(MATCHMAKING_QUERY_LIMIT)),
        (snap) => {
          if (settled || claiming) return;
          const entries = snap.docs
            .map((d) => readQueueEntry(d.data({ serverTimestamps: 'estimate' })))
            .filter((e): e is QueueEntry => Boolean(e));
          const mine = entries.find((e) => e.playerKey === myKey);
          if (!mine || mine.matchedRoomCode) return;
          const candidate = entries
            .filter(
              (e) =>
                e.playerKey !== myKey &&
                e.playerKey > myKey &&
                !e.matchedRoomCode &&
                e.joinedAtMs >= mine.joinedAtMs - MATCHMAKING_FRESH_WINDOW_MS
            )
            .sort((a, b) => a.joinedAtMs - b.joinedAtMs)[0];
          if (!candidate) return;
          claiming = true;
          void claimOpponent(candidate).finally(() => {
            claiming = false;
          });
        },
        () => {}
      );
    } catch (err) {
      console.warn('[rooms] matchmaking unavailable, falling back to bot', err);
      finishWithBot();
    }
  })();

  // After the wait window: if nobody claimed us, atomically leave the queue and play a bot
  fallbackTimer = setTimeout(() => {
    fallbackTimer = null;
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
        else finishWithBot();
      })
      .catch(() => finishWithBot());
  }, ONLINE_MATCHMAKING_FALLBACK_MS);

  return () => {
    settled = true;
    stopListening();
    removeMyEntry();
  };
}
