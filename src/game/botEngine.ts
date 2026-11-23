import { BotDifficulty, MinigameRoundPayload, MinigameType, XoxCellMark } from './types';
import { getRoundValidPlayerIds } from './minigameEngine';

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

export const BOT_TIER_METADATA: Record<BotDifficulty, BotTierMetadata> = {
  easy: {
    id: 'easy',
    title: 'Çırak',
    emoji: '🌱',
    subtitle: '4.5-7.5 sn • %65 isabet',
    delayLabel: '4.5–7.5 sn',
    accuracyPct: 65,
  },
  medium: {
    id: 'medium',
    title: 'Şampiyon',
    emoji: '🏆',
    subtitle: '2.5-4.5 sn • %82 isabet',
    delayLabel: '2.5–4.5 sn',
    accuracyPct: 82,
  },
  hard: {
    id: 'hard',
    title: 'Efsane',
    emoji: '👑',
    subtitle: '1.5-3.0 sn • %94 isabet',
    delayLabel: '1.5–3.0 sn',
    accuracyPct: 94,
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
  if (minigameType === 'silhouette') {
    if (difficulty === 'easy') {
      return { minDelayMs: 28000, maxDelayMs: 48000, accuracy: 0.65 };
    }
    if (difficulty === 'hard') {
      return { minDelayMs: 9000, maxDelayMs: 17000, accuracy: 0.94 };
    }
    return { minDelayMs: 16000, maxDelayMs: 28000, accuracy: 0.82 };
  }

  if (difficulty === 'easy') {
    return { minDelayMs: 4500, maxDelayMs: 7500, accuracy: 0.65 };
  }
  if (difficulty === 'hard') {
    return { minDelayMs: 1500, maxDelayMs: 3000, accuracy: 0.94 };
  }
  // Şampiyon (Medium - Buffed): 2.5–4.5 sn ve %82 isabet
  return { minDelayMs: 2500, maxDelayMs: 4500, accuracy: 0.82 };
}

/**
 * Üçgensel dağılım + küçük insan mikro-varyansı (±120ms) ile doğal bot cevap gecikmesi üretir.
 */
export function computeHumanizedBotDelayMs(
  plan: BotRoundPlan,
  rng: () => number = Math.random
): number {
  const r1 = Math.max(0, Math.min(1, rng()));
  const r2 = Math.max(0, Math.min(1, rng()));
  const centeredSample = (r1 + r2) / 2;
  const jitter = (rng() - 0.5) * 240;
  const raw = plan.minDelayMs + centeredSample * (plan.maxDelayMs - plan.minDelayMs) + jitter;
  return Math.round(Math.max(plan.minDelayMs, Math.min(plan.maxDelayMs, raw)));
}

export function getBotXoxTurnConfig(difficulty: BotDifficulty): BotXoxTurnConfig {
  if (difficulty === 'easy') {
    return { delayMs: 2400, missRate: 0.25 };
  }
  if (difficulty === 'hard') {
    return { delayMs: 900, missRate: 0.03 };
  }
  return { delayMs: 1450, missRate: 0.1 };
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
