import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Globe,
  Bot,
  Trophy,
  Settings,
  KeyRound,
  Sparkles,
  LogOut,
  AlertCircle,
  X,
  Gift,
  Coins,
  Flame,
  Target,
  ShoppingBag,
  ShieldCheck,
  CalendarDays,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';
import {
  GameMode,
  BotDifficulty,
  MinigameType,
  PlayerProfile,
  StoreCategory,
  UserProgression,
} from '../game/types';
import { MINIGAME_OPTIONS } from '../game/minigameEngine';
import {
  canClaimDailyReward,
  formatPoints,
  getLocalDateKey,
  hasUnlimitedEnergy,
} from '../game/retentionEngine';
import {
  formatCountdownHMS,
  getDailyPuzzleNumber,
  getRemainingDailyChallengeCooldownMs,
} from '../game/dailyChallengeEngine';
import { useLanguage } from '../game/LanguageContext';
import { UiTheme } from '../game/themeEngine';
import { BrandTitle } from './BrandTitle';
import { MinigameSelectorModal } from './MinigameSelectorModal';
import { BotSetupModal } from './BotSetupModal';
import {
  formatWheelCooldownBadge,
  getRemainingWheelCooldownMs,
} from '../game/dailyWheelEngine';

interface LobbyScreenProps {
  playerProfile: PlayerProfile;
  progression?: UserProgression;
  onSelectMode: (
    mode: GameMode,
    options?: {
      botDifficulty?: BotDifficulty;
      roomCode?: string;
      minigameType?: MinigameType;
    }
  ) => void;
  onOpenSettings?: () => void;
  onOpenAuth?: () => void;
  onOpenDailyRewards?: () => void;
  onOpenQuests?: () => void;
  onOpenStore?: (category?: StoreCategory) => void;
  onOpenTournament?: () => void;
  onOpenDailyChallenge?: () => void;
  onOpenFriendsRequests?: () => void;
  onOpenDailyWheel?: () => void;
  onOpenV3Quests?: () => void;
  onOpenSpecialEvent?: () => void;
  onToggleMute?: () => void;
  isMuted?: boolean;
  uiTheme?: UiTheme;
  onToggleTheme?: () => void;
  v3ClaimableQuestsCount?: number;
  hasFreeSpecialEventEntry?: boolean;
  hasFreeWheelSpin?: boolean;
  pendingFriendRequestsCount?: number;
  activeTournamentStageLabel?: string | null;
  onExitApp?: () => void;
  isNetworkOnline?: boolean;
  onlineError?: string | null;
  onClearOnlineError?: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerProfile,
  progression,
  onSelectMode,
  onOpenSettings,
  onOpenAuth,
  onOpenDailyRewards,
  onOpenQuests,
  onOpenStore,
  onOpenTournament,
  onOpenDailyChallenge,
  onOpenFriendsRequests,
  onOpenDailyWheel,
  onOpenV3Quests,
  onOpenSpecialEvent,
  onToggleMute,
  isMuted = false,
  uiTheme = 'modern',
  onToggleTheme,
  v3ClaimableQuestsCount = 0,
  hasFreeSpecialEventEntry = false,
  hasFreeWheelSpin = false,
  pendingFriendRequestsCount = 0,
  activeTournamentStageLabel = null,
  onExitApp,
  isNetworkOnline = true,
  onlineError = null,
  onClearOnlineError,
}) => {
  const { t } = useLanguage();
  const [logoError, setLogoError] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomAction, setRoomAction] = useState<'create' | 'join'>('create');
  const [roomMinigame, setRoomMinigame] = useState<MinigameType>('two_clubs');
  const [inputCode, setInputCode] = useState('');

  // Bot Setup (Çırak/Şampiyon/Efsane + 5 games) & 5-Minigame Selector
  const [showBotModal, setShowBotModal] = useState(false);
  const [minigameModalContext, setMinigameModalContext] = useState<
    'online_match' | 'minigames' | null
  >(null);

  // Destructure unused optional props safely for backwards compatibility with callers
  const _unusedLobbyProps = {
    onOpenAuth,
    onOpenFriendsRequests,
    onOpenV3Quests,
    onOpenSpecialEvent,
    v3ClaimableQuestsCount,
    hasFreeSpecialEventEntry,
    pendingFriendRequestsCount,
    playerProfileName: playerProfile.name,
  };
  void _unusedLobbyProps;

  const dailyClaimable = progression ? canClaimDailyReward(progression) : false;
  const todayDateKey = getLocalDateKey();
  const dailyPuzzleNumber = getDailyPuzzleNumber(todayDateKey);
  const [dailyChallengeCooldownMs, setDailyChallengeCooldownMs] = useState<number>(() =>
    progression ? getRemainingDailyChallengeCooldownMs(progression) : 0
  );
  const [wheelCooldownMs, setWheelCooldownMs] = useState<number>(() =>
    progression ? getRemainingWheelCooldownMs(progression) : hasFreeWheelSpin ? 0 : 1
  );

  useEffect(() => {
    const tick = () => {
      setDailyChallengeCooldownMs(getRemainingDailyChallengeCooldownMs(progression));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [progression]);

  const isDailyChallengeDone = dailyChallengeCooldownMs > 0;
  const midnightCountdown = formatCountdownHMS(dailyChallengeCooldownMs);

  useEffect(() => {
    if (!progression) {
      setWheelCooldownMs(hasFreeWheelSpin ? 0 : 1);
      return;
    }
    const updateCooldown = () => {
      setWheelCooldownMs(getRemainingWheelCooldownMs(progression));
    };
    updateCooldown();
    const timer = setInterval(updateCooldown, 1000);
    return () => clearInterval(timer);
  }, [progression, hasFreeWheelSpin]);

  const isFreeWheelSpinReady = progression ? wheelCooldownMs <= 0 : hasFreeWheelSpin;
  const completedQuests = progression
    ? progression.dailyQuests.filter((q) => q.progress >= q.target).length
    : 0;
  const claimableQuests = progression
    ? progression.dailyQuests.filter((q) => !q.claimed && q.progress >= q.target).length
    : 0;
  const isVipUnlimited = progression ? hasUnlimitedEnergy(progression) : false;

  return (
    <div
      data-testid="lobby-screen"
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] bg-slate-950 text-white overflow-x-clip"
    >
      {/* Background Stadium Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/30 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Clean Single-Row Top Header (42px+ Hit Targets) */}
      <header
        data-testid="lobby-top-header"
        className="sticky top-0 z-40 w-[calc(100%+2rem)] -mx-4 bg-slate-950/95 border-b border-slate-800/70 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.45rem))] pb-2.5"
      >
        <div className="w-full max-w-xl mx-auto px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {!logoError ? (
              <img
                src="/logo.png"
                alt="3-2-1 Futbol Logosu"
                onError={() => setLogoError(true)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover border border-amber-400/40 shadow-md shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-700 to-amber-600 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="hidden sm:inline-flex items-center">
              <BrandTitle size="sm" />
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenStore && (
              <button
                type="button"
                data-testid="header-store-btn"
                onClick={() => onOpenStore('featured')}
                className="flex items-center justify-center gap-1 min-w-[42px] min-h-[42px] px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 text-xs font-black transition-transform active:scale-95 shadow-sm cursor-pointer touch-manipulation"
                title={t('store')}
                aria-label={t('store')}
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{t('store')}</span>
              </button>
            )}

            {onToggleMute && (
              <button
                type="button"
                data-testid="header-sound-toggle-btn"
                onClick={onToggleMute}
                className="min-w-[42px] min-h-[42px] p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-transform active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation text-base leading-none"
                title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
                aria-label={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
              >
                <span aria-hidden="true">{isMuted ? '🔇' : '🔊'}</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                data-testid="header-settings-btn"
                onClick={onOpenSettings}
                className="min-w-[42px] min-h-[42px] p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-transform active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation"
                title={t('settings')}
                aria-label={t('settings')}
              >
                <Settings className="w-4 h-4 text-emerald-400" />
              </button>
            )}

            {onExitApp && (
              <button
                type="button"
                data-testid="header-exit-btn"
                onClick={onExitApp}
                className="flex min-w-[42px] min-h-[42px] p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500 text-slate-400 hover:text-rose-400 transition-transform active:scale-95 items-center justify-center cursor-pointer touch-manipulation"
                title="Oyundan Çıkış"
                aria-label="Oyundan Çıkış"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Title Lockup */}
      <div className="relative z-10 w-full max-w-xl flex flex-col items-center text-center my-auto pt-3 pb-2">
        <div className="relative mb-2">
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden shadow-[0_0_28px_rgba(245,158,11,0.2)] border-2 border-amber-400/50 bg-slate-900 mx-auto transition-transform duration-200 hover:scale-[1.03] flex items-center justify-center">
            {!logoError ? (
              <img
                src="/logo.png"
                alt="3-2-1 Futbol Logosu"
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover select-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900 via-slate-900 to-amber-900/60 p-3">
                <Trophy className="w-10 h-10 text-amber-400 mb-1" />
                <span className="text-lg font-black text-white">3-2-1</span>
              </div>
            )}
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black tracking-widest uppercase mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          CANLI BİLGİ YARIŞMASI
        </div>

        <h1 className="flex justify-center drop-shadow-xl select-none leading-none">
          <BrandTitle size="lg" />
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-md font-medium">
          {t('lobbyTagline')} 🏆
        </p>

        {onToggleTheme && (
          <button
            type="button"
            data-testid="lobby-theme-toggle-btn"
            onClick={onToggleTheme}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 text-xs font-black text-emerald-300 shadow-sm transition active:scale-95 cursor-pointer"
            title="Modern ve Klasik Retro Tema arasında geç"
          >
            <span aria-hidden="true">{uiTheme === 'klasik' ? '⚽' : '🌙'}</span>
            <span>{uiTheme === 'klasik' ? 'Tema: Klasik' : 'Tema: Modern'}</span>
          </button>
        )}

        {/* Offline Network Status Banner (Bot Training still runs seamlessly offline) */}
        {!isNetworkOnline && (
          <div
            data-testid="offline-status-banner"
            className="w-full mt-3 p-3 rounded-2xl bg-amber-950/70 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-2.5 text-left shadow-lg"
          >
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-snug">
              <strong>Çevrimdışı Mod:</strong> Bot Antrenmanı internet olmadan sorunsuz çalışır.
              Online 1v1 için internet bağlantısı gerekir.
            </span>
          </div>
        )}

        {/* Online Error / Disconnect Banner */}
        {onlineError && (
          <div
            data-testid="online-error-banner"
            className="w-full mt-4 p-3 rounded-2xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-center justify-between gap-2 text-left shadow-lg"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="leading-snug">{onlineError}</span>
            </div>
            {onClearOnlineError && (
              <button
                onClick={onClearOnlineError}
                className="p-1 rounded-lg hover:bg-rose-900/80 text-rose-300 shrink-0"
                aria-label="Hata mesajını kapat"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Retention & Daily Rewards Strip (Clean 2x2 Mobile / 4-Col Desktop Grid) */}
        {progression && (
          <div
            data-testid="lobby-retention-strip"
            className="w-full mt-4 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 shadow-lg"
          >
            {/* Coin Balance Tile */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/90 border border-amber-500/25 min-h-[48px]">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0 text-left">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">
                  Coin
                </span>
                <span
                  data-testid="lobby-coins"
                  className="block text-sm font-black text-amber-400 font-mono tabular-nums mt-0.5 leading-tight"
                >
                  {formatPoints(progression.coins)}
                </span>
              </div>
            </div>

            {/* Daily Streak Tile */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/90 border border-orange-500/25 min-h-[48px]">
              <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 text-orange-400" />
              </div>
              <div className="min-w-0 text-left">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">
                  Günlük Seri
                </span>
                <span
                  data-testid="lobby-streak"
                  className="block text-sm font-black text-orange-400 font-mono tabular-nums mt-0.5 leading-tight"
                >
                  {progression.dailyLogin.streakDays} Gün
                </span>
              </div>
            </div>

            {/* Daily Reward Action */}
            {onOpenDailyRewards && (
              <button
                type="button"
                data-testid="open-daily-rewards-btn"
                onClick={onOpenDailyRewards}
                className={`relative flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-black min-h-[48px] transition-transform active:scale-95 cursor-pointer ${
                  dailyClaimable
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 border-amber-300 text-slate-950 shadow-md shadow-amber-500/25'
                    : 'bg-slate-950/90 hover:bg-slate-800 border-emerald-500/35 text-emerald-400'
                }`}
              >
                {dailyClaimable && (
                  <span
                    className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-rose-500 border border-slate-950 shadow-[0_0_10px_rgba(244,63,94,0.95)] animate-ping"
                    aria-hidden="true"
                  />
                )}
                <Gift className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {dailyClaimable ? 'Günlük Ödül' : t('lobbyDailyDone')}
                </span>
              </button>
            )}

            {/* Daily Quests Action */}
            {onOpenQuests && (
              <button
                type="button"
                data-testid="open-quests-btn"
                onClick={onOpenQuests}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-black min-h-[48px] transition-transform active:scale-95 cursor-pointer ${
                  claimableQuests > 0
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400 text-emerald-300'
                    : 'bg-slate-950/90 hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Target className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">
                  {claimableQuests > 0
                    ? `Ödül Hazır (${claimableQuests})`
                    : `${t('lobbyQuests')} (${completedQuests}/${progression.dailyQuests.length})`}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Game Mode Cards: Primary 1v1 Online (4 games) + Tournament + Solo Bot + Private Room */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {/* Featured Mode 1: 1'e 1 Çevrim İçi Yarışma (All 4 Multiplayer Games) */}
          <button
            data-testid="mode-online-btn"
            onClick={() => setMinigameModalContext('online_match')}
            className="sm:col-span-2 flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-teal-950/75 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 border border-cyan-400/60 hover:border-cyan-300 transition transform active:scale-[0.99] text-left shadow-xl group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-sm sm:text-base">
                  {t('lobbyOnlineTitle')}
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-cyan-400 text-slate-950 shrink-0">
                  4 Oyun
                </span>
              </div>
              <span className="block text-xs text-slate-300 mt-0.5 truncate">
                {t('lobbyOnlineDesc')}
              </span>
            </div>
          </button>

          {/* Mode 2: Solo / Bot ile Antrenman */}
          <button
            data-testid="mode-bot-btn"
            onClick={() => setShowBotModal(true)}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 hover:from-blue-950/60 hover:to-slate-900 border border-blue-500/40 hover:border-blue-400 transition transform active:scale-98 text-left shadow-lg group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block font-black text-white text-sm">
                {t('lobbyBotTitle')}
              </span>
              <span className="block text-xs text-slate-400 truncate">
                {t('lobbyBotDesc')}
              </span>
            </div>
          </button>

          {/* Mode 3: Arkadaşla Özel Oda */}
          <button
            data-testid="mode-room-btn"
            onClick={() => setShowRoomModal(true)}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 hover:from-purple-950/60 hover:to-slate-900 border border-purple-500/40 hover:border-purple-400 transition transform active:scale-98 text-left shadow-lg group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block font-black text-white text-sm">
                {t('lobbyRoomTitle')}
              </span>
              <span className="block text-xs text-slate-400 truncate">
                {t('lobbyRoomDesc')}
              </span>
            </div>
          </button>

          {/* Mode 4: 8 Kişilik Eleme Turnuvası */}
          {onOpenTournament && (
            <button
              type="button"
              data-testid="mode-tournament-btn"
              onClick={onOpenTournament}
              className="sm:col-span-2 flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-purple-500/15 hover:from-amber-500/25 hover:to-purple-500/25 border border-amber-400/50 hover:border-amber-300 transition transform active:scale-[0.99] text-left shadow-xl group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 group-hover:scale-105 transition shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-white text-sm sm:text-base">
                      {t('lobbyTournamentTitle')}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 shrink-0">
                      {activeTournamentStageLabel || '3 Maç Eleme'}
                    </span>
                  </div>
                  <span className="block text-xs text-slate-300 mt-0.5 truncate">
                    {activeTournamentStageLabel
                      ? 'Aktif turnuvan devam ediyor — sıradaki eleme maçına geç!'
                      : t('lobbyTournamentDesc')}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-slate-950/90 border border-amber-400/40 text-xs font-black font-mono text-amber-300 shrink-0">
                🏆 6.000 🪙
              </span>
            </button>
          )}
        </div>

        {/* Sponsored Ad Banner */}
        {progression && !isVipUnlimited && onOpenStore && (
          <div
            data-testid="lobby-ad-banner"
            className="w-full mt-3 px-3 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-left"
          >
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">
                {t('lobbyAdTag')}
              </span>
              <span className="text-xs font-bold text-slate-300 truncate block">
                {t('lobbyAdDesc')}
              </span>
            </div>
            <button
              type="button"
              data-testid="remove-ads-cta"
              onClick={() => onOpenStore('ads_coins')}
              className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-200 font-black text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('lobbyRemoveAds')}</span>
            </button>
          </div>
        )}

        {/* Copyright & Independent Fan Quiz Disclaimer */}
        <p
          data-testid="lobby-copyright-notice"
          className="mt-4 px-2 text-[11px] font-medium tracking-wide text-slate-500/90 text-center leading-relaxed"
        >
          Bağımsız hayran yapımı bilgi yarışmasıdır; hiçbir kulüp, lig veya kuruluşla resmi bağlantısı yoktur.
        </p>
      </div>

      {/* Private Room Modal */}
      {showRoomModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-3xl p-5 sm:p-6 text-center shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-black text-white flex items-center justify-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-purple-400" />
              <span>Özel Oda</span>
            </h3>

            <div className="flex rounded-xl bg-slate-950 p-1 mb-4 border border-slate-800">
              <button
                onClick={() => setRoomAction('create')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                  roomAction === 'create'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Oda Oluştur
              </button>
              <button
                onClick={() => setRoomAction('join')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                  roomAction === 'join'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Odaya Katıl
              </button>
            </div>

            {roomAction === 'create' ? (
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                  Oyun Türünü Seç
                </label>
                <div className="space-y-1.5 mb-4">
                  {MINIGAME_OPTIONS.map((mg) => (
                    <button
                      key={mg.id}
                      type="button"
                      onClick={() => setRoomMinigame(mg.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        roomMinigame === mg.id
                          ? 'bg-purple-600/25 border-purple-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{mg.title}</span>
                      <span className="text-[10px] text-slate-400">{mg.badgeText}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowRoomModal(false);
                    onSelectMode('online_room', { minigameType: roomMinigame });
                  }}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm transition active:scale-95 shadow-lg shadow-purple-600/30 cursor-pointer"
                >
                  Odayı Başlat
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  maxLength={80}
                  value={inputCode}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const match = raw.match(/[?&]room=([A-Za-z0-9]+)/i);
                    const extracted = match
                      ? match[1]
                      : raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
                    setInputCode(extracted.toUpperCase());
                  }}
                  placeholder="5 HANELİ ODA KODU"
                  className="w-full bg-slate-950 text-white font-mono font-black text-center text-lg tracking-widest px-3 py-3 rounded-xl border border-purple-500/50 mb-3 outline-none uppercase"
                />
                <button
                  disabled={inputCode.length < 3}
                  onClick={() => {
                    setShowRoomModal(false);
                    onSelectMode('online_room', { roomCode: inputCode });
                  }}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-sm transition active:scale-95 shadow-lg shadow-purple-600/30"
                >
                  Odaya Katıl
                </button>
              </div>
            )}

            <button
              onClick={() => setShowRoomModal(false)}
              className="mt-3 text-xs text-slate-500 hover:text-slate-300 font-semibold"
            >
              Vazgeç
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 5-Minigame Selector Modal */}
      <MinigameSelectorModal
        isOpen={minigameModalContext !== null}
        context={minigameModalContext || 'online_match'}
        onClose={() => setMinigameModalContext(null)}
        onStartOnlineMatch={(mg) => {
          setMinigameModalContext(null);
          onSelectMode('online_match', { minigameType: mg });
        }}
        onCreatePrivateRoom={(mg) => {
          setMinigameModalContext(null);
          setRoomMinigame(mg);
          setRoomAction('create');
          setShowRoomModal(true);
        }}
        onStartBotMatch={(mg, diff) => {
          setMinigameModalContext(null);
          onSelectMode('bot', { botDifficulty: diff, minigameType: mg });
        }}
      />

      {/* Bot Difficulty + Minigame Modal (Çırak / Şampiyon / Efsane) */}
      <BotSetupModal
        isOpen={showBotModal}
        onClose={() => setShowBotModal(false)}
        onStart={(diff, mg) => {
          setShowBotModal(false);
          onSelectMode('bot', { botDifficulty: diff, minigameType: mg });
        }}
      />

      {/* Floating Circular 24-Hour Daily Challenge Button (Bottom-Left, Symmetrical to Lucky Wheel) */}
      {onOpenDailyChallenge && (
        <button
          type="button"
          data-testid="floating-daily-challenge-btn"
          disabled={isDailyChallengeDone}
          aria-disabled={isDailyChallengeDone}
          aria-label={
            isDailyChallengeDone
              ? `Günlük Meydan Okuma Kilitli (${midnightCountdown})`
              : `Günlük Meydan Okuma #${dailyPuzzleNumber} - Oyna`
          }
          title={
            isDailyChallengeDone
              ? `Günlük Meydan Okuma oynandı • Kalan süre: ${midnightCountdown}`
              : `Günlük Meydan Okuma #${dailyPuzzleNumber} hazır!`
          }
          onClick={() => {
            if (isDailyChallengeDone) return;
            onOpenDailyChallenge();
          }}
          className={`fixed left-4 sm:left-6 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-2 transition-transform select-none ${
            !isDailyChallengeDone
              ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 border-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.55)] hover:scale-105 active:scale-95 cursor-pointer'
              : 'bg-slate-900/95 border-slate-700/80 opacity-85 cursor-not-allowed shadow-[0_8px_24px_rgba(2,6,23,0.75)]'
          }`}
        >
          {!isDailyChallengeDone && (
            <>
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-emerald-300/35 animate-ping pointer-events-none"
              />
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.95)] pointer-events-none"
              />
            </>
          )}

          {isDailyChallengeDone ? (
            <CheckCircle2 className="relative w-7 h-7 sm:w-8 sm:h-8 text-emerald-400 pointer-events-none" />
          ) : (
            <CalendarDays className="relative w-7 h-7 sm:w-8 sm:h-8 text-slate-950 stroke-[2.4] pointer-events-none" />
          )}

          {!isDailyChallengeDone ? (
            <span
              data-testid="daily-challenge-ready-badge"
              className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-emerald-300 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-[0_2px_10px_rgba(16,185,129,0.75)] border border-white/80 whitespace-nowrap"
            >
              GÜNLÜK
            </span>
          ) : (
            <span
              data-testid="daily-challenge-locked-countdown"
              className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-950/95 border border-emerald-400/70 text-emerald-300 text-[10px] font-mono font-black tabular-nums shadow-lg whitespace-nowrap"
            >
              {midnightCountdown}
            </span>
          )}
        </button>
      )}

      {/* Floating Circular 24-Hour Lucky Wheel Button (Bottom-Right) */}
      {onOpenDailyWheel && (
        <button
          type="button"
          data-testid="floating-daily-wheel-btn"
          aria-label={
            isFreeWheelSpinReady
              ? 'Şans Çarkı - Ücretsiz Çevir'
              : `Şans Çarkı (${formatWheelCooldownBadge(wheelCooldownMs)})`
          }
          title={
            isFreeWheelSpinReady
              ? 'Şans Çarkı hazır! Ücretsiz çevir'
              : `Sonraki ücretsiz hak: ${formatWheelCooldownBadge(wheelCooldownMs)} (Ödüllü reklamla çevirebilirsin)`
          }
          onClick={onOpenDailyWheel}
          className={`fixed right-4 sm:right-6 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer select-none ${
            isFreeWheelSpinReady
              ? 'bg-gradient-to-br from-fuchsia-600 via-amber-500 to-emerald-500 border-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.55)]'
              : 'bg-slate-900/95 hover:bg-slate-800 border-fuchsia-400/55 shadow-[0_8px_24px_rgba(2,6,23,0.75)]'
          }`}
        >
          {isFreeWheelSpinReady && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-amber-300/35 animate-ping pointer-events-none"
            />
          )}

          {/* Crisp Mini Wheel Icon */}
          <svg
            viewBox="0 0 40 40"
            className={`relative w-9 h-9 sm:w-10 sm:h-10 drop-shadow ${
              isFreeWheelSpinReady ? 'animate-pulse' : 'opacity-90'
            }`}
            aria-hidden="true"
          >
            <circle cx="20" cy="20" r="18" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.5" />
            <path d="M20 20 L20 4 A16 16 0 0 1 31.3 8.7 Z" fill="#10b981" />
            <path d="M20 20 L31.3 8.7 A16 16 0 0 1 36 20 Z" fill="#f59e0b" />
            <path d="M20 20 L36 20 A16 16 0 0 1 31.3 31.3 Z" fill="#ec4899" />
            <path d="M20 20 L31.3 31.3 A16 16 0 0 1 20 36 Z" fill="#3b82f6" />
            <path d="M20 20 L20 36 A16 16 0 0 1 8.7 31.3 Z" fill="#8b5cf6" />
            <path d="M20 20 L8.7 31.3 A16 16 0 0 1 4 20 Z" fill="#ef4444" />
            <path d="M20 20 L4 20 A16 16 0 0 1 8.7 8.7 Z" fill="#06b6d4" />
            <path d="M20 20 L8.7 8.7 A16 16 0 0 1 20 4 Z" fill="#eab308" />
            <circle cx="20" cy="20" r="5" fill="#fef3c7" stroke="#0f172a" strokeWidth="2" />
          </svg>

          {isFreeWheelSpinReady ? (
            <span
              data-testid="daily-wheel-free-badge"
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-[0_2px_10px_rgba(16,185,129,0.75)] border border-white/80 whitespace-nowrap"
            >
              ÇEVİR
            </span>
          ) : (
            <span
              data-testid="daily-wheel-cooldown-badge"
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-950/95 border border-amber-400/75 text-amber-300 text-[10px] font-mono font-black tabular-nums shadow-lg whitespace-nowrap"
            >
              {formatWheelCooldownBadge(wheelCooldownMs)}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
