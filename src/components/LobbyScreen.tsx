import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  User,
  Globe,
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
  resumableMatch?: {
    roomCode: string;
    minigameType: MinigameType;
    opponentName?: string;
    failedAutoReconnect?: boolean;
    isReconnecting?: boolean;
  } | null;
  onResumeMatch?: () => void;
  onAbandonResumableMatch?: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = React.memo(({
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
  resumableMatch = null,
  onResumeMatch,
  onAbandonResumableMatch,
}) => {
  const { t } = useLanguage();
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomAction, setRoomAction] = useState<'create' | 'join'>('create');
  const [roomMinigame, setRoomMinigame] = useState<MinigameType>('two_clubs');
  const [inputCode, setInputCode] = useState('');
  const [showBotModal, setShowBotModal] = useState(false);
  const [showAbandonMatchConfirm, setShowAbandonMatchConfirm] = useState(false);
  const [minigameModalContext, setMinigameModalContext] = useState<
    'online_match' | 'minigames' | null
  >(null);

  const safePlayerName = sanitizePublicDisplayName(playerProfile.name, playerProfile.id);
  const leagueTier = progression ? getLeagueTierInfo(progression.leagueTierId) : null;
  const userAvatar = normalizeProfileIconId(playerProfile.avatar);

  return (
    <div
      data-testid="lobby-screen"
      className="relative min-h-[100dvh] w-full flex flex-col items-center px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pitch-turf-backdrop text-[#F5F3EB] overflow-x-clip"
    >
      {/* Lightweight Vector Pitch Markings (Halfway line & center circle, zero blur) */}
      <svg
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full opacity-[0.09] pointer-events-none"
      >
        <rect x="20" y="20" width="360" height="760" rx="4" fill="none" stroke="#F5F3EB" strokeWidth="2" />
        <line x1="20" y1="400" x2="380" y2="400" stroke="#F5F3EB" strokeWidth="2" />
        <circle cx="200" cy="400" r="72" fill="none" stroke="#F5F3EB" strokeWidth="2" />
        <circle cx="200" cy="400" r="4" fill="#F5F3EB" />
      </svg>

      {/* Compact Stadium Green-Navy Header */}
      <header
        data-testid="lobby-top-header"
        className="sticky top-0 z-40 isolate w-[calc(100%+2rem)] -mx-4 bg-[#0E3120]/95 border-b border-[#E5B94F]/30 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.45rem))] pb-2.5"
      >
        <div className="w-full max-w-xl sm:max-w-2xl tablet-land:max-w-5xl mx-auto px-2 sm:px-4 flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
            <GameLogo size="sm" variant="compact" className="!w-8 !h-8 min-[360px]:!w-9 min-[360px]:!h-9 sm:!w-10 sm:!h-10" />
            <div className="min-w-0 overflow-hidden">
              <BrandTitle size="sm" />
              <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] text-[#C4D6CA] font-semibold truncate mt-0.5">
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
                  <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-[#0F273E] border border-[#E5B94F]/45 text-[10px] text-[#E5B94F] shrink-0">
                    {leagueTier.icon} {leagueTier.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {progression && (
              <div
                data-testid="lobby-coins"
                className="flex items-center gap-1 min-h-[32px] min-[360px]:min-h-[34px] sm:min-h-[38px] px-1.5 min-[360px]:px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-[#0F273E] border border-[#E5B94F]/50 text-[11px] sm:text-xs font-black font-score text-[#E5B94F] whitespace-nowrap shrink-0"
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
                className="min-w-[32px] min-h-[32px] min-[360px]:min-w-[34px] min-[360px]:min-h-[34px] sm:min-w-[38px] sm:min-h-[38px] p-1 sm:p-2 rounded-xl bg-[#0F273E] hover:bg-[#173857] border border-[#F5F3EB]/20 text-[#FFFFFF] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation text-xs sm:text-sm leading-none shrink-0"
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
                className="min-w-[32px] min-h-[32px] min-[360px]:min-w-[34px] min-[360px]:min-h-[34px] sm:min-w-[38px] sm:min-h-[38px] p-1 sm:p-2 rounded-xl bg-[#0F273E] hover:bg-[#173857] border border-[#F5F3EB]/20 text-[#E5B94F] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
                title={t('settings')}
                aria-label={t('settings')}
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            {onExitApp && (
              <button
                type="button"
                data-testid="header-exit-btn"
                onClick={onExitApp}
                className="min-w-[32px] min-h-[32px] min-[360px]:min-w-[34px] min-[360px]:min-h-[34px] sm:min-w-[38px] sm:min-h-[38px] p-1 sm:p-2 rounded-xl bg-[#0F273E] hover:bg-[#C93B32]/25 border border-[#F5F3EB]/20 hover:border-[#C93B32] text-[#C4D6CA] hover:text-[#FCA5A5] transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
                title="Oyundan Çıkış"
                aria-label="Oyundan Çıkış"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero + 3 Distinct Stadium Mode Cards (Scaled single-column on phone & portrait tablet; 2-col on landscape tablet/desktop) */}
      <main className="relative z-10 w-full max-w-xl sm:max-w-xl tablet-land:max-w-5xl flex-1 flex flex-col items-center justify-center tablet-land:my-auto pt-3 sm:pt-5 pb-3 space-y-4">
        <div className="w-full flex flex-col tablet-land:grid tablet-land:grid-cols-[0.9fr_1.15fr] tablet-land:items-center tablet-land:gap-8 space-y-4 tablet-land:space-y-0">
          <div className="flex flex-col items-center tablet-land:items-center tablet-land:text-center tablet-land:p-6 tablet-land:rounded-3xl tablet-land:bg-[#0E3120]/55 tablet-land:border tablet-land:border-[#E5B94F]/25">
            <div className="relative mb-2 sm:mb-2.5 flex items-center justify-center">
              <GameLogo size="lg" variant="full" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F273E]/90 border border-[#E5B94F]/50 text-[#E5B94F] text-[10px] sm:text-[11px] font-black tracking-widest uppercase mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>CANLI BİLGİ YARIŞMASI</span>
            </div>

            <h1 className="flex justify-center select-none leading-none">
              <BrandTitle size="lg" />
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-[#D7E6DC] max-w-md font-medium">
              {t('lobbyTagline')} 🏆
            </p>
          </div>

          <div className="w-full flex flex-col space-y-3">
            {/* Active Match Reconnect Card (shown when a live match session awaits resume or auto-reconnect failed) */}
            {resumableMatch && (
              <div
                data-testid="resumable-match-card"
                className="w-full p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#0F273E] to-[#13385A] border-2 border-[#E5B94F]/75 shadow-xl text-left space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E5B94F]/20 border border-[#E5B94F]/50 text-[10px] font-black text-[#E5B94F] uppercase tracking-wider">
                      ⚡ CANLI ODA: {resumableMatch.roomCode}
                    </span>
                    <h2 className="font-display font-extrabold text-lg sm:text-xl text-[#FFFFFF] uppercase mt-1 leading-tight">
                      DEVAM EDEN MAÇIN VAR!
                    </h2>
                    <p className="text-xs text-[#D7E6DC] mt-0.5 leading-snug">
                      {resumableMatch.opponentName
                        ? `${resumableMatch.opponentName} ile oynadığın maç bekliyor.`
                        : 'Bağlantı koptuğun aktif maça kaldığın skor ve süreyle dönebilirsin.'}
                      {resumableMatch.failedAutoReconnect
                        ? ' Otomatik bağlantı zaman aşımına uğradı; manuel tekrar dene.'
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    data-testid="resume-match-btn"
                    disabled={resumableMatch.isReconnecting}
                    onClick={onResumeMatch}
                    className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#168A52] hover:bg-[#1fa363] disabled:opacity-60 text-[#FFFFFF] font-black text-xs sm:text-sm uppercase tracking-wide transition active:scale-95 cursor-pointer"
                  >
                    {resumableMatch.isReconnecting ? 'Bağlanılıyor...' : 'MAÇA GERİ DÖN'}
                  </button>
                  <button
                    type="button"
                    data-testid="abandon-match-btn"
                    disabled={resumableMatch.isReconnecting}
                    onClick={() => setShowAbandonMatchConfirm(true)}
                    className="min-h-[42px] px-3.5 py-2.5 rounded-xl bg-[#0B1E30] hover:bg-[#C93B32]/25 border border-white/20 hover:border-[#C93B32] text-[#FCA5A5] font-bold text-xs transition active:scale-95 cursor-pointer"
                  >
                    Maçtan Ayrıl
                  </button>
                </div>
              </div>
            )}

            {/* Network Offline Notice */}
            {!isNetworkOnline && (
              <div
                data-testid="offline-status-banner"
                className="w-full p-3 rounded-2xl bg-[#16212E] border border-[#F97316]/60 text-[#F5F3EB] text-xs font-semibold flex items-center gap-2.5 text-left"
              >
                <WifiOff className="w-4 h-4 text-[#F97316] shrink-0" />
                <span className="leading-snug text-[#A8B3C2]">
                  <strong className="text-[#FFFFFF]">Çevrimdışı Mod:</strong> Tek Oyunculu mod internet olmadan sorunsuz çalışır. 1v1 Çevrimiçi Maç için internet gerekir.
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
          {/* 1. 1v1 Çevrimiçi Maç — Vibrant Stadium Grass Green */}
          <button
            type="button"
            data-testid="mode-online-btn"
            onClick={() => setMinigameModalContext('online_match')}
            className="sm:col-span-2 flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-[#1A6B40] to-[#145331] hover:from-[#1F7C4B] hover:to-[#175F39] border-2 border-[#4ADE80]/75 hover:border-[#E5B94F] transition transform active:scale-[0.99] text-left shadow-lg group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-[#0F273E]/85 border border-[#E5B94F]/60 flex items-center justify-center text-[#FFFFFF] group-hover:scale-105 transition shrink-0">
                <Globe className="w-6 h-6 text-[#4ADE80]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-extrabold text-[#FFFFFF] text-xl leading-none uppercase">
                    1v1 Çevrimiçi Maç
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#E5B94F] text-[#0D3822] shrink-0">
                    CANLI · 4 OYUN
                  </span>
                </div>
                <span className="block text-xs text-[#F5F3EB]/90 mt-1 leading-snug">
                  {t('lobbyOnlineDesc')}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#E5B94F] shrink-0" />
          </button>

          {/* 2. Arkadaşla Oyna — Deep Stadium Navy Contrast */}
          <button
            type="button"
            data-testid="mode-room-btn"
            onClick={() => setShowRoomModal(true)}
            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#102940] hover:bg-[#153552] border-2 border-[#3B82F6]/70 hover:border-[#60A5FA] transition transform active:scale-[0.99] text-left shadow-md group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl bg-[#3B82F6]/20 border border-[#60A5FA]/60 flex items-center justify-center text-[#FFFFFF] group-hover:scale-105 transition shrink-0">
                <Users className="w-5 h-5 text-[#60A5FA]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-display font-extrabold text-[#FFFFFF] text-lg leading-tight uppercase">
                  Arkadaşla Oyna
                </span>
                <span className="block text-xs text-[#C4D6CA] leading-snug mt-0.5">
                  Özel oda kur veya koda katıl
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#60A5FA] shrink-0" />
          </button>

          {/* 3. Tek Oyunculu — Rich Forest Olive + Orange Accent */}
          <button
            type="button"
            data-testid="mode-bot-btn"
            onClick={() => setShowBotModal(true)}
            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#143D29] hover:bg-[#194B32] border-2 border-[#F97316]/75 hover:border-[#FB923C] transition transform active:scale-[0.99] text-left shadow-md group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl bg-[#F97316]/20 border border-[#F97316]/65 flex items-center justify-center text-[#FB923C] group-hover:scale-105 transition shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-display font-extrabold text-[#FFFFFF] text-lg leading-tight uppercase">
                  Tek Oyunculu
                </span>
                <span className="block text-xs text-[#C4D6CA] leading-snug mt-0.5">
                  Çırak · Şampiyon · Efsane
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#FB923C] shrink-0" />
          </button>
            </div>
          </div>
        </div>

        <p
          data-testid="lobby-copyright-notice"
          className="pt-1 px-2 text-[11px] font-medium text-[#D7E6DC]/80 text-center leading-relaxed"
        >
          Bağımsız hayran yapımı bilgi yarışmasıdır; hiçbir kulüp, lig veya kuruluşla resmi bağlantısı yoktur.
        </p>
      </main>

      {/* Private Room Modal (Stadium Navy + Green Theme) */}
      {showRoomModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#092316]/88 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#102940] border-2 border-[#3B82F6]/65 rounded-3xl p-5 sm:p-6 text-center shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="font-display font-extrabold text-2xl text-[#FFFFFF] flex items-center justify-center gap-2 mb-4 uppercase">
              <KeyRound className="w-5 h-5 text-[#60A5FA]" />
              <span>Arkadaşla Oda</span>
            </h3>

            <div className="flex rounded-xl bg-[#0B1E30] p-1 mb-4 border border-white/15">
              <button
                onClick={() => setRoomAction('create')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  roomAction === 'create'
                    ? 'bg-[#3B82F6] text-[#FFFFFF]'
                    : 'text-[#C4D6CA] hover:text-[#FFFFFF]'
                }`}
              >
                Oda Oluştur
              </button>
              <button
                onClick={() => setRoomAction('join')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  roomAction === 'join'
                    ? 'bg-[#3B82F6] text-[#FFFFFF]'
                    : 'text-[#C4D6CA] hover:text-[#FFFFFF]'
                }`}
              >
                Odaya Katıl
              </button>
            </div>

            {roomAction === 'create' ? (
              <div className="text-left">
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#C4D6CA] mb-1.5">
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
                          ? 'bg-[#154A30] border-[#4ADE80] text-[#FFFFFF]'
                          : 'bg-[#0B1E30] border-white/15 text-[#C4D6CA] hover:text-[#FFFFFF]'
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
                  className="w-full py-3 rounded-xl bg-[#168A52] hover:bg-[#1fa363] text-[#FFFFFF] font-black text-sm transition active:scale-95 cursor-pointer"
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
                  className="w-full bg-[#0B1E30] text-[#FFFFFF] font-score font-black text-center text-lg tracking-widest px-3 py-3 rounded-xl border border-white/25 focus:border-[#3B82F6] mb-3 outline-none uppercase"
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
              className="mt-3 text-xs text-[#C4D6CA] hover:text-[#FFFFFF] font-semibold cursor-pointer"
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

      {/* Explicit Confirmation Modal Before Abandoning Active Rejoinable Match */}
      {showAbandonMatchConfirm && typeof document !== 'undefined' && createPortal(
        <div
          data-testid="abandon-match-confirm-modal"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-[#092316]/90 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm bg-[#102940] border-2 border-[#C93B32]/75 rounded-3xl p-5 text-center shadow-2xl space-y-3">
            <h3 className="font-display font-extrabold text-xl text-[#FFFFFF] uppercase">
              Maçtan Ayrılmak İstiyor Musun?
            </h3>
            <p className="text-xs text-[#D7E6DC] leading-relaxed">
              Maçtan kalıcı olarak ayrılırsan bu maça geri dönemezsin ve aktif karşılaşma hükmen sonlandırılır.
            </p>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                data-testid="abandon-match-cancel-btn"
                onClick={() => setShowAbandonMatchConfirm(false)}
                className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-[#168A52] hover:bg-[#1fa363] text-[#FFFFFF] font-black text-xs cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                data-testid="abandon-match-confirm-btn"
                onClick={() => {
                  setShowAbandonMatchConfirm(false);
                  onAbandonResumableMatch?.();
                }}
                className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-[#C93B32] hover:bg-[#b02e26] text-[#FFFFFF] font-black text-xs cursor-pointer"
              >
                Evet, Maçtan Ayrıl
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});
