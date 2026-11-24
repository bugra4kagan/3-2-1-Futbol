import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from 'firebase/database';
import { rtdb } from '../firebase';
import {
  checkXoxBoardWinner,
  createEmptyXoxBoard,
  getRoundRevealInfo,
  validateMinigameAnswer,
} from '../game/minigameEngine';
import { createInitialMatchStats } from '../game/onlineEngine';
import { getClutchThresholdSeconds, getRoundDurationSeconds } from '../game/roundTiming';
import { MAX_SILHOUETTE_ATTEMPTS } from '../game/silhouetteEngine';
import {
  ONLINE_MATCHMAKING_FALLBACK_MS,
  SmartBotOpponent,
  generateSeededRoundIds,
  generateSixCharRoomCode,
  pickSmartBotOpponent,
  resolveRoundPayloadById,
  sanitizeRtdbKey,
} from '../game/realtimeSyncHelpers';
import {
  LeaguePlayerEntry,
  MatchPlayerStats,
  MinigameRoundPayload,
  MinigameType,
  PlayerProfile,
  UserProgression,
  XoxRuntimeState,
} from '../game/types';

export interface RtdbRoomPlayer {
  id: string;
  name: string;
  avatar: string;
  favoriteClubId?: string;
  score: number;
  stats: MatchPlayerStats;
  connected: boolean;
  rematchRequested?: boolean;
}

export interface RtdbRoomRecord {
  code: string;
  minigameType: MinigameType;
  questionSeed: number;
  roundIds: string[];
  hostId: string;
  guestId: string | null;
  players: Record<string, RtdbRoomPlayer>;
  scores: Record<string, number>;
  state: 'waiting' | 'countdown' | 'playing' | 'round_ended' | 'game_over';
  currentRoundIndex: number;
  countdownValue: number;
  roundStartedAt: number | null;
  roundWinnerId: string | null;
  roundEndReason: 'scored' | 'timeout' | 'attempts_exhausted' | 'draw' | null;
  acceptedAnswer: string | null;
  acceptedPlayerName: string | null;
  xoxBoardJson: string | null;
  xoxTurnPlayerId: string | null;
  xoxNotice: string | null;
  xoxConsecutiveTimeouts: number;
  wrongAttemptPulse: { byPlayerId: string; seq: number } | null;
  silhouetteAttempts: Record<string, number>;
  matchSeq: number;
  createdAt: number;
  updatedAt: number;
}

export interface RtdbAnswerOutcome {
  accepted: boolean;
  reason?: 'not_playing' | 'invalid_answer' | 'not_your_turn' | 'invalid_cell' | 'attempts_exhausted';
  xoxTurnChanged?: boolean;
  attemptsRemaining?: number;
}

export function getRtdbRoundPayload(room: RtdbRoomRecord): MinigameRoundPayload | null {
  const roundId = room.roundIds?.[room.currentRoundIndex];
  if (!roundId) return null;
  return resolveRoundPayloadById(room.minigameType, roundId);
}

export function parseRtdbXoxState(room: RtdbRoomRecord): XoxRuntimeState | null {
  if (room.minigameType !== 'xox') return null;
  let board = createEmptyXoxBoard();
  if (room.xoxBoardJson) {
    try {
      const parsed = JSON.parse(room.xoxBoardJson);
      if (Array.isArray(parsed)) board = parsed;
    } catch {
      // fallback empty
    }
  }
  const win = checkXoxBoardWinner(board);
  return {
    board,
    currentTurnPlayerId: room.xoxTurnPlayerId || room.hostId,
    turnTimeRemaining: getRoundDurationSeconds('xox'),
    winningCells: win.winningCells || null,
  };
}

// ── 1. LIVE GLOBAL LEADERBOARD (leaderboard/{playerId}) ──

