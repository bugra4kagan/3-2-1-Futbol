import { Player, UserProgression } from './types';
import { getLocalDateKey, getPreviousDateKey } from './retentionEngine';

export interface V3DailyQuestItem {
  id: string;
  title: string;
  description: string;
  metric: 'win_matches' | 'super_lig_stars' | 'fast_win_15s';
  progress: number;
  target: number;
  rewardCoins: number;
  claimed: boolean;
  icon: string;
}

export interface V3DailyQuestsState {
  dateKey: string;
  quests: V3DailyQuestItem[];
  bigChestClaimed: boolean;
  bigChestDoubled: boolean;
  streakSaverDismissedDate: string | null;
}

export const V3_DAILY_QUESTS_STORAGE_KEY = '321_v3_daily_quests_v1';
export const BIG_CHEST_BASE_COINS = 400;
export const STREAK_SAVER_COIN_COST = 500;

export function buildV3QuestsForDate(): V3DailyQuestItem[] {
  return [
    {
      id: 'v3_win_3',
      title: 'Galibiyet Serisi',
      description: '3 maç kazan',
      metric: 'win_matches',
      progress: 0,
      target: 3,
      rewardCoins: 150,
      claimed: false,
      icon: '🏆',
    },
    {
      id: 'v3_super_lig_5',
      title: 'Süper Lig Uzmanı',
      description: "Süper Lig'den 5 yıldız bil",
      metric: 'super_lig_stars',
      progress: 0,
      target: 5,
      rewardCoins: 150,
      claimed: false,
      icon: '🇹🇷',
    },
    {
      id: 'v3_fast_win_15',
      title: 'Şimşek Gibi',
      description: '1 maçı 15 saniyenin altında tamamla',
      metric: 'fast_win_15s',
      progress: 0,
      target: 1,
      rewardCoins: 200,
      claimed: false,
      icon: '⚡',
    },
  ];
}

export function createInitialV3DailyQuestsState(now: Date = new Date()): V3DailyQuestsState {
  return {
    dateKey: getLocalDateKey(now),
    quests: buildV3QuestsForDate(),
    bigChestClaimed: false,
    bigChestDoubled: false,
    streakSaverDismissedDate: null,
  };
}

