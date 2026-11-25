import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Globe,
  Bot,
  Trophy,
  Sparkles,
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
  onOpenStore?: (category?: StoreCategory) => void;
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
  onOpenStore,
  onToggleMute,
  isMuted = false,
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
      className="relative min-h-[100dvh] w-full flex flex-col items-center px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] bg-slate-950 text-white overflow-x-clip"
    >
      {/* Stadium Glow Accents matching original visual identity */}
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.16),transparent_65%)] pointer-events-none" />
      <div className="absolute inset-x-0 top-16 h-64 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.10),transparent_60%)] pointer-events-none" />

      {/* Compact Top Header */}
      <header
        data-testid="lobby-top-header"
        className="sticky top-0 z-40 isolate w-[calc(100%+2rem)] -mx-4 bg-slate-950/95 border-b border-slate-800/80 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.45rem))] pb-2"
      >
        <div className="w-full max-w-xl mx-auto px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {!logoError ? (
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="3-2-1 Futbol Logosu"
                onError={() => setLogoError(true)}
                className="w-8 h-8 rounded-xl object-cover border border-amber-400/50 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-400/50 flex items-center justify-center shrink-0">
                <span className="text-sm leading-none">⚽</span>
              </div>
            )}
            <div className="min-w-0">
              <BrandTitle size="sm" />
              <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold truncate">
                <span aria-hidden="true">⚽</span>
                <span data-testid="lobby-username" className="truncate text-white">
                  {safePlayerName}
                </span>
                {leagueTier && (
                  <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-900 border border-emerald-500/35 text-[10px] text-emerald-300 shrink-0">
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
                className="flex items-center gap-1 min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-900 border border-amber-500/40 text-xs font-black font-mono text-amber-300 whitespace-nowrap shrink-0"
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
                className="flex items-center justify-center gap-1 min-w-[38px] min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/60 text-amber-300 text-xs font-black transition active:scale-95 cursor-pointer touch-manipulation shrink-0"
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
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation text-sm leading-none shrink-0"
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
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
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
                className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-400 transition active:scale-95 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
                title="Oyundan Çıkış"
                aria-label="Oyundan Çıkış"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Rich Original Stadium Hero + 3 Core Modes */}
      <main className="relative z-10 w-full max-w-xl flex flex-col items-center text-center my-auto pt-4 pb-2 space-y-4">
        {/* Hero Shield Lockup */}
        <div className="flex flex-col items-center">
          <div className="relative mb-2.5">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-3xl overflow-hidden shadow-[0_0_28px_rgba(245,158,11,0.22)] border-2 border-amber-400/50 bg-slate-900 mx-auto transition-transform duration-200 hover:scale-[1.03] flex items-center justify-center">
              {!logoError ? (
                <img
                  src={`${import.meta.env.BASE_URL}logo.png`}
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
        </div>

        {/* Network Offline Notice */}
        {!isNetworkOnline && (
          <div
            data-testid="offline-status-banner"
            className="w-full p-3 rounded-2xl bg-amber-950/70 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-2.5 text-left shadow-lg"
          >
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-snug">
              <strong>Çevrimdışı Mod:</strong> Bot Antrenmanı internet olmadan sorunsuz çalışır.
              Online 1v1 için internet bağlantısı gerekir.
            </span>
          </div>
        )}

        {/* Online Error Banner */}
        {onlineError && (
          <div
            data-testid="online-error-banner"
            className="w-full p-3 rounded-2xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-center justify-between gap-2 text-left shadow-lg"
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

        {/* 3 Primary Game Mode Cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {/* 1. 1v1 Çevrimiçi Maç (Featured Full-Width CTA) */}
          <button
            type="button"
            data-testid="mode-online-btn"
            onClick={() => setMinigameModalContext('online_match')}
            className="sm:col-span-2 flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-teal-950/75 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 border border-cyan-400/60 hover:border-cyan-300 transition transform active:scale-[0.99] text-left shadow-xl group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition shrink-0">
                <Globe className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-white text-sm sm:text-base">
                    1v1 Çevrimiçi Maç
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-cyan-400 text-slate-950 shrink-0">
                    CANLI · 4 Oyun
                  </span>
                </div>
                <span className="block text-xs text-slate-300 mt-0.5 truncate">
                  {t('lobbyOnlineDesc')}
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-cyan-300 shrink-0" />
          </button>

          {/* 2. Arkadaşla Oda */}
          <button
            type="button"
            data-testid="mode-room-btn"
            onClick={() => setShowRoomModal(true)}
            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 hover:from-purple-950/60 hover:to-slate-900 border border-purple-500/40 hover:border-purple-400 transition transform active:scale-[0.99] text-left shadow-lg group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-black text-white text-sm">
                  Arkadaşla Oda
                </span>
                <span className="block text-xs text-slate-400 truncate">
                  {t('lobbyRoomDesc')}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-purple-400 shrink-0" />
          </button>

          {/* 3. Botla Maç */}
          <button
            type="button"
            data-testid="mode-bot-btn"
            onClick={() => setShowBotModal(true)}
            className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 hover:from-blue-950/60 hover:to-slate-900 border border-blue-500/40 hover:border-blue-400 transition transform active:scale-[0.99] text-left shadow-lg group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block font-black text-white text-sm">
                  Botla Maç
                </span>
                <span className="block text-xs text-slate-400 truncate">
                  Çırak · Şampiyon · Efsane
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />
          </button>
        </div>

        <p
          data-testid="lobby-copyright-notice"
          className="pt-1 px-2 text-[11px] font-medium text-slate-500 text-center leading-relaxed"
        >
          Bağımsız hayran yapımı bilgi yarışmasıdır; hiçbir kulüp, lig veya kuruluşla resmi bağlantısı yoktur.
        </p>
      </main>

      {/* Private Room Modal */}
      {showRoomModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-3xl p-5 sm:p-6 text-center shadow-2xl max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-black text-white flex items-center justify-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-purple-400" />
              <span>Arkadaşla Oda</span>
            </h3>

            <div className="flex rounded-xl bg-slate-950 p-1 mb-4 border border-slate-800">
              <button
                onClick={() => setRoomAction('create')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  roomAction === 'create'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Oda Oluştur
              </button>
              <button
                onClick={() => setRoomAction('join')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
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
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        roomMinigame === mg.id
                          ? 'bg-purple-500/20 border-purple-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{mg.title}</span>
                      <span className="text-[10px] text-purple-300">{mg.badgeText}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowRoomModal(false);
                    onSelectMode('online_room', { minigameType: roomMinigame });
                  }}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm transition active:scale-95 cursor-pointer"
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
                  className="w-full bg-slate-950 text-white font-mono font-black text-center text-lg tracking-widest px-3 py-3 rounded-xl border border-slate-700 focus:border-purple-400 mb-3 outline-none uppercase"
                />
                <button
                  disabled={!inputCode.trim()}
                  onClick={() => {
                    setShowRoomModal(false);
                    onSelectMode('online_room', { roomCode: inputCode.trim() });
                  }}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-sm transition active:scale-95 cursor-pointer"
                >
                  Odaya Katıl
                </button>
              </div>
            )}

            <button
              onClick={() => setShowRoomModal(false)}
              className="mt-3 text-xs text-slate-400 hover:text-white font-semibold cursor-pointer"
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
