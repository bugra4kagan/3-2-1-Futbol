import {
  DailyQuest,
  FriendEntry,
  LeaguePlayerEntry,
  MatchPlayerStats,
  MinigameType,
  PlayerProfile,
  ShopGiftItem,
  SocialProvider,
  UserProgression,
} from './types';
import { STORE_ITEMS } from './storeCatalog';

export interface DailyRewardTier {
  day: number;
  coins: number;
  points: number;
  bonusLabel?: string;
}

export const DAILY_REWARD_SCHEDULE: DailyRewardTier[] = [
  { day: 1, coins: 100, points: 60 },
  { day: 2, coins: 150, points: 90 },
  { day: 3, coins: 250, points: 140 },
  { day: 4, coins: 350, points: 200 },
  { day: 5, coins: 500, points: 280 },
  { day: 6, coins: 750, points: 400 },
  { day: 7, coins: 1500, points: 750, bonusLabel: '👑 Mega Ödül' },
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
    rewardCoins: 120,
    rewardPoints: 100,
    icon: '⚽',
  },
  {
    id: 'q_win_1',
    title: 'Zafer Tadı',
    description: 'Bugün 1 galibiyet al',
    metric: 'matches_won',
    target: 1,
    rewardCoins: 250,
    rewardPoints: 200,
    icon: '🏆',
  },
  {
    id: 'q_answers_5',
    title: 'Keskin Nişancı',
    description: 'Toplam 5 doğru futbolcu bil',
    metric: 'correct_answers',
    target: 5,
    rewardCoins: 300,
    rewardPoints: 240,
    icon: '🎯',
  },
  {
    id: 'q_minigame_1',
    title: 'Çok Yönlü Yıldız',
    description: 'Futbolcuyu Tahmin Et, XOX, Kariyer veya Ülke+Kulüp oyna',
    metric: 'minigame_played',
    target: 1,
    rewardCoins: 220,
    rewardPoints: 180,
    icon: '🎮',
  },
  {
    id: 'q_win_3',
    title: 'Hat-Trick Şampiyonu',
    description: 'Bugün 3 maç kazan',
    metric: 'matches_won',
    target: 3,
    rewardCoins: 600,
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
  };
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
    updated = {
      ...updated,
      weekKey: currentWeek,
      weeklyPoints: 0,
    };
  }

  if (updated.questsDate !== today) {
    updated = {
      ...updated,
      questsDate: today,
      dailyQuests: buildFreshDailyQuests(),
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

  return {
    claimed: true,
    reward,
    progression: {
      ...synced,
      coins: synced.coins + reward.coins,
      weeklyPoints: synced.weeklyPoints + reward.points,
      totalPoints: synced.totalPoints + reward.points,
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

export function recordMatchOutcome(
  prog: UserProgression,
  input: MatchOutcomeInput
): {
  progression: UserProgression;
  earnedPoints: number;
  earnedCoins: number;
  multiplierApplied: boolean;
} {
  const synced = syncProgressionForToday(prog, input.now);
  const isWin = input.won && !input.isDraw;
  const isLoss = !input.won && !input.isDraw;

  const newWinStreak = isWin ? synced.winStreak + 1 : isLoss ? 0 : synced.winStreak;
  const bestWinStreak = Math.max(synced.bestWinStreak, newWinStreak);

  // Reward formula: participation + correct answers + victory bonus + win-streak bonus
  const streakBonusPts = isWin && newWinStreak >= 2 ? Math.min(80, newWinStreak * 20) : 0;
  const basePoints =
    45 + input.stats.totalCorrect * 18 + (isWin ? 130 : 0) + streakBonusPts;
  const baseCoins =
    30 + input.stats.totalCorrect * 10 + (isWin ? 90 : 0);

  const hasPerm2x = Boolean(synced.permanentMultiplier2x);
  const remaining2xMatches = Math.max(0, synced.multiplier2xMatches ?? 0);
  const multiplierApplied = hasPerm2x || remaining2xMatches > 0;
  const earnedPoints = multiplierApplied ? basePoints * 2 : basePoints;
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

  return {
    earnedPoints,
    earnedCoins,
    multiplierApplied,
    progression: {
      ...synced,
      coins: synced.coins + earnedCoins,
      weeklyPoints: synced.weeklyPoints + earnedPoints,
      totalPoints: synced.totalPoints + earnedPoints,
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
      dailyQuests: updatedQuests,
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
  } else if (item.type === 'ad_free') {
    nextProg = {
      ...nextProg,
      adFree: true,
      unlockedGiftIds: nextProg.unlockedGiftIds.includes(item.id)
        ? nextProg.unlockedGiftIds
        : [...nextProg.unlockedGiftIds, item.id],
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

export function buildLeagueStandings(
  prog: UserProgression,
  userProfile: PlayerProfile,
  tab: 'weekly' | 'friends' | 'all_time',
  liveServerPlayers: LeaguePlayerEntry[] = []
): { entries: LeaguePlayerEntry[]; userRank: number } {
  const selfEntry: LeaguePlayerEntry = {
    id: userProfile.id,
    friendCode: prog.friendCode,
    name: userProfile.name,
    avatar: userProfile.avatar,
    weeklyPoints: prog.weeklyPoints,
    totalPoints: prog.totalPoints,
    subtitle: prog.equippedTitle,
    hasCrown: prog.unlockedGiftIds.includes('gift_title_legend'),
    isUser: true,
  };

  let pool: LeaguePlayerEntry[] = [];

  if (tab === 'friends') {
    const liveMap = new Map(liveServerPlayers.map((p) => [p.id, p]));
    pool = [
      selfEntry,
      ...prog.friends.map((f) => {
        const fresh = liveMap.get(f.id);
        return {
          id: f.id,
          friendCode: f.friendCode,
          name: fresh ? fresh.name : f.name,
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
        pool.push(srv);
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