export async function syncPlayerToRtdbLeaderboard(
  prog: UserProgression,
  profile: PlayerProfile
): Promise<void> {
  if (!profile?.id) return;
  try {
    const key = sanitizeRtdbKey(profile.id);
    const payload: LeaguePlayerEntry & { updatedAt: number } = {
      id: profile.id,
      friendCode: prog.friendCode,
      name: profile.name,
      avatar: profile.avatar,
      favoriteClubId: profile.favoriteClubId,
      weeklyPoints: prog.weeklyPoints,
      totalPoints: prog.totalPoints,
      subtitle: prog.equippedTitle || '',
      equippedCrest: prog.equippedCrest || '',
      equippedFrame: prog.equippedFrame || '',
      equippedBadge: prog.equippedBadge || '',
      hasCrown: prog.unlockedGiftIds.includes('gift_title_legend'),
      matchesPlayed: prog.matchesPlayed,
      wins: prog.wins,
      losses: prog.losses,
      winStreak: prog.winStreak,
      bestWinStreak: prog.bestWinStreak,
      totalCorrectAnswers: prog.totalCorrectAnswers,
      totalWrongAttempts: prog.totalWrongAttempts,
      fastestAnswerSec: prog.fastestAnswerSec ?? null,
      clutchAnswers: prog.clutchAnswers,
      minigameMatchCounts: prog.minigameMatchCounts,
      dailyStreakDays: prog.dailyLogin?.streakDays ?? 0,
      tournamentWins: prog.tournamentWins ?? 0,
      tournamentsPlayed: prog.tournamentsPlayed ?? 0,
      updatedAt: Date.now(),
    };
    await set(ref(rtdb, `leaderboard/${key}`), payload);
  } catch {
    // Graceful offline / rules fallback: localStorage remains source of truth for UX
  }
}

function normalizeLeaderboardSnapshot(raw: unknown): LeaguePlayerEntry[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries = Object.values(raw as Record<string, Record<string, unknown>>)
    .filter((v) => v && typeof v === 'object' && typeof v.name === 'string')
    .map((v): LeaguePlayerEntry => ({
      id: String(v.id || ''),
      friendCode: typeof v.friendCode === 'string' ? v.friendCode : undefined,
      name: String(v.name || 'Oyuncu'),
      avatar: String(v.avatar || '⚽'),
      weeklyPoints: Math.max(0, Number(v.weeklyPoints) || 0),
      totalPoints: Math.max(0, Number(v.totalPoints) || 0),
      subtitle: typeof v.subtitle === 'string' && v.subtitle ? v.subtitle : undefined,
      hasCrown: Boolean(v.hasCrown),
      favoriteClubId: typeof v.favoriteClubId === 'string' ? v.favoriteClubId : undefined,
      equippedCrest: typeof v.equippedCrest === 'string' && v.equippedCrest ? v.equippedCrest : undefined,
      equippedFrame: typeof v.equippedFrame === 'string' && v.equippedFrame ? v.equippedFrame : undefined,
      equippedBadge: typeof v.equippedBadge === 'string' && v.equippedBadge ? v.equippedBadge : undefined,
      matchesPlayed: Math.max(0, Number(v.matchesPlayed) || 0),
      wins: Math.max(0, Number(v.wins) || 0),
      losses: Math.max(0, Number(v.losses) || 0),
      winStreak: Math.max(0, Number(v.winStreak) || 0),
      bestWinStreak: Math.max(0, Number(v.bestWinStreak) || 0),
      totalCorrectAnswers: Math.max(0, Number(v.totalCorrectAnswers) || 0),
      totalWrongAttempts: Math.max(0, Number(v.totalWrongAttempts) || 0),
      fastestAnswerSec:
        typeof v.fastestAnswerSec === 'number' && Number.isFinite(v.fastestAnswerSec)
          ? v.fastestAnswerSec
          : null,
      clutchAnswers: Math.max(0, Number(v.clutchAnswers) || 0),
      minigameMatchCounts:
        v.minigameMatchCounts && typeof v.minigameMatchCounts === 'object'
          ? (v.minigameMatchCounts as Record<MinigameType, number>)
          : undefined,
      dailyStreakDays: Math.max(0, Number(v.dailyStreakDays) || 0),
      tournamentWins: Math.max(0, Number(v.tournamentWins) || 0),
      tournamentsPlayed: Math.max(0, Number(v.tournamentsPlayed) || 0),
    }));

  entries.sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.totalPoints - a.totalPoints);
  return entries;
}

export async function fetchRtdbLeaderboard(): Promise<LeaguePlayerEntry[]> {
  try {
    const snap = await get(ref(rtdb, 'leaderboard'));
    if (!snap.exists()) return [];
    return normalizeLeaderboardSnapshot(snap.val());
  } catch {
    return [];
  }
}

