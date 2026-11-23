import { MatchPlayerStats, PlayerProfile } from './types';

export type RecentMatchResult = 'W' | 'L' | 'D';

export interface OpponentMiniSummary {
  opponentId: string;
  name: string;
  avatar: string;
  roleLabel: string;
  isBot: boolean;
  totalMatches: number;
  totalWins: number;
  winRatePct: number;
  recentForm: RecentMatchResult[];
  accuracyPct: number | null;
  fastestAnswerSec: number | null;
  maxStreak: number;
  totalCorrect: number;
  totalWrongAttempts: number;
  favoriteClubId?: string;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function detectBotProfile(opponent: PlayerProfile): {
  isBot: boolean;
  roleLabel: string;
  baseMatches: number;
  baseWinRatio: number;
} {
  const idLower = (opponent.id || '').toLowerCase();
  const nameLower = (opponent.name || '').toLowerCase();

  if (idLower.startsWith('bot') || idLower.startsWith('t_bot')) {
    if (nameLower.includes('çırak') || nameLower.includes('cirak')) {
      return {
        isBot: true,
        roleLabel: '🌱 Çırak Bot',
        baseMatches: 24,
        baseWinRatio: 0.42,
      };
    }
    if (nameLower.includes('efsane')) {
      return {
        isBot: true,
        roleLabel: '👑 Efsane Bot',
        baseMatches: 64,
        baseWinRatio: 0.81,
      };
    }
    return {
      isBot: true,
      roleLabel: '🏆 Şampiyon Bot',
      baseMatches: 42,
      baseWinRatio: 0.64,
    };
  }

  return {
    isBot: false,
    roleLabel: 'Çevrim İçi Rakip',
    baseMatches: 18,
    baseWinRatio: 0.54,
  };
}

export function buildOpponentMiniSummary(
  opponent: PlayerProfile,
  opponentMatchStats: MatchPlayerStats,
  scores: { opponentScore: number; userScore: number }
): OpponentMiniSummary {
  const botInfo = detectBotProfile(opponent);
  const seed = hashSeed(`${opponent.id}:${opponent.name}`);

  const latestResult: RecentMatchResult =
    scores.opponentScore > scores.userScore
      ? 'W'
      : scores.opponentScore < scores.userScore
      ? 'L'
      : 'D';

  let totalMatches: number;
  let totalWins: number;

  if (opponent.accountStats && opponent.accountStats.totalMatches > 0) {
    totalMatches = Math.max(1, Math.round(opponent.accountStats.totalMatches));
    totalWins = Math.max(
      0,
      Math.min(totalMatches, Math.round(opponent.accountStats.totalWins))
    );
  } else {
    const jitterMatches = seed % 17;
    const baseTotal = botInfo.baseMatches + jitterMatches;
    const ratioOffset = ((seed >>> 4) % 11) / 100 - 0.05; // -5% to +5%
    const targetRatio = Math.max(0.25, Math.min(0.88, botInfo.baseWinRatio + ratioOffset));
    const priorWins = Math.round(baseTotal * targetRatio);

    totalMatches = baseTotal + 1;
    totalWins = priorWins + (latestResult === 'W' ? 1 : 0);
  }

  const winRatePct = Math.round((totalWins / Math.max(1, totalMatches)) * 100);

  // Build deterministic 5-match recent form ending with the just-played match
  const priorForm: RecentMatchResult[] = [];
  for (let i = 0; i < 4; i += 1) {
    const roll = ((seed >>> (i * 5 + 3)) % 100) / 100;
    priorForm.push(roll < winRatePct / 100 ? 'W' : 'L');
  }
  const recentForm: RecentMatchResult[] = [...priorForm, latestResult];

  const totalAttempts =
    opponentMatchStats.totalCorrect + opponentMatchStats.totalWrongAttempts;
  const accuracyPct =
    totalAttempts > 0
      ? Math.round((opponentMatchStats.totalCorrect / totalAttempts) * 100)
      : null;

  return {
    opponentId: opponent.id,
    name: opponent.name,
    avatar: opponent.avatar,
    roleLabel: botInfo.roleLabel,
    isBot: botInfo.isBot,
    totalMatches,
    totalWins,
    winRatePct,
    recentForm,
    accuracyPct,
    fastestAnswerSec: opponentMatchStats.fastestAnswerSec,
    maxStreak: opponentMatchStats.maxStreak,
    totalCorrect: opponentMatchStats.totalCorrect,
    totalWrongAttempts: opponentMatchStats.totalWrongAttempts,
    favoriteClubId: opponent.favoriteClubId,
  };
}
