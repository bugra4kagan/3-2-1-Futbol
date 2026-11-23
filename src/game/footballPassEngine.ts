import { UserProgression } from './types';

export interface PassTrackReward {
  kind: 'coins' | 'extra_time_card' | 'league_shield' | 'legend_badge';
  amount: number;
  label: string;
  badgeId?: string;
}

export interface FootballPassTier {
  tier: number;
  requiredXp: number;
  freeReward: PassTrackReward;
  vipReward: PassTrackReward;
}

export interface FootballPassState {
  seasonId: string;
  seasonTitle: string;
  xp: number;
  claimedFreeTiers: number[];
  claimedVipTiers: number[];
  unlockedLegendBadges: string[];
}

export const FOOTBALL_PASS_STORAGE_KEY = '321_football_pass_v1';
export const PASS_XP_PER_TIER = 100;
export const PASS_MAX_TIER = 15;
export const PASS_XP_MATCH_WIN = 50;
export const PASS_XP_DAILY_QUEST = 100;
export const PASS_XP_DAILY_CHALLENGE = 150;

export const FOOTBALL_PASS_TIERS: FootballPassTier[] = [
  {
    tier: 1,
    requiredXp: 100,
    freeReward: { kind: 'coins', amount: 100, label: '100 Coin' },
    vipReward: { kind: 'coins', amount: 500, label: '500 Coin' },
  },
  {
    tier: 2,
    requiredXp: 200,
    freeReward: { kind: 'extra_time_card', amount: 1, label: '+10 Saniye Kartı x1' },
    vipReward: { kind: 'extra_time_card', amount: 2, label: '+10 Saniye Kartı x2' },
  },
  {
    tier: 3,
    requiredXp: 300,
    freeReward: { kind: 'coins', amount: 150, label: '150 Coin' },
    vipReward: { kind: 'coins', amount: 750, label: '750 Coin' },
  },
  {
    tier: 4,
    requiredXp: 400,
    freeReward: { kind: 'league_shield', amount: 1, label: 'Lig Kalkanı x1' },
    vipReward: { kind: 'legend_badge', amount: 1, badgeId: 'badge_pass_golden_boot', label: 'Altın Krampon Rozeti' },
  },
  {
    tier: 5,
    requiredXp: 500,
    freeReward: { kind: 'coins', amount: 200, label: '200 Coin' },
    vipReward: { kind: 'coins', amount: 1000, label: '1.000 Coin' },
  },
  {
    tier: 6,
    requiredXp: 600,
    freeReward: { kind: 'extra_time_card', amount: 1, label: '+10 Saniye Kartı x1' },
    vipReward: { kind: 'league_shield', amount: 2, label: 'Lig Kalkanı x2' },
  },
  {
    tier: 7,
    requiredXp: 700,
    freeReward: { kind: 'coins', amount: 250, label: '250 Coin' },
    vipReward: { kind: 'coins', amount: 1200, label: '1.200 Coin' },
  },
  {
    tier: 8,
    requiredXp: 800,
    freeReward: { kind: 'league_shield', amount: 1, label: 'Lig Kalkanı x1' },
    vipReward: { kind: 'legend_badge', amount: 1, badgeId: 'badge_pass_captain_armband', label: 'Altın Kaptanlık Rozeti' },
  },
  {
    tier: 9,
    requiredXp: 900,
    freeReward: { kind: 'coins', amount: 300, label: '300 Coin' },
    vipReward: { kind: 'coins', amount: 1500, label: '1.500 Coin' },
  },
  {
    tier: 10,
    requiredXp: 1000,
    freeReward: { kind: 'extra_time_card', amount: 2, label: '+10 Saniye Kartı x2' },
    vipReward: { kind: 'extra_time_card', amount: 3, label: '+10 Saniye Kartı x3' },
  },
  {
    tier: 11,
    requiredXp: 1100,
    freeReward: { kind: 'coins', amount: 350, label: '350 Coin' },
    vipReward: { kind: 'coins', amount: 1800, label: '1.800 Coin' },
  },
  {
    tier: 12,
    requiredXp: 1200,
    freeReward: { kind: 'league_shield', amount: 1, label: 'Lig Kalkanı x1' },
    vipReward: { kind: 'league_shield', amount: 2, label: 'Lig Kalkanı x2' },
  },
  {
    tier: 13,
    requiredXp: 1300,
    freeReward: { kind: 'coins', amount: 400, label: '400 Coin' },
    vipReward: { kind: 'coins', amount: 2000, label: '2.000 Coin' },
  },
  {
    tier: 14,
    requiredXp: 1400,
    freeReward: { kind: 'extra_time_card', amount: 1, label: '+10 Saniye Kartı x1' },
    vipReward: { kind: 'legend_badge', amount: 1, badgeId: 'badge_pass_stadium_crown', label: 'Altın Efsane Tacı Rozeti' },
  },
  {
    tier: 15,
    requiredXp: 1500,
    freeReward: { kind: 'coins', amount: 500, label: '500 Coin' },
    vipReward: { kind: 'coins', amount: 2500, label: '2.500 Coin Büyük Ödül' },
  },
];

export function createInitialFootballPassState(): FootballPassState {
  return {
    seasonId: 'season_v3_01',
    seasonTitle: 'Sezon 1: Efsaneler Yolu',
    xp: 0,
    claimedFreeTiers: [],
    claimedVipTiers: [],
    unlockedLegendBadges: [],
  };
}

