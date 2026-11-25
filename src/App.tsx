/**
 * 3-2-1 Football Challenge
 * Modern, mobile-first, competitive football trivia duel game.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Coins, Flame, LogOut, Settings, ShoppingBag, UserCheck, UserPlus, Zap } from 'lucide-react';
import {
  GameMode,
  BotDifficulty,
  MinigameType,
  MinigameRoundPayload,
  PlayerProfile,
  MatchPlayerStats,
  MatchRoundHighlight,
  XoxRuntimeState,
  MainTab,
  UserProgression,
  LeaguePlayerEntry,
  PublicPlayerProfile,
  StoreCategory,
  SocialProvider,
  TournamentBracketState,
  TournamentParticipant,
  FriendActivityEvent,
  FriendRequestEntry,
  ToastItem,
  DailyChallengeRecord,
  WheelSliceDefinition,
} from './game/types';
import { CLUBS, PLAYERS_LIST } from './game/database';
import {
  createEmptyXoxBoard,
  generateMinigameRounds,
  getMinigamePoolSize,
  getRoundItemId,
} from './game/minigameEngine';
import { getSeenIdsForMinigame, recordSeenQuestions } from './game/questionHistory';
import {
  TOURNAMENT_OPEN_ENTRY_COINS,
  TOURNAMENT_OPEN_PRIZE_COINS,
  TOURNAMENT_OPEN_PRIZE_POINTS,
  advanceTournamentAfterMatch,
  createTournamentBracket,
  getTournamentMatchForUser,
} from './game/tournamentEngine';
import { getClutchThresholdSeconds, getRoundDurationSeconds } from './game/roundTiming';
import { buildOpponentMiniSummary } from './game/opponentSummary';
import {
  ENERGY_AD_REWARD_AMOUNT,
  FriendTargetCandidate,
  MAX_DAILY_ENERGY,
  acceptIncomingFriendRequest,
  awardTournamentChampionPrize,
  canClaimDailyReward,
  cancelOutgoingFriendRequest,
  claimDailyQuest,
  claimDailyReward,
  completeOutgoingFriendRequest,
  consumeEnergyDrink,
  consumeExtraTimeCard,
  consumeFreeJokerOrSpendCoins,
  consumeMatchEntryEnergy,
  createInitialProgression,
  dismissLeagueSeasonNotice,
  enterTournamentWithCoins,
  equipStoreItem,
  formatPoints,
  getEffectiveDailyEnergy,
  getLeagueTierInfo,
  getLocalDateKey,
  getPendingIncomingRequestCount,
  grantExtraRewards,
  grantFreeAdCoins,
  hasPendingOutgoingRequest,
  hasUnlimitedEnergy,
  linkSocialAccount,
  purchaseGift,
  purchaseStoreItem,
  receiveIncomingFriendRequest,
  recordDailyChallengeCompletion,
  recordMatchOutcome,
  refundMatchEnergy,
  rejectIncomingFriendRequest,
  removeFriend,
  resolveFriendTargetCandidate,
  selectDefaultPitchTheme,
  sendFriendRequest,
  syncProgressionForToday,
  unlinkSocialAccount,
  useEnergyDrinkForMatchEnergy,
} from './game/retentionEngine';
import {
  applyWheelReward,
  canUseFreeWheelSpin,
} from './game/dailyWheelEngine';
import {
  buildToastFromFriendEvent,
  detectHighScoreMilestone,
  dismissToast,
  enqueueToast,
  isEventFromFriend,
} from './game/toastEngine';
import { sounds } from './utils/audio';
import { soundManager } from './utils/soundManager';
import { haptics } from './utils/haptics';
import {
  UiTheme,
  applyUiTheme,
  loadUiTheme,
  saveUiTheme,
} from './game/themeEngine';
import {
  applyAchievementsToProgression,
  CareerAchievementDef,
  CareerAchievementsState,
  claimAchievementReward,
  getClaimableAchievementsCount,
  loadAchievementsState,
  recordAchievementMatchOutcome,
  recordAchievementPlayerGuess,
  syncAchievementsFromProgression,
} from './game/achievementsEngine';
import { AchievementsModal } from './components/AchievementsModal';

import { LobbyScreen } from './components/LobbyScreen';
import { ScoreBoard } from './components/ScoreBoard';
import { CountdownOverlay } from './components/CountdownOverlay';
import { SinglePlayerView } from './components/SinglePlayerView';
import { MinigameArenaView } from './components/MinigameArenaView';
import { RoundResultSheet } from './components/RoundResultSheet';
import { VictoryModal } from './components/VictoryModal';
import { OnlineRoomView } from './components/OnlineRoomView';
import { AnimatedIntro } from './components/AnimatedIntro';
import { AuthModal } from './components/AuthModal';
import { ConfirmExitModal } from './components/ConfirmExitModal';
import { BottomNavBar } from './components/BottomNavBar';
import { DailyRewardsModal } from './components/DailyRewardsModal';
import { DailyChallengeModal } from './components/DailyChallengeModal';
import { StoreModal } from './components/StoreModal';
import { RewardedAdModal } from './components/RewardedAdModal';
import { InterstitialAdModal } from './components/InterstitialAdModal';
import {
  incrementCompletedMatchAdCount,
  setInterstitialPresenter,
  shouldTriggerInterstitialForMatchCount,
  showInterstitialAd,
  showRewardedAd,
} from './services/adService';
import { TournamentModal } from './components/TournamentModal';
import { SettingsModal } from './components/SettingsModal';
import { StatsView } from './components/StatsView';
import { FriendsView } from './components/FriendsView';
import { LeagueView } from './components/LeagueView';
import { ProfileView } from './components/ProfileView';
import { PublicProfileModal } from './components/PublicProfileModal';
import { ToastContainer } from './components/ToastContainer';
import { ClubBadge } from './components/ClubBadge';
import { NightMatchPitchBackground } from './components/NightMatchPitchBackground';
import { FriendRequestConfirmModal } from './components/FriendRequestConfirmModal';
import { EnergyEmptyModal } from './components/EnergyEmptyModal';
import { DailyWheelModal } from './components/DailyWheelModal';
import { FootballPassModal } from './components/FootballPassModal';
import { DailyQuestsModal } from './components/DailyQuestsModal';
import { StreakSaverModal } from './components/StreakSaverModal';
import { LastChanceModal } from './components/LastChanceModal';
import { SpecialEventModal } from './components/SpecialEventModal';
import { OnboardingModal, ONBOARDING_STORAGE_KEY } from './components/OnboardingModal';
import { CoinIcon } from './components/CoinIcon';
import { initializeAdMob } from './services/admobService';
import { logTelemetryEvent } from './services/telemetryService';
import {
  RtdbRoomRecord,
  advanceRtdbNextRound,
  cleanupRtdbRoom,
  createRtdbRoom,
  expireRtdbRound,
  fetchRtdbLeaderboard,
  getRtdbRoundPayload,
  joinRtdbRoom,
  parseRtdbXoxState,
  requestRtdbRematch,
  startRtdbMatchmaking,
  subscribeRtdbLeaderboard,
  subscribeRtdbRoom,
  submitRtdbAnswer,
  syncPlayerToRtdbLeaderboard,
  updateRtdbCountdown,
} from './services/realtimeMultiplayerService';
import { sanitizeRtdbKey } from './game/realtimeSyncHelpers';
import {
  FootballPassState,
  PASS_XP_DAILY_CHALLENGE,
  PASS_XP_DAILY_QUEST,
  PASS_XP_MATCH_WIN,
  awardFootballPassXp,
  claimFootballPassTierReward,
  getClaimablePassRewardsCount,
  getPassCurrentTier,
  loadFootballPassState,
} from './game/footballPassEngine';
import {
  STREAK_SAVER_COIN_COST,
  V3DailyQuestsState,
  claimV3BigDailyChest,
  claimV3DailyQuestReward,
  doubleV3BigDailyChest,
  getV3ClaimableQuestsCount,
  isLoginStreakAtRisk,
  loadV3DailyQuestsState,
  recordV3QuestMatchEnd,
  recordV3QuestPlayerGuess,
  saveUserLoginStreakWithYesterday,
  saveV3DailyQuestsState,
} from './game/v3DailyQuestsEngine';
import {
  SPECIAL_EVENT_COIN_COST,
  SPECIAL_EVENT_JACKPOT_COINS,
  SpecialEventState,
  canUseFreeSpecialEventEntry,
  loadSpecialEventState,
  markSpecialEventEntryUsed,
  pickSpecialEventLineup,
  recordSpecialEventFinish,
} from './game/specialEventEngine';
import {
  FriendChallengePayload,
  decodeFriendChallengeCode,
  resolveChallengePlayers,
} from './game/challengeCodeEngine';
import { useLanguage } from './game/LanguageContext';
import { DEFAULT_STARTER_AVATAR } from './game/avatarCatalog';
import { canPlayDailyChallengeNow } from './game/dailyChallengeEngine';
import {
  computeProgressionDigest,
  getAuthoritativeServerDate,
} from './game/serverTime';
import {
  CareerStatsData,
  FAST_COMBO_THRESHOLD_SEC,
  computeSpeedComboBonusCoins,
  loadCareerStats,
  recordCareerMatchStats,
} from './game/careerStatsEngine';
import {
  auth,
  claimUsernameInFirestore,
  deleteCloudAccountData,
  ensureAnonymousFirebaseSession,
  fetchPublicProfileFromFirestore,
  loadUserBackupFromFirestore,
  processAuthRedirectResult,
  publishActivityToFirestore,
  savePublicProfileToFirestore,
  saveUserBackupToFirestore,
  sendVerificationEmailToCurrentUser,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeFriendProfilesInFirestore,
  subscribeUserAuthoritativeBackup,
  syncServerClockWithFirestore,
  trackGameEvent,
  trackScreenView,
} from './firebase';

type AppScreen = 'intro' | 'lobby' | 'room_waiting' | 'playing' | 'game_over';

const PROGRESSION_SIG_KEY = 'football_user_progression_sig';

function writeProgressionWithDigest(prog: UserProgression): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('football_user_progression', JSON.stringify(prog));
    localStorage.setItem(
      PROGRESSION_SIG_KEY,
      computeProgressionDigest({
        userId: prog.friendCode || '321',
        coins: prog.coins,
        weeklyPoints: prog.weeklyPoints,
        totalPoints: prog.totalPoints,
        unlockedGiftIds: prog.unlockedGiftIds || [],
        adFree: prog.adFree,
        permanentMultiplier2x: prog.permanentMultiplier2x,
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

function loadInitialProgression(playerId: string): UserProgression {
  const fallback = createInitialProgression(playerId);
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem('football_user_progression');
    if (!raw) {
      writeProgressionWithDigest(fallback);
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<UserProgression>;
    const savedSig = localStorage.getItem(PROGRESSION_SIG_KEY);
    const parsedCoins = Math.max(0, Math.round(Number(parsed.coins) || 0));
    const parsedWeekly = Math.max(0, Math.round(Number(parsed.weeklyPoints) || 0));
    const parsedTotal = Math.max(0, Math.round(Number(parsed.totalPoints) || 0));
    const parsedUnlocked = Array.isArray(parsed.unlockedGiftIds)
      ? parsed.unlockedGiftIds.filter((id): id is string => typeof id === 'string')
      : fallback.unlockedGiftIds;

    // Detect manual DevTools localStorage tampering of currency / unlocks / points
    const expectedSig = computeProgressionDigest({
      userId: String(parsed.friendCode || '321'),
      coins: parsedCoins,
      weeklyPoints: parsedWeekly,
      totalPoints: parsedTotal,
      unlockedGiftIds: parsedUnlocked,
      adFree: Boolean(parsed.adFree),
      permanentMultiplier2x: Boolean(parsed.permanentMultiplier2x),
    });
    const isTampered = Boolean(savedSig && savedSig !== expectedSig);
    if (isTampered) {
      logTelemetryEvent('local_storage_tamper_detected', { mode: 'init' }, 'warning');
    }

    const merged: UserProgression = {
      ...fallback,
      ...parsed,
      coins: isTampered ? fallback.coins : parsedCoins,
      weeklyPoints: isTampered ? fallback.weeklyPoints : parsedWeekly,
      totalPoints: isTampered ? fallback.totalPoints : parsedTotal,
      adFree: isTampered ? false : Boolean(parsed.adFree),
      permanentMultiplier2x: isTampered ? false : Boolean(parsed.permanentMultiplier2x),
      minigameMatchCounts: {
        ...fallback.minigameMatchCounts,
        ...(parsed.minigameMatchCounts || {}),
      },
      modeWinCounts: {
        ...(fallback.modeWinCounts || {}),
        ...(parsed.modeWinCounts || {}),
      },
      unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
        ? parsed.unlockedAchievements.filter((id): id is string => typeof id === 'string')
        : fallback.unlockedAchievements,
      claimedAchievements: Array.isArray(parsed.claimedAchievements)
        ? parsed.claimedAchievements.filter((id): id is string => typeof id === 'string')
        : fallback.claimedAchievements,
      dailyLogin: {
        ...fallback.dailyLogin,
        ...(parsed.dailyLogin || {}),
      },
      dailyQuests:
        Array.isArray(parsed.dailyQuests) && parsed.dailyQuests.length > 0
          ? parsed.dailyQuests
          : fallback.dailyQuests,
      unlockedGiftIds: isTampered ? fallback.unlockedGiftIds : parsedUnlocked,
      linkedAccounts: Array.isArray(parsed.linkedAccounts)
        ? parsed.linkedAccounts
        : fallback.linkedAccounts,
      friends: Array.isArray(parsed.friends)
        ? parsed.friends.filter((f) => f && !String(f.id).startsWith('rival_'))
        : fallback.friends,
      outgoingFriendRequests: Array.isArray(parsed.outgoingFriendRequests)
        ? parsed.outgoingFriendRequests
        : fallback.outgoingFriendRequests,
      incomingFriendRequests: Array.isArray(parsed.incomingFriendRequests)
        ? parsed.incomingFriendRequests
        : fallback.incomingFriendRequests,
      dailyChallengeHistory:
        parsed.dailyChallengeHistory && typeof parsed.dailyChallengeHistory === 'object'
          ? parsed.dailyChallengeHistory
          : fallback.dailyChallengeHistory,
    };
    const synced = syncProgressionForToday(merged);
    writeProgressionWithDigest(synced);
    return synced;
  } catch {
    return fallback;
  }
}

function getOrCreateSessionPlayerId(): string {
  if (typeof window === 'undefined') return 'p1';
  try {
    const persisted = localStorage.getItem('football_account_id');
    if (persisted) return persisted;
    const existing = sessionStorage.getItem('football_session_player_id');
    if (existing) {
      localStorage.setItem('football_account_id', existing);
      return existing;
    }
    const generated = `u_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('football_account_id', generated);
    sessionStorage.setItem('football_session_player_id', generated);
    return generated;
  } catch {
    return `u_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export default function App() {
  const { t } = useLanguage();
  // Screen and Mode States
  const [screen, setScreen] = useState<AppScreen>('intro');
  const [mode, setMode] = useState<GameMode>('bot');
  const [minigameType, setMinigameType] = useState<MinigameType>('two_clubs');
  const [botDiff, setBotDiff] = useState<BotDifficulty>('medium');
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => loadUiTheme());
  const [showAchievementsModal, setShowAchievementsModal] = useState<boolean>(false);
  const [achievementsState, setAchievementsState] = useState<CareerAchievementsState>(() =>
    loadAchievementsState()
  );
  const achievementsStateRef = useRef<CareerAchievementsState>(achievementsState);
  const updateAchievementsState = useCallback((next: CareerAchievementsState) => {
    achievementsStateRef.current = next;
    setAchievementsState(next);
  }, []);
  const [achievementToast, setAchievementToast] = useState<CareerAchievementDef | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'profile' | 'email'>('profile');
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [exitTarget, setExitTarget] = useState<'lobby' | 'intro'>('lobby');

  const sessionPlayerIdRef = useRef<string>(getOrCreateSessionPlayerId());
  const [activeTab, setActiveTab] = useState<MainTab>('play');
  const [progression, setProgression] = useState<UserProgression>(() =>
    loadInitialProgression(sessionPlayerIdRef.current)
  );
  const [showDailyModal, setShowDailyModal] = useState<boolean>(false);
  const [showDailyChallengeModal, setShowDailyChallengeModal] = useState<boolean>(false);
  const [showDailyWheelModal, setShowDailyWheelModal] = useState<boolean>(false);
  const [showFootballPassModal, setShowFootballPassModal] = useState<boolean>(false);
  const [passState, setPassState] = useState<FootballPassState>(() => loadFootballPassState());
  const [showV3QuestsModal, setShowV3QuestsModal] = useState<boolean>(false);
  const [v3QuestsState, setV3QuestsState] = useState<V3DailyQuestsState>(() =>
    loadV3DailyQuestsState()
  );
  const [showStreakSaverModal, setShowStreakSaverModal] = useState<boolean>(false);
  const [showLastChanceModal, setShowLastChanceModal] = useState<boolean>(false);
  const lastChanceUsedInMatchRef = useRef<boolean>(false);
  const bonusReviveTimeRef = useRef<number>(0);
  const [showSpecialEventModal, setShowSpecialEventModal] = useState<boolean>(false);
  const [specialEventMode, setSpecialEventMode] = useState<'weekend_cup' | 'friend_challenge'>(
    'weekend_cup'
  );
  const [specialEventState, setSpecialEventState] = useState<SpecialEventState>(() =>
    loadSpecialEventState()
  );
  const [specialEventLineup, setSpecialEventLineup] = useState(() => pickSpecialEventLineup());
  const [activeFriendChallenge, setActiveFriendChallenge] =
    useState<FriendChallengePayload | null>(null);
  const [showEnergyModal, setShowEnergyModal] = useState<boolean>(false);
  const [showStoreModal, setShowStoreModal] = useState<boolean>(false);
  const [storeCategory, setStoreCategory] = useState<StoreCategory>('featured');
  const [showTournamentModal, setShowTournamentModal] = useState<boolean>(false);
  const [activeTournament, setActiveTournament] = useState<TournamentBracketState | null>(null);
  const [pendingInviteTournament, setPendingInviteTournament] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [headerLogoError, setHeaderLogoError] = useState<boolean>(false);
  const [pendingAdReward, setPendingAdReward] = useState<{
    scope: 'round' | 'match' | 'store_coins' | 'rematch_unlock';
    coins: number;
    points: number;
  } | null>(null);
  const [lastRoundReward, setLastRoundReward] = useState<{
    coins: number;
    points: number;
  } | null>(null);
  const [roundDoubledByAd, setRoundDoubledByAd] = useState<boolean>(false);
  const [liveLeaderboardPlayers, setLiveLeaderboardPlayers] = useState<LeaguePlayerEntry[]>([]);
  const [inspectedProfile, setInspectedProfile] = useState<PublicPlayerProfile | null>(null);
  const [isInspectingProfile, setIsInspectingProfile] = useState<boolean>(false);
  const inspectRequestSeqRef = useRef<number>(0);
  const [lastMatchRewards, setLastMatchRewards] = useState<{
    earnedPoints: number;
    earnedCoins: number;
    multiplierApplied?: boolean;
    doubledByAd?: boolean;
    shieldProtected?: boolean;
    comboLevel?: number;
    comboBonusCoins?: number;
  } | null>(null);
  const [careerStats, setCareerStats] = useState<CareerStatsData>(() => loadCareerStats());
  const [fastComboStreak, setFastComboStreak] = useState<number>(0);
  const fastComboStreakRef = useRef<number>(0);
  const maxFastComboRef = useRef<number>(0);
  const roundStartedAtRef = useRef<number>(Date.now());
  const matchStartedAtRef = useRef<number>(Date.now());
  const resetMatchComboAndClock = useCallback(() => {
    fastComboStreakRef.current = 0;
    maxFastComboRef.current = 0;
    setFastComboStreak(0);
    const now = Date.now();
    matchStartedAtRef.current = now;
    roundStartedAtRef.current = now;
  }, []);
  const [lastMatchEnergyDeltaLabel, setLastMatchEnergyDeltaLabel] = useState<string | null>(null);
  const [matchViewportHeight, setMatchViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (screen !== 'playing' || typeof window === 'undefined') {
      setMatchViewportHeight(null);
      return;
    }

    const vv = window.visualViewport;
    const syncViewport = () => {
      const nextHeight = vv ? Math.round(vv.height) : window.innerHeight;
      setMatchViewportHeight(nextHeight > 0 ? nextHeight : null);
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
      }
      if (vv && vv.offsetTop !== 0) {
        window.scrollTo(0, 0);
      }
    };

    syncViewport();
    vv?.addEventListener('resize', syncViewport);
    vv?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);

    return () => {
      vv?.removeEventListener('resize', syncViewport);
      vv?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
    };
  }, [screen]);
  const [matchDoubleAdLoading, setMatchDoubleAdLoading] = useState<boolean>(false);
  const matchDoubleAdInFlightRef = useRef<boolean>(false);
  const [interstitialAdState, setInterstitialAdState] = useState<{
    adUnitId: string;
    resolve: () => void;
  } | null>(null);
  const gameOverTransitionInFlightRef = useRef<boolean>(false);
  const dailyAutoOpenedRef = useRef<boolean>(false);
  const matchInstanceIdRef = useRef<number>(1);
  const energyChargedMatchInstanceRef = useRef<number>(0);
  const recordedMatchInstanceRef = useRef<number>(0);
  const suppressDemoAutoRecordRef = useRef<boolean>(false);
  const pendingNextRoundActionRef = useRef<boolean | null>(null);
  const isTournamentMatchRef = useRef<boolean>(false);
  const returnToTournamentAfterVictoryRef = useRef<boolean>(false);
  const cloudLoadedUidRef = useRef<string | null>(null);
  const cloudSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const serverAccountSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressionRef = useRef<UserProgression>(progression);

  // Player Profiles
  const [player1, setPlayer1] = useState<PlayerProfile>({
    id: sessionPlayerIdRef.current,
    name: 'Futbol Gurmesi',
    avatar: DEFAULT_STARTER_AVATAR,
    score: 0,
    favoriteClubId: 'galatasaray',
    accountStats: {
      totalMatches: 0,
      totalWins: 0,
      badgesEarned: [],
    },
  });

  const [player2, setPlayer2] = useState<PlayerProfile>({
    id: 'p2',
    name: 'Rakip Oyuncu',
    avatar: '🔥',
    score: 0,
  });

  // Performance & Badges Stats Tracking
  const initialStats: MatchPlayerStats = {
    fastestAnswerSec: null,
    totalCorrect: 0,
    totalWrongAttempts: 0,
    currentStreak: 0,
    maxStreak: 0,
    clutchAnswers: 0,
    trailedThenWon: false,
  };

  const [player1Stats, setPlayer1Stats] = useState<MatchPlayerStats>({ ...initialStats });
  const [player2Stats, setPlayer2Stats] = useState<MatchPlayerStats>({ ...initialStats });
  const [matchHighlights, setMatchHighlights] = useState<MatchRoundHighlight[]>([]);

  // Match & Round States
  const [rounds, setRounds] = useState<MinigameRoundPayload[]>([]);
  const [onlineRound, setOnlineRound] = useState<MinigameRoundPayload | null>(null);
  const [xoxState, setXoxState] = useState<XoxRuntimeState | null>(null);
  const [xoxNotice, setXoxNotice] = useState<string | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0); // 3, 2, 1, 0
  const [timeRemaining, setTimeRemaining] = useState<number>(15);
  const timeRemainingRef = useRef<number>(15);
  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);
  const [isRoundPlaying, setIsRoundPlaying] = useState<boolean>(false);
  const [showResultSheet, setShowResultSheet] = useState<boolean>(false);
  const [roundWinnerPlayer, setRoundWinnerPlayer] = useState<PlayerProfile | null>(null);
  const [acceptedAnswerText, setAcceptedAnswerText] = useState<string>('');
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);
  const [roundEndReason, setRoundEndReason] = useState<'timeout' | 'attempts_exhausted' | 'draw'>('timeout');

  // Online Room & Sync States
  const [roomCode, setRoomCode] = useState<string>('');
  const [isMatchmaking, setIsMatchmaking] = useState<boolean>(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [pendingInviteRoom, setPendingInviteRoom] = useState<string | null>(null);
  const [onlineSilhouetteExhausted, setOnlineSilhouetteExhausted] = useState<boolean>(false);
  const [serverWrongFeedback, setServerWrongFeedback] = useState<{
    attempt: string;
    seq: number;
  } | null>(null);
  const [opponentMissedPulse, setOpponentMissedPulse] = useState<number>(0);
  const [rematchState, setRematchState] = useState<
    'idle' | 'waiting' | 'opponent_requested' | 'opponent_left'
  >('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const activeRtdbRoomCodeRef = useRef<string | null>(null);
  const unsubRtdbRoomRef = useRef<(() => void) | null>(null);
  const cancelRtdbMatchmakingRef = useRef<(() => void) | null>(null);
  const rtdbHostTickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rtdbHostNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rtdbRoomPhaseKeyRef = useRef<string>('');
  const rtdbWrongPulseSeqRef = useRef<number>(0);
  const rtdbCountdownStartedAtRef = useRef<number>(0);
  const notifWsRef = useRef<WebSocket | null>(null);
  const notifReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenFriendEventIdsRef = useRef<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingFriendTarget, setPendingFriendTarget] = useState<FriendTargetCandidate | null>(null);
  const player1Ref = useRef<PlayerProfile>(player1);
  const player2Ref = useRef<PlayerProfile>(player2);
  const screenRef = useRef<AppScreen>(screen);
  const minigameTypeRef = useRef<MinigameType>(minigameType);
  const xoxStateRef = useRef<XoxRuntimeState | null>(xoxState);
  const soloXoxTimeoutsRef = useRef<number>(0);

  // Timers
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nextRoundTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoundIndexRef = useRef<number>(0);
  const roundsRef = useRef<MinigameRoundPayload[]>([]);

  useEffect(() => {
    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
      if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
      if (serverAccountSaveTimerRef.current) clearTimeout(serverAccountSaveTimerRef.current);
      if (notifReconnectTimerRef.current) clearTimeout(notifReconnectTimerRef.current);
    };
  }, []);

  const handleIncomingFriendEvent = useCallback((event: FriendActivityEvent) => {
    if (!event || !event.id) return;
    if (seenFriendEventIdsRef.current.has(event.id)) return;
    const isFriend = isEventFromFriend(
      event,
      player1Ref.current.id,
      progressionRef.current.friendCode,
      progressionRef.current.friends
    );
    if (!isFriend) return;

    const toastItem = buildToastFromFriendEvent(event);
    seenFriendEventIdsRef.current.add(event.id);
    sounds.playNotification();
    setToasts((prev) => {
      if (prev.some((t) => t.eventId === event.id)) return prev;
      return enqueueToast(prev, toastItem, 4).queue;
    });
  }, []);

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => dismissToast(prev, id));
  }, []);

  const persistProgression = useCallback((next: UserProgression) => {
    progressionRef.current = next;
    setProgression(next);
    writeProgressionWithDigest(next);
  }, []);

  const syncPendingFriendRequestsFromServer = useCallback(async () => {
    try {
      const pid = player1Ref.current.id;
      const code = progressionRef.current.friendCode;
      const name = player1Ref.current.name;
      const res = await fetch(
        `/api/friends/pending?playerId=${encodeURIComponent(pid)}&friendCode=${encodeURIComponent(
          code
        )}&name=${encodeURIComponent(name)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data?.incoming)) return;
      let nextProg = progressionRef.current;
      const beforeCount = getPendingIncomingRequestCount(nextProg);
      for (const item of data.incoming as FriendRequestEntry[]) {
        nextProg = receiveIncomingFriendRequest(nextProg, item);
      }
      if (nextProg !== progressionRef.current) {
        persistProgression(nextProg);
        if (getPendingIncomingRequestCount(nextProg) > beforeCount) {
          sounds.playNotification();
        }
      }
    } catch {
      // offline fallback handled gracefully
    }
  }, [persistProgression]);

  // Always-on WebSocket subscription for real-time friend tournament, friend requests & high-score notifications
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let disposed = false;

    const sendSubscription = (sock: WebSocket | null) => {
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      sock.send(
        JSON.stringify({
          type: 'subscribe_notifications',
          playerId: player1Ref.current.id,
          friendCode: progressionRef.current.friendCode,
          name: player1Ref.current.name,
          friends: progressionRef.current.friends.map((f) => ({
            id: f.id,
            friendCode: f.friendCode,
            name: f.name,
          })),
          sinceTimestamp: Date.now() - 30000,
        })
      );
    };

    const connectNotifSocket = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const sock = new WebSocket(`${protocol}//${window.location.host}/ws`);
      notifWsRef.current = sock;

      sock.onopen = () => {
        if (disposed) {
          sock.close();
          return;
        }
        sendSubscription(sock);
        syncPendingFriendRequestsFromServer();
      };

      sock.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data?.type === 'friend_activity' && data.event) {
            handleIncomingFriendEvent(data.event as FriendActivityEvent);
          } else if (data?.type === 'friend_request_received' && data.request) {
            const reqEntry = data.request as FriendRequestEntry;
            const beforeCount = getPendingIncomingRequestCount(progressionRef.current);
            const nextProg = receiveIncomingFriendRequest(progressionRef.current, reqEntry);
            if (nextProg !== progressionRef.current) {
              persistProgression(nextProg);
              if (getPendingIncomingRequestCount(nextProg) > beforeCount) {
                sounds.playNotification();
              }
            }
          } else if (data?.type === 'friend_request_responded' && data.request) {
            const reqEntry = data.request as FriendRequestEntry;
            const outcome: 'accepted' | 'rejected' =
              data.action === 'accepted' ? 'accepted' : 'rejected';
            const nextProg = completeOutgoingFriendRequest(
              progressionRef.current,
              reqEntry,
              outcome
            );
            if (nextProg !== progressionRef.current) {
              persistProgression(nextProg);
              if (outcome === 'accepted') {
                sounds.playNotification();
              }
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      sock.onclose = () => {
        if (notifWsRef.current === sock) {
          notifWsRef.current = null;
        }
        if (!disposed) {
          if (notifReconnectTimerRef.current) clearTimeout(notifReconnectTimerRef.current);
          notifReconnectTimerRef.current = setTimeout(connectNotifSocket, 2500);
        }
      };

      sock.onerror = () => {
        // handled cleanly by onclose reconnect
      };
    };

    connectNotifSocket();

    return () => {
      disposed = true;
      if (notifReconnectTimerRef.current) {
        clearTimeout(notifReconnectTimerRef.current);
        notifReconnectTimerRef.current = null;
      }
      if (notifWsRef.current) {
        try {
          notifWsRef.current.close();
        } catch {
          // ignore
        }
        notifWsRef.current = null;
      }
    };
  }, [handleIncomingFriendEvent, persistProgression, syncPendingFriendRequestsFromServer]);

  // Refresh WebSocket friend subscription whenever identity or friend list updates
  useEffect(() => {
    const sock = notifWsRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) return;
    sock.send(
      JSON.stringify({
        type: 'subscribe_notifications',
        playerId: player1.id,
        friendCode: progression.friendCode,
        name: player1.name,
        friends: progression.friends.map((f) => ({
          id: f.id,
          friendCode: f.friendCode,
          name: f.name,
        })),
        sinceTimestamp: Date.now() - 10000,
      })
    );
  }, [player1.id, player1.name, progression.friendCode, progression.friends]);

  // Firestore real-time friend activity listener when signed in with verified Google account
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || progression.friends.length === 0) {
      return;
    }
    return subscribeFriendProfilesInFirestore({
      user: firebaseUser,
      friends: progression.friends,
      onFriendActivity: handleIncomingFriendEvent,
    });
  }, [firebaseUser, progression.friends, handleIncomingFriendEvent]);

  useEffect(() => {
    progressionRef.current = progression;
  }, [progression]);

  useEffect(() => {
    player1Ref.current = player1;
  }, [player1]);

  useEffect(() => {
    player2Ref.current = player2;
  }, [player2]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  useEffect(() => {
    const viewName = screen === 'lobby' ? `lobby_${activeTab}` : screen;
    trackScreenView(viewName);
  }, [screen, activeTab]);
  useEffect(() => {
    minigameTypeRef.current = minigameType;
  }, [minigameType]);

  useEffect(() => {
    xoxStateRef.current = xoxState;
  }, [xoxState]);

  useEffect(() => {
    currentRoundIndexRef.current = currentRoundIndex;
  }, [currentRoundIndex]);

  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);

  // Handle ?autostart=1, ?demo_victory=1, and ?room=CODE invite links
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let hasSavedProfile = false;
      try {
        const saved = localStorage.getItem('football_user_profile');
        if (saved) {
          hasSavedProfile = true;
          const parsed = JSON.parse(saved);
          setPlayer1((prev) => ({
            ...prev,
            id: sessionPlayerIdRef.current,
            name: parsed.name || prev.name,
            avatar: parsed.avatar || prev.avatar,
            favoriteClubId: parsed.favoriteClubId || prev.favoriteClubId,
            accountStats: parsed.accountStats || prev.accountStats,
          }));
        }
      } catch {
        // ignore
      }

      const urlParams = new URLSearchParams(window.location.search);
      const inviteRoom = urlParams.get('room');
      const inviteTournament = urlParams.get('tournament');
      const challengeCode = urlParams.get('challenge');
      if (challengeCode && challengeCode.trim().length > 4) {
        const decoded = decodeFriendChallengeCode(challengeCode.trim());
        if (decoded) {
          const players = resolveChallengePlayers(decoded.playerIds);
          if (players.length === 5) {
            setActiveFriendChallenge(decoded);
            setSpecialEventLineup(players);
            setSpecialEventMode('friend_challenge');
            setShowSpecialEventModal(true);
            if (hasSavedProfile) {
              setScreen('lobby');
            }
          }
        }
      }
      if (inviteRoom && inviteRoom.trim().length >= 3) {
        const cleanCode = inviteRoom.trim().toUpperCase();
        setPendingInviteRoom(cleanCode);
        if (hasSavedProfile) {
          setScreen('lobby');
        }
      } else if (inviteTournament && inviteTournament.trim().length >= 3) {
        const cleanT = inviteTournament.trim().toUpperCase();
        setPendingInviteTournament(cleanT);
        if (hasSavedProfile) {
          setScreen('lobby');
        }
      } else if (urlParams.get('autostart') === '1') {
        startBotMatch('medium', 'two_clubs');
      } else if (urlParams.get('demo_victory') === '1') {
        suppressDemoAutoRecordRef.current = true;
        setLastMatchRewards({ earnedPoints: 229, earnedCoins: 100 });
        setPlayer1({
          id: sessionPlayerIdRef.current,
          name: 'Futbol Gurmesi',
          avatar: '⚽',
          score: 3,
        });
        setPlayer2({ id: 'bot_ai', name: 'Şampiyon', avatar: '🏆', score: 1 });
        setPlayer1Stats({
          fastestAnswerSec: 2.1,
          totalCorrect: 3,
          totalWrongAttempts: 0,
          currentStreak: 2,
          maxStreak: 2,
          clutchAnswers: 1,
          trailedThenWon: true,
        });
        setPlayer2Stats({
          fastestAnswerSec: 4.8,
          totalCorrect: 1,
          totalWrongAttempts: 2,
          currentStreak: 0,
          maxStreak: 1,
          clutchAnswers: 0,
          trailedThenWon: false,
        });
        setMatchHighlights([
          {
            roundNumber: 1,
            minigameType: 'two_clubs',
            winnerPlayerId: 'bot_ai',
            winnerName: 'Şampiyon',
            acceptedAnswer: 'Wesley Sneijder',
            elapsedSec: 4.8,
            wasClutch: false,
            reason: 'scored',
            scoreAfter: { p1: 0, p2: 1 },
          },
          {
            roundNumber: 2,
            minigameType: 'two_clubs',
            winnerPlayerId: sessionPlayerIdRef.current,
            winnerName: 'Futbol Gurmesi',
            acceptedAnswer: 'Didier Drogba',
            elapsedSec: 3.4,
            wasClutch: false,
            reason: 'scored',
            scoreAfter: { p1: 1, p2: 1 },
          },
          {
            roundNumber: 3,
            minigameType: 'two_clubs',
            winnerPlayerId: sessionPlayerIdRef.current,
            winnerName: 'Futbol Gurmesi',
            acceptedAnswer: 'Arda Turan',
            elapsedSec: 2.1,
            wasClutch: false,
            reason: 'scored',
            scoreAfter: { p1: 2, p2: 1 },
          },
          {
            roundNumber: 4,
            minigameType: 'two_clubs',
            winnerPlayerId: sessionPlayerIdRef.current,
            winnerName: 'Futbol Gurmesi',
            acceptedAnswer: 'Lukas Podolski',
            elapsedSec: 12.6,
            wasClutch: true,
            reason: 'scored',
            scoreAfter: { p1: 3, p2: 1 },
          },
        ]);
        setScreen('game_over');
      }
    }
  }, []);

  const mergeCloudAndLocalProgression = useCallback(
    (localProg: UserProgression, remoteProg: UserProgression): UserProgression => {
      // Firestore (remoteProg) is strictly authoritative for coins, unlocked items, VIP, and weekly points
      // so manual localStorage edits can never inject permanent coins, items, or league points.
      const authoritativeUnlocked = Array.from(
        new Set((remoteProg.unlockedGiftIds || []).filter((id): id is string => typeof id === 'string'))
      );
      const mergedClaimedAchievements = Array.from(
        new Set([
          ...(remoteProg.claimedAchievements || []),
          ...(localProg.claimedAchievements || []),
        ].filter((id): id is string => typeof id === 'string'))
      );
      const mergedUnlockedAchievements = Array.from(
        new Set([
          ...(remoteProg.unlockedAchievements || []),
          ...(localProg.unlockedAchievements || []),
          ...mergedClaimedAchievements,
        ].filter((id): id is string => typeof id === 'string'))
      );
      const mergedModeWinCounts = {
        two_clubs: Math.max(
          remoteProg.modeWinCounts?.two_clubs ?? 0,
          localProg.modeWinCounts?.two_clubs ?? 0
        ),
        xox: Math.max(remoteProg.modeWinCounts?.xox ?? 0, localProg.modeWinCounts?.xox ?? 0),
        career: Math.max(
          remoteProg.modeWinCounts?.career ?? 0,
          localProg.modeWinCounts?.career ?? 0
        ),
        country_club: Math.max(
          remoteProg.modeWinCounts?.country_club ?? 0,
          localProg.modeWinCounts?.country_club ?? 0
        ),
      };
      const linkedMap = new Map(
        [...(localProg.linkedAccounts || []), ...(remoteProg.linkedAccounts || [])].map((a) => [
          a.provider,
          a,
        ])
      );
      const friendMap = new Map(
        [...(localProg.friends || []), ...(remoteProg.friends || [])].map((f) => [f.id, f])
      );
      const friendIdsSet = new Set(Array.from(friendMap.values()).map((f) => f.id));
      const outgoingMap = new Map(
        [
          ...(remoteProg.outgoingFriendRequests || []),
          ...(localProg.outgoingFriendRequests || []),
        ]
          .filter((r) => r && r.status === 'pending' && (!r.toPlayerId || !friendIdsSet.has(r.toPlayerId)))
          .map((r) => [r.id, r])
      );
      const incomingMap = new Map(
        [
          ...(remoteProg.incomingFriendRequests || []),
          ...(localProg.incomingFriendRequests || []),
        ]
          .filter((r) => r && r.status === 'pending' && !friendIdsSet.has(r.fromPlayerId))
          .map((r) => [r.id, r])
      );
      const todayEnergyKey = syncProgressionForToday(
        remoteProg,
        getAuthoritativeServerDate()
      ).energyLastResetDate;
      const remoteHasTodayEnergy = remoteProg.energyLastResetDate === todayEnergyKey;
      const authoritativeDailyEnergy = remoteHasTodayEnergy
        ? Math.max(0, remoteProg.dailyEnergy ?? MAX_DAILY_ENERGY)
        : MAX_DAILY_ENERGY;

      return syncProgressionForToday(
        {
          ...remoteProg,
          coins: Math.max(0, Math.round(remoteProg.coins ?? 0)),
          weeklyPoints: Math.max(0, Math.round(remoteProg.weeklyPoints ?? 0)),
          totalPoints: Math.max(0, Math.round(remoteProg.totalPoints ?? 0)),
          matchesPlayed: Math.max(0, Math.round(remoteProg.matchesPlayed ?? 0)),
          wins: Math.max(0, Math.round(remoteProg.wins ?? 0)),
          losses: Math.max(0, Math.round(remoteProg.losses ?? 0)),
          bestWinStreak: Math.max(0, Math.round(remoteProg.bestWinStreak ?? 0)),
          totalCorrectAnswers: Math.max(0, Math.round(remoteProg.totalCorrectAnswers ?? 0)),
          clutchAnswers: Math.max(0, Math.round(remoteProg.clutchAnswers ?? 0)),
          energyDrinks: Math.max(0, Math.round(remoteProg.energyDrinks ?? 0)),
          leagueShields: Math.max(0, Math.round(remoteProg.leagueShields ?? 0)),
          extraTimeCards: Math.max(0, Math.round(remoteProg.extraTimeCards ?? 0)),
          leagueTierId: remoteProg.leagueTierId ?? 'amateur',
          dailyEnergy: authoritativeDailyEnergy,
          energyLastResetDate: todayEnergyKey,
          freeJokerTickets: Math.max(0, Math.round(remoteProg.freeJokerTickets ?? 0)),
          dailyChallengeHistory: {
            ...(localProg.dailyChallengeHistory || {}),
            ...(remoteProg.dailyChallengeHistory || {}),
          },
          dailyChallengeLastPlayedAt:
            Math.max(
              localProg.dailyChallengeLastPlayedAt ?? 0,
              remoteProg.dailyChallengeLastPlayedAt ?? 0
            ) || undefined,
          wheelLastFreeSpinDate:
            remoteProg.wheelLastFreeSpinDate || localProg.wheelLastFreeSpinDate,
          wheelLastFreeSpinAt:
            Math.max(
              localProg.wheelLastFreeSpinAt ?? 0,
              remoteProg.wheelLastFreeSpinAt ?? 0
            ) || undefined,
          wheelAdSpinsDate:
            remoteProg.wheelAdSpinsDate === todayEnergyKey
              ? todayEnergyKey
              : localProg.wheelAdSpinsDate,
          wheelAdSpinsUsed:
            remoteProg.wheelAdSpinsDate === todayEnergyKey
              ? Math.max(0, remoteProg.wheelAdSpinsUsed ?? 0)
              : 0,
          multiplier2xMatches: Math.max(0, Math.round(remoteProg.multiplier2xMatches ?? 0)),
          adFree: Boolean(remoteProg.adFree),
          permanentMultiplier2x: Boolean(remoteProg.permanentMultiplier2x),
          socialBonusClaimed: Boolean(remoteProg.socialBonusClaimed),
          unlockedGiftIds: authoritativeUnlocked,
          unlockedAchievements: mergedUnlockedAchievements,
          claimedAchievements: mergedClaimedAchievements,
          modeWinCounts: mergedModeWinCounts,
          linkedAccounts: Array.from(linkedMap.values()),
          friends: Array.from(friendMap.values()),
          outgoingFriendRequests: Array.from(outgoingMap.values()),
          incomingFriendRequests: Array.from(incomingMap.values()),
          equippedTitle: remoteProg.equippedTitle,
          equippedCrest: remoteProg.equippedCrest,
          equippedFrame: remoteProg.equippedFrame,
          equippedPitchTheme: remoteProg.equippedPitchTheme,
          equippedGoalEffect: remoteProg.equippedGoalEffect,
          equippedBadge: remoteProg.equippedBadge,
          tournamentWins: Math.max(0, Math.round(remoteProg.tournamentWins ?? 0)),
          tournamentsPlayed: Math.max(0, Math.round(remoteProg.tournamentsPlayed ?? 0)),
        },
        getAuthoritativeServerDate()
      );
    },
    []
  );

  useEffect(() => {
    void initializeAdMob();
    void processAuthRedirectResult().then(() => ensureAnonymousFirebaseSession());
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      setIsNetworkOnline(true);
      setOnlineError((prev) =>
        prev && prev.includes('İnternet bağlantısı yok') ? null : prev
      );
    };
    const handleOffline = () => {
      setIsNetworkOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (screen !== 'lobby' || typeof window === 'undefined') return;
    if (suppressDemoAutoRecordRef.current) return;
    try {
      const done = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
      if (!done) {
        setShowOnboardingModal(true);
      }
    } catch {
      // ignore
    }
  }, [screen]);

  // Re-calibrate Firebase serverTimestamp() clock on window focus/visibility change
  useEffect(() => {
    if (typeof window === 'undefined' || !firebaseUser) return;
    void syncServerClockWithFirestore(firebaseUser);
    const resyncClock = () => {
      if (document.visibilityState === 'visible') {
        void syncServerClockWithFirestore(firebaseUser);
      }
    };
    window.addEventListener('focus', resyncClock);
    document.addEventListener('visibilitychange', resyncClock);
    const unsubUser = subscribeUserAuthoritativeBackup({
      userId: firebaseUser.uid,
      onBackup: (backup) => {
        const authoritative = mergeCloudAndLocalProgression(
          progressionRef.current,
          backup.progression
        );
        persistProgression(authoritative);
      },
    });
    return () => {
      window.removeEventListener('focus', resyncClock);
      document.removeEventListener('visibilitychange', resyncClock);
      unsubUser();
    };
  }, [firebaseUser, mergeCloudAndLocalProgression, persistProgression]);

  // Firebase Auth session listener + initial Firestore cloud backup sync/restore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user || user.isAnonymous || !user.emailVerified) {
        if (!user || user.isAnonymous) cloudLoadedUidRef.current = null;
        return;
      }
      if (cloudLoadedUidRef.current === user.uid) return;
      cloudLoadedUidRef.current = user.uid;

      setIsSyncingCloud(true);
      try {
        const remote = await loadUserBackupFromFirestore(user.uid);
        let mergedProg = progressionRef.current;
        let nextProfile = player1Ref.current;

        if (remote) {
          mergedProg = mergeCloudAndLocalProgression(mergedProg, remote.progression);
          if (
            remote.displayName &&
            (nextProfile.name === 'Futbol Gurmesi' ||
              (remote.progression.totalPoints ?? 0) > (progressionRef.current.totalPoints ?? 0))
          ) {
            nextProfile = {
              ...nextProfile,
              name: remote.displayName,
              avatar: remote.avatar || nextProfile.avatar,
              favoriteClubId: remote.favoriteClubId || nextProfile.favoriteClubId,
            };
            setPlayer1(nextProfile);
            try {
              localStorage.setItem('football_user_profile', JSON.stringify(nextProfile));
            } catch {
              // ignore
            }
          }
        }

        const googleHandle = user.email || user.displayName || 'Google Hesabı';
        const linkRes = linkSocialAccount(mergedProg, 'google', googleHandle);
        if (linkRes.ok) {
          mergedProg = linkRes.progression;
        }
        persistProgression(mergedProg);

        await saveUserBackupToFirestore({
          user,
          profile: nextProfile,
          progression: mergedProg,
          favoriteClubId: nextProfile.favoriteClubId,
        });
        savePublicProfileToFirestore({
          user,
          profile: nextProfile,
          progression: mergedProg,
        }).catch(() => {});

        if (nextProfile.name && nextProfile.name !== 'Futbol Gurmesi') {
          await claimUsernameInFirestore({
            user,
            displayName: nextProfile.name,
          }).catch(() => {});
          fetch('/api/accounts/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: sessionPlayerIdRef.current,
              profile: nextProfile,
              progression: mergedProg,
              googleUid: user.uid,
            }),
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Cloud backup sync failed:', err);
      } finally {
        setIsSyncingCloud(false);
      }
    });

    return () => unsubscribe();
  }, [mergeCloudAndLocalProgression, persistProgression]);

  // Restore saved account from server if local storage missed profile
  useEffect(() => {
    const accountId = sessionPlayerIdRef.current;
    if (!accountId) return;
    fetch(`/api/accounts/by-id/${encodeURIComponent(accountId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.ok || !data?.account) return;
        const acc = data.account;
        const mergedProg = mergeCloudAndLocalProgression(progressionRef.current, acc.progression);
        persistProgression(mergedProg);
        if (
          acc.profile?.name &&
          (player1Ref.current.name === 'Futbol Gurmesi' ||
            (acc.progression?.totalPoints ?? 0) > (progressionRef.current.totalPoints ?? 0))
        ) {
          const restoredProfile: PlayerProfile = {
            ...player1Ref.current,
            ...acc.profile,
            id: acc.accountId,
          };
          setPlayer1(restoredProfile);
          try {
            localStorage.setItem('football_user_profile', JSON.stringify(restoredProfile));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});
  }, [mergeCloudAndLocalProgression, persistProgression]);

  // Debounced auto-backup to persistent backend store
  useEffect(() => {
    if (!player1.name || player1.name === 'Futbol Gurmesi') return;
    if (serverAccountSaveTimerRef.current) clearTimeout(serverAccountSaveTimerRef.current);
    serverAccountSaveTimerRef.current = setTimeout(() => {
      fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: sessionPlayerIdRef.current,
          profile: player1Ref.current,
          progression: progressionRef.current,
          googleUid: firebaseUser?.uid,
        }),
      }).catch(() => {});
    }, 650);
  }, [progression, player1.name, player1.avatar, player1.favoriteClubId, firebaseUser]);

  // Debounced auto-backup to Firestore when authenticated
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || !firebaseUser.email) return;
    if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    cloudSaveTimerRef.current = setTimeout(() => {
      saveUserBackupToFirestore({
        user: firebaseUser,
        profile: player1Ref.current,
        progression: progressionRef.current,
        favoriteClubId: player1Ref.current.favoriteClubId,
      }).catch((err) => {
        console.warn('Auto cloud backup error:', err);
      });
      savePublicProfileToFirestore({
        user: firebaseUser,
        profile: player1Ref.current,
        progression: progressionRef.current,
      }).catch(() => {});
    }, 850);
  }, [firebaseUser, progression, player1.name, player1.avatar, player1.favoriteClubId]);

  const syncServerLeaderboard = useCallback(
    async (
      progToSync: UserProgression,
      profileToSync: PlayerProfile,
      options?: { suppressAutoHighScore?: boolean }
    ) => {
      // 1. Sync live profile/stats directly to Firebase Realtime Database (`leaderboard/{playerId}`)
      void syncPlayerToRtdbLeaderboard(progToSync, profileToSync);
      const rtdbPlayers = await fetchRtdbLeaderboard();
      if (rtdbPlayers.length > 0) {
        setLiveLeaderboardPlayers(rtdbPlayers);
      }

      // 2. Also sync legacy server endpoint when running under local Node Express dev server
      if (
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        window.location.protocol !== 'capacitor:'
      ) {
        try {
          const res = await fetch('/api/leaderboard/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: profileToSync.id,
              friendCode: progToSync.friendCode,
              name: profileToSync.name,
              avatar: profileToSync.avatar,
              favoriteClubId: profileToSync.favoriteClubId,
              weeklyPoints: progToSync.weeklyPoints,
              totalPoints: progToSync.totalPoints,
              subtitle: progToSync.equippedTitle,
              equippedCrest: progToSync.equippedCrest,
              equippedFrame: progToSync.equippedFrame,
              equippedBadge: progToSync.equippedBadge,
              hasCrown: progToSync.unlockedGiftIds.includes('gift_title_legend'),
              matchesPlayed: progToSync.matchesPlayed,
              wins: progToSync.wins,
              losses: progToSync.losses,
              winStreak: progToSync.winStreak,
              bestWinStreak: progToSync.bestWinStreak,
              totalCorrectAnswers: progToSync.totalCorrectAnswers,
              totalWrongAttempts: progToSync.totalWrongAttempts,
              fastestAnswerSec: progToSync.fastestAnswerSec,
              clutchAnswers: progToSync.clutchAnswers,
              minigameMatchCounts: progToSync.minigameMatchCounts,
              dailyStreakDays: progToSync.dailyLogin?.streakDays ?? 0,
              tournamentWins: progToSync.tournamentWins ?? 0,
              tournamentsPlayed: progToSync.tournamentsPlayed ?? 0,
              suppressAutoHighScore: options?.suppressAutoHighScore,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.players) && rtdbPlayers.length === 0) {
              setLiveLeaderboardPlayers(data.players);
            }
          }
        } catch {
          // Offline / static hosting fallback
        }
      }
    },
    []
  );

  const fetchServerLeaderboard = useCallback(async () => {
    const rtdbPlayers = await fetchRtdbLeaderboard();
    if (rtdbPlayers.length > 0) {
      setLiveLeaderboardPlayers(rtdbPlayers);
      return;
    }
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      window.location.protocol !== 'capacitor:'
    ) {
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.players)) {
            setLiveLeaderboardPlayers(data.players);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Refresh daily state + fetch live leaderboard when entering lobby or switching to League/Stats
  useEffect(() => {
    if (screen === 'lobby') {
      const synced = syncProgressionForToday(progression);
      if (synced !== progression) {
        persistProgression(synced);
      }
      fetchServerLeaderboard();
      syncServerLeaderboard(synced, player1Ref.current);
      syncPendingFriendRequestsFromServer();

      if (!dailyAutoOpenedRef.current && !pendingInviteRoom && !pendingInviteTournament) {
        dailyAutoOpenedRef.current = true;
        if (canClaimDailyReward(synced)) {
          setShowDailyModal(true);
        }
      }
      if (pendingInviteTournament) {
        setShowTournamentModal(true);
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [screen]);

  useEffect(() => {
    if (screen === 'lobby' && (activeTab === 'league' || activeTab === 'stats')) {
      fetchServerLeaderboard();
      return subscribeRtdbLeaderboard((players) => {
        setLiveLeaderboardPlayers(players);
      });
    }
  }, [screen, activeTab, fetchServerLeaderboard]);

  // Record match outcome & advance active tournament bracket exactly once when reaching game_over
  useEffect(() => {
    if (screen !== 'game_over') return;
    if (suppressDemoAutoRecordRef.current) {
      suppressDemoAutoRecordRef.current = false;
      return;
    }
    if (recordedMatchInstanceRef.current === matchInstanceIdRef.current) return;
    recordedMatchInstanceRef.current = matchInstanceIdRef.current;

    const prevWeeklyPoints = progression.weeklyPoints;
    const prevTotalPoints = progression.totalPoints;
    const p1Score = player1.score;
    const p2Score = player2.score;
    const isDraw = p1Score === p2Score;
    const won = p1Score > p2Score;
trackGameEvent('match_complete', {
      mode,
      minigame: minigameType,
      won,
      p1_score: p1Score,
      p2_score: p2Score,
    });
    const outcome = recordMatchOutcome(progression, {
      won,
      isDraw,
      minigameType,
      stats: player1Stats,
    });

    setV3QuestsState((prev) =>
      recordV3QuestMatchEnd(
        { won, fastestAnswerSec: player1Stats.fastestAnswerSec },
        prev
      )
    );
    if (won) {
      const passRes = awardFootballPassXp(PASS_XP_MATCH_WIN);
      setPassState(passRes.state);
      soundManager.playVictoryFanfare();
    }

    let finalProgression = outcome.progression;
    let totalEarnedPoints = outcome.earnedPoints;
    let totalEarnedCoins = outcome.earnedCoins;
    let becameTournamentChampion = false;

    const achievedComboLevel = maxFastComboRef.current >= 2 ? maxFastComboRef.current : 0;
    const comboBonusCoins = computeSpeedComboBonusCoins(achievedComboLevel);
    if (comboBonusCoins > 0) {
      finalProgression = grantExtraRewards(finalProgression, comboBonusCoins, 0);
      totalEarnedCoins += comboBonusCoins;
    }

    const matchDurationSec = Math.max(1, (Date.now() - matchStartedAtRef.current) / 1000);
    const updatedCareerStats = recordCareerMatchStats({
      won,
      matchDurationSec,
      progression: finalProgression,
    });
    setCareerStats(updatedCareerStats);

    if (isTournamentMatchRef.current && activeTournament && activeTournament.status === 'active') {
      isTournamentMatchRef.current = false;
      returnToTournamentAfterVictoryRef.current = true;
      const updatedBracket = advanceTournamentAfterMatch(
        activeTournament,
        player1.id,
        won
      );
      setActiveTournament(updatedBracket);
      if (updatedBracket.status === 'won') {
        becameTournamentChampion = true;
        const bonusPts = updatedBracket.mode === 'open_cup' ? TOURNAMENT_OPEN_PRIZE_POINTS : 200;
        finalProgression = awardTournamentChampionPrize(
          finalProgression,
          updatedBracket.prizeCoins,
          bonusPts
        );
        totalEarnedCoins += updatedBracket.prizeCoins;
        totalEarnedPoints += bonusPts;
      }
    }

    const matchAchRes = recordAchievementMatchOutcome(
      {
        won,
        durationSec: player1Stats.fastestAnswerSec ?? undefined,
        progression: finalProgression,
      },
      achievementsStateRef.current
    );
    updateAchievementsState(matchAchRes.state);
    notifyUnlockedAchievements(matchAchRes.newlyUnlocked);
    finalProgression = applyAchievementsToProgression(finalProgression, matchAchRes.state);

    // Realistic bot/local simulation: bot opponent may send a friend request after a match
    if (
      mode === 'bot' &&
      player2.id &&
      player2.id !== 'p2' &&
      !finalProgression.friends.some(
        (f) => f.id === player2.id || f.name.toLowerCase() === player2.name.toLowerCase()
      ) &&
      !(finalProgression.incomingFriendRequests ?? []).some(
        (r) =>
          r.status === 'pending' &&
          (r.fromPlayerId === player2.id || r.fromName.toLowerCase() === player2.name.toLowerCase())
      ) &&
      !(finalProgression.outgoingFriendRequests ?? []).some(
        (r) =>
          r.status === 'pending' &&
          (r.toPlayerId === player2.id || r.toName.toLowerCase() === player2.name.toLowerCase())
      )
    ) {
      const botCodeNum =
        (Array.from(player2.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 9000) + 1000;
      const botReq: FriendRequestEntry = {
        id: `fr_bot_${player2.id}_${matchInstanceIdRef.current}`,
        fromPlayerId: player2.id,
        fromFriendCode: `BOT${botCodeNum}`,
        fromName: player2.name,
        fromAvatar: player2.avatar || '🤖',
        toPlayerId: player1.id,
        toFriendCode: finalProgression.friendCode,
        toName: player1.name,
        toAvatar: player1.avatar,
        weeklyPoints: Math.max(140, Math.round(totalEarnedPoints * 1.4)),
        totalPoints: Math.max(680, Math.round((finalProgression.totalPoints || 500) * 0.85)),
        subtitle: won ? 'Rövanş İsteyen Rakip' : 'İyi Maçtı • Arkadaş Olalım',
        status: 'pending',
        isBot: true,
        createdAt: Date.now(),
      };
      const beforeBotReqCount = getPendingIncomingRequestCount(finalProgression);
      finalProgression = receiveIncomingFriendRequest(finalProgression, botReq);
      if (getPendingIncomingRequestCount(finalProgression) > beforeBotReqCount) {
        sounds.playNotification();
      }
    }

    persistProgression(finalProgression);
    setLastMatchEnergyDeltaLabel(
      hasUnlimitedEnergy(finalProgression)
        ? '⚡ ∞ Sınırsız Enerji'
        : won || isDraw
        ? '⚡ +1 Enerji İade Edildi'
        : '⚡ -1 Enerji Harcandı'
    );
    setLastMatchRewards({
      earnedPoints: totalEarnedPoints,
      earnedCoins: totalEarnedCoins,
      multiplierApplied: outcome.multiplierApplied,
      doubledByAd: false,
      shieldProtected: outcome.shieldProtected,
      comboLevel: achievedComboLevel,
      comboBonusCoins,
    });

    const hsMilestone = detectHighScoreMilestone({
      prevTotalPoints,
      prevWeeklyPoints,
      nextTotalPoints: finalProgression.totalPoints,
      nextWeeklyPoints: finalProgression.weeklyPoints,
      matchScoreEarned: totalEarnedPoints,
      won,
      isTournamentChampion: becameTournamentChampion,
    });

    syncServerLeaderboard(finalProgression, player1, {
      suppressAutoHighScore: hsMilestone.isHighScore,
    });

    if (hsMilestone.isHighScore) {
      const eventId = `hs_${player1.id}_${Math.round(hsMilestone.scoreValue)}_${matchInstanceIdRef.current}`;
      fetch('/api/activity/high-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          actorId: player1.id,
          actorFriendCode: finalProgression.friendCode,
          actorName: player1.name,
          actorAvatar: player1.avatar,
          scoreValue: hsMilestone.scoreValue,
          summary: hsMilestone.summary,
        }),
      }).catch(() => {});

      publishActivityToFirestore({
        user: firebaseUser,
        profile: player1,
        progression: finalProgression,
        activity: {
          id: eventId,
          type: 'high_score',
          title: hsMilestone.summary,
          score: hsMilestone.scoreValue,
        },
      }).catch(() => {});
    }
  }, [screen]);

  const closeOnlineSocket = () => {
    if (cancelRtdbMatchmakingRef.current) {
      try {
        cancelRtdbMatchmakingRef.current();
      } catch {
        // ignore
      }
      cancelRtdbMatchmakingRef.current = null;
    }
    if (rtdbHostTickTimerRef.current) {
      clearInterval(rtdbHostTickTimerRef.current);
      rtdbHostTickTimerRef.current = null;
    }
    if (rtdbHostNextTimerRef.current) {
      clearTimeout(rtdbHostNextTimerRef.current);
      rtdbHostNextTimerRef.current = null;
    }
    if (unsubRtdbRoomRef.current) {
      try {
        unsubRtdbRoomRef.current();
      } catch {
        // ignore
      }
      unsubRtdbRoomRef.current = null;
    }
    if (activeRtdbRoomCodeRef.current) {
      const codeToClean = activeRtdbRoomCodeRef.current;
      activeRtdbRoomCodeRef.current = null;
      void cleanupRtdbRoom(codeToClean);
    }
    rtdbRoomPhaseKeyRef.current = '';
    rtdbWrongPulseSeqRef.current = 0;

    if (wsRef.current) {
      const sock = wsRef.current;
      wsRef.current = null;
      try {
        sock.onopen = null;
        sock.onmessage = null;
        sock.onerror = null;
        sock.onclose = null;
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify({ type: 'leave_room' }));
        }
        sock.close();
      } catch {
        // ignore
      }
    }
  };

  const handleIntroEnter = () => {
    let hasProfile = false;
    try {
      const saved = localStorage.getItem('football_user_profile');
      if (saved) hasProfile = true;
    } catch {
      // ignore
    }

    if (!hasProfile) {
      setShowAuthModal(true);
    } else {
      setScreen('lobby');
    }
  };

  const handleSaveProfile = (newProfile: PlayerProfile) => {
    const withSessionId = { ...newProfile, id: sessionPlayerIdRef.current };
    setPlayer1(withSessionId);
    try {
      localStorage.setItem('football_account_id', sessionPlayerIdRef.current);
      localStorage.setItem('football_user_profile', JSON.stringify(withSessionId));
    } catch {
      // ignore
    }
    setShowAuthModal(false);
    setScreen('lobby');
    syncServerLeaderboard(progressionRef.current, withSessionId);
  };

  const handlePromptExitMatch = () => {
    setExitTarget('lobby');
    setShowExitConfirm(true);
  };

  const handlePromptExitApp = () => {
    setExitTarget('intro');
    setShowExitConfirm(true);
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (nextRoundTimeoutRef.current) {
      clearTimeout(nextRoundTimeoutRef.current);
      nextRoundTimeoutRef.current = null;
    }
    closeOnlineSocket();
    setIsRoundPlaying(false);
    setShowResultSheet(false);
    setOnlineRound(null);
    setXoxState(null);
    setXoxNotice(null);
    setRematchState('idle');
    if (exitTarget === 'intro' && typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      void CapacitorApp.exitApp().catch(() => {});
      return;
    }
    setScreen(exitTarget);
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
  };

  const notifyUnlockedAchievements = useCallback((unlocked: CareerAchievementDef[]) => {
    if (unlocked.length === 0) return;
    setAchievementToast(unlocked[0]);
    soundManager.playCoinJingle();
    haptics.correct();
  }, []);

  useEffect(() => {
    if (!achievementToast) return;
    const t = setTimeout(() => setAchievementToast(null), 4500);
    return () => clearTimeout(t);
  }, [achievementToast]);

  useEffect(() => {
    const res = syncAchievementsFromProgression(progression, achievementsStateRef.current);
    updateAchievementsState(res.state);
    if (res.newlyUnlocked.length > 0) {
      notifyUnlockedAchievements(res.newlyUnlocked);
      const syncedProg = applyAchievementsToProgression(progressionRef.current, res.state);
      if (syncedProg !== progressionRef.current) {
        persistProgression(syncedProg);
      }
    }
  }, [progression, notifyUnlockedAchievements, persistProgression, updateAchievementsState]);

  const handleClaimAchievementReward = (achievementId: string) => {
    const alreadyClaimedInProg =
      progressionRef.current.claimedAchievements?.includes(achievementId) ?? false;
    if (alreadyClaimedInProg || achievementsStateRef.current.claimedIds.includes(achievementId)) {
      return;
    }
    const res = claimAchievementReward(achievementId, achievementsStateRef.current);
    updateAchievementsState(res.state);
    if (!res.claimed || res.rewardCoins <= 0) return;
    soundManager.playCoinJingle();
    haptics.correct();
    const rewarded = grantExtraRewards(progressionRef.current, res.rewardCoins, 0);
    const updated = applyAchievementsToProgression(rewarded, res.state);
    persistProgression(updated);
    syncServerLeaderboard(updated, player1Ref.current);
    if (firebaseUser && firebaseUser.emailVerified && firebaseUser.email) {
      void saveUserBackupToFirestore({
        user: firebaseUser,
        profile: player1Ref.current,
        progression: updated,
        favoriteClubId: player1Ref.current.favoriteClubId,
      }).catch(() => {});
    }
  };

  const toggleSoundMute = () => {
    const newState = soundManager.toggleMute();
    setIsMuted(newState);
  };

  useEffect(() => {
    applyUiTheme(uiTheme);
    saveUiTheme(uiTheme);
  }, [uiTheme]);

  const handleToggleTheme = useCallback(() => {
    setUiTheme((prev) => (prev === 'klasik' ? 'modern' : 'klasik'));
  }, []);

  const hardwareBackRef = useRef<() => void>(() => {});
  useEffect(() => {
    hardwareBackRef.current = () => {
      if (showExitConfirm) {
        setShowExitConfirm(false);
        return;
      }
      if (pendingFriendTarget) {
        setPendingFriendTarget(null);
        return;
      }
      if (inspectedProfile) {
        setInspectedProfile(null);
        return;
      }
      if (pendingAdReward) {
        setPendingAdReward(null);
        return;
      }
      if (showSettingsModal) {
        setShowSettingsModal(false);
        return;
      }
      if (showOnboardingModal) {
        setShowOnboardingModal(false);
        return;
      }
      if (showAuthModal && screen !== 'intro') {
        setShowAuthModal(false);
        return;
      }
      if (showStoreModal) {
        setShowStoreModal(false);
        return;
      }
      if (showTournamentModal) {
        setShowTournamentModal(false);
        return;
      }
      if (showEnergyModal) {
        setShowEnergyModal(false);
        return;
      }
      if (showDailyWheelModal) {
        setShowDailyWheelModal(false);
        return;
      }
      if (showDailyChallengeModal) {
        setShowDailyChallengeModal(false);
        return;
      }
      if (showDailyModal) {
        setShowDailyModal(false);
        return;
      }
      if (showAchievementsModal) {
        setShowAchievementsModal(false);
        return;
      }
      if (showFootballPassModal) {
        setShowFootballPassModal(false);
        return;
      }
      if (showV3QuestsModal) {
        setShowV3QuestsModal(false);
        return;
      }
      if (showStreakSaverModal) {
        setShowStreakSaverModal(false);
        return;
      }
      if (showLastChanceModal) {
        setShowLastChanceModal(false);
        return;
      }
      if (showSpecialEventModal) {
        setShowSpecialEventModal(false);
        return;
      }
      if (screen === 'playing') {
        setExitTarget('lobby');
        setShowExitConfirm(true);
        return;
      }
      if (screen === 'room_waiting' || screen === 'game_over') {
        handleExitToLobby();
        return;
      }
      if (screen === 'lobby') {
        if (activeTab !== 'play') {
          setActiveTab('play');
          return;
        }
        setExitTarget('intro');
        setShowExitConfirm(true);
      }
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | null = null;
    void CapacitorApp.addListener('backButton', () => {
      hardwareBackRef.current();
    })
      .then((h) => {
        handle = h;
      })
      .catch(() => {});
    return () => {
      void handle?.remove().catch(() => {});
    };
  }, []);

  const handleUpdateProfile = (partial: Partial<PlayerProfile>) => {
    setPlayer1((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem('football_user_profile', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Start Solo Bot or Tournament Match (non-repeating questions across consecutive matches!)
  const startBotMatch = (
    selectedBotDifficulty: BotDifficulty = 'medium',
    selectedMinigame: MinigameType = 'two_clubs',
    customOpponent?: { id: string; name: string; avatar: string }
  ) => {
    const energyCheck = consumeMatchEntryEnergy(progressionRef.current);
    if (!energyCheck.ok) {
      persistProgression(energyCheck.progression);
      setShowEnergyModal(true);
      return;
    }

    matchInstanceIdRef.current += 1;
    energyChargedMatchInstanceRef.current = matchInstanceIdRef.current;
    lastChanceUsedInMatchRef.current = false;
    bonusReviveTimeRef.current = 0;
    resetMatchComboAndClock();
    persistProgression(energyCheck.progression);
    syncServerLeaderboard(energyCheck.progression, player1Ref.current);
    setLastMatchEnergyDeltaLabel(null);
    setLastMatchRewards(null);
    setMode('bot');
    setBotDiff(selectedBotDifficulty);
    setMinigameType(selectedMinigame);
    minigameTypeRef.current = selectedMinigame;

    const seenIds = getSeenIdsForMinigame(selectedMinigame);
    const generatedRounds = generateMinigameRounds(selectedMinigame, 12, seenIds);
    recordSeenQuestions(
      selectedMinigame,
      generatedRounds.map(getRoundItemId),
      getMinigamePoolSize(selectedMinigame)
    );

    setRounds(generatedRounds);
    roundsRef.current = generatedRounds;
    setCurrentRoundIndex(0);
    currentRoundIndexRef.current = 0;

    const botNames: Record<BotDifficulty, { name: string; avatar: string }> = {
      easy: { name: 'Çırak', avatar: '🌱' },
      medium: { name: 'Şampiyon', avatar: '🏆' },
      hard: { name: 'Efsane', avatar: '👑' },
    };
    const b = customOpponent || {
      id: 'bot_ai',
      name: botNames[selectedBotDifficulty].name,
      avatar: botNames[selectedBotDifficulty].avatar,
    };
    setPlayer2({
      id: b.id,
      name: b.name,
      avatar: b.avatar,
      score: 0,
    });

    setPlayer1((prev) => ({ ...prev, score: 0 }));
    setPlayer1Stats({ ...initialStats });
    setPlayer2Stats({ ...initialStats });
    setMatchHighlights([]);
    setXoxNotice(null);
    setScreen('playing');
trackGameEvent('match_start', { mode: 'bot', minigame: selectedMinigame, difficulty: selectedBotDifficulty });
    runRoundCountdown(0, generatedRounds, selectedMinigame);
  };

  // Sequence for 3-2-1 Countdown before each round
  const runRoundCountdown = (
    roundIdx: number,
    _roundList: MinigameRoundPayload[] = roundsRef.current,
    activeMinigame: MinigameType = minigameTypeRef.current
  ) => {
    setIsRoundPlaying(false);
    setShowResultSheet(false);
    setRoundWinnerPlayer(null);
    setAcceptedAnswerText('');
    setIsTimeExpired(false);
    setRoundEndReason('timeout');
    setOnlineSilhouetteExhausted(false);
    setLastRoundReward(null);
    setRoundDoubledByAd(false);
    pendingNextRoundActionRef.current = null;
    setTimeRemaining(getRoundDurationSeconds(activeMinigame));
    setXoxNotice(null);
    soloXoxTimeoutsRef.current = 0;

    if (activeMinigame === 'xox') {
      const starterId = roundIdx % 2 === 0 ? player1Ref.current.id : 'bot_ai';
      const initialXox: XoxRuntimeState = {
        board: createEmptyXoxBoard(),
        currentTurnPlayerId: starterId,
        turnTimeRemaining: 15,
        winningCells: null,
      };
      setXoxState(initialXox);
      xoxStateRef.current = initialXox;
    } else {
      setXoxState(null);
      xoxStateRef.current = null;
    }

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (nextRoundTimeoutRef.current) {
      clearTimeout(nextRoundTimeoutRef.current);
      nextRoundTimeoutRef.current = null;
    }

    setCountdown(3);

    let currentCount = 3;
    countdownTimerRef.current = setInterval(() => {
      currentCount -= 1;
      setCountdown(currentCount);

      if (currentCount <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        startActiveRound();
      }
    }, 1000);
  };

  // Active round timer (120s for silhouette, 15s for others)
  const startActiveRound = () => {
    const bonusSec = bonusReviveTimeRef.current;
    bonusReviveTimeRef.current = 0;
    const duration = getRoundDurationSeconds(minigameTypeRef.current) + bonusSec;
    roundStartedAtRef.current = Date.now();
    setIsRoundPlaying(true);
    timeRemainingRef.current = duration;
    setTimeRemaining(duration);
    soundManager.playMatchStartWhistle();

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);

    roundTimerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          timeRemainingRef.current = 0;
          handleRoundTimeExpired();
          return 0;
        }
        const next = prev - 1;
        timeRemainingRef.current = next;
        if (next <= 5 && next >= 1) {
          soundManager.playCountdownTick(next);
        }
        return next;
      });
    }, 1000);
  };

  // Web ortamı için geçiş reklamı sunucusunu kaydet
  useEffect(() => {
    setInterstitialPresenter((adUnitId) => {
      return new Promise<void>((resolve) => {
        setInterstitialAdState({ adUnitId, resolve });
      });
    });
    return () => setInterstitialPresenter(null);
  }, []);

  // Her 3 tamamlanan maçta 1 geçiş reklamı (VIP Reklamsız aktifse kesinlikle gösterilmez)
  const transitionToGameOver = useCallback(async () => {
    if (gameOverTransitionInFlightRef.current) return;
    gameOverTransitionInFlightRef.current = true;
    try {
      const completedCount = incrementCompletedMatchAdCount();
      const isVipAdFree = hasUnlimitedEnergy(progressionRef.current);
      if (shouldTriggerInterstitialForMatchCount(completedCount, isVipAdFree)) {
        await showInterstitialAd({ adFree: isVipAdFree });
      }
    } catch {
      // Reklam hatası maç özetine geçişi asla engellememeli
    } finally {
      gameOverTransitionInFlightRef.current = false;
      setScreen('game_over');
    }
  }, []);

  // Transition to next round or victory screen (Target: first to 3 wins, max 10 rounds cap)
  const advanceNextRound = (isMatchFinished: boolean = false) => {
    setShowResultSheet(false);
    const curIdx = currentRoundIndexRef.current;
    const currentList = roundsRef.current;
    const nextIndex = curIdx + 1;

    if (isMatchFinished || nextIndex >= Math.min(10, currentList.length)) {
      const wouldLoseSolo =
        !isOnlineMode &&
        player1Ref.current.score < player2Ref.current.score &&
        !lastChanceUsedInMatchRef.current;
      if (wouldLoseSolo) {
        lastChanceUsedInMatchRef.current = true;
        setShowLastChanceModal(true);
        return;
      }
      void transitionToGameOver();
    } else {
      currentRoundIndexRef.current = nextIndex;
      setCurrentRoundIndex(nextIndex);
      runRoundCountdown(nextIndex, currentList, minigameTypeRef.current);
    }
  };

  const handleLastChanceRevive = () => {
    setShowLastChanceModal(false);
    soundManager.playCorrectCheer();
    haptics.correct();
    // Rakibin 3. golünü geri alıp 1 Can + 15 saniye bonus süre ile sonraki tura devam ettir
    setPlayer2((p) => ({ ...p, score: Math.min(2, p.score) }));
    bonusReviveTimeRef.current = 15;
    const nextIndex = currentRoundIndexRef.current + 1;
    const currentList = roundsRef.current;
    const targetIndex =
      nextIndex < currentList.length ? nextIndex : Math.max(0, currentList.length - 1);
    currentRoundIndexRef.current = targetIndex;
    setCurrentRoundIndex(targetIndex);
    runRoundCountdown(targetIndex, currentList, minigameTypeRef.current);
  };

  const handleLastChanceGiveUp = () => {
    setShowLastChanceModal(false);
    void transitionToGameOver();
  };

  // When round time runs out in Solo mode
  const handleRoundTimeExpired = () => {
    if (minigameTypeRef.current === 'xox' && xoxStateRef.current) {
      soloXoxTimeoutsRef.current += 1;
      if (soloXoxTimeoutsRef.current < 4) {
        const cur = xoxStateRef.current;
        const nextTurnId =
          cur.currentTurnPlayerId === player1Ref.current.id
            ? 'bot_ai'
            : player1Ref.current.id;
        const updated: XoxRuntimeState = {
          ...cur,
          currentTurnPlayerId: nextTurnId,
          turnTimeRemaining: 15,
        };
        setXoxState(updated);
        xoxStateRef.current = updated;
        setXoxNotice('Süre doldu, sıra geçti!');
        startActiveRound();
        return;
      }
    }

    setIsRoundPlaying(false);
    setIsTimeExpired(true);
    setRoundEndReason('timeout');
    setRoundWinnerPlayer(null);
    setShowResultSheet(true);
    sounds.playWrong();
    haptics.wrong();

    fastComboStreakRef.current = 0;
    setFastComboStreak(0);
    setPlayer1Stats((prev) => ({ ...prev, currentStreak: 0 }));
    setPlayer2Stats((prev) => ({ ...prev, currentStreak: 0 }));
    setMatchHighlights((prev) => [
      ...prev,
      {
        roundNumber: currentRoundIndexRef.current + 1,
        minigameType: minigameTypeRef.current,
        winnerPlayerId: null,
        elapsedSec: null,
        reason: 'timeout',
        scoreAfter: { p1: player1Ref.current.score, p2: player2Ref.current.score },
      },
    ]);

    if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    nextRoundTimeoutRef.current = setTimeout(() => {
      nextRoundTimeoutRef.current = null;
      const nextIndex = currentRoundIndexRef.current + 1;
      const isCapReached = nextIndex >= 10;
      advanceNextRound(isCapReached);
    }, 3500);
  };

  // When 8-attempt cap is exhausted in Solo Futbolcuyu Tahmin Et
  const handleSilhouetteExhausted = useCallback(() => {
    if (!isRoundPlaying) return;
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);

    setIsRoundPlaying(false);
    setIsTimeExpired(false);
    setRoundEndReason('attempts_exhausted');
    setRoundWinnerPlayer(null);
    setShowResultSheet(true);
    sounds.playWrong();
    haptics.wrong();

    fastComboStreakRef.current = 0;
    setFastComboStreak(0);
    setPlayer1Stats((prev) => ({ ...prev, currentStreak: 0 }));
    setPlayer2Stats((prev) => ({ ...prev, currentStreak: 0 }));
    setMatchHighlights((prev) => [
      ...prev,
      {
        roundNumber: currentRoundIndexRef.current + 1,
        minigameType: minigameTypeRef.current,
        winnerPlayerId: null,
        elapsedSec: null,
        reason: 'attempts_exhausted',
        scoreAfter: { p1: player1Ref.current.score, p2: player2Ref.current.score },
      },
    ]);

    if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    nextRoundTimeoutRef.current = setTimeout(() => {
      nextRoundTimeoutRef.current = null;
      const nextIndex = currentRoundIndexRef.current + 1;
      const isCapReached = nextIndex >= 10;
      advanceNextRound(isCapReached);
    }, 3500);
  }, [isRoundPlaying]);

  const handleWrongAttempt = (playerId: string) => {
    if (playerId === player1.id) {
      fastComboStreakRef.current = 0;
      setFastComboStreak(0);
      setPlayer1Stats((prev) => ({
        ...prev,
        totalWrongAttempts: prev.totalWrongAttempts + 1,
      }));
      if (!isOnlineMode && isRoundPlaying) {
        const nextTime = Math.max(0, timeRemainingRef.current - 3);
        timeRemainingRef.current = nextTime;
        setTimeRemaining(nextTime);
        if (nextTime <= 0) {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          handleRoundTimeExpired();
        }
      }
    } else {
      setPlayer2Stats((prev) => ({
        ...prev,
        totalWrongAttempts: prev.totalWrongAttempts + 1,
      }));
    }
  };

  const handleAnswerWinner = useCallback(
    (winnerPlayerId: string, answer: string, playerName: string) => {
      if (!isRoundPlaying) return;
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);

      setIsRoundPlaying(false);

      const activeMinigame = minigameTypeRef.current;
      const elapsedSec = Math.max(1, getRoundDurationSeconds(activeMinigame) - timeRemaining);
      const exactElapsedSec = (Date.now() - roundStartedAtRef.current) / 1000;
      const isClutch = timeRemaining <= getClutchThresholdSeconds(activeMinigame);

      const winner = winnerPlayerId === player1.id ? player1 : player2;
      setRoundWinnerPlayer(winner);
      setAcceptedAnswerText(playerName || answer);
      setShowResultSheet(true);

      let matchFinished = false;

      if (winnerPlayerId === player1.id) {
        if (exactElapsedSec < FAST_COMBO_THRESHOLD_SEC) {
          const nextCombo = fastComboStreakRef.current + 1;
          fastComboStreakRef.current = nextCombo;
          maxFastComboRef.current = Math.max(maxFastComboRef.current, nextCombo);
          setFastComboStreak(nextCombo);
        } else {
          fastComboStreakRef.current = 0;
          setFastComboStreak(0);
        }
        soundManager.playCorrectCheer();
        haptics.correct();
        const guessedPlayer = PLAYERS_LIST.find(
          (pl) =>
            pl.id === answer ||
            pl.name.toLowerCase() === (playerName || answer).toLowerCase()
        );
        if (guessedPlayer) {
          const achRes = recordAchievementPlayerGuess(guessedPlayer, achievementsStateRef.current);
          updateAchievementsState(achRes.state);
          notifyUnlockedAchievements(achRes.newlyUnlocked);
          setV3QuestsState((prev) => recordV3QuestPlayerGuess(guessedPlayer, prev));
        }
        const wasTrailing = player1.score < player2.score;
        const newScore = player1.score + 1;
        setPlayer1((p) => ({ ...p, score: newScore }));
        if (newScore >= 3) matchFinished = true;

        const has2x =
          Boolean(progression.permanentMultiplier2x) ||
          (progression.multiplier2xMatches ?? 0) > 0;
        const roundCoins = has2x ? 50 : 25;
        const roundPoints = has2x ? 60 : 30;
        setLastRoundReward({ coins: roundCoins, points: roundPoints });
        setRoundDoubledByAd(false);
        const withBonus = grantExtraRewards(progression, roundCoins, roundPoints);
        persistProgression(withBonus);

        setPlayer1Stats((prev) => {
          const newStreak = prev.currentStreak + 1;
          return {
            ...prev,
            totalCorrect: prev.totalCorrect + 1,
            fastestAnswerSec:
              prev.fastestAnswerSec === null
                ? elapsedSec
                : Math.min(prev.fastestAnswerSec, elapsedSec),
            currentStreak: newStreak,
            maxStreak: Math.max(prev.maxStreak, newStreak),
            clutchAnswers: isClutch ? prev.clutchAnswers + 1 : prev.clutchAnswers,
            trailedThenWon: wasTrailing || prev.trailedThenWon,
          };
        });
        setPlayer2Stats((prev) => ({ ...prev, currentStreak: 0 }));
      } else {
        fastComboStreakRef.current = 0;
        setFastComboStreak(0);
        setLastRoundReward(null);
        setRoundDoubledByAd(false);
        const wasTrailing = player2.score < player1.score;
        const newScore = player2.score + 1;
        setPlayer2((p) => ({ ...p, score: newScore }));
        if (newScore >= 3) matchFinished = true;

        setPlayer2Stats((prev) => {
          const newStreak = prev.currentStreak + 1;
          return {
            ...prev,
            totalCorrect: prev.totalCorrect + 1,
            fastestAnswerSec:
              prev.fastestAnswerSec === null
                ? elapsedSec
                : Math.min(prev.fastestAnswerSec, elapsedSec),
            currentStreak: newStreak,
            maxStreak: Math.max(prev.maxStreak, newStreak),
            clutchAnswers: isClutch ? prev.clutchAnswers + 1 : prev.clutchAnswers,
            trailedThenWon: wasTrailing || prev.trailedThenWon,
          };
        });
        setPlayer1Stats((prev) => ({ ...prev, currentStreak: 0 }));
      }

      const nextP1Score =
        winnerPlayerId === player1.id ? player1.score + 1 : player1.score;
      const nextP2Score =
        winnerPlayerId === player1.id ? player2.score : player2.score + 1;

      setMatchHighlights((prev) => [
        ...prev,
        {
          roundNumber: currentRoundIndexRef.current + 1,
          minigameType: activeMinigame,
          winnerPlayerId,
          winnerName: winner.name,
          acceptedAnswer: playerName || answer,
          elapsedSec,
          wasClutch: isClutch,
          reason: 'scored',
          scoreAfter: { p1: nextP1Score, p2: nextP2Score },
        },
      ]);

      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
      const nextIndex = currentRoundIndexRef.current + 1;
      const reachedMaxRounds = nextIndex >= 10;
      const shouldFinish = matchFinished || reachedMaxRounds;
      pendingNextRoundActionRef.current = shouldFinish;
      nextRoundTimeoutRef.current = setTimeout(() => {
        nextRoundTimeoutRef.current = null;
        pendingNextRoundActionRef.current = null;
        advanceNextRound(shouldFinish);
      }, 3500);
    },
    [isRoundPlaying, player1, player2, timeRemaining, progression, persistProgression]
  );

  // Solo Bot XOX move / turn / win handler
  const handleSoloXoxMove = useCallback(
    (
      nextState: XoxRuntimeState,
      winnerId: string | null,
      roundEnded: boolean,
      playerName: string,
      wasCorrect: boolean
    ) => {
      setXoxState(nextState);
      xoxStateRef.current = nextState;

      if (roundEnded) {
        if (winnerId) {
          handleAnswerWinner(winnerId, playerName, playerName);
        } else {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          setIsRoundPlaying(false);
          setRoundWinnerPlayer(null);
          setIsTimeExpired(false);
          setRoundEndReason('draw');
          setShowResultSheet(true);
          setMatchHighlights((prev) => [
            ...prev,
            {
              roundNumber: currentRoundIndexRef.current + 1,
              minigameType: minigameTypeRef.current,
              winnerPlayerId: null,
              elapsedSec: null,
              reason: 'draw',
              scoreAfter: {
                p1: player1Ref.current.score,
                p2: player2Ref.current.score,
              },
            },
          ]);
          if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
          nextRoundTimeoutRef.current = setTimeout(() => {
            nextRoundTimeoutRef.current = null;
            const nextIndex = currentRoundIndexRef.current + 1;
            advanceNextRound(nextIndex >= 10);
          }, 3500);
        }
        return;
      }

      if (wasCorrect) {
        soloXoxTimeoutsRef.current = 0;
        setXoxNotice(`${playerName} ile kare alındı! Sıra geçti.`);
      } else {
        fastComboStreakRef.current = 0;
        setFastComboStreak(0);
        setXoxNotice('Tahmin geçersiz, sıra geçti!');
      }
      startActiveRound();
    },
    [handleAnswerWinner]
  );

  const attachRtdbRoomListener = useCallback((code: string) => {
    activeRtdbRoomCodeRef.current = code;
    setRoomCode(code);
    rtdbRoomPhaseKeyRef.current = '';
    rtdbWrongPulseSeqRef.current = 0;

    if (unsubRtdbRoomRef.current) {
      unsubRtdbRoomRef.current();
      unsubRtdbRoomRef.current = null;
    }

    const myId = sessionPlayerIdRef.current;
    const myKey = sanitizeRtdbKey(myId);

    const stopRtdbTimers = () => {
      if (rtdbHostTickTimerRef.current) {
        clearInterval(rtdbHostTickTimerRef.current);
        rtdbHostTickTimerRef.current = null;
      }
      if (rtdbHostNextTimerRef.current) {
        clearTimeout(rtdbHostNextTimerRef.current);
        rtdbHostNextTimerRef.current = null;
      }
    };

    const unsub = subscribeRtdbRoom(code, (room: RtdbRoomRecord | null) => {
      if (activeRtdbRoomCodeRef.current !== code) return;

      if (!room) {
        if (screenRef.current === 'game_over') {
          setRematchState('opponent_left');
        } else if (screenRef.current === 'room_waiting' || screenRef.current === 'playing') {
          stopRtdbTimers();
          setIsRoundPlaying(false);
          setShowResultSheet(false);
          setOnlineError('Oda kapatıldı veya rakibin bağlantısı kesildi.');
          setScreen('lobby');
        }
        return;
      }

      if (room.minigameType) {
        setMinigameType(room.minigameType);
        minigameTypeRef.current = room.minigameType;
      }

      const playersMap = room.players || {};
      const oppKey = Object.keys(playersMap).find((k) => k !== myKey) || null;
      const oppEntry = oppKey ? playersMap[oppKey] : null;
      const myEntry = playersMap[myKey];
      const isHost = room.hostId === myKey;

      if (oppEntry) {
        setPlayer2({
          id: oppEntry.id,
          name: oppEntry.name,
          avatar: oppEntry.avatar,
          favoriteClubId: oppEntry.favoriteClubId,
          score: room.scores?.[oppKey!] ?? oppEntry.score ?? 0,
        });
        if (!oppEntry.connected && screenRef.current === 'playing') {
          stopRtdbTimers();
          setIsRoundPlaying(false);
          setShowResultSheet(false);
          setOnlineError('Rakibin bağlantısı kesildi!');
          setScreen('lobby');
          void cleanupRtdbRoom(code);
          return;
        }
      }

      if (myEntry) {
        setPlayer1((prev) => ({
          ...prev,
          score: room.scores?.[myKey] ?? myEntry.score ?? 0,
        }));
      }

      if (myEntry?.stats) setPlayer1Stats(myEntry.stats);
      if (oppEntry?.stats) setPlayer2Stats(oppEntry.stats);

      const roundPayload = getRtdbRoundPayload(room);
      if (roundPayload) setOnlineRound(roundPayload);

      const xox = parseRtdbXoxState(room);
      setXoxState(xox);
      if (room.xoxNotice) setXoxNotice(room.xoxNotice);

      if (
        room.wrongAttemptPulse &&
        room.wrongAttemptPulse.byPlayerId !== myId &&
        room.wrongAttemptPulse.seq !== rtdbWrongPulseSeqRef.current
      ) {
        rtdbWrongPulseSeqRef.current = room.wrongAttemptPulse.seq;
        setOpponentMissedPulse((prev) => prev + 1);
      }

      const phaseKey = `${room.matchSeq}-${room.currentRoundIndex}-${room.state}`;
      const phaseChanged = rtdbRoomPhaseKeyRef.current !== phaseKey;

      if (room.state === 'waiting') {
        setScreen('room_waiting');
        return;
      }

      if (room.state === 'countdown') {
        if (phaseChanged) {
          rtdbRoomPhaseKeyRef.current = phaseKey;
          stopRtdbTimers();

          if (room.currentRoundIndex === 0) {
            resetMatchComboAndClock();
            setMatchHighlights([]);
          }

          if (energyChargedMatchInstanceRef.current !== matchInstanceIdRef.current) {
            energyChargedMatchInstanceRef.current = matchInstanceIdRef.current;
            const onlineEnergyCheck = consumeMatchEntryEnergy(progressionRef.current);
            if (onlineEnergyCheck.ok) {
              persistProgression(onlineEnergyCheck.progression);
              syncServerLeaderboard(onlineEnergyCheck.progression, player1Ref.current);
            }
          }

          setShowResultSheet(false);
          setRoundWinnerPlayer(null);
          setAcceptedAnswerText('');
          setIsTimeExpired(false);
          setRoundEndReason('timeout');
          setOnlineSilhouetteExhausted(false);
          setIsRoundPlaying(false);
          setServerWrongFeedback(null);
          setTimeRemaining(getRoundDurationSeconds(room.minigameType));
          setRematchState('idle');
          setCurrentRoundIndex(room.currentRoundIndex || 0);
          setScreen('playing');
trackGameEvent('match_start', { mode: 'online', minigame: room.minigameType });
          if (isHost) {
            let countVal = 3;
            rtdbCountdownStartedAtRef.current = Date.now();
            rtdbHostTickTimerRef.current = setInterval(() => {
              countVal -= 1;
              void updateRtdbCountdown(code, countVal);
              if (countVal <= 0 && rtdbHostTickTimerRef.current) {
                clearInterval(rtdbHostTickTimerRef.current);
                rtdbHostTickTimerRef.current = null;
              }
            }, 1000);
          }
        }
        setCountdown(room.countdownValue ?? 3);
        return;
      }

      if (room.state === 'playing') {
        if (phaseChanged) {
          rtdbRoomPhaseKeyRef.current = phaseKey;
          stopRtdbTimers();
          roundStartedAtRef.current = room.roundStartedAt || Date.now();
          setCountdown(0);
          setOnlineSilhouetteExhausted(false);
          setIsRoundPlaying(true);
          setShowResultSheet(false);

          const totalSec = getRoundDurationSeconds(room.minigameType);
          const startedAt = room.roundStartedAt || Date.now();
          let expireFired = false;

          rtdbHostTickTimerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            const rem = Math.max(0, totalSec - elapsed);
            setTimeRemaining(rem);
            if (isHost && rem <= 0 && !expireFired) {
              expireFired = true;
              void expireRtdbRound(code);
            }
          }, 250);
        }
        return;
      }

      if (room.state === 'round_ended') {
        if (phaseChanged) {
          rtdbRoomPhaseKeyRef.current = phaseKey;
          stopRtdbTimers();
          setIsRoundPlaying(false);

          const winner = room.roundWinnerId
            ? room.roundWinnerId === myId
              ? player1Ref.current
              : player2Ref.current
            : null;
          setRoundWinnerPlayer(winner);
          setAcceptedAnswerText(room.acceptedPlayerName || room.acceptedAnswer || '');
          setIsTimeExpired(room.roundEndReason === 'timeout');
          setRoundEndReason(
            room.roundEndReason === 'attempts_exhausted'
              ? 'attempts_exhausted'
              : room.roundEndReason === 'timeout'
              ? 'timeout'
              : 'draw'
          );

          const elapsedSec = room.roundStartedAt
            ? Number(((Date.now() - room.roundStartedAt) / 1000).toFixed(1))
            : null;
          if (room.roundWinnerId === myId) {
            if (elapsedSec !== null && elapsedSec < FAST_COMBO_THRESHOLD_SEC) {
              const nextCombo = fastComboStreakRef.current + 1;
              fastComboStreakRef.current = nextCombo;
              maxFastComboRef.current = Math.max(maxFastComboRef.current, nextCombo);
              setFastComboStreak(nextCombo);
            } else {
              fastComboStreakRef.current = 0;
              setFastComboStreak(0);
            }
            sounds.playGoal();
            haptics.correct();
          } else {
            fastComboStreakRef.current = 0;
            setFastComboStreak(0);
            sounds.playWrong();
            haptics.wrong();
          }

          const p1After = room.scores?.[myKey] ?? player1Ref.current.score;
          const p2After = oppKey ? (room.scores?.[oppKey] ?? player2Ref.current.score) : 0;
          setMatchHighlights((prev) => [
            ...prev,
            {
              roundNumber: (room.currentRoundIndex || 0) + 1,
              minigameType: room.minigameType,
              winnerPlayerId: room.roundWinnerId ?? null,
              winnerName: winner?.name,
              acceptedAnswer: room.acceptedPlayerName || room.acceptedAnswer || undefined,
              elapsedSec,
              reason: room.roundEndReason || 'draw',
              scoreAfter: { p1: p1After, p2: p2After },
            },
          ]);
          setShowResultSheet(true);

          if (isHost) {
            rtdbHostNextTimerRef.current = setTimeout(() => {
              rtdbHostNextTimerRef.current = null;
              void advanceRtdbNextRound(code);
            }, 3500);
          }
        }
        return;
      }

      if (room.state === 'game_over') {
        if (phaseChanged) {
          rtdbRoomPhaseKeyRef.current = phaseKey;
          stopRtdbTimers();
          setShowResultSheet(false);
          setIsRoundPlaying(false);
          setRematchState('idle');
          void transitionToGameOver();
          if (isHost) {
            rtdbHostNextTimerRef.current = setTimeout(() => {
              void cleanupRtdbRoom(code);
            }, 45_000);
          }
        } else {
          const iReq = Boolean(myEntry?.rematchRequested);
          const oppReq = Boolean(oppEntry?.rematchRequested);
          if (iReq) setRematchState('waiting');
          else if (oppReq) setRematchState('opponent_requested');
        }
      }
    });

    unsubRtdbRoomRef.current = unsub;
  }, [persistProgression, resetMatchComboAndClock, syncServerLeaderboard]);

  // Online Multiplayer (Firebase Realtime Database Rooms + 4s Smart Bot Fallback)
  const handleSelectOnlineMode = useCallback(
    async (
      onlineMode: 'online_match' | 'online_room',
      options?: { roomCode?: string; minigameType?: MinigameType }
    ) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setOnlineError(
          'İnternet bağlantısı yok! Online 1v1 ve oda modları için bağlantını kontrol et. Dilersen Bot Antrenmanı oynayabilirsin.'
        );
        setScreen('lobby');
        setActiveTab('play');
        return;
      }

      if (
        !hasUnlimitedEnergy(progressionRef.current) &&
        getEffectiveDailyEnergy(progressionRef.current) <= 0
      ) {
        setShowEnergyModal(true);
        return;
      }

      closeOnlineSocket();
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
        nextRoundTimeoutRef.current = null;
      }

      matchInstanceIdRef.current += 1;
      setLastMatchEnergyDeltaLabel(null);
      setLastMatchRewards(null);
      const chosenMinigame: MinigameType = options?.minigameType || 'two_clubs';
      setMode(onlineMode);
      setMinigameType(chosenMinigame);
      minigameTypeRef.current = chosenMinigame;

      const isQuick = onlineMode === 'online_match';
      setIsMatchmaking(isQuick);
      setOnlineError(null);
      setOnlineRound(null);
      setXoxState(null);
      setXoxNotice(null);
      setRoomCode(options?.roomCode ? options.roomCode.toUpperCase() : '');
      setPlayer1((prev) => ({ ...prev, id: sessionPlayerIdRef.current, score: 0 }));
      setPlayer2({ id: 'p2', name: 'Rakip Oyuncu', avatar: '🔥', score: 0 });
      setPlayer1Stats({ ...initialStats });
      setPlayer2Stats({ ...initialStats });
      setMatchHighlights([]);
      setServerWrongFeedback(null);
      setOpponentMissedPulse(0);
      setRematchState('idle');
      setShowResultSheet(false);
      setIsRoundPlaying(false);
      setScreen('room_waiting');

      const selfProfile: PlayerProfile = {
        ...player1Ref.current,
        id: sessionPlayerIdRef.current,
        score: 0,
      };

      try {
        if (isQuick) {
          cancelRtdbMatchmakingRef.current = startRtdbMatchmaking({
            profile: selfProfile,
            minigameType: chosenMinigame,
            onRoomMatched: (matchedCode) => {
              cancelRtdbMatchmakingRef.current = null;
              attachRtdbRoomListener(matchedCode);
            },
            onFallbackToBot: (bot) => {
              cancelRtdbMatchmakingRef.current = null;
              // Seamless realistic bot opponent pairing after 4s wait
              startBotMatch(bot.difficulty, chosenMinigame, {
                id: bot.id,
                name: bot.name,
                avatar: bot.avatar,
              });
            },
          });
          return;
        }

        if (options?.roomCode) {
          const joined = await joinRtdbRoom(options.roomCode, selfProfile);
          if (!joined.ok) {
            setOnlineError(joined.error);
            setScreen('lobby');
            return;
          }
          attachRtdbRoomListener(joined.room.code);
        } else {
          const created = await createRtdbRoom(selfProfile, chosenMinigame);
          attachRtdbRoomListener(created.code);
        }
      } catch {
        setOnlineError('Firebase oda bağlantısı başlatılamadı. Lütfen tekrar dene!');
        setScreen('lobby');
      }
    },
    [attachRtdbRoomListener]
  );

  // Auto-join room from ?room=XXXXX invite URL once user is in lobby
  useEffect(() => {
    if (screen === 'lobby' && pendingInviteRoom) {
      const codeToJoin = pendingInviteRoom;
      setPendingInviteRoom(null);
      if (typeof window !== 'undefined') {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
      handleSelectOnlineMode('online_room', { roomCode: codeToJoin });
    }
  }, [screen, pendingInviteRoom, handleSelectOnlineMode]);

  const handleSubmitOnlineAnswer = useCallback(
    async (answer: string, cellPos?: { row: number; col: number }) => {
      const activeCode = activeRtdbRoomCodeRef.current;
      if (activeCode) {
        const res = await submitRtdbAnswer(activeCode, sessionPlayerIdRef.current, answer, cellPos);
        if (!res.accepted) {
          fastComboStreakRef.current = 0;
          setFastComboStreak(0);
          if (res.reason === 'attempts_exhausted' || res.attemptsRemaining === 0) {
            setOnlineSilhouetteExhausted(true);
          }
          setServerWrongFeedback({
            attempt: answer,
            seq: Date.now() + Math.random(),
          });
        }
        return;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'submit_answer',
            answer,
            ...(cellPos ? { row: cellPos.row, col: cellPos.col } : {}),
          })
        );
      }
    },
    []
  );

  const handleExitToLobby = () => {
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (nextRoundTimeoutRef.current) {
      clearTimeout(nextRoundTimeoutRef.current);
      nextRoundTimeoutRef.current = null;
    }
    closeOnlineSocket();
    isTournamentMatchRef.current = false;
    fastComboStreakRef.current = 0;
    setFastComboStreak(0);
    setIsRoundPlaying(false);
    setShowResultSheet(false);
    setOnlineRound(null);
    setXoxState(null);
    setXoxNotice(null);
    setRematchState('idle');
    setScreen('lobby');
    if (returnToTournamentAfterVictoryRef.current) {
      returnToTournamentAfterVictoryRef.current = false;
      setShowTournamentModal(true);
    }
  };

  const handleRematch = () => {
    if (
      !hasUnlimitedEnergy(progressionRef.current) &&
      getEffectiveDailyEnergy(progressionRef.current) <= 0
    ) {
      setShowEnergyModal(true);
      return;
    }
    if (mode === 'online_match' || mode === 'online_room') {
      const activeCode = activeRtdbRoomCodeRef.current;
      if (activeCode) {
        setRematchState('waiting');
        void requestRtdbRematch(activeCode, sessionPlayerIdRef.current);
      } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'rematch_request' }));
      } else {
        setOnlineError('Maç bağlantısı kapandı. Yeniden eşleşebilirsin.');
        setScreen('lobby');
      }
    } else {
      startBotMatch(botDiff, minigameType);
    }
  };

  const handleClaimDailyRewardAction = () => {
    const res = claimDailyReward(progression);
    if (res.claimed) {
      persistProgression(res.progression);
      syncServerLeaderboard(res.progression, player1);
    }
  };

  const handleClaimDailyQuestAction = (questId: string) => {
    const res = claimDailyQuest(progression, questId);
    if (res.claimed) {
      persistProgression(res.progression);
      syncServerLeaderboard(res.progression, player1);
    }
  };

  const handlePurchaseGiftAction = (giftId: string) => {
    const res = purchaseGift(progression, giftId);
    if (res.ok) {
      persistProgression(res.progression);
      let nextProfile = player1;
      if (res.gift?.type === 'avatar') {
        nextProfile = { ...player1, avatar: res.gift.value };
        handleUpdateProfile({ avatar: res.gift.value });
      }
      syncServerLeaderboard(res.progression, nextProfile);
    }
    return { ok: res.ok, reason: res.reason };
  };

  const handleOpenStore = (category: StoreCategory = 'featured') => {
    setStoreCategory(category);
    setShowStoreModal(true);
  };

  const handleStartOpenTournament = (mg: MinigameType) => {
    const res = enterTournamentWithCoins(progression, TOURNAMENT_OPEN_ENTRY_COINS);
    if (!res.ok) {
      return { ok: false, reason: res.reason };
    }
    persistProgression(res.progression);
    syncServerLeaderboard(res.progression, player1);
    const bracket = createTournamentBracket({
      userProfile: player1,
      mode: 'open_cup',
      minigameType: mg,
      entryFeeCoins: TOURNAMENT_OPEN_ENTRY_COINS,
      prizeCoins: TOURNAMENT_OPEN_PRIZE_COINS,
    });
    setActiveTournament(bracket);

    fetch('/api/tournaments/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: player1.id,
        actorFriendCode: res.progression.friendCode,
        actorName: player1.name,
        actorAvatar: player1.avatar,
        minigameType: mg,
        title: bracket.title,
      }),
    }).catch(() => {});

    publishActivityToFirestore({
      user: firebaseUser,
      profile: player1,
      progression: res.progression,
      activity: {
        id: `tourney_open_${bracket.id}`.slice(0, 64),
        type: 'tournament_started',
        title: bracket.title,
      },
    }).catch(() => {});

    return { ok: true };
  };

  const handlePayFriendTournamentEntry = (entryFeeCoins: number) => {
    const res = enterTournamentWithCoins(progression, entryFeeCoins);
    if (!res.ok) {
      return { ok: false, reason: res.reason };
    }
    persistProgression(res.progression);
    syncServerLeaderboard(res.progression, player1);
    return { ok: true };
  };

  const handleStartFriendTournament = (params: {
    code: string;
    title: string;
    minigameType: MinigameType;
    entryFeeCoins: number;
    prizeCoins: number;
    realParticipants: TournamentParticipant[];
    alreadyPaid?: boolean;
  }) => {
    let nextProg = progression;
    if (!params.alreadyPaid) {
      const res = enterTournamentWithCoins(progression, params.entryFeeCoins);
      if (!res.ok) {
        return { ok: false, reason: res.reason };
      }
      nextProg = res.progression;
      persistProgression(res.progression);
      syncServerLeaderboard(res.progression, player1);
    }

    const bracket = createTournamentBracket({
      userProfile: player1,
      mode: 'friends_cup',
      minigameType: params.minigameType,
      entryFeeCoins: params.entryFeeCoins,
      prizeCoins: params.prizeCoins,
      code: params.code,
      title: params.title,
      realParticipants: params.realParticipants,
    });
    setActiveTournament(bracket);
    setPendingInviteTournament(null);

    publishActivityToFirestore({
      user: firebaseUser,
      profile: player1,
      progression: nextProg,
      activity: {
        id: `tourney_${params.code}`.slice(0, 64),
        type: 'tournament_started',
        title: params.title,
        code: params.code,
      },
    }).catch(() => {});

    return { ok: true };
  };

  const handlePlayNextTournamentMatch = () => {
    if (!activeTournament || activeTournament.status !== 'active') return;
    const matchInfo = getTournamentMatchForUser(activeTournament, player1.id);
    if (!matchInfo.opponent) return;
    isTournamentMatchRef.current = true;
    returnToTournamentAfterVictoryRef.current = false;
    setShowTournamentModal(false);
    startBotMatch(
      matchInfo.botDifficulty,
      activeTournament.minigameType,
      {
        id: matchInfo.opponent.id,
        name: matchInfo.opponent.name,
        avatar: matchInfo.opponent.avatar,
      }
    );
  };

  const handlePurchaseStoreItemAction = (itemId: string, method: 'coins' | 'money') => {
    const res = purchaseStoreItem(progression, itemId, method);
    if (res.ok) {
      persistProgression(res.progression);
      let nextProfile = player1;
      if (res.gift?.type === 'avatar') {
        nextProfile = { ...player1, avatar: res.gift.value };
        handleUpdateProfile({ avatar: res.gift.value });
      }
      syncServerLeaderboard(res.progression, nextProfile);
    }
    return { ok: res.ok, reason: res.reason, gift: res.gift };
  };

  const handleEquipStoreItemAction = (itemId: string) => {
    const res = equipStoreItem(progression, itemId);
    if (res.ok) {
      persistProgression(res.progression);
      let nextProfile = player1;
      if (res.item?.type === 'avatar') {
        nextProfile = { ...player1, avatar: res.item.value };
        handleUpdateProfile({ avatar: res.item.value });
      }
      syncServerLeaderboard(res.progression, nextProfile);
    }
    return { ok: res.ok, reason: res.reason };
  };

  const handleSelectDefaultPitchTheme = () => {
    const next = selectDefaultPitchTheme(progression);
    persistProgression(next);
    syncServerLeaderboard(next, player1);
  };

  const handleUseExtraTimeCard = (): boolean => {
    if (!isRoundPlaying || isOnlineMode) return false;
    const res = consumeExtraTimeCard(progressionRef.current);
    if (!res.ok) return false;
    persistProgression(res.progression);
    const nextTime = timeRemainingRef.current + 10;
    timeRemainingRef.current = nextTime;
    setTimeRemaining(nextTime);
    return true;
  };

  const handleUseEnergyDrinkHint = (): boolean => {
    const res = consumeEnergyDrink(progression);
    if (!res.ok) return false;
    persistProgression(res.progression);
    return true;
  };

  const handleUseEnergyDrinkPass = () => {
    if (!isRoundPlaying || isOnlineMode) return;
    const res = consumeEnergyDrink(progression);
    if (!res.ok) {
      handleOpenStore('featured');
      return;
    }
    persistProgression(res.progression);
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    setIsRoundPlaying(false);
    sounds.playCorrect();
    const nextIndex = currentRoundIndexRef.current + 1;
    advanceNextRound(nextIndex >= 10);
  };

  const handleSpendCoinsForJoker = (costCoins: number) => {
    const res = consumeFreeJokerOrSpendCoins(progression, costCoins);
    if (res.ok) {
      persistProgression(res.progression);
      syncServerLeaderboard(res.progression, player1);
    }
    return { ok: res.ok, reason: res.reason };
  };

  const handleCommitWheelSpin = (
    slice: WheelSliceDefinition,
    spinKind: 'free' | 'ad'
  ) => {
    const serverNow = getAuthoritativeServerDate();
    const res = applyWheelReward(progressionRef.current, slice, { spinKind }, serverNow);
    if (res.ok) {
      persistProgression(res.progression);
      syncServerLeaderboard(res.progression, player1Ref.current);
      if (firebaseUser) {
        void saveUserBackupToFirestore({
          user: firebaseUser,
          profile: player1Ref.current,
          progression: res.progression,
          favoriteClubId: player1Ref.current.favoriteClubId,
          recordWheelSpin: spinKind === 'free',
        }).catch(() => {});
      }
    }
    return {
      ok: res.ok,
      reason: res.reason,
      grantedSummary: res.grantedSummary,
    };
  };

  const handleCompleteDailyChallenge = (record: DailyChallengeRecord) => {
    const serverNow = getAuthoritativeServerDate();
    const serverRecord: DailyChallengeRecord = {
      ...record,
      completedAt: serverNow.getTime(),
    };
    const res = recordDailyChallengeCompletion(progression, serverRecord, serverNow);
    persistProgression(res.progression);
    syncServerLeaderboard(res.progression, player1);
    if (firebaseUser) {
      void saveUserBackupToFirestore({
        user: firebaseUser,
        profile: player1Ref.current,
        progression: res.progression,
        favoriteClubId: player1Ref.current.favoriteClubId,
        recordDailyChallenge: true,
      }).catch(() => {});
    }
    if (res.firstCompletionToday) {
      const passRes = awardFootballPassXp(PASS_XP_DAILY_CHALLENGE);
      setPassState(passRes.state);
    }
    return {
      firstCompletionToday: res.firstCompletionToday,
      awardedCoins: res.awardedCoins,
      awardedPoints: res.awardedPoints,
    };
  };

  const handleWatchAdForStoreCoins = () => {
    setPendingAdReward({
      scope: 'store_coins',
      coins: 250,
      points: 0,
    });
  };

  const handleRequestRematchAd = () => {
    setPendingAdReward({
      scope: 'rematch_unlock',
      coins: 0,
      points: 0,
    });
  };

  const handleRequestDoubleRound = () => {
    if (!lastRoundReward || roundDoubledByAd) return;
    if (nextRoundTimeoutRef.current) {
      clearTimeout(nextRoundTimeoutRef.current);
      nextRoundTimeoutRef.current = null;
    }
    setPendingAdReward({
      scope: 'round',
      coins: lastRoundReward.coins,
      points: lastRoundReward.points,
    });
  };

  // Maç sonu "Reklam İzle ve Ödülü 2x Katla": mevcut showRewardedAd altyapısını kullanır.
  // Reklam tamamlanınca SADECE maç Coin ödülü bir kez daha eklenir (2x) ve aynı maç için kilitlenir.
  const handleRequestDoubleMatchReward = async () => {
    const rewards = lastMatchRewards;
    if (!rewards || rewards.doubledByAd || rewards.earnedCoins <= 0) return;
    if (matchDoubleAdInFlightRef.current) return;
    matchDoubleAdInFlightRef.current = true;
    setMatchDoubleAdLoading(true);
    try {
      const result = await showRewardedAd('double_match_reward', {
        adFreeBypass: Boolean(progressionRef.current.adFree),
      });
      if (!result.completed) return;
      const bonusCoins = rewards.earnedCoins;
      const next = grantExtraRewards(progressionRef.current, bonusCoins, 0);
      persistProgression(next);
      syncServerLeaderboard(next, player1Ref.current);
      sounds.playVictory();
      setLastMatchRewards((prev) =>
        prev && !prev.doubledByAd
          ? { ...prev, earnedCoins: prev.earnedCoins + bonusCoins, doubledByAd: true }
          : prev
      );
    } catch {
      // Reklam başarısız olursa ödül verilmez; kullanıcı tekrar deneyebilir.
    } finally {
      matchDoubleAdInFlightRef.current = false;
      setMatchDoubleAdLoading(false);
    }
  };

  const handleGrantAdEnergy = () => {
    const next = refundMatchEnergy(progressionRef.current, ENERGY_AD_REWARD_AMOUNT);
    persistProgression(next);
    syncServerLeaderboard(next, player1Ref.current);
  };

  const handleUseEnergyDrinkForMatch = () => {
    const res = useEnergyDrinkForMatchEnergy(progressionRef.current);
    if (res.ok) {
      persistProgression(res.progression);
      syncServerLeaderboard(res.progression, player1Ref.current);
    }
    return { ok: res.ok, reason: res.reason };
  };

  const handleCompleteRewardedAd = () => {
    if (!pendingAdReward) return;

    if (pendingAdReward.scope === 'store_coins') {
      const next = grantFreeAdCoins(progression, pendingAdReward.coins || 250);
      persistProgression(next);
      syncServerLeaderboard(next, player1);
      sounds.playVictory();
      setPendingAdReward(null);
      return;
    }

    if (pendingAdReward.scope === 'rematch_unlock') {
      if (
        !hasUnlimitedEnergy(progressionRef.current) &&
        getEffectiveDailyEnergy(progressionRef.current) <= 0
      ) {
        const refilled = refundMatchEnergy(progressionRef.current, 1);
        persistProgression(refilled);
        syncServerLeaderboard(refilled, player1Ref.current);
      }
      sounds.playVictory();
      setPendingAdReward(null);
      handleRematch();
      return;
    }

    const next = grantExtraRewards(progression, pendingAdReward.coins, pendingAdReward.points);
    persistProgression(next);
    syncServerLeaderboard(next, player1);
    sounds.playVictory();

    if (pendingAdReward.scope === 'round') {
      setRoundDoubledByAd(true);
      setPendingAdReward(null);
      const shouldFinish = pendingNextRoundActionRef.current ?? false;
      pendingNextRoundActionRef.current = null;
      nextRoundTimeoutRef.current = setTimeout(() => {
        nextRoundTimeoutRef.current = null;
        advanceNextRound(shouldFinish);
      }, 900);
    } else {
      setLastMatchRewards((prev) =>
        prev
          ? {
              ...prev,
              earnedCoins: prev.earnedCoins + pendingAdReward.coins,
              earnedPoints: prev.earnedPoints + pendingAdReward.points,
              doubledByAd: true,
            }
          : prev
      );
      setPendingAdReward(null);
    }
  };

  const handleCloseRewardedAd = () => {
    const scope = pendingAdReward?.scope;
    setPendingAdReward(null);
    if (scope === 'round' && pendingNextRoundActionRef.current !== null) {
      const shouldFinish = pendingNextRoundActionRef.current;
      pendingNextRoundActionRef.current = null;
      nextRoundTimeoutRef.current = setTimeout(() => {
        nextRoundTimeoutRef.current = null;
        advanceNextRound(shouldFinish);
      }, 900);
    }
  };

  const handleUnlinkSocialAction = (provider: SocialProvider) => {
    const next = unlinkSocialAccount(progression, provider);
    persistProgression(next);
  };

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGooglePopup();
      if (!user.emailVerified || !user.email) {
        return {
          ok: false,
          error: 'Google e-posta adresi doğrulanamadı.',
        };
      }
      cloudLoadedUidRef.current = user.uid;
      setFirebaseUser(user);
      setIsSyncingCloud(true);

      let mergedProg = progressionRef.current;
      let nextProfile = player1Ref.current;
      const remote = await loadUserBackupFromFirestore(user.uid);
      if (remote) {
        mergedProg = mergeCloudAndLocalProgression(mergedProg, remote.progression);
        if (
          remote.displayName &&
          (nextProfile.name === 'Futbol Gurmesi' ||
            (remote.progression.totalPoints ?? 0) > (progressionRef.current.totalPoints ?? 0))
        ) {
          nextProfile = {
            ...nextProfile,
            name: remote.displayName,
            avatar: remote.avatar || nextProfile.avatar,
            favoriteClubId: remote.favoriteClubId || nextProfile.favoriteClubId,
          };
          setPlayer1(nextProfile);
          try {
            localStorage.setItem('football_user_profile', JSON.stringify(nextProfile));
          } catch {
            // ignore
          }
        }
      }

      const linkRes = linkSocialAccount(mergedProg, 'google', user.email);
      const bonusCoinsAwarded = linkRes.bonusCoinsAwarded || 0;
      if (linkRes.ok) {
        mergedProg = linkRes.progression;
      }
      persistProgression(mergedProg);
      syncServerLeaderboard(mergedProg, nextProfile);

      await saveUserBackupToFirestore({
        user,
        profile: nextProfile,
        progression: mergedProg,
        favoriteClubId: nextProfile.favoriteClubId,
      });
      savePublicProfileToFirestore({
        user,
        profile: nextProfile,
        progression: mergedProg,
      }).catch(() => {});

      if (nextProfile.name && nextProfile.name !== 'Futbol Gurmesi') {
        await claimUsernameInFirestore({
          user,
          displayName: nextProfile.name,
        }).catch(() => {});
        fetch('/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: sessionPlayerIdRef.current,
            profile: nextProfile,
            progression: mergedProg,
            googleUid: user.uid,
          }),
        }).catch(() => {});
      }

      return {
        ok: true,
        bonusCoinsAwarded,
        email: user.email,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('redirect-in-progress')) {
        return { ok: true, email: '' };
      }
      if (msg.includes('popup-closed-by-user')) {
        return { ok: false, error: 'Google giriş penceresi kapatıldı.' };
      }
      if (msg.includes('popup-blocked')) {
        return { ok: false, error: 'Tarayıcı açılır pencereyi engelledi. İzin verip tekrar dene.' };
      }
      return { ok: false, error: 'Google ile giriş tamamlanamadı. Lütfen tekrar dene.' };
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutFirebase();
    } finally {
      cloudLoadedUidRef.current = null;
      setFirebaseUser(null);
      handleUnlinkSocialAction('google');
    }
  };

  const handleSyncCloudNow = async (): Promise<boolean> => {
    if (!firebaseUser || !firebaseUser.emailVerified || !firebaseUser.email) return false;
    setIsSyncingCloud(true);
    try {
      await saveUserBackupToFirestore({
        user: firebaseUser,
        profile: player1Ref.current,
        progression: progressionRef.current,
        favoriteClubId: player1Ref.current.favoriteClubId,
      });
      await savePublicProfileToFirestore({
        user: firebaseUser,
        profile: player1Ref.current,
        progression: progressionRef.current,
      }).catch(() => {});
      return true;
    } catch {
      return false;
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleRestorePurchases = async (): Promise<{ ok: boolean; message: string }> => {
    try {
      let mergedProg = progressionRef.current;
      let restoredSources = 0;

      if (firebaseUser) {
        const remote = await loadUserBackupFromFirestore(firebaseUser.uid).catch(() => null);
        if (remote?.progression) {
          mergedProg = mergeCloudAndLocalProgression(mergedProg, remote.progression);
          restoredSources += 1;
        }
      } else {
        const serverRec = await fetch(
          `/api/accounts/by-id/${encodeURIComponent(sessionPlayerIdRef.current)}`
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        if (serverRec?.ok && serverRec?.account?.progression) {
          mergedProg = mergeCloudAndLocalProgression(
            mergedProg,
            serverRec.account.progression as UserProgression
          );
          restoredSources += 1;
        }
      }

      const uniqueUnlocked = Array.from(new Set(mergedProg.unlockedGiftIds || []));
      mergedProg = {
        ...mergedProg,
        unlockedGiftIds: uniqueUnlocked,
      };
      persistProgression(mergedProg);
      logTelemetryEvent('restore_purchases', {
        unlockedCount: uniqueUnlocked.length,
        sources: restoredSources,
      });

      return {
        ok: true,
        message:
          uniqueUnlocked.length > 0
            ? `Satın alımlar geri yüklendi! (${uniqueUnlocked.length} öğe${mergedProg.adFree ? ' • VIP Reklamsız aktif' : ''})`
            : 'Satın alımların kontrol edildi; tüm mevcut öğelerin güncel ve aktif ✓',
      };
    } catch {
      return {
        ok: false,
        message: 'Satın alımlar kontrol edilirken bir sorun oluştu. Lütfen tekrar dene.',
      };
    }
  };

  const handleDeleteAccount = async (): Promise<{ ok: boolean; warning?: string }> => {
    logTelemetryEvent('account_delete_requested');
    const cloudRes = await deleteCloudAccountData({
      user: firebaseUser,
      displayName: player1Ref.current.name,
    });

    await fetch(`/api/accounts/by-id/${encodeURIComponent(sessionPlayerIdRef.current)}`, {
      method: 'DELETE',
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      try {
        for (const key of Object.keys(window.localStorage)) {
          if (key.startsWith('football_') || key.startsWith('321_')) {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // ignore
      }
      try {
        window.sessionStorage.removeItem('football_session_player_id');
      } catch {
        // ignore
      }
    }

    const freshId = getOrCreateSessionPlayerId();
    sessionPlayerIdRef.current = freshId;
    cloudLoadedUidRef.current = null;
    setFirebaseUser(null);

    const freshProfile: PlayerProfile = {
      id: freshId,
      name: 'Futbol Gurmesi',
      avatar: DEFAULT_STARTER_AVATAR,
      score: 0,
      favoriteClubId: 'galatasaray',
    };
    const freshProg = createInitialProgression(freshId);
    setPlayer1(freshProfile);
    persistProgression(freshProg);
    setActiveTab('play');
    setScreen('intro');
    return cloudRes;
  };

  const handleRequestAddFriend = (
    targetOrCode:
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
        }
  ) => {
    const resolved = resolveFriendTargetCandidate(
      progressionRef.current,
      targetOrCode,
      liveLeaderboardPlayers,
      player1Ref.current.id
    );
    if (!resolved.ok || !resolved.target) {
      return { ok: false, error: resolved.error };
    }
    setPendingFriendTarget(resolved.target);
    return { ok: true, pendingConfirmation: true };
  };

  const handleConfirmSendFriendRequest = () => {
    const target = pendingFriendTarget;
    if (!target) return;
    setPendingFriendTarget(null);

    const res = sendFriendRequest(progressionRef.current, player1Ref.current, target);
    if (!res.ok || !res.request) return;

    persistProgression(res.progression);
    fetch('/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: res.request.id,
        fromPlayerId: player1Ref.current.id,
        fromFriendCode: res.progression.friendCode,
        fromName: player1Ref.current.name,
        fromAvatar: player1Ref.current.avatar,
        toPlayerId: target.id,
        toFriendCode: target.friendCode,
        toName: target.name,
        toAvatar: target.avatar,
        weeklyPoints: res.progression.weeklyPoints,
        totalPoints: res.progression.totalPoints,
        subtitle: res.progression.equippedTitle,
        isBot: target.isBot,
      }),
    }).catch(() => {});
  };

  const handleAcceptFriendRequest = (requestId: string) => {
    const res = acceptIncomingFriendRequest(progressionRef.current, requestId);
    if (!res.ok || !res.acceptedRequest) return;
    persistProgression(res.progression);
    sounds.playNotification();

    fetch('/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        action: 'accept',
        fromPlayerId: res.acceptedRequest.fromPlayerId,
        fromFriendCode: res.acceptedRequest.fromFriendCode,
        fromName: res.acceptedRequest.fromName,
        fromAvatar: res.acceptedRequest.fromAvatar,
        toPlayerId: player1Ref.current.id,
        toFriendCode: res.progression.friendCode,
        toName: player1Ref.current.name,
        toAvatar: player1Ref.current.avatar,
        responderId: player1Ref.current.id,
        responderFriendCode: res.progression.friendCode,
        responderName: player1Ref.current.name,
        responderAvatar: player1Ref.current.avatar,
        responderWeeklyPoints: res.progression.weeklyPoints,
        responderTotalPoints: res.progression.totalPoints,
        responderSubtitle: res.progression.equippedTitle,
      }),
    }).catch(() => {});
  };

  const handleRejectFriendRequest = (requestId: string) => {
    const res = rejectIncomingFriendRequest(progressionRef.current, requestId);
    if (!res.ok || !res.rejectedRequest) return;
    persistProgression(res.progression);

    fetch('/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        action: 'reject',
        fromPlayerId: res.rejectedRequest.fromPlayerId,
        fromFriendCode: res.rejectedRequest.fromFriendCode,
        fromName: res.rejectedRequest.fromName,
        toPlayerId: player1Ref.current.id,
        toFriendCode: res.progression.friendCode,
        toName: player1Ref.current.name,
      }),
    }).catch(() => {});
  };

  const handleCancelOutgoingRequest = (requestId: string) => {
    const next = cancelOutgoingFriendRequest(progressionRef.current, requestId);
    persistProgression(next);
  };

  const handleRemoveFriendAction = (friendId: string) => {
    const next = removeFriend(progression, friendId);
    persistProgression(next);
  };

  const handleSelectBottomTab = (tab: MainTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  };

  const handleInspectPlayer = useCallback(
    async (
      source:
        | string
        | PublicPlayerProfile
        | LeaguePlayerEntry
        | PlayerProfile
        | {
            id: string;
            name: string;
            avatar: string;
            friendCode?: string;
            weeklyPoints?: number;
            totalPoints?: number;
            subtitle?: string;
          }
    ) => {
      const reqId = ++inspectRequestSeqRef.current;
      const selfProfile = player1Ref.current;
      const selfProg = progressionRef.current;

      const buildSelfPublicProfile = (): PublicPlayerProfile => ({
        id: selfProfile.id,
        friendCode: selfProg.friendCode,
        name: selfProfile.name,
        avatar: selfProfile.avatar,
        favoriteClubId: selfProfile.favoriteClubId,
        subtitle: selfProg.equippedTitle,
        equippedCrest: selfProg.equippedCrest,
        equippedFrame: selfProg.equippedFrame,
        equippedBadge: selfProg.equippedBadge,
        hasCrown: selfProg.unlockedGiftIds.includes('gift_title_legend'),
        weeklyPoints: selfProg.weeklyPoints,
        totalPoints: selfProg.totalPoints,
        matchesPlayed: selfProg.matchesPlayed,
        wins: selfProg.wins,
        losses: selfProg.losses,
        winStreak: selfProg.winStreak,
        bestWinStreak: selfProg.bestWinStreak,
        totalCorrectAnswers: selfProg.totalCorrectAnswers,
        totalWrongAttempts: selfProg.totalWrongAttempts,
        fastestAnswerSec: selfProg.fastestAnswerSec,
        clutchAnswers: selfProg.clutchAnswers,
        minigameMatchCounts: { ...selfProg.minigameMatchCounts },
        dailyStreakDays: selfProg.dailyLogin?.streakDays ?? 0,
        tournamentWins: selfProg.tournamentWins ?? 0,
        tournamentsPlayed: selfProg.tournamentsPlayed ?? 0,
        updatedAt: Date.now(),
        isOnline: true,
      });

      const emptyMinigames: Record<MinigameType, number> = {
        two_clubs: 0,
        silhouette: 0,
        xox: 0,
        career: 0,
        country_club: 0,
      };

      const sourceObj = typeof source === 'string' ? null : (source as Record<string, unknown>);
      const rawIdentifier =
        typeof source === 'string'
          ? source.trim()
          : String(
              sourceObj?.id ||
                sourceObj?.usernameKey ||
                sourceObj?.friendCode ||
                sourceObj?.name ||
                ''
            ).trim();
      const rawName = typeof source === 'string' ? source.trim() : String(sourceObj?.name || '');

      const isSelfTarget =
        rawIdentifier === selfProfile.id ||
        (selfProg.friendCode &&
          rawIdentifier.toUpperCase() === selfProg.friendCode.toUpperCase()) ||
        (rawName && rawName.toLowerCase() === selfProfile.name.toLowerCase());

      if (isSelfTarget) {
        setInspectedProfile(buildSelfPublicProfile());
        setIsInspectingProfile(false);
        return;
      }

      const isBotTarget =
        rawIdentifier.startsWith('bot_') || Boolean(sourceObj?.isBot);

      const liveMatch = liveLeaderboardPlayers.find(
        (p) =>
          p.id === rawIdentifier ||
          (p.friendCode && p.friendCode.toUpperCase() === rawIdentifier.toUpperCase()) ||
          (rawName && p.name.toLowerCase() === rawName.toLowerCase())
      );

      const botSummary = isBotTarget
        ? buildOpponentMiniSummary(
            {
              id: String(sourceObj?.id || rawIdentifier || 'bot_ai'),
              name: String(sourceObj?.name || rawName || 'Bot Rakip'),
              avatar: String(sourceObj?.avatar || '🤖'),
              score: Number(sourceObj?.score ?? player2Ref.current.score ?? 0),
              favoriteClubId:
                typeof sourceObj?.favoriteClubId === 'string'
                  ? sourceObj.favoriteClubId
                  : undefined,
              accountStats: sourceObj?.accountStats as PlayerProfile['accountStats'],
            },
            player2Stats,
            {
              opponentScore: Number(sourceObj?.score ?? player2Ref.current.score ?? 0),
              userScore: player1Ref.current.score ?? 0,
            }
          )
        : null;

      const initialCounts = (sourceObj?.minigameMatchCounts ||
        liveMatch?.minigameMatchCounts ||
        emptyMinigames) as Record<MinigameType, number>;

      const fallbackProfile: PublicPlayerProfile = {
        id: String(sourceObj?.id || liveMatch?.id || rawIdentifier || 'player'),
        usernameKey:
          typeof sourceObj?.usernameKey === 'string'
            ? sourceObj.usernameKey
            : undefined,
        friendCode:
          typeof sourceObj?.friendCode === 'string'
            ? sourceObj.friendCode
            : liveMatch?.friendCode,
        name: String(sourceObj?.name || liveMatch?.name || rawIdentifier || 'Oyuncu'),
        avatar: String(sourceObj?.avatar || liveMatch?.avatar || '⚽'),
        favoriteClubId:
          typeof sourceObj?.favoriteClubId === 'string'
            ? sourceObj.favoriteClubId
            : liveMatch?.favoriteClubId,
        subtitle:
          typeof sourceObj?.subtitle === 'string'
            ? sourceObj.subtitle
            : liveMatch?.subtitle || botSummary?.roleLabel,
        equippedCrest:
          typeof sourceObj?.equippedCrest === 'string'
            ? sourceObj.equippedCrest
            : liveMatch?.equippedCrest,
        equippedFrame:
          typeof sourceObj?.equippedFrame === 'string'
            ? sourceObj.equippedFrame
            : liveMatch?.equippedFrame,
        equippedBadge:
          typeof sourceObj?.equippedBadge === 'string'
            ? sourceObj.equippedBadge
            : liveMatch?.equippedBadge,
        hasCrown: Boolean(sourceObj?.hasCrown ?? liveMatch?.hasCrown),
        weeklyPoints: Number(sourceObj?.weeklyPoints ?? liveMatch?.weeklyPoints ?? 0),
        totalPoints: Number(sourceObj?.totalPoints ?? liveMatch?.totalPoints ?? 0),
        matchesPlayed: Number(
          sourceObj?.matchesPlayed ??
            (sourceObj?.accountStats as { totalMatches?: number } | undefined)?.totalMatches ??
            liveMatch?.matchesPlayed ??
            botSummary?.totalMatches ??
            0
        ),
        wins: Number(
          sourceObj?.wins ??
            (sourceObj?.accountStats as { totalWins?: number } | undefined)?.totalWins ??
            liveMatch?.wins ??
            botSummary?.totalWins ??
            0
        ),
        losses: Number(
          sourceObj?.losses ??
            liveMatch?.losses ??
            (botSummary ? Math.max(0, botSummary.totalMatches - botSummary.totalWins) : 0)
        ),
        winStreak: Number(sourceObj?.winStreak ?? liveMatch?.winStreak ?? 0),
        bestWinStreak: Number(
          sourceObj?.bestWinStreak ?? liveMatch?.bestWinStreak ?? botSummary?.maxStreak ?? 0
        ),
        totalCorrectAnswers: Number(
          sourceObj?.totalCorrectAnswers ??
            liveMatch?.totalCorrectAnswers ??
            botSummary?.totalCorrect ??
            0
        ),
        totalWrongAttempts: Number(
          sourceObj?.totalWrongAttempts ??
            liveMatch?.totalWrongAttempts ??
            botSummary?.totalWrongAttempts ??
            0
        ),
        fastestAnswerSec:
          typeof sourceObj?.fastestAnswerSec === 'number'
            ? sourceObj.fastestAnswerSec
            : liveMatch?.fastestAnswerSec ?? botSummary?.fastestAnswerSec ?? null,
        clutchAnswers: Number(sourceObj?.clutchAnswers ?? liveMatch?.clutchAnswers ?? 0),
        minigameMatchCounts: { ...emptyMinigames, ...initialCounts },
        dailyStreakDays: Number(sourceObj?.dailyStreakDays ?? liveMatch?.dailyStreakDays ?? 0),
        tournamentWins: Number(sourceObj?.tournamentWins ?? liveMatch?.tournamentWins ?? 0),
        tournamentsPlayed: Number(
          sourceObj?.tournamentsPlayed ?? liveMatch?.tournamentsPlayed ?? 0
        ),
        updatedAt: Date.now(),
        isOnline: Boolean(sourceObj?.isOnline),
        isBot: isBotTarget,
      };

      setInspectedProfile(fallbackProfile);

      if (isBotTarget || !rawIdentifier) {
        setIsInspectingProfile(false);
        return;
      }

      setIsInspectingProfile(true);
      try {
        const lookupKey =
          typeof sourceObj?.id === 'string' && sourceObj.id
            ? sourceObj.id
            : rawName || rawIdentifier;
        const res = await fetch(`/api/profiles/${encodeURIComponent(lookupKey)}`);
        if (res.ok) {
          const data = await res.json();
          if (reqId === inspectRequestSeqRef.current && data?.ok && data?.profile) {
            setInspectedProfile({
              ...fallbackProfile,
              ...(data.profile as PublicPlayerProfile),
              isOnline: fallbackProfile.isOnline || (data.profile as PublicPlayerProfile).isOnline,
            });
            setIsInspectingProfile(false);
            return;
          }
        }

        const firestoreKey = rawName || rawIdentifier;
        const remoteProfile = await fetchPublicProfileFromFirestore(firestoreKey);
        if (reqId === inspectRequestSeqRef.current && remoteProfile) {
          setInspectedProfile({
            ...fallbackProfile,
            ...remoteProfile,
            isOnline: fallbackProfile.isOnline,
          });
        }
      } catch {
        // Retain fallbackProfile cleanly when offline
      } finally {
        if (reqId === inspectRequestSeqRef.current) {
          setIsInspectingProfile(false);
        }
      }
    },
    [liveLeaderboardPlayers]
  );

  // V3.0: Check if daily login streak is at risk (missed yesterday) on lobby arrival
  useEffect(() => {
    if (screen !== 'lobby') return;
    if (isLoginStreakAtRisk(progression, v3QuestsState)) {
      setShowStreakSaverModal(true);
    }
  }, [screen, progression, v3QuestsState]);

  const handleClaimPassReward = (tier: number, track: 'free' | 'vip') => {
    const isVip = hasUnlimitedEnergy(progressionRef.current);
    const res = claimFootballPassTierReward(
      tier,
      track,
      isVip,
      progressionRef.current,
      passState
    );
    if (!res.ok) return;
    soundManager.playCoinJingle();
    haptics.correct();
    setPassState(res.passState);
    persistProgression(res.progression);
    syncServerLeaderboard(res.progression, player1Ref.current);
  };

  const handleClaimV3Quest = (questId: string) => {
    const res = claimV3DailyQuestReward(questId, v3QuestsState);
    if (!res.claimed) return;
    soundManager.playCoinJingle();
    haptics.correct();
    setV3QuestsState(res.state);
    const updatedProg = grantExtraRewards(progressionRef.current, res.rewardCoins, 0);
    persistProgression(updatedProg);
    const passRes = awardFootballPassXp(PASS_XP_DAILY_QUEST);
    setPassState(passRes.state);
    syncServerLeaderboard(updatedProg, player1Ref.current);
  };

  const handleClaimV3BigChest = () => {
    const res = claimV3BigDailyChest(v3QuestsState);
    if (!res.claimed) return;
    soundManager.playVictoryFanfare();
    haptics.correct();
    setV3QuestsState(res.state);
    const updatedProg = grantExtraRewards(progressionRef.current, res.rewardCoins, 0);
    persistProgression(updatedProg);
    syncServerLeaderboard(updatedProg, player1Ref.current);
  };

  const handleDoubleV3BigChest = () => {
    const res = doubleV3BigDailyChest(v3QuestsState);
    if (!res.doubled) return;
    soundManager.playCoinJingle();
    haptics.correct();
    setV3QuestsState(res.state);
    const updatedProg = grantExtraRewards(progressionRef.current, res.bonusCoins, 0);
    persistProgression(updatedProg);
    syncServerLeaderboard(updatedProg, player1Ref.current);
  };

  const handleSaveStreakWithAd = () => {
    const restored = saveUserLoginStreakWithYesterday(progressionRef.current);
    persistProgression(restored);
    setShowStreakSaverModal(false);
    soundManager.playCoinJingle();
    haptics.correct();
  };

  const handleSaveStreakWithCoins = () => {
    if (progressionRef.current.coins < STREAK_SAVER_COIN_COST) return;
    const restored = saveUserLoginStreakWithYesterday({
      ...progressionRef.current,
      coins: progressionRef.current.coins - STREAK_SAVER_COIN_COST,
    });
    persistProgression(restored);
    setShowStreakSaverModal(false);
    soundManager.playCoinJingle();
    haptics.correct();
  };

  const handleDismissStreakSaver = () => {
    const nextQ: V3DailyQuestsState = {
      ...v3QuestsState,
      streakSaverDismissedDate: getLocalDateKey(),
    };
    saveV3DailyQuestsState(nextQ);
    setV3QuestsState(nextQ);
    setShowStreakSaverModal(false);
  };

  const handleOpenSpecialEvent = () => {
    setSpecialEventLineup(pickSpecialEventLineup());
    setActiveFriendChallenge(null);
    setSpecialEventMode('weekend_cup');
    setShowSpecialEventModal(true);
  };

  const handleStartSpecialEventEntry = (entryType: 'free' | 'ad' | 'coin'): boolean => {
    if (entryType === 'free' && !canUseFreeSpecialEventEntry(specialEventState)) {
      return false;
    }
    if (entryType === 'coin') {
      if (progressionRef.current.coins < SPECIAL_EVENT_COIN_COST) return false;
      const deducted: UserProgression = {
        ...progressionRef.current,
        coins: progressionRef.current.coins - SPECIAL_EVENT_COIN_COST,
      };
      persistProgression(deducted);
    }
    const nextEv = markSpecialEventEntryUsed(entryType, specialEventState);
    setSpecialEventState(nextEv);
    return true;
  };

  const handleCompleteSpecialEvent = (result: {
    mode: 'weekend_cup' | 'friend_challenge';
    correctCount: number;
    totalStars: number;
    elapsedSec: number;
    wonJackpot: boolean;
  }) => {
    if (result.mode === 'weekend_cup') {
      const nextEv = recordSpecialEventFinish(result.wonJackpot, specialEventState);
      setSpecialEventState(nextEv);
      const rewardCoins = result.wonJackpot
        ? SPECIAL_EVENT_JACKPOT_COINS
        : result.correctCount * 40;
      if (rewardCoins > 0) {
        const updatedProg = grantExtraRewards(progressionRef.current, rewardCoins, 50);
        persistProgression(updatedProg);
        syncServerLeaderboard(updatedProg, player1Ref.current);
      }
      if (result.wonJackpot) {
        const passRes = awardFootballPassXp(PASS_XP_MATCH_WIN);
        setPassState(passRes.state);
      }
    } else if (activeFriendChallenge) {
      const beatFriend =
        result.correctCount >= result.totalStars &&
        result.elapsedSec <= activeFriendChallenge.challengerTimeSec;
      const rewardCoins = beatFriend ? 250 : result.correctCount * 25;
      if (rewardCoins > 0) {
        const updatedProg = grantExtraRewards(progressionRef.current, rewardCoins, 25);
        persistProgression(updatedProg);
        syncServerLeaderboard(updatedProg, player1Ref.current);
      }
    }
  };

  const pendingFriendRequestsCount = getPendingIncomingRequestCount(progression);
  const hasClaimableGift =
    canClaimDailyReward(progression) ||
    progression.dailyQuests.some((q) => !q.claimed && q.progress >= q.target) ||
    getClaimableAchievementsCount(achievementsState) > 0;
  const userClub = player1.favoriteClubId ? CLUBS[player1.favoriteClubId] : null;
  const tabHeaderTitle: Record<MainTab, string> = {
    play: '3-2-1 FUTBOL',
    stats: t('tabStatsTitle'),
    friends: t('tabFriendsTitle'),
    league: t('tabLeagueTitle'),
    profile: t('tabProfileTitle'),
  };

  const isOnlineMode = mode === 'online_match' || mode === 'online_room';
  const currentRound = isOnlineMode ? onlineRound : rounds[currentRoundIndex] || rounds[0];

  return (
    <main
      data-testid="app-container"
      data-state={screen}
      className="relative min-h-[100dvh] w-full flex flex-col bg-slate-950 font-sans selection:bg-emerald-500 selection:text-black overflow-x-clip text-white"
    >
      {/* Screen 0: Animated Intro / Splash Screen */}
      {screen === 'intro' && (
        <AnimatedIntro
          onEnter={handleIntroEnter}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      )}

      {/* Screen 1: Main Hub (5 Tabs + Fixed Bottom Navigation Bar) */}
      {screen === 'lobby' && (
        <>
          <div key="screen-lobby" className="w-full flex-1 flex flex-col animate-screen-fade">
            {activeTab === 'play' ? (
              <LobbyScreen
                playerProfile={player1}
                progression={progression}
                onSelectMode={(selectedMode, options) => {
                  setOnlineError(null);
                  if (selectedMode === 'online_match' || selectedMode === 'online_room') {
                    handleSelectOnlineMode(selectedMode, options);
                  } else {
                    startBotMatch(
                      options?.botDifficulty || 'medium',
                      options?.minigameType || 'two_clubs'
                    );
                  }
                }}
                onOpenSettings={() => setShowSettingsModal(true)}
                onOpenDailyRewards={() => setShowDailyModal(true)}
                onOpenQuests={() => handleSelectBottomTab('profile')}
                onOpenStore={handleOpenStore}
                onOpenEnergy={() => setShowEnergyModal(true)}
                onOpenTournament={() => setShowTournamentModal(true)}
                onOpenDailyChallenge={() => {
                  if (!canPlayDailyChallengeNow(progressionRef.current)) return;
                  setShowDailyChallengeModal(true);
                }}
                onOpenDailyWheel={() => setShowDailyWheelModal(true)}
                onOpenV3Quests={() => setShowV3QuestsModal(true)}
                onToggleMute={toggleSoundMute}
                isMuted={isMuted}
                uiTheme={uiTheme}
                onToggleTheme={handleToggleTheme}
                v3ClaimableQuestsCount={getV3ClaimableQuestsCount(v3QuestsState)}
                hasFreeWheelSpin={canUseFreeWheelSpin(progression)}
                pendingFriendRequestsCount={pendingFriendRequestsCount}
                activeTournamentStageLabel={
                  activeTournament && activeTournament.status === 'active'
                    ? getTournamentMatchForUser(activeTournament, player1.id).stageLabel
                    : null
                }
                onExitApp={handlePromptExitApp}
                isNetworkOnline={isNetworkOnline}
                onlineError={onlineError}
                onClearOnlineError={() => setOnlineError(null)}
              />
            ) : (
              <div className="relative min-h-[100dvh] w-full flex flex-col bg-slate-950 text-white overflow-x-clip">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-950 to-slate-950 pointer-events-none" />

                {/* Shared Hub Top Header for Secondary Tabs (Mobile Safe-Area, Crisp High-Contrast, Zero Blur) */}
                <header className="sticky top-0 z-40 isolate w-full bg-slate-950 border-b border-slate-800 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.45rem))] pb-2">
                  <div className="w-full max-w-xl mx-auto px-3 sm:px-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!headerLogoError ? (
                        <img
                          src={`${import.meta.env.BASE_URL}logo.png`}
                          alt="3-2-1 Futbol Logosu"
                          onError={() => setHeaderLogoError(true)}
                          className="w-8 h-8 rounded-xl object-cover border border-amber-400/60 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center border border-amber-300/60 shrink-0">
                          321
                        </div>
                      )}
                      <span
                        data-testid="tab-header-title"
                        className="font-black tracking-tight text-white text-sm sm:text-base whitespace-nowrap shrink-0"
                      >
                        {tabHeaderTitle[activeTab]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid="header-store-btn"
                        onClick={() => handleOpenStore('featured')}
                        className="min-w-[36px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] px-2 sm:px-2.5 py-1.5 rounded-xl bg-amber-400/25 hover:bg-amber-400/35 border border-amber-400/60 text-amber-300 text-xs font-black flex items-center justify-center gap-1 cursor-pointer touch-manipulation shrink-0"
                        aria-label={t('store')}
                        title={t('store')}
                      >
                        <ShoppingBag className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">{t('store')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowDailyModal(true)}
                        className="flex items-center gap-1 min-h-[38px] sm:min-h-[42px] px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/45 text-[11px] sm:text-xs font-black text-amber-400 font-mono cursor-pointer touch-manipulation whitespace-nowrap shrink-0"
                        title="Coin Bakiyesi & Günlük Seri"
                      >
                        <CoinIcon size="xs" />
                        <span>{formatPoints(progression.coins)}</span>
                        <span className="text-slate-600 hidden sm:inline">•</span>
                        <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0 hidden sm:inline" />
                        <span className="text-orange-400 hidden sm:inline">{progression.dailyLogin.streakDays}</span>
                      </button>

                      <button
                        type="button"
                        data-testid="tab-header-energy-indicator"
                        onClick={() => setShowEnergyModal(true)}
                        title={t('energyLabel')}
                        aria-label={t('energyLabel')}
                        className={`flex items-center gap-1 min-h-[38px] sm:min-h-[42px] px-2 py-1.5 rounded-xl border text-[11px] sm:text-xs font-black font-mono whitespace-nowrap shrink-0 cursor-pointer touch-manipulation ${
                          hasUnlimitedEnergy(progression)
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                            : getEffectiveDailyEnergy(progression) <= 0
                            ? 'bg-rose-950 border-rose-400 text-rose-200 animate-pulse'
                            : 'bg-slate-900 hover:bg-slate-800 border-cyan-400/60 text-cyan-300'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">
                          {hasUnlimitedEnergy(progression)
                            ? '∞'
                            : `${getEffectiveDailyEnergy(progression)}/${MAX_DAILY_ENERGY}`}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid="header-settings-btn"
                        onClick={() => setShowSettingsModal(true)}
                        className="min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer touch-manipulation"
                        title={t('settings')}
                        aria-label={t('settings')}
                      >
                        <Settings className="w-4 h-4 text-emerald-400" />
                      </button>

                      <button
                        type="button"
                        data-testid="header-exit-btn"
                        onClick={handlePromptExitApp}
                        className="flex min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] p-2 rounded-xl bg-slate-900/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500 text-slate-400 hover:text-rose-400 items-center justify-center cursor-pointer touch-manipulation"
                        title="Oyundan Çıkış"
                        aria-label="Oyundan Çıkış"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </header>

                <div className="relative z-10 flex-1 w-full pb-[env(safe-area-inset-bottom)]">
                  {activeTab === 'stats' && (
                    <StatsView
                      playerProfile={player1}
                      progression={progression}
                      liveServerPlayers={liveLeaderboardPlayers}
                      onInspectPlayer={handleInspectPlayer}
                    />
                  )}
                  {activeTab === 'friends' && (
                    <FriendsView
                      progression={progression}
                      selfPlayerId={player1.id}
                      liveServerPlayers={liveLeaderboardPlayers}
                      onInspectPlayer={handleInspectPlayer}
                      onAddFriend={handleRequestAddFriend}
                      onAcceptFriendRequest={handleAcceptFriendRequest}
                      onRejectFriendRequest={handleRejectFriendRequest}
                      onCancelOutgoingRequest={handleCancelOutgoingRequest}
                      onRemoveFriend={handleRemoveFriendAction}
                      onChallengeFriend={(mg) =>
                        handleSelectOnlineMode('online_room', { minigameType: mg })
                      }
                    />
                  )}
                  {activeTab === 'league' && (
                    <LeagueView
                      playerProfile={player1}
                      progression={progression}
                      liveServerPlayers={liveLeaderboardPlayers}
                      onInspectPlayer={handleInspectPlayer}
                      onDismissSeasonNotice={() =>
                        persistProgression(dismissLeagueSeasonNotice(progressionRef.current))
                      }
                      onGoPlay={() => handleSelectBottomTab('play')}
                    />
                  )}
                  {activeTab === 'profile' && (
                    <ProfileView
                      playerProfile={player1}
                      progression={progression}
                      careerStats={careerStats}
                      achievementsState={achievementsState}
                      cloudUser={
                        firebaseUser
                          ? {
                              uid: firebaseUser.uid,
                              email: firebaseUser.email,
                              displayName: firebaseUser.displayName,
                              emailVerified: firebaseUser.emailVerified,
                              isAnonymous: firebaseUser.isAnonymous,
                              isGoogleLinked: firebaseUser.providerData.some(
                                (p) => p.providerId === 'google.com'
                              ),
                            }
                          : null
                      }
                      onGoogleSignIn={handleGoogleSignIn}
                      onOpenAuth={(tab) => {
                        setAuthModalTab(tab || 'profile');
                        setShowAuthModal(true);
                      }}
                      onSelectAvatar={(av) => {
                        handleUpdateProfile({ avatar: av });
                        syncServerLeaderboard(progression, { ...player1, avatar: av });
                      }}
                      onClaimDailyReward={handleClaimDailyRewardAction}
                      onClaimDailyQuest={handleClaimDailyQuestAction}
                      onClaimAchievementReward={handleClaimAchievementReward}
                      onPurchaseGift={handlePurchaseGiftAction}
                      onPurchaseStoreItem={handlePurchaseStoreItemAction}
                      onOpenStore={handleOpenStore}
                      onEquipItem={handleEquipStoreItemAction}
                      onSelectDefaultPitchTheme={handleSelectDefaultPitchTheme}
                      onDeleteAccount={handleDeleteAccount}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <BottomNavBar
            activeTab={activeTab}
            onSelectTab={handleSelectBottomTab}
            hasClaimableGift={hasClaimableGift}
            pendingFriendRequestsCount={pendingFriendRequestsCount}
          />
        </>
      )}

      {/* Screen 2: Online Room / Matchmaking Waiting */}
      {screen === 'room_waiting' && (
        <div key="screen-room" className="w-full flex-1 flex flex-col animate-screen-slide">
          <OnlineRoomView
            roomCode={roomCode}
            minigameType={minigameType}
            isMatchmaking={isMatchmaking}
            player1={player1}
            player2={player2.id !== 'p2' ? player2 : null}
            onInspectPlayer={handleInspectPlayer}
            onCancel={handleExitToLobby}
          />
        </div>
      )}

      {/* Screen 3: Playing Match */}
      {screen === 'playing' && currentRound && (
        <div
          key={`screen-playing-${mode}-${currentRound.minigameType}`}
          data-testid="match-viewport-container"
          style={
            matchViewportHeight
              ? { height: `${matchViewportHeight}px`, maxHeight: `${matchViewportHeight}px` }
              : undefined
          }
          className="relative h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between overflow-hidden animate-screen-slide"
        >
          <NightMatchPitchBackground theme={progression.equippedPitchTheme} />

          <div className="relative z-10 flex flex-col flex-1 min-h-0 justify-between overflow-hidden">
            <ScoreBoard
              player1={player1}
              player2={player2}
              roundNumber={currentRoundIndex + 1}
              totalRounds={10}
              timeRemaining={timeRemaining}
              minigameType={currentRound.minigameType}
              fastComboStreak={fastComboStreak}
              player1Frame={progression.equippedFrame}
              player1Crest={progression.equippedCrest}
              player1Badge={progression.equippedBadge}
              onOpenSettings={() => setShowSettingsModal(true)}
              onExit={handlePromptExitMatch}
            />

            <CountdownOverlay
              countdown={countdown}
              minigameType={currentRound.minigameType}
            />

            {currentRound.minigameType === 'two_clubs' && currentRound.pairing ? (
              <SinglePlayerView
                pairing={currentRound.pairing}
                player1={player1}
                player2={player2}
                isBotMatch={mode === 'bot'}
                isOnlineMatch={isOnlineMode}
                botDifficulty={botDiff}
                energyDrinks={progression.energyDrinks ?? 0}
                extraTimeCards={progression.extraTimeCards ?? 0}
                userCoins={progression.coins}
                freeJokerTickets={progression.freeJokerTickets ?? 0}
                roundSeed={`${matchInstanceIdRef.current}-${currentRoundIndex}-${currentRound.pairing.id}`}
                onSpendCoinsForJoker={handleSpendCoinsForJoker}
                onUseEnergyDrinkHint={handleUseEnergyDrinkHint}
                onUseEnergyDrinkPass={handleUseEnergyDrinkPass}
                onUseExtraTimeCard={handleUseExtraTimeCard}
                onOpenStore={() => handleOpenStore('featured')}
                onAnswerWinner={handleAnswerWinner}
                onSubmitOnlineAnswer={(ans) => handleSubmitOnlineAnswer(ans)}
                serverWrongFeedback={serverWrongFeedback}
                opponentMissedPulse={opponentMissedPulse}
                onWrongAttempt={() => handleWrongAttempt(player1.id)}
                onTimeExpired={handleRoundTimeExpired}
                disabled={!isRoundPlaying}
              />
            ) : (
              <MinigameArenaView
                round={currentRound}
                roundKey={`${currentRoundIndex}-${currentRound.minigameType}-${currentRound.silhouette?.id || currentRound.career?.id || currentRound.countryClub?.id || currentRound.xoxBoard?.id || 'r'}`}
                player1={player1}
                player2={player2}
                isBotMatch={mode === 'bot'}
                isOnlineMatch={isOnlineMode}
                botDifficulty={botDiff}
                timeRemaining={timeRemaining}
                disabled={!isRoundPlaying}
                energyDrinks={progression.energyDrinks ?? 0}
                extraTimeCards={progression.extraTimeCards ?? 0}
                userCoins={progression.coins}
                freeJokerTickets={progression.freeJokerTickets ?? 0}
                roundSeed={`${matchInstanceIdRef.current}-${currentRoundIndex}-${currentRound.minigameType}-${currentRound.silhouette?.id || currentRound.career?.id || currentRound.countryClub?.id || currentRound.xoxBoard?.id || 'r'}`}
                onSpendCoinsForJoker={handleSpendCoinsForJoker}
                onUseEnergyDrinkHint={handleUseEnergyDrinkHint}
                onUseEnergyDrinkPass={handleUseEnergyDrinkPass}
                onUseExtraTimeCard={handleUseExtraTimeCard}
                onOpenStore={() => handleOpenStore('featured')}
                onAnswerWinner={handleAnswerWinner}
                onSubmitOnlineAnswer={handleSubmitOnlineAnswer}
                serverWrongFeedback={serverWrongFeedback}
                opponentMissedPulse={opponentMissedPulse}
                onWrongAttempt={() => handleWrongAttempt(player1.id)}
                onSilhouetteExhausted={handleSilhouetteExhausted}
                onlineSilhouetteExhausted={onlineSilhouetteExhausted}
                xoxState={xoxState}
                xoxNotice={xoxNotice}
                onSoloXoxMove={handleSoloXoxMove}
              />
            )}

            {showResultSheet && (
              <RoundResultSheet
                round={currentRound}
                winnerPlayer={roundWinnerPlayer}
                player1Id={player1.id}
                acceptedAnswer={acceptedAnswerText}
                isTimeExpired={isTimeExpired}
                endReason={roundEndReason}
                roundIndex={currentRoundIndex + 1}
                totalRounds={10}
                goalEffect={progression.equippedGoalEffect}
                roundReward={lastRoundReward}
                roundDoubled={roundDoubledByAd}
                onRequestDoubleRound={handleRequestDoubleRound}
              />
            )}
          </div>
        </div>
      )}

      {/* Screen 4: Victory / Game Over Modal with Achievements & Badges */}
      {screen === 'game_over' && (
        <VictoryModal
          key="screen-game-over"
          player1={player1}
          player2={player2}
          player1Stats={player1Stats}
          player2Stats={player2Stats}
          matchHighlights={matchHighlights}
          isOnlineMatch={isOnlineMode}
          rematchState={rematchState}
          matchRewards={lastMatchRewards}
          player1Frame={progression.equippedFrame}
          goalEffect={progression.equippedGoalEffect}
          energyDeltaLabel={lastMatchEnergyDeltaLabel}
          userLeagueName={getLeagueTierInfo(progression.leagueTierId).name}
          userLeagueIcon={getLeagueTierInfo(progression.leagueTierId).icon}
          onRequestDoubleMatchReward={handleRequestDoubleMatchReward}
          doubleRewardAdLoading={matchDoubleAdLoading}
          onRequestRematchAd={handleRequestRematchAd}
          onInspectOpponent={(opp) => handleInspectPlayer(opp)}
          onRematch={handleRematch}
          onHome={handleExitToLobby}
        />
      )}

      {/* Daily Check-in & Streak Modal */}
      <DailyRewardsModal
        isOpen={showDailyModal}
        progression={progression}
        onClaim={handleClaimDailyRewardAction}
        onClose={() => setShowDailyModal(false)}
        onOpenWheel={() => setShowDailyWheelModal(true)}
        hasFreeWheelSpin={canUseFreeWheelSpin(progression)}
      />

      {/* Career Achievements (Başarımlar) Modal */}
      <AchievementsModal
        isOpen={showAchievementsModal}
        achievementsState={achievementsState}
        onClaimReward={handleClaimAchievementReward}
        onClose={() => setShowAchievementsModal(false)}
      />

      {/* V3.0 Football Pass (15-Tier Season Track) Modal */}
      <FootballPassModal
        isOpen={showFootballPassModal}
        passState={passState}
        isVipUnlocked={hasUnlimitedEnergy(progression)}
        onClaimReward={handleClaimPassReward}
        onUnlockVipPass={() => {
          setShowFootballPassModal(false);
          handleOpenStore('ads_coins');
        }}
        onClose={() => setShowFootballPassModal(false)}
      />

      {/* V3.0 Dynamic Daily Quests & Big Chest Modal */}
      <DailyQuestsModal
        isOpen={showV3QuestsModal}
        questsState={v3QuestsState}
        adFree={Boolean(progression.adFree)}
        onClaimQuest={handleClaimV3Quest}
        onClaimBigChest={handleClaimV3BigChest}
        onDoubleBigChest={handleDoubleV3BigChest}
        onClose={() => setShowV3QuestsModal(false)}
      />

      {/* V3.0 Daily Streak Saver Modal */}
      <StreakSaverModal
        isOpen={showStreakSaverModal}
        streakDays={progression.dailyLogin.streakDays}
        userCoins={progression.coins}
        adFree={Boolean(progression.adFree)}
        onSaveWithAd={handleSaveStreakWithAd}
        onSaveWithCoins={handleSaveStreakWithCoins}
        onDismiss={handleDismissStreakSaver}
      />

      {/* V3.0 In-Match Dramatic 4s Last Chance Popup */}
      <LastChanceModal
        isOpen={showLastChanceModal}
        isVip={hasUnlimitedEnergy(progression)}
        onReviveSuccess={handleLastChanceRevive}
        onGiveUp={handleLastChanceGiveUp}
      />

      {/* V3.0 Weekend Special Cup & Friend Challenge Modal */}
      <SpecialEventModal
        isOpen={showSpecialEventModal}
        mode={specialEventMode}
        lineup={specialEventLineup}
        eventState={specialEventState}
        userCoins={progression.coins}
        adFree={Boolean(progression.adFree)}
        friendChallenge={activeFriendChallenge}
        onStartEntry={handleStartSpecialEventEntry}
        onCompleteEvent={handleCompleteSpecialEvent}
        onClose={() => setShowSpecialEventModal(false)}
      />

      {/* Achievement Unlocked Toast Notification */}
      {achievementToast && (
        <div
          data-testid="achievement-unlocked-toast"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-2rem)] max-w-sm p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/95 to-slate-900 border border-amber-400/75 shadow-[0_0_28px_rgba(251,191,36,0.35)] flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-xl shrink-0">
            {achievementToast.icon}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-wider text-amber-300">
              🏆 Başarım Açıldı!
            </span>
            <span className="block text-sm font-black text-white truncate">
              {achievementToast.title}
            </span>
            <span className="block text-[11px] font-semibold text-emerald-300">
              +{achievementToast.rewardCoins} Coin ödülün Profil → Başarımlar sekmesinde hazır!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAchievementToast(null)}
            className="text-slate-400 hover:text-white text-xs font-black px-1.5 py-1"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
      )}

      {/* Daily Challenge (Günlük Meydan Okuma) Modal */}
      <DailyChallengeModal
        isOpen={showDailyChallengeModal}
        progression={progression}
        onClose={() => setShowDailyChallengeModal(false)}
        onCompleteDailyChallenge={handleCompleteDailyChallenge}
      />

      {/* Daily Fortune Wheel (Günlük Kader Çarkı) Modal */}
      <DailyWheelModal
        isOpen={showDailyWheelModal}
        progression={progression}
        onCommitSpin={handleCommitWheelSpin}
        onClose={() => setShowDailyWheelModal(false)}
      />

      {/* Daily Energy Depleted / Info Modal */}
      <EnergyEmptyModal
        isOpen={showEnergyModal}
        currentEnergy={getEffectiveDailyEnergy(progression)}
        energyDrinks={progression.energyDrinks ?? 0}
        isVipUnlimited={hasUnlimitedEnergy(progression)}
        onClose={() => setShowEnergyModal(false)}
        onGrantAdEnergy={handleGrantAdEnergy}
        onUseEnergyDrink={handleUseEnergyDrinkForMatch}
        onGoToStore={() => handleOpenStore('featured')}
      />

      {/* Full In-Game Store Modal */}
      <StoreModal
        key={storeCategory}
        isOpen={showStoreModal}
        playerProfile={player1}
        progression={progression}
        initialCategory={storeCategory}
        onClose={() => setShowStoreModal(false)}
        onPurchaseItem={handlePurchaseStoreItemAction}
        onEquipItem={handleEquipStoreItemAction}
        onWatchAdForCoins={handleWatchAdForStoreCoins}
        onRestorePurchases={handleRestorePurchases}
      />

      {/* 8-Player Knockout Tournament Modal */}
      <TournamentModal
        isOpen={showTournamentModal}
        playerProfile={player1}
        progression={progression}
        activeBracket={activeTournament}
        initialFriendCode={pendingInviteTournament}
        onClose={() => {
          setShowTournamentModal(false);
          setPendingInviteTournament(null);
        }}
        onStartOpenTournament={handleStartOpenTournament}
        onStartFriendTournament={handleStartFriendTournament}
        onPayFriendTournamentEntry={handlePayFriendTournamentEntry}
        onPlayNextMatch={handlePlayNextTournamentMatch}
        onResetBracket={() => setActiveTournament(null)}
      />

      {/* Interstitial Ad Modal (Every 3 completed matches for non-VIP users) */}
      <InterstitialAdModal
        isOpen={Boolean(interstitialAdState)}
        adUnitId={interstitialAdState?.adUnitId}
        onDismiss={() => {
          const resolve = interstitialAdState?.resolve;
          setInterstitialAdState(null);
          resolve?.();
        }}
      />

      {/* Rewarded Ad Modal (2x Rewards, +250 Store Coins, Loss Rematch Unlock) */}
      <RewardedAdModal
        isOpen={Boolean(pendingAdReward)}
        adFree={
          pendingAdReward?.scope === 'store_coins' ? false : Boolean(progression.adFree)
        }
        adPurpose={
          pendingAdReward?.scope === 'store_coins'
            ? 'free_coins'
            : pendingAdReward?.scope === 'rematch_unlock'
            ? 'rematch_unlock'
            : 'double_match_reward'
        }
        badgeText={
          pendingAdReward?.scope === 'store_coins'
            ? 'ÜCRETSİZ ÖDÜLLÜ REKLAM'
            : pendingAdReward?.scope === 'rematch_unlock'
            ? 'RÖVANŞ REKLAMI'
            : undefined
        }
        title={
          pendingAdReward?.scope === 'store_coins'
            ? 'Ücretsiz +250 Coin Kazan!'
            : pendingAdReward?.scope === 'rematch_unlock'
            ? 'Rövanş Hakkını Aç!'
            : undefined
        }
        ctaLabel={
          pendingAdReward?.scope === 'store_coins'
            ? '+250 Coin Hesaba Ekle!'
            : pendingAdReward?.scope === 'rematch_unlock'
            ? 'Rövanş Maçını Başlat!'
            : undefined
        }
        rewardLabel={
          pendingAdReward
            ? pendingAdReward.scope === 'store_coins'
              ? '+250 Ücretsiz Coin'
              : pendingAdReward.scope === 'rematch_unlock'
              ? 'Anında Rövanş Maçı Hakkı'
              : `+${pendingAdReward.coins} Coin & +${pendingAdReward.points} Puan`
            : ''
        }
        onComplete={handleCompleteRewardedAd}
        onClose={handleCloseRewardedAd}
      />

      {/* Global Settings Modal (Sound + Language + Official Auth & Cloud Sync) */}
      <SettingsModal
        isOpen={showSettingsModal}
        isMuted={isMuted}
        uiTheme={uiTheme}
        progression={progression}
        cloudUser={
          firebaseUser && !firebaseUser.isAnonymous
            ? {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                emailVerified: firebaseUser.emailVerified,
              }
            : null
        }
        isSyncingCloud={isSyncingCloud}
        onToggleMute={toggleSoundMute}
        onToggleTheme={handleToggleTheme}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        onSyncCloudNow={handleSyncCloudNow}
        onSendVerificationEmail={sendVerificationEmailToCurrentUser}
        onRestorePurchases={handleRestorePurchases}
        onDeleteAccount={handleDeleteAccount}
        onUnlinkSocial={handleUnlinkSocialAction}
        onOpenTutorial={() => {
          setShowSettingsModal(false);
          setShowOnboardingModal(true);
        }}
        onExitApp={screen === 'lobby' ? handlePromptExitApp : undefined}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* First-Launch 3-Step Swipeable Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        initialClubId={player1.favoriteClubId}
        onComplete={(selectedClubId) => {
          setShowOnboardingModal(false);
          handleUpdateProfile({ favoriteClubId: selectedClubId });
          logTelemetryEvent('onboarding_completed', { clubId: selectedClubId });
        }}
      />

      {/* Auth / Account Profile Modal */}
      {showAuthModal && (
        <AuthModal
          currentProfile={player1}
          progression={progression}
          googleUid={firebaseUser && !firebaseUser.isAnonymous ? firebaseUser.uid : null}
          initialTab={authModalTab}
          onSaveProfile={handleSaveProfile}
          onGoogleSignIn={handleGoogleSignIn}
          onPurchaseGift={handlePurchaseGiftAction}
          onClose={() => {
            setShowAuthModal(false);
            if (screen === 'intro') setScreen('lobby');
          }}
          isInitialRequired={screen === 'intro'}
        />
      )}

      {/* Public Player Profile & Full Stats Inspector */}
      <PublicProfileModal
        isOpen={Boolean(inspectedProfile)}
        profile={inspectedProfile}
        isLoading={isInspectingProfile}
        isSelf={Boolean(
          inspectedProfile &&
            (inspectedProfile.id === player1.id ||
              inspectedProfile.name.toLowerCase() === player1.name.toLowerCase())
        )}
        isFriend={Boolean(
          inspectedProfile &&
            progression.friends.some(
              (f) =>
                f.id === inspectedProfile.id ||
                (inspectedProfile.friendCode &&
                  f.friendCode.toUpperCase() === inspectedProfile.friendCode.toUpperCase())
            )
        )}
        isPendingFriend={Boolean(
          inspectedProfile && hasPendingOutgoingRequest(progression, inspectedProfile)
        )}
        currentUserStats={{
          matchesPlayed: progression.matchesPlayed,
          wins: progression.wins,
          winRate:
            progression.matchesPlayed > 0
              ? Math.round((progression.wins / progression.matchesPlayed) * 100)
              : 0,
          totalPoints: progression.totalPoints,
          fastestAnswerSec: progression.fastestAnswerSec,
        }}
        onAddFriend={handleRequestAddFriend}
        onChallengePlayer={(mg) => {
          setInspectedProfile(null);
          handleSelectOnlineMode('online_room', { minigameType: mg });
        }}
        onClose={() => setInspectedProfile(null)}
      />

      {/* Friend Request Confirmation Modal (Stage 1 of 3-Stage Friend Flow) */}
      <FriendRequestConfirmModal
        isOpen={Boolean(pendingFriendTarget)}
        target={pendingFriendTarget}
        onConfirm={handleConfirmSendFriendRequest}
        onCancel={() => setPendingFriendTarget(null)}
      />

      {/* Live Friend Activity Toasts */}
      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
        onAction={(toast) => {
          if (toast.type === 'tournament_started') {
            if (toast.tournamentCode) {
              setPendingInviteTournament(toast.tournamentCode);
            }
            setShowTournamentModal(true);
          } else if (toast.type === 'high_score' && (toast.actorId || toast.actorName)) {
            handleInspectPlayer({
              id: toast.actorId || toast.actorName,
              friendCode: toast.actorFriendCode,
              name: toast.actorName,
              avatar: toast.actorAvatar,
            });
          }
        }}
      />

      {/* Exit Confirmation Dialog */}
      <ConfirmExitModal
        isOpen={showExitConfirm}
        onConfirm={handleConfirmExit}
        onCancel={handleCancelExit}
        title="Çıkmak istediğinize emin misiniz?"
        description={
          exitTarget === 'intro'
            ? 'Ana giriş ekranına dönülecektir.'
            : 'Devam eden maçınız sonlanacaktır.'
        }
      />
    </main>
  );
}
