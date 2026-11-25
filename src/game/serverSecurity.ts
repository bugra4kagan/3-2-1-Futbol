import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { UserProgression } from './types';

export const MAX_COINS = 20_000_000;
export const MAX_COIN_GAIN_PER_SYNC = 25_000;
export const MAX_WEEKLY_POINTS = 5_000_000;
export const MAX_TOTAL_POINTS = 50_000_000;
export const MAX_POINTS_GAIN_PER_SYNC = 10_000;

const PROCESS_FALLBACK_KEY = crypto.randomBytes(32).toString('hex');

function resolveSessionSigningKey(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  return fromEnv && fromEnv.length >= 16 ? fromEnv : PROCESS_FALLBACK_KEY;
}

export function generateAccountAuthSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function createAccountSessionToken(
  accountId: string,
  accountSecret: string,
  signingKey: string = resolveSessionSigningKey()
): string {
  const cleanId = String(accountId || '').trim();
  const payload = `${cleanId}:${accountSecret}`;
  return crypto.createHmac('sha256', signingKey).update(payload).digest('hex');
}

export function verifyAccountSessionToken(
  accountId: string,
  providedToken: string | undefined | null,
  accountSecret: string | undefined | null,
  signingKey: string = resolveSessionSigningKey()
): boolean {
  if (!providedToken || !accountSecret || !accountId) return false;
  const cleanProvided = String(providedToken).trim();
  if (!/^[a-f0-9]{64}$/i.test(cleanProvided)) return false;

  const expected = createAccountSessionToken(accountId, accountSecret, signingKey);
  const a = Buffer.from(cleanProvided.toLowerCase(), 'utf8');
  const b = Buffer.from(expected.toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function sanitizeProgressionUpdate(
  prev: UserProgression | null | undefined,
  incoming: UserProgression
): UserProgression {
  const rawCoins = Math.max(0, Math.min(MAX_COINS, Math.round(Number(incoming.coins) || 0)));
  const rawWeekly = Math.max(0, Math.min(MAX_WEEKLY_POINTS, Math.round(Number(incoming.weeklyPoints) || 0)));
  const rawTotal = Math.max(0, Math.min(MAX_TOTAL_POINTS, Math.round(Number(incoming.totalPoints) || 0)));

  if (!prev) {
    return {
      ...incoming,
      coins: Math.min(rawCoins, 50_000),
      weeklyPoints: Math.min(rawWeekly, 25_000),
      totalPoints: Math.min(rawTotal, 250_000),
    };
  }

  const prevCoins = Math.max(0, Math.round(Number(prev.coins) || 0));
  const prevWeekly = Math.max(0, Math.round(Number(prev.weeklyPoints) || 0));
  const prevTotal = Math.max(0, Math.round(Number(prev.totalPoints) || 0));

  const clampedCoins = Math.min(rawCoins, prevCoins + MAX_COIN_GAIN_PER_SYNC);
  const clampedWeekly = Math.min(rawWeekly, prevWeekly + MAX_POINTS_GAIN_PER_SYNC);
  const clampedTotal = Math.max(
    prevTotal,
    Math.min(rawTotal, prevTotal + MAX_POINTS_GAIN_PER_SYNC)
  );

  return {
    ...incoming,
    coins: clampedCoins,
    weeklyPoints: clampedWeekly,
    totalPoints: clampedTotal,
  };
}

export function sanitizeLeaderboardNumbers(
  prev: { weeklyPoints?: number; totalPoints?: number } | undefined,
  rawWeekly: unknown,
  rawTotal: unknown
): { weeklyPoints: number; totalPoints: number } {
  const parsedWeekly = Math.max(0, Math.min(MAX_WEEKLY_POINTS, Math.round(Number(rawWeekly) || 0)));
  const parsedTotal = Math.max(0, Math.min(MAX_TOTAL_POINTS, Math.round(Number(rawTotal) || 0)));

  if (!prev) {
    return {
      weeklyPoints: Math.min(parsedWeekly, 25_000),
      totalPoints: Math.min(parsedTotal, 250_000),
    };
  }

  const prevWeekly = Math.max(0, Math.round(Number(prev.weeklyPoints) || 0));
  const prevTotal = Math.max(0, Math.round(Number(prev.totalPoints) || 0));

  return {
    weeklyPoints: Math.min(parsedWeekly, prevWeekly + MAX_POINTS_GAIN_PER_SYNC),
    totalPoints: Math.max(
      prevTotal,
      Math.min(parsedTotal, prevTotal + MAX_POINTS_GAIN_PER_SYNC)
    ),
  };
}

export class SlidingRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  public consume(key: string, now: number = Date.now()): {
    allowed: boolean;
    remaining: number;
    retryAfterSec: number;
  } {
    const cleanKey = String(key || 'unknown').slice(0, 128);
    const cutoff = now - this.windowMs;
    const prevList = this.hits.get(cleanKey) || [];
    const recent = prevList.filter((ts) => ts > cutoff);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.hits.set(cleanKey, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec,
      };
    }

    recent.push(now);
    this.hits.set(cleanKey, recent);

    if (this.hits.size > 5000) {
      for (const [k, list] of this.hits.entries()) {
        if (list.every((ts) => ts <= cutoff)) {
          this.hits.delete(k);
        }
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - recent.length),
      retryAfterSec: 0,
    };
  }
}

export function applySecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (req.path.startsWith('/api/accounts')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}
