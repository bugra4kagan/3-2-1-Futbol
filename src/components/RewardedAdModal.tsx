import React, { useEffect, useState } from 'react';
import { Film, ShieldCheck, Sparkles, X } from 'lucide-react';

interface RewardedAdModalProps {
  isOpen: boolean;
  adFree?: boolean;
  rewardLabel: string;
  onComplete: () => void;
  onClose: () => void;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  adFree = false,
  rewardLabel,
  onComplete,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(3);

  useEffect(() => {
    if (!isOpen) return;
    if (adFree) {
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(3);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, adFree]);

  if (!isOpen) return null;

  const ready = secondsLeft <= 0;

  return (
    <div
      data-testid="rewarded-ad-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-400/50 p-5 text-center shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-300 flex items-center justify-center mx-auto mb-3 shadow-lg">
          {adFree ? <ShieldCheck className="w-7 h-7" /> : <Film className="w-7 h-7" />}
        </div>

        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
          {adFree ? 'VIP REKLAMSIZ AVANTAJI' : 'ÖDÜLLÜ REKLAM'}
        </span>
        <h3 className="text-lg font-black text-white mt-1">
          {adFree ? 'Reklamsız 2x Katlayıcı!' : ready ? 'Reklam Tamamlandı!' : 'Sponsorlu Reklam Oynatılıyor...'}
        </h3>
        <p className="text-xs text-slate-300 mt-1">
          Ekstra Kazanç: <strong className="text-emerald-400">{rewardLabel}</strong>
        </p>

        {!adFree && (
          <div className="my-4">
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-1000"
                style={{ width: `${Math.round(((3 - secondsLeft) / 3) * 100)}%` }}
              />
            </div>
            <span className="block text-[11px] font-mono font-bold text-slate-400 mt-1.5">
              {ready ? 'Ödülün hazır!' : `Kalan süre: ${secondsLeft} sn`}
            </span>
          </div>
        )}

        <button
          type="button"
          data-testid="rewarded-ad-claim-btn"
          disabled={!ready}
          onClick={onComplete}
          className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg"
        >
          <Sparkles className="w-4 h-4" />
          <span>{ready ? '2x Ödülü Hesaba Ekle!' : `Bekleniyor (${secondsLeft}s)...`}</span>
        </button>
      </div>
    </div>
  );
};
