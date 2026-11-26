import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROSTER_DATA_VERSION } from './rosterVersion';

export const SPARK_BACKUP_SCHEMA_VERSION = '2026.11.26-spark-v1';
export const FIREBASE_AUTH_BACKUP_SCHEMA_VERSION = '2026.11.26-auth-v1';
export const ENCRYPTED_BACKUP_FORMAT_VERSION = '321futbol-aes256gcm-v1';
export const MIN_BACKUP_PASSPHRASE_LENGTH = 12;

/**
 * Gerçek Firestore koleksiyonları (src/game/firebaseAdminService.ts ve firestore.rules ile %100 uyumlu).
 * Geçici `rooms` ve `matchmaking` koleksiyonları aktif maç kuyruğu olduğu için kalıcı yedeğe dahil edilmez.
 */
export const SPARK_BACKUP_FIRESTORE_COLLECTIONS = [
  'backend_accounts',
  'backend_purchases',
  'backend_match_sessions',
  'backend_reward_claims',
  'users',
  'usernames',
  'publicProfiles',
  'userReports',
] as const;

export type SparkBackupCollectionName = (typeof SPARK_BACKUP_FIRESTORE_COLLECTIONS)[number];

export const SPARK_BACKUP_RTDB_PATHS = ['leaderboard'] as const;
export type SparkBackupRtdbPath = (typeof SPARK_BACKUP_RTDB_PATHS)[number];

/**
 * Yedekleme aracının tam kapsam ve kapsam dışı envanteri (şeffaf denetim ve felaket kurtarma için).
 */
export const SPARK_BACKUP_COVERAGE_METADATA = {
  includedFirestoreCollections: [...SPARK_BACKUP_FIRESTORE_COLLECTIONS],
  includedRtdbPaths: [...SPARK_BACKUP_RTDB_PATHS],
  includedLiveSecurityRules: ['firebase_live:firestore.rules', 'firebase_live:database.rules.json'],
  includedCandidateRepoSecurityRules: ['git_candidate:firestore.rules', 'git_candidate:database.rules.json'],
  separateAuthBackupArtifacts: [
    'backups/firebase-auth-backup-<ts>.json.enc (Admin SDK listUsers metadata/provider yedeği, AES-256-GCM şifreli)',
    'firebase auth:export backups/auth-users.json --format=json (Firebase CLI ile parola özetleri dahil tam Auth yedeği, ardından AES-256-GCM şifrelenmeli)',
  ],
  excludedEphemeralCollections: ['rooms'],
  excludedEphemeralSubcollections: ['matchmaking/{minigameType}/queue'],
  excludedExternalSystems: [
    'Firebase Console proje ayarları ve özel indeks tanımları (Spark planı sorguları özel bileşik indeks gerektirmeyecek şekilde tasarlanmıştır)',
    'Sunucu gizli ortam değişkenleri (`FIREBASE_SERVICE_ACCOUNT_JSON`, `SESSION_SECRET`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — güvenlik gereği asla yedeğe dahil edilmez)',
  ],
} as const;

export interface SecurityRulesBackupSnapshot {
  source?: 'git_candidate';
  firestoreRules: string;
  firestoreRulesSha256: string;
  databaseRulesJson: string;
  databaseRulesSha256: string;
}

export interface LiveSecurityRulesBackupSnapshot {
  source: 'firebase_live';
  fetchedAtIso: string;
  firestoreRulesetName: string | null;
  firestoreRules: string | null;
  firestoreRulesSha256: string | null;
  databaseRulesJson: string | null;
  databaseRulesSha256: string | null;
}

export interface EncryptedBackupEnvelope {
  format: typeof ENCRYPTED_BACKUP_FORMAT_VERSION;
  kdf: 'scrypt';
  cipher: 'aes-256-gcm';
  saltHex: string;
  ivHex: string;
  authTagHex: string;
  ciphertextBase64: string;
  encryptedAtIso: string;
}

export interface FirebaseAuthBackupUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  disabled: boolean;
  providerIds: string[];
  creationTime: string | null;
  lastSignInTime: string | null;
}

export interface FirebaseAuthBackupPayload {
  schemaVersion: string;
  createdAtIso: string;
  projectId: string | null;
  users: FirebaseAuthBackupUser[];
}

export interface FirebaseAuthBackupSnapshot extends FirebaseAuthBackupPayload {
  userCount: number;
  checksumSha256: string;
}

export interface BackupAuthLike {
  listUsers(
    maxResults?: number,
    pageToken?: string
  ): Promise<{
    users: Array<{
      uid: string;
      email?: string;
      emailVerified?: boolean;
      displayName?: string;
      disabled?: boolean;
      providerData?: Array<{ providerId?: string }>;
      metadata?: { creationTime?: string; lastSignInTime?: string };
    }>;
    pageToken?: string;
  }>;
}

export interface BackupLiveSecurityRulesApiLike {
  getFirestoreRuleset(): Promise<{
    name?: string;
    source?: Array<{ name?: string; content?: string }>;
  }>;
}

export interface BackupLiveRtdbRulesApiLike {
  getRules(): Promise<string>;
}

export interface FirebaseSparkBackupDocument {
  id: string;
  data: Record<string, unknown>;
}

