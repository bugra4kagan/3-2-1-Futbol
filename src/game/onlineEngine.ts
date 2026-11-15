import {
  MatchPlayerStats,
  MinigameRoundPayload,
  MinigameType,
  Player,
  PlayerProfile,
  XoxRuntimeState,
} from './types';
import {
  checkXoxBoardWinner,
  createEmptyXoxBoard,
  generateMinigameRounds,
  getMinigamePoolSize,
  getRoundItemId,
  getRoundRevealInfo,
  validateMinigameAnswer,
} from './minigameEngine';
import { getClutchThresholdSeconds, getRoundDurationSeconds } from './roundTiming';
import { MAX_SILHOUETTE_ATTEMPTS } from './silhouetteEngine';

export type RoomState = 'waiting' | 'countdown' | 'playing' | 'round_ended' | 'game_over';

export interface OnlinePlayerEntry {
  playerId: string;
  profile: PlayerProfile;
  stats: MatchPlayerStats;
}

export interface QueuedPlayerEntry extends OnlinePlayerEntry {
  minigameType: MinigameType;
}

export interface OnlineRoom {
  code: string;
  minigameType: MinigameType;
  players: OnlinePlayerEntry[];
  rounds: MinigameRoundPayload[];
  currentRoundIndex: number;
  scores: Record<string, number>;
  state: RoomState;
  roundWinnerId: string | null;
  countdownValue: number;
  roundTimeRemaining: number;
  acceptedAnswer?: string;
  acceptedPlayerName?: string;
  xoxState?: XoxRuntimeState;
  xoxConsecutiveTimeouts: number;
  silhouetteAttempts: Record<string, number>;
  rematchReadyIds: Set<string>;
}

export function createInitialMatchStats(): MatchPlayerStats {
  return {
    fastestAnswerSec: null,
    totalCorrect: 0,
    totalWrongAttempts: 0,
    currentStreak: 0,
    maxStreak: 0,
    clutchAnswers: 0,
    trailedThenWon: false,
  };
}

export interface SubmitAnswerOutcome {
  accepted: boolean;
  reason?: 'not_playing' | 'invalid_answer' | 'not_your_turn' | 'invalid_cell' | 'attempts_exhausted';
  xoxMove?: boolean;
  xoxTurnChanged?: boolean;
  xoxState?: XoxRuntimeState;
  lastMove?: { row: number; col: number; playerName: string; ownerId: string };
  winnerId?: string | null;
  winnerName?: string;
  acceptedAnswer?: string;
  acceptedPlayerName?: string;
  scores?: Record<string, number>;
  stats?: Record<string, MatchPlayerStats>;
  validPlayers?: Player[];
  funFact?: string;
  roundIndex?: number;
  isMatchFinished?: boolean;
  attempt?: string;
  attemptsUsed?: number;
  attemptsRemaining?: number;
  roundExhausted?: boolean;
}

export interface ExpireRoundOutcome {
  expired: boolean;
  xoxTurnPassed?: boolean;
  xoxState?: XoxRuntimeState;
  timeRemaining?: number;
  scores: Record<string, number>;
  stats: Record<string, MatchPlayerStats>;
  validPlayers: Player[];
  funFact?: string;
  roundIndex: number;
  isMatchFinished: boolean;
}

export type RoundsFactory = (
  type: MinigameType,
  count: number,
  excludeIds?: ReadonlySet<string> | readonly string[]
) => MinigameRoundPayload[];

export class OnlineMatchEngine {
  public rooms = new Map<string, OnlineRoom>();
  public queue: QueuedPlayerEntry[] = [];
  private roundsFactory: RoundsFactory;
  private recentRoundIds = new Map<MinigameType, string[]>();

  constructor(roundsFactory: RoundsFactory = generateMinigameRounds) {
    this.roundsFactory = roundsFactory;
  }

  private dealNonRepeatingRounds(minigameType: MinigameType, count: number = 12): MinigameRoundPayload[] {
    const excludeList = this.recentRoundIds.get(minigameType) || [];
    const rounds = this.roundsFactory(minigameType, count, excludeList);
    const poolSize = getMinigamePoolSize(minigameType);
    const pickedIds = rounds.map(getRoundItemId).filter(Boolean);
    const merged = Array.from(new Set([...excludeList, ...pickedIds]));
    this.recentRoundIds.set(
      minigameType,
      merged.length >= poolSize ? pickedIds : merged
    );
    return rounds;
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return this.rooms.has(code) ? this.generateRoomCode() : code;
  }

