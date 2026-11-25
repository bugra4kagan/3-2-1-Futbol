/**
 * Pure 1v1 room state machine shared by every client.
 *
 * The Firestore document `rooms/{roomCode}` stores a `RoomRecord`. Every
 * mutation (join, answer, timeout, next round, rematch) is computed here and
 * committed inside a Firestore transaction by `firestoreRoomService`, so both
 * devices always agree on the same authoritative state without a game server.
 *
 * Timing is clock-skew safe: each client measures the countdown and round time
 * locally from the moment it observes a phase change. Phase-guarded mutations
 * (`matchSeq` + `roundIndex` + `turnSeq`) make it safe for BOTH clients to
 * request the same transition — the first commit wins, the second is a no-op.
 */
import {
  checkXoxBoardWinner,
  createEmptyXoxBoard,
  getRoundRevealInfo,
  validateMinigameAnswer,
} from './minigameEngine';
import { createInitialMatchStats } from './onlineEngine';
import { getClutchThresholdSeconds, getRoundDurationSeconds } from './roundTiming';
import { MAX_SILHOUETTE_ATTEMPTS } from './silhouetteEngine';
import {
  generateSeededRoundIds,
  resolveRoundPayloadById,
  sanitizeRtdbKey,
} from './realtimeSyncHelpers';
import {
  MatchPlayerStats,
  MinigameRoundPayload,
  MinigameType,
  PlayerProfile,
  XoxCellMark,
  XoxRuntimeState,
} from './types';

export const ROOM_CODE_LENGTH = 6;
export const ROOM_ROUND_POOL_SIZE = 12;
export const ROOM_MAX_ROUNDS = 10;
export const ROOM_WIN_SCORE = 3;
export const ROOM_COUNTDOWN_SECONDS = 3;
/** Private rooms older than this can no longer be joined. */
export const ROOM_JOIN_MAX_AGE_MS = 3 * 60 * 60 * 1000;
/** Two consecutive XOX turn timeouts end the round as a timeout. */
export const ROOM_XOX_MAX_CONSECUTIVE_TIMEOUTS = 2;

export type RoomState = 'waiting' | 'countdown' | 'playing' | 'round_ended' | 'game_over';
export type RoomEndReason = 'scored' | 'timeout' | 'attempts_exhausted' | 'draw';
export type RoomSource = 'private' | 'matchmaking';

export interface RoomPlayerRecord {
  id: string;
  name: string;
  avatar: string;
  favoriteClubId?: string;
  score: number;
  stats: MatchPlayerStats;
  rematchRequested: boolean;
}

export interface RoomRecord {
  code: string;
  source: RoomSource;
  minigameType: MinigameType;
  questionSeed: number;
  roundIds: string[];
  /** Player keys (sanitized session ids) */
  hostId: string;
  guestId: string | null;
  /** Firebase Auth uids — used by Firestore security rules */
  hostUid: string;
  guestUid: string | null;
  memberUids: string[];
  players: Record<string, RoomPlayerRecord>;
  scores: Record<string, number>;
  /** Heartbeat map written by `startRoomPresence` (playerKey -> local ms) */
  presence?: Record<string, number>;
  state: RoomState;
  currentRoundIndex: number;
  /** Bumps whenever an XOX turn changes so clients restart the turn timer */
  turnSeq: number;
  /** Bumps on every rematch so a new match is a new phase */
  matchSeq: number;
  roundStartedAt: number | null;
  roundWinnerId: string | null;
  roundEndReason: RoomEndReason | null;
  roundElapsedSec: number | null;
  acceptedAnswer: string | null;
  acceptedPlayerName: string | null;
  xoxBoardJson: string | null;
  xoxTurnPlayerId: string | null;
  xoxNotice: string | null;
  xoxConsecutiveTimeouts: number;
  wrongAttemptPulse: { byPlayerId: string; seq: number } | null;
  silhouetteAttempts: Record<string, number>;
  createdAt: number;
  updatedAt: number;
  /** Firestore Timestamp (TTL field) — opaque to the pure engine */
  expiresAt?: unknown;
}

export interface RoomPhase {
  matchSeq: number;
  roundIndex: number;
  turnSeq: number;
}

export type RoomAnswerRejectReason =
  | 'not_playing'
  | 'invalid_answer'
  | 'not_your_turn'
  | 'invalid_cell'
  | 'attempts_exhausted';

