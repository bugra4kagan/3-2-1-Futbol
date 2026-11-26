import { BotDifficulty, MinigameRoundPayload, MinigameType, Player, XoxCellMark } from './types';
import { getRoundValidPlayerIds } from './minigameEngine';
import { QuestionDifficulty } from './questionDifficulty';
import { PLAYERS_LIST } from './database';

export interface BotRoundPlan {
  minDelayMs: number;
  maxDelayMs: number;
  accuracy: number;
  passRate: number;
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
  passRate: number;
  subtitle: string;
  delayLabel: string;
  xoxMinDelayMs: number;
  xoxMaxDelayMs: number;
  xoxMissRate: number;
  xoxPassRate: number;
}

export const BOT_CONFIG: Record<BotDifficulty, CentralizedBotConfig> = {
  easy: {
    id: 'easy',
    title: 'Çırak',
    emoji: '🌱',
    minDelayMs: 8000,
    maxDelayMs: 14000,
    accuracy: 0.35,
    accuracyPct: 35,
    passRate: 0.30,
    subtitle: '8–14 sn • %35 isabet',
    delayLabel: '8–14 sn',
    xoxMinDelayMs: 8000,
    xoxMaxDelayMs: 14000,
    xoxMissRate: 0.65,
    xoxPassRate: 0.30,
  },
  medium: {
    id: 'medium',
    title: 'Şampiyon',
    emoji: '🏆',
    minDelayMs: 5000,
    maxDelayMs: 10000,
    accuracy: 0.60,
    accuracyPct: 60,
    passRate: 0.14,
    subtitle: '5–10 sn • %60 isabet',
    delayLabel: '5–10 sn',
    xoxMinDelayMs: 5000,
    xoxMaxDelayMs: 10000,
    xoxMissRate: 0.40,
    xoxPassRate: 0.14,
  },
  hard: {
    id: 'hard',
    title: 'Efsane',
    emoji: '👑',
    minDelayMs: 3000,
    maxDelayMs: 7000,
    accuracy: 0.85,
    accuracyPct: 85,
    passRate: 0.05,
    subtitle: '3–7 sn • %85 isabet',
    delayLabel: '3–7 sn',
    xoxMinDelayMs: 3000,
    xoxMaxDelayMs: 7000,
    xoxMissRate: 0.15,
    xoxPassRate: 0.05,
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
  passRate: number;
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

/**
 * Soru zorluğuna (geçerli futbolcu havuzu daraldıkça biraz daha uzun düşünme payı) doğal çarpan döndürür.
 */
export function computeQuestionDifficultyDelayFactor(
  validCandidateCount?: number,
  questionDifficulty?: QuestionDifficulty
): number {
  let factor = 1;
  if (typeof validCandidateCount === 'number' && Number.isFinite(validCandidateCount)) {
    if (validCandidateCount <= 1) factor = 1.14;
    else if (validCandidateCount <= 3) factor = 1.07;
    else if (validCandidateCount >= 12) factor = 0.95;
  }
  if (questionDifficulty === 'hard') factor *= 1.08;
  else if (questionDifficulty === 'easy') factor *= 0.96;
  return Number(factor.toFixed(3));
}

export function getBotRoundPlan(
  difficulty: BotDifficulty,
  minigameType: MinigameType,
  validCandidateCount?: number,
  questionDifficulty?: QuestionDifficulty
): BotRoundPlan {
  const cfg = BOT_CONFIG[difficulty];
  const hasModifiers =
    typeof validCandidateCount === 'number' || questionDifficulty !== undefined;
  const factor = hasModifiers
    ? computeQuestionDifficultyDelayFactor(validCandidateCount, questionDifficulty)
    : 1;

  if (minigameType === 'silhouette') {
    const baseMin = difficulty === 'easy' ? 8500 : difficulty === 'hard' ? 3500 : 5500;
    const baseMax = difficulty === 'easy' ? 14500 : difficulty === 'hard' ? 7500 : 10500;
    return {
      minDelayMs: Math.round(baseMin * factor),
      maxDelayMs: Math.round(baseMax * factor),
      accuracy: cfg.accuracy,
      passRate: cfg.passRate,
    };
  }

  // Keep each tier strictly inside its promised response window while nudging slightly by question complexity
  const scaledMin = Math.round(cfg.minDelayMs * factor);
  const scaledMax = Math.round(cfg.maxDelayMs * factor);
  const clampedMin = Math.max(cfg.minDelayMs, Math.min(cfg.maxDelayMs - 500, scaledMin));
  const clampedMax = Math.max(clampedMin + 500, Math.min(Math.min(14400, cfg.maxDelayMs), scaledMax));

  return {
    minDelayMs: clampedMin,
    maxDelayMs: clampedMax,
    accuracy: cfg.accuracy,
    passRate: cfg.passRate,
  };
}

export type BotRoundOutcome = 'correct' | 'wrong' | 'pass';

/**
 * Doğal ve tahmin edilemez bot davranışı:
 * - İlgili doğruluk oranında (`accuracy`) doğru futbolcu söyler
 * - Kalan turlarda gerçekçi biçimde ya yanlış tahmin yapar ya da cevap bulamayıp pas geçer (timeout)
 * - Kullanıcının cevabına göre hile veya önceden belirlenmiş senaryo uygulanmaz.
 */
export function decideBotRoundAction(
  plan: BotRoundPlan,
  rng: () => number = Math.random
): BotRoundOutcome {
  const roll = Math.max(0, Math.min(0.999999, rng()));
  if (roll < plan.accuracy) return 'correct';
  const remainingRoll = roll - plan.accuracy;
  if (remainingRoll < plan.passRate) return 'pass';
  return 'wrong';
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
  rng: () => number = Math.random,
  maxAllowedMs?: number
): BotXoxTurnConfig {
  const cfg = BOT_CONFIG[difficulty];
  const r1 = Math.max(0, Math.min(1, rng()));
  const r2 = Math.max(0, Math.min(1, rng()));
  const centered = (r1 + r2) / 2;
  let delayMs = Math.round(cfg.xoxMinDelayMs + centered * (cfg.xoxMaxDelayMs - cfg.xoxMinDelayMs));
  if (typeof maxAllowedMs === 'number' && Number.isFinite(maxAllowedMs) && maxAllowedMs > 500) {
    delayMs = Math.min(delayMs, Math.max(500, Math.floor(maxAllowedMs - 350)));
  }
  return { delayMs, missRate: cfg.xoxMissRate, passRate: cfg.xoxPassRate };
}

export function decideBotXoxAction(
  config: Pick<BotXoxTurnConfig, 'missRate' | 'passRate'>,
  rng: () => number = Math.random
): BotRoundOutcome {
  const accuracy = Math.max(0, Math.min(1, 1 - config.missRate));
  const roll = Math.max(0, Math.min(0.999999, rng()));
  if (roll < accuracy) return 'correct';
  if (roll - accuracy < config.passRate) return 'pass';
  return 'wrong';
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
