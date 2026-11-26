import { normalizeUsernameKey, validateUsernameFormat } from './accountEngine.js';
import { PersistentAccountRecord } from './accountStore.js';
import { isLegacyFlaggedUsername, isReservedSystemUsername, isUsernameProfane } from './usernameFilter.js';

export type LegacyModerationFlagReason =
  | 'profanity_or_abuse'
  | 'system_impersonation'
  | 'invalid_or_empty';

export interface LegacyModerationChange {
  accountId: string;
  oldName: string;
  newName: string;
  newKey: string;
  reason: LegacyModerationFlagReason;
}

export interface LegacyModerationAuditResult<T extends PersistentAccountRecord = PersistentAccountRecord> {
  dryRun: boolean;
  totalScanned: number;
  flaggedCount: number;
  migratedCount: number;
  unchangedCount: number;
  changes: LegacyModerationChange[];
  records: T[];
}

function deterministicFiveDigitSuffix(seed: string, attempt: number): string {
  let hash = 2166136261 ^ attempt;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = 10000 + (Math.abs(hash) % 90000);
  // Avoid offensive numeric combinations
  return String(num).replace(/31/g, '42');
}

function allocateTemporaryPlayerName(seed: string, usedKeys: Set<string>): {
  name: string;
  key: string;
} {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const suffix = deterministicFiveDigitSuffix(seed, attempt);
    const candidate = `Oyuncu${suffix}`;
    const key = normalizeUsernameKey(candidate);
    if (!usedKeys.has(key) && validateUsernameFormat(candidate).ok) {
      usedKeys.add(key);
      return { name: candidate, key };
    }
  }
  const fallbackNum = `${Date.now().toString().slice(-5)}`.replace(/31/g, '42');
  const fallbackName = `Oyuncu${fallbackNum}`;
  const fallbackKey = normalizeUsernameKey(fallbackName);
  usedKeys.add(fallbackKey);
  return { name: fallbackName, key: fallbackKey };
}

function classifyLegacyReason(rawName: string | undefined | null): LegacyModerationFlagReason {
  const cleaned = String(rawName || '').trim();
  if (!cleaned) return 'invalid_or_empty';
  if (isReservedSystemUsername(cleaned)) return 'system_impersonation';
  if (isUsernameProfane(cleaned)) return 'profanity_or_abuse';
  return 'invalid_or_empty';
}

/**
 * Audits legacy user accounts for inappropriate or system-impersonation usernames
 * and assigns safe, unique temporary "OyuncuXXXXX" display names without deleting accounts
 * or altering coins, league points, match history, friends, or purchases.
 */
export function auditAndMigrateLegacyUsernames<T extends PersistentAccountRecord>(
  records: readonly T[],
  options: { dryRun?: boolean; now?: number } = {}
): LegacyModerationAuditResult<T> {
  const dryRun = options.dryRun !== false;
  const now = options.now ?? Date.now();
  const usedKeys = new Set<string>();

  for (const rec of records) {
    const currentName = rec.profile?.name || rec.username;
    if (!isLegacyFlaggedUsername(currentName)) {
      const cleanKey = normalizeUsernameKey(currentName);
      if (cleanKey) usedKeys.add(cleanKey);
    }
  }

  const changes: LegacyModerationChange[] = [];
  const nextRecords: T[] = records.map((rec) => {
    const currentName = String(rec.profile?.name || rec.username || '').trim();
    if (!isLegacyFlaggedUsername(currentName)) {
      return rec;
    }

    const reason = classifyLegacyReason(currentName);
    const allocated = allocateTemporaryPlayerName(rec.accountId || currentName, usedKeys);
    changes.push({
      accountId: rec.accountId,
      oldName: currentName,
      newName: allocated.name,
      newKey: allocated.key,
      reason,
    });

    if (dryRun) {
      return rec;
    }

    // Preserve ALL progression, coins, league points, stats, purchases, recoveryCode, accountId, googleUid, avatar, club
    return {
      ...rec,
      username: allocated.name,
      usernameKey: allocated.key,
      profile: {
        ...rec.profile,
        name: allocated.name,
      },
      updatedAt: now,
    };
  });

  return {
    dryRun,
    totalScanned: records.length,
    flaggedCount: changes.length,
    migratedCount: dryRun ? 0 : changes.length,
    unchangedCount: records.length - changes.length,
    changes,
    records: nextRecords,
  };
}