export interface RoomAnswerOutcome {
  accepted: boolean;
  reason?: RoomAnswerRejectReason;
  xoxTurnChanged?: boolean;
  attemptsRemaining?: number;
}

export type RoomJoinResult =
  | { ok: true; room: RoomRecord }
  | { ok: false; error: string };

// ── Codes & keys ──

export function normalizeRoomCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  return new RegExp(`^[A-Z0-9]{${ROOM_CODE_LENGTH}}$`).test(code);
}

export function getRoomPlayerKey(playerId: string): string {
  return sanitizeRtdbKey(playerId);
}

export function getRoomPhase(room: RoomRecord): RoomPhase {
  return {
    matchSeq: room.matchSeq,
    roundIndex: room.currentRoundIndex,
    turnSeq: room.turnSeq,
  };
}

export function getRoomPhaseKey(room: RoomRecord): string {
  return `${room.matchSeq}-${room.currentRoundIndex}-${room.state}-${room.turnSeq}`;
}

function isSamePhase(room: RoomRecord, phase: RoomPhase, checkTurn: boolean): boolean {
  return (
    room.matchSeq === phase.matchSeq &&
    room.currentRoundIndex === phase.roundIndex &&
    (!checkTurn || room.turnSeq === phase.turnSeq)
  );
}

function uniqueUids(uids: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const uid of uids) {
    if (uid && !out.includes(uid)) out.push(uid);
  }
  return out;
}

function toRoomPlayer(profile: PlayerProfile): RoomPlayerRecord {
  const player: RoomPlayerRecord = {
    id: profile.id,
    name: String(profile.name || 'Oyuncu').slice(0, 32),
    avatar: String(profile.avatar || '⚽'),
    score: 0,
    stats: createInitialMatchStats(),
    rematchRequested: false,
  };
  if (profile.favoriteClubId) player.favoriteClubId = profile.favoriteClubId;
  return player;
}

export function randomRoomSeed(rng: () => number = Math.random): number {
  return Math.floor(rng() * 1_000_000_000) + 1;
}

function parseBoard(json: string | null): (XoxCellMark | null)[][] {
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length === 3) return parsed;
    } catch {
      // fall through to empty board
    }
  }
  return createEmptyXoxBoard();
}

// ── Read helpers (used by the UI) ──

/** Fills defaults so partially written / older documents never crash the UI. */
export function normalizeRoomRecord(raw: Record<string, unknown>): RoomRecord {
  const room = raw as unknown as RoomRecord;
  return {
    ...room,
    roundIds: Array.isArray(room.roundIds) ? room.roundIds : [],
    guestId: room.guestId ?? null,
    guestUid: room.guestUid ?? null,
    memberUids: Array.isArray(room.memberUids) ? room.memberUids : [],
    players: room.players ?? {},
    scores: room.scores ?? {},
    currentRoundIndex: room.currentRoundIndex ?? 0,
    turnSeq: room.turnSeq ?? 0,
    matchSeq: room.matchSeq ?? 1,
    roundStartedAt: room.roundStartedAt ?? null,
    roundWinnerId: room.roundWinnerId ?? null,
    roundEndReason: room.roundEndReason ?? null,
    roundElapsedSec: room.roundElapsedSec ?? null,
    acceptedAnswer: room.acceptedAnswer ?? null,
    acceptedPlayerName: room.acceptedPlayerName ?? null,
    xoxBoardJson: room.xoxBoardJson ?? null,
    xoxTurnPlayerId: room.xoxTurnPlayerId ?? null,
    xoxNotice: room.xoxNotice ?? null,
    xoxConsecutiveTimeouts: room.xoxConsecutiveTimeouts ?? 0,
    wrongAttemptPulse: room.wrongAttemptPulse ?? null,
    silhouetteAttempts: room.silhouetteAttempts ?? {},
  };
}

export function getRoomRoundPayload(room: RoomRecord): MinigameRoundPayload | null {
  const roundId = room.roundIds?.[room.currentRoundIndex];
  if (!roundId) return null;
  return resolveRoundPayloadById(room.minigameType, roundId);
}

export function parseRoomXoxState(room: RoomRecord): XoxRuntimeState | null {
  if (room.minigameType !== 'xox') return null;
  const board = parseBoard(room.xoxBoardJson);
  const win = checkXoxBoardWinner(board);
  const turnKey = room.xoxTurnPlayerId || room.hostId;
  return {
    board,
    // UI compares against PlayerProfile.id, so map the player key back to the raw id
    currentTurnPlayerId: room.players?.[turnKey]?.id ?? turnKey,
    turnTimeRemaining: getRoundDurationSeconds('xox'),
    winningCells: win.winningCells || null,
  };
}

