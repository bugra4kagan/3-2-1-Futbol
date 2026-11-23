import { UserProgression } from './types';

export interface CareerRankTier {
  id: string;
  title: string;
  icon: string;
  minWins: number;
  badgeColorClass: string;
}

export const CAREER_RANK_TIERS: CareerRankTier[] = [
  {
    id: 'amateur',
    title: 'Amatör',
    icon: '🥉',
    minWins: 0,
    badgeColorClass: 'bg-slate-800 border-slate-600 text-slate-200',
  },
  {
    id: 'academy_star',
    title: 'Altyapı Yıldızı',
    icon: '🌱',
    minWins: 5,
    badgeColorClass: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300',
  },
  {
    id: 'super_lig_pro',
    title: 'Süper Lig Profesyoneli',
    icon: '⚽',
    minWins: 15,
    badgeColorClass: 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300',
  },
  {
    id: 'ucl_master',
    title: 'Şampiyonlar Ligi Ustası',
    icon: '🏆',
    minWins: 35,
    badgeColorClass: 'bg-purple-500/20 border-purple-400/50 text-purple-200',
  },
  {
    id: 'ballon_dor_legend',
    title: "Ballon d'Or Efsanesi",
    icon: '👑',
    minWins: 75,
    badgeColorClass: 'bg-amber-400/25 border-amber-300/75 text-amber-200',
  },
];

export interface CareerStatsData {
  totalMatches: number;
  totalWins: number;
  bestMatchTimeSec: number | null;
  longestWinStreak: number;
}

export const CAREER_STATS_STORAGE_KEY = '321_career_stats_v1';
export const FAST_COMBO_THRESHOLD_SEC = 3.5;
export const SPEED_COMBO_COIN_PER_LEVEL = 15;

export function createInitialCareerStats(): CareerStatsData {
  return {
    totalMatches: 0,
    totalWins: 0,
    bestMatchTimeSec: null,
    longestWinStreak: 0,
  };
}

export function loadCareerStats(): CareerStatsData {
  const base = createInitialCareerStats();
  if (typeof window === 'undefined' || !window.localStorage) return base;
  try {
    const raw = window.localStorage.getItem(CAREER_STATS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<CareerStatsData>;
    return {
      totalMatches: Math.max(0, Math.round(parsed.totalMatches ?? 0)),
      totalWins: Math.max(0, Math.round(parsed.totalWins ?? 0)),
      bestMatchTimeSec:
        typeof parsed.bestMatchTimeSec === 'number' && parsed.bestMatchTimeSec > 0
          ? Number(parsed.bestMatchTimeSec.toFixed(1))
          : null,
      longestWinStreak: Math.max(0, Math.round(parsed.longestWinStreak ?? 0)),
    };
  } catch {
    return base;
  }
}

export function saveCareerStats(stats: CareerStatsData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CAREER_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore storage quota issues
  }
}

export function mergeCareerStatsWithProgression(
  progression: UserProgression,
  stored: CareerStatsData = loadCareerStats()
): CareerStatsData {
  return {
    totalMatches: Math.max(stored.totalMatches, progression.matchesPlayed),
    totalWins: Math.max(stored.totalWins, progression.wins),
    bestMatchTimeSec: stored.bestMatchTimeSec,
    longestWinStreak: Math.max(stored.longestWinStreak, progression.bestWinStreak),
  };
}

export function recordCareerMatchStats(
  params: {
    won: boolean;
    matchDurationSec?: number | null;
    progression: UserProgression;
  },
  current: CareerStatsData = loadCareerStats()
): CareerStatsData {
  const { won, matchDurationSec, progression } = params;
  const candidateBest =
    won && typeof matchDurationSec === 'number' && matchDurationSec > 0
      ? Number(matchDurationSec.toFixed(1))
      : null;

  const nextBest =
    candidateBest === null
      ? current.bestMatchTimeSec
      : current.bestMatchTimeSec === null
      ? candidateBest
      : Math.min(current.bestMatchTimeSec, candidateBest);

  const next: CareerStatsData = {
    totalMatches: Math.max(current.totalMatches + 1, progression.matchesPlayed),
    totalWins: Math.max(current.totalWins + (won ? 1 : 0), progression.wins),
    bestMatchTimeSec: nextBest,
    longestWinStreak: Math.max(current.longestWinStreak, progression.bestWinStreak),
  };

  saveCareerStats(next);
  return next;
}

export function getWinRatePct(stats: CareerStatsData): number {
  if (stats.totalMatches <= 0) return 0;
  return Math.min(100, Math.round((stats.totalWins / stats.totalMatches) * 100));
}

export interface CareerRankProgressInfo {
  currentRank: CareerRankTier;
  nextRank: CareerRankTier | null;
  progressPct: number;
  winsToNext: number;
}

export function getCareerRankProgress(totalWins: number): CareerRankProgressInfo {
  const safeWins = Math.max(0, Math.floor(totalWins));
  let currentIdx = 0;
  for (let i = 0; i < CAREER_RANK_TIERS.length; i++) {
    if (safeWins >= CAREER_RANK_TIERS[i].minWins) {
      currentIdx = i;
    }
  }
  const currentRank = CAREER_RANK_TIERS[currentIdx];
  const nextRank =
    currentIdx + 1 < CAREER_RANK_TIERS.length ? CAREER_RANK_TIERS[currentIdx + 1] : null;

  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      progressPct: 100,
      winsToNext: 0,
    };
  }

  const span = nextRank.minWins - currentRank.minWins;
  const gained = safeWins - currentRank.minWins;
  return {
    currentRank,
    nextRank,
    progressPct: Math.min(100, Math.max(0, Math.round((gained / span) * 100))),
    winsToNext: Math.max(0, nextRank.minWins - safeWins),
  };
}

export function computeSpeedComboBonusCoins(maxComboStreak: number): number {
  if (maxComboStreak < 2) return 0;
  return Math.round(maxComboStreak) * SPEED_COMBO_COIN_PER_LEVEL;
}

export function getSpeedComboLabel(comboStreak: number): string | null {
  if (comboStreak < 2) return null;
  if (comboStreak === 2) return '🔥 2x HIZ KOMBOSU!';
  if (comboStreak === 3) return '⚡ 3x ŞİMŞEK HIZI!';
  return `🚀 ${comboStreak}x SÜPER HIZ KOMBOSU!`;
}
