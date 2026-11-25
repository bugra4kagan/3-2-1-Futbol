import { BotDifficulty, MinigameRoundPayload, MinigameType, Player, XoxCellMark } from './types';
import { getRoundValidPlayerIds } from './minigameEngine';
import { PLAYERS_LIST } from './database';

export interface BotRoundPlan {
  minDelayMs: number;
  maxDelayMs: number;
  accuracy: number;
}

export interface BotTierMetadata {
  id: BotDifficulty;
  title: string;
  emoji: string;
  subtitle: string;
  delayLabel: string;
  accuracyPct: number;
}

export interface CentralizedBotConfig {
  id: BotDifficulty;
  title: string;
  emoji: string;
  minDelayMs: number;
  maxDelayMs: number;
  accuracy: number;
  accuracyPct: number;
  subtitle: string;
  delayLabel: string;
  xoxMinDelayMs: number;
  xoxMaxDelayMs: number;
  xoxMissRate: number;
}

export const BOT_CONFIG: Record<BotDifficulty, CentralizedBotConfig> = {
  easy: {
    id: 'easy',
    title: 'Çırak',
    emoji: '🌱',
    minDelayMs: 3000,
    maxDelayMs: 5000,
    accuracy: 0.70,
    accuracyPct: 70,
    subtitle: '3–5 sn • %70 isabet',
    delayLabel: '3–5 sn',
    xoxMinDelayMs: 2600,
    xoxMaxDelayMs: 4200,
    xoxMissRate: 0.30,
  },
  medium: {
    id: 'medium',
    title: 'Şampiyon',
    emoji: '🏆',
    minDelayMs: 2500,
    maxDelayMs: 4000,
    accuracy: 0.85,
    accuracyPct: 85,
    subtitle: '2,5–4 sn • %85 isabet',
    delayLabel: '2,5–4 sn',
    xoxMinDelayMs: 2000,
    xoxMaxDelayMs: 3400,
    xoxMissRate: 0.15,
  },
  hard: {
    id: 'hard',
    title: 'Efsane',
    emoji: '👑',
    minDelayMs: 2000,
    maxDelayMs: 3000,
    accuracy: 0.95,
    accuracyPct: 95,
    subtitle: '2–3 sn • %95 isabet',
    delayLabel: '2–3 sn',
    xoxMinDelayMs: 1400,
    xoxMaxDelayMs: 2400,
    xoxMissRate: 0.05,
  },
};

export const BOT_TIER_METADATA: Record<BotDifficulty, BotTierMetadata> = {
  easy: {
    id: 'easy',
    title: BOT_CONFIG.easy.title,
    emoji: BOT_CONFIG.easy.emoji,
    subtitle: BOT_CONFIG.easy.subtitle,
    delayLabel: BOT_CONFIG.easy.delayLabel,
    accuracyPct: BOT_CONFIG.easy.accuracyPct,
  },
  medium: {
    id: 'medium',
    title: BOT_CONFIG.medium.title,
    emoji: BOT_CONFIG.medium.emoji,
    subtitle: BOT_CONFIG.medium.subtitle,
    delayLabel: BOT_CONFIG.medium.delayLabel,
    accuracyPct: BOT_CONFIG.medium.accuracyPct,
  },
  hard: {
    id: 'hard',
    title: BOT_CONFIG.hard.title,
    emoji: BOT_CONFIG.hard.emoji,
    subtitle: BOT_CONFIG.hard.subtitle,
    delayLabel: BOT_CONFIG.hard.delayLabel,
    accuracyPct: BOT_CONFIG.hard.accuracyPct,
  },
};

export interface BotXoxTurnConfig {
  delayMs: number;
  missRate: number;
}

const XOX_LINES: [number, number][][] = [
  // Rows
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  // Cols
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  // Diagonals
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
];

export function getBotRoundPlan(
  difficulty: BotDifficulty,
  minigameType: MinigameType
): BotRoundPlan {
  const cfg = BOT_CONFIG[difficulty];
  if (minigameType === 'silhouette') {
    if (difficulty === 'easy') {
      return { minDelayMs: 4200, maxDelayMs: 6500, accuracy: cfg.accuracy };
    }
    if (difficulty === 'hard') {
      return { minDelayMs: 2000, maxDelayMs: 3200, accuracy: cfg.accuracy };
    }
    return { minDelayMs: 2800, maxDelayMs: 4600, accuracy: cfg.accuracy };
  }

  return {
    minDelayMs: cfg.minDelayMs,
    maxDelayMs: cfg.maxDelayMs,
    accuracy: cfg.accuracy,
  };
}

/**
 * Doğal ve tahmin edilemez bot cevap gecikmesi üretir; kalan süre verilirse süreyi aşmaz.
 */
export function computeHumanizedBotDelayMs(
  plan: BotRoundPlan,
  rng: () => number = Math.random,
  maxAllowedMs?: number
): number {
  const r1 = Math.max(0, Math.min(1, rng()));
  const r2 = Math.max(0, Math.min(1, rng()));
  const centeredSample = (r1 + r2) / 2;
  const jitter = (rng() - 0.5) * 200;
  const raw = plan.minDelayMs + centeredSample * (plan.maxDelayMs - plan.minDelayMs) + jitter;
  let bounded = Math.round(Math.max(plan.minDelayMs, Math.min(plan.maxDelayMs, raw)));
  if (typeof maxAllowedMs === 'number' && Number.isFinite(maxAllowedMs) && maxAllowedMs > 400) {
    bounded = Math.min(bounded, Math.max(400, Math.floor(maxAllowedMs - 350)));
  }
  return bounded;
}