// ── Mutations (pure; return null when nothing should be written) ──

export function createRoomRecord(params: {
  code: string;
  source: RoomSource;
  minigameType: MinigameType;
  host: PlayerProfile;
  hostUid: string;
  guest?: PlayerProfile | null;
  guestUid?: string | null;
  now: number;
  seed?: number;
}): RoomRecord {
  const questionSeed = params.seed ?? randomRoomSeed();
  const hostId = getRoomPlayerKey(params.host.id);
  const guestId = params.guest ? getRoomPlayerKey(params.guest.id) : null;
  const players: Record<string, RoomPlayerRecord> = { [hostId]: toRoomPlayer(params.host) };
  const scores: Record<string, number> = { [hostId]: 0 };
  if (params.guest && guestId) {
    players[guestId] = toRoomPlayer(params.guest);
    scores[guestId] = 0;
  }
  const isXox = params.minigameType === 'xox';

  return {
    code: params.code,
    source: params.source,
    minigameType: params.minigameType,
    questionSeed,
    roundIds: generateSeededRoundIds(params.minigameType, ROOM_ROUND_POOL_SIZE, questionSeed),
    hostId,
    guestId,
    hostUid: params.hostUid,
    guestUid: params.guest ? params.guestUid ?? null : null,
    memberUids: uniqueUids([params.hostUid, params.guest ? params.guestUid : null]),
    players,
    scores,
    state: guestId ? 'countdown' : 'waiting',
    currentRoundIndex: 0,
    turnSeq: 0,
    matchSeq: 1,
    roundStartedAt: null,
    roundWinnerId: null,
    roundEndReason: null,
    roundElapsedSec: null,
    acceptedAnswer: null,
    acceptedPlayerName: null,
    xoxBoardJson: isXox ? JSON.stringify(createEmptyXoxBoard()) : null,
    xoxTurnPlayerId: isXox ? hostId : null,
    xoxNotice: null,
    xoxConsecutiveTimeouts: 0,
    wrongAttemptPulse: null,
    silhouetteAttempts: {},
    createdAt: params.now,
    updatedAt: params.now,
  };
}

export function applyRoomJoin(
  room: RoomRecord,
  guest: PlayerProfile,
  guestUid: string,
  now: number
): RoomJoinResult {
  const guestKey = getRoomPlayerKey(guest.id);
  const players = room.players || {};

  if (guestKey === room.hostId) {
    return { ok: false, error: 'Kendi kurduğun odaya katılamazsın. Kodu arkadaşına gönder!' };
  }
  // Re-joining a room you are already in (e.g. after an app restart) is allowed
  if (players[guestKey]) {
    return { ok: true, room };
  }
  if (Object.keys(players).length >= 2 || room.guestId) {
    return { ok: false, error: 'Bu oda dolu!' };
  }
  if (room.state !== 'waiting') {
    return { ok: false, error: 'Bu odadaki maç zaten başlamış.' };
  }
  if (now - (room.createdAt || now) > ROOM_JOIN_MAX_AGE_MS) {
    return { ok: false, error: 'Bu odanın süresi dolmuş. Arkadaşından yeni bir oda kurmasını iste.' };
  }

  return {
    ok: true,
    room: {
      ...room,
      guestId: guestKey,
      guestUid,
      memberUids: uniqueUids([...(room.memberUids || []), guestUid]),
      players: { ...players, [guestKey]: toRoomPlayer(guest) },
      scores: { ...(room.scores || {}), [guestKey]: 0 },
      state: 'countdown',
      updatedAt: now,
    },
  };
}

/** countdown -> playing. Any client may call it once its local countdown hits 0. */
export function applyRoomBeginRound(room: RoomRecord, phase: RoomPhase, now: number): RoomRecord | null {
  if (room.state !== 'countdown' || !isSamePhase(room, phase, false)) return null;
  return {
    ...room,
    state: 'playing',
    roundStartedAt: now,
    xoxConsecutiveTimeouts: 0,
    updatedAt: now,
  };
}

