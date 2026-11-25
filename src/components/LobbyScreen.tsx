import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Globe,
  Bot,
  Trophy,
  Settings,
  KeyRound,
  LogOut,
  AlertCircle,
  X,
  ShoppingBag,
  WifiOff,
  ChevronRight,
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
import { formatPoints, getLeagueTierInfo } from '../game/retentionEngine';
import { sanitizePublicDisplayName } from '../game/usernameFilter';
import { useLanguage } from '../game/LanguageContext';
import { UiTheme } from '../game/themeEngine';
import { BrandTitle } from './BrandTitle';
import { CoinIcon } from './CoinIcon';
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
  onOpenEnergy?: () => void;
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
  onOpenStore,
  onOpenTournament,
  onToggleMute,
  isMuted = false,
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
  const [showBotModal, setShowBotModal] = useState(false);
  const [minigameModalContext, setMinigameModalContext] = useState<
    'online_match' | 'minigames' | null
  >(null);

  const safePlayerName = sanitizePublicDisplayName(playerProfile.name, playerProfile.id);
  const leagueTier = progression ? getLeagueTierInfo(progression.leagueTierId) : null;

  return (
    <div
      data-testid="lobby-screen"
      className="relative min-h-[100dvh] w-full flex flex-col items-center px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] bg-[#080E14] text-[#F8FAFC] overflow-x-clip"
    >
      {/* Subtle Stadium Floodlight Horizon */}
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.12),transparent_70%)] pointer-events-none" />

      {/* Compact Top Header */}
      <header
        data-testid="lobby-top-header"
        className="sticky top-0 z-40 isolate w-[calc(100%+2rem)] -mx-4 bg-[#101B24]/95 border-b border-white/10 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.45rem))] pb-2.5"
      >
        <div className="w-full max-w-xl mx-auto px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {!logoError ? (
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="3-2-1 Futbol Logosu"
                onError={() => setLogoError(true)}
                className="w-8 h-8 rounded-xl object-cover border border-[#22C55E]/40 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-[#123D2B] border border-[#22C55E]/50 flex items-center justify-center shrink-0">
                <span className="text-sm leading-none">⚽</span>
              </div>
            )}
            <div className="min-w-0">
              <BrandTitle size="sm" />
              <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] font-semibold truncate">
                <span aria-hidden="true">⚽</span>
                <span data-testid="lobby-username" className="truncate text-[#F8FAFC]">
                  {safePlayerName}
                </span>
                {leagueTier && (
                  <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-[#14232C] border border-white/10 text-[10px] text-[#22C55E] shrink-0">
                    {leagueTier.icon} {leagueTier.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {progression && (
              <div
                data-testid="lobby-coins"
                className="flex items-center gap-1 min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#14232C] border border-white/10 text-xs font-black font-mono text-[#FBBF24] whitespace-nowrap shrink-0"
                title="Coin Bakiyesi"
              >
                <CoinIcon size="xs" />
                <span className="tabular-nums">{formatPoints(progression.coins)}</span>
              </div>
            )}

            {onOpenStore && (
              <button
                type="button"
                data-testid="header-store-btn"
                onClick={() => onOpenStore('featured')}
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-[#14232C] hover:bg-[#123D2B] border border-white/10 text-[#F8FAFC] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
                title={t('store')}
                aria-label={t('store')}
              >
                <ShoppingBag className="w-4 h-4 text-[#22C55E]" />
              </button>
            )}

            {onToggleMute && (
              <button
                type="button"
                data-testid="header-sound-toggle-btn"
                onClick={onToggleMute}
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-[#14232C] hover:bg-[#101B24] border border-white/10 text-[#F8FAFC] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation text-sm leading-none shrink-0"
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
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-[#14232C] hover:bg-[#101B24] border border-white/10 text-[#F8FAFC] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
                title={t('settings')}
                aria-label={t('settings')}
              >
                <Settings className="w-4 h-4 text-[#94A3B8]" />
              </button>
            )}

            {onExitApp && (
              <button
                type="button"
                data-testid="header-exit-btn"
                onClick={onExitApp}
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-[#14232C] hover:bg-red-950/70 border border-white/10 text-[#94A3B8] hover:text-[#EF4444] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
                title="Oyundan Çıkış"
                aria-label="Oyundan Çıkış"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Arena Content */}
      <main className="relative z-10 w-full max-w-xl flex flex-col flex-1 justify-center py-5 space-y-4">
        {/* Compact Arena Title */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#123D2B] border border-[#22C55E]/35 text-[#22C55E] text-[10px] font-black tracking-widest uppercase">
            <span>⚽ MAÇ GÜNÜ ARENASI</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#F8FAFC]">
            Sahaya Çık, Rakibini Geç
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            İki Kulüp · Futbol XOX · Kariyer Yolu · Ülke + Kulüp
          </p>
        </div>

        {/* Network Offline Notice */}
        {!isNetworkOnline && (
          <div
            data-testid="offline-status-banner"
            className="w-full p-3 rounded-2xl bg-[#14232C] border border-[#FBBF24]/40 text-[#F8FAFC] text-xs font-semibold flex items-center gap-2.5 text-left"
          >
            <WifiOff className="w-4 h-4 text-[#FBBF24] shrink-0" />
            <span className="leading-snug text-[#94A3B8]">
              <strong className="text-[#F8FAFC]">Çevrimdışı Mod:</strong> Botla Maç internet olmadan oynanır. Online 1v1 için internet bağlantısı gerekir.
            </span>
          </div>
        )}

        {/* Online Error Banner */}
        {onlineError && (
          <div
            data-testid="online-error-banner"
            className="w-full p-3 rounded-2xl bg-red-950/75 border border-[#EF4444]/60 text-[#F8FAFC] text-xs font-semibold flex items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
              <span className="leading-snug">{onlineError}</span>
            </div>
            {onClearOnlineError && (
              <button
                onClick={onClearOnlineError}
                className="p-1 rounded-lg hover:bg-red-900/60 text-[#94A3B8] hover:text-white shrink-0"
                aria-label="Hata mesajını kapat"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 3 Primary Game Mode Cards */}
        <div className="w-full flex flex-col gap-3">
          {/* 1. 1v1 Çevrimiçi Maç (Primary Accent CTA) */}
          <button
            type="button"
            data-testid="mode-online-btn"
            onClick={() => setMinigameModalContext('online_match')}
            className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-[#123D2B] hover:bg-[#154b35] border-2 border-[#22C55E] transition transform active:scale-[0.99] text-left cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#22C55E] text-[#080E14] flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-[#F8FAFC] text-base sm:text-lg">
                    1v1 Çevrimiçi Maç
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#22C55E] text-[#080E14] shrink-0">
                    CANLI
                  </span>
                </div>
                <span className="block text-xs sm:text-sm text-[#F8FAFC]/80 mt-0.5">
                  Gerçek rakiplerle futbol bilgini kanıtla.
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#22C55E] shrink-0" />
          </button>

          {/* 2. Arkadaşla Oda */}
          <button
            type="button"
            data-testid="mode-room-btn"
            onClick={() => setShowRoomModal(true)}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#101B24] hover:bg-[#14232C] border border-white/10 hover:border-[#22C55E]/50 transition transform active:scale-[0.99] text-left cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#14232C] border border-white/10 flex items-center justify-center text-[#22C55E] shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="block font-black text-[#F8FAFC] text-base">
                  Arkadaşla Oda
                </span>
                <span className="block text-xs sm:text-sm text-[#94A3B8] mt-0.5">
                  Oda oluştur veya arkadaşının odasına katıl.
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#94A3B8] shrink-0" />
          </button>

          {/* 3. Botla Maç */}
          <button
            type="button"
            data-testid="mode-bot-btn"
            onClick={() => setShowBotModal(true)}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#101B24] hover:bg-[#14232C] border border-white/10 hover:border-[#22C55E]/50 transition transform active:scale-[0.99] text-left cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#14232C] border border-white/10 flex items-center justify-center text-[#FBBF24] shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-[#F8FAFC] text-base">
                    Botla Maç
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#14232C] border border-white/10 text-[#94A3B8]">
                    Çırak · Şampiyon · Efsane
                  </span>
                </div>
                <span className="block text-xs sm:text-sm text-[#94A3B8] mt-0.5">
                  Yapay zekâya karşı futbol bilgini geliştir.
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#94A3B8] shrink-0" />
          </button>

          {/* Optional Tournament Secondary Row */}
          {onOpenTournament && (
            <button
              type="button"
              data-testid="mode-tournament-btn"
              onClick={onOpenTournament}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#101B24] hover:bg-[#14232C] border border-white/10 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Trophy className="w-5 h-5 text-[#FBBF24] shrink-0" />
                <div className="min-w-0">
                  <span className="block font-bold text-[#F8FAFC] text-sm truncate">
                    8 Kişilik Eleme Turnuvası
                  </span>
                  <span className="block text-[11px] text-[#94A3B8] truncate">
                    {activeTournamentStageLabel || 'Tek maç eleme usulü kupa'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" />
            </button>
          )}
        </div>

        <p
          data-testid="lobby-copyright-notice"
          className="pt-2 px-2 text-[11px] font-medium text-[#94A3B8]/70 text-center leading-relaxed"
        >
          Bağımsız hayran yapımı bilgi yarışmasıdır; hiçbir kulüp, lig veya kuruluşla resmi bağlantısı yoktur.
        </p>
      </main>

      {/* Private Room Modal */}
      {showRoomModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#080E14]/90 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#101B24] border border-white/10 rounded-3xl p-5 sm:p-6 text-center shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-black text-[#F8FAFC] flex items-center justify-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-[#22C55E]" />
              <span>Arkadaşla Oda</span>
            </h3>

            <div className="flex rounded-xl bg-[#080E14] p-1 mb-4 border border-white/10">
              <button
                onClick={() => setRoomAction('create')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  roomAction === 'create'
                    ? 'bg-[#22C55E] text-[#080E14]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                Oda Oluştur
              </button>
              <button
                onClick={() => setRoomAction('join')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  roomAction === 'join'
                    ? 'bg-[#22C55E] text-[#080E14]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                Odaya Katıl
              </button>
            </div>

            {roomAction === 'create' ? (
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Oyun Türünü Seç
                </label>
                <div className="space-y-1.5 mb-4">
                  {MINIGAME_OPTIONS.map((mg) => (
                    <button
                      key={mg.id}
                      type="button"
                      onClick={() => setRoomMinigame(mg.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        roomMinigame === mg.id
                          ? 'bg-[#123D2B] border-[#22C55E] text-[#F8FAFC]'
                          : 'bg-[#14232C] border-white/10 text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      <span>{mg.title}</span>
                      <span className="text-[10px] text-[#22C55E]">{mg.badgeText}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowRoomModal(false);
                    onSelectMode('online_room', { minigameType: roomMinigame });
                  }}
                  className="w-full py-3 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] text-[#080E14] font-black text-sm transition active:scale-95 cursor-pointer"
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
                      : raw.trim().replace(/\s+/g, '').toUpperCase().slice(0, 6);
                    setInputCode(extracted);
                  }}
                  placeholder="6 HANELİ ODA KODU"
                  className="w-full bg-[#080E14] text-[#F8FAFC] font-mono font-black text-center text-lg tracking-widest px-3 py-3 rounded-xl border border-white/15 focus:border-[#22C55E] mb-3 outline-none uppercase"
                />
                <button
                  disabled={!inputCode.trim()}
                  onClick={() => {
                    setShowRoomModal(false);
                    onSelectMode('online_room', { roomCode: inputCode.trim() });
                  }}
                  className="w-full py-3 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] disabled:opacity-40 text-[#080E14] font-black text-sm transition active:scale-95 cursor-pointer"
                >
                  Odaya Katıl
                </button>
              </div>
            )}

            <button
              onClick={() => setShowRoomModal(false)}
              className="mt-3 text-xs text-[#94A3B8] hover:text-[#F8FAFC] font-semibold cursor-pointer"
            >
              Vazgeç
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 4-Minigame Selector Modal */}
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
