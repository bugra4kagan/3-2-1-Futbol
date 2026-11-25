import {
  DAILY_CHALLENGE_COOLDOWN_MS,
  writeDailyChallengeCooldownEndMs,
} from './dailyChallengeEngine';
import { getAuthoritativeServerDate } from './serverTime';
import {
  DailyChallengeRecord,
  DailyQuest,
  FriendEntry,
  FriendRequestEntry,
  LeaguePlayerEntry,
  LeagueSeasonResetNotice,
  MatchPlayerStats,
  MinigameType,
  PlayerProfile,
  ShopGiftItem,
  SocialProvider,
  UserProgression,
  WeeklyLeagueTierId,
  WeeklyLeagueTierInfo,
} from './types';
import { STORE_ITEMS } from './storeCatalog';
import { sanitizePublicDisplayName } from './usernameFilter';

export interface DailyRewardTier {
  day: number;
  coins: number;
  points: number;
  bonusLabel?: string;
  rewardItemType?: 'extra_time_card' | 'league_shield' | 'trophy_badge';
  rewardItemQty?: number;
  rewardLabel?: string;
}

export const DAILY_REWARD_SCHEDULE: DailyRewardTier[] = [
  { day: 1, coins: 100, points: 60, rewardLabel: '100 Coin' },
  { day: 2, coins: 200, points: 90, rewardLabel: '200 Coin' },
  {
    day: 3,
    coins: 0,
    points: 140,
    rewardItemType: 'extra_time_card',
    rewardItemQty: 1,
    rewardLabel: '+10 Saniye Kartı x1',
  },
  { day: 4, coins: 350, points: 200, rewardLabel: '350 Coin' },
  {
    day: 5,
    coins: 0,
    points: 280,
    rewardItemType: 'league_shield',
    rewardItemQty: 1,
    rewardLabel: 'Lig Kalkanı x1',
  },
  { day: 6, coins: 600, points: 400, rewardLabel: '600 Coin' },
  {
    day: 7,
    coins: 1500,
    points: 750,
    rewardItemType: 'trophy_badge',
    rewardItemQty: 1,
    bonusLabel: '🏆 Özel Kupa Rozeti',
    rewardLabel: '1.500 Coin + Özel Kupa Rozeti',
  },
];

export const SHOP_GIFTS: ShopGiftItem[] = STORE_ITEMS;

export const SUGGESTED_COMMUNITY_PLAYERS: FriendEntry[] = [];

const DAILY_QUEST_TEMPLATES: Omit<DailyQuest, 'progress' | 'claimed'>[] = [
  {
    id: 'q_play_1',
    title: 'Sahaya Çık',
    description: 'Bugün 1 maç oyna',
    metric: 'matches_played',
    target: 1,
    rewardCoins: 180,
    rewardPoints: 100,
    icon: '⚽',
  },
  {
    id: 'q_win_1',
    title: 'Zafer Tadı',
    description: 'Bugün 1 galibiyet al',
    metric: 'matches_won',
    target: 1,
    rewardCoins: 350,
    rewardPoints: 200,
    icon: '🏆',
  },
  {
    id: 'q_answers_5',
    title: 'Keskin Nişancı',
    description: 'Toplam 5 doğru futbolcu bil',
    metric: 'correct_answers',
    target: 5,
    rewardCoins: 450,
    rewardPoints: 240,
    icon: '🎯',
  },
  {
    id: 'q_minigame_1',
    title: 'Çok Yönlü Yıldız',
    description: 'Futbolcuyu Tahmin Et, XOX, Kariyer veya Ülke+Kulüp oyna',
    metric: 'minigame_played',
    target: 1,
    rewardCoins: 320,
    rewardPoints: 180,
    icon: '🎮',
  },
  {
    id: 'q_win_3',
    title: 'Hat-Trick Şampiyonu',
    description: 'Bugün 3 maç kazan',
    metric: 'matches_won',
    target: 3,
    rewardCoins: 850,
    rewardPoints: 450,
    icon: '🔥',
  },
];

export function getLocalDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getPreviousDateKey(now: Date = new Date()): string {
  const prev = new Date(now);
  prev.setDate(prev.getDate() - 1);
  return getLocalDateKey(prev);
}

export function getMondayWeekKey(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return getLocalDateKey(d);
}

export const WEEKLY_LEAGUE_TIERS: WeeklyLeagueTierInfo[] = [
  {
    id: 'amateur',
    name: 'Amatör Lig',
    shortName: 'Amatör',
    icon: '🥉',
    order: 0,
    promotionRewardCoins: 300,
    stayRewardCoins: 0,
    accentClass: 'text-amber-300',
    badgeBgClass: 'bg-amber-950/70 border-amber-500/45 text-amber-200',
    minBotWeeklyPoints: 60,
    maxBotWeeklyPoints: 480,
  },
  {
    id: 'league_2',
    name: '2. Lig',
    shortName: '2. Lig',
    icon: '🥈',
    order: 1,
    promotionRewardCoins: 500,
    stayRewardCoins: 0,
    accentClass: 'text-slate-200',
    badgeBgClass: 'bg-slate-800/90 border-slate-400/55 text-slate-100',
    minBotWeeklyPoints: 220,
    maxBotWeeklyPoints: 860,
  },
  {
    id: 'league_1',
    name: '1. Lig',
    shortName: '1. Lig',
    icon: '🥇',
    order: 2,
    promotionRewardCoins: 750,
    stayRewardCoins: 0,
    accentClass: 'text-emerald-300',
    badgeBgClass: 'bg-emerald-950/70 border-emerald-400/55 text-emerald-200',
    minBotWeeklyPoints: 480,
    maxBotWeeklyPoints: 1380,
  },
  {
    id: 'super_lig',
    name: 'Süper Lig',
    shortName: 'Süper Lig',
    icon: '🏆',
    order: 3,
    promotionRewardCoins: 1200,
    stayRewardCoins: 0,
    accentClass: 'text-yellow-300',
    badgeBgClass: 'bg-yellow-950/60 border-yellow-400/60 text-yellow-200',
    minBotWeeklyPoints: 880,
    maxBotWeeklyPoints: 2100,
  },
  {
    id: 'champions_league',
    name: 'Şampiyonlar Ligi',
    shortName: 'Şamp. Ligi',
    icon: '👑',
    order: 4,
    promotionRewardCoins: 2000,
    stayRewardCoins: 0,
    accentClass: 'text-cyan-300',
    badgeBgClass: 'bg-indigo-950/80 border-cyan-400/65 text-cyan-200',
    minBotWeeklyPoints: 1450,
    maxBotWeeklyPoints: 3200,
  },
];

export const WEEKLY_LEAGUE_PROMOTION_CUTOFF = 3;
export const WEEKLY_LEAGUE_RELEGATION_COUNT = 3;
export const WEEKLY_LEAGUE_GROUP_SIZE = 10;

export function getLeagueTierInfo(tierId?: WeeklyLeagueTierId): WeeklyLeagueTierInfo {
  return (
    WEEKLY_LEAGUE_TIERS.find((t) => t.id === tierId) ?? WEEKLY_LEAGUE_TIERS[0]
  );
}

export function getNextLeagueTier(
  tierId?: WeeklyLeagueTierId
): WeeklyLeagueTierInfo | null {
  const current = getLeagueTierInfo(tierId);
  return WEEKLY_LEAGUE_TIERS[current.order + 1] ?? null;
}

export function getPreviousLeagueTier(
  tierId?: WeeklyLeagueTierId
): WeeklyLeagueTierInfo | null {
  const current = getLeagueTierInfo(tierId);
  return current.order > 0 ? WEEKLY_LEAGUE_TIERS[current.order - 1] : null;
}

export function getTimeUntilSundaySeasonEnd(now: Date = new Date()): {
  days: number;
  hours: number;
  minutes: number;
  label: string;
} {
  const target = new Date(now);
  const day = target.getDay(); // 0=Pazar, 1=Pzt ... 6=Cmt
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  target.setDate(target.getDate() + daysUntilSunday);
  target.setHours(23, 59, 59, 999);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }

  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return {
    days,
    hours,
    minutes,
    label: `Sezon Bitimine: ${days} Gün ${hours} Saat`,
  };
}

