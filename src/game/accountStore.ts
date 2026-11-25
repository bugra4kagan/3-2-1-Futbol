import fs from 'node:fs';
import path from 'node:path';
import {
  generateRandomUniqueStarterName,
  generateRecoveryCode,
  generateUniqueUsernameSuggestions,
  isLegacyFlaggedUsername,
  normalizeRecoveryCode,
  normalizeUsernameKey,
  sanitizePublicDisplayName,
  validateUsernameFormat,
} from './accountEngine.js';
import { MinigameType, PlayerProfile, PublicPlayerProfile, UserProgression } from './types.js';
import { purchaseStoreItem } from './retentionEngine.js';
import {
  IAP_ONLY_ITEM_IDS,
  createAccountSessionToken,
  generateAccountAuthSecret,
  sanitizeProgressionUpdate,
  verifyAccountSessionToken,
} from './serverSecurity.js';

const EMPTY_MINIGAME_COUNTS: Record<MinigameType, number> = {
  two_clubs: 0,
  silhouette: 0,
  xox: 0,
  career: 0,
  country_club: 0,
};

export function buildPublicProfileFromRecord(
  rec: PersistentAccountRecord
): PublicPlayerProfile {
  const prog = rec.progression || ({} as Partial<UserProgression>);
  const counts = prog.minigameMatchCounts || ({} as Partial<Record<MinigameType, number>>);
  const rawName = rec.profile?.name || rec.username;
  return {
    id: rec.accountId,
    usernameKey: isLegacyFlaggedUsername(rawName) ? undefined : rec.usernameKey,
    friendCode: prog.friendCode,
    name: sanitizePublicDisplayName(rawName, rec.accountId),
    avatar: rec.profile?.avatar || '⚽',
    favoriteClubId: rec.profile?.favoriteClubId,
    subtitle: prog.equippedTitle,
    equippedCrest: prog.equippedCrest,
    equippedFrame: prog.equippedFrame,
    equippedBadge: prog.equippedBadge,
    hasCrown: Boolean(prog.unlockedGiftIds?.includes('gift_title_legend')),
    weeklyPoints: Math.max(0, Number(prog.weeklyPoints) || 0),
    totalPoints: Math.max(0, Number(prog.totalPoints) || 0),
    matchesPlayed: Math.max(0, Number(prog.matchesPlayed) || 0),
    wins: Math.max(0, Number(prog.wins) || 0),
    losses: Math.max(0, Number(prog.losses) || 0),
    winStreak: Math.max(0, Number(prog.winStreak) || 0),
    bestWinStreak: Math.max(0, Number(prog.bestWinStreak) || 0),
    totalCorrectAnswers: Math.max(0, Number(prog.totalCorrectAnswers) || 0),
    totalWrongAttempts: Math.max(0, Number(prog.totalWrongAttempts) || 0),
    fastestAnswerSec:
      typeof prog.fastestAnswerSec === 'number' && Number.isFinite(prog.fastestAnswerSec)
        ? prog.fastestAnswerSec
        : null,
    clutchAnswers: Math.max(0, Number(prog.clutchAnswers) || 0),
    minigameMatchCounts: {
      ...EMPTY_MINIGAME_COUNTS,
      two_clubs: Math.max(0, Number(counts.two_clubs) || 0),
      silhouette: Math.max(0, Number(counts.silhouette) || 0),
      xox: Math.max(0, Number(counts.xox) || 0),
      career: Math.max(0, Number(counts.career) || 0),
      country_club: Math.max(0, Number(counts.country_club) || 0),
    },
    dailyStreakDays: Math.max(0, Number(prog.dailyLogin?.streakDays) || 0),
    tournamentWins: Math.max(0, Number(prog.tournamentWins) || 0),
    tournamentsPlayed: Math.max(0, Number(prog.tournamentsPlayed) || 0),
    updatedAt: rec.updatedAt || Date.now(),
  };
}

export interface VerifiedPurchaseRecord {
  productId: string;
  itemId: string;
  purchaseToken: string;
  orderId?: string;
  verifiedAt: number;
  source: 'google_play' | 'legacy_migration';
}

export interface PersistentAccountRecord {
  accountId: string;
  username: string;
  usernameKey: string;
  recoveryCode: string;
  sessionSecret?: string;
  googleUid?: string;
  verifiedPurchases?: VerifiedPurchaseRecord[];
  profile: PlayerProfile;
  progression: UserProgression;
  createdAt: number;
  updatedAt: number;
}