  private buildEntry(profile: PlayerProfile): OnlinePlayerEntry {
    return {
      playerId: profile.id,
      profile: {
        ...profile,
        score: 0,
      },
      stats: createInitialMatchStats(),
    };
  }

  public createRoom(
    hostProfile: PlayerProfile,
    minigameType: MinigameType = 'two_clubs'
  ): OnlineRoom {
    const code = this.generateRoomCode();
    const hostEntry = this.buildEntry(hostProfile);
    const room: OnlineRoom = {
      code,
      minigameType,
      players: [hostEntry],
      rounds: this.dealNonRepeatingRounds(minigameType, 12),
      currentRoundIndex: 0,
      scores: { [hostProfile.id]: 0 },
      state: 'waiting',
      roundWinnerId: null,
      countdownValue: 3,
      roundTimeRemaining: getRoundDurationSeconds(minigameType),
      xoxConsecutiveTimeouts: 0,
      silhouetteAttempts: {},
      rematchReadyIds: new Set(),
    };
    this.rooms.set(code, room);
    return room;
  }

  public joinRoom(
    rawCode: string,
    guestProfile: PlayerProfile
  ): { ok: true; room: OnlineRoom; host: PlayerProfile } | { ok: false; error: string } {
    const code = (rawCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: 'Oda bulunamadı. Lütfen oda kodunu kontrol et!' };
    }
    if (room.players.some((p) => p.playerId === guestProfile.id)) {
      return { ok: false, error: 'Bu odada zaten bulunuyorsun.' };
    }
    if (room.players.length >= 2) {
      return { ok: false, error: 'Bu oda dolu!' };
    }

    const guestEntry = this.buildEntry(guestProfile);
    room.players.push(guestEntry);
    room.scores[guestProfile.id] = 0;

