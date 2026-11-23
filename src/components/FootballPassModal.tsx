import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Coins, Crown, Lock, Sparkles, Ticket, X } from 'lucide-react';
import {
  FOOTBALL_PASS_TIERS,
  FootballPassState,
  PASS_MAX_TIER,
  PASS_XP_PER_TIER,
  PassTrackReward,
  getPassCurrentTier,
  getPassTierProgressPct,
} from '../game/footballPassEngine';

interface FootballPassModalProps {
  isOpen: boolean;
  passState: FootballPassState;
  isVipUnlocked: boolean;
  onClaimReward: (tier: number, track: 'free' | 'vip') => void;
  onUnlockVipPass: () => void;
  onClose: () => void;
}

function getRewardIcon(reward: PassTrackReward): string {
  if (reward.kind === 'coins') return '🪙';
  if (reward.kind === 'extra_time_card') return '⏱️';
  if (reward.kind === 'league_shield') return '🛡️';
  return '🏅';
}

export const FootballPassModal: React.FC<FootballPassModalProps> = ({
  isOpen,
  passState,
  isVipUnlocked,
  onClaimReward,
  onUnlockVipPass,
  onClose,
}) => {
  if (!isOpen || typeof document === 'undefined') return null;

  const currentTier = getPassCurrentTier(passState.xp);
  const tierPct = getPassTierProgressPct(passState.xp);
  const xpIntoTier = passState.xp % PASS_XP_PER_TIER;

  return createPortal(
    <div
      data-testid="football-pass-modal"
      className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 bg-black/88 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/90 border border-amber-400/50 rounded-3xl p-4 sm:p-6 shadow-2xl max-h-[92dvh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          aria-label="Football Pass kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pr-10 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-emerald-400 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
              <Ticket className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white">🎫 Football Pass</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase">
                  Sezon 1
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Maç (+50 XP), Günlük Görev (+100 XP) ve Günlük Meydan Okuma (+150 XP) ile ilerle!
              </p>
            </div>
          </div>

          {!isVipUnlocked ? (
            <button
              type="button"
              data-testid="unlock-vip-pass-btn"
              onClick={onUnlockVipPass}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/25 cursor-pointer transition active:scale-95"
            >
              <Crown className="w-4 h-4" />
              <span>VIP Pass Aç</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/60 text-amber-300 text-xs font-black">
              <Crown className="w-4 h-4" />
              <span>VIP Hat Aktif ✓</span>
            </span>
          )}
        </div>

        {/* XP Progress Banner */}
        <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800 mb-3">
          <div className="flex items-center justify-between text-xs font-black mb-1.5">
            <span className="text-emerald-300">
              Seviye {currentTier} / {PASS_MAX_TIER}
            </span>
            <span className="text-amber-300 font-mono tabular-nums">
              {currentTier >= PASS_MAX_TIER
                ? 'MAKSİMUM SEVİYE'
                : `${xpIntoTier} / ${PASS_XP_PER_TIER} XP (Toplam: ${passState.xp} XP)`}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 transition-all duration-300"
              style={{ width: `${tierPct}%` }}
            />
          </div>
        </div>

        {/* Column Titles */}
        <div className="grid grid-cols-[56px_1fr_1fr] gap-2 px-2 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span className="text-center">Kademe</span>
          <span className="text-center text-emerald-300">Ücretsiz Hat</span>
          <span className="text-center text-amber-300 flex items-center justify-center gap-1">
            <Crown className="w-3 h-3" /> VIP Hat
          </span>
        </div>

        {/* 15 Tiers List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {FOOTBALL_PASS_TIERS.map((tierDef) => {
            const isTierReached = currentTier >= tierDef.tier;
            const freeClaimed = passState.claimedFreeTiers.includes(tierDef.tier);
            const vipClaimed = passState.claimedVipTiers.includes(tierDef.tier);

            return (
              <div
                key={tierDef.tier}
                data-testid={`pass-tier-row-${tierDef.tier}`}
                className={`grid grid-cols-[56px_1fr_1fr] gap-2 items-center p-2 rounded-2xl border ${
                  isTierReached
                    ? 'bg-slate-900/95 border-emerald-500/40'
                    : 'bg-slate-950/75 border-slate-800/80 opacity-85'
                }`}
              >
                {/* Tier Number */}
                <div className="flex flex-col items-center justify-center py-1 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs font-black text-white">{tierDef.tier}</span>
                  <span className="text-[9px] font-mono text-slate-400">{tierDef.requiredXp} XP</span>
                </div>

                {/* Free Track Cell */}
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center text-center gap-1 ${
                    freeClaimed
                      ? 'bg-emerald-950/50 border-emerald-500/40'
                      : isTierReached
                      ? 'bg-emerald-500/15 border-emerald-400/60'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <span className="text-xs font-black text-white leading-tight">
                    {getRewardIcon(tierDef.freeReward)} {tierDef.freeReward.label}
                  </span>
                  {freeClaimed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" /> Alındı
                    </span>
                  ) : isTierReached ? (
                    <button
                      type="button"
                      data-testid={`claim-pass-free-${tierDef.tier}`}
                      onClick={() => onClaimReward(tierDef.tier, 'free')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[10px] font-black cursor-pointer transition active:scale-95"
                    >
                      Ödülü Al
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Kilitli
                    </span>
                  )}
                </div>

                {/* VIP Track Cell */}
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center text-center gap-1 ${
                    vipClaimed
                      ? 'bg-amber-950/50 border-amber-500/40'
                      : isTierReached && isVipUnlocked
                      ? 'bg-gradient-to-b from-amber-500/20 to-yellow-500/10 border-amber-400/70'
                      : 'bg-slate-900/75 border-amber-500/20'
                  }`}
                >
                  <span className="text-xs font-black text-amber-200 leading-tight">
                    {getRewardIcon(tierDef.vipReward)} {tierDef.vipReward.label}
                  </span>
                  {vipClaimed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-300">
                      <CheckCircle2 className="w-3 h-3" /> Alındı
                    </span>
                  ) : !isVipUnlocked ? (
                    <span className="text-[10px] text-amber-400/80 font-bold flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> VIP Özel
                    </span>
                  ) : isTierReached ? (
                    <button
                      type="button"
                      data-testid={`claim-pass-vip-${tierDef.tier}`}
                      onClick={() => onClaimReward(tierDef.tier, 'vip')}
                      className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 text-[10px] font-black cursor-pointer transition active:scale-95 flex items-center gap-1"
                    >
                      <Coins className="w-3 h-3" /> Al
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> {tierDef.requiredXp} XP
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
