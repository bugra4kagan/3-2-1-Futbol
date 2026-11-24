import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Film, Flame, ShieldAlert, X } from 'lucide-react';
import { CoinIcon } from './CoinIcon';
import { STREAK_SAVER_COIN_COST } from '../game/v3DailyQuestsEngine';
import { showRewardedAd } from '../services/adService';

interface StreakSaverModalProps {
  isOpen: boolean;
  streakDays: number;
  userCoins: number;
  adFree?: boolean;
  onSaveWithAd: () => void;
  onSaveWithCoins: () => void;
  onDismiss: () => void;
}

export const StreakSaverModal: React.FC<StreakSaverModalProps> = ({
  isOpen,
  streakDays,
  userCoins,
  adFree = false,
  onSaveWithAd,
  onSaveWithCoins,
  onDismiss,
}) => {
  const [adLoading, setAdLoading] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const canAfford = userCoins >= STREAK_SAVER_COIN_COST;

  const handleSaveAd = async () => {
    if (adLoading) return;
    setAdLoading(true);
    try {
      const res = await showRewardedAd('streak_saver', { adFreeBypass: adFree });
      if (res.completed) {
        onSaveWithAd();
      }
    } finally {
      setAdLoading(false);
    }
  };

  return createPortal(
    <div
      data-testid="streak-saver-modal"
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/90 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-orange-950/30 to-slate-950 border border-orange-400/60 rounded-3xl p-6 text-center shadow-2xl">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 min-w-[34px] min-h-[34px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-300 flex items-center justify-center shadow-lg shadow-orange-500/30 border-2 border-amber-200">
          <Flame className="w-8 h-8 text-slate-950 animate-pulse" />
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-200 text-[10px] font-black uppercase tracking-wider mb-1.5">
          <ShieldAlert className="w-3 h-3" /> Seri Tehlikede!
        </span>

        <h3 className="text-xl font-black text-white">
          🔥 {streakDays} Günlük Serini Kurtar!
        </h3>
        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
          Dün oyuna giriş yapmadığın için serin 1. güne sıfırlanmak üzere. Hemen kurtararak günlük ödül serini devam ettir!
        </p>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            data-testid="streak-saver-ad-btn"
            disabled={adLoading}
            onClick={handleSaveAd}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-60 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95"
          >
            <Film className="w-4 h-4 shrink-0" />
            <span>
              {adLoading ? 'Reklam Oynatılıyor...' : '🎬 Reklam İzle ve Serini Kurtar'}
            </span>
          </button>

          <button
            type="button"
            data-testid="streak-saver-coins-btn"
            disabled={!canAfford || adLoading}
            onClick={onSaveWithCoins}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition active:scale-95"
          >
            <CoinIcon size="sm" />
            <span>{STREAK_SAVER_COIN_COST} Coin ile Serini Koru</span>
          </button>

          <button
            type="button"
            data-testid="streak-saver-dismiss-btn"
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs font-bold cursor-pointer transition"
          >
            Vazgeç (Seri 1&apos;e Sıfırlansın)
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
