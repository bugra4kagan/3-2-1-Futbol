import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Film, HeartPulse, Zap } from 'lucide-react';
import { showRewardedAd } from '../services/adService';

interface LastChanceModalProps {
  isOpen: boolean;
  isVip?: boolean;
  onReviveSuccess: () => void;
  onGiveUp: () => void;
}

export const LastChanceModal: React.FC<LastChanceModalProps> = ({
  isOpen,
  isVip = false,
  onReviveSuccess,
  onGiveUp,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [adLoading, setAdLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(4);
      setAdLoading(false);
      return;
    }
    if (adLoading) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onGiveUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, adLoading, onGiveUp]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleContinueWithAdOrVip = async () => {
    if (adLoading) return;
    if (isVip) {
      onReviveSuccess();
      return;
    }
    setAdLoading(true);
    try {
      const res = await showRewardedAd('last_chance_revive', { adFreeBypass: false });
      if (res.completed) {
        onReviveSuccess();
      } else {
        onGiveUp();
      }
    } finally {
      setAdLoading(false);
    }
  };

  return createPortal(
    <div
      data-testid="last-chance-modal"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/92 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-rose-950/50 to-slate-950 border-2 border-amber-400/75 rounded-3xl p-6 text-center shadow-[0_0_40px_rgba(245,158,11,0.3)]">
        {/* Dramatic 4-second countdown ring badge */}
        <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-gradient-to-tr from-rose-600 to-amber-400 p-0.5 flex items-center justify-center shadow-lg">
          <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-amber-300 font-mono leading-none">
              {adLoading ? '🎬' : secondsLeft}
            </span>
            {!adLoading && (
              <span className="text-[9px] font-black text-slate-400 uppercase">SN</span>
            )}
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
          <Zap className="w-3.5 h-3.5" />
          <span>⚡ SON ŞANS!</span>
        </div>

        <h3 className="text-xl font-black text-white">
          Maçı Çevirebilirsin!
        </h3>
        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
          Yenilgi eşiğindesin! +15 Saniye ve +1 Can ile oyuna anında geri dönüp zafere uzan.
        </p>

        <div className="mt-5 space-y-2.5">
          {isVip ? (
            <button
              type="button"
              data-testid="last-chance-vip-revive-btn"
              onClick={handleContinueWithAdOrVip}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95"
            >
              <Crown className="w-4 h-4 shrink-0" />
              <span>👑 VIP Ücretsiz +15 Saniye / 1 Can ile Devam Et</span>
            </button>
          ) : (
            <button
              type="button"
              data-testid="last-chance-ad-revive-btn"
              disabled={adLoading}
              onClick={handleContinueWithAdOrVip}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-60 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95"
            >
              {adLoading ? (
                <span>🎬 Ödüllü Reklam Oynatılıyor...</span>
              ) : (
                <>
                  <Film className="w-4 h-4 shrink-0" />
                  <span>🎬 Reklam İzle &amp; +15 Saniye / 1 Can ile Devam Et</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            data-testid="last-chance-giveup-btn"
            disabled={adLoading}
            onClick={onGiveUp}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>Vazgeç</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