export interface UsernameCheckResponse {
  ok: boolean;
  available: boolean;
  cleanedDisplay: string;
  usernameKey: string;
  reason?: string;
  suggestions?: string[];
}

export class AccountStore {
  private readonly filePath: string | null;
  private readonly byId = new Map<string, PersistentAccountRecord>();
  private readonly byUsernameKey = new Map<string, PersistentAccountRecord>();
  private readonly byRecoveryCode = new Map<string, PersistentAccountRecord>();
  private readonly byGoogleUid = new Map<string, PersistentAccountRecord>();

  constructor(filePath: string | null = path.resolve(process.cwd(), '.data', 'accounts.json')) {
    this.filePath = filePath;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!this.filePath) return;
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const item of parsed) {
        if (
          item &&
          typeof item.accountId === 'string' &&
          typeof item.usernameKey === 'string' &&
          typeof item.recoveryCode === 'string' &&
          item.profile &&
          item.progression
        ) {
          this.indexRecord(item as PersistentAccountRecord);
        }
      }
    } catch (err) {
      console.warn('Could not load persisted accounts file:', err);
    }
  }

  private indexRecord(rec: PersistentAccountRecord): void {
    this.byId.set(rec.accountId, rec);
    this.byUsernameKey.set(rec.usernameKey, rec);
    this.byRecoveryCode.set(normalizeRecoveryCode(rec.recoveryCode), rec);
    if (rec.googleUid) {
      this.byGoogleUid.set(rec.googleUid, rec);
    }
  }

  private saveToDisk(): void {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      fs.mkdirSync(dir, { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      const payload = JSON.stringify(Array.from(this.byId.values()), null, 2);
      fs.writeFileSync(tmp, payload, 'utf8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.warn('Could not persist accounts file:', err);
    }
  }

  public getTakenKeysSet(): Set<string> {
    return new Set(this.byUsernameKey.keys());
  }

  public suggestRandomStarterName(): string {
    return generateRandomUniqueStarterName(this.getTakenKeysSet());
  }

  public checkUsername(
    rawName: string,
    requesterAccountId?: string,
    requesterGoogleUid?: string
  ): UsernameCheckResponse {
    const fmt = validateUsernameFormat(rawName);
    if (!fmt.ok) {
      const flagged = isLegacyFlaggedUsername(rawName);
      return {
        ok: false,
        available: false,
        cleanedDisplay: fmt.cleanedDisplay,
        usernameKey: fmt.key,
        reason: fmt.reason,
        suggestions:
          !flagged && fmt.cleanedDisplay.length >= 2
            ? generateUniqueUsernameSuggestions(fmt.cleanedDisplay, this.getTakenKeysSet(), 3)
            : undefined,
      };
    }

    const existing = this.byUsernameKey.get(fmt.key);
    if (
      existing &&
      existing.accountId !== requesterAccountId &&
      (!requesterGoogleUid || existing.googleUid !== requesterGoogleUid)
    ) {
      return {
        ok: true,
        available: false,
        cleanedDisplay: fmt.cleanedDisplay,
        usernameKey: fmt.key,
        reason: `"${fmt.cleanedDisplay}" kullanıcı adı zaten kullanılıyor. Başka bir ad seç!`,
        suggestions: generateUniqueUsernameSuggestions(
          fmt.cleanedDisplay,
          this.getTakenKeysSet(),
          3
        ),
      };
    }

    return {
      ok: true,
      available: true,
      cleanedDisplay: fmt.cleanedDisplay,
      usernameKey: fmt.key,
    };
  }

  public registerOrUpdate(params: {
    accountId: string;
    profile: PlayerProfile;
    progression: UserProgression;
    googleUid?: string;
  }):
    | { ok: true; account: PersistentAccountRecord }
    | { ok: false; status: number; reason: string; suggestions?: string[] } {
    const cleanId = String(params.accountId || '').trim().slice(0, 64);
    if (!cleanId) {
      return { ok: false, status: 400, reason: 'Geçersiz hesap kimliği.' };
    }

    const check = this.checkUsername(params.profile.name, cleanId, params.googleUid);
    if (!check.ok || !check.available) {
      return {
        ok: false,
        status: check.ok ? 409 : 400,
        reason: check.reason || 'Bu kullanıcı adı kullanılamıyor.',
        suggestions: check.suggestions,
      };
    }

    const existing = this.byId.get(cleanId);
    if (existing && existing.usernameKey !== check.usernameKey) {
      this.byUsernameKey.delete(existing.usernameKey);
    }

    let recoveryCode = existing?.recoveryCode;
    if (!recoveryCode) {
      do {
        recoveryCode = generateRecoveryCode();
      } while (this.byRecoveryCode.has(normalizeRecoveryCode(recoveryCode)));
    }

    const now = Date.now();
    const cleanedProfile: PlayerProfile = {
      ...params.profile,
      id: cleanId,
      name: check.cleanedDisplay,
    };

    let sessionSecret = existing?.sessionSecret;
    if (!sessionSecret) {
      sessionSecret = generateAccountAuthSecret();
    }

    const sanitizedProg = sanitizeProgressionUpdate(existing?.progression, params.progression);

    const record: PersistentAccountRecord = {
      accountId: cleanId,
      username: check.cleanedDisplay,
      usernameKey: check.usernameKey,
      recoveryCode,
      sessionSecret,
      googleUid: params.googleUid || existing?.googleUid,
      profile: cleanedProfile,
      progression: sanitizedProg,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.indexRecord(record);
    this.saveToDisk();
    return { ok: true, account: record };
  }

  public syncProgression(params: {
    accountId: string;
    profile?: Partial<PlayerProfile>;
    progression: UserProgression;
    googleUid?: string;
    strictActionVerification?: boolean;
  }): { ok: boolean; account?: PersistentAccountRecord } {
    const cleanId = String(params.accountId || '').trim().slice(0, 64);
    if (!cleanId) return { ok: false };

    const existing = this.byId.get(cleanId);
    if (!existing) {
      if (params.profile?.name) {
        const fmt = validateUsernameFormat(params.profile.name);
        if (fmt.ok) {
          const check = this.checkUsername(fmt.cleanedDisplay, cleanId, params.googleUid);
          if (check.available) {
            const reg = this.registerOrUpdate({
              accountId: cleanId,
              profile: {
                id: cleanId,
                name: fmt.cleanedDisplay,
                avatar: params.profile.avatar || '⚽',
                score: 0,
                favoriteClubId: params.profile.favoriteClubId,
                accountStats: params.profile.accountStats,
              },
              progression: params.progression,
              googleUid: params.googleUid,
            });
            if (reg.ok) return { ok: true, account: reg.account };
          }
        }
      }
      return { ok: false };
    }

    const nextProfile: PlayerProfile = {
      ...existing.profile,
      avatar: params.profile?.avatar || existing.profile.avatar,
      favoriteClubId: params.profile?.favoriteClubId || existing.profile.favoriteClubId,
      accountStats: params.profile?.accountStats || existing.profile.accountStats,
    };

    const updated: PersistentAccountRecord = {
      ...existing,
      sessionSecret: existing.sessionSecret || generateAccountAuthSecret(),
      googleUid: params.googleUid || existing.googleUid,
      profile: nextProfile,
      progression: sanitizeProgressionUpdate(existing.progression, params.progression, {
        strictActionVerification: Boolean(params.strictActionVerification),
      }),
      updatedAt: Date.now(),
    };

    this.indexRecord(updated);
    this.saveToDisk();
    return { ok: true, account: updated };
  }

  public recoverByCode(
    rawCode: string,
    rawUsername?: string
  ): { ok: true; account: PersistentAccountRecord } | { ok: false; reason: string } {
    const code = normalizeRecoveryCode(rawCode);
    if (!code) {
      return { ok: false, reason: 'Lütfen hesap kurtarma kodunu gir.' };
    }
    const found = this.byRecoveryCode.get(code);
    if (!found) {
      return { ok: false, reason: 'Bu kurtarma koduyla eşleşen bir hesap bulunamadı.' };
    }
    if (rawUsername && rawUsername.trim().length > 0) {
      const targetKey = normalizeUsernameKey(rawUsername);
      if (targetKey && targetKey !== found.usernameKey) {
        return { ok: false, reason: 'Kullanıcı adı ile kurtarma kodu eşleşmiyor.' };
      }
    }
    return { ok: true, account: found };
  }

  public getByAccountId(accountId: string): PersistentAccountRecord | null {
    return this.byId.get(accountId) || null;
  }

  public issueSessionTokenForAccount(rec: PersistentAccountRecord): string {
    if (!rec.sessionSecret) {
      rec.sessionSecret = generateAccountAuthSecret();
      this.indexRecord(rec);
      this.saveToDisk();
    }
    return createAccountSessionToken(rec.accountId, rec.sessionSecret);
  }

  public verifyAccountSession(accountId: string, providedToken: string | undefined | null): boolean {
    const rec = this.byId.get(String(accountId || '').trim());
    if (!rec) return false;
    return verifyAccountSessionToken(rec.accountId, providedToken, rec.sessionSecret);
  }

  public deleteByAccountId(accountId: string): boolean {
    const existing = this.byId.get(accountId);
    if (!existing) return false;
    this.byId.delete(accountId);
    this.byUsernameKey.delete(existing.usernameKey);
    this.byRecoveryCode.delete(normalizeRecoveryCode(existing.recoveryCode));
    if (existing.googleUid) {
      this.byGoogleUid.delete(existing.googleUid);
    }
    this.saveToDisk();
    return true;
  }

  public hasPurchaseToken(purchaseToken: string): boolean {
    const cleanToken = String(purchaseToken || '').trim();
    if (!cleanToken) return false;
    for (const rec of this.byId.values()) {
      if ((rec.verifiedPurchases || []).some((p) => p.purchaseToken === cleanToken)) {
        return true;
      }
    }
    return false;
  }

  public applyVerifiedPurchase(params: {
    accountId: string;
    itemId: string;
    productId: string;
    purchaseToken: string;
    orderId?: string;
    coinGrant?: number;
    grantAdFree?: boolean;
    vipFrame?: boolean;
  }): { ok: boolean; alreadyCredited?: boolean; account?: PersistentAccountRecord } {
    const cleanId = String(params.accountId || '').trim().slice(0, 64);
    const cleanToken = String(params.purchaseToken || '').trim();
    if (!cleanId || !cleanToken) return { ok: false };

    const existing = this.byId.get(cleanId);
    if (!existing) return { ok: false };

    const priorPurchases = existing.verifiedPurchases || [];
    if (priorPurchases.some((p) => p.purchaseToken === cleanToken)) {
      return { ok: true, alreadyCredited: true, account: existing };
    }

    // Replayed token across another account is strictly rejected
    if (this.hasPurchaseToken(cleanToken)) {
      return { ok: false };
    }

    const coinDelta = Math.max(0, Math.min(25_000, Math.round(Number(params.coinGrant) || 0)));
    const unlockedSet = new Set(existing.progression.unlockedGiftIds || []);
    unlockedSet.add(params.itemId);
    if (params.vipFrame) {
      unlockedSet.add('store_ad_free');
    }

    const nextProg = sanitizeProgressionUpdate(
      existing.progression,
      {
        ...existing.progression,
        coins: existing.progression.coins + coinDelta,
        adFree: Boolean(existing.progression.adFree || params.grantAdFree),
        equippedFrame: params.vipFrame ? 'vip' : existing.progression.equippedFrame,
        unlockedGiftIds: Array.from(unlockedSet),
      },
      {
        allowVerifiedIapGrant: Boolean(params.grantAdFree),
        verifiedCoinCredit: coinDelta,
      }
    );

    const updated: PersistentAccountRecord = {
      ...existing,
      verifiedPurchases: [
        ...priorPurchases,
        {
          productId: params.productId,
          itemId: params.itemId,
          purchaseToken: cleanToken,
          orderId: params.orderId,
          verifiedAt: Date.now(),
          source: 'google_play',
        },
      ],
      progression: nextProg,
      updatedAt: Date.now(),
    };
    this.indexRecord(updated);
    this.saveToDisk();
    return { ok: true, alreadyCredited: false, account: updated };
  }

  /**
   * Sunucu tarafından doğrulanmış maç sonucunu doğrudan sunucu kaydına işler.
   * İstemcinin gönderdiği matchesPlayed veya keyfi puan artışlarına asla dayanmaz.
   */
  public recordVerifiedMatchReward(params: {
    accountId: string;
    coinsAwarded: number;
    pointsAwarded: number;
    won: boolean;
  }): { ok: boolean; account?: PersistentAccountRecord } {
    const cleanId = String(params.accountId || '').trim().slice(0, 64);
    const existing = this.byId.get(cleanId);
    if (!existing) return { ok: false };

    const coinCredit = Math.max(0, Math.round(params.coinsAwarded));
    const pointCredit = Math.max(0, Math.round(params.pointsAwarded));
    const prev = existing.progression;
    const nextMultMatches =
      !prev.permanentMultiplier2x && (prev.multiplier2xMatches ?? 0) > 0
        ? (prev.multiplier2xMatches ?? 1) - 1
        : prev.multiplier2xMatches;

    const nextProg = sanitizeProgressionUpdate(
      prev,
      {
        ...prev,
        coins: prev.coins + coinCredit,
        weeklyPoints: prev.weeklyPoints + pointCredit,
        totalPoints: prev.totalPoints + pointCredit,
        matchesPlayed: (prev.matchesPlayed ?? 0) + 1,
        wins: (prev.wins ?? 0) + (params.won ? 1 : 0),
        losses: (prev.losses ?? 0) + (params.won ? 0 : 1),
        multiplier2xMatches: nextMultMatches,
      },
      {
        strictActionVerification: true,
        verifiedCoinCredit: coinCredit,
        verifiedPointCredit: pointCredit,
      }
    );

    const updated: PersistentAccountRecord = {
      ...existing,
      progression: nextProg,
      updatedAt: Date.now(),
    };
    this.indexRecord(updated);
    this.saveToDisk();
    return { ok: true, account: updated };
  }

  /**
   * Coin karşılığı mağaza harcamalarını sunucu bakiyesinden düşer.
   * IAP-özel ürünler (store_ad_free vb.) coin ile alınamaz.
   */
  public spendCoinsForItem(params: {
    accountId: string;
    itemId: string;
  }): { ok: boolean; reason?: string; account?: PersistentAccountRecord } {
    const cleanId = String(params.accountId || '').trim().slice(0, 64);
    const cleanItemId = String(params.itemId || '').trim();
    const existing = this.byId.get(cleanId);
    if (!existing) return { ok: false, reason: 'Hesap kaydı bulunamadı.' };
    if (IAP_ONLY_ITEM_IDS.has(cleanItemId)) {
      return { ok: false, reason: 'Bu ürün yalnızca doğrulanmış mağaza ödemesi ile açılabilir.' };
    }

    const res = purchaseStoreItem(existing.progression, cleanItemId, 'coins');
    if (!res.ok) {
      return { ok: false, reason: res.reason };
    }

    const updated: PersistentAccountRecord = {
      ...existing,
      progression: sanitizeProgressionUpdate(existing.progression, res.progression, {
        strictActionVerification: true,
      }),
      updatedAt: Date.now(),
    };
    this.indexRecord(updated);
    this.saveToDisk();
    return { ok: true, account: updated };
  }

  public getByGoogleUid(googleUid: string): PersistentAccountRecord | null {
    return this.byGoogleUid.get(googleUid) || null;
  }

  public listAll(): PersistentAccountRecord[] {
    return Array.from(this.byId.values());
  }

  public findPublicProfile(identifier: string): PublicPlayerProfile | null {
    const clean = String(identifier || '').trim();
    if (!clean) return null;

    const byIdMatch = this.byId.get(clean);
    if (byIdMatch) return buildPublicProfileFromRecord(byIdMatch);

    const key = normalizeUsernameKey(clean);
    if (key) {
      const byKeyMatch = this.byUsernameKey.get(key);
      if (byKeyMatch) return buildPublicProfileFromRecord(byKeyMatch);
    }

    const upperCode = clean.toUpperCase();
    for (const rec of this.byId.values()) {
      if (rec.progression?.friendCode?.toUpperCase() === upperCode) {
        return buildPublicProfileFromRecord(rec);
      }
      if (rec.username.toLowerCase() === clean.toLowerCase()) {
        return buildPublicProfileFromRecord(rec);
      }
    }
    return null;
  }

  public searchPublicProfiles(query: string, limit = 20): PublicPlayerProfile[] {
    const clean = String(query || '').trim();
    const normQuery = normalizeUsernameKey(clean);
    const lowerQuery = clean.toLowerCase();
    const maxItems = Math.max(1, Math.min(50, Math.round(limit)));

    const matched: PublicPlayerProfile[] = [];
    for (const rec of this.byId.values()) {
      if (!clean) {
        matched.push(buildPublicProfileFromRecord(rec));
        continue;
      }
      const code = (rec.progression?.friendCode || '').toLowerCase();
      const nameLower = rec.username.toLowerCase();
      if (
        nameLower.includes(lowerQuery) ||
        (normQuery.length > 0 && rec.usernameKey.includes(normQuery)) ||
        code.includes(lowerQuery) ||
        rec.accountId.toLowerCase() === lowerQuery
      ) {
        matched.push(buildPublicProfileFromRecord(rec));
      }
    }

    matched.sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.totalPoints - a.totalPoints);
    return matched.slice(0, maxItems);
  }
}