export function loadFootballPassState(): FootballPassState {
  const fallback = createInitialFootballPassState();
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(FOOTBALL_PASS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<FootballPassState>;
    return {
      ...fallback,
      ...parsed,
      xp: Math.max(0, Math.round(parsed.xp ?? 0)),
      claimedFreeTiers: Array.isArray(parsed.claimedFreeTiers) ? parsed.claimedFreeTiers : [],
      claimedVipTiers: Array.isArray(parsed.claimedVipTiers) ? parsed.claimedVipTiers : [],
      unlockedLegendBadges: Array.isArray(parsed.unlockedLegendBadges) ? parsed.unlockedLegendBadges : [],
    };
  } catch {
    return fallback;
  }
}

export function saveFootballPassState(state: FootballPassState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(FOOTBALL_PASS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function getPassCurrentTier(xp: number): number {
  return Math.min(PASS_MAX_TIER, Math.max(0, Math.floor(xp / PASS_XP_PER_TIER)));
}

export function getPassTierProgressPct(xp: number): number {
  const currentTier = getPassCurrentTier(xp);
  if (currentTier >= PASS_MAX_TIER) return 100;
  return Math.min(100, Math.round(((xp % PASS_XP_PER_TIER) / PASS_XP_PER_TIER) * 100));
}

export function awardFootballPassXp(
  amount: number,
  currentState: FootballPassState = loadFootballPassState()
): { state: FootballPassState; previousTier: number; newTier: number } {
  const safeAmount = Math.max(0, Math.round(amount));
  const previousTier = getPassCurrentTier(currentState.xp);
  const nextXp = currentState.xp + safeAmount;
  const newTier = getPassCurrentTier(nextXp);
  const nextState: FootballPassState = {
    ...currentState,
    xp: nextXp,
  };
  saveFootballPassState(nextState);
  return { state: nextState, previousTier, newTier };
}

export function getClaimablePassRewardsCount(
  state: FootballPassState,
  isVipUnlocked: boolean
): number {
  const reachedTier = getPassCurrentTier(state.xp);
  let count = 0;
  for (const tierDef of FOOTBALL_PASS_TIERS) {
    if (tierDef.tier > reachedTier) break;
    if (!state.claimedFreeTiers.includes(tierDef.tier)) count += 1;
    if (isVipUnlocked && !state.claimedVipTiers.includes(tierDef.tier)) count += 1;
  }
  return count;
}

export function claimFootballPassTierReward(
  tierNumber: number,
  track: 'free' | 'vip',
  isVipUnlocked: boolean,
  progression: UserProgression,
  currentState: FootballPassState = loadFootballPassState()
): {
  ok: boolean;
  reason?: string;
  reward?: PassTrackReward;
  passState: FootballPassState;
  progression: UserProgression;
} {
  const tierDef = FOOTBALL_PASS_TIERS.find((t) => t.tier === tierNumber);
  if (!tierDef) {
    return { ok: false, reason: 'Geçersiz kademe.', passState: currentState, progression };
  }
  if (getPassCurrentTier(currentState.xp) < tierNumber) {
    return { ok: false, reason: 'Bu kademe henüz açılmadı.', passState: currentState, progression };
  }
  if (track === 'vip' && !isVipUnlocked) {
    return { ok: false, reason: 'VIP Hat için VIP paketi gerekir.', passState: currentState, progression };
  }

  const claimedList = track === 'free' ? currentState.claimedFreeTiers : currentState.claimedVipTiers;
  if (claimedList.includes(tierNumber)) {
    return { ok: false, reason: 'Bu ödül zaten alındı.', passState: currentState, progression };
  }

  const reward = track === 'free' ? tierDef.freeReward : tierDef.vipReward;
  let nextProgression = { ...progression };
  let nextBadges = [...currentState.unlockedLegendBadges];

  if (reward.kind === 'coins') {
    nextProgression = {
      ...nextProgression,
      coins: nextProgression.coins + reward.amount,
    };
  } else if (reward.kind === 'extra_time_card') {
    nextProgression = {
      ...nextProgression,
      extraTimeCards: (nextProgression.extraTimeCards ?? 0) + reward.amount,
    };
  } else if (reward.kind === 'league_shield') {
    nextProgression = {
      ...nextProgression,
      leagueShields: (nextProgression.leagueShields ?? 0) + reward.amount,
    };
  } else if (reward.kind === 'legend_badge' && reward.badgeId) {
    if (!nextBadges.includes(reward.badgeId)) {
      nextBadges.push(reward.badgeId);
    }
    if (!nextProgression.unlockedGiftIds.includes(reward.badgeId)) {
      nextProgression = {
        ...nextProgression,
        unlockedGiftIds: [...nextProgression.unlockedGiftIds, reward.badgeId],
      };
    }
  }

  const nextPassState: FootballPassState = {
    ...currentState,
    claimedFreeTiers:
      track === 'free'
        ? [...currentState.claimedFreeTiers, tierNumber]
        : currentState.claimedFreeTiers,
    claimedVipTiers:
      track === 'vip'
        ? [...currentState.claimedVipTiers, tierNumber]
        : currentState.claimedVipTiers,
    unlockedLegendBadges: nextBadges,
  };

  saveFootballPassState(nextPassState);
  return {
    ok: true,
    reward,
    passState: nextPassState,
    progression: nextProgression,
  };
}
