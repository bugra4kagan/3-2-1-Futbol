import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { UserProgression } from './types';

export const MAX_COINS = 20_000_000;
export const MAX_COIN_GAIN_PER_SYNC = 25_000;
export const MAX_WEEKLY_POINTS = 5_000_000;
export const MAX_TOTAL_POINTS = 50_000_000;
export const MAX_POINTS_GAIN_PER_SYNC = 10_000;

export const IAP_ONLY_ITEM_IDS = new Set([
  'store_ad_free',
  'bundle_vip_adfree_frame',
  'pack_coin_1500',
  'pack_coin_5000',
  'pack_coin_15000',
]);

export interface SanitizeProgressionOptions {
  allowVerifiedIapGrant?: boolean;
  verifiedCoinCredit?: number;
  strictActionVerification?: boolean;
}

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

export function computeVerifiedActionAllowances(
  prev: UserProgression,
  incoming: UserProgression,
  verifiedCoinCredit: number = 0
): { maxCoinGain: number; maxPointGain: number } {
  const newMatches = Math.max(
    0,
    Math.round(Number(incoming.matchesPlayed) || 0) - Math.round(Number(prev.matchesPlayed) || 0)
  );
  const newWins = Math.max(
    0,
    Math.round(Number(incoming.wins) || 0) - Math.round(Number(prev.wins) || 0)
  );
  const effectiveMatches = Math.max(newMatches, newWins);

  const prevChallengeDays = Object.keys(prev.dailyChallengeHistory || {}).length;
  const nextChallengeDays = Object.keys(incoming.dailyChallengeHistory || {}).length;
  const newDailyChallenges = Math.max(0, nextChallengeDays - prevChallengeDays);

  const prevClaimedAch = new Set(prev.claimedAchievements || []);
  const newClaimedAch = (incoming.claimedAchievements || []).filter(
    (id) => !prevClaimedAch.has(id)
  ).length;

  const wheelSpun =
    (incoming.wheelLastFreeSpinAt ?? 0) > (prev.wheelLastFreeSpinAt ?? 0) ||
    (incoming.wheelAdSpinsUsed ?? 0) > (prev.wheelAdSpinsUsed ?? 0)
      ? 1
      : 0;

  const dailyLoginClaimed =
    incoming.dailyLogin?.lastClaimDate &&
    incoming.dailyLogin.lastClaimDate !== prev.dailyLogin?.lastClaimDate
      ? 1
      : 0;

  const prevQuestsClaimed = new Set(
    (prev.dailyQuests || []).filter((q) => q.claimed).map((q) => q.id)
  );
  const newQuestsClaimed = (incoming.dailyQuests || []).filter(
    (q) => q.claimed && !prevQuestsClaimed.has(q.id)
  ).length;

  const socialBonusClaimed = !prev.socialBonusClaimed && incoming.socialBonusClaimed ? 1 : 0;
  const actionCoinBudget =
    effectiveMatches * 800 +
    newDailyChallenges * 1200 +
    newClaimedAch * 2500 +
    wheelSpun * 1500 +
    dailyLoginClaimed * 1000 +
    newQuestsClaimed * 600 +
    socialBonusClaimed * 300 +
    Math.max(0, Math.round(verifiedCoinCredit)) +
    500; // Ödüllü video (+250 coin) tamponu

  const actionPointBudget =
    effectiveMatches * 500 +
    newDailyChallenges * 400 +
    newQuestsClaimed * 250 +
    newClaimedAch * 150 +
    250; // Yuvarlama / streak tamponu

  return {
    maxCoinGain: Math.min(
      MAX_COIN_GAIN_PER_SYNC + Math.max(0, Math.round(verifiedCoinCredit)),
      actionCoinBudget
    ),
    maxPointGain: Math.min(MAX_POINTS_GAIN_PER_SYNC, actionPointBudget),
  };
}

