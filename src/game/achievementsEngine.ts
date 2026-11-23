import { Player, UserProgression } from './types';

export interface CareerAchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  rewardCoins: number;
}

export interface CareerModeWins {
  two_clubs: number;
  xox: number;
  career: number;
  country_club: number;
}

export interface CareerAchievementsState {
  wins: number;
  bestWinStreak: number;
  fastestWinSeconds: number | null;
  superLigGuesses: number;
  uclGuesses: number;
  legendGuesses: number;
  unlockedShopAvatars: number;
  dailyChallengesCompleted: number;
  dailyLoginStreak: number;
  tournamentWins: number;
  modeWins: CareerModeWins;
  reachedTopLeague: boolean;
  unlockedIds: string[];
  claimedIds: string[];
}

export const ACHIEVEMENTS_STORAGE_KEY = '321_career_achievements_v1';

const EUROPEAN_TOP_LEAGUES = new Set([
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Şampiyonlar Ligi',
]);

export const CAREER_ACHIEVEMENTS: CareerAchievementDef[] = [
  {
    id: 'first_goal',
    title: 'İlk Gol',
    description: '1 maç kazan',
    icon: '⚽',
    target: 1,
    rewardCoins: 100,
  },
  {
    id: 'ten_wins',
    title: 'İlk 10 Zafer',
    description: '10 maç kazan',
    icon: '🎯',
    target: 10,
    rewardCoins: 250,
  },
  {
    id: 'fifty_wins',
    title: 'Tecrübeli Şampiyon',
    description: '50 maç kazan',
    icon: '🎖️',
    target: 50,
    rewardCoins: 600,
  },
  {
    id: 'hundred_wins',
    title: 'Yüzlük Kulüp',
    description: '100 maç kazan',
    icon: '💯',
    target: 100,
    rewardCoins: 1250,
  },
  {
    id: 'hat_trick_master',
    title: 'Hat-Trick Ustası',
    description: 'Üst üste 3 maç kazan',
    icon: '🎩',
    target: 3,
    rewardCoins: 250,
  },
  {
    id: 'seven_streak',
    title: 'Durdurulamaz 7',
    description: 'Üst üste 7 maç kazan',
    icon: '⚡',
    target: 7,
    rewardCoins: 500,
  },
  {
    id: 'invincible_armada',
    title: 'Yenilmez Armada',
    description: 'Üst üste 15 maç kazan',
    icon: '🔥',
    target: 15,
    rewardCoins: 1000,
  },
  {
    id: 'speed_machine',
    title: 'Hız Makinesi',
    description: '15 saniyenin altında bir maç kazan',
    icon: '⏱️',
    target: 1,
    rewardCoins: 300,
  },
  {
    id: 'master_two_clubs',
    title: 'İki Kulüp Uzmanı',
    description: 'İki Kulüp Ortak Futbolcu modunda 10 maç kazan',
    icon: '🤝',
    target: 10,
    rewardCoins: 350,
  },
  {
    id: 'master_xox',
    title: 'XOX Stratejisti',
    description: 'Futbol XOX (3×3) modunda 10 maç kazan',
    icon: '❌',
    target: 10,
    rewardCoins: 350,
  },
  {
    id: 'master_career',
    title: 'Kariyer Dedektifi',
    description: 'Geçmiş Kariyerden Tahmin modunda 10 maç kazan',
    icon: '🗺️',
    target: 10,
    rewardCoins: 350,
  },
  {
    id: 'master_country_club',
    title: 'Sınır Tanımaz',
    description: '1 Ülke + 1 Kulüp modunda 10 maç kazan',
    icon: '🌐',
    target: 10,
    rewardCoins: 350,
  },
  {
    id: 'tournament_champion',
    title: 'Turnuva Fatihi',
    description: '8 Kişilik Eleme Turnuvası kazan',
    icon: '🏟️',
    target: 1,
    rewardCoins: 750,
  },
  {
    id: 'daily_streak_3',
    title: '3 Günlük Sadakat',
    description: 'Üst üste 3 gün oyuna gir',
    icon: '📆',
    target: 3,
    rewardCoins: 200,
  },
  {
    id: 'daily_streak_7',
    title: 'Haftalık Tutku',
    description: 'Üst üste 7 gün oyuna gir',
    icon: '🔥',
    target: 7,
    rewardCoins: 450,
  },
  {
    id: 'daily_streak_30',
    title: 'Aylık Futbol Efsanesi',
    description: 'Üst üste 30 gün oyuna gir',
    icon: '👑',
    target: 30,
    rewardCoins: 1500,
  },
  {
    id: 'daily_regular',
    title: 'Günlük Müdavim',
    description: '3 Günlük Meydan Okuma tamamla',
    icon: '📅',
    target: 3,
    rewardCoins: 350,
  },
  {
    id: 'super_lig_gourmet',
    title: 'Süper Lig Gurmesi',
    description: '15 Süper Lig yıldızını doğru bil',
    icon: '🇹🇷',
    target: 15,
    rewardCoins: 300,
  },
  {
    id: 'collector',
    title: 'Koleksiyoner',
    description: 'Mağazadan 5 futbolcu avatarı aç',
    icon: '🖼️',
    target: 5,
    rewardCoins: 500,
  },
  {
    id: 'ucl_star',
    title: 'Şampiyonlar Ligi Yıldızı',
    description: 'En üst lig kademesine ulaş',
    icon: '🏆',
    target: 1,
    rewardCoins: 1000,
  },
];

function dedupeStringIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const validIds = new Set(CAREER_ACHIEVEMENTS.map((a) => a.id));
  const out = new Set<string>();
  for (const raw of ids) {
    if (typeof raw === 'string' && validIds.has(raw)) {
      out.add(raw);
    }
  }
  return Array.from(out);
}

export function createInitialAchievementsState(): CareerAchievementsState {
  return {
    wins: 0,
    bestWinStreak: 0,
    fastestWinSeconds: null,
    superLigGuesses: 0,
    uclGuesses: 0,
    legendGuesses: 0,
    unlockedShopAvatars: 0,
    dailyChallengesCompleted: 0,
    dailyLoginStreak: 0,
    tournamentWins: 0,
    modeWins: {
      two_clubs: 0,
      xox: 0,
      career: 0,
      country_club: 0,
    },
    reachedTopLeague: false,
    unlockedIds: [],
    claimedIds: [],
  };
}

export function loadAchievementsState(): CareerAchievementsState {
  const base = createInitialAchievementsState();
  if (typeof window === 'undefined' || !window.localStorage) {
    return base;
  }
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<CareerAchievementsState>;
    const claimedIds = dedupeStringIds(parsed.claimedIds);
    const unlockedIds = Array.from(
      new Set([...dedupeStringIds(parsed.unlockedIds), ...claimedIds])
    );
    return {
      ...base,
      ...parsed,
      modeWins: {
        ...base.modeWins,
        ...(parsed.modeWins || {}),
      },
      dailyLoginStreak: Math.max(0, Math.round(Number(parsed.dailyLoginStreak) || 0)),
      tournamentWins: Math.max(0, Math.round(Number(parsed.tournamentWins) || 0)),
      unlockedIds,
      claimedIds,
    };
  } catch {
    return base;
  }
}

