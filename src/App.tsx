/**
 * 3-2-1 Football Challenge
 * Modern, mobile-first, competitive football trivia duel game.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Coins, Flame, LogOut, Settings, ShoppingBag, UserCheck } from 'lucide-react';
import {
  GameMode,
  BotDifficulty,
  MinigameType,
  MinigameRoundPayload,
  PlayerProfile,
  MatchPlayerStats,
  XoxRuntimeState,
  MainTab,
  UserProgression,
  LeaguePlayerEntry,
  StoreCategory,
  SocialProvider,
  TournamentBracketState,
  TournamentParticipant,
} from './game/types';
import { CLUBS } from './game/database';
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
import { getPitchThemeStyle } from './game/storeCatalog';
import {
  addFriendByCodeOrEntry,
  awardTournamentChampionPrize,
  canClaimDailyReward,
  claimDailyQuest,
  claimDailyReward,
  consumeEnergyDrink,
  createInitialProgression,
  enterTournamentWithCoins,
  equipStoreItem,
  formatPoints,
  grantExtraRewards,
  linkSocialAccount,
  purchaseGift,
  purchaseStoreItem,
  recordMatchOutcome,
  removeFriend,
  syncProgressionForToday,
  unlinkSocialAccount,
} from './game/retentionEngine';
import { sounds } from './utils/audio';

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
import { StoreModal } from './components/StoreModal';
import { RewardedAdModal } from './components/RewardedAdModal';
import { TournamentModal } from './components/TournamentModal';
import { SettingsModal } from './components/SettingsModal';
import { StatsView } from './components/StatsView';
import { FriendsView } from './components/FriendsView';
import { LeagueView } from './components/LeagueView';
import { ProfileView } from './components/ProfileView';
import { ClubLogo } from './components/ClubLogo';
import { useLanguage } from './game/LanguageContext';

type AppScreen = 'intro' | 'lobby' | 'room_waiting' | 'playing' | 'game_over';

function loadInitialProgression(playerId: string): UserProgression {
  const fallback = createInitialProgression(playerId);
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem('football_user_progression');
    if (!raw) {
      localStorage.setItem('football_user_progression', JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<UserProgression>;
    const merged: UserProgression = {
      ...fallback,
      ...parsed,
      minigameMatchCounts: {
        ...fallback.minigameMatchCounts,
        ...(parsed.minigameMatchCounts || {}),
      },
      dailyLogin: {
        ...fallback.dailyLogin,
        ...(parsed.dailyLogin || {}),
      },
      dailyQuests:
        Array.isArray(parsed.dailyQuests) && parsed.dailyQuests.length > 0
          ? parsed.dailyQuests
          : fallback.dailyQuests,
      unlockedGiftIds: Array.isArray(parsed.unlockedGiftIds)
        ? parsed.unlockedGiftIds
        : fallback.unlockedGiftIds,
      linkedAccounts: Array.isArray(parsed.linkedAccounts)
        ? parsed.linkedAccounts
        : fallback.linkedAccounts,
      friends: Array.isArray(parsed.friends)
        ? parsed.friends.filter((f) => f && !String(f.id).startsWith('rival_'))
        : fallback.friends,
    };
    const synced = syncProgressionForToday(merged);
    localStorage.setItem('football_user_progression', JSON.stringify(synced));
    return synced;
  } catch {
    return fallback;
  }
}

function getOrCreateSessionPlayerId(): string {
  if (typeof window === 'undefined') return 'p1';
  try {
    const existing = sessionStorage.getItem('football_session_player_id');
    if (existing) return existing;
    const generated = `u_${Math.random().toString(36).slice(2, 10)}`;
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
  const [isMuted, setIsMuted] = useState<boolean>(sounds.getMuted());
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [exitTarget, setExitTarget] = useState<'lobby' | 'intro'>('lobby');

  const sessionPlayerIdRef = useRef<string>(getOrCreateSessionPlayerId());
  const [activeTab, setActiveTab] = useState<MainTab>('play');
  const [progression, setProgression] = useState<UserProgression>(() =>
    loadInitialProgression(sessionPlayerIdRef.current)
  );
  const [showDailyModal, setShowDailyModal] = useState<boolean>(false);
  const [showStoreModal, setShowStoreModal] = useState<boolean>(false);
  const [storeCategory, setStoreCategory] = useState<StoreCategory>('featured');
  const [showTournamentModal, setShowTournamentModal] = useState<boolean>(false);
  const [activeTournament, setActiveTournament] = useState<TournamentBracketState | null>(null);
  const [pendingInviteTournament, setPendingInviteTournament] = useState<string | null>(null);
  const [pendingAdReward, setPendingAdReward] = useState<{
    scope: 'round' | 'match';
    coins: number;
    points: number;
  } | null>(null);
  const [lastRoundReward, setLastRoundReward] = useState<{
    coins: number;
    points: number;
  } | null>(null);
  const [roundDoubledByAd, setRoundDoubledByAd] = useState<boolean>(false);
  const [liveLeaderboardPlayers, setLiveLeaderboardPlayers] = useState<LeaguePlayerEntry[]>([]);
  const [lastMatchRewards, setLastMatchRewards] = useState<{
    earnedPoints: number;
    earnedCoins: number;
    multiplierApplied?: boolean;
    doubledByAd?: boolean;
  } | null>(null);
  const dailyAutoOpenedRef = useRef<boolean>(false);
  const matchInstanceIdRef = useRef<number>(1);
  const recordedMatchInstanceRef = useRef<number>(0);
  const suppressDemoAutoRecordRef = useRef<boolean>(false);
  const pendingNextRoundActionRef = useRef<boolean | null>(null);
  const isTournamentMatchRef = useRef<boolean>(false);
  const returnToTournamentAfterVictoryRef = useRef<boolean>(false);

  // Player Profiles
  const [player1, setPlayer1] = useState<PlayerProfile>({
    id: sessionPlayerIdRef.current,
    name: 'Futbol Gurmesi',
    avatar: '⚽',
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

  // Match & Round States
  const [rounds, setRounds] = useState<MinigameRoundPayload[]>([]);
  const [onlineRound, setOnlineRound] = useState<MinigameRoundPayload | null>(null);
  const [xoxState, setXoxState] = useState<XoxRuntimeState | null>(null);
  const [xoxNotice, setXoxNotice] = useState<string | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0); // 3, 2, 1, 0
  const [timeRemaining, setTimeRemaining] = useState<number>(15);
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
    };
  }, []);

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
        setLastMatchRewards({ earnedPoints: 229, earnedCoins: 150 });
        setPlayer1({
          id: sessionPlayerIdRef.current,
          name: 'Futbol Gurmesi',
          avatar: '⚽',
          score: 3,
        });
        setPlayer2({ id: 'bot_ai', name: 'Futbol Profesörü', avatar: '🧠', score: 1 });
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
        setScreen('game_over');
      }
    }
  }, []);

  const persistProgression = useCallback((next: UserProgression) => {
    setProgression(next);
    try {
      localStorage.setItem('football_user_progression', JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const syncServerLeaderboard = useCallback(
    async (progToSync: UserProgression, profileToSync: PlayerProfile) => {
      try {
        const res = await fetch('/api/leaderboard/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: profileToSync.id,
            friendCode: progToSync.friendCode,
            name: profileToSync.name,
            avatar: profileToSync.avatar,
            weeklyPoints: progToSync.weeklyPoints,
            totalPoints: progToSync.totalPoints,
            subtitle: progToSync.equippedTitle,
            hasCrown: progToSync.unlockedGiftIds.includes('gift_title_legend'),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.players)) {
            setLiveLeaderboardPlayers(data.players);
          }
        }
      } catch {
        // Offline / server unreachable fallback handled smoothly
      }
    },
    []
  );

  const fetchServerLeaderboard = useCallback(async () => {
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

    const p1Score = player1.score;
    const p2Score = player2.score;
    const isDraw = p1Score === p2Score;
    const won = p1Score > p2Score;

    const outcome = recordMatchOutcome(progression, {
      won,
      isDraw,
      minigameType,
      stats: player1Stats,
    });

    let finalProgression = outcome.progression;
    let totalEarnedPoints = outcome.earnedPoints;
    let totalEarnedCoins = outcome.earnedCoins;

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

    persistProgression(finalProgression);
    setLastMatchRewards({
      earnedPoints: totalEarnedPoints,
      earnedCoins: totalEarnedCoins,
      multiplierApplied: outcome.multiplierApplied,
      doubledByAd: false,
    });
    syncServerLeaderboard(finalProgression, player1);
  }, [screen]);

  const closeOnlineSocket = () => {
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
    setShowAuthModal(false);
    setScreen('lobby');
    syncServerLeaderboard(progression, withSessionId);
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
    setScreen(exitTarget);
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
  };

  const toggleSoundMute = () => {
    const newState = sounds.toggleMute();
    setIsMuted(newState);
  };

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
    matchInstanceIdRef.current += 1;
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
      easy: { name: 'Çırak Bot', avatar: '🤖' },
      medium: { name: 'Futbol Profesörü', avatar: '🧠' },
      hard: { name: 'Efsane Taktisyen', avatar: '👑' },
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
    setXoxNotice(null);
    setScreen('playing');

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
    setIsRoundPlaying(true);
    setTimeRemaining(getRoundDurationSeconds(minigameTypeRef.current));

    if (roundTimerRef.current) clearInterval(roundTimerRef.current);

    roundTimerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          handleRoundTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Transition to next round or victory screen (Target: first to 3 wins, max 10 rounds cap)
  const advanceNextRound = (isMatchFinished: boolean = false) => {
    setShowResultSheet(false);
    const curIdx = currentRoundIndexRef.current;
    const currentList = roundsRef.current;
    const nextIndex = curIdx + 1;

    if (isMatchFinished || nextIndex >= Math.min(10, currentList.length)) {
      setScreen('game_over');
    } else {
      currentRoundIndexRef.current = nextIndex;
      setCurrentRoundIndex(nextIndex);
      runRoundCountdown(nextIndex, currentList, minigameTypeRef.current);
    }
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

    setPlayer1Stats((prev) => ({ ...prev, currentStreak: 0 }));
    setPlayer2Stats((prev) => ({ ...prev, currentStreak: 0 }));

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

    setPlayer1Stats((prev) => ({ ...prev, currentStreak: 0 }));
    setPlayer2Stats((prev) => ({ ...prev, currentStreak: 0 }));

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
      setPlayer1Stats((prev) => ({
        ...prev,
        totalWrongAttempts: prev.totalWrongAttempts + 1,
      }));
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
      const isClutch = timeRemaining <= getClutchThresholdSeconds(activeMinigame);

      const winner = winnerPlayerId === player1.id ? player1 : player2;
      setRoundWinnerPlayer(winner);
      setAcceptedAnswerText(playerName || answer);
      setShowResultSheet(true);

      let matchFinished = false;

      if (winnerPlayerId === player1.id) {
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
        setXoxNotice('Tahmin geçersiz, sıra geçti!');
      }
      startActiveRound();
    },
    [handleAnswerWinner]
  );

  // Online Multiplayer WebSocket Setup (supports all 5 minigames!)
  const handleSelectOnlineMode = useCallback(
    (
      onlineMode: 'online_match' | 'online_room',
      options?: { roomCode?: string; minigameType?: MinigameType }
    ) => {
      closeOnlineSocket();
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (nextRoundTimeoutRef.current) {
        clearTimeout(nextRoundTimeoutRef.current);
        nextRoundTimeoutRef.current = null;
      }

      matchInstanceIdRef.current += 1;
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
      setServerWrongFeedback(null);
      setOpponentMissedPulse(0);
      setRematchState('idle');
      setShowResultSheet(false);
      setIsRoundPlaying(false);
      setScreen('room_waiting');

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const selfProfile = player1Ref.current;
        const selfAccountStats = {
          totalMatches: progression.matchesPlayed,
          totalWins: progression.wins,
        };

        ws.onopen = () => {
          if (isQuick) {
            ws.send(
              JSON.stringify({
                type: 'quick_match',
                minigameType: chosenMinigame,
                playerId: sessionPlayerIdRef.current,
                name: selfProfile.name,
                avatar: selfProfile.avatar,
                favoriteClubId: selfProfile.favoriteClubId,
                accountStats: selfAccountStats,
              })
            );
          } else if (options?.roomCode) {
            ws.send(
              JSON.stringify({
                type: 'join_room',
                code: options.roomCode.trim().toUpperCase(),
                playerId: sessionPlayerIdRef.current,
                name: selfProfile.name,
                avatar: selfProfile.avatar,
                favoriteClubId: selfProfile.favoriteClubId,
                accountStats: selfAccountStats,
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                type: 'create_room',
                minigameType: chosenMinigame,
                playerId: sessionPlayerIdRef.current,
                name: selfProfile.name,
                avatar: selfProfile.avatar,
                favoriteClubId: selfProfile.favoriteClubId,
                accountStats: selfAccountStats,
              })
            );
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const myId = sessionPlayerIdRef.current;

            if (msg.minigameType) {
              setMinigameType(msg.minigameType);
              minigameTypeRef.current = msg.minigameType;
            }

            if (msg.type === 'room_created') {
              setRoomCode(msg.code);
            } else if (msg.type === 'room_joined') {
              setRoomCode(msg.code);
              if (msg.opponent) {
                setPlayer2({ ...msg.opponent, score: 0 });
              }
            } else if (msg.type === 'opponent_joined') {
              if (msg.opponent) {
                setPlayer2({ ...msg.opponent, score: 0 });
              }
            } else if (msg.type === 'match_found') {
              setRoomCode(msg.code);
              const opponent = (msg.players || []).find((p: PlayerProfile) => p.id !== myId);
              if (opponent) {
                setPlayer2({ ...opponent, score: 0 });
              }
            } else if (msg.type === 'round_countdown') {
              const incomingRound: MinigameRoundPayload | null = msg.round
                ? msg.round
                : msg.pairing
                ? { minigameType: msg.minigameType || 'two_clubs', pairing: msg.pairing }
                : null;
              if (incomingRound) setOnlineRound(incomingRound);
              setXoxState(msg.xoxState || null);
              setXoxNotice(null);

              if (msg.scores) {
                setPlayer1((p) => ({ ...p, score: msg.scores[myId] ?? p.score }));
                setPlayer2((p) => ({ ...p, score: msg.scores[p.id] ?? p.score }));
              }
              setShowResultSheet(false);
              setRoundWinnerPlayer(null);
              setAcceptedAnswerText('');
              setIsTimeExpired(false);
              setRoundEndReason('timeout');
              setOnlineSilhouetteExhausted(false);
              setIsRoundPlaying(false);
              setServerWrongFeedback(null);
              setTimeRemaining(
                getRoundDurationSeconds(msg.minigameType || minigameTypeRef.current)
              );
              setRematchState('idle');
              setScreen('playing');
              setCountdown(msg.countdown ?? 3);
              setCurrentRoundIndex((msg.roundIndex || 1) - 1);
            } else if (msg.type === 'countdown_tick') {
              setCountdown(msg.countdown);
            } else if (msg.type === 'round_started') {
              const incomingRound: MinigameRoundPayload | null = msg.round
                ? msg.round
                : msg.pairing
                ? { minigameType: msg.minigameType || 'two_clubs', pairing: msg.pairing }
                : null;
              if (incomingRound) setOnlineRound(incomingRound);
              if (msg.xoxState) setXoxState(msg.xoxState);
              setCountdown(0);
              setOnlineSilhouetteExhausted(false);
              setIsRoundPlaying(true);
              setTimeRemaining(
                msg.timeRemaining ??
                  getRoundDurationSeconds(msg.minigameType || minigameTypeRef.current)
              );
              setShowResultSheet(false);
            } else if (msg.type === 'time_tick') {
              setTimeRemaining(msg.timeRemaining);
            } else if (msg.type === 'xox_updated') {
              if (msg.xoxState) setXoxState(msg.xoxState);
              if (typeof msg.timeRemaining === 'number') setTimeRemaining(msg.timeRemaining);
              if (msg.turnNotice) {
                setXoxNotice(msg.turnNotice);
              } else if (msg.lastMove) {
                setXoxNotice(`${msg.lastMove.playerName} ile kare alındı!`);
                sounds.playCorrect();
              }
            } else if (msg.type === 'answer_wrong') {
              if (msg.reason === 'attempts_exhausted' || msg.attemptsRemaining === 0) {
                setOnlineSilhouetteExhausted(true);
              }
              if (msg.xoxTurnChanged && msg.xoxState) {
                setXoxState(msg.xoxState);
                if (typeof msg.timeRemaining === 'number') setTimeRemaining(msg.timeRemaining);
                setXoxNotice('Yanlış tahmin! Sıra rakibe geçti.');
              }
              setServerWrongFeedback({
                attempt: msg.attempt || '',
                seq: Date.now() + Math.random(),
              });
            } else if (msg.type === 'opponent_wrong_attempt') {
              if (msg.xoxTurnChanged && msg.xoxState) {
                setXoxState(msg.xoxState);
                if (typeof msg.timeRemaining === 'number') setTimeRemaining(msg.timeRemaining);
                setXoxNotice('Rakip yanlış yazdı! Sıra sende.');
              }
              setOpponentMissedPulse((prev) => prev + 1);
            } else if (msg.type === 'round_ended') {
              setIsRoundPlaying(false);
              if (msg.xoxState) setXoxState(msg.xoxState);
              if (msg.winnerId) {
                const winner =
                  msg.winnerId === myId ? player1Ref.current : player2Ref.current;
                setRoundWinnerPlayer(winner);
                setAcceptedAnswerText(msg.acceptedPlayerName || msg.acceptedAnswer || '');
                setIsTimeExpired(false);
                setRoundEndReason('draw');
                sounds.playCorrect();
              } else {
                setRoundWinnerPlayer(null);
                const exhausted = msg.reason === 'Deneme hakları doldu!';
                const timedOut = msg.reason === 'Süre doldu!';
                setIsTimeExpired(timedOut);
                setRoundEndReason(
                  exhausted ? 'attempts_exhausted' : timedOut ? 'timeout' : 'draw'
                );
                sounds.playWrong();
              }
              if (msg.scores) {
                setPlayer1((p) => ({ ...p, score: msg.scores[myId] ?? 0 }));
                setPlayer2((p) => ({ ...p, score: msg.scores[p.id] ?? 0 }));
              }
              if (msg.stats) {
                if (msg.stats[myId]) setPlayer1Stats(msg.stats[myId]);
                const oppId = player2Ref.current.id;
                if (oppId && msg.stats[oppId]) setPlayer2Stats(msg.stats[oppId]);
              }
              setShowResultSheet(true);
            } else if (msg.type === 'match_over') {
              setShowResultSheet(false);
              setIsRoundPlaying(false);
              if (msg.scores) {
                setPlayer1((p) => ({ ...p, score: msg.scores[myId] ?? p.score }));
                setPlayer2((p) => ({ ...p, score: msg.scores[p.id] ?? p.score }));
              }
              if (msg.stats) {
                if (msg.stats[myId]) setPlayer1Stats(msg.stats[myId]);
                const oppId = player2Ref.current.id;
                if (oppId && msg.stats[oppId]) setPlayer2Stats(msg.stats[oppId]);
              }
              setRematchState('idle');
              setScreen('game_over');
            } else if (msg.type === 'rematch_waiting') {
              setRematchState('waiting');
            } else if (msg.type === 'opponent_rematch_requested') {
              setRematchState('opponent_requested');
            } else if (msg.type === 'rematch_started') {
              matchInstanceIdRef.current += 1;
              setLastMatchRewards(null);
              setPlayer1((p) => ({ ...p, score: 0 }));
              setPlayer2((p) => ({ ...p, score: 0 }));
              setPlayer1Stats({ ...initialStats });
              setPlayer2Stats({ ...initialStats });
              setRematchState('idle');
            } else if (msg.type === 'opponent_disconnected') {
              if (screenRef.current === 'game_over') {
                setRematchState('opponent_left');
              } else {
                closeOnlineSocket();
                setIsRoundPlaying(false);
                setShowResultSheet(false);
                setOnlineError(msg.message || 'Rakibin bağlantısı kesildi!');
                setScreen('lobby');
              }
            } else if (msg.type === 'error') {
              closeOnlineSocket();
              setOnlineError(msg.message || 'Odaya bağlanılamadı.');
              setScreen('lobby');
            }
          } catch (e) {
            console.error(e);
          }
        };

        ws.onerror = () => {
          if (wsRef.current !== ws) return;
          closeOnlineSocket();
          setOnlineError('Sunucu bağlantısı kurulamadı. Lütfen tekrar dene!');
          setScreen('lobby');
        };

        ws.onclose = () => {
          if (wsRef.current !== ws) return;
          wsRef.current = null;
          if (screenRef.current === 'game_over') {
            setRematchState('opponent_left');
          } else if (screenRef.current === 'room_waiting' || screenRef.current === 'playing') {
            setIsRoundPlaying(false);
            setShowResultSheet(false);
            setOnlineError('Sunucu bağlantısı kesildi. Lütfen tekrar dene!');
            setScreen('lobby');
          }
        };
      } catch {
        setOnlineError('Çevrim içi bağlantı başlatılamadı.');
        setScreen('lobby');
      }
    },
    []
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
    (answer: string, cellPos?: { row: number; col: number }) => {
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
    if (mode === 'online_match' || mode === 'online_room') {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
    if (!params.alreadyPaid) {
      const res = enterTournamentWithCoins(progression, params.entryFeeCoins);
      if (!res.ok) {
        return { ok: false, reason: res.reason };
      }
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

  const handleRequestDoubleMatchReward = () => {
    if (!lastMatchRewards || lastMatchRewards.doubledByAd) return;
    setPendingAdReward({
      scope: 'match',
      coins: lastMatchRewards.earnedCoins,
      points: lastMatchRewards.earnedPoints,
    });
  };

  const handleCompleteRewardedAd = () => {
    if (!pendingAdReward) return;
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

  const handleLinkSocialAction = (provider: SocialProvider, handle: string) => {
    const res = linkSocialAccount(progression, provider, handle);
    if (res.ok) {
      persistProgression(res.progression);
      syncServerLeaderboard(res.progression, player1);
    }
    return {
      ok: res.ok,
      error: res.error,
      bonusCoinsAwarded: res.bonusCoinsAwarded,
    };
  };

  const handleUnlinkSocialAction = (provider: SocialProvider) => {
    const next = unlinkSocialAccount(progression, provider);
    persistProgression(next);
  };

  const handleAddFriendAction = (codeOrName: string) => {
    const res = addFriendByCodeOrEntry(progression, codeOrName, liveLeaderboardPlayers);
    if (res.ok) {
      persistProgression(res.progression);
    }
    return { ok: res.ok, error: res.error };
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

  const hasClaimableGift =
    canClaimDailyReward(progression) ||
    progression.dailyQuests.some((q) => !q.claimed && q.progress >= q.target);
  const userClub = player1.favoriteClubId ? CLUBS[player1.favoriteClubId] : null;
  const tabHeaderTitle: Record<MainTab, string> = {
    play: '3-2-1 FOOTBALL',
    stats: t('tabStatsTitle'),
    friends: t('tabFriendsTitle'),
    league: t('tabLeagueTitle'),
    profile: t('tabProfileTitle'),
  };
  const activePitchTheme = getPitchThemeStyle(progression.equippedPitchTheme);

  const isOnlineMode = mode === 'online_match' || mode === 'online_room';
  const currentRound = isOnlineMode ? onlineRound : rounds[currentRoundIndex] || rounds[0];

  return (
    <main
      data-testid="app-container"
      data-state={screen}
      className="relative min-h-[100dvh] w-full flex flex-col bg-slate-950 font-sans selection:bg-emerald-500 selection:text-black overflow-x-hidden text-white"
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
                onOpenAuth={() => setShowAuthModal(true)}
                onOpenDailyRewards={() => setShowDailyModal(true)}
                onOpenQuests={() => handleSelectBottomTab('profile')}
                onOpenStore={handleOpenStore}
                onOpenTournament={() => setShowTournamentModal(true)}
                activeTournamentStageLabel={
                  activeTournament && activeTournament.status === 'active'
                    ? getTournamentMatchForUser(activeTournament, player1.id).stageLabel
                    : null
                }
                onExitApp={handlePromptExitApp}
                onlineError={onlineError}
                onClearOnlineError={() => setOnlineError(null)}
              />
            ) : (
              <div className="relative min-h-[100dvh] w-full flex flex-col bg-slate-950 text-white overflow-x-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-950 to-slate-950 pointer-events-none" />

                {/* Shared Hub Top Header for Secondary Tabs */}
                <header className="relative z-10 w-full max-w-xl mx-auto px-3 sm:px-4 pt-3 pb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <img
                      src="/./logo.png"
                      alt="3-2-1 Football Logo"
                      className="w-8 h-8 rounded-xl object-cover border border-amber-400/40 shadow-md shrink-0"
                    />
                    <span
                      data-testid="tab-header-title"
                      className="font-black tracking-tight text-white text-sm sm:text-base whitespace-nowrap"
                    >
                      {tabHeaderTitle[activeTab]}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <button
                      type="button"
                      data-testid="header-store-btn"
                      onClick={() => handleOpenStore('featured')}
                      className="min-w-[32px] min-h-[32px] px-2 py-1 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 text-xs font-black flex items-center justify-center gap-1 cursor-pointer"
                      aria-label={t('store')}
                      title={t('store')}
                    >
                      <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">{t('store')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDailyModal(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-amber-500/35 text-[11px] sm:text-xs font-black text-amber-400 font-mono cursor-pointer"
                      title="Coin Bakiyesi & Günlük Seri"
                    >
                      <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{formatPoints(progression.coins)}</span>
                      <span className="text-slate-600 hidden sm:inline">•</span>
                      <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0 hidden sm:inline" />
                      <span className="text-orange-400 hidden sm:inline">{progression.dailyLogin.streakDays}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="flex items-center gap-1 min-h-[32px] px-1.5 sm:px-2 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 text-xs font-bold text-white cursor-pointer"
                      aria-label="Hesap & Kulüp Profiliniz"
                    >
                      {userClub ? (
                        <ClubLogo club={userClub} size="xs" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="header-settings-btn"
                      onClick={() => setShowSettingsModal(true)}
                      className="min-w-[32px] min-h-[32px] p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer"
                      title={t('settings')}
                      aria-label={t('settings')}
                    >
                      <Settings className="w-4 h-4 text-emerald-400" />
                    </button>

                    <button
                      type="button"
                      onClick={handlePromptExitApp}
                      className="min-w-[32px] min-h-[32px] p-1.5 rounded-xl bg-slate-900/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500 text-slate-400 hover:text-rose-400 flex items-center justify-center cursor-pointer hidden sm:flex"
                      aria-label="Oyundan Çıkış"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </header>

                <div className="relative z-10 flex-1 w-full">
                  {activeTab === 'stats' && (
                    <StatsView
                      playerProfile={player1}
                      progression={progression}
                      liveServerPlayers={liveLeaderboardPlayers}
                    />
                  )}
                  {activeTab === 'friends' && (
                    <FriendsView
                      progression={progression}
                      selfPlayerId={player1.id}
                      liveServerPlayers={liveLeaderboardPlayers}
                      onAddFriend={handleAddFriendAction}
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
                      onGoPlay={() => handleSelectBottomTab('play')}
                    />
                  )}
                  {activeTab === 'profile' && (
                    <ProfileView
                      playerProfile={player1}
                      progression={progression}
                      onOpenAuth={() => setShowAuthModal(true)}
                      onSelectAvatar={(av) => {
                        handleUpdateProfile({ avatar: av });
                        syncServerLeaderboard(progression, { ...player1, avatar: av });
                      }}
                      onClaimDailyReward={handleClaimDailyRewardAction}
                      onClaimDailyQuest={handleClaimDailyQuestAction}
                      onPurchaseGift={handlePurchaseGiftAction}
                      onOpenStore={handleOpenStore}
                      onEquipItem={handleEquipStoreItemAction}
                      onLinkSocial={handleLinkSocialAction}
                      onUnlinkSocial={handleUnlinkSocialAction}
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
            onCancel={handleExitToLobby}
          />
        </div>
      )}

      {/* Screen 3: Playing Match */}
      {screen === 'playing' && currentRound && (
        <div
          key={`screen-playing-${mode}-${currentRound.minigameType}`}
          className="relative min-h-[100dvh] w-full flex flex-col justify-between overflow-x-hidden animate-screen-slide"
        >
          <div className={`absolute inset-0 pointer-events-none opacity-45 ${activePitchTheme.bgClass}`} />

          <div className="relative z-10 flex flex-col flex-1 justify-between">
            <ScoreBoard
              player1={player1}
              player2={player2}
              roundNumber={currentRoundIndex + 1}
              totalRounds={10}
              timeRemaining={timeRemaining}
              minigameType={currentRound.minigameType}
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
                onUseEnergyDrinkHint={handleUseEnergyDrinkHint}
                onUseEnergyDrinkPass={handleUseEnergyDrinkPass}
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
                onUseEnergyDrinkHint={handleUseEnergyDrinkHint}
                onUseEnergyDrinkPass={handleUseEnergyDrinkPass}
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
          isOnlineMatch={isOnlineMode}
          rematchState={rematchState}
          matchRewards={lastMatchRewards}
          player1Frame={progression.equippedFrame}
          goalEffect={progression.equippedGoalEffect}
          onRequestDoubleMatchReward={handleRequestDoubleMatchReward}
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

      {/* Rewarded Ad 2x Double Modal */}
      <RewardedAdModal
        isOpen={Boolean(pendingAdReward)}
        adFree={Boolean(progression.adFree)}
        rewardLabel={
          pendingAdReward
            ? `+${pendingAdReward.coins} Coin & +${pendingAdReward.points} Puan`
            : ''
        }
        onComplete={handleCompleteRewardedAd}
        onClose={handleCloseRewardedAd}
      />

      {/* Global Settings Modal (Sound + Language + Social Linking) */}
      <SettingsModal
        isOpen={showSettingsModal}
        isMuted={isMuted}
        progression={progression}
        onToggleMute={toggleSoundMute}
        onLinkSocial={handleLinkSocialAction}
        onUnlinkSocial={handleUnlinkSocialAction}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Auth / Account Profile Modal */}
      {showAuthModal && (
        <AuthModal
          currentProfile={player1}
          progression={progression}
          onSaveProfile={handleSaveProfile}
          onPurchaseGift={handlePurchaseGiftAction}
          onClose={() => {
            setShowAuthModal(false);
            if (screen === 'intro') setScreen('lobby');
          }}
          isInitialRequired={screen === 'intro'}
        />
      )}

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