export function sanitizeProgressionUpdate(
  prev: UserProgression | null | undefined,
  incoming: UserProgression,
  options?: SanitizeProgressionOptions
): UserProgression {
  const rawCoins = Math.max(0, Math.min(MAX_COINS, Math.round(Number(incoming.coins) || 0)));
  const rawWeekly = Math.max(0, Math.min(MAX_WEEKLY_POINTS, Math.round(Number(incoming.weeklyPoints) || 0)));
  const rawTotal = Math.max(0, Math.min(MAX_TOTAL_POINTS, Math.round(Number(incoming.totalPoints) || 0)));

  const incomingGifts = Array.isArray(incoming.unlockedGiftIds)
    ? incoming.unlockedGiftIds.filter((id): id is string => typeof id === 'string')
    : [];

  if (!prev) {
    const safeGifts = options?.allowVerifiedIapGrant
      ? incomingGifts
      : incomingGifts.filter((id) => id !== 'store_ad_free' && id !== 'bundle_vip_adfree_frame');
    return {
      ...incoming,
      coins: Math.min(rawCoins, 50_000),
      weeklyPoints: Math.min(rawWeekly, 25_000),
      totalPoints: Math.min(rawTotal, 250_000),
      adFree: options?.allowVerifiedIapGrant ? Boolean(incoming.adFree) : false,
      unlockedGiftIds: safeGifts,
    };
  }

  const prevCoins = Math.max(0, Math.round(Number(prev.coins) || 0));
  const prevWeekly = Math.max(0, Math.round(Number(prev.weeklyPoints) || 0));
  const prevTotal = Math.max(0, Math.round(Number(prev.totalPoints) || 0));
  const allowances = options?.strictActionVerification
    ? computeVerifiedActionAllowances(prev, incoming, options?.verifiedCoinCredit ?? 0)
    : { maxCoinGain: MAX_COIN_GAIN_PER_SYNC, maxPointGain: MAX_POINTS_GAIN_PER_SYNC };

  const clampedCoins = Math.min(rawCoins, prevCoins + allowances.maxCoinGain);
  const clampedWeekly = Math.min(rawWeekly, prevWeekly + allowances.maxPointGain);
  const clampedTotal = Math.max(
    prevTotal,
    Math.min(rawTotal, prevTotal + allowances.maxPointGain)
  );

  // IAP ile açılan VIP / Reklam Engelleme hakları doğrulanmamış istemci senkronuyla kendiliğinden eklenemez
  // Mevcut VIP hakları (prev.adFree === true) her zaman korunur!
  const prevAdFree = Boolean(prev.adFree);
  const nextAdFree = prevAdFree || (Boolean(options?.allowVerifiedIapGrant) && Boolean(incoming.adFree));
  const prevGiftSet = new Set(prev.unlockedGiftIds || []);
  const sanitizedGifts = Array.from(
    new Set(
      incomingGifts.filter((id) => {
        if (id === 'store_ad_free' || id === 'bundle_vip_adfree_frame') {
          return prevGiftSet.has(id) || Boolean(options?.allowVerifiedIapGrant);
        }
        return true;
      })
    )
  );
  for (const prevId of prevGiftSet) {
    if ((prevId === 'store_ad_free' || prevId === 'bundle_vip_adfree_frame') && !sanitizedGifts.includes(prevId)) {
      sanitizedGifts.push(prevId);
    }
  }

  return {
    ...incoming,
    coins: clampedCoins,
    weeklyPoints: clampedWeekly,
    totalPoints: clampedTotal,
    adFree: nextAdFree,
    unlockedGiftIds: sanitizedGifts,
    matchesPlayed: Math.max(Math.round(Number(prev.matchesPlayed) || 0), Math.round(Number(incoming.matchesPlayed) || 0)),
    wins: Math.max(Math.round(Number(prev.wins) || 0), Math.round(Number(incoming.wins) || 0)),
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
