import React, { useState } from 'react';
import { Copy, Check, Users, ArrowLeft, Loader2, Link2, Wifi, Gamepad2 } from 'lucide-react';
import { MinigameType, PlayerProfile } from '../game/types';
import { getMinigameMeta } from '../game/minigameEngine';
import { PlayerAvatar } from './PlayerAvatar';

interface OnlineRoomViewProps {
  roomCode?: string;
  minigameType?: MinigameType;
  isMatchmaking?: boolean;
  player1: PlayerProfile;
  player2: PlayerProfile | null;
  onCancel: () => void;
}

export const OnlineRoomView: React.FC<OnlineRoomViewProps> = ({
  roomCode,
  minigameType = 'two_clubs',
  isMatchmaking = false,
  player1,
  player2,
  onCancel,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const minigameMeta = getMinigameMeta(minigameType);

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
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-slate-950 text-white overflow-x-hidden"
    >
      <div className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Users className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-2">
          <Wifi className="w-3 h-3" />
          <span>CANLI 1v1 SUNUCU BAĞLANTISI</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white">
          {isMatchmaking ? 'Çevrim İçi Eşleşme' : 'Özel Oyun Odası'}
        </h2>
        <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-bold text-amber-300">
          <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
          <span>{minigameMeta.title}</span>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          {isMatchmaking
            ? 'Canlı kuyrukta seninle yarışacak gerçek bir rakip aranıyor...'
            : 'Oda kodunu veya davet linkini arkadaşına gönder, anında 1v1 başlasın!'}
        </p>

        {/* Room Code Display if private room */}
        {roomCode && !isMatchmaking && (
          <div className="my-5 p-4 rounded-2xl bg-slate-950 border border-purple-500/40">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              ODA KODU
            </span>
            <div className="flex items-center justify-center gap-3">
              <span
                data-testid="room-code-text"
                className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-purple-400"
              >
                {roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="min-w-[40px] min-h-[40px] p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition active:scale-95 flex items-center justify-center"
                title="Kodu Kopyala"
                aria-label="Kodu Kopyala"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={handleCopyInviteLink}
              className="mt-3 w-full min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-purple-500/30 text-xs font-bold text-purple-300 flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Davet Linki Kopyalandı!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Davet Linkini Kopyala</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Players Slot Cards */}
        <div className="my-5 space-y-3">
          {/* Host / Player 1 */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-emerald-500/40 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <PlayerAvatar avatar={player1.avatar} name={player1.name} size="sm" className="bg-slate-900 border border-slate-700" />
              <div className="min-w-0">
                <span className="font-bold text-white text-sm block truncate">{player1.name}</span>
                <span className="text-[10px] text-emerald-400 font-semibold">Sen (Hazır)</span>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          </div>

          {/* Opponent / Player 2 */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-left">
            {player2 ? (
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar avatar={player2.avatar} name={player2.name} size="sm" className="bg-slate-900 border border-slate-700" />
                <div className="min-w-0">
                  <span className="font-bold text-white text-sm block truncate">{player2.name}</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Katıldı! Maç başlıyor...</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-1">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                <span className="text-xs font-semibold text-slate-400">
                  {isMatchmaking ? 'Rakip aranıyor...' : '2. Oyuncu bekleniyor...'}
                </span>
              </div>
            )}
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                player2 ? 'bg-emerald-500' : 'bg-amber-400 animate-ping'
              }`}
            />
          </div>
        </div>

        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-2 mx-auto min-h-[40px] px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition active:scale-95 border border-slate-700 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>İptal Et ve Geri Dön</span>
        </button>
      </div>
    </div>
  );
};