export function subscribeRtdbLeaderboard(
  onUpdate: (players: LeaguePlayerEntry[]) => void
): () => void {
  try {
    const lbRef = ref(rtdb, 'leaderboard');
    return onValue(
      lbRef,
      (snap) => {
        if (!snap.exists()) return;
        const list = normalizeLeaderboardSnapshot(snap.val());
        if (list.length > 0) {
          onUpdate(list);
        }
      },
      () => {
        // ignore listener permission/offline error silently
      }
    );
  } catch {
    return () => {};
  }
}

// ── 2. PRIVATE FRIEND ROOMS (rooms/{roomCode}) ──

function buildInitialRoomObject(params: {
  code: string;
  host: PlayerProfile;
  guest?: PlayerProfile | null;
  minigameType: MinigameType;
}): RtdbRoomRecord {
  const questionSeed = Math.floor(Math.random() * 1_000_000_000) + 1;
  const roundIds = generateSeededRoundIds(params.minigameType, 12, questionSeed);
  const now = Date.now();
  const hostId = sanitizeRtdbKey(params.host.id);
  const guestId = params.guest ? sanitizeRtdbKey(params.guest.id) : null;

  const players: Record<string, RtdbRoomPlayer> = {
    [hostId]: {
      id: params.host.id,
      name: params.host.name,
      avatar: params.host.avatar,
      favoriteClubId: params.host.favoriteClubId,
      score: 0,
      stats: createInitialMatchStats(),
      connected: true,
      rematchRequested: false,
    },
  };
  const scores: Record<string, number> = { [hostId]: 0 };

  if (params.guest && guestId) {
    players[guestId] = {
      id: params.guest.id,
      name: params.guest.name,
      avatar: params.guest.avatar,
      favoriteClubId: params.guest.favoriteClubId,
      score: 0,
      stats: createInitialMatchStats(),
      connected: true,
      rematchRequested: false,
    };
    scores[guestId] = 0;
  }

  return {
    code: params.code,
    minigameType: params.minigameType,
    questionSeed,
    roundIds,
    hostId,
    guestId,
    players,
    scores,
    state: guestId ? 'countdown' : 'waiting',
    currentRoundIndex: 0,
    countdownValue: 3,
    roundStartedAt: null,
    roundWinnerId: null,
    roundEndReason: null,
    acceptedAnswer: null,
    acceptedPlayerName: null,
    xoxBoardJson: params.minigameType === 'xox' ? JSON.stringify(createEmptyXoxBoard()) : null,
    xoxTurnPlayerId: params.minigameType === 'xox' ? hostId : null,
    xoxNotice: null,
    xoxConsecutiveTimeouts: 0,
    wrongAttemptPulse: null,
    silhouetteAttempts: {},
    matchSeq: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createRtdbRoom(
  hostProfile: PlayerProfile,
  minigameType: MinigameType = 'two_clubs'
): Promise<{ code: string; room: RtdbRoomRecord }> {
  const code = generateSixCharRoomCode();
  const room = buildInitialRoomObject({
    code,
    host: hostProfile,
    minigameType,
  });

  const roomRef = ref(rtdb, `rooms/${code}`);
  await set(roomRef, room);
  try {
    void onDisconnect(ref(rtdb, `rooms/${code}/players/${room.hostId}/connected`)).set(false);
  } catch {
    // ignore onDisconnect unsupported error in non-socket environments
  }
  return { code, room };
}

export async function joinRtdbRoom(
  rawCode: string,
  guestProfile: PlayerProfile
): Promise<{ ok: true; room: RtdbRoomRecord } | { ok: false; error: string }> {
  const code = (rawCode || '').trim().toUpperCase();
  if (code.length < 4) {
    return { ok: false, error: 'Geçersiz oda kodu! Lütfen kodu kontrol et.' };
  }

  const roomRef = ref(rtdb, `rooms/${code}`);
  const guestKey = sanitizeRtdbKey(guestProfile.id);

  let errorReason = '';
  const txRes = await runTransaction(roomRef, (current: RtdbRoomRecord | null) => {
    if (!current) {
      errorReason = 'Oda bulunamadı. Lütfen 6 haneli oda kodunu kontrol et!';
      return undefined;
    }
    const existingPlayers = current.players || {};
    const playerKeys = Object.keys(existingPlayers);
    if (!existingPlayers[guestKey] && playerKeys.length >= 2) {
      errorReason = 'Bu oda dolu!';
      return undefined;
    }

    const nextPlayers: Record<string, RtdbRoomPlayer> = {
      ...existingPlayers,
      [guestKey]: {
        id: guestProfile.id,
        name: guestProfile.name,
        avatar: guestProfile.avatar,
        favoriteClubId: guestProfile.favoriteClubId,
        score: existingPlayers[guestKey]?.score ?? 0,
        stats: existingPlayers[guestKey]?.stats ?? createInitialMatchStats(),
        connected: true,
        rematchRequested: false,
      },
    };

    return {
      ...current,
      guestId: current.hostId === guestKey ? current.guestId : guestKey,
      players: nextPlayers,
      scores: {
        ...(current.scores || {}),
        [guestKey]: current.scores?.[guestKey] ?? 0,
      },
      state: 'countdown',
      currentRoundIndex: current.currentRoundIndex || 0,
      countdownValue: 3,
      updatedAt: Date.now(),
    } satisfies RtdbRoomRecord;
  });

  if (!txRes.committed || !txRes.snapshot.exists()) {
    return {
      ok: false,
      error: errorReason || 'Odaya katılınamadı. Lütfen tekrar dene.',
    };
  }

  try {
    void onDisconnect(ref(rtdb, `rooms/${code}/players/${guestKey}/connected`)).set(false);
  } catch {
    // ignore
  }

  return { ok: true, room: txRes.snapshot.val() as RtdbRoomRecord };
}

export function subscribeRtdbRoom(
  code: string,
  onRoomChange: (room: RtdbRoomRecord | null) => void
): () => void {
  const roomRef = ref(rtdb, `rooms/${code}`);
  return onValue(
    roomRef,
    (snap) => {
      onRoomChange(snap.exists() ? (snap.val() as RtdbRoomRecord) : null);
    },
    () => {
      onRoomChange(null);
    }
  );
}

export async function updateRtdbCountdown(
  code: string,
  nextCount: number
): Promise<void> {
  const roomRef = ref(rtdb, `rooms/${code}`);
  await runTransaction(roomRef, (current: RtdbRoomRecord | null) => {
    if (!current || current.state !== 'countdown') return undefined;
    if (nextCount <= 0) {
      return {
        ...current,
        countdownValue: 0,
        state: 'playing',
        roundStartedAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
    return {
      ...current,
      countdownValue: nextCount,
      updatedAt: Date.now(),
    };
  });
}

export async function submitRtdbAnswer(
  code: string,
  rawPlayerId: string,
  answer: string,
  cellPos?: { row: number; col: number }
): Promise<RtdbAnswerOutcome> {
  const roomRef = ref(rtdb, `rooms/${code}`);
  const playerKey = sanitizeRtdbKey(rawPlayerId);
  let outcome: RtdbAnswerOutcome = { accepted: false, reason: 'invalid_answer' };

  await runTransaction(roomRef, (current: RtdbRoomRecord | null) => {
    if (!current || current.state !== 'playing') {
      outcome = { accepted: false, reason: 'not_playing' };
      return undefined;
    }

    const round = getRtdbRoundPayload(current);
    if (!round) {
      outcome = { accepted: false, reason: 'not_playing' };
      return undefined;
    }

    const players = { ...(current.players || {}) };
    const scores = { ...(current.scores || {}) };
    const me = players[playerKey];
    const oppKey = Object.keys(players).find((k) => k !== playerKey) || null;
    if (!me) return undefined;

    const now = Date.now();
    const elapsedSec = current.roundStartedAt
      ? Math.max(0.2, (now - current.roundStartedAt) / 1000)
      : 4;

    if (current.minigameType === 'xox') {
      if (current.xoxTurnPlayerId && current.xoxTurnPlayerId !== playerKey) {
        outcome = { accepted: false, reason: 'not_your_turn' };
        return undefined;
      }
      if (!cellPos || cellPos.row < 0 || cellPos.row > 2 || cellPos.col < 0 || cellPos.col > 2) {
        outcome = { accepted: false, reason: 'invalid_cell' };
        return undefined;
      }
      let board = createEmptyXoxBoard();
      if (current.xoxBoardJson) {
        try {
          const parsed = JSON.parse(current.xoxBoardJson);
          if (Array.isArray(parsed)) board = parsed;
        } catch {
          // ignore
        }
      }
      if (board[cellPos.row]?.[cellPos.col]) {
        outcome = { accepted: false, reason: 'invalid_cell' };
        return undefined;
      }

      const check = validateMinigameAnswer(round, answer, cellPos);
      if (!check.isValid || !check.player) {
        const nextStats: MatchPlayerStats = {
          ...me.stats,
          totalWrongAttempts: (me.stats?.totalWrongAttempts ?? 0) + 1,
          currentStreak: 0,
        };
        players[playerKey] = { ...me, stats: nextStats };
        outcome = { accepted: false, reason: 'invalid_answer', xoxTurnChanged: true };
        return {
          ...current,
          players,
          xoxTurnPlayerId: oppKey || playerKey,
          xoxNotice: 'Yanlış tahmin! Sıra rakibe geçti.',
          xoxConsecutiveTimeouts: 0,
          wrongAttemptPulse: { byPlayerId: me.id, seq: now },
          updatedAt: now,
        };
      }

      board[cellPos.row][cellPos.col] = {
        ownerId: me.id,
        symbol: current.hostId === playerKey ? 'X' : 'O',
        playerName: check.player.name,
      };
      const xoxWin = checkXoxBoardWinner(board);
      const nextStreak = (me.stats?.currentStreak ?? 0) + 1;
      const nextStats: MatchPlayerStats = {
        ...me.stats,
        totalCorrect: (me.stats?.totalCorrect ?? 0) + 1,
        currentStreak: nextStreak,
        maxStreak: Math.max(me.stats?.maxStreak ?? 0, nextStreak),
        fastestAnswerSec:
          me.stats?.fastestAnswerSec == null
            ? Number(elapsedSec.toFixed(1))
            : Math.min(me.stats.fastestAnswerSec, Number(elapsedSec.toFixed(1))),
      };
      players[playerKey] = { ...me, stats: nextStats };

      if (xoxWin.winnerId || xoxWin.isBoardFull) {
        const winnerKey = xoxWin.winnerId
          ? Object.keys(players).find((k) => players[k].id === xoxWin.winnerId) || playerKey
          : null;
        if (winnerKey) {
          scores[winnerKey] = (scores[winnerKey] ?? 0) + 1;
          players[winnerKey] = { ...players[winnerKey], score: scores[winnerKey] };
        }
        outcome = { accepted: true };
        return {
          ...current,
          players,
          scores,
          xoxBoardJson: JSON.stringify(board),
          xoxNotice: winnerKey ? `${check.player.name} ile XOX tamamlandı!` : 'Tahta berabere!',
          state: 'round_ended',
          roundWinnerId: winnerKey ? players[winnerKey].id : null,
          roundEndReason: winnerKey ? 'scored' : 'draw',
          acceptedAnswer: answer,
          acceptedPlayerName: check.player.name,
          xoxConsecutiveTimeouts: 0,
          updatedAt: now,
        };
      }

      outcome = { accepted: true, xoxTurnChanged: true };
      return {
        ...current,
        players,
        xoxBoardJson: JSON.stringify(board),
        xoxTurnPlayerId: oppKey || playerKey,
        xoxNotice: `${check.player.name} ile kare alındı!`,
        xoxConsecutiveTimeouts: 0,
        updatedAt: now,
      };
    }

    // Standard / Silhouette / Career / Country+Club validation
    if (current.minigameType === 'silhouette') {
      const used = current.silhouetteAttempts?.[playerKey] ?? 0;
      if (used >= MAX_SILHOUETTE_ATTEMPTS) {
        outcome = { accepted: false, reason: 'attempts_exhausted', attemptsRemaining: 0 };
        return undefined;
      }
    }

    const res = validateMinigameAnswer(round, answer);
    if (!res.isValid || !res.player) {
      const nextStats: MatchPlayerStats = {
        ...me.stats,
        totalWrongAttempts: (me.stats?.totalWrongAttempts ?? 0) + 1,
        currentStreak: 0,
      };
      players[playerKey] = { ...me, stats: nextStats };
      const attemptsMap = { ...(current.silhouetteAttempts || {}) };
      if (current.minigameType === 'silhouette') {
        attemptsMap[playerKey] = (attemptsMap[playerKey] ?? 0) + 1;
        const remaining = Math.max(0, MAX_SILHOUETTE_ATTEMPTS - attemptsMap[playerKey]);
        const oppExhausted = oppKey
          ? (attemptsMap[oppKey] ?? 0) >= MAX_SILHOUETTE_ATTEMPTS
          : true;
        outcome = {
          accepted: false,
          reason: remaining <= 0 ? 'attempts_exhausted' : 'invalid_answer',
          attemptsRemaining: remaining,
        };
        if (remaining <= 0 && oppExhausted) {
          return {
            ...current,
            players,
            silhouetteAttempts: attemptsMap,
            state: 'round_ended',
            roundWinnerId: null,
            roundEndReason: 'attempts_exhausted',
            acceptedAnswer: null,
            acceptedPlayerName: getRoundRevealInfo(round).validPlayers[0]?.name || null,
            wrongAttemptPulse: { byPlayerId: me.id, seq: now },
            updatedAt: now,
          };
        }
        return {
          ...current,
          players,
          silhouetteAttempts: attemptsMap,
          wrongAttemptPulse: { byPlayerId: me.id, seq: now },
          updatedAt: now,
        };
      }

      outcome = { accepted: false, reason: 'invalid_answer' };
      return {
        ...current,
        players,
        wrongAttemptPulse: { byPlayerId: me.id, seq: now },
        updatedAt: now,
      };
    }

    // Valid answer wins the round atomically
    const roundDuration = getRoundDurationSeconds(current.minigameType);
    const clutchThreshold = getClutchThresholdSeconds(current.minigameType);
    const remaining = Math.max(0, roundDuration - elapsedSec);
    const wasClutch = remaining <= clutchThreshold;
    const nextStreak = (me.stats?.currentStreak ?? 0) + 1;
    const nextScore = (scores[playerKey] ?? 0) + 1;
    scores[playerKey] = nextScore;

    players[playerKey] = {
      ...me,
      score: nextScore,
      stats: {
        ...me.stats,
        totalCorrect: (me.stats?.totalCorrect ?? 0) + 1,
        currentStreak: nextStreak,
        maxStreak: Math.max(me.stats?.maxStreak ?? 0, nextStreak),
        clutchAnswers: (me.stats?.clutchAnswers ?? 0) + (wasClutch ? 1 : 0),
        fastestAnswerSec:
          me.stats?.fastestAnswerSec == null
            ? Number(elapsedSec.toFixed(1))
            : Math.min(me.stats.fastestAnswerSec, Number(elapsedSec.toFixed(1))),
      },
    };

    outcome = { accepted: true };
    return {
      ...current,
      players,
      scores,
      state: 'round_ended',
      roundWinnerId: me.id,
      roundEndReason: 'scored',
      acceptedAnswer: answer,
      acceptedPlayerName: res.player.name,
      updatedAt: now,
    };
  });

  return outcome;
}

export async function expireRtdbRound(code: string): Promise<void> {
  const roomRef = ref(rtdb, `rooms/${code}`);
  await runTransaction(roomRef, (current: RtdbRoomRecord | null) => {
    if (!current || current.state !== 'playing') return undefined;
    const now = Date.now();
    if (current.minigameType === 'xox') {
      const nextTimeouts = (current.xoxConsecutiveTimeouts ?? 0) + 1;
      const pKeys = Object.keys(current.players || {});
      const oppKey = pKeys.find((k) => k !== current.xoxTurnPlayerId) || current.hostId;
      if (nextTimeouts < 2) {
        return {
          ...current,
          xoxTurnPlayerId: oppKey,
          xoxConsecutiveTimeouts: nextTimeouts,
          xoxNotice: 'Süre doldu, sıra rakibe geçti!',
          roundStartedAt: now,
          updatedAt: now,
        };
      }
      return {
        ...current,
        state: 'round_ended',
        roundWinnerId: null,
        roundEndReason: 'timeout',
        xoxConsecutiveTimeouts: 0,
        updatedAt: now,
      };
    }

    return {
      ...current,
      state: 'round_ended',
      roundWinnerId: null,
      roundEndReason: 'timeout',
      acceptedAnswer: null,
      acceptedPlayerName: null,
      updatedAt: now,
    };
  });
}

export async function advanceRtdbNextRound(code: string): Promise<void> {
  const roomRef = ref(rtdb, `rooms/${code}`);
  await runTransaction(roomRef, (current: RtdbRoomRecord | null) => {
    if (!current || current.state !== 'round_ended') return undefined;
    const now = Date.now();
    const maxScore = Math.max(0, ...Object.values(current.scores || {}));
    const nextIdx = (current.currentRoundIndex ?? 0) + 1;
    if (maxScore >= 3 || nextIdx >= 10 || nextIdx >= (current.roundIds?.length || 10)) {
      return {
        ...current,
        state: 'game_over',
        updatedAt: now,
      };
    }

    const pKeys = Object.keys(current.players || {});
    const starterXox = pKeys[nextIdx % Math.max(1, pKeys.length)] || current.hostId;

    return {
      ...current,
      currentRoundIndex: nextIdx,
      state: 'countdown',
      countdownValue: 3,
      roundStartedAt: null,
      roundWinnerId: null,
      roundEndReason: null,
      acceptedAnswer: null,
      acceptedPlayerName: null,
      xoxBoardJson: current.minigameType === 'xox' ? JSON.stringify(createEmptyXoxBoard()) : null,
      xoxTurnPlayerId: current.minigameType === 'xox' ? starterXox : null,
      xoxNotice: null,
      xoxConsecutiveTimeouts: 0,
      silhouetteAttempts: {},
      updatedAt: now,
    };
  });
}

export async function requestRtdbRematch(code: string, rawPlayerId: string): Promise<void> {
  const roomRef = ref(rtdb, `rooms/${code}`);
  const playerKey = sanitizeRtdbKey(rawPlayerId);
  await runTransaction(roomRef, (current: RtdbRoomRecord | null) => {
    if (!current || current.state !== 'game_over') return undefined;
    const players = { ...(current.players || {}) };
    if (!players[playerKey]) return undefined;
    players[playerKey] = { ...players[playerKey], rematchRequested: true };

    const keys = Object.keys(players);
    const allReady = keys.length >= 2 && keys.every((k) => players[k].rematchRequested);
    if (!allReady) {
      return {
        ...current,
        players,
        updatedAt: Date.now(),
      };
    }

    const nextSeed = Math.floor(Math.random() * 1_000_000_000) + 1;
    const nextRoundIds = generateSeededRoundIds(current.minigameType, 12, nextSeed);
    const resetPlayers: Record<string, RtdbRoomPlayer> = {};
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

    return {
      ...current,
      questionSeed: nextSeed,
      roundIds: nextRoundIds,
      players: resetPlayers,
      scores: resetScores,
      state: 'countdown',
      currentRoundIndex: 0,
      countdownValue: 3,
      roundStartedAt: null,
      roundWinnerId: null,
      roundEndReason: null,
      acceptedAnswer: null,
      acceptedPlayerName: null,
      xoxBoardJson: current.minigameType === 'xox' ? JSON.stringify(createEmptyXoxBoard()) : null,
      xoxTurnPlayerId: current.minigameType === 'xox' ? current.hostId : null,
      xoxNotice: null,
      xoxConsecutiveTimeouts: 0,
      silhouetteAttempts: {},
      matchSeq: (current.matchSeq || 1) + 1,
      updatedAt: Date.now(),
    };
  });
}

export async function cleanupRtdbRoom(code: string): Promise<void> {
  if (!code) return;
  try {
    await remove(ref(rtdb, `rooms/${code.trim().toUpperCase()}`));
  } catch {
    // ignore cleanup error
  }
}

// ── 3. ONLINE 1v1 MATCHMAKING (matchmaking_queue + 4s Smart Bot Fallback) ──

interface QueueSlotEntry {
  playerId: string;
  playerKey: string;
  profile: PlayerProfile;
  minigameType: MinigameType;
  joinedAt: number;
}

export function startRtdbMatchmaking(params: {
  profile: PlayerProfile;
  minigameType: MinigameType;
  onRoomMatched: (code: string, room: RtdbRoomRecord) => void;
  onFallbackToBot: (bot: SmartBotOpponent) => void;
}): () => void {
  const myKey = sanitizeRtdbKey(params.profile.id);
  const queueItemRef = ref(rtdb, `matchmaking_queue/${params.minigameType}/${myKey}`);
  const queueListRef = ref(rtdb, `matchmaking_queue/${params.minigameType}`);
  const myMatchRef = ref(rtdb, `matchmaking_matches/${myKey}`);

  let settled = false;
  let unsubQueue: (() => void) | null = null;
  let unsubMatch: (() => void) | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanupQueue = () => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    unsubQueue?.();
    unsubQueue = null;
    unsubMatch?.();
    unsubMatch = null;
    void remove(queueItemRef).catch(() => {});
  };

  const entry: QueueSlotEntry = {
    playerId: params.profile.id,
    playerKey: myKey,
    profile: { ...params.profile, score: 0 },
    minigameType: params.minigameType,
    joinedAt: Date.now(),
  };

  try {
    void remove(myMatchRef).catch(() => {});
    void set(queueItemRef, entry).catch(() => {});
    void onDisconnect(queueItemRef).remove().catch(() => {});
  } catch {
    // fallback timer handles offline gracefully
  }

  unsubMatch = onValue(
    myMatchRef,
    async (snap) => {
      if (settled || !snap.exists()) return;
      const matchData = snap.val() as { roomCode?: string };
      if (!matchData?.roomCode) return;
      settled = true;
      cleanupQueue();
      void remove(myMatchRef).catch(() => {});
      const roomSnap = await get(ref(rtdb, `rooms/${matchData.roomCode}`)).catch(() => null);
      if (roomSnap?.exists()) {
        params.onRoomMatched(matchData.roomCode, roomSnap.val() as RtdbRoomRecord);
      } else {
        params.onFallbackToBot(pickSmartBotOpponent());
      }
    },
    () => {}
  );

  unsubQueue = onValue(
    queueListRef,
    async (snap) => {
      if (settled || !snap.exists()) return;
      const raw = snap.val() as Record<string, QueueSlotEntry>;
      const now = Date.now();
      const candidates = Object.values(raw).filter(
        (c) => c && c.playerKey && c.playerKey !== myKey && now - (c.joinedAt || 0) < 20_000
      );
      if (candidates.length === 0) return;

      const opponent = candidates[0];
      // Deterministic leader avoids both clients creating separate rooms simultaneously
      if (myKey > opponent.playerKey) return;

      const oppQueueRef = ref(rtdb, `matchmaking_queue/${params.minigameType}/${opponent.playerKey}`);
      let claimedOpp: QueueSlotEntry | null = null;
      try {
        const tx = await runTransaction(oppQueueRef, (cur: QueueSlotEntry | null) => {
          if (!cur) return undefined;
          claimedOpp = cur;
          return null;
        });
        if (!tx.committed || !claimedOpp) return;
      } catch {
        return;
      }

      if (settled) return;
      settled = true;
      cleanupQueue();

      const code = generateSixCharRoomCode();
      const room = buildInitialRoomObject({
        code,
        host: params.profile,
        guest: (claimedOpp as QueueSlotEntry).profile,
        minigameType: params.minigameType,
      });

      try {
        await set(ref(rtdb, `rooms/${code}`), room);
        await set(ref(rtdb, `matchmaking_matches/${opponent.playerKey}`), {
          roomCode: code,
          minigameType: params.minigameType,
          createdAt: Date.now(),
        });
        params.onRoomMatched(code, room);
      } catch {
        params.onFallbackToBot(pickSmartBotOpponent());
      }
    },
    () => {}
  );

  // Seamless 4-second fallback to realistic bot opponent
  fallbackTimer = setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanupQueue();
    params.onFallbackToBot(pickSmartBotOpponent());
  }, ONLINE_MATCHMAKING_FALLBACK_MS);

  return () => {
    settled = true;
    cleanupQueue();
  };
}
