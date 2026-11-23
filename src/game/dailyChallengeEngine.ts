import { MATCH_PAIRINGS } from './database';
import { CAREER_CHALLENGES, COUNTRY_CLUB_CHALLENGES } from './minigamesData';
import { getAuthoritativeServerDate } from './serverTime';
import { MinigameRoundPayload, UserProgression } from './types';

export const DAILY_CHALLENGE_EPOCH_DATE = '2026-01-01';
export const DAILY_CHALLENGE_ROUND_COUNT = 3;
export const DAILY_CHALLENGE_LOCK_STORAGE_KEY = '321_daily_challenge_played_date';
export const DAILY_CHALLENGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const DAILY_CHALLENGE_NEXT_AT_STORAGE_KEY = '321_daily_challenge_next_at';

function readStoredDailyChallengeCooldownEndMs(
  storage?: Pick<Storage, 'getItem'> | null
): number {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return 0;
  try {
    const raw = target.getItem(DAILY_CHALLENGE_NEXT_AT_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writeDailyChallengeCooldownEndMs(
  endMs: number,
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null
): void {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return;
  try {
    if (Number.isFinite(endMs) && endMs > 0) {
      target.setItem(DAILY_CHALLENGE_NEXT_AT_STORAGE_KEY, String(Math.round(endMs)));
    } else {
      target.removeItem(DAILY_CHALLENGE_NEXT_AT_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getDailyChallengeCooldownEndMs(
  prog?: Pick<UserProgression, 'dailyChallengeLastPlayedAt' | 'dailyChallengeHistory'> | null,
  _now: Date = getAuthoritativeServerDate(),
  storage?: Pick<Storage, 'getItem'> | null
): number {
  const storedEnd = readStoredDailyChallengeCooldownEndMs(storage);
  const directLastPlayedAt =
    typeof prog?.dailyChallengeLastPlayedAt === 'number' &&
    Number.isFinite(prog.dailyChallengeLastPlayedAt) &&
    prog.dailyChallengeLastPlayedAt > 0
      ? prog.dailyChallengeLastPlayedAt + DAILY_CHALLENGE_COOLDOWN_MS
      : 0;

  let maxHistoryEnd = 0;
  if (prog?.dailyChallengeHistory) {
    for (const rec of Object.values(prog.dailyChallengeHistory)) {
      if (rec && typeof rec.completedAt === 'number' && Number.isFinite(rec.completedAt)) {
        maxHistoryEnd = Math.max(maxHistoryEnd, rec.completedAt + DAILY_CHALLENGE_COOLDOWN_MS);
      }
    }
  }

  return Math.max(storedEnd, directLastPlayedAt, maxHistoryEnd);
}

export function getRemainingDailyChallengeCooldownMs(
  prog?: Pick<UserProgression, 'dailyChallengeLastPlayedAt' | 'dailyChallengeHistory'> | null,
  now: Date = getAuthoritativeServerDate(),
  storage?: Pick<Storage, 'getItem'> | null
): number {
  const endMs = getDailyChallengeCooldownEndMs(prog, now, storage);
  if (endMs <= 0) return 0;
  return Math.max(0, endMs - now.getTime());
}

export function canPlayDailyChallengeNow(
  prog?: Pick<UserProgression, 'dailyChallengeLastPlayedAt' | 'dailyChallengeHistory'> | null,
  now: Date = getAuthoritativeServerDate(),
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  return getRemainingDailyChallengeCooldownMs(prog, now, storage) <= 0;
}

export function formatCountdownHMS(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function hasPlayedDailyChallengeToday(
  dateKey: string,
  storage?: Pick<Storage, 'getItem'> | null
): boolean {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return false;
  try {
    return target.getItem(DAILY_CHALLENGE_LOCK_STORAGE_KEY) === dateKey;
  } catch {
    return false;
  }
}

export function markDailyChallengePlayedToday(
  dateKey: string,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return;
  try {
    target.setItem(DAILY_CHALLENGE_LOCK_STORAGE_KEY, dateKey);
  } catch {
    // ignore storage errors
  }
}

export function getTimeUntilMidnightCountdown(now: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffSec = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    hours,
    minutes,
    seconds,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
  };
}

function parseDateKeyUTC(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return Date.UTC(2026, 0, 1);
  return Date.UTC(y, m - 1, d);
}

/**
 * Returns deterministic puzzle number (#1, #2, ..., #42...) for a YYYY-MM-DD local date key.
 */
export function getDailyPuzzleNumber(dateKey: string): number {
  const epochMs = parseDateKeyUTC(DAILY_CHALLENGE_EPOCH_DATE);
  const currentMs = parseDateKeyUTC(dateKey);
  const dayDiff = Math.floor((currentMs - epochMs) / (1000 * 60 * 60 * 24));
  return Math.max(1, dayDiff + 1);
}

function hashDateKey(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
}

/**
 * Generates the identical 3-round Daily Challenge sequence for all users on a given dateKey:
 * Round 1: İki Kulüp Ortak Futbolcu (two_clubs)
 * Round 2: Kariyer Yolu (career)
 * Round 3: 1 Ülke + 1 Kulüp (country_club)
 */
export function generateDailyChallengeRounds(dateKey: string): MinigameRoundPayload[] {
  const seedBase = hashDateKey(`daily_321_${dateKey}`);

  const pairing =
    MATCH_PAIRINGS[(seedBase + 7) % MATCH_PAIRINGS.length];
  const career =
    CAREER_CHALLENGES[(seedBase * 3 + 13) % CAREER_CHALLENGES.length];
  const countryClub =
    COUNTRY_CLUB_CHALLENGES[(seedBase * 5 + 29) % COUNTRY_CLUB_CHALLENGES.length];

  return [
    { minigameType: 'two_clubs', pairing },
    { minigameType: 'career', career },
    { minigameType: 'country_club', countryClub },
  ];
}

export function calculateDailyChallengeReward(correctCount: number): {
  coins: number;
  points: number;
} {
  const clamped = Math.max(0, Math.min(DAILY_CHALLENGE_ROUND_COUNT, Math.round(correctCount)));
  const coins = 80 + clamped * 90 + (clamped === DAILY_CHALLENGE_ROUND_COUNT ? 150 : 0);
  const points = 60 + clamped * 70 + (clamped === DAILY_CHALLENGE_ROUND_COUNT ? 120 : 0);
  return { coins, points };
}

export function formatDailyShareSummary(params: {
  puzzleNumber: number;
  correctCount: number;
  totalRounds?: number;
  elapsedSec: number;
}): string {
  const total = params.totalRounds ?? DAILY_CHALLENGE_ROUND_COUNT;
  const safeCorrect = Math.max(0, Math.min(total, Math.round(params.correctCount)));
  const safeTime = Math.max(0.1, params.elapsedSec).toFixed(1);
  return `3-2-1 Football Challenge • Günlük #${params.puzzleNumber} • ${safeCorrect}/${total} Doğru • ${safeTime} sn ⚽🔥`;
}
