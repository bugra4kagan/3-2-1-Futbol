import React from 'react';
import confetti from 'canvas-confetti';
import { Flame, Gift, CheckCircle2, X, Coins, Sparkles } from 'lucide-react';
import { UserProgression } from '../game/types';
import {
  canClaimDailyReward,
  DAILY_REWARD_SCHEDULE,
  getActiveDailyRewardTier,
} from '../game/retentionEngine';
import { soundManager } from '../utils/soundManager';

interface DailyRewardsModalProps {
  isOpen: boolean;
  progression: UserProgression;
  onClaim: () => void;
  onClose: () => void;
  onOpenWheel?: () => void;
  hasFreeWheelSpin?: boolean;
}

export const DailyRewardsModal: React.FC<DailyRewardsModalProps> = ({
  isOpen,
  progression,
  onClaim,
  onClose,
  onOpenWheel,
  hasFreeWheelSpin = false,
}) => {
  if (!isOpen) return null;

  const claimable = canClaimDailyReward(progression);
  const activeTier = getActiveDailyRewardTier(progression);
  const completedCount = claimable
    ? progression.dailyLogin.streakDays % 7
    : ((progression.dailyLogin.streakDays - 1) % 7) + 1;

  const handleClaim = () => {
    if (!claimable) return;
    soundManager.playVictoryFanfare();
    try {
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#10b981', '#ffffff'],
      });
    } catch {
      // ignore
    }
    onClaim();
  };

  return (
    <div
      data-testid="daily-rewards-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/88 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/90 border border-amber-400/50 rounded-3xl p-5 sm:p-6 shadow-2xl text-center max-h-[92dvh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/30 border-2 border-amber-200">
          <Gift className="w-8 h-8 text-amber-950" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-wider mb-1.5">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span>{progression.dailyLogin.streakDays} GÜNLÜK SERİ</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-white">
          Günlük Giriş Ödülü
        </h3>
        <p className="text-xs text-slate-300 mt-1">
          Her gün oyuna gir, seriyi bozma ve büyük coin + lig puanı ödüllerini topla!
        </p>

        {/* 7-Day Calendar Grid */}
        <div className="grid grid-cols-4 gap-2 my-4">
          {DAILY_REWARD_SCHEDULE.map((tier) => {
            const isClaimedDay =
              tier.day < activeTier.day || (!claimable && tier.day === activeTier.day);
            const isTodayTarget = claimable && tier.day === activeTier.day;
            const isDay7 = tier.day === 7;

            return (
              <div
                key={tier.day}
                className={`p-2 rounded-2xl border flex flex-col items-center justify-center text-center relative transition ${
                  isDay7 ? 'col-span-2' : ''
                } ${
                  isTodayTarget
                    ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                    : isClaimedDay
                    ? 'bg-emerald-950/60 border-emerald-500/50 opacity-85'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <span className="text-[10px] font-black uppercase text-slate-400">
                  {tier.day}. Gün
                </span>
                <div className="my-1 flex items-center justify-center gap-1 text-amber-300 font-black text-xs leading-tight">
                  {tier.rewardItemType === 'extra_time_card' ? (
                    <span className="text-cyan-300">⏱️ +10 Sn Kart</span>
                  ) : tier.rewardItemType === 'league_shield' ? (
                    <span className="text-emerald-300">🛡️ Lig Kalkanı</span>
                  ) : (
                    <>
                      <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{tier.coins}</span>
                    </>
                  )}
                </div>
                {tier.bonusLabel ? (
                  <span className="text-[9px] font-black text-amber-200">{tier.bonusLabel}</span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-400">+{tier.points} Puan</span>
                )}
                {isClaimedDay && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5" />
                )}
                {isTodayTarget && (
                  <span className="mt-0.5 text-[9px] font-black text-amber-950 bg-amber-400 px-1.5 py-0.2 rounded">
                    BUGÜN
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-[11px] text-slate-400 mb-4 font-semibold">
          Haftalık ilerleme: <span className="text-white font-black">{completedCount}/7 Gün</span>
        </div>

        {claimable ? (
          <button
            type="button"
            data-testid="claim-daily-reward-btn"
            onClick={handleClaim}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-amber-500/25 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              Ödülü Al ({activeTier.rewardLabel || `+${activeTier.coins} Coin`})
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition cursor-pointer"
          >
            Bugünkü Ödül Alındı ✓ Oyuna Devam Et
          </button>
        )}

        {onOpenWheel && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenWheel();
            }}
            className="w-full mt-2.5 py-2.5 px-4 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/50 text-fuchsia-200 font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>🎡 Şans Çarkına Geç</span>
            {hasFreeWheelSpin && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                1 ÜCRETSİZ!
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
