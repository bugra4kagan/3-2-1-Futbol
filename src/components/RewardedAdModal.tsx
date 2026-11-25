import React, { useEffect, useState } from 'react';
import { Film, ShieldCheck, Sparkles, X } from 'lucide-react';
import { AdRewardPurpose, getAdUnitIdForPlatform } from '../services/adService';

interface RewardedAdModalProps {
  isOpen: boolean;
  adFree?: boolean;
  rewardLabel: string;
  adPurpose?: AdRewardPurpose;
  badgeText?: string;
  title?: string;
  ctaLabel?: string;
  onComplete: () => void;
  onClose: () => void;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  isOpen,
  adFree = false,
  rewardLabel,
  adPurpose = 'double_match_reward',
  badgeText,
  title,
  ctaLabel,
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
  const resolvedBadge = badgeText ?? (adFree ? 'VIP REKLAMSIZ AVANTAJI' : 'ÖDÜLLÜ REKLAM');
  const resolvedTitle =
    title ??
    (adFree
      ? 'Reklamsız Anında Ödül!'
      : ready
      ? 'Reklam Tamamlandı!'
      : 'Sponsorlu Reklam Oynatılıyor...');
  const resolvedCta = ctaLabel ?? '2x Ödülü Hesaba Ekle!';
  const adUnitId = getAdUnitIdForPlatform(adPurpose);

  return (
    <div
      data-testid="rewarded-ad-modal"
      data-ad-unit-id={adUnitId}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#092316]/88 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-[#124029] border-2 border-[#E5B94F]/60 p-5 text-center shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-[#A8B3C2]/25 text-[#A8B3C2] hover:text-[#FFFFFF] flex items-center justify-center cursor-pointer"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-[#E5B94F]/15 border border-[#E5B94F]/60 text-[#E5B94F] flex items-center justify-center mx-auto mb-3 shadow-lg">
          {adFree ? <ShieldCheck className="w-7 h-7" /> : <Film className="w-7 h-7" />}
        </div>

        <span className="text-[10px] font-black uppercase tracking-widest text-[#E5B94F]">
          {resolvedBadge}
        </span>
        <h3 className="font-display font-extrabold text-2xl text-[#FFFFFF] mt-1 uppercase">{resolvedTitle}</h3>
        <p className="text-xs text-[#A8B3C2] mt-1">
          Ekstra Kazanç: <strong className="text-[#22C55E]">{rewardLabel}</strong>
        </p>

        {!adFree && (
          <div className="my-4">
            <div className="w-full h-2.5 rounded-full bg-[#0B1220] overflow-hidden border border-[#A8B3C2]/25">
              <div
                className="h-full bg-[#22C55E] transition-all duration-1000"
                style={{ width: `${Math.round(((3 - secondsLeft) / 3) * 100)}%` }}
              />
            </div>
            <span className="block text-[11px] font-score font-bold text-[#A8B3C2] mt-1.5">
              {ready ? 'Ödülün hazır!' : `Kalan süre: ${secondsLeft} sn`}
            </span>
          </div>
        )}

        <button
          type="button"
          data-testid="rewarded-ad-claim-btn"
          disabled={!ready}
          onClick={onComplete}
          className="mt-3 w-full py-3 rounded-xl bg-[#E5B94F] hover:bg-[#f0ca6b] disabled:opacity-45 disabled:cursor-not-allowed text-[#0B1220] font-black text-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg"
        >
          <Sparkles className="w-4 h-4" />
          <span>{ready ? resolvedCta : `Bekleniyor (${secondsLeft}s)...`}</span>
        </button>
      </div>
    </div>
  );
};