export interface FirebaseSparkBackupPayload {
  schemaVersion: string;
  createdAtIso: string;
  rosterVersion: string;
  projectId: string | null;
  collections: Record<SparkBackupCollectionName, FirebaseSparkBackupDocument[]>;
  rtdb: Record<SparkBackupRtdbPath, Record<string, unknown> | null>;
  securityRules?: SecurityRulesBackupSnapshot | null;
  liveSecurityRules?: LiveSecurityRulesBackupSnapshot | null;
}

export interface FirebaseSparkBackupSnapshot extends FirebaseSparkBackupPayload {
  checksumSha256: string;
  counts: {
    firestore: Record<SparkBackupCollectionName, number>;
    rtdb: Record<SparkBackupRtdbPath, number>;
    totalDocuments: number;
  };
}

export interface BackupFirestoreDocLike {
  id: string;
  data(): Record<string, unknown> | undefined;
}

export interface BackupFirestoreCollectionLike {
  get(): Promise<{ docs: BackupFirestoreDocLike[] }>;
  doc(id: string): {
    set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
  };
}

export interface BackupFirestoreLike {
  collection(name: string): BackupFirestoreCollectionLike;
}

export interface BackupRtdbRefLike {
  once(eventType: 'value'): Promise<{ val(): unknown }>;
  set(value: unknown): Promise<unknown>;
}

export interface BackupRtdbLike {
  ref(path: string): BackupRtdbRefLike;
}

export interface LegacyReconciliationResult {
  trustedSource: 'backend_accounts' | 'legacy_sanitized';
  coins: number;
  weeklyPoints: number;
  totalPoints: number;
  adFree: boolean;
  permanentMultiplier2x: boolean;
  unlockedGiftIds: string[];
  anomalies: string[];
}

export interface RestoreSparkBackupOptions {
  dryRun?: boolean;
  includeLegacyUsersMirror?: boolean;
  reconcileLegacyUsersWithAuthoritativeAccounts?: boolean;
  deletedAccountHashes?: ReadonlySet<string>;
  timestampFactory?: (iso: string) => unknown;
}

export interface RestoreSparkBackupReport {
  ok: boolean;
  dryRun: boolean;
  error?: string;
  checksumVerified: boolean;
  restoredFirestoreCounts: Record<SparkBackupCollectionName, number>;
  restoredRtdbCounts: Record<SparkBackupRtdbPath, number>;
  skippedDeletedAccountsCount?: number;
  legacyAnomalies: Array<{ docId: string; anomalies: string[] }>;
}

export function hashDeletedAccountIdentityForRestore(rawId: string): string {
  return crypto
    .createHash('sha256')
    .update(`deleted_account_v1:${String(rawId || '').trim()}`)
    .digest('hex');
}

const PREMIUM_ENTITLEMENT_GIFTS = new Set([
  'store_ad_free',
  'bundle_vip_adfree_frame',
  'store_multiplier_2x',
]);

const SECRET_LEAK_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /"private_key"\s*:/i,
  /FIREBASE_SERVICE_ACCOUNT_JSON/i,
  /GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/i,
];

function isFirestoreTimestampLike(val: unknown): val is { toDate: () => Date } {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    typeof (val as { toDate?: unknown }).toDate === 'function'
  );
}

/**
 * Firestore dokümanlarını JSON-güvenli, deterministik biçime dönüştürür (Timestamp -> ISO marker).
 */
export function serializeBackupValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) {
    return { __backupType: 'timestamp', iso: value.toISOString() };
  }
  if (isFirestoreTimestampLike(value)) {
    const dt = value.toDate();
    return {
      __backupType: 'timestamp',
      iso: Number.isNaN(dt.getTime()) ? new Date(0).toISOString() : dt.toISOString(),
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeBackupValue(item));
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const sortedKeys = Object.keys(src).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      if (src[k] === undefined) continue;
      out[k] = serializeBackupValue(src[k]);
    }
    return out;
  }
  return String(value);
}

/**
 * JSON yedekten Firestore geri yükleme değerlerini çözer.
 */
export function deserializeBackupValue(
  value: unknown,
  timestampFactory: (iso: string) => unknown = (iso) => new Date(iso)
): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deserializeBackupValue(item, timestampFactory));
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (rec.__backupType === 'timestamp' && typeof rec.iso === 'string') {
      return timestampFactory(rec.iso);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (v === undefined) continue;
      out[k] = deserializeBackupValue(v, timestampFactory);
    }
    return out;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(serializeBackupValue(value));
}

