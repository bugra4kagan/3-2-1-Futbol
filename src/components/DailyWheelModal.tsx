import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Coins,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { UserProgression, WheelSliceDefinition } from '../game/types';
import {
  DAILY_WHEEL_SLICES,
  MAX_WHEEL_AD_SPINS_PER_DAY,
  WHEEL_SLICE_ANGLE_DEG,
  canUseFreeWheelSpin,
  computeWheelTargetRotation,
  formatWheelCooldownBadge,
  getRemainingWheelAdSpins,
  getRemainingWheelCooldownMs,
  pickWeightedWheelSlice,
} from '../game/dailyWheelEngine';
import {
  MAX_DAILY_ENERGY,
  formatPoints,
  getEffectiveDailyEnergy,
  hasUnlimitedEnergy,
} from '../game/retentionEngine';
import { SIMULATED_AD_DURATION_MS, showRewardedAd } from '../services/adService';
import { sounds } from '../utils/audio';
import { haptics } from '../utils/haptics';

interface DailyWheelModalProps {
  isOpen: boolean;
  progression: UserProgression;
  onCommitSpin: (
    slice: WheelSliceDefinition,
    spinKind: 'free' | 'ad'
  ) => { ok: boolean; reason?: string; grantedSummary: string };
  onClose: () => void;
}

type WheelPhase = 'idle' | 'watching_ad' | 'spinning' | 'won';

const WHEEL_CENTER = 180;
const OUTER_RING_RADIUS = 166;
const SLICE_RADIUS = 152;
const ACCENT_ARC_RADIUS = 148;
const SPIN_DURATION_MS = 3550;

