import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Film, ShoppingBag, Sparkles, X, Zap } from 'lucide-react';
import {
  ENERGY_AD_REWARD_AMOUNT,
  ENERGY_DRINK_REFILL_AMOUNT,
  MAX_DAILY_ENERGY,
} from '../game/retentionEngine';
import {
  SIMULATED_AD_DURATION_MS,
  getAdUnitIdForPlatform,
  showRewardedAd,
} from '../services/adService';
import { isAdsEnabled } from '../game/monetizationFlags';
import { sounds } from '../utils/audio';

interface EnergyEmptyModalProps {
  isOpen: boolean;
  currentEnergy: number;
  energyDrinks: number;
  isVipUnlimited: boolean;
  onClose: () => void;
  onGrantAdEnergy: () => void;
  onUseEnergyDrink: () => { ok: boolean; reason?: string };
  onGoToStore: () => void;
}

export const EnergyEmptyModal: React.FC<EnergyEmptyModalProps> = ({
  isOpen,
  currentEnergy,
  energyDrinks,
  isVipUnlimited,
  onClose,
  onGrantAdEnergy,
  onUseEnergyDrink,
  onGoToStore,
}) => {
  const [adPlaying, setAdPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const mountedRef = useRef(true);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setAdPlaying(false);
      setSecondsLeft(3);
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isEmpty = !isVipUnlimited && currentEnergy <= 0;
  const isFull = isVipUnlimited || currentEnergy >= MAX_DAILY_ENERGY;
  const adUnitId = getAdUnitIdForPlatform('energy_refill_2');

  const handleWatchRewardedAd = async () => {
    if (adPlaying || isFull) return;
    setStatusMessage(null);
    setAdPlaying(true);
    setSecondsLeft(3);

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    try {
      const result = await showRewardedAd('energy_refill_2', {
        durationMs: SIMULATED_AD_DURATION_MS,
      });
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (!mountedRef.current) return;
      setAdPlaying(false);
      setSecondsLeft(0);
      if (result.completed) {
        onGrantAdEnergy();
        sounds.playVictory();
        setStatusMessage({
          type: 'ok',
          text: `+${ENERGY_AD_REWARD_AMOUNT} Enerji hesabına eklendi! Maça hazırsın ⚡`,
        });
      } else {
        setStatusMessage({
          type: 'err',
          text: 'Ödül için reklamın sonuna kadar izlenmesi gerekir.',
        });
      }
    } catch {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (!mountedRef.current) return;
      setAdPlaying(false);
      setStatusMessage({
        type: 'err',
        text: 'Reklam yüklenemedi, lütfen tekrar dene.',
      });
    }
  };

  const handleDrinkOrStore = () => {
    if (adPlaying) return;
    if (energyDrinks > 0 && !isFull) {
      const res = onUseEnergyDrink();
      if (res.ok) {
        sounds.playCorrect();
        setStatusMessage({
          type: 'ok',
          text: `Enerji İçeceği kullanıldı! +${ENERGY_DRINK_REFILL_AMOUNT} Enerji eklendi 🥤`,
        });
      } else {
        setStatusMessage({
          type: 'err',
          text: res.reason || 'Enerji içeceği kullanılamadı.',
        });
      }
      return;
    }
    onClose();
    onGoToStore();
  };

  return createPortal(
    <div
      data-testid="energy-empty-modal"
      data-ad-unit-id={adUnitId}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/94 animate-in fade-in duration-150"
      onClick={() => {
        if (!adPlaying) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-900 via-[#0d162c] to-slate-950 border-2 border-cyan-400/60 p-5 sm:p-6 text-center shadow-[0_0_45px_rgba(34,211,238,0.28)] animate-card-pop"
      >
        <button
          type="button"
          disabled={adPlaying}
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 flex items-center justify-center cursor-pointer"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center border shadow-lg ${
            isEmpty
              ? 'bg-rose-500/20 border-rose-400/60 text-rose-300 shadow-rose-500/20'
              : 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 shadow-cyan-500/20'
          }`}
        >
          <Zap className="w-7 h-7 fill-current" />
        </div>

        <h2
          data-testid="energy-modal-title"
          className="text-xl font-black text-white tracking-tight"
        >
          {isEmpty ? 'Enerjin Bitti!' : isVipUnlimited ? 'VIP Sınırsız Enerji' : 'Günlük Enerji'}
        </h2>

        <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
          {isVipUnlimited
            ? 'VIP paket sahibi olduğun için enerjin sınırsız (⚡ ∞). İstediğin kadar maç oyna!'
            : isEmpty
            ? 'Yeni maça başlamak için en az 1 Enerji gerekiyor. Reklam izleyerek veya enerji içeceği ile hemen devam et!'
            : 'Maça girişte 1 Enerji kullanılır; maçı kazanırsan veya berabere kalırsan +1 Enerji anında iade edilir!'}
        </p>

        {/* Visual 5-slot Energy Meter */}
        <div className="mt-4 p-3 rounded-2xl bg-slate-950/90 border border-slate-800">
          <div className="flex items-center justify-between text-xs font-black mb-2">
            <span className="text-slate-400 uppercase tracking-wider text-[10px]">
              Mevcut Enerji
            </span>
            <span
              data-testid="energy-modal-counter"
              className={`font-mono ${
                isVipUnlimited
                  ? 'text-amber-300'
                  : isEmpty
                  ? 'text-rose-400'
                  : 'text-cyan-300'
              }`}
            >
              {isVipUnlimited ? '⚡ ∞' : `⚡ ${currentEnergy}/${MAX_DAILY_ENERGY} Enerji`}
            </span>
          </div>

          {!isVipUnlimited && (
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: MAX_DAILY_ENERGY }).map((_, idx) => {
                const active = idx < currentEnergy;
                return (
                  <div
                    key={idx}
                    className={`h-2.5 rounded-full transition-all ${
                      active
                        ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_8px_rgba(34,211,238,0.75)]'
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Simulated 3s Rewarded Ad Progress Bar */}
        {adPlaying && (
          <div
            data-testid="energy-ad-countdown"
            className="mt-3 p-3 rounded-2xl bg-amber-950/40 border border-amber-400/50"
          >
            <div className="flex items-center justify-between text-[11px] font-black text-amber-200 mb-1.5">
              <span className="inline-flex items-center gap-1">
                <Film className="w-3.5 h-3.5 text-amber-400" />
                <span>Ödüllü Reklam Oynatılıyor...</span>
              </span>
              <span className="font-mono">{secondsLeft} sn</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-1000"
                style={{ width: `${Math.round(((3 - secondsLeft) / 3) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {statusMessage && (
          <div
            data-testid="energy-modal-status"
            className={`mt-3 px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in ${
              statusMessage.type === 'ok'
                ? 'bg-emerald-950/85 border-emerald-400/60 text-emerald-200'
                : 'bg-rose-950/85 border-rose-500/60 text-rose-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 space-y-2.5">
          {!isVipUnlimited && isAdsEnabled() && (
            <button
              type="button"
              data-testid="energy-watch-ad-btn"
              disabled={adPlaying || isFull}
              onClick={handleWatchRewardedAd}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition active:scale-95 cursor-pointer"
            >
              <Film className="w-4 h-4 shrink-0" />
              <span>
                {adPlaying
                  ? `Reklam İzleniyor (${secondsLeft}s)...`
                  : isFull
                  ? 'Enerjin Tam (5/5)'
                  : '🎬 Reklam İzle (+2 Enerji Kazan)'}
              </span>
            </button>
          )}

          {!isVipUnlimited && (
            <button
              type="button"
              data-testid="energy-drink-or-store-btn"
              disabled={adPlaying}
              onClick={handleDrinkOrStore}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-45 border border-amber-400/45 text-amber-200 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              {energyDrinks > 0 && !isFull ? (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>⚡ Enerji İçeceği Kullan (+2 Enerji • {energyDrinks} 🥤)</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>⚡ Enerji İçeceği Kullan / Dükkan&apos;a Git</span>
                </>
              )}
            </button>
          )}

          {energyDrinks > 0 && !isFull && !isVipUnlimited && (
            <button
              type="button"
              disabled={adPlaying}
              onClick={() => {
                onClose();
                onGoToStore();
              }}
              className="w-full py-1.5 text-[11px] font-bold text-slate-400 hover:text-cyan-300 cursor-pointer"
            >
              Dükkan&apos;a Git (VIP veya Paket İncele) →
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
