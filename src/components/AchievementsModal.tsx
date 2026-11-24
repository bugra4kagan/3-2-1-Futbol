import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Lock, Trophy, X } from 'lucide-react';
import { CoinIcon } from './CoinIcon';
import {
  CAREER_ACHIEVEMENTS,
  CareerAchievementsState,
  getAchievementProgress,
} from '../game/achievementsEngine';

interface AchievementsModalProps {
  isOpen: boolean;
  achievementsState: CareerAchievementsState;
  onClaimReward: (achievementId: string) => void;
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  achievementsState,
  onClaimReward,
  onClose,
}) => {
  if (!isOpen || typeof document === 'undefined') return null;

  const unlockedSet = new Set(achievementsState.unlockedIds);
  const claimedSet = new Set(achievementsState.claimedIds);
  const unlockedCount = achievementsState.unlockedIds.length;

  return createPortal(
    <div
      data-testid="achievements-modal"
      className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 bg-black/88 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/85 border border-amber-400/50 rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          aria-label="Başarımları kapat"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
            <Trophy className="w-6 h-6 text-amber-950" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white leading-tight">
              🏆 Başarımlar
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {unlockedCount}/{CAREER_ACHIEVEMENTS.length} başarım açıldı • Coin ödüllerini topla!
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {CAREER_ACHIEVEMENTS.map((ach) => {
            const isUnlocked = unlockedSet.has(ach.id);
            const isClaimed = claimedSet.has(ach.id);
            const progress = getAchievementProgress(ach, achievementsState);
            const pct = Math.min(100, Math.round((progress / ach.target) * 100));

            return (
              <div
                key={ach.id}
                data-testid={`achievement-card-${ach.id}`}
                className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                  isUnlocked && !isClaimed
                    ? 'bg-amber-500/15 border-amber-400/70 shadow-lg shadow-amber-500/10'
                    : isClaimed
                    ? 'bg-emerald-950/50 border-emerald-500/40 opacity-90'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xl shrink-0 ${
                      isUnlocked
                        ? 'bg-amber-400/20 border-amber-400/50'
                        : 'bg-slate-900 border-slate-700 grayscale opacity-75'
                    }`}
                  >
                    {ach.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm text-white truncate">
                        {ach.title}
                      </span>
                      {!isUnlocked && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">{ach.description}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isUnlocked ? 'bg-emerald-400' : 'bg-cyan-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 tabular-nums shrink-0">
                        {progress}/{ach.target}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {isClaimed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-black">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Alındı
                    </span>
                  ) : isUnlocked ? (
                    <button
                      type="button"
                      data-testid={`claim-achievement-${ach.id}`}
                      onClick={() => onClaimReward(ach.id)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs font-black shadow-md cursor-pointer transition active:scale-95"
                    >
                      <CoinIcon size="xs" />
                      <span>+{ach.rewardCoins}</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300/80 text-[11px] font-black font-mono">
                      <CoinIcon size="xs" />
                      +{ach.rewardCoins}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};