function polarToCartesian(cx: number, cy: number, r: number, angleDegFromTop: number) {
  const rad = (angleDegFromTop * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

function buildWedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function buildRimArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export const DailyWheelModal: React.FC<DailyWheelModalProps> = ({
  isOpen,
  progression,
  onCommitSpin,
  onClose,
}) => {
  const [phase, setPhase] = useState<WheelPhase>('idle');
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [wonInfo, setWonInfo] = useState<{
    slice: WheelSliceDefinition;
    summary: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adSecondsLeft, setAdSecondsLeft] = useState<number>(3);
  const [adProgressPct, setAdProgressPct] = useState<number>(0);

  const rotationRef = useRef<number>(0);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      if (adIntervalRef.current) clearInterval(adIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
        spinTimerRef.current = null;
      }
      if (adIntervalRef.current) {
        clearInterval(adIntervalRef.current);
        adIntervalRef.current = null;
      }
      setPhase('idle');
      setErrorMsg(null);
      setWonInfo(null);
      setAdProgressPct(0);
      setAdSecondsLeft(3);
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const freeSpinAvailable = canUseFreeWheelSpin(progression);
  const remainingAdSpins = getRemainingWheelAdSpins(progression);
  const isVipUnlimited = hasUnlimitedEnergy(progression);
  const currentEnergy = getEffectiveDailyEnergy(progression);
  const freeJokerTickets = progression.freeJokerTickets ?? 0;

  const startSpin = (spinKind: 'free' | 'ad') => {
    const selectedSlice = pickWeightedWheelSlice();
    const jitter = 0.25 + Math.random() * 0.5;
    const nextRotation = computeWheelTargetRotation(
      rotationRef.current,
      selectedSlice.index,
      jitter
    );
    rotationRef.current = nextRotation;

    setErrorMsg(null);
    setWonInfo(null);
    setPhase('spinning');
    setRotationDeg(nextRotation);
    sounds.playCountdown(3);

    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      spinTimerRef.current = null;
      if (!mountedRef.current) return;

      const result = onCommitSpin(selectedSlice, spinKind);
      if (!result.ok) {
        setErrorMsg(result.reason || 'Çevirme tamamlanamadı.');
        setPhase('idle');
        return;
      }

      setWonInfo({
        slice: selectedSlice,
        summary: result.grantedSummary,
      });
      setPhase('won');
      sounds.playVictory();
      haptics.correct();

      try {
        confetti({
          particleCount: selectedSlice.tier === 'jackpot' ? 120 : selectedSlice.tier === 'rare' ? 85 : 60,
          spread: 72,
          origin: { y: 0.58 },
          colors: [selectedSlice.accentColor, '#fbbf24', '#22d3ee', '#ffffff'],
        });
      } catch {
        // ignore confetti error in headless environments
      }
    }, SPIN_DURATION_MS);
  };

  const handleFreeSpinClick = () => {
    if (phase === 'spinning' || phase === 'watching_ad') return;
    if (!freeSpinAvailable) return;
    startSpin('free');
  };

  const handleAdSpinClick = async () => {
    if (phase === 'spinning' || phase === 'watching_ad') return;
    if (freeSpinAvailable || remainingAdSpins <= 0) return;

    setErrorMsg(null);
    setWonInfo(null);
    setPhase('watching_ad');
    setAdSecondsLeft(Math.ceil(SIMULATED_AD_DURATION_MS / 1000));
    setAdProgressPct(0);

    const startTime = Date.now();
    if (adIntervalRef.current) clearInterval(adIntervalRef.current);
    adIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / SIMULATED_AD_DURATION_MS) * 100));
      const rem = Math.max(0, Math.ceil((SIMULATED_AD_DURATION_MS - elapsed) / 1000));
      setAdProgressPct(pct);
      setAdSecondsLeft(rem);
      if (elapsed >= SIMULATED_AD_DURATION_MS && adIntervalRef.current) {
        clearInterval(adIntervalRef.current);
        adIntervalRef.current = null;
      }
    }, 80);

    await showRewardedAd('wheel_spin', { durationMs: SIMULATED_AD_DURATION_MS });
    if (adIntervalRef.current) {
      clearInterval(adIntervalRef.current);
      adIntervalRef.current = null;
    }
    if (!mountedRef.current) return;
    setAdProgressPct(100);
    setAdSecondsLeft(0);
    startSpin('ad');
  };

  const isBusy = phase === 'spinning' || phase === 'watching_ad';

  return createPortal(
    <div
      data-testid="daily-wheel-modal"
      className="fixed inset-0 z-[92] flex items-center justify-center p-3 sm:p-4 bg-black/88 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#0b1224] via-slate-950 to-[#110c24] border border-fuchsia-500/45 p-4 sm:p-5 shadow-2xl max-h-[94dvh] overflow-y-auto text-center">
        <button
          type="button"
          data-testid="daily-wheel-close-btn"
          disabled={phase === 'spinning'}
          onClick={onClose}
          className="absolute top-3.5 right-3.5 min-w-[36px] min-h-[36px] rounded-xl bg-slate-800/90 hover:bg-slate-700 disabled:opacity-40 text-slate-300 flex items-center justify-center cursor-pointer transition"
          aria-label="Çarkı Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title & Current Resource Strip */}
        <div className="pr-8 text-left sm:text-center">
          <h3 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center sm:justify-center gap-2">
            <span aria-hidden="true">🎡</span>
            <span>GÜNLÜK KADER ÇARKI</span>
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Her gün 1 ücretsiz çevirme + reklam ile günde 3 ek hak!
          </p>
        </div>

        {/* Clean Unboxed Resource Summary */}
        <div className="mt-2.5 flex items-center justify-center gap-3 text-xs font-black font-mono tabular-nums text-slate-200">
          <span className="inline-flex items-center gap-1 text-amber-300">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span data-testid="wheel-balance-coins">{formatPoints(progression.coins)}</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="inline-flex items-center gap-1 text-cyan-300">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span data-testid="wheel-balance-energy">
              {isVipUnlimited ? '∞ Enerji' : `${currentEnergy}/${MAX_DAILY_ENERGY} Enerji`}
            </span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="inline-flex items-center gap-1 text-fuchsia-300">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
            <span data-testid="wheel-balance-jokers">{freeJokerTickets} Joker</span>
          </span>
        </div>

        {/* Neon Wheel Viewport */}
        <div className="relative mx-auto mt-3.5 mb-3 w-[272px] h-[272px] sm:w-[304px] sm:h-[304px] flex items-center justify-center select-none">
          {/* Outer Ambient Halo */}
          <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle,_rgba(236,72,153,0.2),_rgba(6,182,212,0.1)_55%,_transparent_75%)] pointer-events-none" />

          {/* Top Fixed 12 O'Clock Pointer Needle */}
          <div
            data-testid="wheel-top-pointer"
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none"
          >
            <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
              <defs>
                <linearGradient id="pointerGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <path
                d="M17 31 L5 7 Q17 2 29 7 Z"
                fill="url(#pointerGold)"
                stroke="#0f172a"
                strokeWidth="2.5"
              />
              <circle cx="17" cy="10" r="3" fill="#0f172a" />
            </svg>
          </div>

          {/* Rotating Wheel Layer */}
          <div
            data-testid="wheel-spinner-disc"
            className="w-full h-full will-change-transform"
            style={{
              transform: `rotate(${rotationDeg}deg)`,
              transition:
                phase === 'spinning'
                  ? 'transform 3500ms cubic-bezier(0.12, 0.85, 0.18, 1)'
                  : 'none',
            }}
          >
            <svg
              viewBox="0 0 360 360"
              className="w-full h-full"
              role="img"
              aria-label="8 Dilimli Günlük Kader Çarkı"
            >
              <defs>
                <radialGradient id="wheelBezelGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="82%" stopColor="#0f172a" />
                  <stop offset="96%" stopColor="#1e1b4b" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </radialGradient>
                {DAILY_WHEEL_SLICES.map((slice) => (
                  <linearGradient
                    key={`grad-${slice.id}`}
                    id={`wheel-grad-${slice.id}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor={slice.sliceBgStart} />
                    <stop offset="100%" stopColor={slice.sliceBgEnd} />
                  </linearGradient>
                ))}
              </defs>

              {/* Outer Bezel */}
              <circle
                cx={WHEEL_CENTER}
                cy={WHEEL_CENTER}
                r={OUTER_RING_RADIUS}
                fill="url(#wheelBezelGrad)"
                stroke="#22d3ee"
                strokeWidth="3"
              />

              {/* 16 Perimeter LED Studs */}
              {Array.from({ length: 16 }).map((_, idx) => {
                const pos = polarToCartesian(WHEEL_CENTER, WHEEL_CENTER, 159, idx * 22.5);
                const isEven = idx % 2 === 0;
                return (
                  <circle
                    key={`stud-${idx}`}
                    cx={pos.x}
                    cy={pos.y}
                    r={isEven ? 3.2 : 2.3}
                    fill={isEven ? '#fde047' : '#22d3ee'}
                    opacity={isEven ? 0.95 : 0.75}
                  />
                );
              })}

              {/* 8 Radial Reward Slices */}
              {DAILY_WHEEL_SLICES.map((slice) => {
                const startDeg = slice.index * WHEEL_SLICE_ANGLE_DEG;
                const endDeg = startDeg + WHEEL_SLICE_ANGLE_DEG;
                const midDeg = startDeg + WHEEL_SLICE_ANGLE_DEG / 2;
                const wedgePath = buildWedgePath(
                  WHEEL_CENTER,
                  WHEEL_CENTER,
                  SLICE_RADIUS,
                  startDeg,
                  endDeg
                );
                const arcPath = buildRimArcPath(
                  WHEEL_CENTER,
                  WHEEL_CENTER,
                  ACCENT_ARC_RADIUS,
                  startDeg + 1.2,
                  endDeg - 1.2
                );
                const isWinnerSlice =
                  phase === 'won' && wonInfo?.slice.index === slice.index;

                return (
                  <g key={slice.id}>
                    <path
                      d={wedgePath}
                      fill={`url(#wheel-grad-${slice.id})`}
                      stroke={isWinnerSlice ? '#fde047' : '#0f172a'}
                      strokeWidth={isWinnerSlice ? '3' : '2'}
                    />
                    <path
                      d={arcPath}
                      fill="none"
                      stroke={slice.accentColor}
                      strokeWidth="4.5"
                      strokeLinecap="round"
                    />
                    <g transform={`rotate(${midDeg} ${WHEEL_CENTER} ${WHEEL_CENTER})`}>
                      {slice.badgeText && (
                        <text
                          x={WHEEL_CENTER}
                          y={55}
                          textAnchor="middle"
                          fill="#fde047"
                          fontSize="8.5"
                          fontWeight="900"
                          letterSpacing="0.8"
                        >
                          {slice.badgeText}
                        </text>
                      )}
                      <text
                        x={WHEEL_CENTER}
                        y={slice.badgeText ? 71 : 65}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={
                          slice.tier === 'jackpot' || slice.tier === 'rare'
                            ? '10.5'
                            : slice.rewardType === 'joker'
                            ? '11.5'
                            : '12.5'
                        }
                        fontWeight="900"
                      >
                        {slice.shortLabel}
                      </text>
                      <text
                        x={WHEEL_CENTER}
                        y={slice.badgeText ? 86 : 82}
                        textAnchor="middle"
                        fill={slice.accentColor}
                        fontSize="9"
                        fontWeight="800"
                      >
                        {slice.rewardType === 'joker'
                          ? 'İPUCU HAKKI'
                          : slice.rewardType === 'energy'
                          ? 'ENERJİ'
                          : 'COIN'}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Center Hub Medallion */}
              <circle
                cx={WHEEL_CENTER}
                cy={WHEEL_CENTER}
                r="30"
                fill="#090d16"
                stroke="#f59e0b"
                strokeWidth="3.5"
              />
              <circle
                cx={WHEEL_CENTER}
                cy={WHEEL_CENTER}
                r="24"
                fill="#111827"
                stroke="#22d3ee"
                strokeWidth="1.5"
              />
              <text
                x={WHEEL_CENTER}
                y={WHEEL_CENTER - 1}
                textAnchor="middle"
                fill="#fde047"
                fontSize="12"
                fontWeight="900"
              >
                3-2-1
              </text>
              <text
                x={WHEEL_CENTER}
                y={WHEEL_CENTER + 11}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="7.5"
                fontWeight="800"
                letterSpacing="1"
              >
                ŞANS
              </text>
            </svg>
          </div>
        </div>

        {/* Inline Rewarded Ad Overlay / Progress (when watching ad for extra spin) */}
        {phase === 'watching_ad' && (
          <div
            data-testid="wheel-ad-watching"
            className="mb-3 p-3.5 rounded-2xl bg-slate-900/95 border border-cyan-400/50 text-left shadow-inner"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-black text-cyan-200 mb-2">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>Ödüllü Reklam Oynatılıyor...</span>
              </span>
              <span className="font-mono tabular-nums text-amber-300">{adSecondsLeft} sn</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300 transition-[width] duration-100"
                style={{ width: `${adProgressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Win Celebration Banner */}
        {phase === 'won' && wonInfo && (
          <div
            data-testid="wheel-win-banner"
            className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-amber-950/80 border border-emerald-400/60 shadow-lg animate-card-pop"
          >
            <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-300">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>TEBRİKLER! ÖDÜL KAZANDIN</span>
            </div>
            <p className="mt-1 text-base font-black text-white">{wonInfo.slice.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-200 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{wonInfo.summary}</span>
            </p>
          </div>
        )}

        {errorMsg && (
          <p className="mb-3 text-xs font-bold text-rose-300 bg-rose-950/75 border border-rose-500/50 rounded-xl px-3 py-2">
            {errorMsg}
          </p>
        )}

        {/* Primary Action CTA */}
        {freeSpinAvailable ? (
          <button
            type="button"
            data-testid="wheel-spin-btn"
            disabled={isBusy}
            onClick={handleFreeSpinClick}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-55 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-[0_0_24px_rgba(16,185,129,0.4)] cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              {phase === 'spinning' ? 'Çark Dönüyor...' : 'ÇEVİR (1 ÜCRETSİZ HAK)'}
            </span>
          </button>
        ) : remainingAdSpins > 0 ? (
          <div className="space-y-2">
            <div
              data-testid="wheel-cooldown-notice"
              className="text-[11px] font-bold text-amber-200/90 bg-slate-900/80 border border-amber-500/30 rounded-xl px-3 py-1.5"
            >
              ⏳ Sonraki ücretsiz çevirme:{' '}
              <span className="font-mono font-black text-amber-300">
                {formatWheelCooldownBadge(getRemainingWheelCooldownMs(progression))}
              </span>
            </div>
            <button
              type="button"
              data-testid="wheel-ad-spin-btn"
              disabled={isBusy}
              onClick={handleAdSpinClick}
              className="w-full min-h-[46px] py-3 px-3 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 hover:from-amber-300 hover:to-rose-300 disabled:opacity-55 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-[0_0_24px_rgba(251,191,36,0.35)] cursor-pointer whitespace-nowrap"
            >
              <span>
                {phase === 'watching_ad'
                  ? `🎬 Reklam İzleniyor (${adSecondsLeft} sn)...`
                  : phase === 'spinning'
                  ? '🎡 Çark Dönüyor...'
                  : `🎬 Reklam İzle ve +1 Çevirme Kazan (${remainingAdSpins}/${MAX_WHEEL_AD_SPINS_PER_DAY})`}
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="wheel-exhausted-btn"
            disabled
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-black text-xs sm:text-sm cursor-not-allowed"
          >
            Ücretsiz Hak Bekleniyor ({formatWheelCooldownBadge(getRemainingWheelCooldownMs(progression))}) • Reklam 0/3
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};