    return {
      ok: true,
      room,
      host: room.players[0].profile,
    };
  }

  public enqueueQuickMatch(
    profile: PlayerProfile,
    minigameType: MinigameType = 'two_clubs'
  ): { matched: true; room: OnlineRoom } | { matched: false } {
    this.queue = this.queue.filter((item) => item.playerId !== profile.id);

    const entry = this.buildEntry(profile);
    const opponentIdx = this.queue.findIndex((item) => item.minigameType === minigameType);

    if (opponentIdx !== -1) {
      const [opponent] = this.queue.splice(opponentIdx, 1);
      const code = this.generateRoomCode();
      const room: OnlineRoom = {
        code,
        minigameType,
        players: [
          { playerId: opponent.playerId, profile: opponent.profile, stats: opponent.stats },
          entry,
        ],
        rounds: this.dealNonRepeatingRounds(minigameType, 12),
        currentRoundIndex: 0,
        scores: {
          [opponent.playerId]: 0,
          [entry.playerId]: 0,
        },
        state: 'waiting',
        roundWinnerId: null,
        countdownValue: 3,
        roundTimeRemaining: getRoundDurationSeconds(minigameType),
        xoxConsecutiveTimeouts: 0,
        silhouetteAttempts: {},
        rematchReadyIds: new Set(),
      };
      this.rooms.set(code, room);
      return { matched: true, room };
    }

    this.queue.push({ ...entry, minigameType });
    return { matched: false };
  }

  public cancelQuickMatch(playerId: string): void {
    this.queue = this.queue.filter((item) => item.playerId !== playerId);
  }

  public beginCountdown(room: OnlineRoom) {
    room.state = 'countdown';
    room.countdownValue = 3;
    room.roundWinnerId = null;
    room.xoxConsecutiveTimeouts = 0;
    room.silhouetteAttempts = {};
    delete room.acceptedAnswer;
    delete room.acceptedPlayerName;

    const round = room.rounds[room.currentRoundIndex];

    if (room.minigameType === 'xox') {
      const starter = room.players[room.currentRoundIndex % room.players.length];
      room.xoxState = {
        board: createEmptyXoxBoard(),
        currentTurnPlayerId: starter.playerId,
        turnTimeRemaining: 15,
        winningCells: null,
      };
    } else {
      delete room.xoxState;
    }

    return {
      minigameType: room.minigameType,
      roundIndex: room.currentRoundIndex + 1,
      totalRounds: Math.min(10, room.rounds.length),
      countdown: room.countdownValue,
      round,
      pairing: round.pairing,
      xoxState: room.xoxState,
      scores: { ...room.scores },
    };
  }

  public startRound(room: OnlineRoom) {
    room.state = 'playing';
    room.roundTimeRemaining = getRoundDurationSeconds(room.minigameType);

    const round = room.rounds[room.currentRoundIndex];

    if (room.minigameType === 'xox' && !room.xoxState) {
      const starter = room.players[room.currentRoundIndex % room.players.length];
      room.xoxState = {
        board: createEmptyXoxBoard(),
        currentTurnPlayerId: starter.playerId,
        turnTimeRemaining: 15,
        winningCells: null,
      };
    }

    return {
      minigameType: room.minigameType,
      roundIndex: room.currentRoundIndex + 1,
      totalRounds: Math.min(10, room.rounds.length),
      round,
      pairing: round.pairing,
      pairingId: round.pairing?.id,
      xoxState: room.xoxState,
      timeRemaining: room.roundTimeRemaining,
    };
  }

  private getStatsMap(room: OnlineRoom): Record<string, MatchPlayerStats> {
    const map: Record<string, MatchPlayerStats> = {};
    for (const p of room.players) {
      map[p.playerId] = { ...p.stats };
    }
    return map;
  }

  private checkMatchFinished(room: OnlineRoom): boolean {
    const firstToThree = Object.values(room.scores).some((s) => s >= 3);
    const maxRoundsCap = Math.min(10, room.rounds.length);
    const reachedMaxRounds = room.currentRoundIndex + 1 >= maxRoundsCap;
    return firstToThree || reachedMaxRounds;
  }

  private recordWinAndStats(
    room: OnlineRoom,
    winnerId: string,
    acceptedAnswer: string,
    acceptedPlayerName: string
  ) {
    room.state = 'round_ended';
    room.roundWinnerId = winnerId;
    room.acceptedAnswer = acceptedAnswer;
    room.acceptedPlayerName = acceptedPlayerName;

    const submitter = room.players.find((p) => p.playerId === winnerId)!;
    const opponent = room.players.find((p) => p.playerId !== winnerId);
    const submitterPrevScore = room.scores[winnerId] || 0;
    const opponentPrevScore = opponent ? room.scores[opponent.playerId] || 0 : 0;
    const wasTrailing = submitterPrevScore < opponentPrevScore;

    const newScore = submitterPrevScore + 1;
    room.scores[winnerId] = newScore;
    submitter.profile.score = newScore;

    const totalDuration = getRoundDurationSeconds(room.minigameType);
    const elapsedSec = Math.max(1, totalDuration - room.roundTimeRemaining);
    const isClutch = room.roundTimeRemaining <= getClutchThresholdSeconds(room.minigameType);
    const newStreak = submitter.stats.currentStreak + 1;

    submitter.stats.totalCorrect += 1;
    submitter.stats.fastestAnswerSec =
      submitter.stats.fastestAnswerSec === null
        ? elapsedSec
        : Math.min(submitter.stats.fastestAnswerSec, elapsedSec);
    submitter.stats.currentStreak = newStreak;
    submitter.stats.maxStreak = Math.max(submitter.stats.maxStreak, newStreak);
    if (isClutch) submitter.stats.clutchAnswers += 1;
    if (wasTrailing) submitter.stats.trailedThenWon = true;

    if (opponent) {
      opponent.stats.currentStreak = 0;
    }

    const round = room.rounds[room.currentRoundIndex];
    const reveal = getRoundRevealInfo(round);
    const isMatchFinished = this.checkMatchFinished(room);

    return {
      winnerId,
      winnerName: submitter.profile.name,
      acceptedAnswer,
      acceptedPlayerName,
      scores: { ...room.scores },
      stats: this.getStatsMap(room),
      validPlayers: reveal.validPlayers,
      funFact: reveal.funFact,
      roundIndex: room.currentRoundIndex + 1,
      isMatchFinished,
    };
  }

  public submitAnswer(
    room: OnlineRoom,
    playerId: string,
    rawAnswer: string,
    cellPos?: { row: number; col: number }
  ): SubmitAnswerOutcome {
    if (room.state !== 'playing') {
      return { accepted: false, reason: 'not_playing' };
    }

    const submitterIdx = room.players.findIndex((p) => p.playerId === playerId);
    if (submitterIdx === -1) {
      return { accepted: false, reason: 'not_playing' };
    }
    const submitter = room.players[submitterIdx];
    const opponent = room.players.find((p) => p.playerId !== playerId);
    const round = room.rounds[room.currentRoundIndex];

    // Special turn-based 3x3 board logic for XOX
    if (room.minigameType === 'xox' && room.xoxState) {
      if (room.xoxState.currentTurnPlayerId !== playerId) {
        return { accepted: false, reason: 'not_your_turn' };
      }
      if (
        !cellPos ||
        cellPos.row < 0 ||
        cellPos.row > 2 ||
        cellPos.col < 0 ||
        cellPos.col > 2 ||
        room.xoxState.board[cellPos.row][cellPos.col] !== null
      ) {
        return { accepted: false, reason: 'invalid_cell' };
      }

      const validation = validateMinigameAnswer(round, rawAnswer, cellPos);
      if (!validation.isValid || !validation.player) {
        submitter.stats.totalWrongAttempts += 1;
        // Pass turn to opponent on wrong XOX guess
        if (opponent) {
          room.xoxState.currentTurnPlayerId = opponent.playerId;
        }
        room.roundTimeRemaining = 15;
        room.xoxState.turnTimeRemaining = 15;
        return {
          accepted: false,
          reason: 'invalid_answer',
          attempt: rawAnswer,
          xoxTurnChanged: true,
          xoxState: {
            ...room.xoxState,
            board: room.xoxState.board.map((r) => [...r]),
          },
        };
      }

      room.xoxConsecutiveTimeouts = 0;
      const symbol: 'X' | 'O' = submitterIdx === 0 ? 'X' : 'O';
      room.xoxState.board[cellPos.row][cellPos.col] = {
        ownerId: playerId,
        symbol,
        playerName: validation.player.name,
      };
      submitter.stats.totalCorrect += 1;

      const winCheck = checkXoxBoardWinner(room.xoxState.board);
      if (winCheck.winnerId) {
        room.xoxState.winningCells = winCheck.winningCells;
        const winPayload = this.recordWinAndStats(
          room,
          winCheck.winnerId,
          rawAnswer,
          validation.player.name
        );
        return {
          accepted: true,
          xoxState: {
            ...room.xoxState,
            board: room.xoxState.board.map((r) => [...r]),
          },
          lastMove: {
            row: cellPos.row,
            col: cellPos.col,
            playerName: validation.player.name,
            ownerId: playerId,
          },
          ...winPayload,
        };
      }

      if (winCheck.isBoardFull) {
        room.state = 'round_ended';
        room.roundWinnerId = null;
        const reveal = getRoundRevealInfo(round);
        return {
          accepted: true,
          winnerId: null,
          scores: { ...room.scores },
          stats: this.getStatsMap(room),
          validPlayers: reveal.validPlayers,
          funFact: reveal.funFact,
          roundIndex: room.currentRoundIndex + 1,
          isMatchFinished: this.checkMatchFinished(room),
          xoxState: {
            ...room.xoxState,
            board: room.xoxState.board.map((r) => [...r]),
          },
        };
      }

      // Game continues on next player's turn
      if (opponent) {
        room.xoxState.currentTurnPlayerId = opponent.playerId;
      }
      room.roundTimeRemaining = 15;
      room.xoxState.turnTimeRemaining = 15;
      return {
        accepted: true,
        xoxMove: true,
        xoxState: {
          ...room.xoxState,
          board: room.xoxState.board.map((r) => [...r]),
        },
        lastMove: {
          row: cellPos.row,
          col: cellPos.col,
          playerName: validation.player.name,
          ownerId: playerId,
        },
        stats: this.getStatsMap(room),
      };
    }

    // Standard First-to-Answer Minigames (two_clubs, silhouette, career, country_club)
    if (room.minigameType === 'silhouette') {
      const used = room.silhouetteAttempts[playerId] || 0;
      if (used >= MAX_SILHOUETTE_ATTEMPTS) {
        return {
          accepted: false,
          reason: 'attempts_exhausted',
          attemptsUsed: used,
          attemptsRemaining: 0,
        };
      }
    }

    const validation = validateMinigameAnswer(round, rawAnswer);
    if (!validation.isValid || !validation.player) {
      submitter.stats.totalWrongAttempts += 1;

      if (room.minigameType === 'silhouette') {
        const nextAttempts = (room.silhouetteAttempts[playerId] || 0) + 1;
        room.silhouetteAttempts[playerId] = nextAttempts;
        const attemptsRemaining = Math.max(0, MAX_SILHOUETTE_ATTEMPTS - nextAttempts);

        const allExhausted =
          room.players.length > 0 &&
          room.players.every(
            (p) => (room.silhouetteAttempts[p.playerId] || 0) >= MAX_SILHOUETTE_ATTEMPTS
          );

        if (allExhausted) {
          room.state = 'round_ended';
          room.roundWinnerId = null;
          for (const p of room.players) {
            p.stats.currentStreak = 0;
          }
          const reveal = getRoundRevealInfo(round);
          const isMatchFinished = this.checkMatchFinished(room);
          return {
            accepted: false,
            reason: 'attempts_exhausted',
            attempt: rawAnswer,
            attemptsUsed: nextAttempts,
            attemptsRemaining: 0,
            roundExhausted: true,
            scores: { ...room.scores },
            stats: this.getStatsMap(room),
            validPlayers: reveal.validPlayers,
            funFact: reveal.funFact,
            roundIndex: room.currentRoundIndex + 1,
            isMatchFinished,
          };
        }

        return {
          accepted: false,
          reason: attemptsRemaining === 0 ? 'attempts_exhausted' : 'invalid_answer',
          attempt: rawAnswer,
          attemptsUsed: nextAttempts,
          attemptsRemaining,
        };
      }

      return {
        accepted: false,
        reason: 'invalid_answer',
        attempt: rawAnswer,
      };
    }

    const winPayload = this.recordWinAndStats(
      room,
      playerId,
      rawAnswer,
      validation.player.name
    );

    return {
      accepted: true,
      ...winPayload,
    };
  }

  public expireRound(room: OnlineRoom): ExpireRoundOutcome {
    if (room.state !== 'playing') {
      return {
        expired: false,
        scores: { ...room.scores },
        stats: this.getStatsMap(room),
        validPlayers: [],
        roundIndex: room.currentRoundIndex + 1,
        isMatchFinished: false,
      };
    }

    const round = room.rounds[room.currentRoundIndex];

    // In XOX, a turn timeout passes turn unless 4 consecutive timeouts occur
    if (room.minigameType === 'xox' && room.xoxState) {
      room.xoxConsecutiveTimeouts += 1;
      if (room.xoxConsecutiveTimeouts < 4) {
        const nextPlayer = room.players.find(
          (p) => p.playerId !== room.xoxState!.currentTurnPlayerId
        );
        if (nextPlayer) {
          room.xoxState.currentTurnPlayerId = nextPlayer.playerId;
        }
        room.roundTimeRemaining = 15;
        room.xoxState.turnTimeRemaining = 15;
        return {
          expired: false,
          xoxTurnPassed: true,
          xoxState: {
            ...room.xoxState,
            board: room.xoxState.board.map((r) => [...r]),
          },
          timeRemaining: 15,
          scores: { ...room.scores },
          stats: this.getStatsMap(room),
          validPlayers: [],
          roundIndex: room.currentRoundIndex + 1,
          isMatchFinished: false,
        };
      }
    }

    room.state = 'round_ended';
    room.roundWinnerId = null;
    for (const p of room.players) {
      p.stats.currentStreak = 0;
    }

    const reveal = getRoundRevealInfo(round);
    const isMatchFinished = this.checkMatchFinished(room);

    return {
      expired: true,
      scores: { ...room.scores },
      stats: this.getStatsMap(room),
      validPlayers: reveal.validPlayers,
      funFact: reveal.funFact,
      roundIndex: room.currentRoundIndex + 1,
      isMatchFinished,
    };
  }

  public requestRematch(
    room: OnlineRoom,
    playerId: string
  ): { started: boolean; readyCount: number } {
    if (room.players.length < 2) {
      return { started: false, readyCount: 0 };
    }

    room.rematchReadyIds.add(playerId);
    const allReady = room.players.every((p) => room.rematchReadyIds.has(p.playerId));

    if (!allReady) {
      return { started: false, readyCount: room.rematchReadyIds.size };
    }

    room.rematchReadyIds.clear();
    room.currentRoundIndex = 0;
    room.rounds = this.dealNonRepeatingRounds(room.minigameType, 12);
    room.roundWinnerId = null;
    room.xoxConsecutiveTimeouts = 0;
    room.silhouetteAttempts = {};
    delete room.xoxState;
    delete room.acceptedAnswer;
    delete room.acceptedPlayerName;

    for (const p of room.players) {
      room.scores[p.playerId] = 0;
      p.profile.score = 0;
      p.stats = createInitialMatchStats();
    }

    return { started: true, readyCount: 2 };
  }

  public findRoomByPlayerId(playerId: string): OnlineRoom | null {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.playerId === playerId)) {
        return room;
      }
    }
    return null;
  }

  public removePlayer(room: OnlineRoom, playerId: string): { isEmpty: boolean } {
    this.cancelQuickMatch(playerId);
    room.players = room.players.filter((p) => p.playerId !== playerId);
    room.rematchReadyIds.delete(playerId);

    if (room.players.length === 0) {
      this.rooms.delete(room.code);
      return { isEmpty: true };
    }

    return { isEmpty: false };
  }
}
