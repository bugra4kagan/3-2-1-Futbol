import React, { useState } from 'react';
import {
  Copy,
  Check,
  Users,
  ArrowLeft,
  Loader2,
  Link2,
  Wifi,
  Gamepad2,
  UserSearch,
  Bot,
  RefreshCw,
  Home,
} from 'lucide-react';
import { MinigameType, PlayerProfile } from '../game/types';
import { getMinigameMeta } from '../game/minigameEngine';
import { sanitizePublicDisplayName } from '../game/usernameFilter';
import { PlayerAvatar } from './PlayerAvatar';

interface OnlineRoomViewProps {
  roomCode?: string;
  minigameType?: MinigameType;
  isMatchmaking?: boolean;
  matchmakingSecondsLeft?: number;
  noOpponentFound?: boolean;
  player1: PlayerProfile;
  player2: PlayerProfile | null;
  onInspectPlayer?: (player: PlayerProfile) => void;
  onRetryMatchmaking?: () => void;
  onPlayBotInstead?: () => void;
  onCancel: () => void;
}

export const OnlineRoomView: React.FC<OnlineRoomViewProps> = ({
  roomCode,
  minigameType = 'two_clubs',
  isMatchmaking = false,
  matchmakingSecondsLeft = 12,
  noOpponentFound = false,
  player1,
  player2,
  onInspectPlayer,
  onRetryMatchmaking,
  onPlayBotInstead,
  onCancel,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const minigameMeta = getMinigameMeta(minigameType);
  const p1Name = sanitizePublicDisplayName(player1.name, player1.id);
  const p2Name = player2 ? sanitizePublicDisplayName(player2.name, player2.id) : null;

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard?.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyInviteLink = () => {
    if (roomCode && typeof window !== 'undefined') {
      const inviteUrl = `${window.location.origin}/?room=${roomCode}`;
      navigator.clipboard?.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div
      data-testid="online-room-view"
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-[#080E14] text-[#F8FAFC] overflow-x-hidden"
    >
      <div className="w-full max-w-md bg-[#101B24] border border-white/10 rounded-3xl p-5 sm:p-7 text-center">
        <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-[#123D2B] border border-[#22C55E]/35 flex items-center justify-center text-[#22C55E]">
          <Users className="w-7 h-7" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#14232C] border border-[#22C55E]/35 text-[#22C55E] text-[10px] font-black uppercase tracking-wider mb-2">
          <Wifi className="w-3 h-3" />
          <span>CANLI 1v1 ARENA</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-[#F8FAFC]">
          {noOpponentFound
            ? 'RAKİP BULUNAMADI'
            : isMatchmaking
            ? '1v1 Çevrimiçi Maç'
            : 'Arkadaşla Özel Oda'}
        </h2>
        <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#14232C] border border-white/10 text-xs font-bold text-[#FBBF24]">
          <Gamepad2 className="w-3.5 h-3.5 text-[#22C55E]" />
          <span>{minigameMeta.title}</span>
        </div>

        <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">
          {noOpponentFound
            ? 'Şu anda çevrimiçi rakip bulunamadı. Rekabetçi bir botla oynayabilir veya tekrar rakip arayabilirsin.'
            : isMatchmaking
            ? 'Gerçek rakipler eşleşme kuyruğunda aranıyor...'
            : 'Oda kodunu arkadaşına gönder. İkinci oyuncu katılıp hazır olduğunda maç otomatik başlar.'}
        </p>

        {/* Room is being created on Firestore — code not assigned yet */}
        {!roomCode && !isMatchmaking && (
          <div
            data-testid="room-code-loading"
            className="my-5 p-4 rounded-2xl bg-[#14232C] border border-white/10 flex items-center justify-center gap-2 text-xs font-bold text-[#94A3B8]"
          >
            <Loader2 className="w-4 h-4 animate-spin text-[#22C55E]" />
            <span>Oda oluşturuluyor...</span>
          </div>
        )}

        {/* Room Code Display for Private Room */}
        {roomCode && !isMatchmaking && (
          <div className="my-5 p-4 rounded-2xl bg-[#14232C] border border-[#22C55E]/30">
            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest block mb-1">
              ODA KODU
            </span>
            <div className="flex items-center justify-center gap-3">
              <span
                data-testid="room-code-text"
                className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-[#22C55E]"
              >
                {roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="min-w-[40px] min-h-[40px] p-2.5 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] text-[#080E14] transition active:scale-95 flex items-center justify-center cursor-pointer"
                title="Kodu Kopyala"
                aria-label="Kodu Kopyala"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={handleCopyInviteLink}
              className="mt-3 w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#101B24] hover:bg-[#080E14] border border-white/10 text-xs font-bold text-[#F8FAFC] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span className="text-[#22C55E]">Davet Linki Kopyalandı!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>Davet Linkini Kopyala</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Matchmaking No Opponent Found View (3 explicit options, zero auto bot fallback) */}
        {noOpponentFound ? (
          <div data-testid="no-opponent-panel" className="my-5 space-y-2.5">
            {onPlayBotInstead && (
              <button
                type="button"
                data-testid="online-switch-bot-btn"
                onClick={onPlayBotInstead}
                className="w-full py-3 px-4 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] text-[#080E14] font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>Rekabetçi Botla Oyna</span>
              </button>
            )}

            {onRetryMatchmaking && (
              <button
                type="button"
                data-testid="online-retry-matchmaking-btn"
                onClick={onRetryMatchmaking}
                className="w-full py-3 px-4 rounded-xl bg-[#14232C] hover:bg-[#123D2B] border border-[#22C55E]/40 text-[#F8FAFC] font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#22C55E]" />
                <span>Tekrar Ara</span>
              </button>
            )}

            <button
              type="button"
              data-testid="online-back-lobby-btn"
              onClick={onCancel}
              className="w-full py-3 px-4 rounded-xl bg-[#080E14] hover:bg-[#14232C] border border-white/10 text-[#94A3B8] hover:text-[#F8FAFC] font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Ana Menüye Dön</span>
            </button>
          </div>
        ) : (
          <>
            {/* Players Slot Cards */}
            <div className="my-5 space-y-2.5">
              {/* Host / Player 1 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#14232C] border border-[#22C55E]/35 text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar avatar="⚽" name={p1Name} size="sm" />
                  <div className="min-w-0">
                    <span className="font-bold text-[#F8FAFC] text-sm block truncate">
                      {p1Name}
                    </span>
                    <span className="text-[10px] text-[#22C55E] font-semibold">
                      Sen · Hazır ✓
                    </span>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shrink-0" />
              </div>

              {/* Opponent / Player 2 */}
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#14232C] border border-white/10 text-left">
                {player2 && p2Name ? (
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <PlayerAvatar avatar="⚽" name={p2Name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-[#F8FAFC] text-sm block truncate">
                        {p2Name}
                      </span>
                      <span className="text-[10px] text-[#22C55E] font-semibold">
                        Hazır ✓ · Maç başlıyor...
                      </span>
                    </div>
                    {onInspectPlayer && (
                      <button
                        type="button"
                        data-testid="online-room-inspect-p2"
                        onClick={() => onInspectPlayer(player2)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#123D2B] hover:bg-[#123D2B]/80 border border-[#22C55E]/40 text-[#22C55E] font-black text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <UserSearch className="w-3 h-3" />
                        <span>İncele</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 w-full py-1">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-[#FBBF24] animate-spin shrink-0" />
                      <span className="text-xs font-semibold text-[#94A3B8]">
                        {isMatchmaking ? 'Rakip aranıyor...' : 'İkinci oyuncu bekleniyor...'}
                      </span>
                    </div>
                    {isMatchmaking && (
                      <span
                        data-testid="matchmaking-countdown"
                        className="font-mono text-xs font-black text-[#FBBF24] px-2 py-0.5 rounded bg-[#080E14] border border-white/10 tabular-nums shrink-0"
                      >
                        {Math.max(0, matchmakingSecondsLeft)}s
                      </span>
                    )}
                  </div>
                )}
                {!isMatchmaking && !player2 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24] animate-ping shrink-0" />
                )}
              </div>
            </div>

            <button
              onClick={onCancel}
              className="flex items-center justify-center gap-2 mx-auto min-h-[40px] px-6 py-2.5 rounded-xl bg-[#14232C] hover:bg-[#080E14] text-[#94A3B8] hover:text-[#F8FAFC] font-bold text-xs transition active:scale-95 border border-white/10 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isMatchmaking ? 'Aramayı İptal Et' : 'Odayı Kapat ve Dön'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
