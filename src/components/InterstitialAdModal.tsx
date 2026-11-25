import React, { useEffect, useState } from 'react';
import { Film, ShieldCheck, X } from 'lucide-react';

interface InterstitialAdModalProps {
  isOpen: boolean;
  adUnitId?: string;
  onDismiss: () => void;
}

export const InterstitialAdModal: React.FC<InterstitialAdModalProps> = ({
  isOpen,
  adUnitId,
  onDismiss,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(3);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  if (!isOpen) return null;

  const canClose = secondsLeft <= 0;

  return (
    <div
      data-testid="interstitial-ad-modal"
      data-ad-unit-id={adUnitId}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#0B1220]/95 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-[#16212E] border border-[#3B82F6]/35 p-5 text-center shadow-2xl">
        <button
          type="button"
          data-testid="interstitial-ad-close-btn"
          disabled={!canClose}
          onClick={onDismiss}
          className="absolute top-3 right-3 px-2.5 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-xs font-black flex items-center gap-1 cursor-pointer"
          aria-label="Reklamı Kapat"
        >
          {canClose ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>Kapat</span>
            </>
          ) : (
            <span>{secondsLeft}s</span>
          )}
        </button>

        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Film className="w-7 h-7" />
        </div>

        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          SPONSORLU GEÇİŞ REKLAMI
        </span>
        <h3 className="text-lg font-black text-white mt-1">
          Maç Özeti Hazırlanıyor...
        </h3>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          VIP Reklamsız paketiyle tüm geçiş ve alt banner reklamlarını kalıcı olarak kaldırabilirsin.
        </p>

        <div className="my-4">
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all duration-1000"
              style={{ width: `${Math.round(((3 - secondsLeft) / 3) * 100)}%` }}
            />
          </div>
          <span className="block text-[11px] font-mono font-bold text-slate-400 mt-1.5">
            {canClose ? 'Maç özetine geçebilirsin' : `Kapatılabilir: ${secondsLeft} sn`}
          </span>
        </div>

        <button
          type="button"
          data-testid="interstitial-ad-continue-btn"
          disabled={!canClose}
          onClick={onDismiss}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{canClose ? 'Maç Özetine Geç' : `Bekleniyor (${secondsLeft}s)...`}</span>
        </button>
      </div>
    </div>
  );
};
