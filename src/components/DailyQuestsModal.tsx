import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ClipboardList, Film, Sparkles, X } from 'lucide-react';
import { CoinIcon } from './CoinIcon';
import {
  BIG_CHEST_BASE_COINS,
  V3DailyQuestsState,
  areAllV3DailyQuestsCompleted,
} from '../game/v3DailyQuestsEngine';
import { showRewardedAd } from '../services/adService';
import { isAdsEnabled } from '../game/monetizationFlags';

interface DailyQuestsModalProps {
  isOpen: boolean;
  questsState: V3DailyQuestsState;
  adFree?: boolean;
  onClaimQuest: (questId: string) => void;
  onClaimBigChest: () => void;
  onDoubleBigChest: () => void;
  onClose: () => void;
}

export const DailyQuestsModal: React.FC<DailyQuestsModalProps> = ({
  isOpen,
  questsState,
  adFree = false,
  onClaimQuest,
  onClaimBigChest,
  onDoubleBigChest,
  onClose,
}) => {
  const [adLoading, setAdLoading] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const allCompleted = areAllV3DailyQuestsCompleted(questsState);
  const completedCount = questsState.quests.filter((q) => q.progress >= q.target).length;

  const handleWatchAdToDouble = async () => {
    if (adLoading || questsState.bigChestDoubled) return;
    setAdLoading(true);
    try {
      const res = await showRewardedAd('double_daily_chest', { adFreeBypass: adFree });
      if (res.completed) {
        onDoubleBigChest();
      }
    } finally {
      setAdLoading(false);
    }
  };

  return createPortal(
    <div
      data-testid="v3-daily-quests-modal"
      className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 bg-black/88 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/85 border border-emerald-400/50 rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          aria-label="Günlük görevleri kapat"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <ClipboardList className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white leading-tight">
              📋 Günlük Görevler
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {completedCount}/3 hedef tamamlandı • Her tamamlanan görev +100 Pass XP kazandırır!
            </p>
          </div>
        </div>

        {/* 3 Daily Quests */}
        <div className="space-y-2.5 overflow-y-auto pr-0.5">
          {questsState.quests.map((q) => {
            const isDone = q.progress >= q.target;
            const pct = Math.min(100, Math.round((q.progress / q.target) * 100));

            return (
              <div
                key={q.id}
                data-testid={`v3-quest-item-${q.id}`}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDone && !q.claimed
                    ? 'bg-emerald-500/15 border-emerald-400/70'
                    : q.claimed
                    ? 'bg-slate-900/70 border-emerald-500/30 opacity-85'
                    : 'bg-slate-950/85 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg shrink-0">
                    {q.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-white truncate">
                      {q.title}
                    </span>
                    <span className="block text-xs text-slate-300">{q.description}</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 tabular-nums">
                        {q.progress}/{q.target}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {q.claimed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-black">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Alındı
                    </span>
                  ) : isDone ? (
                    <button
                      type="button"
                      data-testid={`claim-v3-quest-${q.id}`}
                      onClick={() => onClaimQuest(q.id)}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-slate-950 text-xs font-black cursor-pointer transition active:scale-95 inline-flex items-center gap-1"
                    >
                      <CoinIcon size="xs" />
                      <span>+{q.rewardCoins} Al</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 text-[11px] font-black font-mono inline-flex items-center gap-1">
                      <CoinIcon size="xs" />
                      <span>+{q.rewardCoins}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Big Daily Chest */}
        <div
          data-testid="v3-big-daily-chest"
          className={`mt-4 p-4 rounded-2xl border text-center ${
            allCompleted
              ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-emerald-500/20 border-amber-400/75 shadow-lg shadow-amber-500/15'
              : 'bg-slate-950/90 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-sm font-black text-amber-300">
            <Sparkles className="w-4 h-4" />
            <span>🧰 Büyük Günlük Sandık (+{BIG_CHEST_BASE_COINS} Coin)</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1">
            {allCompleted
              ? 'Tüm günlük hedefler tamamlandı! Sandığını hemen açabilirsin.'
              : 'Sandığı açmak için yukarıdaki 3 görevin tamamını bitir.'}
          </p>

          {!questsState.bigChestClaimed ? (
            <button
              type="button"
              data-testid="claim-big-chest-btn"
              disabled={!allCompleted}
              onClick={onClaimBigChest}
              className="mt-3 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <CoinIcon size="sm" />
              <span>Büyük Sandığı Aç (+{BIG_CHEST_BASE_COINS} Coin)</span>
            </button>
          ) : !questsState.bigChestDoubled && isAdsEnabled() ? (
            <button
              type="button"
              data-testid="double-big-chest-ad-btn"
              disabled={adLoading}
              onClick={handleWatchAdToDouble}
              className="mt-3 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-400 hover:from-fuchsia-400 hover:to-amber-300 disabled:opacity-60 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition active:scale-95"
            >
              <Film className="w-4 h-4" />
              <span>
                {adLoading
                  ? 'Reklam Oynatılıyor...'
                  : `🎬 Reklam İzle ve Sandığı 2x Katla (+${BIG_CHEST_BASE_COINS} Coin)`}
              </span>
            </button>
          ) : (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-black">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sandık 2x Katlandı (+{BIG_CHEST_BASE_COINS * 2} Coin Alındı)!</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