export function loadV3DailyQuestsState(now: Date = new Date()): V3DailyQuestsState {
  const today = getLocalDateKey(now);
  const fresh = createInitialV3DailyQuestsState(now);
  if (typeof window === 'undefined' || !window.localStorage) return fresh;

  try {
    const raw = window.localStorage.getItem(V3_DAILY_QUESTS_STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<V3DailyQuestsState>;
    if (parsed.dateKey !== today || !Array.isArray(parsed.quests) || parsed.quests.length !== 3) {
      saveV3DailyQuestsState(fresh);
      return fresh;
    }
    return {
      ...fresh,
      ...parsed,
      quests: parsed.quests,
    };
  } catch {
    return fresh;
  }
}

export function saveV3DailyQuestsState(state: V3DailyQuestsState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(V3_DAILY_QUESTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function syncV3DailyQuestsForToday(
  state: V3DailyQuestsState,
  now: Date = new Date()
): V3DailyQuestsState {
  const today = getLocalDateKey(now);
  if (state.dateKey === today) return state;
  const fresh = createInitialV3DailyQuestsState(now);
  saveV3DailyQuestsState(fresh);
  return fresh;
}

export function recordV3QuestPlayerGuess(
  player: Player | null | undefined,
  state: V3DailyQuestsState = loadV3DailyQuestsState(),
  now: Date = new Date()
): V3DailyQuestsState {
  if (!player) return state;
  const synced = syncV3DailyQuestsForToday(state, now);
  const isSuperLig =
    player.league === 'Süper Lig' ||
    (player.careerHistory || []).some((step) => step.countryFlag === '🇹🇷');
  if (!isSuperLig) return synced;

  const updated: V3DailyQuestsState = {
    ...synced,
    quests: synced.quests.map((q) =>
      q.metric === 'super_lig_stars'
        ? { ...q, progress: Math.min(q.target, q.progress + 1) }
        : q
    ),
  };
  saveV3DailyQuestsState(updated);
  return updated;
}

export function recordV3QuestMatchEnd(
  params: { won: boolean; fastestAnswerSec?: number | null },
  state: V3DailyQuestsState = loadV3DailyQuestsState(),
  now: Date = new Date()
): V3DailyQuestsState {
  const synced = syncV3DailyQuestsForToday(state, now);
  if (!params.won) return synced;

  const isUnder15Sec =
    typeof params.fastestAnswerSec === 'number' &&
    params.fastestAnswerSec > 0 &&
    params.fastestAnswerSec < 15;

  const updated: V3DailyQuestsState = {
    ...synced,
    quests: synced.quests.map((q) => {
      if (q.metric === 'win_matches') {
        return { ...q, progress: Math.min(q.target, q.progress + 1) };
      }
      if (q.metric === 'fast_win_15s' && isUnder15Sec) {
        return { ...q, progress: Math.min(q.target, q.progress + 1) };
      }
      return q;
    }),
  };
  saveV3DailyQuestsState(updated);
  return updated;
}

export function claimV3DailyQuestReward(
  questId: string,
  state: V3DailyQuestsState = loadV3DailyQuestsState(),
  now: Date = new Date()
): { claimed: boolean; rewardCoins: number; state: V3DailyQuestsState } {
  const synced = syncV3DailyQuestsForToday(state, now);
  const targetQuest = synced.quests.find((q) => q.id === questId);
  if (!targetQuest || targetQuest.claimed || targetQuest.progress < targetQuest.target) {
    return { claimed: false, rewardCoins: 0, state: synced };
  }

  const nextState: V3DailyQuestsState = {
    ...synced,
    quests: synced.quests.map((q) =>
      q.id === questId ? { ...q, claimed: true } : q
    ),
  };
  saveV3DailyQuestsState(nextState);
  return { claimed: true, rewardCoins: targetQuest.rewardCoins, state: nextState };
}

export function areAllV3DailyQuestsCompleted(state: V3DailyQuestsState): boolean {
  return state.quests.every((q) => q.progress >= q.target);
}

export function claimV3BigDailyChest(
  state: V3DailyQuestsState = loadV3DailyQuestsState(),
  now: Date = new Date()
): { claimed: boolean; rewardCoins: number; state: V3DailyQuestsState } {
  const synced = syncV3DailyQuestsForToday(state, now);
  if (synced.bigChestClaimed || !areAllV3DailyQuestsCompleted(synced)) {
    return { claimed: false, rewardCoins: 0, state: synced };
  }

  const nextState: V3DailyQuestsState = {
    ...synced,
    bigChestClaimed: true,
  };
  saveV3DailyQuestsState(nextState);
  return { claimed: true, rewardCoins: BIG_CHEST_BASE_COINS, state: nextState };
}

export function doubleV3BigDailyChest(
  state: V3DailyQuestsState = loadV3DailyQuestsState(),
  now: Date = new Date()
): { doubled: boolean; bonusCoins: number; state: V3DailyQuestsState } {
  const synced = syncV3DailyQuestsForToday(state, now);
  if (!synced.bigChestClaimed || synced.bigChestDoubled) {
    return { doubled: false, bonusCoins: 0, state: synced };
  }

  const nextState: V3DailyQuestsState = {
    ...synced,
    bigChestDoubled: true,
  };
  saveV3DailyQuestsState(nextState);
  return { doubled: true, bonusCoins: BIG_CHEST_BASE_COINS, state: nextState };
}

export function getV3ClaimableQuestsCount(state: V3DailyQuestsState): number {
  const questClaimable = state.quests.filter(
    (q) => !q.claimed && q.progress >= q.target
  ).length;
  const chestClaimable =
    areAllV3DailyQuestsCompleted(state) && !state.bigChestClaimed ? 1 : 0;
  return questClaimable + chestClaimable;
}

/**
 * Kullanıcı önceki günlerde bir seri oluşturduysa ancak dünü kaçırdıysa,
 * seri 1'e sıfırlanmadan önce kurtarma teklifi gösterilip gösterilmeyeceğini kontrol eder.
 */
export function isLoginStreakAtRisk(
  progression: UserProgression,
  questState: V3DailyQuestsState,
  now: Date = new Date()
): boolean {
  const today = getLocalDateKey(now);
  const yesterday = getPreviousDateKey(now);
  const last = progression.dailyLogin.lastClaimDate;
  if (!last || progression.dailyLogin.streakDays < 1) return false;
  if (last === today || last === yesterday) return false;
  if (questState.streakSaverDismissedDate === today) return false;
  return true;
}

export function saveUserLoginStreakWithYesterday(
  progression: UserProgression,
  now: Date = new Date()
): UserProgression {
  const yesterday = getPreviousDateKey(now);
  return {
    ...progression,
    dailyLogin: {
      streakDays: Math.max(1, progression.dailyLogin.streakDays),
      lastClaimDate: yesterday,
    },
  };
}
