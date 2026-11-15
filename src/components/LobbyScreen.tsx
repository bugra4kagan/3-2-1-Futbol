import React, { useState } from 'react';
import {
  Users,
  Globe,
  Bot,
  HelpCircle,
  Trophy,
  Settings,
  KeyRound,
  Sparkles,
  UserCheck,
  LogOut,
  AlertCircle,
  X,
  Gift,
  Coins,
  Flame,
  Target,
  ShoppingBag,
  ShieldCheck,
} from 'lucide-react';
import {
  GameMode,
  BotDifficulty,
  MinigameType,
  PlayerProfile,
  StoreCategory,
  UserProgression,
} from '../game/types';
import { CLUBS } from '../game/database';
import { MINIGAME_OPTIONS } from '../game/minigameEngine';
import { canClaimDailyReward, formatPoints } from '../game/retentionEngine';
import { useLanguage } from '../game/LanguageContext';
import { ClubLogo } from './ClubLogo';
import { CountryFlag } from './CountryFlag';
import { MinigameSelectorModal } from './MinigameSelectorModal';
import { BotSetupModal } from './BotSetupModal';

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
  activeTournamentStageLabel?: string | null;
  onExitApp?: () => void;
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
  activeTournamentStageLabel = null,
  onExitApp,
  onlineError = null,
  onClearOnlineError,
}) => {
  const { t } = useLanguage();
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomAction, setRoomAction] = useState<'create' | 'join'>('create');
  const [roomMinigame, setRoomMinigame] = useState<MinigameType>('two_clubs');
  const [inputCode, setInputCode] = useState('');

  // New modals: Bot Setup (with Çırak/Şampiyon/Efsane + 5 games) & 5-Minigame Selector
  const [showBotModal, setShowBotModal] = useState(false);
  const [minigameModalContext, setMinigameModalContext] = useState<
    'online_match' | 'minigames' | null
  >(null);

  const userClub = playerProfile.favoriteClubId ? CLUBS[playerProfile.favoriteClubId] : null;
  const dailyClaimable = progression ? canClaimDailyReward(progression) : false;
  const completedQuests = progression
    ? progression.dailyQuests.filter((q) => q.progress >= q.target).length
    : 0;
  const claimableQuests = progression
    ? progression.dailyQuests.filter((q) => !q.claimed && q.progress >= q.target).length
    : 0;

  return (
    <div
      data-testid="lobby-screen"
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between p-4 pb-28 bg-slate-950 text-white overflow-x-hidden"
    >
      {/* Background Stadium Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/30 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-2xl flex items-center justify-between gap-3 pt-2 pb-4">
        <div className="flex items-center gap-2 shrink-0">
          <img
            src="/./logo.png"
            alt="3-2-1 Challenge Logo"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover border border-amber-400/40 shadow-md shrink-0"
          />
          <span className="font-extrabold tracking-tight text-white text-sm sm:text-base whitespace-nowrap">
            <span className="sm:hidden">3-2-1</span>
            <span className="hidden sm:inline">3-2-1 FOOTBALL</span>
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {onOpenStore && (
            <button
              type="button"
              data-testid="header-store-btn"
              onClick={() => onOpenStore('featured')}
              className="flex items-center justify-center gap-1 min-w-[36px] min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 text-xs font-black transition active:scale-95 shadow-sm cursor-pointer"
              title={t('store')}
              aria-label={t('store')}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t('store')}</span>
            </button>
          )}

          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 text-xs font-bold text-white transition active:scale-95 shadow-sm"
              title="Hesap & Kulüp Profiliniz"
              aria-label="Hesap & Kulüp Profiliniz"
            >
              {userClub ? (
                <ClubLogo club={userClub} size="xs" />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="truncate max-w-[48px] sm:max-w-[96px]">{playerProfile.name}</span>
            </button>
          )}

          <button
            onClick={() => setShowHowToPlay(true)}
            className="flex items-center justify-center gap-1 min-w-[36px] min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition active:scale-95"
            aria-label={t('rules')}
          >
            <HelpCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">{t('rules')}</span>
          </button>

          {onOpenSettings && (
            <button
              type="button"
              data-testid="header-settings-btn"
              onClick={onOpenSettings}
              className="min-w-[36px] min-h-[38px] p-1.5 sm:p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition active:scale-95 flex items-center justify-center cursor-pointer"
              title={t('settings')}
              aria-label={t('settings')}
            >
              <Settings className="w-4 h-4 text-emerald-400" />
            </button>
          )}

          {onExitApp && (
            <button
              onClick={onExitApp}
              className="min-w-[36px] min-h-[38px] p-1.5 sm:p-2 rounded-xl bg-slate-900/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500 text-slate-400 hover:text-rose-400 transition active:scale-95 flex items-center justify-center"
              title="Oyundan Çıkış"
              aria-label="Oyundan Çıkış"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Hero Title Lockup */}
      <div className="relative z-10 w-full max-w-xl flex flex-col items-center text-center my-auto py-2">
        <div className="relative group mb-2">
          <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/30 to-emerald-500/30 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-700 pointer-events-none" />
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-400/50 bg-slate-900/90 mx-auto transition-transform duration-300 hover:scale-105">
            <img
              src="/./logo.png"
              alt="3-2-1 Football Logo"
              className="w-full h-full object-cover select-none"
            />
          </div>
        </div>

        {userClub ? (
          <div className="inline-flex max-w-full items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2 overflow-hidden">
            <ClubLogo club={userClub} size="xs" />
            <span className="truncate">KULÜP ÜYESİ: {userClub.name}</span>
            <CountryFlag country={userClub.country} flag={userClub.countryFlag} size="xs" />
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black tracking-widest uppercase mb-2 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            CANLI BİLGİ YARIŞMASI
          </div>
        )}

        <h1 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase drop-shadow-xl select-none leading-none">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
            3-2-1
          </span>{' '}
          <span className="text-white">FOOTBALL</span>
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-md font-medium">
          {t('lobbyTagline')} 🏆
        </p>

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
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-black min-h-[48px] transition active:scale-95 cursor-pointer ${
                  dailyClaimable
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 border-amber-300 text-slate-950 shadow-md shadow-amber-500/20 animate-pulse'
                    : 'bg-slate-950/90 hover:bg-slate-800 border-emerald-500/35 text-emerald-400'
                }`}
              >
                <Gift className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {dailyClaimable ? t('lobbyDailyReward') : t('lobbyDailyDone')}
                </span>
              </button>
            )}

            {/* Daily Quests Action */}
            {onOpenQuests && (
              <button
                type="button"
                data-testid="open-quests-btn"
                onClick={onOpenQuests}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-black min-h-[48px] transition active:scale-95 cursor-pointer ${
                  claimableQuests > 0
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400 text-emerald-300 animate-pulse'
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

        {/* Game Mode Cards: Primary 1v1 Online (5 games) + Tournament + Solo Bot + Private Room */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {/* Featured Mode 1: 1'e 1 Çevrim İçi Yarışma (All 5 Multiplayer Games) */}
          <button
            data-testid="mode-online-btn"
            onClick={() => setMinigameModalContext('online_match')}
            className="sm:col-span-2 flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-emerald-500/15 hover:from-amber-500/25 hover:to-emerald-500/25 border border-amber-400/50 hover:border-amber-300 transition transform active:scale-[0.99] text-left shadow-xl group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-sm sm:text-base">
                  {t('lobbyOnlineTitle')}
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 shrink-0">
                  5 Oyun
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

          {/* Mode 4: 8 Kişilik Eleme Turnuvası (Açık Ödül & Arkadaşlar Arası) */}
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

        {/* Sponsored Ad Banner (Automatically disappears when Reklam Engelleme VIP is active) */}
        {progression && !progression.adFree && onOpenStore && (
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
      </div>


      {/* Rules / How To Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 text-left shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="text-xl font-black text-white flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>5 Mini Oyun & Kurallar</span>
            </h3>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <div className="flex gap-2.5">
                <span className="font-mono font-black text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                  1
                </span>
                <p>
                  <strong className="text-white">İki Kulüp:</strong> İki kulübün formasını giymiş ortak futbolcuyu ilk bul.
                </p>
              </div>
              <div className="flex gap-2.5">
                <span className="font-mono font-black text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/30 shrink-0">
                  2
                </span>
                <p>
                  <strong className="text-white">Futbolcuyu Tahmin Et:</strong> 2 dakika ve en fazla 8 deneme hakkıyla bulanık portre + 5 ipucu kartından (takım, ülke, mevki, yaş, forma) yıldızı ilk bilen kazanır.
                </p>
              </div>
              <div className="flex gap-2.5">
                <span className="font-mono font-black text-purple-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-500/30 shrink-0">
                  3
                </span>
                <p>
                  <strong className="text-white">Futbol XOX:</strong> Sırayla kare seç, kesişime uyan futbolcuyu yaz, 3'lü sıra kur!
                </p>
              </div>
              <div className="flex gap-2.5">
                <span className="font-mono font-black text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-500/30 shrink-0">
                  4
                </span>
                <p>
                  <strong className="text-white">Kariyer Yolu:</strong> Kronolojik kulüp transferlerinden futbolcuyu ilk çöz.
                </p>
              </div>
              <div className="flex gap-2.5">
                <span className="font-mono font-black text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-500/30 shrink-0">
                  5
                </span>
                <p>
                  <strong className="text-white">1 Ülke + 1 Kulüp:</strong> Verilen ülkeden olup o kulüpte oynamış futbolcuyu ilk yaz.
                </p>
              </div>
              <p className="pt-2 border-t border-slate-800 text-xs text-emerald-300 font-semibold">
                Her oyunda 3-2-1 geri sayım sonrası yarış başlar. İlk 3 galibiyete ulaşan şampiyon olur! 🏆
              </p>
            </div>

            <button
              onClick={() => setShowHowToPlay(false)}
              className="mt-5 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              Anladım, Haydi Başlayalım!
            </button>
          </div>
        </div>
      )}

      {/* Private Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
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
        </div>
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
    </div>
  );
};