export function getBotXoxTurnConfig(
  difficulty: BotDifficulty,
  rng: () => number = Math.random
): BotXoxTurnConfig {
  const cfg = BOT_CONFIG[difficulty];
  const delayMs = Math.round(
    cfg.xoxMinDelayMs + rng() * (cfg.xoxMaxDelayMs - cfg.xoxMinDelayMs)
  );
  return { delayMs, missRate: cfg.xoxMissRate };
}

/**
 * Geçerli havuzdan rastgele bir doğru futbolcu seçer (çoklu doğru cevapları tamamen destekler).
 */
export function pickBotValidPlayer(
  validPlayers: Player[],
  rng: () => number = Math.random
): Player | null {
  if (!validPlayers || validPlayers.length === 0) return null;
  const idx = Math.floor(Math.max(0, Math.min(0.999999, rng())) * validPlayers.length);
  return validPlayers[idx] ?? validPlayers[0];
}

/**
 * Bot yanlış tahmin yapacağında gerçek ancak bu soru için geçersiz bir futbolcu ismi seçer.
 */
export function pickBotWrongPlayer(
  validPlayerIds: ReadonlySet<string> | readonly string[],
  allPlayers: readonly Player[] = PLAYERS_LIST,
  rng: () => number = Math.random
): Player | null {
  if (!allPlayers || allPlayers.length === 0) return null;
  const invalidSet =
    validPlayerIds instanceof Set ? validPlayerIds : new Set<string>(validPlayerIds);

  // Fast random probing up to 24 tries to avoid filtering 3000+ players every miss
  for (let i = 0; i < 24; i += 1) {
    const idx = Math.floor(Math.max(0, Math.min(0.999999, rng())) * allPlayers.length);
    const candidate = allPlayers[idx];
    if (candidate && !invalidSet.has(candidate.id)) {
      return candidate;
    }
  }

  for (const candidate of allPlayers) {
    if (!invalidSet.has(candidate.id)) return candidate;
  }
  return null;
}

export function findImmediateWinningXoxCell(
  board: (XoxCellMark | null)[][],
  targetPlayerId: string,
  candidates: { row: number; col: number }[]
): { row: number; col: number } | null {
  const candidateSet = new Set(candidates.map((c) => `${c.row}_${c.col}`));

  for (const line of XOX_LINES) {
    let ownedCount = 0;
    let emptyCell: { row: number; col: number } | null = null;
    let blocked = false;

    for (const [r, c] of line) {
      const claim = board[r]?.[c] ?? null;
      if (claim === null) {
        if (emptyCell === null) {
          emptyCell = { row: r, col: c };
        } else {
          // Two empty cells on this line -> cannot complete immediately
          blocked = true;
        }
      } else if (claim.ownerId === targetPlayerId) {
        ownedCount += 1;
      } else {
        blocked = true;
      }
    }

    if (
      !blocked &&
      ownedCount === 2 &&
      emptyCell &&
      candidateSet.has(`${emptyCell.row}_${emptyCell.col}`)
    ) {
      return emptyCell;
    }
  }

  return null;
}

export function chooseBotXoxCell(
  board: (XoxCellMark | null)[][],
  botPlayerId: string,
  humanPlayerId: string,
  round: MinigameRoundPayload,
  difficulty: BotDifficulty,
  rng: () => number = Math.random
): { row: number; col: number } | null {
  const allEmpty: { row: number; col: number }[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[r]?.[c] === null) {
        allEmpty.push({ row: r, col: c });
      }
    }
  }
  if (allEmpty.length === 0) return null;

  const validEmpty = allEmpty.filter(
    (cell) => getRoundValidPlayerIds(round, cell).length > 0
  );
  const candidates = validEmpty.length > 0 ? validEmpty : allEmpty;

  // 1. Immediate winning move for bot
  if (difficulty !== 'easy' || rng() < 0.45) {
    const winMove = findImmediateWinningXoxCell(board, botPlayerId, candidates);
    if (winMove) return winMove;
  }

  // 2. Block human's immediate winning threat
  if (difficulty === 'hard' || difficulty === 'medium') {
    const blockMove = findImmediateWinningXoxCell(board, humanPlayerId, candidates);
    if (blockMove) return blockMove;
  }

  // 3. Tactical board control: center -> best corner -> best remaining cell
  if (difficulty === 'hard' || difficulty === 'medium') {
    const center = candidates.find((c) => c.row === 1 && c.col === 1);
    if (center) return center;

    const corners = candidates.filter(
      (c) => (c.row === 0 || c.row === 2) && (c.col === 0 || c.col === 2)
    );
    if (corners.length > 0) {
      if (difficulty === 'hard') {
        // Score corners by how many unblocked lines already hold bot marks
        let bestCorner = corners[0];
        let bestScore = -1;
        for (const corner of corners) {
          let score = 0;
          for (const line of XOX_LINES) {
            if (!line.some(([r, c]) => r === corner.row && c === corner.col)) continue;
            const claims = line.map(([r, c]) => board[r]?.[c] ?? null);
            if (claims.some((cl) => cl && cl.ownerId === humanPlayerId)) continue;
            score += 1 + claims.filter((cl) => cl && cl.ownerId === botPlayerId).length * 2;
          }
          if (score > bestScore) {
            bestScore = score;
            bestCorner = corner;
          }
        }
        return bestCorner;
      }
      return corners[Math.floor(rng() * corners.length)];
    }
  }

  return candidates[Math.floor(rng() * candidates.length)];
}
