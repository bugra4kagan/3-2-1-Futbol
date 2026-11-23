import { UserProgression, WheelSliceDefinition } from './types';
import { getAuthoritativeServerDate } from './serverTime';
import {
  MAX_DAILY_ENERGY,
  getEffectiveDailyEnergy,
  getLocalDateKey,
  hasUnlimitedEnergy,
  refundMatchEnergy,
  syncProgressionForToday,
} from './retentionEngine';

export const MAX_WHEEL_AD_SPINS_PER_DAY = 3;
export const WHEEL_SLICE_ANGLE_DEG = 45;

/**
 * 8 adet dengeli ödül dilimi:
 * Standart ödüller yüksek ağırlıklı, 1.000 Coin (Nadir) ve 2.500 Coin Büyük Ödül (Çok Nadir) düşük ihtimalli.
 */
export const DAILY_WHEEL_SLICES: WheelSliceDefinition[] = [
  {
    id: 'coins_100',
    index: 0,
    label: '+100 Coin',
    shortLabel: '+100 🪙',
    rewardType: 'coins',
    amount: 100,
    weight: 26,
    tier: 'standard',
    accentColor: '#38bdf8',
    sliceBgStart: '#0f2744',
    sliceBgEnd: '#1e3a5f',
  },
  {
    id: 'energy_1',
    index: 1,
    label: '+1 Enerji',
    shortLabel: '+1 ⚡',
    rewardType: 'energy',
    amount: 1,
    weight: 18,
    tier: 'standard',
    accentColor: '#22d3ee',
    sliceBgStart: '#0b2d39',
    sliceBgEnd: '#114e63',
  },
  {
    id: 'coins_250',
    index: 2,
    label: '+250 Coin',
    shortLabel: '+250 🪙',
    rewardType: 'coins',
    amount: 250,
    weight: 20,
    tier: 'standard',
    accentColor: '#34d399',
    sliceBgStart: '#0b2e26',
    sliceBgEnd: '#115e46',
  },
  {
    id: 'free_joker_1',
    index: 3,
    label: 'Ücretsiz İpucu Hakkı (+1 Joker)',
    shortLabel: '+1 Joker',
    rewardType: 'joker',
    amount: 1,
    weight: 14,
    tier: 'standard',
    accentColor: '#e879f9',
    sliceBgStart: '#2d1240',
    sliceBgEnd: '#581c87',
  },
  {
    id: 'coins_500',
    index: 4,
    label: '+500 Coin',
    shortLabel: '+500 🪙',
    rewardType: 'coins',
    amount: 500,
    weight: 11,
    tier: 'standard',
    accentColor: '#fbbf24',
    sliceBgStart: '#3a2408',
    sliceBgEnd: '#78350f',
  },
  {
    id: 'energy_2',
    index: 5,
    label: '+2 Enerji',
    shortLabel: '+2 ⚡',
    rewardType: 'energy',
    amount: 2,
    weight: 6,
    tier: 'standard',
    accentColor: '#06b6d4',
    sliceBgStart: '#0e2847',
    sliceBgEnd: '#155e75',
  },
  {
    id: 'coins_1000',
    index: 6,
    label: '+1.000 Coin',
    shortLabel: '+1.000 🪙',
    rewardType: 'coins',
    amount: 1000,
    weight: 4,
    tier: 'rare',
    badgeText: 'NADİR',
    accentColor: '#a855f7',
    sliceBgStart: '#2e1065',
    sliceBgEnd: '#6d28d9',
  },
  {
    id: 'coins_2500_jackpot',
    index: 7,
    label: '+2.500 Coin BÜYÜK ÖDÜL',
    shortLabel: '+2.500 🪙',
    rewardType: 'coins',
    amount: 2500,
    weight: 1,
    tier: 'jackpot',
    badgeText: 'BÜYÜK ÖDÜL',
    accentColor: '#f43f5e',
    sliceBgStart: '#4c0519',
    sliceBgEnd: '#be123c',
  },
];

export const WHEEL_FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const WHEEL_NEXT_FREE_SPIN_STORAGE_KEY = 'football_wheel_next_free_spin_at';