function clampElapsed(minigameType: MinigameType, elapsedSec: number | undefined, room: RoomRecord, now: number): number {
  const total = getRoundDurationSeconds(minigameType);
  const fallback = room.roundStartedAt ? (now - room.roundStartedAt) / 1000 : total / 2;
  const raw = typeof elapsedSec === 'number' && Number.isFinite(elapsedSec) ? elapsedSec : fallback;
  return Number(Math.min(total, Math.max(0.2, raw)).toFixed(1));
}

export function applyRoomAnswer(
  room: RoomRecord,
  rawPlayerId: string,
  answer: string,
  options: { elapsedSec?: number; cellPos?: { row: number; col: number } },
  now: number
): { next: RoomRecord | null; outcome: RoomAnswerOutcome } {
  if (room.state !== 'playing') {
    return { next: null, outcome: { accepted: false, reason: 'not_playing' } };
  }
  const round = getRoomRoundPayload(room);
  const playerKey = getRoomPlayerKey(rawPlayerId);
  const players = { ...(room.players || {}) };
  const scores = { ...(room.scores || {}) };
  const me = players[playerKey];
  if (!round || !me) {
    return { next: null, outcome: { accepted: false, reason: 'not_playing' } };
  }
  const oppKey = Object.keys(players).find((k) => k !== playerKey) || null;
  const elapsedSec = clampElapsed(room.minigameType, options.elapsedSec, room, now);
  const pulse = { byPlayerId: me.id, seq: now };

  const wrongStats = (): MatchPlayerStats => ({
    ...me.stats,
    totalWrongAttempts: (me.stats?.totalWrongAttempts ?? 0) + 1,
    currentStreak: 0,
  });
  const correctStats = (wasClutch: boolean): MatchPlayerStats => {
    const nextStreak = (me.stats?.currentStreak ?? 0) + 1;
    return {
      ...me.stats,
      totalCorrect: (me.stats?.totalCorrect ?? 0) + 1,
      currentStreak: nextStreak,
      maxStreak: Math.max(me.stats?.maxStreak ?? 0, nextStreak),
      clutchAnswers: (me.stats?.clutchAnswers ?? 0) + (wasClutch ? 1 : 0),
      fastestAnswerSec:
        me.stats?.fastestAnswerSec == null
          ? elapsedSec
          : Math.min(me.stats.fastestAnswerSec, elapsedSec),
    };
  };
  const remainingSec = getRoundDurationSeconds(room.minigameType) - elapsedSec;
  const wasClutch = remainingSec <= getClutchThresholdSeconds(room.minigameType);

  // ── XOX: turn based board ──
  if (room.minigameType === 'xox') {
    const turnKey = room.xoxTurnPlayerId || room.hostId;
    if (turnKey !== playerKey) {
      return { next: null, outcome: { accepted: false, reason: 'not_your_turn' } };
    }
    const cellPos = options.cellPos;
    if (!cellPos || cellPos.row < 0 || cellPos.row > 2 || cellPos.col < 0 || cellPos.col > 2) {
      return { next: null, outcome: { accepted: false, reason: 'invalid_cell' } };
    }
    const board = parseBoard(room.xoxBoardJson);
    if (board[cellPos.row]?.[cellPos.col]) {
      return { next: null, outcome: { accepted: false, reason: 'invalid_cell' } };
    }

    const check = validateMinigameAnswer(round, answer, cellPos);
    if (!check.isValid || !check.player) {
      players[playerKey] = { ...me, stats: wrongStats() };
      return {
        next: {
          ...room,
          players,
          xoxTurnPlayerId: oppKey || playerKey,
          turnSeq: room.turnSeq + 1,
          roundStartedAt: now,
          xoxNotice: 'Yanlış tahmin! Sıra rakibe geçti.',
          xoxConsecutiveTimeouts: 0,
          wrongAttemptPulse: pulse,
          updatedAt: now,
        },
        outcome: { accepted: false, reason: 'invalid_answer', xoxTurnChanged: true },
      };
    }

    board[cellPos.row][cellPos.col] = {
      ownerId: me.id,
      symbol: room.hostId === playerKey ? 'X' : 'O',
      playerName: check.player.name,
    };
    players[playerKey] = { ...me, stats: correctStats(false) };
    const xoxWin = checkXoxBoardWinner(board);

    if (xoxWin.winnerId || xoxWin.isBoardFull) {
      const winnerKey = xoxWin.winnerId
        ? Object.keys(players).find((k) => players[k].id === xoxWin.winnerId) || playerKey
        : null;
      if (winnerKey) {
        scores[winnerKey] = (scores[winnerKey] ?? 0) + 1;
        players[winnerKey] = { ...players[winnerKey], score: scores[winnerKey] };
      }
      return {
        next: {
          ...room,
          players,
          scores,
          xoxBoardJson: JSON.stringify(board),
          xoxNotice: winnerKey ? `${check.player.name} ile XOX tamamlandı!` : 'Tahta berabere!',
          state: 'round_ended',
          roundWinnerId: winnerKey ? players[winnerKey].id : null,
          roundEndReason: winnerKey ? 'scored' : 'draw',
          roundElapsedSec: winnerKey ? elapsedSec : null,
          acceptedAnswer: answer,
          acceptedPlayerName: check.player.name,
          xoxConsecutiveTimeouts: 0,
          updatedAt: now,
        },
        outcome: { accepted: true },
      };
    }

    return {
      next: {
        ...room,
        players,
        xoxBoardJson: JSON.stringify(board),
        xoxTurnPlayerId: oppKey || playerKey,
        turnSeq: room.turnSeq + 1,
        roundStartedAt: now,
        xoxNotice: `${check.player.name} ile kare alındı!`,
        xoxConsecutiveTimeouts: 0,
        updatedAt: now,
      },
      outcome: { accepted: true, xoxTurnChanged: true },
    };
  }

  // ── Silhouette attempt limit ──
  if (room.minigameType === 'silhouette') {
    const used = room.silhouetteAttempts?.[playerKey] ?? 0;
    if (used >= MAX_SILHOUETTE_ATTEMPTS) {
      return { next: null, outcome: { accepted: false, reason: 'attempts_exhausted', attemptsRemaining: 0 } };
    }
  }

  const res = validateMinigameAnswer(round, answer);
  if (!res.isValid || !res.player) {
    players[playerKey] = { ...me, stats: wrongStats() };

    if (room.minigameType === 'silhouette') {
      const attempts = { ...(room.silhouetteAttempts || {}) };
      attempts[playerKey] = (attempts[playerKey] ?? 0) + 1;
      const remaining = Math.max(0, MAX_SILHOUETTE_ATTEMPTS - attempts[playerKey]);
      const oppExhausted = oppKey ? (attempts[oppKey] ?? 0) >= MAX_SILHOUETTE_ATTEMPTS : true;
      const outcome: RoomAnswerOutcome = {
        accepted: false,
        reason: remaining <= 0 ? 'attempts_exhausted' : 'invalid_answer',
        attemptsRemaining: remaining,
      };
      if (remaining <= 0 && oppExhausted) {
        return {
          next: {
            ...room,
            players,
            silhouetteAttempts: attempts,
            state: 'round_ended',
            roundWinnerId: null,
            roundEndReason: 'attempts_exhausted',
            roundElapsedSec: null,
            acceptedAnswer: null,
            acceptedPlayerName: getRoundRevealInfo(round).validPlayers[0]?.name || null,
            wrongAttemptPulse: pulse,
            updatedAt: now,
          },
          outcome,
        };
      }
      return {
        next: { ...room, players, silhouetteAttempts: attempts, wrongAttemptPulse: pulse, updatedAt: now },
        outcome,
      };
    }

    return {
      next: { ...room, players, wrongAttemptPulse: pulse, updatedAt: now },
      outcome: { accepted: false, reason: 'invalid_answer' },
    };
  }

  // A valid answer wins the round atomically (first commit wins the race)
  const nextScore = (scores[playerKey] ?? 0) + 1;
  scores[playerKey] = nextScore;
  players[playerKey] = { ...me, score: nextScore, stats: correctStats(wasClutch) };

  return {
    next: {
      ...room,
      players,
      scores,
      state: 'round_ended',
      roundWinnerId: me.id,
      roundEndReason: 'scored',
      roundElapsedSec: elapsedSec,
      acceptedAnswer: answer,
      acceptedPlayerName: res.player.name,
      updatedAt: now,
    },
    outcome: { accepted: true },
  };
}

