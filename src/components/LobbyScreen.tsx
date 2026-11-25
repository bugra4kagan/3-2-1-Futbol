import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Globe,
  Bot,
  Sparkles,
  Settings,
  KeyRound,
  LogOut,
  AlertCircle,
  X,
  WifiOff,
  ChevronRight,
} from 'lucide-react';
import {
  GameMode,
  BotDifficulty,
  MinigameType,
  PlayerProfile,
  UserProgression,
} from '../game/types';
import { MINIGAME_OPTIONS } from '../game/minigameEngine';
import { formatPoints, getLeagueTierInfo } from '../game/retentionEngine';
import { sanitizePublicDisplayName } from '../game/usernameFilter';
import { normalizeProfileIconId } from '../game/profileIcons';
import { useLanguage } from '../game/LanguageContext';
import { BrandTitle } from './BrandTitle';
import { CoinIcon } from './CoinIcon';
import { GameLogo } from './GameLogo';
import { PlayerAvatar } from './PlayerAvatar';
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
  onToggleMute?: () => void;
  isMuted?: boolean;
  pendingFriendRequestsCount?: number;
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
  onToggleMute,
  isMuted = false,
  onExitApp,
  isNetworkOnline = true,
  onlineError = null,
  onClearOnlineError,
}) => {
  const { t } = useLanguage();
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
  const userAvatar = normalizeProfileIconId(playerProfile.avatar);

  return (
    <div
      data-testid="lobby-screen"
      className="relative min-h-[100dvh] w-full flex flex-col items-center px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] bg-[#0B1220] text-[#F5F3EB] overflow-x-clip"
    >
      {/* Subtle Top Floodlight Horizon */}
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(22,138,82,0.16),transparent_70%)] pointer-events-none" />

      {/* Compact Dark Navy Top Header (Never breaks logo image; no Store button) */}
      <header
        data-testid="lobby-top-header"
        className="sticky top-0 z-40 isolate w-[calc(100%+2rem)] -mx-4 bg-[#16212E] border-b border-[#A8B3C2]/20 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.45rem))] pb-2.5"
      >
        <div className="w-full max-w-xl mx-auto px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <GameLogo size="sm" />
            <div className="min-w-0">
              <BrandTitle size="sm" />
              <div className="flex items-center gap-1.5 text-[11px] text-[#A8B3C2] font-semibold truncate mt-0.5">
                <PlayerAvatar
                  avatar={userAvatar}
                  name={safePlayerName}
                  size="xs"
                  variant="circle"
                  className="!w-4 !h-4 border-none bg-transparent"
                />
                <span data-testid="lobby-username" className="truncate text-[#F5F3EB]">
                  {safePlayerName}
                </span>
                {leagueTier && (
                  <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-[#0B1220] border border-[#E5B94F]/35 text-[10px] text-[#E5B94F] shrink-0">
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
                className="flex items-center gap-1 min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#0B1220] border border-[#E5B94F]/45 text-xs font-black font-score text-[#E5B94F] whitespace-nowrap shrink-0"
                title="Coin Bakiyesi"
              >
                <CoinIcon size="xs" />
                <span>{formatPoints(progression.coins)}</span>
              </div>
            )}

            {onToggleMute && (
              <button
                type="button"
                data-testid="header-sound-toggle-btn"
                onClick={onToggleMute}
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-[#A8B3C2]/25 text-[#FFFFFF] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation text-sm leading-none shrink-0"
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
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-[#A8B3C2]/25 text-[#E5B94F] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
                title={t('settings')}
                aria-label={t('settings')}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {onExitApp && (
              <button
                type="button"
                data-testid="header-exit-btn"
                onClick={onExitApp}
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-[#0B1220] hover:bg-[#DC2626]/20 border border-[#A8B3C2]/25 hover:border-[#DC2626] text-[#A8B3C2] hover:text-[#DC2626] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
                title="Oyundan Çıkış"
                aria-label="Oyundan Çıkış"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero + 3 Color-Differentiated Mode Cards */}
      <main className="relative z-10 w-full max-w-xl flex flex-col items-center text-center my-auto pt-4 pb-2 space-y-4">
        <div className="flex flex-col items-center">
          <div className="relative mb-2 flex items-center justify-center">
            <GameLogo size="lg" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#16212E] border border-[#E5B94F]/45 text-[#E5B94F] text-[11px] font-black tracking-widest uppercase mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>CANLI BİLGİ YARIŞMASI</span>
          </div>

          <h1 className="flex justify-center select-none leading-none">
            <BrandTitle size="lg" />
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[#A8B3C2] max-w-md font-medium">
            {t('lobbyTagline')} 🏆
          </p>
        </div>

        {/* Network Offline Notice */}
        {!isNetworkOnline && (
          <div
            data-testid="offline-status-banner"
            className="w-full p-3 rounded-2xl bg-[#16212E] border border-[#F97316]/60 text-[#F5F3EB] text-xs font-semibold flex items-center gap-2.5 text-left"
          >
            <WifiOff className="w-4 h-4 text-[#F97316] shrink-0" />
            <span className="leading-snug text-[#A8B3C2]">
              <strong className="text-[#FFFFFF]">Çevrimdışı Mod:</strong> Bota Karşı Oyna internet olmadan sorunsuz çalışır. 1v1 Çevrimiçi Maç için internet gerekir.
            </span>
          </div>
        )}

        {/* Online Error Banner */}
        {onlineError && (
          <div
            data-testid="online-error-banner"
            className="w-full p-3 rounded-2xl bg-[#DC2626]/15 border border-[#DC2626]/65 text-[#FFFFFF] text-xs font-semibold flex items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
              <span className="leading-snug">{onlineError}</span>
            </div>
            {onClearOnlineError && (
              <button
                onClick={onClearOnlineError}
                className="p-1 rounded-lg hover:bg-[#DC2626]/30 text-[#FFFFFF] shrink-0 cursor-pointer"
                aria-label="Hata mesajını kapat"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 3 Distinct Core Match Cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {/* 1. 1v1 Çevrimiçi Maç — Green Competitive Design */}
          <button
            type="button"
            data-testid="mode-online-btn"
            onClick={() => setMinigameModalContext('online_match')}
            className="sm:col-span-2 flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-[#183D2B] hover:bg-[#1e4d37] border-2 border-[#168A52] hover:border-[#22C55E] transition transform active:scale-[0.99] text-left shadow-lg group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-[#168A52] border border-[#22C55E]/60 flex items-center justify-center text-[#FFFFFF] group-hover:scale-105 transition shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-extrabold text-[#FFFFFF] text-xl leading-none uppercase">
                    1v1 Çevrimiçi Maç
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#22C55E] text-[#0B1220] shrink-0">
                    CANLI · 4 OYUN
                  </span>
                </div>
                <span className="block text-xs text-[#F5F3EB]/85 mt-1 truncate">
                  {t('lobbyOnlineDesc')}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#22C55E] shrink-0" />
          </button>

          {/* 2. Arkadaşla Oyna — Deep Navy + Info Blue & White */}
          <button
            type="button"
            data-testid="mode-room-btn"
            onClick={() => setShowRoomModal(true)}
            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#16212E] hover:bg-[#1c2a3b] border-2 border-[#3B82F6]/65 hover:border-[#3B82F6] transition transform active:scale-[0.99] text-left shadow-md group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl bg-[#3B82F6]/20 border border-[#3B82F6]/60 flex items-center justify-center text-[#FFFFFF] group-hover:scale-105 transition shrink-0">
                <Users className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-display font-extrabold text-[#FFFFFF] text-lg leading-tight uppercase">
                  Arkadaşla Oyna
                </span>
                <span className="block text-xs text-[#A8B3C2] truncate">
                  Özel oda kur veya koda katıl
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#3B82F6] shrink-0" />
          </button>

          {/* 3. Bota Karşı Oyna — Dark Charcoal + Vibrant Orange */}
          <button
            type="button"
            data-testid="mode-bot-btn"
            onClick={() => setShowBotModal(true)}
            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#16212E] hover:bg-[#1f2937] border-2 border-[#F97316]/70 hover:border-[#F97316] transition transform active:scale-[0.99] text-left shadow-md group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl bg-[#F97316]/20 border border-[#F97316]/60 flex items-center justify-center text-[#F97316] group-hover:scale-105 transition shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-display font-extrabold text-[#FFFFFF] text-lg leading-tight uppercase">
                  Bota Karşı Oyna
                </span>
                <span className="block text-xs text-[#A8B3C2] truncate">
                  Çırak · Şampiyon · Efsane
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#F97316] shrink-0" />
          </button>
        </div>

        <p
          data-testid="lobby-copyright-notice"
          className="pt-1 px-2 text-[11px] font-medium text-[#A8B3C2]/80 text-center leading-relaxed"
        >
          Bağımsız hayran yapımı bilgi yarışmasıdır; hiçbir kulüp, lig veya kuruluşla resmi bağlantısı yoktur.
        </p>
      </main>

      {/* Private Room Modal (Info Blue & Dark Navy Theme) */}
      {showRoomModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#0B1220]/92 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#16212E] border-2 border-[#3B82F6]/55 rounded-3xl p-5 sm:p-6 text-center shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="font-display font-extrabold text-2xl text-[#FFFFFF] flex items-center justify-center gap-2 mb-4 uppercase">
              <KeyRound className="w-5 h-5 text-[#3B82F6]" />
              <span>Arkadaşla Oda</span>
            </h3>

            <div className="flex rounded-xl bg-[#0B1220] p-1 mb-4 border border-[#A8B3C2]/20">
              <button
                onClick={() => setRoomAction('create')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  roomAction === 'create'
                    ? 'bg-[#3B82F6] text-[#FFFFFF]'
                    : 'text-[#A8B3C2] hover:text-[#FFFFFF]'
                }`}
              >
                Oda Oluştur
              </button>
              <button
                onClick={() => setRoomAction('join')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  roomAction === 'join'
                    ? 'bg-[#3B82F6] text-[#FFFFFF]'
                    : 'text-[#A8B3C2] hover:text-[#FFFFFF]'
                }`}
              >
                Odaya Katıl
              </button>
            </div>

            {roomAction === 'create' ? (
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#A8B3C2] mb-1.5">
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
                          ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-[#FFFFFF]'
                          : 'bg-[#0B1220] border-[#A8B3C2]/15 text-[#A8B3C2] hover:text-[#FFFFFF]'
                      }`}
                    >
                      <span>{mg.title}</span>
                      <span className="text-[10px] text-[#E5B94F]">{mg.badgeText}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowRoomModal(false);
                    onSelectMode('online_room', { minigameType: roomMinigame });
                  }}
                  className="w-full py-3 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-[#FFFFFF] font-black text-sm transition active:scale-95 cursor-pointer"
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
                  className="w-full bg-[#0B1220] text-[#FFFFFF] font-score font-black text-center text-lg tracking-widest px-3 py-3 rounded-xl border border-[#A8B3C2]/30 focus:border-[#3B82F6] mb-3 outline-none uppercase"
                />
                <button
                  disabled={!inputCode.trim()}
                  onClick={() => {
                    setShowRoomModal(false);
                    onSelectMode('online_room', { roomCode: inputCode.trim() });
                  }}
                  className="w-full py-3 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 text-[#FFFFFF] font-black text-sm transition active:scale-95 cursor-pointer"
                >
                  Odaya Katıl
                </button>
              </div>
            )}

            <button
              onClick={() => setShowRoomModal(false)}
              className="mt-3 text-xs text-[#A8B3C2] hover:text-[#FFFFFF] font-semibold cursor-pointer"
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

      {/* Bot Difficulty + Minigame Modal */}
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