const TURKISH_LEAGUE_BOT_PROFILES: {
  id: string;
  friendCode: string;
  name: string;
  avatar: string;
  favoriteClubId: string;
  subtitle: string;
  factor: number; // 0.0 -> 1.0 arası güç çarpanı
  winRate: number;
}[] = [
  {
    id: 'bot_tr_1',
    friendCode: 'FC1905',
    name: 'KeremGS_1905',
    avatar: '🦁',
    favoriteClubId: 'galatasaray',
    subtitle: 'Süper Lig Gurmesi',
    factor: 0.96,
    winRate: 0.74,
  },
  {
    id: 'bot_tr_2',
    friendCode: 'FC1907',
    name: 'KadikoyBoga',
    avatar: '⚡',
    favoriteClubId: 'fenerbahce',
    subtitle: 'Orta Saha Maestrosu',
    factor: 0.87,
    winRate: 0.69,
  },
  {
    id: 'bot_tr_3',
    friendCode: 'FC1903',
    name: 'KartalYusuf',
    avatar: '🦅',
    favoriteClubId: 'besiktas',
    subtitle: '3-2-1 Efsanesi',
    factor: 0.76,
    winRate: 0.65,
  },
  {
    id: 'bot_tr_4',
    friendCode: 'FC6161',
    name: 'FirtinaEmre61',
    avatar: '🌪️',
    favoriteClubId: 'trabzonspor',
    subtitle: 'Karadeniz Fırtınası',
    factor: 0.64,
    winRate: 0.61,
  },
  {
    id: 'bot_tr_5',
    friendCode: 'FC3535',
    name: 'IzmirEge35',
    avatar: '🔥',
    favoriteClubId: 'goztepe',
    subtitle: 'Hızlı Tahminci',
    factor: 0.52,
    winRate: 0.56,
  },
  {
    id: 'bot_tr_6',
    friendCode: 'FC0606',
    name: 'AnkaraKaan',
    avatar: '🎯',
    favoriteClubId: 'genclerbirligi',
    subtitle: 'Futbol Ansiklopedisi',
    factor: 0.41,
    winRate: 0.52,
  },
  {
    id: 'bot_tr_7',
    friendCode: 'FC5555',
    name: 'SamsunMert55',
    avatar: '⚽',
    favoriteClubId: 'samsunspor',
    subtitle: 'Kariyer Avcısı',
    factor: 0.31,
    winRate: 0.48,
  },
  {
    id: 'bot_tr_8',
    friendCode: 'FC0707',
    name: 'AkdenizArda',
    avatar: '🚀',
    favoriteClubId: 'antalyaspor',
    subtitle: 'Lig Mücadeleci',
    factor: 0.21,
    winRate: 0.44,
  },
  {
    id: 'bot_tr_9',
    friendCode: 'FC0101',
    name: 'AdanaDemir_01',
    avatar: '🧤',
    favoriteClubId: 'adana_demirspor',
    subtitle: 'Genç Yetenek',
    factor: 0.11,
    winRate: 0.4,
  },
];

function hashLeagueSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Yerel modda rekabetçi hissi vermek için oyuncunun puanına ve haftalık kademeye göre
 * dinamik hareket eden gerçekçi Türk futbolsever bot rakipler üretir.
 */
export function generateWeeklyLeagueBotRivals(
  tierId: WeeklyLeagueTierId,
  userWeeklyPoints: number,
  weekKey: string,
  count: number = WEEKLY_LEAGUE_GROUP_SIZE - 1
): LeaguePlayerEntry[] {
  const tier = getLeagueTierInfo(tierId);
  const baseMin = tier.minBotWeeklyPoints;
  const baseMax = tier.maxBotWeeklyPoints;
  // Oyuncu puanı arttıkça üst rakipler de dinamik olarak rekabeti canlı tutar,
  // ama oyuncunun iyi performansla 1. sıraya çıkabilmesine her zaman izin verir.
  const dynamicCenter = Math.max(
    baseMin + (baseMax - baseMin) * 0.48,
    Math.min(baseMax * 1.15, userWeeklyPoints * 0.92 + 120)
  );
  const spread = Math.max(240, (baseMax - baseMin) * 0.55);

  return TURKISH_LEAGUE_BOT_PROFILES.slice(0, count).map((bot, idx) => {
    const seed = hashLeagueSeed(`${weekKey}:${tierId}:${bot.id}`);
    const jitter = ((seed % 71) - 35); // -35 .. +35 arası deterministik sapma
    const rawWeekly = Math.round(
      dynamicCenter + (bot.factor - 0.5) * 2 * spread + jitter
    );
    const weeklyPoints = Math.max(40, rawWeekly);
    const totalPoints =
      weeklyPoints + (tier.order + 1) * 900 + (seed % 1400) + idx * 110;
    const matchesPlayed = 8 + (seed % 18) + tier.order * 4;
    const wins = Math.max(2, Math.round(matchesPlayed * bot.winRate));

    return {
      id: `${bot.id}_${tierId}`,
      friendCode: bot.friendCode,
      name: bot.name,
      avatar: bot.avatar,
      weeklyPoints,
      totalPoints,
      subtitle: `${tier.name} • ${bot.subtitle}`,
      hasCrown: idx === 0 && tier.order >= 3,
      isBot: true,
      favoriteClubId: bot.favoriteClubId,
      matchesPlayed,
      wins,
      losses: Math.max(0, matchesPlayed - wins),
      winStreak: idx < 3 ? 2 + (seed % 4) : seed % 2,
      bestWinStreak: 4 + (seed % 6),
      totalCorrectAnswers: wins * 6 + (seed % 12),
      totalWrongAttempts: Math.max(3, matchesPlayed * 2 - wins),
      fastestAnswerSec: Number((1.9 + (seed % 26) / 10).toFixed(1)),
      clutchAnswers: 1 + (seed % 5),
      dailyStreakDays: 2 + (seed % 7),
      tournamentWins: idx === 0 && tier.order >= 2 ? 1 : 0,
      tournamentsPlayed: 1 + (seed % 4),
    };
  });
}