/** Round / XOX turn timer reached 0 on some client. */
export function applyRoomExpire(room: RoomRecord, phase: RoomPhase, now: number): RoomRecord | null {
  if (room.state !== 'playing' || !isSamePhase(room, phase, true)) return null;

  if (room.minigameType === 'xox') {
    const nextTimeouts = (room.xoxConsecutiveTimeouts ?? 0) + 1;
    if (nextTimeouts < ROOM_XOX_MAX_CONSECUTIVE_TIMEOUTS) {
      const keys = Object.keys(room.players || {});
      const turnKey = room.xoxTurnPlayerId || room.hostId;
      const oppKey = keys.find((k) => k !== turnKey) || room.hostId;
      return {
        ...room,
        xoxTurnPlayerId: oppKey,
        turnSeq: room.turnSeq + 1,
        xoxConsecutiveTimeouts: nextTimeouts,
        xoxNotice: 'Süre doldu, sıra rakibe geçti!',
        roundStartedAt: now,
        updatedAt: now,
      };
    }
  }

  return {
    ...room,
    state: 'round_ended',
    roundWinnerId: null,
    roundEndReason: 'timeout',
    roundElapsedSec: null,
    acceptedAnswer: null,
    acceptedPlayerName: null,
    xoxConsecutiveTimeouts: 0,
    updatedAt: now,
  };
}