export function saveAchievementsState(state: CareerAchievementsState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function getAchievementProgress(
  def: CareerAchievementDef,
  state: CareerAchievementsState
): number {
  switch (def.id) {
    case 'first_goal':
    case 'ten_wins':
    case 'fifty_wins':
    case 'hundred_wins':
      return Math.min(def.target, state.wins);
    case 'hat_trick_master':
    case 'seven_streak':
    case 'invincible_armada':
      return Math.min(def.target, state.bestWinStreak);
    case 'speed_machine':
      return state.fastestWinSeconds !== null && state.fastestWinSeconds < 15 ? 1 : 0;
    case 'master_two_clubs':
      return Math.min(def.target, state.modeWins?.two_clubs ?? 0);
    case 'master_xox':
      return Math.min(def.target, state.modeWins?.xox ?? 0);
    case 'master_career':
      return Math.min(def.target, state.modeWins?.career ?? 0);
    case 'master_country_club':
      return Math.min(def.target, state.modeWins?.country_club ?? 0);
    case 'tournament_champion':
      return Math.min(def.target, state.tournamentWins ?? 0);
    case 'daily_streak_3':
    case 'daily_streak_7':
    case 'daily_streak_30':
      return Math.min(def.target, state.dailyLoginStreak ?? 0);
    case 'super_lig_gourmet':
      return Math.min(def.target, state.superLigGuesses);
    case 'collector':
      return Math.min(def.target, state.unlockedShopAvatars);
    case 'daily_regular':
      return Math.min(def.target, state.dailyChallengesCompleted);
    case 'ucl_star':
      return state.reachedTopLeague ? 1 : 0;
    default:
      return 0;
  }
}

function evaluateNewUnlocks(state: CareerAchievementsState): {
  nextState: CareerAchievementsState;
  newlyUnlocked: CareerAchievementDef[];
} {
  const claimedSet = new Set(dedupeStringIds(state.claimedIds));
  const unlockedSet = new Set([...dedupeStringIds(state.unlockedIds), ...claimedSet]);
  const newlyUnlocked: CareerAchievementDef[] = [];

  for (const def of CAREER_ACHIEVEMENTS) {
    if (
      !unlockedSet.has(def.id) &&
      !claimedSet.has(def.id) &&
      getAchievementProgress(def, state) >= def.target
    ) {
      unlockedSet.add(def.id);
      newlyUnlocked.push(def);
    }
  }

  return {
    nextState: {
      ...state,
      unlockedIds: Array.from(unlockedSet),
      claimedIds: Array.from(claimedSet),
    },
    newlyUnlocked,
  };
}

export function applyAchievementsToProgression(
  progression: UserProgression,
  state: CareerAchievementsState
): UserProgression {
  const nextClaimed = Array.from(
    new Set([...dedupeStringIds(progression.claimedAchievements), ...dedupeStringIds(state.claimedIds)])
  );
  const nextUnlocked = Array.from(
    new Set([
      ...dedupeStringIds(progression.unlockedAchievements),
      ...dedupeStringIds(state.unlockedIds),
      ...nextClaimed,
    ])
  );

  const prevUnlocked = progression.unlockedAchievements ?? [];
  const prevClaimed = progression.claimedAchievements ?? [];
  const unchanged =
    prevUnlocked.length === nextUnlocked.length &&
    prevClaimed.length === nextClaimed.length &&
    nextUnlocked.every((id, idx) => prevUnlocked[idx] === id) &&
    nextClaimed.every((id, idx) => prevClaimed[idx] === id);

  if (unchanged) return progression;

  return {
    ...progression,
    unlockedAchievements: nextUnlocked,
    claimedAchievements: nextClaimed,
  };
}

export function syncAchievementsFromProgression(
  progression: UserProgression,
  currentState: CareerAchievementsState = loadAchievementsState()
): { state: CareerAchievementsState; newlyUnlocked: CareerAchievementDef[] } {
  const shopAvatars = progression.unlockedGiftIds.filter((id) =>
    id.startsWith('pp_')
  ).length;
  const dailyDoneCount = Object.keys(progression.dailyChallengeHistory ?? {}).length;
  const isTopLeague = progression.leagueTierId === 'champions_league';
  const progModeWins = progression.modeWinCounts ?? {};

  const mergedClaimed = Array.from(
    new Set([
      ...dedupeStringIds(currentState.claimedIds),
      ...dedupeStringIds(progression.claimedAchievements),
    ])
  );
  const mergedUnlocked = Array.from(
    new Set([
      ...dedupeStringIds(currentState.unlockedIds),
      ...dedupeStringIds(progression.unlockedAchievements),
      ...mergedClaimed,
    ])
  );

  const merged: CareerAchievementsState = {
    ...currentState,
    wins: Math.max(currentState.wins, progression.wins),
    bestWinStreak: Math.max(currentState.bestWinStreak, progression.bestWinStreak),
    unlockedShopAvatars: Math.max(currentState.unlockedShopAvatars, shopAvatars),
    dailyChallengesCompleted: Math.max(currentState.dailyChallengesCompleted, dailyDoneCount),
    dailyLoginStreak: Math.max(
      currentState.dailyLoginStreak ?? 0,
      progression.dailyLogin?.streakDays ?? 0
    ),
    tournamentWins: Math.max(
      currentState.tournamentWins ?? 0,
      progression.tournamentWins ?? 0
    ),
    modeWins: {
      two_clubs: Math.max(currentState.modeWins?.two_clubs ?? 0, progModeWins.two_clubs ?? 0),
      xox: Math.max(currentState.modeWins?.xox ?? 0, progModeWins.xox ?? 0),
      career: Math.max(currentState.modeWins?.career ?? 0, progModeWins.career ?? 0),
      country_club: Math.max(
        currentState.modeWins?.country_club ?? 0,
        progModeWins.country_club ?? 0
      ),
    },
    reachedTopLeague: currentState.reachedTopLeague || isTopLeague,
    unlockedIds: mergedUnlocked,
    claimedIds: mergedClaimed,
  };

  const { nextState, newlyUnlocked } = evaluateNewUnlocks(merged);
  saveAchievementsState(nextState);
  return { state: nextState, newlyUnlocked };
}

export function recordAchievementPlayerGuess(
  player: Player | null | undefined,
  currentState: CareerAchievementsState = loadAchievementsState()
): { state: CareerAchievementsState; newlyUnlocked: CareerAchievementDef[] } {
  if (!player) return { state: currentState, newlyUnlocked: [] };

  const isSuperLig =
    player.league === 'Süper Lig' ||
    (player.careerHistory || []).some((step) => step.countryFlag === '🇹🇷');
  const isLegend = player.league === 'Efsane';
  const isEuropeanStar =
    EUROPEAN_TOP_LEAGUES.has(player.league ?? '') ||
    (player.careerHistory || []).some((step) =>
      ['🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇪🇸', '🇮🇹', '🇩🇪', '🇫🇷'].includes(step.countryFlag)
    );

  const updated: CareerAchievementsState = {
    ...currentState,
    superLigGuesses: currentState.superLigGuesses + (isSuperLig ? 1 : 0),
    uclGuesses: currentState.uclGuesses + (isEuropeanStar ? 1 : 0),
    legendGuesses: currentState.legendGuesses + (isLegend ? 1 : 0),
  };

  const { nextState, newlyUnlocked } = evaluateNewUnlocks(updated);
  saveAchievementsState(nextState);
  return { state: nextState, newlyUnlocked };
}

export function recordAchievementMatchOutcome(
  params: { won: boolean; durationSec?: number; progression: UserProgression },
  currentState: CareerAchievementsState = loadAchievementsState()
): { state: CareerAchievementsState; newlyUnlocked: CareerAchievementDef[] } {
  const { won, durationSec, progression } = params;
  const fastest =
    won && typeof durationSec === 'number' && durationSec > 0
      ? currentState.fastestWinSeconds === null
        ? durationSec
        : Math.min(currentState.fastestWinSeconds, durationSec)
      : currentState.fastestWinSeconds;

  const updated: CareerAchievementsState = {
    ...currentState,
    wins: Math.max(currentState.wins, progression.wins),
    bestWinStreak: Math.max(currentState.bestWinStreak, progression.bestWinStreak),
    fastestWinSeconds: fastest,
  };

  return syncAchievementsFromProgression(progression, updated);
}

export function claimAchievementReward(
  achievementId: string,
  currentState: CareerAchievementsState = loadAchievementsState()
): {
  claimed: boolean;
  rewardCoins: number;
  achievement?: CareerAchievementDef;
  state: CareerAchievementsState;
} {
  const def = CAREER_ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!def) {
    return { claimed: false, rewardCoins: 0, state: currentState };
  }

  const claimedIds = dedupeStringIds(currentState.claimedIds);
  const unlockedIds = Array.from(
    new Set([...dedupeStringIds(currentState.unlockedIds), ...claimedIds])
  );

  // Strict one-time claim enforcement: already claimed or not yet unlocked cannot grant coins
  if (claimedIds.includes(achievementId) || !unlockedIds.includes(achievementId)) {
    return {
      claimed: false,
      rewardCoins: 0,
      achievement: def,
      state: { ...currentState, unlockedIds, claimedIds },
    };
  }

  const nextState: CareerAchievementsState = {
    ...currentState,
    unlockedIds,
    claimedIds: [...claimedIds, achievementId],
  };
  saveAchievementsState(nextState);
  return {
    claimed: true,
    rewardCoins: def.rewardCoins,
    achievement: def,
    state: nextState,
  };
}

export function getClaimableAchievementsCount(state: CareerAchievementsState): number {
  const claimedSet = new Set(dedupeStringIds(state.claimedIds));
  return dedupeStringIds(state.unlockedIds).filter((id) => !claimedSet.has(id)).length;
}