export function getTimeUntilNextMondayReset(now: Date = new Date()): {
  days: number;
  hours: number;
  minutes: number;
} {
  const nextMonday = new Date(now);
  const day = nextMonday.getDay();
  const daysUntil = day === 0 ? 1 : 8 - day;
  nextMonday.setDate(nextMonday.getDate() + daysUntil);
  nextMonday.setHours(0, 0, 0, 0);

  const diffMs = Math.max(0, nextMonday.getTime() - now.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

export function formatPoints(points: number): string {
  return Math.max(0, Math.round(points)).toLocaleString('tr-TR');
}

export function buildFreshDailyQuests(): DailyQuest[] {
  return DAILY_QUEST_TEMPLATES.map((tpl) => ({
    ...tpl,
    progress: 0,
    claimed: false,
  }));
}

export function generateFriendCode(seed?: string): string {
  if (seed && seed.length >= 4) {
    const clean = seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `FC${clean.slice(-4).padStart(4, '7')}`;
  }
  const num = Math.floor(1000 + Math.random() * 9000);
  return `FC${num}`;
}

export function createInitialProgression(
  playerId?: string,
  now: Date = new Date()
): UserProgression {
  const today = getLocalDateKey(now);
  return {
    friendCode: generateFriendCode(playerId),
    coins: 200,
    weeklyPoints: 180,
    totalPoints: 180,
    weekKey: getMondayWeekKey(now),
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    winStreak: 0,
    bestWinStreak: 0,
    totalCorrectAnswers: 0,
    totalWrongAttempts: 0,
    fastestAnswerSec: null,
    clutchAnswers: 0,
    minigameMatchCounts: {
      two_clubs: 0,
      silhouette: 0,
      xox: 0,
      career: 0,
      country_club: 0,
    },
    modeWinCounts: {
      two_clubs: 0,
      xox: 0,
      career: 0,
      country_club: 0,
    },
    unlockedAchievements: [],
    claimedAchievements: [],
    dailyLogin: {
      streakDays: 0,
      lastClaimDate: null,
    },
    questsDate: today,
    dailyQuests: buildFreshDailyQuests(),
    unlockedGiftIds: [],
    adFree: false,
    energyDrinks: 0,
    multiplier2xMatches: 0,
    permanentMultiplier2x: false,
    linkedAccounts: [],
    socialBonusClaimed: false,
    tournamentWins: 0,
    tournamentsPlayed: 0,
    friends: [],
    outgoingFriendRequests: [],
    incomingFriendRequests: [],
    dailyChallengeHistory: {},
    dailyEnergy: 5,
    energyLastResetDate: today,
    wheelAdSpinsDate: today,
    wheelAdSpinsUsed: 0,
    freeJokerTickets: 0,
    leagueShields: 0,
    extraTimeCards: 0,
    leagueTierId: 'amateur',
    lastSeasonResetNotice: null,
  };
}

export const MAX_DAILY_ENERGY = 5;
export const ENERGY_AD_REWARD_AMOUNT = 2;
export const ENERGY_DRINK_REFILL_AMOUNT = 2;

export function hasUnlimitedEnergy(prog: UserProgression): boolean {
  return Boolean(
    prog.adFree || prog.unlockedGiftIds?.includes('bundle_vip_adfree_frame')
  );
}

export function getEffectiveDailyEnergy(
  prog: UserProgression,
  now: Date = new Date()
): number {
  const today = getLocalDateKey(now);
  if (prog.energyLastResetDate !== today || typeof prog.dailyEnergy !== 'number') {
    return MAX_DAILY_ENERGY;
  }
  return Math.max(0, Math.min(MAX_DAILY_ENERGY, Math.round(prog.dailyEnergy)));
}

export function syncProgressionForToday(
  prog: UserProgression,
  now: Date = new Date()
): UserProgression {
  const today = getLocalDateKey(now);
  const yesterday = getPreviousDateKey(now);
  const currentWeek = getMondayWeekKey(now);

  let updated = { ...prog };

  if (updated.weekKey !== currentWeek) {
    const prevTierId: WeeklyLeagueTierId = updated.leagueTierId ?? 'amateur';
    const prevTier = getLeagueTierInfo(prevTierId);
    const prevWeeklyPoints = Math.max(0, Math.round(updated.weeklyPoints ?? 0));
    const prevRivals = generateWeeklyLeagueBotRivals(
      prevTierId,
      prevWeeklyPoints,
      updated.weekKey || currentWeek
    );
    const simulatedRank =
      prevRivals.filter((r) => r.weeklyPoints > prevWeeklyPoints).length + 1;
    const totalGroupSize = prevRivals.length + 1;
    const nextTier = getNextLeagueTier(prevTierId);
    const prevLowerTier = getPreviousLeagueTier(prevTierId);

    let newTierId: WeeklyLeagueTierId = prevTierId;
    let outcome: LeagueSeasonResetNotice['outcome'] = 'stayed';
    let rewardCoins = 0;

    if (simulatedRank <= WEEKLY_LEAGUE_PROMOTION_CUTOFF && prevWeeklyPoints > 0) {
      outcome = 'promoted';
      newTierId = nextTier ? nextTier.id : prevTierId;
      rewardCoins = prevTier.promotionRewardCoins;
    } else if (
      prevLowerTier &&
      simulatedRank > totalGroupSize - WEEKLY_LEAGUE_RELEGATION_COUNT
    ) {
      outcome = 'relegated';
      newTierId = prevLowerTier.id;
      rewardCoins = 0;
    }

    const notice: LeagueSeasonResetNotice = {
      weekKey: currentWeek,
      previousTierId: prevTierId,
      newTierId,
      outcome,
      finalRank: simulatedRank,
      rewardCoins,
      previousWeeklyPoints: prevWeeklyPoints,
    };

    updated = {
      ...updated,
      weekKey: currentWeek,
      weeklyPoints: 0,
      coins: updated.coins + rewardCoins,
      leagueTierId: newTierId,
      lastSeasonResetNotice: notice,
    };
  }

  if (updated.questsDate !== today) {
    updated = {
      ...updated,
      questsDate: today,
      dailyQuests: buildFreshDailyQuests(),
    };
  } else if (Array.isArray(updated.dailyQuests)) {
    let questsChanged = false;
    const syncedQuests = updated.dailyQuests.map((q) => {
      const tpl = DAILY_QUEST_TEMPLATES.find((t) => t.id === q.id);
      if (tpl && !q.claimed && q.rewardCoins < tpl.rewardCoins) {
        questsChanged = true;
        return { ...q, rewardCoins: tpl.rewardCoins };
      }
      return q;
    });
    if (questsChanged) {
      updated = { ...updated, dailyQuests: syncedQuests };
    }
  }

  if (updated.energyLastResetDate !== today || typeof updated.dailyEnergy !== 'number') {
    updated = {
      ...updated,
      dailyEnergy: MAX_DAILY_ENERGY,
      energyLastResetDate: today,
    };
  }

  if (updated.wheelAdSpinsDate !== today) {
    updated = {
      ...updated,
      wheelAdSpinsDate: today,
      wheelAdSpinsUsed: 0,
    };
  }

  // If user missed yesterday AND didn't claim today, visual active streak resets to 0
  if (
    updated.dailyLogin.lastClaimDate &&
    updated.dailyLogin.lastClaimDate !== today &&
    updated.dailyLogin.lastClaimDate !== yesterday
  ) {
    updated = {
      ...updated,
      dailyLogin: {
        ...updated.dailyLogin,
        streakDays: 0,
      },
    };
  }

  return updated;
}

export function canClaimDailyReward(
  prog: UserProgression,
  now: Date = new Date()
): boolean {
  const today = getLocalDateKey(now);
  return prog.dailyLogin.lastClaimDate !== today;
}

export function getActiveDailyRewardTier(
  prog: UserProgression,
  now: Date = new Date()
): DailyRewardTier {
  const today = getLocalDateKey(now);
  const yesterday = getPreviousDateKey(now);
  const last = prog.dailyLogin.lastClaimDate;

  let effectiveDayIndex: number;
  if (last === today) {
    effectiveDayIndex = Math.max(0, (prog.dailyLogin.streakDays - 1) % 7);
  } else if (last === yesterday) {
    effectiveDayIndex = prog.dailyLogin.streakDays % 7;
  } else {
    effectiveDayIndex = 0;
  }

  return DAILY_REWARD_SCHEDULE[effectiveDayIndex];
}

export function claimDailyReward(
  prog: UserProgression,
  now: Date = new Date()
): { progression: UserProgression; claimed: boolean; reward: DailyRewardTier } {
  const synced = syncProgressionForToday(prog, now);
  const today = getLocalDateKey(now);
  const yesterday = getPreviousDateKey(now);

  if (synced.dailyLogin.lastClaimDate === today) {
    return {
      progression: synced,
      claimed: false,
      reward: getActiveDailyRewardTier(synced, now),
    };
  }

  const nextStreak =
    synced.dailyLogin.lastClaimDate === yesterday
      ? synced.dailyLogin.streakDays + 1
      : 1;
  const reward = DAILY_REWARD_SCHEDULE[(nextStreak - 1) % 7];
  const extraTimeDelta = reward.rewardItemType === 'extra_time_card' ? (reward.rewardItemQty ?? 1) : 0;
  const shieldDelta = reward.rewardItemType === 'league_shield' ? (reward.rewardItemQty ?? 1) : 0;
  const nextGifts =
    reward.rewardItemType === 'trophy_badge' &&
    !synced.unlockedGiftIds.includes('badge_daily_7day_trophy')
      ? [...synced.unlockedGiftIds, 'badge_daily_7day_trophy']
      : synced.unlockedGiftIds;

  return {
    claimed: true,
    reward,
    progression: {
      ...synced,
      coins: synced.coins + reward.coins,
      weeklyPoints: synced.weeklyPoints + reward.points,
      totalPoints: synced.totalPoints + reward.points,
      extraTimeCards: (synced.extraTimeCards ?? 0) + extraTimeDelta,
      leagueShields: (synced.leagueShields ?? 0) + shieldDelta,
      unlockedGiftIds: nextGifts,
      dailyLogin: {
        streakDays: nextStreak,
        lastClaimDate: today,
      },
    },
  };
}

export interface MatchOutcomeInput {
  won: boolean;
  isDraw?: boolean;
  minigameType: MinigameType;
  stats: MatchPlayerStats;
  now?: Date;
}

export interface MatchOutcomeInput {
  won: boolean;
  isDraw?: boolean;
  isBotMatch?: boolean;
  minigameType: MinigameType;
  stats: MatchPlayerStats;
  now?: Date;
}

export const MATCH_LOSS_LP_PENALTY = 30;

export function recordMatchOutcome(
  prog: UserProgression,
  input: MatchOutcomeInput
): {
  progression: UserProgression;
  earnedPoints: number;
  earnedCoins: number;
  multiplierApplied: boolean;
  shieldProtected: boolean;
} {
  const synced = syncProgressionForToday(prog, input.now);
  const isWin = input.won && !input.isDraw;
  const isLoss = !input.won && !input.isDraw;
  const isBotMatch = Boolean(input.isBotMatch);

  const newWinStreak = isWin ? synced.winStreak + 1 : isLoss ? 0 : synced.winStreak;
  const bestWinStreak = Math.max(synced.bestWinStreak, newWinStreak);

  // Bot matches award Coins & match practice without unfairly inflating PvP League rankings
  const streakBonusPts = isWin && newWinStreak >= 2 ? Math.min(80, newWinStreak * 20) : 0;
  const currentShields = Math.max(0, Math.round(synced.leagueShields ?? 0));
  const shieldProtected = !isBotMatch && isLoss && currentShields > 0;
  const nextLeagueShields = shieldProtected ? currentShields - 1 : currentShields;

  const basePoints = isBotMatch
    ? 0
    : isLoss
    ? shieldProtected
      ? 0
      : -MATCH_LOSS_LP_PENALTY
    : 45 + input.stats.totalCorrect * 18 + (isWin ? 130 : 0) + streakBonusPts;

  const baseCoins = isBotMatch
    ? isWin
      ? 60
      : input.isDraw
      ? 25
      : 10
    : isWin
    ? 100
    : input.isDraw
    ? 40
    : 15;

  const hasPerm2x = Boolean(synced.permanentMultiplier2x);
  const remaining2xMatches = Math.max(0, synced.multiplier2xMatches ?? 0);
  const multiplierApplied = hasPerm2x || remaining2xMatches > 0;
  const earnedPoints = basePoints > 0 && multiplierApplied ? basePoints * 2 : basePoints;
  const earnedCoins = multiplierApplied ? baseCoins * 2 : baseCoins;
  const nextMultiplier2xMatches =
    !hasPerm2x && remaining2xMatches > 0 ? remaining2xMatches - 1 : remaining2xMatches;

  const fastest =
    input.stats.fastestAnswerSec === null
      ? synced.fastestAnswerSec
      : synced.fastestAnswerSec === null
      ? input.stats.fastestAnswerSec
      : Math.min(synced.fastestAnswerSec, input.stats.fastestAnswerSec);

  const isMiniVariant = input.minigameType !== 'two_clubs';

  const updatedQuests = synced.dailyQuests.map((q) => {
    let delta = 0;
    if (q.metric === 'matches_played') delta = 1;
    else if (q.metric === 'matches_won' && isWin) delta = 1;
    else if (q.metric === 'correct_answers') delta = input.stats.totalCorrect;
    else if (q.metric === 'minigame_played' && isMiniVariant) delta = 1;

    if (delta <= 0) return q;
    return {
      ...q,
      progress: Math.min(q.target, q.progress + delta),
    };
  });

  const currentEnergy = getEffectiveDailyEnergy(synced, input.now);
  const refundedEnergy =
    hasUnlimitedEnergy(synced)
      ? currentEnergy
      : isWin || Boolean(input.isDraw)
      ? Math.min(MAX_DAILY_ENERGY, currentEnergy + 1)
      : currentEnergy;

  return {
    earnedPoints,
    earnedCoins,
    multiplierApplied,
    shieldProtected,
    progression: {
      ...synced,
      coins: synced.coins + earnedCoins,
      weeklyPoints: Math.max(0, synced.weeklyPoints + earnedPoints),
      totalPoints: Math.max(0, synced.totalPoints + earnedPoints),
      leagueShields: nextLeagueShields,
      multiplier2xMatches: nextMultiplier2xMatches,
      matchesPlayed: synced.matchesPlayed + 1,
      wins: synced.wins + (isWin ? 1 : 0),
      losses: synced.losses + (isLoss ? 1 : 0),
      winStreak: newWinStreak,
      bestWinStreak,
      totalCorrectAnswers: synced.totalCorrectAnswers + input.stats.totalCorrect,
      totalWrongAttempts: synced.totalWrongAttempts + input.stats.totalWrongAttempts,
      fastestAnswerSec: fastest,
      clutchAnswers: synced.clutchAnswers + input.stats.clutchAnswers,
      minigameMatchCounts: {
        ...synced.minigameMatchCounts,
        [input.minigameType]: (synced.minigameMatchCounts[input.minigameType] || 0) + 1,
      },
      modeWinCounts: {
        two_clubs: 0,
        xox: 0,
        career: 0,
        country_club: 0,
        ...(synced.modeWinCounts || {}),
        ...(isWin
          ? {
              [input.minigameType]:
                ((synced.modeWinCounts?.[input.minigameType] ?? 0) as number) + 1,
            }
          : {}),
      },
      dailyQuests: updatedQuests,
      dailyEnergy: refundedEnergy,
      energyLastResetDate: getLocalDateKey(input.now),
    },
  };
}

export function claimDailyQuest(
  prog: UserProgression,
  questId: string
): { progression: UserProgression; claimed: boolean; quest?: DailyQuest } {
  const target = prog.dailyQuests.find((q) => q.id === questId);
  if (!target || target.claimed || target.progress < target.target) {
    return { progression: prog, claimed: false };
  }

  return {
    claimed: true,
    quest: target,
    progression: {
      ...prog,
      coins: prog.coins + target.rewardCoins,
      weeklyPoints: prog.weeklyPoints + target.rewardPoints,
      totalPoints: prog.totalPoints + target.rewardPoints,
      dailyQuests: prog.dailyQuests.map((q) =>
        q.id === questId ? { ...q, claimed: true } : q
      ),
    },
  };
}

function applyEquipItem(prog: UserProgression, item: ShopGiftItem): UserProgression {
  switch (item.type) {
    case 'title':
      return { ...prog, equippedTitle: item.value };
    case 'crest':
      return { ...prog, equippedCrest: item.value };
    case 'frame':
      return { ...prog, equippedFrame: item.value };
    case 'vip_bundle':
      return { ...prog, adFree: true, equippedFrame: item.value || 'vip' };
    case 'pitch_theme':
      return { ...prog, equippedPitchTheme: item.value };
    case 'goal_effect':
      return { ...prog, equippedGoalEffect: item.value };
    case 'badge':
      return { ...prog, equippedBadge: item.value };
    default:
      return prog;
  }
}

export function equipStoreItem(
  prog: UserProgression,
  itemId: string
): {
  ok: boolean;
  reason?: string;
  item?: ShopGiftItem;
  progression: UserProgression;
} {
  const item = STORE_ITEMS.find((g) => g.id === itemId);
  if (!item) {
    return { ok: false, reason: 'Ürün bulunamadı.', progression: prog };
  }
  if (!prog.unlockedGiftIds.includes(itemId) && item.type !== 'avatar') {
    return { ok: false, reason: 'Önce bu ürünü açmalısın.', progression: prog };
  }
  if (!prog.unlockedGiftIds.includes(itemId)) {
    return { ok: false, reason: 'Önce bu avatarı açmalısın.', progression: prog };
  }
  return {
    ok: true,
    item,
    progression: applyEquipItem(prog, item),
  };
}

export function purchaseStoreItem(
  prog: UserProgression,
  itemId: string,
  method: 'coins' | 'money' = 'coins'
): {
  ok: boolean;
  reason?: string;
  gift?: ShopGiftItem;
  progression: UserProgression;
} {
  const item = STORE_ITEMS.find((g) => g.id === itemId);
  if (!item) {
    return { ok: false, reason: 'Ürün bulunamadı.', progression: prog };
  }

  const isConsumable =
    item.type === 'coin_pack' ||
    item.type === 'energy_pack' ||
    item.type === 'league_shield' ||
    item.type === 'extra_time_card' ||
    (item.type === 'multiplier_2x' && item.value !== 'forever');

  // Permanent/cosmetic unlockables that are already owned simply equip
  if (!isConsumable && prog.unlockedGiftIds.includes(itemId)) {
    return {
      ok: true,
      gift: item,
      progression: applyEquipItem(prog, item),
    };
  }

  if (!isConsumable && item.type === 'ad_free' && prog.adFree) {
    return { ok: true, gift: item, progression: prog };
  }

  if (method === 'coins') {
    if (item.costCoins <= 0) {
      return {
        ok: false,
        reason:
          item.type === 'ad_free'
            ? 'Reklam Engelleme (VIP) sadece gerçek para (₺) ile satın alınabilir.'
            : 'Bu paket sadece mağaza ödemesi (₺) ile alınabilir.',
        progression: prog,
      };
    }
    if (prog.coins < item.costCoins) {
      return {
        ok: false,
        reason: `Yetersiz Coin! ${formatPoints(item.costCoins - prog.coins)} Coin daha kazanmalısın.`,
        progression: prog,
      };
    }
  } else {
    if (!item.priceTry || item.priceTry <= 0) {
      return {
        ok: false,
        reason: 'Bu ürün gerçek para ile satılmıyor.',
        progression: prog,
      };
    }
  }

  let nextProg: UserProgression = {
    ...prog,
    coins: method === 'coins' ? prog.coins - item.costCoins : prog.coins,
  };

  if (item.type === 'coin_pack') {
    const addedCoins = item.quantity ?? (Number(item.value) || 0);
    nextProg = {
      ...nextProg,
      coins: nextProg.coins + addedCoins,
    };
  } else if (item.type === 'energy_pack') {
    const addedDrinks = item.quantity ?? 1;
    nextProg = {
      ...nextProg,
      energyDrinks: (nextProg.energyDrinks ?? 0) + addedDrinks,
    };
  } else if (item.type === 'league_shield') {
    const addedShields = item.quantity ?? 1;
    nextProg = {
      ...nextProg,
      leagueShields: (nextProg.leagueShields ?? 0) + addedShields,
    };
  } else if (item.type === 'extra_time_card') {
    const addedCards = item.quantity ?? 1;
    nextProg = {
      ...nextProg,
      extraTimeCards: (nextProg.extraTimeCards ?? 0) + addedCards,
    };
  } else if (item.type === 'ad_free') {
    nextProg = {
      ...nextProg,
      adFree: true,
      unlockedGiftIds: nextProg.unlockedGiftIds.includes(item.id)
        ? nextProg.unlockedGiftIds
        : [...nextProg.unlockedGiftIds, item.id],
    };
  } else if (item.type === 'vip_bundle') {
    const unlockedSet = new Set(nextProg.unlockedGiftIds);
    unlockedSet.add(item.id);
    unlockedSet.add('store_ad_free');
    nextProg = {
      ...nextProg,
      adFree: true,
      equippedFrame: item.value || 'vip',
      unlockedGiftIds: Array.from(unlockedSet),
    };
  } else if (item.type === 'multiplier_2x') {
    if (item.value === 'forever') {
      nextProg = {
        ...nextProg,
        permanentMultiplier2x: true,
        unlockedGiftIds: nextProg.unlockedGiftIds.includes(item.id)
          ? nextProg.unlockedGiftIds
          : [...nextProg.unlockedGiftIds, item.id],
      };
    } else {
      const addedMatches = item.quantity ?? 5;
      nextProg = {
        ...nextProg,
        multiplier2xMatches: (nextProg.multiplier2xMatches ?? 0) + addedMatches,
      };
    }
  } else {
    nextProg = {
      ...nextProg,
      unlockedGiftIds: nextProg.unlockedGiftIds.includes(item.id)
        ? nextProg.unlockedGiftIds
        : [...nextProg.unlockedGiftIds, item.id],
    };
    nextProg = applyEquipItem(nextProg, item);
  }

  return {
    ok: true,
    gift: item,
    progression: nextProg,
  };
}

export function purchaseGift(
  prog: UserProgression,
  giftId: string
): {
  ok: boolean;
  reason?: string;
  gift?: ShopGiftItem;
  progression: UserProgression;
} {
  return purchaseStoreItem(prog, giftId, 'coins');
}

export function consumeEnergyDrink(prog: UserProgression): {
  ok: boolean;
  progression: UserProgression;
} {
  const current = prog.energyDrinks ?? 0;
  if (current <= 0) {
    return { ok: false, progression: prog };
  }
  return {
    ok: true,
    progression: {
      ...prog,
      energyDrinks: current - 1,
    },
  };
}

export function consumeExtraTimeCard(prog: UserProgression): {
  ok: boolean;
  progression: UserProgression;
} {
  const current = prog.extraTimeCards ?? 0;
  if (current <= 0) {
    return { ok: false, progression: prog };
  }
  return {
    ok: true,
    progression: {
      ...prog,
      extraTimeCards: current - 1,
    },
  };
}

export function selectDefaultPitchTheme(prog: UserProgression): UserProgression {
  return {
    ...prog,
    equippedPitchTheme: undefined,
  };
}

export function consumeMatchEntryEnergy(
  prog: UserProgression,
  now: Date = new Date()
): { ok: boolean; reason?: string; progression: UserProgression } {
  const synced = syncProgressionForToday(prog, now);
  if (hasUnlimitedEnergy(synced)) {
    return { ok: true, progression: synced };
  }
  const current = getEffectiveDailyEnergy(synced, now);
  if (current <= 0) {
    return {
      ok: false,
      reason: 'Enerjin bitti! Reklam izleyerek veya enerji içeceği kullanarak devam et.',
      progression: {
        ...synced,
        dailyEnergy: 0,
        energyLastResetDate: getLocalDateKey(now),
      },
    };
  }
  return {
    ok: true,
    progression: {
      ...synced,
      dailyEnergy: current - 1,
      energyLastResetDate: getLocalDateKey(now),
    },
  };
}

export function refundMatchEnergy(
  prog: UserProgression,
  amount: number = 1,
  now: Date = new Date()
): UserProgression {
  const synced = syncProgressionForToday(prog, now);
  if (hasUnlimitedEnergy(synced)) return synced;
  const current = getEffectiveDailyEnergy(synced, now);
  const next = Math.min(MAX_DAILY_ENERGY, current + Math.max(0, Math.round(amount)));
  return {
    ...synced,
    dailyEnergy: next,
    energyLastResetDate: getLocalDateKey(now),
  };
}

export function useEnergyDrinkForMatchEnergy(
  prog: UserProgression,
  now: Date = new Date()
): { ok: boolean; reason?: string; progression: UserProgression } {
  const synced = syncProgressionForToday(prog, now);
  if (hasUnlimitedEnergy(synced)) {
    return { ok: false, reason: 'VIP üyelerde enerji zaten sınırsız!', progression: synced };
  }
  const currentEnergy = getEffectiveDailyEnergy(synced, now);
  if (currentEnergy >= MAX_DAILY_ENERGY) {
    return { ok: false, reason: 'Enerjin zaten tam (5/5)!', progression: synced };
  }
  const consumed = consumeEnergyDrink(synced);
  if (!consumed.ok) {
    return {
      ok: false,
      reason: 'Elinde enerji içeceği yok. Dükkandan alabilirsin!',
      progression: synced,
    };
  }
  return {
    ok: true,
    progression: refundMatchEnergy(consumed.progression, ENERGY_DRINK_REFILL_AMOUNT, now),
  };
}

export function grantExtraRewards(
  prog: UserProgression,
  bonusCoins: number,
  bonusPoints: number
): UserProgression {
  const c = Math.max(0, Math.round(bonusCoins));
  const p = Math.max(0, Math.round(bonusPoints));
  return {
    ...prog,
    coins: prog.coins + c,
    weeklyPoints: prog.weeklyPoints + p,
    totalPoints: prog.totalPoints + p,
  };
}

export function spendCoinsForJoker(
  prog: UserProgression,
  costCoins: number
): { ok: boolean; reason?: string; progression: UserProgression } {
  const cost = Math.max(0, Math.round(costCoins));
  if (prog.coins < cost) {
    return {
      ok: false,
      reason: `Yetersiz Coin! Bu joker için ${formatPoints(cost)} Coin gerekiyor (Mevcut: ${formatPoints(prog.coins)}).`,
      progression: prog,
    };
  }
  return {
    ok: true,
    progression: {
      ...prog,
      coins: prog.coins - cost,
    },
  };
}

export function consumeFreeJokerOrSpendCoins(
  prog: UserProgression,
  costCoins: number
): {
  ok: boolean;
  usedFreeJoker: boolean;
  reason?: string;
  progression: UserProgression;
} {
  const freeTickets = Math.max(0, Math.round(prog.freeJokerTickets ?? 0));
  if (freeTickets > 0) {
    return {
      ok: true,
      usedFreeJoker: true,
      progression: {
        ...prog,
        freeJokerTickets: freeTickets - 1,
      },
    };
  }
  const coinRes = spendCoinsForJoker(prog, costCoins);
  return {
    ...coinRes,
    usedFreeJoker: false,
  };
}

export function grantFreeAdCoins(
  prog: UserProgression,
  amount: number = 250
): UserProgression {
  const safeAmount = Math.max(0, Math.round(amount));
  return {
    ...prog,
    coins: prog.coins + safeAmount,
  };
}

export function recordDailyChallengeCompletion(
  prog: UserProgression,
  record: DailyChallengeRecord,
  now: Date = getAuthoritativeServerDate()
): {
  progression: UserProgression;
  firstCompletionToday: boolean;
  awardedCoins: number;
  awardedPoints: number;
} {
  const synced = syncProgressionForToday(prog, now);
  const existing = synced.dailyChallengeHistory ?? {};
  const alreadyCompleted = Boolean(existing[record.dateKey]);
  const awardedCoins = alreadyCompleted ? 0 : Math.max(0, Math.round(record.rewardCoins));
  const awardedPoints = alreadyCompleted ? 0 : Math.max(0, Math.round(record.rewardPoints));
  const completedAtMs =
    typeof record.completedAt === 'number' && Number.isFinite(record.completedAt)
      ? record.completedAt
      : now.getTime();
  if (!alreadyCompleted) {
    writeDailyChallengeCooldownEndMs(completedAtMs + DAILY_CHALLENGE_COOLDOWN_MS);
  }

  return {
    firstCompletionToday: !alreadyCompleted,
    awardedCoins,
    awardedPoints,
    progression: {
      ...synced,
      coins: synced.coins + awardedCoins,
      weeklyPoints: synced.weeklyPoints + awardedPoints,
      totalPoints: synced.totalPoints + awardedPoints,
      dailyChallengeLastPlayedAt: alreadyCompleted
        ? synced.dailyChallengeLastPlayedAt
        : Math.max(synced.dailyChallengeLastPlayedAt ?? 0, completedAtMs),
      dailyChallengeHistory: alreadyCompleted
        ? existing
        : {
            ...existing,
            [record.dateKey]: record,
          },
    },
  };
}

export function enterTournamentWithCoins(
  prog: UserProgression,
  entryFeeCoins: number
): { ok: boolean; reason?: string; progression: UserProgression } {
  const fee = Math.max(0, Math.round(entryFeeCoins));
  if (prog.coins < fee) {
    return {
      ok: false,
      reason: `Turnuvaya katılmak için ${formatPoints(fee - prog.coins)} Coin daha gerekiyor!`,
      progression: prog,
    };
  }
  return {
    ok: true,
    progression: {
      ...prog,
      coins: prog.coins - fee,
      tournamentsPlayed: (prog.tournamentsPlayed ?? 0) + 1,
    },
  };
}

export function awardTournamentChampionPrize(
  prog: UserProgression,
  prizeCoins: number,
  bonusPoints: number = 400
): UserProgression {
  return {
    ...prog,
    coins: prog.coins + Math.max(0, Math.round(prizeCoins)),
    weeklyPoints: prog.weeklyPoints + Math.max(0, Math.round(bonusPoints)),
    totalPoints: prog.totalPoints + Math.max(0, Math.round(bonusPoints)),
    tournamentWins: (prog.tournamentWins ?? 0) + 1,
  };
}

export const SOCIAL_LINK_BONUS_COINS = 250;

export function linkSocialAccount(
  prog: UserProgression,
  provider: SocialProvider,
  handle: string,
  now: Date = new Date()
): {
  ok: boolean;
  error?: string;
  bonusCoinsAwarded: number;
  progression: UserProgression;
} {
  const cleanHandle = handle.trim();
  if (cleanHandle.length < 3) {
    return {
      ok: false,
      error: 'Lütfen geçerli bir kullanıcı adı veya e-posta gir.',
      bonusCoinsAwarded: 0,
      progression: prog,
    };
  }

  const existing = prog.linkedAccounts ?? [];
  const filtered = existing.filter((acc) => acc.provider !== provider);
  const updatedAccounts = [
    ...filtered,
    {
      provider,
      handle: cleanHandle,
      linkedAt: now.toISOString(),
    },
  ];

  const awardBonus = !prog.socialBonusClaimed;
  const bonusCoinsAwarded = awardBonus ? SOCIAL_LINK_BONUS_COINS : 0;

  return {
    ok: true,
    bonusCoinsAwarded,
    progression: {
      ...prog,
      coins: prog.coins + bonusCoinsAwarded,
      linkedAccounts: updatedAccounts,
      socialBonusClaimed: true,
    },
  };
}

export function unlinkSocialAccount(
  prog: UserProgression,
  provider: SocialProvider
): UserProgression {
  return {
    ...prog,
    linkedAccounts: (prog.linkedAccounts ?? []).filter(
      (acc) => acc.provider !== provider
    ),
  };
}

export function addFriendByCodeOrEntry(
  prog: UserProgression,
  codeOrName: string,
  livePlayers: LeaguePlayerEntry[] = []
): { ok: boolean; error?: string; friend?: FriendEntry; progression: UserProgression } {
  const clean = codeOrName.trim();
  if (clean.length < 2) {
    return { ok: false, error: 'Lütfen geçerli bir arkadaş kodu veya isim gir.', progression: prog };
  }

  if (clean.toUpperCase() === prog.friendCode.toUpperCase()) {
    return { ok: false, error: 'Kendi arkadaş kodunu ekleyemezsin!', progression: prog };
  }

  const normalized = clean.toLowerCase();
  const already = prog.friends.find(
    (f) =>
      f.friendCode.toLowerCase() === normalized ||
      f.name.toLowerCase() === normalized
  );
  if (already) {
    return { ok: false, error: `${already.name} zaten arkadaş listende!`, progression: prog };
  }

  const matchedLive = livePlayers.find(
    (p) =>
      (p.friendCode && p.friendCode.toLowerCase() === normalized) ||
      p.name.toLowerCase() === normalized
  );

  const newFriend: FriendEntry = matchedLive
    ? {
        id: matchedLive.id,
        friendCode: matchedLive.friendCode || clean.toUpperCase().slice(0, 6),
        name: matchedLive.name,
        avatar: matchedLive.avatar,
        weeklyPoints: matchedLive.weeklyPoints,
        totalPoints: matchedLive.totalPoints,
        statusText: matchedLive.subtitle || 'Çevrim içi oyuncu',
        isOnline: true,
      }
    : {
        id: `friend_${Date.now()}`,
        friendCode: clean.toUpperCase().slice(0, 6),
        name: clean.slice(0, 18),
        avatar: '⚽',
        weeklyPoints: 0,
        totalPoints: 0,
        statusText: 'Arkadaş Kodu ile Eklendi',
        isOnline: false,
      };

  return {
    ok: true,
    friend: newFriend,
    progression: {
      ...prog,
      friends: [newFriend, ...prog.friends],
    },
  };
}

export function removeFriend(prog: UserProgression, friendId: string): UserProgression {
  return {
    ...prog,
    friends: prog.friends.filter((f) => f.id !== friendId),
  };
}

export interface FriendTargetCandidate {
  id: string;
  friendCode: string;
  name: string;
  avatar: string;
  weeklyPoints: number;
  totalPoints: number;
  subtitle: string;
  isOnline: boolean;
  isBot?: boolean;
}

function normalizeFriendToken(raw?: string): string {
  return String(raw || '').trim().toLowerCase();
}

export function isAlreadyFriend(
  prog: UserProgression,
  target: { id?: string; friendCode?: string; name?: string }
): boolean {
  const tid = normalizeFriendToken(target.id);
  const tcode = normalizeFriendToken(target.friendCode);
  const tname = normalizeFriendToken(target.name);
  return prog.friends.some((f) => {
    if (tid && normalizeFriendToken(f.id) === tid) return true;
    if (tcode && normalizeFriendToken(f.friendCode) === tcode) return true;
    if (tname && normalizeFriendToken(f.name) === tname) return true;
    return false;
  });
}

export function hasPendingOutgoingRequest(
  prog: UserProgression,
  target: { id?: string; friendCode?: string; name?: string } | string
): boolean {
  const reqs = (prog.outgoingFriendRequests ?? []).filter((r) => r.status === 'pending');
  if (reqs.length === 0) return false;
  const obj = typeof target === 'string' ? { id: target, friendCode: target, name: target } : target;
  const tid = normalizeFriendToken(obj.id);
  const tcode = normalizeFriendToken(obj.friendCode);
  const tname = normalizeFriendToken(obj.name);
  return reqs.some((r) => {
    if (tid && (normalizeFriendToken(r.toPlayerId) === tid || normalizeFriendToken(r.id) === tid)) return true;
    if (tcode && normalizeFriendToken(r.toFriendCode) === tcode) return true;
    if (tname && normalizeFriendToken(r.toName) === tname) return true;
    return false;
  });
}

export function getPendingIncomingRequestCount(prog: UserProgression): number {
  return (prog.incomingFriendRequests ?? []).filter((r) => r.status === 'pending').length;
}

export function resolveFriendTargetCandidate(
  prog: UserProgression,
  codeOrTarget:
    | string
    | {
        id?: string;
        friendCode?: string;
        name?: string;
        avatar?: string;
        weeklyPoints?: number;
        totalPoints?: number;
        subtitle?: string;
        isOnline?: boolean;
        isBot?: boolean;
      },
  livePlayers: LeaguePlayerEntry[] = [],
  selfPlayerId?: string
): { ok: boolean; error?: string; target?: FriendTargetCandidate } {
  const rawInput =
    typeof codeOrTarget === 'string'
      ? codeOrTarget.trim()
      : String(codeOrTarget.friendCode || codeOrTarget.name || codeOrTarget.id || '').trim();

  const targetNameRaw =
    typeof codeOrTarget === 'string'
      ? rawInput
      : String(codeOrTarget.name || codeOrTarget.friendCode || codeOrTarget.id || '').trim();

  if (rawInput.length < 2 && targetNameRaw.length < 2) {
    return { ok: false, error: 'Lütfen geçerli bir arkadaş kodu veya isim gir.' };
  }

  const objInput = typeof codeOrTarget === 'string' ? null : codeOrTarget;
  const normRaw = normalizeFriendToken(rawInput);
  const normId = normalizeFriendToken(objInput?.id);
  const normCode = normalizeFriendToken(objInput?.friendCode);
  const normName = normalizeFriendToken(objInput?.name);

  if (
    (normId && selfPlayerId && normId === normalizeFriendToken(selfPlayerId)) ||
    (normRaw && prog.friendCode && normRaw === normalizeFriendToken(prog.friendCode)) ||
    (normCode && prog.friendCode && normCode === normalizeFriendToken(prog.friendCode))
  ) {
    return { ok: false, error: 'Kendi arkadaş kodunu ekleyemezsin!' };
  }

  const matchedLive = livePlayers.find((p) => {
    const pid = normalizeFriendToken(p.id);
    const pcode = normalizeFriendToken(p.friendCode);
    const pname = normalizeFriendToken(p.name);
    return (
      (normId && pid === normId) ||
      (normCode && pcode === normCode) ||
      (normName && pname === normName) ||
      (normRaw && (pid === normRaw || pcode === normRaw || pname === normRaw))
    );
  });

  if (matchedLive && selfPlayerId && matchedLive.id === selfPlayerId) {
    return { ok: false, error: 'Kendi hesabına arkadaşlık isteği gönderemezsin!' };
  }

  const resolvedId = String(matchedLive?.id || objInput?.id || `target_${normRaw.replace(/[^a-z0-9_]/g, '') || Date.now()}`);
  const resolvedCode = String(
    matchedLive?.friendCode ||
      objInput?.friendCode ||
      (rawInput.toUpperCase().startsWith('FC') ? rawInput.toUpperCase().slice(0, 10) : rawInput.toUpperCase().slice(0, 6))
  );
  const resolvedName = String(matchedLive?.name || objInput?.name || targetNameRaw.slice(0, 20));
  const resolvedAvatar = String(matchedLive?.avatar || objInput?.avatar || '⚽');

  if (
    isAlreadyFriend(prog, { id: resolvedId, friendCode: resolvedCode, name: resolvedName })
  ) {
    return { ok: false, error: `${resolvedName} zaten arkadaş listende!` };
  }

  if (
    hasPendingOutgoingRequest(prog, { id: resolvedId, friendCode: resolvedCode, name: resolvedName })
  ) {
    return { ok: false, error: `${resolvedName} adlı oyuncuya zaten istek gönderildi!` };
  }

  return {
    ok: true,
    target: {
      id: resolvedId,
      friendCode: resolvedCode,
      name: resolvedName,
      avatar: resolvedAvatar,
      weeklyPoints: Number(matchedLive?.weeklyPoints ?? objInput?.weeklyPoints ?? 0),
      totalPoints: Number(matchedLive?.totalPoints ?? objInput?.totalPoints ?? 0),
      subtitle: String(
        matchedLive?.subtitle || objInput?.subtitle || (objInput?.isBot ? 'Bot Rakip' : 'Çevrim içi oyuncu')
      ),
      isOnline: Boolean(matchedLive || objInput?.isOnline),
      isBot: Boolean(objInput?.isBot || resolvedId.startsWith('bot_')),
    },
  };
}

export function sendFriendRequest(
  prog: UserProgression,
  sender: { id: string; name: string; avatar: string },
  target: FriendTargetCandidate,
  now: number = Date.now()
): {
  ok: boolean;
  error?: string;
  request?: FriendRequestEntry;
  progression: UserProgression;
} {
  if (target.id === sender.id || (target.friendCode && target.friendCode.toUpperCase() === prog.friendCode.toUpperCase())) {
    return { ok: false, error: 'Kendine arkadaşlık isteği gönderemezsin!', progression: prog };
  }

  if (isAlreadyFriend(prog, target)) {
    return { ok: false, error: `${target.name} zaten arkadaş listende!`, progression: prog };
  }

  if (hasPendingOutgoingRequest(prog, target)) {
    return { ok: false, error: `${target.name} adlı oyuncuya zaten istek gönderildi!`, progression: prog };
  }

  const reqEntry: FriendRequestEntry = {
    id: `fr_${now}_${Math.random().toString(36).slice(2, 7)}`,
    fromPlayerId: sender.id,
    fromFriendCode: prog.friendCode,
    fromName: sender.name,
    fromAvatar: sender.avatar,
    toPlayerId: target.id,
    toFriendCode: target.friendCode,
    toName: target.name,
    toAvatar: target.avatar,
    weeklyPoints: target.weeklyPoints,
    totalPoints: target.totalPoints,
    subtitle: target.subtitle,
    status: 'pending',
    isBot: target.isBot,
    createdAt: now,
  };

  return {
    ok: true,
    request: reqEntry,
    progression: {
      ...prog,
      outgoingFriendRequests: [reqEntry, ...(prog.outgoingFriendRequests ?? [])].slice(0, 50),
    },
  };
}

export function cancelOutgoingFriendRequest(
  prog: UserProgression,
  requestIdOrTargetId: string
): UserProgression {
  const key = normalizeFriendToken(requestIdOrTargetId);
  return {
    ...prog,
    outgoingFriendRequests: (prog.outgoingFriendRequests ?? []).filter(
      (r) =>
        normalizeFriendToken(r.id) !== key &&
        normalizeFriendToken(r.toPlayerId) !== key &&
        normalizeFriendToken(r.toFriendCode) !== key
    ),
  };
}

export function receiveIncomingFriendRequest(
  prog: UserProgression,
  request: FriendRequestEntry
): UserProgression {
  if (
    isAlreadyFriend(prog, {
      id: request.fromPlayerId,
      friendCode: request.fromFriendCode,
      name: request.fromName,
    })
  ) {
    return prog;
  }

  const existing = prog.incomingFriendRequests ?? [];
  const fid = normalizeFriendToken(request.fromPlayerId);
  const fcode = normalizeFriendToken(request.fromFriendCode);
  const fname = normalizeFriendToken(request.fromName);

  const duplicate = existing.some(
    (r) =>
      r.status === 'pending' &&
      (r.id === request.id ||
        (fid && normalizeFriendToken(r.fromPlayerId) === fid) ||
        (fcode && normalizeFriendToken(r.fromFriendCode) === fcode) ||
        (fname && normalizeFriendToken(r.fromName) === fname))
  );
  if (duplicate) return prog;

  const entry: FriendRequestEntry = {
    ...request,
    status: 'pending',
  };

  return {
    ...prog,
    incomingFriendRequests: [entry, ...existing].slice(0, 50),
  };
}

export function acceptIncomingFriendRequest(
  prog: UserProgression,
  requestId: string
): {
  ok: boolean;
  acceptedRequest?: FriendRequestEntry;
  friend?: FriendEntry;
  progression: UserProgression;
} {
  const incoming = prog.incomingFriendRequests ?? [];
  const targetReq = incoming.find((r) => r.id === requestId && r.status === 'pending');
  if (!targetReq) {
    return { ok: false, progression: prog };
  }

  const remainingIncoming = incoming.filter((r) => r.id !== requestId);
  const remainingOutgoing = (prog.outgoingFriendRequests ?? []).filter(
    (r) =>
      normalizeFriendToken(r.toPlayerId) !== normalizeFriendToken(targetReq.fromPlayerId) &&
      normalizeFriendToken(r.toFriendCode) !== normalizeFriendToken(targetReq.fromFriendCode) &&
      normalizeFriendToken(r.toName) !== normalizeFriendToken(targetReq.fromName)
  );

  const alreadyFriend = isAlreadyFriend(prog, {
    id: targetReq.fromPlayerId,
    friendCode: targetReq.fromFriendCode,
    name: targetReq.fromName,
  });

  const newFriend: FriendEntry = {
    id: targetReq.fromPlayerId,
    friendCode: targetReq.fromFriendCode || 'FC0000',
    name: targetReq.fromName,
    avatar: targetReq.fromAvatar || '⚽',
    weeklyPoints: targetReq.weeklyPoints ?? 0,
    totalPoints: targetReq.totalPoints ?? 0,
    statusText: targetReq.subtitle || (targetReq.isBot ? 'Bot Rakip' : 'Arkadaş'),
    isOnline: !targetReq.isBot,
  };

  return {
    ok: true,
    acceptedRequest: { ...targetReq, status: 'accepted' },
    friend: newFriend,
    progression: {
      ...prog,
      incomingFriendRequests: remainingIncoming,
      outgoingFriendRequests: remainingOutgoing,
      friends: alreadyFriend ? prog.friends : [newFriend, ...prog.friends],
    },
  };
}

export function rejectIncomingFriendRequest(
  prog: UserProgression,
  requestId: string
): {
  ok: boolean;
  rejectedRequest?: FriendRequestEntry;
  progression: UserProgression;
} {
  const incoming = prog.incomingFriendRequests ?? [];
  const targetReq = incoming.find((r) => r.id === requestId);
  if (!targetReq) {
    return { ok: false, progression: prog };
  }
  return {
    ok: true,
    rejectedRequest: { ...targetReq, status: 'rejected' },
    progression: {
      ...prog,
      incomingFriendRequests: incoming.filter((r) => r.id !== requestId),
    },
  };
}

export function completeOutgoingFriendRequest(
  prog: UserProgression,
  request: {
    id?: string;
    toPlayerId?: string;
    toFriendCode?: string;
    toName?: string;
    toAvatar?: string;
    weeklyPoints?: number;
    totalPoints?: number;
    subtitle?: string;
  },
  outcome: 'accepted' | 'rejected'
): UserProgression {
  const outgoing = prog.outgoingFriendRequests ?? [];
  const reqId = normalizeFriendToken(request.id);
  const toId = normalizeFriendToken(request.toPlayerId);
  const toCode = normalizeFriendToken(request.toFriendCode);
  const toName = normalizeFriendToken(request.toName);

  const matched = outgoing.find(
    (r) =>
      (reqId && normalizeFriendToken(r.id) === reqId) ||
      (toId && normalizeFriendToken(r.toPlayerId) === toId) ||
      (toCode && normalizeFriendToken(r.toFriendCode) === toCode) ||
      (toName && normalizeFriendToken(r.toName) === toName)
  );

  const remainingOutgoing = outgoing.filter((r) => r !== matched);

  if (outcome !== 'accepted') {
    return {
      ...prog,
      outgoingFriendRequests: remainingOutgoing,
    };
  }

  const friendId = String(request.toPlayerId || matched?.toPlayerId || `friend_${Date.now()}`);
  const friendCode = String(request.toFriendCode || matched?.toFriendCode || 'FC0000');
  const friendName = String(request.toName || matched?.toName || 'Oyuncu');

  if (isAlreadyFriend(prog, { id: friendId, friendCode, name: friendName })) {
    return {
      ...prog,
      outgoingFriendRequests: remainingOutgoing,
    };
  }

  const newFriend: FriendEntry = {
    id: friendId,
    friendCode,
    name: friendName,
    avatar: String(request.toAvatar || matched?.toAvatar || '⚽'),
    weeklyPoints: Number(request.weeklyPoints ?? matched?.weeklyPoints ?? 0),
    totalPoints: Number(request.totalPoints ?? matched?.totalPoints ?? 0),
    statusText: String(request.subtitle || matched?.subtitle || 'Çevrim içi oyuncu'),
    isOnline: !friendId.startsWith('bot_'),
  };

  return {
    ...prog,
    outgoingFriendRequests: remainingOutgoing,
    friends: [newFriend, ...prog.friends],
  };
}

export function buildLeagueStandings(
  prog: UserProgression,
  userProfile: PlayerProfile,
  tab: 'weekly' | 'friends' | 'all_time',
  liveServerPlayers: LeaguePlayerEntry[] = []
): { entries: LeaguePlayerEntry[]; userRank: number } {
  const selfEntry: LeaguePlayerEntry = {
    id: userProfile.id,
    friendCode: prog.friendCode,
    name: sanitizePublicDisplayName(userProfile.name, userProfile.id),
    avatar: userProfile.avatar,
    weeklyPoints: prog.weeklyPoints,
    totalPoints: prog.totalPoints,
    subtitle: prog.equippedTitle,
    hasCrown: prog.unlockedGiftIds.includes('gift_title_legend'),
    isUser: true,
    favoriteClubId: userProfile.favoriteClubId,
    equippedCrest: prog.equippedCrest,
    equippedFrame: prog.equippedFrame,
    equippedBadge: prog.equippedBadge,
    matchesPlayed: prog.matchesPlayed,
    wins: prog.wins,
    losses: prog.losses,
    winStreak: prog.winStreak,
    bestWinStreak: prog.bestWinStreak,
    totalCorrectAnswers: prog.totalCorrectAnswers,
    totalWrongAttempts: prog.totalWrongAttempts,
    fastestAnswerSec: prog.fastestAnswerSec,
    clutchAnswers: prog.clutchAnswers,
    minigameMatchCounts: prog.minigameMatchCounts,
    dailyStreakDays: prog.dailyLogin.streakDays,
    tournamentWins: prog.tournamentWins ?? 0,
    tournamentsPlayed: prog.tournamentsPlayed ?? 0,
  };

  let pool: LeaguePlayerEntry[] = [];

  if (tab === 'friends') {
    const liveMap = new Map(liveServerPlayers.map((p) => [p.id, p]));
    pool = [
      selfEntry,
      ...prog.friends.map((f) => {
        const fresh = liveMap.get(f.id);
        return {
          ...(fresh || {}),
          id: f.id,
          friendCode: fresh?.friendCode || f.friendCode,
          name: sanitizePublicDisplayName(fresh ? fresh.name : f.name, f.id),
          avatar: fresh ? fresh.avatar : f.avatar,
          weeklyPoints: fresh ? fresh.weeklyPoints : f.weeklyPoints,
          totalPoints: fresh ? fresh.totalPoints : f.totalPoints,
          subtitle: fresh ? fresh.subtitle : f.statusText,
          hasCrown: fresh?.hasCrown,
          isFriend: true,
        };
      }),
    ];
  } else {
    const seen = new Set<string>([selfEntry.id]);
    pool.push(selfEntry);

    for (const srv of liveServerPlayers) {
      if (!seen.has(srv.id)) {
        seen.add(srv.id);
        pool.push({
          ...srv,
          name: sanitizePublicDisplayName(srv.name, srv.id),
        });
      }
    }
  }

  const sortField = tab === 'all_time' ? 'totalPoints' : 'weeklyPoints';
  pool.sort((a, b) => b[sortField] - a[sortField]);

  const userIdx = pool.findIndex((e) => e.isUser);
  return {
    entries: pool,
    userRank: userIdx >= 0 ? userIdx + 1 : 1,
  };
}

export function dismissLeagueSeasonNotice(prog: UserProgression): UserProgression {
  if (!prog.lastSeasonResetNotice) return prog;
  return {
    ...prog,
    lastSeasonResetNotice: null,
  };
}

export function buildWeeklyLeagueDivisionStandings(
  prog: UserProgression,
  userProfile: PlayerProfile,
  liveServerPlayers: LeaguePlayerEntry[] = []
): {
  tier: WeeklyLeagueTierInfo;
  nextTier: WeeklyLeagueTierInfo | null;
  prevTier: WeeklyLeagueTierInfo | null;
  entries: LeaguePlayerEntry[];
  userRank: number;
  promotionCutoff: number;
  relegationStartRank: number | null;
} {
  const tier = getLeagueTierInfo(prog.leagueTierId);
  const nextTier = getNextLeagueTier(tier.id);
  const prevTier = getPreviousLeagueTier(tier.id);

  const base = buildLeagueStandings(prog, userProfile, 'weekly', liveServerPlayers);
  const pool: LeaguePlayerEntry[] = [...base.entries];

  const neededBots = Math.max(0, WEEKLY_LEAGUE_GROUP_SIZE - pool.length);
  if (neededBots > 0) {
    const bots = generateWeeklyLeagueBotRivals(
      tier.id,
      prog.weeklyPoints,
      prog.weekKey,
      neededBots
    );
    const seen = new Set(pool.map((e) => e.id));
    for (const bot of bots) {
      if (!seen.has(bot.id)) {
        seen.add(bot.id);
        pool.push(bot);
      }
    }
  }

  pool.sort((a, b) => b.weeklyPoints - a.weeklyPoints);
  const userIdx = pool.findIndex((e) => e.isUser);
  const hasRelegation = prevTier !== null && pool.length >= 6;
  const relegationStartRank = hasRelegation
    ? Math.max(WEEKLY_LEAGUE_PROMOTION_CUTOFF + 2, pool.length - WEEKLY_LEAGUE_RELEGATION_COUNT + 1)
    : null;

  return {
    tier,
    nextTier,
    prevTier,
    entries: pool,
    userRank: userIdx >= 0 ? userIdx + 1 : 1,
    promotionCutoff: WEEKLY_LEAGUE_PROMOTION_CUTOFF,
    relegationStartRank,
  };
}