/** round_ended -> next countdown, or game_over when someone reached 3 / rounds ran out. */
export function applyRoomAdvance(room: RoomRecord, phase: RoomPhase, now: number): RoomRecord | null {
  if (room.state !== 'round_ended' || !isSamePhase(room, phase, false)) return null;

  const maxScore = Math.max(0, ...Object.values(room.scores || {}));
  const nextIdx = (room.currentRoundIndex ?? 0) + 1;
  if (
    maxScore >= ROOM_WIN_SCORE ||
    nextIdx >= ROOM_MAX_ROUNDS ||
    nextIdx >= (room.roundIds?.length || ROOM_MAX_ROUNDS)
  ) {
    return { ...room, state: 'game_over', updatedAt: now };
  }

  const isXox = room.minigameType === 'xox';
  const xoxStarter = nextIdx % 2 === 0 ? room.hostId : room.guestId || room.hostId;

  return {
    ...room,
    currentRoundIndex: nextIdx,
    state: 'countdown',
    roundStartedAt: null,
    roundWinnerId: null,
    roundEndReason: null,
    roundElapsedSec: null,
    acceptedAnswer: null,
    acceptedPlayerName: null,
    xoxBoardJson: isXox ? JSON.stringify(createEmptyXoxBoard()) : null,
    xoxTurnPlayerId: isXox ? xoxStarter : null,
    xoxNotice: null,
    xoxConsecutiveTimeouts: 0,
    silhouetteAttempts: {},
    updatedAt: now,
  };
}

/** Marks a rematch vote; when both players voted, a fresh match starts. */
export function applyRoomRematch(
  room: RoomRecord,
  rawPlayerId: string,
  now: number,
  seed: number = randomRoomSeed()
): RoomRecord | null {
  if (room.state !== 'game_over') return null;
  const playerKey = getRoomPlayerKey(rawPlayerId);
  const players = { ...(room.players || {}) };
  if (!players[playerKey]) return null;
  players[playerKey] = { ...players[playerKey], rematchRequested: true };

  const keys = Object.keys(players);
  const allReady = keys.length >= 2 && keys.every((k) => players[k].rematchRequested);
  if (!allReady) {
    return { ...room, players, updatedAt: now };
  }

  const resetPlayers: Record<string, RoomPlayerRecord> = {};
  const resetScores: Record<string, number> = {};
  for (const k of keys) {
    resetPlayers[k] = {
      ...players[k],
      score: 0,
      stats: createInitialMatchStats(),
      rematchRequested: false,
    };
    resetScores[k] = 0;
  }
  const isXox = room.minigameType === 'xox';

  return {
    ...room,
    questionSeed: seed,
    roundIds: generateSeededRoundIds(room.minigameType, ROOM_ROUND_POOL_SIZE, seed),
    players: resetPlayers,
    scores: resetScores,
    state: 'countdown',
    currentRoundIndex: 0,
    turnSeq: 0,
    matchSeq: (room.matchSeq || 1) + 1,
    roundStartedAt: null,
    roundWinnerId: null,
    roundEndReason: null,
    roundElapsedSec: null,
    acceptedAnswer: null,
    acceptedPlayerName: null,
    xoxBoardJson: isXox ? JSON.stringify(createEmptyXoxBoard()) : null,
    xoxTurnPlayerId: isXox ? room.hostId : null,
    xoxNotice: null,
    xoxConsecutiveTimeouts: 0,
    wrongAttemptPulse: null,
    silhouetteAttempts: {},
    updatedAt: now,
  };
}