function readStoredWheelCooldownEndMs(): number {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem(WHEEL_NEXT_FREE_SPIN_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writeWheelCooldownEndMs(endMs: number): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    if (Number.isFinite(endMs) && endMs > 0) {
      window.localStorage.setItem(WHEEL_NEXT_FREE_SPIN_STORAGE_KEY, String(Math.round(endMs)));
    } else {
      window.localStorage.removeItem(WHEEL_NEXT_FREE_SPIN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota/privacy mode failures gracefully
  }
}

export function getWheelFreeSpinCooldownEndMs(
  prog: UserProgression,
  now: Date = getAuthoritativeServerDate()
): number {
  const storedEnd = readStoredWheelCooldownEndMs();
  const progEnd =
    typeof prog.wheelLastFreeSpinAt === 'number' &&
    Number.isFinite(prog.wheelLastFreeSpinAt) &&
    prog.wheelLastFreeSpinAt > 0
      ? prog.wheelLastFreeSpinAt + WHEEL_FREE_COOLDOWN_MS
      : 0;
  const maxTimestampEnd = Math.max(storedEnd, progEnd);
  if (maxTimestampEnd > 0) {
    return maxTimestampEnd;
  }

  // Legacy fallback: if user already spun today before 24h timestamp tracking existed
  if (prog.wheelLastFreeSpinDate === getLocalDateKey(now)) {
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );
    return nextMidnight.getTime();
  }

  return 0;
}

export function getRemainingWheelCooldownMs(
  prog: UserProgression,
  now: Date = getAuthoritativeServerDate()
): number {
  const endMs = getWheelFreeSpinCooldownEndMs(prog, now);
  if (endMs <= 0) return 0;
  return Math.max(0, endMs - now.getTime());
}

export function formatWheelCooldownBadge(remainingMs: number): string {
  const ms = Math.max(0, remainingMs);
  if (ms <= 0) return 'ÇEVİR';
  const totalMinutes = Math.max(1, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} kaldı`;
}

export function canUseFreeWheelSpin(
  prog: UserProgression,
  now: Date = getAuthoritativeServerDate()
): boolean {
  return getRemainingWheelCooldownMs(prog, now) <= 0;
}

export function getUsedWheelAdSpins(
  prog: UserProgression,
  now: Date = getAuthoritativeServerDate()
): number {
  const today = getLocalDateKey(now);
  if (prog.wheelAdSpinsDate !== today) return 0;
  return Math.max(0, Math.min(MAX_WHEEL_AD_SPINS_PER_DAY, Math.round(prog.wheelAdSpinsUsed ?? 0)));
}

export function getRemainingWheelAdSpins(
  prog: UserProgression,
  now: Date = getAuthoritativeServerDate()
): number {
  return Math.max(0, MAX_WHEEL_AD_SPINS_PER_DAY - getUsedWheelAdSpins(prog, now));
}

export function pickWeightedWheelSlice(
  rng: () => number = Math.random
): WheelSliceDefinition {
  const totalWeight = DAILY_WHEEL_SLICES.reduce((sum, s) => sum + s.weight, 0);
  const raw = Math.max(0, Math.min(0.9999999, rng())) * totalWeight;
  let cumulative = 0;
  for (const slice of DAILY_WHEEL_SLICES) {
    cumulative += slice.weight;
    if (raw < cumulative) {
      return slice;
    }
  }
  return DAILY_WHEEL_SLICES[0];
}

/**
 * Saat 12 (0 derece) ibresinin seçilen dilimin tam ortasına oturması için
 * çarkın mevcut açısından en az 6 tam tur ileri hedef rotasyon açısı üretir.
 */
export function computeWheelTargetRotation(
  currentRotationDeg: number,
  sliceIndex: number,
  jitterRatio: number = 0.5
): number {
  const safeIdx = ((sliceIndex % DAILY_WHEEL_SLICES.length) + DAILY_WHEEL_SLICES.length) % DAILY_WHEEL_SLICES.length;
  const centerDeg = safeIdx * WHEEL_SLICE_ANGLE_DEG + WHEEL_SLICE_ANGLE_DEG / 2;
  // Küçük [-12°, +12°] sapma ile doğal duruş, sınır çizgisinden uzak kalır
  const clampedJitter = Math.max(0, Math.min(1, jitterRatio));
  const jitterDeg = (clampedJitter - 0.5) * 24;
  const landingAngle = (((centerDeg + jitterDeg) % 360) + 360) % 360;
  const desiredMod = (360 - landingAngle) % 360;
  const currentMod = ((currentRotationDeg % 360) + 360) % 360;
  const deltaToDesired = (desiredMod - currentMod + 360) % 360;
  return currentRotationDeg + 360 * 6 + deltaToDesired;
}

export function resolveSliceIndexAtTopPointer(rotationDeg: number): number {
  const origAngleAtTop = (((-rotationDeg % 360) + 360) % 360);
  return Math.floor(origAngleAtTop / WHEEL_SLICE_ANGLE_DEG) % DAILY_WHEEL_SLICES.length;
}

export function applyWheelReward(
  prog: UserProgression,
  slice: WheelSliceDefinition,
  options: { spinKind: 'free' | 'ad' },
  now: Date = getAuthoritativeServerDate()
): {
  ok: boolean;
  reason?: string;
  progression: UserProgression;
  grantedSummary: string;
} {
  const synced = syncProgressionForToday(prog, now);
  const today = getLocalDateKey(now);

  if (options.spinKind === 'free') {
    if (!canUseFreeWheelSpin(synced, now)) {
      return {
        ok: false,
        reason: 'Ücretsiz çevirme hakkın için 24 saatlik bekleme süresi henüz dolmadı.',
        progression: synced,
        grantedSummary: '',
      };
    }
  } else {
    if (getRemainingWheelAdSpins(synced, now) <= 0) {
      return {
        ok: false,
        reason: 'Bugünkü reklamla çevirme limitine (3/3) ulaşıldı. Yarın tekrar dene!',
        progression: synced,
        grantedSummary: '',
      };
    }
  }

  const nowMs = now.getTime();
  if (options.spinKind === 'free') {
    writeWheelCooldownEndMs(nowMs + WHEEL_FREE_COOLDOWN_MS);
  }

  let nextProg: UserProgression = {
    ...synced,
    ...(options.spinKind === 'free'
      ? {
          wheelLastFreeSpinDate: today,
          wheelLastFreeSpinAt: nowMs,
        }
      : {
          wheelAdSpinsDate: today,
          wheelAdSpinsUsed: getUsedWheelAdSpins(synced, now) + 1,
        }),
  };

  let grantedSummary = slice.label;

  if (slice.rewardType === 'coins') {
    nextProg = {
      ...nextProg,
      coins: nextProg.coins + slice.amount,
    };
    grantedSummary = `+${slice.amount.toLocaleString('tr-TR')} Coin bakiyene eklendi!`;
  } else if (slice.rewardType === 'energy') {
    if (hasUnlimitedEnergy(nextProg)) {
      grantedSummary = `VIP Sınırsız Enerjin aktif (+${slice.amount} Enerji bonusu)!`;
    } else {
      const before = getEffectiveDailyEnergy(nextProg, now);
      nextProg = refundMatchEnergy(nextProg, slice.amount, now);
      const after = getEffectiveDailyEnergy(nextProg, now);
      const gained = Math.max(0, after - before);
      grantedSummary =
        gained > 0
          ? `+${gained} Enerji eklendi (${after}/${MAX_DAILY_ENERGY} Enerji)!`
          : `Enerjin zaten tam (${MAX_DAILY_ENERGY}/${MAX_DAILY_ENERGY} Enerji)!`;
    }
  } else if (slice.rewardType === 'joker') {
    const nextTickets = (nextProg.freeJokerTickets ?? 0) + slice.amount;
    nextProg = {
      ...nextProg,
      freeJokerTickets: nextTickets,
    };
    grantedSummary = `+${slice.amount} Ücretsiz İpucu Hakkı eklendi (Toplam: ${nextTickets} Joker)!`;
  }

  return {
    ok: true,
    progression: nextProg,
    grantedSummary,
  };
}