export function computeBackupChecksum(payload: FirebaseSparkBackupPayload): string {
  return crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

/**
 * Yedek dosyasında yanlışlıkla servis hesabı özel anahtarı veya gizli ortam değişkeni olmadığını doğrular.
 */
export function assertNoSecretMaterialInBackup(snapshotOrText: unknown): { ok: boolean; reason?: string } {
  const serialized =
    typeof snapshotOrText === 'string' ? snapshotOrText : JSON.stringify(snapshotOrText);
  for (const pattern of SECRET_LEAK_PATTERNS) {
    if (pattern.test(serialized)) {
      return {
        ok: false,
        reason: `Yedek iceriginde yasakli gizli anahtar kalibi tespit edildi (${pattern.source}).`,
      };
    }
  }
  return { ok: true };
}

/**
 * Istemci tarafindan yazilabilmis olabilecek eski `users/{uid}` dokumanini,
 * sunucu otoriteli `backend_accounts` ve `backend_purchases` kayitlariyla uzlastirir.
 * Sunucu dogrulamasi olmayan coin, adFree veya 2x carpani asla koru korune yetkili kabul edilmez.
 */
export function reconcileLegacyUserWithAuthoritativeAccount(params: {
  legacyUserDoc: Record<string, unknown>;
  authoritativeAccount: Record<string, unknown> | null;
  verifiedPurchasesForAccount: Array<Record<string, unknown>>;
}): LegacyReconciliationResult {
  const anomalies: string[] = [];
  const legacyCoins = Math.max(0, Math.floor(Number(params.legacyUserDoc.coins) || 0));
  const legacyWeekly = Math.max(0, Math.floor(Number(params.legacyUserDoc.weeklyPoints) || 0));
  const legacyTotal = Math.max(0, Math.floor(Number(params.legacyUserDoc.totalPoints) || 0));
  const legacyAdFree = Boolean(params.legacyUserDoc.adFree);
  const legacyMult2x = Boolean(params.legacyUserDoc.permanentMultiplier2x);
  const legacyGifts = Array.isArray(params.legacyUserDoc.unlockedGiftIds)
    ? params.legacyUserDoc.unlockedGiftIds.filter((x): x is string => typeof x === 'string')
    : [];

  if (params.authoritativeAccount) {
    const authProg =
      params.authoritativeAccount.progression &&
      typeof params.authoritativeAccount.progression === 'object'
        ? (params.authoritativeAccount.progression as Record<string, unknown>)
        : {};
    const authCoins = Math.max(0, Math.floor(Number(authProg.coins) || 0));
    const authWeekly = Math.max(0, Math.floor(Number(authProg.weeklyPoints) || 0));
    const authTotal = Math.max(0, Math.floor(Number(authProg.totalPoints) || 0));
    const authAdFree = Boolean(authProg.adFree);
    const authMult2x = Boolean(authProg.permanentMultiplier2x);
    const authGifts = Array.isArray(authProg.unlockedGiftIds)
      ? authProg.unlockedGiftIds.filter((x): x is string => typeof x === 'string')
      : [];

    if (legacyCoins !== authCoins) {
      anomalies.push(`legacy_coins_mismatch:${legacyCoins}->${authCoins}`);
    }
    if (legacyWeekly !== authWeekly) {
      anomalies.push(`legacy_weeklyPoints_mismatch:${legacyWeekly}->${authWeekly}`);
    }
    if (legacyTotal !== authTotal) {
      anomalies.push(`legacy_totalPoints_mismatch:${legacyTotal}->${authTotal}`);
    }
    if (legacyAdFree !== authAdFree) {
      anomalies.push(`legacy_adFree_mismatch:${String(legacyAdFree)}->${String(authAdFree)}`);
    }
    if (legacyMult2x !== authMult2x) {
      anomalies.push(`legacy_multiplier2x_mismatch:${String(legacyMult2x)}->${String(authMult2x)}`);
    }

    return {
      trustedSource: 'backend_accounts',
      coins: authCoins,
      weeklyPoints: authWeekly,
      totalPoints: authTotal,
      adFree: authAdFree,
      permanentMultiplier2x: authMult2x,
      unlockedGiftIds: authGifts,
      anomalies,
    };
  }

  // Yetkili backend_accounts kaydi olmayan eski 1.0.x dokumani:
  // Premium haklar yalnizca backend_purchases icinde dogrulanmis satin alma varsa korunur.
  const purchasedItemIds = new Set(
    params.verifiedPurchasesForAccount
      .map((p) => (typeof p.itemId === 'string' ? p.itemId : ''))
      .filter(Boolean)
  );
  const purchasedProductIds = new Set(
    params.verifiedPurchasesForAccount
      .map((p) => (typeof p.productId === 'string' ? p.productId : ''))
      .filter(Boolean)
  );

  const hasVerifiedAdFree =
    purchasedItemIds.has('store_ad_free') ||
    purchasedItemIds.has('bundle_vip_adfree_frame') ||
    purchasedProductIds.has('futbol_remove_ads') ||
    purchasedProductIds.has('futbol_vip_bundle');
  const hasVerifiedMult2x =
    purchasedItemIds.has('store_multiplier_2x') ||
    purchasedProductIds.has('futbol_multiplier_2x');

  const safeAdFree = legacyAdFree && hasVerifiedAdFree;
  const safeMult2x = legacyMult2x && hasVerifiedMult2x;
  if (legacyAdFree && !hasVerifiedAdFree) {
    anomalies.push('unverified_legacy_adFree_stripped');
  }
  if (legacyMult2x && !hasVerifiedMult2x) {
    anomalies.push('unverified_legacy_multiplier2x_stripped');
  }

  const safeGifts = legacyGifts.filter((giftId) => {
    if (!PREMIUM_ENTITLEMENT_GIFTS.has(giftId)) return true;
    const ok = purchasedItemIds.has(giftId);
    if (!ok) anomalies.push(`unverified_legacy_gift_stripped:${giftId}`);
    return ok;
  });

  // Sunucu otoritesi olmayan legacy coin/puan degerleri koru korune yuksek kabul edilmez;
  // baslangic ust sinirinin uzerindeyse anomali olarak raporlanir ve baslangic sinirina cekilir.
  const safeCoins = Math.min(legacyCoins, 250);
  if (legacyCoins > 250) {
    anomalies.push(`unverified_legacy_coins_capped:${legacyCoins}->250`);
  }
  const safeWeekly = 0;
  if (legacyWeekly > 0) {
    anomalies.push(`unverified_legacy_weeklyPoints_zeroed:${legacyWeekly}->0`);
  }
  const safeTotal = 0;
  if (legacyTotal > 0) {
    anomalies.push(`unverified_legacy_totalPoints_zeroed:${legacyTotal}->0`);
  }

  return {
    trustedSource: 'legacy_sanitized',
    coins: safeCoins,
    weeklyPoints: safeWeekly,
    totalPoints: safeTotal,
    adFree: safeAdFree,
    permanentMultiplier2x: safeMult2x,
    unlockedGiftIds: safeGifts,
    anomalies,
  };
}

export function sha256Text(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Mevcut `firestore.rules` ve `database.rules.json` güvenlik kurallarının SHA-256 doğrulamalı kopyasını alır.
 */
export function captureSecurityRulesSnapshot(
  repoDir: string = process.cwd()
): SecurityRulesBackupSnapshot {
  const firestorePath = path.resolve(repoDir, 'firestore.rules');
  const databasePath = path.resolve(repoDir, 'database.rules.json');
  const firestoreRules = fs.readFileSync(firestorePath, 'utf8');
  const databaseRulesJson = fs.readFileSync(databasePath, 'utf8');
  return {
    source: 'git_candidate',
    firestoreRules,
    firestoreRulesSha256: sha256Text(firestoreRules),
    databaseRulesJson,
    databaseRulesSha256: sha256Text(databaseRulesJson),
  };
}

/**
 * Canlı Firebase projesinde şu an YAYINDA OLAN Firestore ve RTDB güvenlik kurallarını
 * Git'teki aday kurallarla karıştırmadan ayrı olarak yedekler (Spark planı + Admin SDK).
 */
export async function fetchLiveSecurityRulesBackup(params: {
  securityRulesApi?: BackupLiveSecurityRulesApiLike | null;
  rtdbRulesApi?: BackupLiveRtdbRulesApiLike | null;
  now?: Date;
}): Promise<LiveSecurityRulesBackupSnapshot> {
  let firestoreRulesetName: string | null = null;
  let firestoreRules: string | null = null;
  let databaseRulesJson: string | null = null;

  if (params.securityRulesApi) {
    const ruleset = await params.securityRulesApi.getFirestoreRuleset();
    firestoreRulesetName = typeof ruleset?.name === 'string' ? ruleset.name : null;
    const primaryFile = Array.isArray(ruleset?.source)
      ? ruleset.source.find((f) => typeof f?.content === 'string')
      : undefined;
    firestoreRules = primaryFile?.content ?? null;
  }

  if (params.rtdbRulesApi) {
    const rawRtdbRules = await params.rtdbRulesApi.getRules();
    databaseRulesJson = typeof rawRtdbRules === 'string' ? rawRtdbRules : null;
  }

  return {
    source: 'firebase_live',
    fetchedAtIso: (params.now || new Date()).toISOString(),
    firestoreRulesetName,
    firestoreRules,
    firestoreRulesSha256: firestoreRules !== null ? sha256Text(firestoreRules) : null,
    databaseRulesJson,
    databaseRulesSha256: databaseRulesJson !== null ? sha256Text(databaseRulesJson) : null,
  };
}

/**
 * Yalnızca canlı Firebase'den yedeklenmiş güvenlik kurallarını (`source: 'firebase_live'`)
 * izole bir dizine geri yazar; Git aday kurallarıyla asla karıştırmaz.
 */
export function restoreLiveSecurityRulesToDirectory(params: {
  snapshot: FirebaseSparkBackupSnapshot;
  targetDir: string;
  dryRun?: boolean;
}): {
  ok: boolean;
  dryRun: boolean;
  error?: string;
  firestoreRulesPath?: string;
  databaseRulesPath?: string;
} {
  const dryRun = params.dryRun ?? false;
  const verify = verifyFirebaseSparkBackup(params.snapshot);
  if (!verify.ok) {
    return { ok: false, dryRun, error: verify.error };
  }
  const live = params.snapshot.liveSecurityRules;
  if (!live || live.source !== 'firebase_live') {
    return {
      ok: false,
      dryRun,
      error: 'Yedek dosyasında canlı Firebase güvenlik kuralları (firebase_live) bulunmuyor.',
    };
  }
  const firestoreRulesPath = path.resolve(params.targetDir, 'live.firestore.rules');
  const databaseRulesPath = path.resolve(params.targetDir, 'live.database.rules.json');
  if (!dryRun) {
    fs.mkdirSync(params.targetDir, { recursive: true });
    if (live.firestoreRules !== null) {
      fs.writeFileSync(firestoreRulesPath, live.firestoreRules, 'utf8');
    }
    if (live.databaseRulesJson !== null) {
      fs.writeFileSync(databaseRulesPath, live.databaseRulesJson, 'utf8');
    }
  }
  return {
    ok: true,
    dryRun,
    firestoreRulesPath: live.firestoreRules !== null ? firestoreRulesPath : undefined,
    databaseRulesPath: live.databaseRulesJson !== null ? databaseRulesPath : undefined,
  };
}

/**
 * Yedek verisini AES-256-GCM + scrypt ile şifreler (yerel gizli saklama için; ücretli servis gerektirmez).
 */
export function encryptBackupPayload(
  payload: unknown,
  passphrase: string,
  now: Date = new Date()
): EncryptedBackupEnvelope {
  const cleanPass = String(passphrase || '');
  if (cleanPass.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
    throw new Error(
      `Yedek şifreleme parolası en az ${MIN_BACKUP_PASSPHRASE_LENGTH} karakter olmalıdır.`
    );
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(cleanPass, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    format: ENCRYPTED_BACKUP_FORMAT_VERSION,
    kdf: 'scrypt',
    cipher: 'aes-256-gcm',
    saltHex: salt.toString('hex'),
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    ciphertextBase64: encrypted.toString('base64'),
    encryptedAtIso: now.toISOString(),
  };
}

export function isEncryptedBackupEnvelope(raw: unknown): raw is EncryptedBackupEnvelope {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Partial<EncryptedBackupEnvelope>;
  return (
    rec.format === ENCRYPTED_BACKUP_FORMAT_VERSION &&
    rec.cipher === 'aes-256-gcm' &&
    typeof rec.saltHex === 'string' &&
    typeof rec.ivHex === 'string' &&
    typeof rec.authTagHex === 'string' &&
    typeof rec.ciphertextBase64 === 'string'
  );
}

/**
 * Şifreli AES-256-GCM yedeği bellekte çözer (diske şifresiz kopya yazmaz).
 */
export function decryptBackupPayload<T = unknown>(
  envelope: EncryptedBackupEnvelope,
  passphrase: string
): { ok: true; data: T } | { ok: false; error: string } {
  if (!isEncryptedBackupEnvelope(envelope)) {
    return { ok: false, error: 'Geçersiz şifreli yedek zarfı.' };
  }
  const cleanPass = String(passphrase || '');
  if (cleanPass.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
    return {
      ok: false,
      error: `Şifre çözme parolası en az ${MIN_BACKUP_PASSPHRASE_LENGTH} karakter olmalıdır.`,
    };
  }
  try {
    const salt = Buffer.from(envelope.saltHex, 'hex');
    const iv = Buffer.from(envelope.ivHex, 'hex');
    const authTag = Buffer.from(envelope.authTagHex, 'hex');
    const ciphertext = Buffer.from(envelope.ciphertextBase64, 'base64');
    const key = crypto.scryptSync(cleanPass, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return { ok: true, data: JSON.parse(decrypted) as T };
  } catch {
    return {
      ok: false,
      error: 'Şifreli yedek açılamadı (yanlış parola veya değiştirilmiş/bozulmuş şifreli dosya).',
    };
  }
}

/**
 * Firebase Authentication kullanıcılarını ücretsiz Spark planında ayrı bir SHA-256 doğrulamalı
 * yedek nesnesi olarak dışa aktarır (Admin SDK listUsers; parola özetleri için ek olarak `firebase auth:export` önerilir).
 */
export async function exportFirebaseAuthUsersBackup(params: {
  auth: BackupAuthLike;
  projectId?: string | null;
  now?: Date;
}): Promise<FirebaseAuthBackupSnapshot> {
  const users: FirebaseAuthBackupUser[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await params.auth.listUsers(1000, nextPageToken);
    for (const u of page.users || []) {
      users.push({
        uid: u.uid,
        email: u.email ?? null,
        emailVerified: Boolean(u.emailVerified),
        displayName: u.displayName ?? null,
        disabled: Boolean(u.disabled),
        providerIds: Array.isArray(u.providerData)
          ? u.providerData
              .map((p) => (typeof p?.providerId === 'string' ? p.providerId : ''))
              .filter(Boolean)
          : [],
        creationTime: u.metadata?.creationTime ?? null,
        lastSignInTime: u.metadata?.lastSignInTime ?? null,
      });
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  users.sort((a, b) => a.uid.localeCompare(b.uid));
  const payload: FirebaseAuthBackupPayload = {
    schemaVersion: FIREBASE_AUTH_BACKUP_SCHEMA_VERSION,
    createdAtIso: (params.now || new Date()).toISOString(),
    projectId: params.projectId ?? null,
    users,
  };
  const secretCheck = assertNoSecretMaterialInBackup(payload);
  if (!secretCheck.ok) {
    throw new Error(secretCheck.reason || 'Auth backup secret check failed');
  }
  const checksumSha256 = crypto
    .createHash('sha256')
    .update(canonicalJson(payload))
    .digest('hex');

  return {
    ...payload,
    userCount: users.length,
    checksumSha256,
  };
}

export function verifyFirebaseAuthBackup(snapshot: unknown): { ok: boolean; error?: string } {
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, error: 'Geçersiz Auth yedek nesnesi.' };
  }
  const candidate = snapshot as Partial<FirebaseAuthBackupSnapshot>;
  if (candidate.schemaVersion !== FIREBASE_AUTH_BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Desteklenmeyen Auth yedek şema sürümü: ${String(candidate.schemaVersion)}`,
    };
  }
  if (!Array.isArray(candidate.users)) {
    return { ok: false, error: 'Auth yedeğinde users listesi eksik.' };
  }
  if (typeof candidate.checksumSha256 !== 'string' || candidate.checksumSha256.length !== 64) {
    return { ok: false, error: 'Auth yedeğinde SHA-256 sağlama toplamı eksik.' };
  }
  const secretCheck = assertNoSecretMaterialInBackup(candidate);
  if (!secretCheck.ok) {
    return { ok: false, error: secretCheck.reason };
  }
  const payload: FirebaseAuthBackupPayload = {
    schemaVersion: candidate.schemaVersion,
    createdAtIso: String(candidate.createdAtIso || ''),
    projectId: candidate.projectId ?? null,
    users: candidate.users,
  };
  const expected = crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');
  if (expected !== candidate.checksumSha256) {
    return { ok: false, error: 'Auth yedeği SHA-256 bütünlük doğrulaması başarısız.' };
  }
  return { ok: true };
}

/**
 * Yedeklenmiş güvenlik kurallarını izole bir hedef dizine doğrulanmış olarak geri yazar (canlı Firebase'e dokunmaz).
 */
export function restoreSecurityRulesToDirectory(params: {
  snapshot: FirebaseSparkBackupSnapshot;
  targetDir: string;
  dryRun?: boolean;
}): {
  ok: boolean;
  dryRun: boolean;
  error?: string;
  firestoreRulesPath?: string;
  databaseRulesPath?: string;
} {
  const dryRun = params.dryRun ?? false;
  const verify = verifyFirebaseSparkBackup(params.snapshot);
  if (!verify.ok) {
    return { ok: false, dryRun, error: verify.error };
  }
  const rules = params.snapshot.securityRules;
  if (!rules) {
    return { ok: false, dryRun, error: 'Yedek dosyasında securityRules anlık görüntüsü bulunmuyor.' };
  }
  const firestoreRulesPath = path.resolve(params.targetDir, 'firestore.rules');
  const databaseRulesPath = path.resolve(params.targetDir, 'database.rules.json');
  if (!dryRun) {
    fs.mkdirSync(params.targetDir, { recursive: true });
    fs.writeFileSync(firestoreRulesPath, rules.firestoreRules, 'utf8');
    fs.writeFileSync(databaseRulesPath, rules.databaseRulesJson, 'utf8');
  }
  return {
    ok: true,
    dryRun,
    firestoreRulesPath,
    databaseRulesPath,
  };
}

/**
 * Firebase Spark plani ile %100 ucretsiz calisan tam yedekleme (Admin SDK -> JSON + SHA-256).
 * GCS / Blaze plani gerektirmez.
 */
export async function exportFirebaseSparkBackup(params: {
  db: BackupFirestoreLike;
  rtdb?: BackupRtdbLike | null;
  projectId?: string | null;
  securityRules?: SecurityRulesBackupSnapshot | null;
  liveSecurityRules?: LiveSecurityRulesBackupSnapshot | null;
  now?: Date;
}): Promise<FirebaseSparkBackupSnapshot> {
  const collections = {} as Record<SparkBackupCollectionName, FirebaseSparkBackupDocument[]>;
  const firestoreCounts = {} as Record<SparkBackupCollectionName, number>;
  let totalDocuments = 0;

  for (const collectionName of SPARK_BACKUP_FIRESTORE_COLLECTIONS) {
    const snap = await params.db.collection(collectionName).get();
    const docs: FirebaseSparkBackupDocument[] = snap.docs
      .map((d) => ({
        id: d.id,
        data: (serializeBackupValue(d.data() || {}) as Record<string, unknown>) || {},
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    collections[collectionName] = docs;
    firestoreCounts[collectionName] = docs.length;
    totalDocuments += docs.length;
  }

  const rtdbData = {} as Record<SparkBackupRtdbPath, Record<string, unknown> | null>;
  const rtdbCounts = {} as Record<SparkBackupRtdbPath, number>;
  for (const rtdbPath of SPARK_BACKUP_RTDB_PATHS) {
    if (!params.rtdb) {
      rtdbData[rtdbPath] = null;
      rtdbCounts[rtdbPath] = 0;
      continue;
    }
    const snap = await params.rtdb.ref(rtdbPath).once('value');
    const rawVal = snap.val();
    if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal)) {
      const normalized = serializeBackupValue(rawVal) as Record<string, unknown>;
      rtdbData[rtdbPath] = normalized;
      rtdbCounts[rtdbPath] = Object.keys(normalized).length;
    } else {
      rtdbData[rtdbPath] = null;
      rtdbCounts[rtdbPath] = 0;
    }
  }

  const payload: FirebaseSparkBackupPayload = {
    schemaVersion: SPARK_BACKUP_SCHEMA_VERSION,
    createdAtIso: (params.now || new Date()).toISOString(),
    rosterVersion: ROSTER_DATA_VERSION,
    projectId: params.projectId ?? null,
    collections,
    rtdb: rtdbData,
    ...(params.securityRules !== undefined ? { securityRules: params.securityRules } : {}),
    ...(params.liveSecurityRules !== undefined
      ? { liveSecurityRules: params.liveSecurityRules }
      : {}),
  };

  const secretCheck = assertNoSecretMaterialInBackup(payload);
  if (!secretCheck.ok) {
    throw new Error(secretCheck.reason || 'Backup secret check failed');
  }

  const checksumSha256 = computeBackupChecksum(payload);
  return {
    ...payload,
    checksumSha256,
    counts: {
      firestore: firestoreCounts,
      rtdb: rtdbCounts,
      totalDocuments,
    },
  };
}

/**
 * Yedek dosyasinin semasini, tum zorunlu koleksiyonlarini, gizli anahtar temizligini ve SHA-256 butunlugunu dogrular.
 */
export function verifyFirebaseSparkBackup(snapshot: unknown): { ok: boolean; error?: string } {
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, error: 'Gecersiz yedek nesnesi.' };
  }
  const candidate = snapshot as Partial<FirebaseSparkBackupSnapshot>;
  if (candidate.schemaVersion !== SPARK_BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: `Desteklenmeyen yedek sema surumu: ${String(candidate.schemaVersion)}` };
  }
  if (!candidate.collections || typeof candidate.collections !== 'object') {
    return { ok: false, error: 'Yedekte collections alani eksik.' };
  }
  for (const name of SPARK_BACKUP_FIRESTORE_COLLECTIONS) {
    if (!Array.isArray(candidate.collections[name])) {
      return { ok: false, error: `Yedekte zorunlu koleksiyon eksik: ${name}` };
    }
  }
  if (!candidate.rtdb || typeof candidate.rtdb !== 'object') {
    return { ok: false, error: 'Yedekte rtdb alani eksik.' };
  }
  for (const rtdbPath of SPARK_BACKUP_RTDB_PATHS) {
    if (!(rtdbPath in candidate.rtdb)) {
      return { ok: false, error: `Yedekte zorunlu RTDB yolu eksik: ${rtdbPath}` };
    }
  }
  if (typeof candidate.checksumSha256 !== 'string' || candidate.checksumSha256.length !== 64) {
    return { ok: false, error: 'Yedek SHA-256 saglama toplami eksik veya gecersiz.' };
  }

  const secretCheck = assertNoSecretMaterialInBackup(candidate);
  if (!secretCheck.ok) {
    return { ok: false, error: secretCheck.reason };
  }

  if (candidate.securityRules) {
    const sr = candidate.securityRules;
    if (
      typeof sr.firestoreRules !== 'string' ||
      typeof sr.firestoreRulesSha256 !== 'string' ||
      sha256Text(sr.firestoreRules) !== sr.firestoreRulesSha256
    ) {
      return {
        ok: false,
        error: 'Yedekteki firestore.rules SHA-256 doğrulaması başarısız.',
      };
    }
    if (
      typeof sr.databaseRulesJson !== 'string' ||
      typeof sr.databaseRulesSha256 !== 'string' ||
      sha256Text(sr.databaseRulesJson) !== sr.databaseRulesSha256
    ) {
      return {
        ok: false,
        error: 'Yedekteki database.rules.json SHA-256 doğrulaması başarısız.',
      };
    }
  }

  if (candidate.liveSecurityRules) {
    const lr = candidate.liveSecurityRules;
    if (lr.source !== 'firebase_live') {
      return { ok: false, error: 'liveSecurityRules kaynağı firebase_live olmalıdır.' };
    }
    if (
      lr.firestoreRules !== null &&
      (typeof lr.firestoreRules !== 'string' ||
        typeof lr.firestoreRulesSha256 !== 'string' ||
        sha256Text(lr.firestoreRules) !== lr.firestoreRulesSha256)
    ) {
      return { ok: false, error: 'Canlı firestore.rules SHA-256 doğrulaması başarısız.' };
    }
    if (
      lr.databaseRulesJson !== null &&
      (typeof lr.databaseRulesJson !== 'string' ||
        typeof lr.databaseRulesSha256 !== 'string' ||
        sha256Text(lr.databaseRulesJson) !== lr.databaseRulesSha256)
    ) {
      return { ok: false, error: 'Canlı database.rules.json SHA-256 doğrulaması başarısız.' };
    }
  }

  const payload: FirebaseSparkBackupPayload = {
    schemaVersion: candidate.schemaVersion,
    createdAtIso: String(candidate.createdAtIso || ''),
    rosterVersion: String(candidate.rosterVersion || ''),
    projectId: candidate.projectId ?? null,
    collections: candidate.collections as Record<SparkBackupCollectionName, FirebaseSparkBackupDocument[]>,
    rtdb: candidate.rtdb as Record<SparkBackupRtdbPath, Record<string, unknown> | null>,
    ...(candidate.securityRules !== undefined ? { securityRules: candidate.securityRules } : {}),
    ...(candidate.liveSecurityRules !== undefined
      ? { liveSecurityRules: candidate.liveSecurityRules }
      : {}),
  };
  const expectedChecksum = computeBackupChecksum(payload);
  if (expectedChecksum !== candidate.checksumSha256) {
    return {
      ok: false,
      error: 'Yedek SHA-256 butunluk dogrulamasi basarisiz (dosya degistirilmis veya bozulmus).',
    };
  }
  return { ok: true };
}

/**
 * Dogrulanmis Spark yedegini Firestore + RTDB ortamina (or. izole emulator veya felaket kurtarma hedefi) geri yukler.
 */
export async function restoreFirebaseSparkBackup(params: {
  db: BackupFirestoreLike;
  rtdb?: BackupRtdbLike | null;
  snapshot: FirebaseSparkBackupSnapshot;
  options?: RestoreSparkBackupOptions;
}): Promise<RestoreSparkBackupReport> {
  const dryRun = params.options?.dryRun ?? false;
  const includeLegacyUsersMirror = params.options?.includeLegacyUsersMirror ?? true;
  const reconcileLegacy = params.options?.reconcileLegacyUsersWithAuthoritativeAccounts ?? true;
  const timestampFactory = params.options?.timestampFactory ?? ((iso: string) => new Date(iso));

  const emptyFirestoreCounts = Object.fromEntries(
    SPARK_BACKUP_FIRESTORE_COLLECTIONS.map((c) => [c, 0])
  ) as Record<SparkBackupCollectionName, number>;
  const emptyRtdbCounts = Object.fromEntries(
    SPARK_BACKUP_RTDB_PATHS.map((p) => [p, 0])
  ) as Record<SparkBackupRtdbPath, number>;

  const verify = verifyFirebaseSparkBackup(params.snapshot);
  if (!verify.ok) {
    return {
      ok: false,
      dryRun,
      error: verify.error,
      checksumVerified: false,
      restoredFirestoreCounts: emptyFirestoreCounts,
      restoredRtdbCounts: emptyRtdbCounts,
      legacyAnomalies: [],
    };
  }

  // Authoritative account lookup by googleUid / accountId and purchases by accountId
  const accountsByGoogleUid = new Map<string, Record<string, unknown>>();
  const accountsById = new Map<string, Record<string, unknown>>();
  for (const docItem of params.snapshot.collections.backend_accounts) {
    accountsById.set(docItem.id, docItem.data);
    if (typeof docItem.data.googleUid === 'string' && docItem.data.googleUid) {
      accountsByGoogleUid.set(docItem.data.googleUid, docItem.data);
    }
  }
  const purchasesByAccountId = new Map<string, Array<Record<string, unknown>>>();
  for (const pDoc of params.snapshot.collections.backend_purchases) {
    const accId = typeof pDoc.data.accountId === 'string' ? pDoc.data.accountId : '';
    if (!accId) continue;
    const list = purchasesByAccountId.get(accId) || [];
    list.push(pDoc.data);
    purchasesByAccountId.set(accId, list);
  }

  const legacyAnomalies: Array<{ docId: string; anomalies: string[] }> = [];
  const deletedHashes = params.options?.deletedAccountHashes;
  let skippedDeletedAccountsCount = 0;

  const isDeletedId = (candidateId: unknown): boolean => {
    if (!deletedHashes || deletedHashes.size === 0 || typeof candidateId !== 'string') return false;
    const clean = candidateId.trim();
    if (!clean) return false;
    return deletedHashes.has(clean) || deletedHashes.has(hashDeletedAccountIdentityForRestore(clean));
  };

  for (const collectionName of SPARK_BACKUP_FIRESTORE_COLLECTIONS) {
    if (collectionName === 'users' && !includeLegacyUsersMirror) {
      continue;
    }
    const docs = params.snapshot.collections[collectionName];
    for (const docItem of docs) {
      if (
        (collectionName === 'backend_accounts' ||
          collectionName === 'users' ||
          collectionName === 'usernames' ||
          collectionName === 'publicProfiles') &&
        (isDeletedId(docItem.id) ||
          isDeletedId(docItem.data.accountId) ||
          isDeletedId(docItem.data.googleUid) ||
          isDeletedId(docItem.data.ownerUid) ||
          isDeletedId(docItem.data.userId))
      ) {
        skippedDeletedAccountsCount += 1;
        continue;
      }

      let dataToRestore = deserializeBackupValue(docItem.data, timestampFactory) as Record<string, unknown>;

      if (collectionName === 'users' && reconcileLegacy) {
        const authAccount =
          accountsByGoogleUid.get(docItem.id) || accountsById.get(docItem.id) || null;
        const authAccountId =
          authAccount && typeof authAccount.accountId === 'string' ? authAccount.accountId : docItem.id;
        const reconciled = reconcileLegacyUserWithAuthoritativeAccount({
          legacyUserDoc: dataToRestore,
          authoritativeAccount: authAccount,
          verifiedPurchasesForAccount: purchasesByAccountId.get(authAccountId) || [],
        });
        if (reconciled.anomalies.length > 0) {
          legacyAnomalies.push({ docId: docItem.id, anomalies: reconciled.anomalies });
        }
        dataToRestore = {
          ...dataToRestore,
          coins: reconciled.coins,
          weeklyPoints: reconciled.weeklyPoints,
          totalPoints: reconciled.totalPoints,
          adFree: reconciled.adFree,
          permanentMultiplier2x: reconciled.permanentMultiplier2x,
          unlockedGiftIds: reconciled.unlockedGiftIds,
        };
      }

      if (!dryRun) {
        await params.db.collection(collectionName).doc(docItem.id).set(dataToRestore);
      }
      emptyFirestoreCounts[collectionName] += 1;
    }
  }

  if (params.rtdb) {
    for (const rtdbPath of SPARK_BACKUP_RTDB_PATHS) {
      const value = params.snapshot.rtdb[rtdbPath];
      if (value && typeof value === 'object') {
        const filteredEntries: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
          if (rtdbPath === 'leaderboard' && isDeletedId(k)) {
            skippedDeletedAccountsCount += 1;
            continue;
          }
          filteredEntries[k] = v;
        }
        const restoredValue = deserializeBackupValue(filteredEntries, timestampFactory);
        if (!dryRun) {
          await params.rtdb.ref(rtdbPath).set(restoredValue);
        }
        emptyRtdbCounts[rtdbPath] = Object.keys(filteredEntries).length;
      }
    }
  }

  return {
    ok: true,
    dryRun,
    checksumVerified: true,
    restoredFirestoreCounts: emptyFirestoreCounts,
    restoredRtdbCounts: emptyRtdbCounts,
    skippedDeletedAccountsCount,
    legacyAnomalies,
  };
}
