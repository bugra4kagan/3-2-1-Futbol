import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { normalizeRecoveryCode, normalizeUsernameKey } from './accountEngine.js';
import { sanitizeRtdbKey } from './realtimeSyncHelpers.js';
import {
  ROSTER_VERSION_MISMATCH_ERROR,
  areRosterVersionsCompatible,
  normalizeRosterVersion,
} from './rosterVersion.js';
import {
  applyVerifiedMatchRewardToProgression,
  type AccountCloudAdapter,
  type PersistentAccountRecord,
} from './accountStore.js';
import type { MatchSessionCloudAdapter, ServerMatchSession } from './serverSecurity.js';
import type { MinigameRoundPayload, MinigameType, PlayerProfile, UserProgression } from './types.js';

const PROJECT_ID = 'futbol-9013e';
const RTDB_URL = 'https://futbol-9013e-default-rtdb.europe-west1.firebasedatabase.app';

let cachedAdminApp: App | null = null;

function parseServiceAccountFromEnv(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  let jsonText = raw;
  if (!raw.startsWith('{') && fs.existsSync(raw)) {
    try {
      jsonText = fs.readFileSync(raw, 'utf8');
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(jsonText) as ServiceAccount & {
      client_email?: string;
      private_key?: string;
      project_id?: string;
    };
    if (
      typeof parsed.client_email === 'string' &&
      typeof parsed.private_key === 'string'
    ) {
      return {
        projectId: parsed.projectId || parsed.project_id || PROJECT_ID,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isEmulatorEnvEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    Boolean(process.env.FIRESTORE_EMULATOR_HOST?.trim())
  );
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    parseServiceAccountFromEnv() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      isEmulatorEnvEnabled() ||
      getApps().length > 0
  );
}

export function getFirebaseAdminApp(): App | null {
  if (cachedAdminApp) return cachedAdminApp;
  if (getApps().length > 0) {
    cachedAdminApp = getApps()[0]!;
    return cachedAdminApp;
  }

  const serviceAccount = parseServiceAccountFromEnv();
  if (serviceAccount) {
    cachedAdminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId || PROJECT_ID,
      databaseURL: RTDB_URL,
    });
    return cachedAdminApp;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    cachedAdminApp = initializeApp({
      projectId: PROJECT_ID,
      databaseURL: RTDB_URL,
    });
    return cachedAdminApp;
  }

  if (isEmulatorEnvEnabled()) {
    const emuProjectId =
      process.env.GCLOUD_PROJECT?.trim() ||
      process.env.FIREBASE_PROJECT_ID?.trim() ||
      PROJECT_ID;
    cachedAdminApp = initializeApp({
      projectId: emuProjectId,
      databaseURL: RTDB_URL,
    });
    return cachedAdminApp;
  }

  return null;
}

export async function verifyFirebaseBearerToken(
  idToken: string | undefined | null
): Promise<DecodedIdToken | null> {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) return null;
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return null;
  try {
    return await getAuth(adminApp).verifyIdToken(idToken.trim());
  } catch {
    return null;
  }
}

export async function syncAuthoritativeUserStateAdmin(params: {
  uid?: string;
  accountId: string;
  profile: PlayerProfile;
  progression: UserProgression;
  email?: string;
}): Promise<{ syncedFirestore: boolean; syncedRtdb: boolean }> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return { syncedFirestore: false, syncedRtdb: false };
  }

  const cleanUid = params.uid?.trim();
  const displayName = (params.profile?.name || 'Oyuncu').trim().slice(0, 64);
  const usernameKey = normalizeUsernameKey(displayName);
  const safeCoins = Math.max(0, Math.round(params.progression.coins || 0));
  const safeWeekly = Math.max(0, Math.round(params.progression.weeklyPoints || 0));
  const safeTotal = Math.max(0, Math.round(params.progression.totalPoints || 0));
  const safeUnlocked = Array.from(
    new Set(
      (params.progression.unlockedGiftIds || []).filter((x): x is string => typeof x === 'string')
    )
  ).slice(0, 500);

  let syncedFirestore = false;
  let syncedRtdb = false;

  if (cleanUid) {
    try {
      const db = getFirestore(adminApp);
      const userPayload: Record<string, unknown> = {
        userId: cleanUid,
        displayName,
        email: (params.email || '').slice(0, 254),
        avatar: (params.profile?.avatar || '⚽').slice(0, 64),
        coins: safeCoins,
        weeklyPoints: safeWeekly,
        totalPoints: safeTotal,
        unlockedGiftIds: safeUnlocked,
        adFree: Boolean(params.progression.adFree),
        permanentMultiplier2x: Boolean(params.progression.permanentMultiplier2x),
        progressionJson: JSON.stringify(params.progression).slice(0, 99000),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (usernameKey.length >= 3 && usernameKey.length <= 32) {
        userPayload.usernameKey = usernameKey;
      }
      if (params.profile?.favoriteClubId) {
        userPayload.favoriteClubId = params.profile.favoriteClubId.slice(0, 64);
      }
      await db.collection('users').doc(cleanUid).set(userPayload, { merge: true });

      if (usernameKey.length >= 3 && usernameKey.length <= 32) {
        const publicProfilePayload: Record<string, unknown> = {
          usernameKey,
          ownerUid: cleanUid,
          displayName: displayName.slice(0, 32),
          avatar: (params.profile?.avatar || '⚽').slice(0, 64),
          friendCode: params.progression.friendCode || '',
          hasCrown: safeUnlocked.includes('gift_title_legend'),
          weeklyPoints: safeWeekly,
          totalPoints: safeTotal,
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (params.profile?.favoriteClubId) {
          publicProfilePayload.favoriteClubId = params.profile.favoriteClubId.slice(0, 64);
        }
        await db
          .collection('publicProfiles')
          .doc(usernameKey)
          .set(publicProfilePayload, { merge: true });
      }
      syncedFirestore = true;
    } catch {
      syncedFirestore = false;
    }
  }

  try {
    const rtdb = getDatabase(adminApp);
    const key = sanitizeRtdbKey(params.accountId || cleanUid || displayName);
    const rtdbPayload: Record<string, unknown> = {
      id: params.accountId,
      ownerUid: cleanUid || params.accountId,
      friendCode: params.progression.friendCode || null,
      name: displayName.slice(0, 32),
      avatar: (params.profile?.avatar || '⚽').slice(0, 64),
      weeklyPoints: safeWeekly,
      totalPoints: safeTotal,
      updatedAt: Date.now(),
    };
    if (params.profile?.favoriteClubId) {
      rtdbPayload.favoriteClubId = params.profile.favoriteClubId.slice(0, 64);
    }
    await rtdb.ref(`leaderboard/${key}`).update(rtdbPayload);
    syncedRtdb = true;
  } catch {
    syncedRtdb = false;
  }

  return { syncedFirestore, syncedRtdb };
}

/**
 * Eski 1.0.x sürümünden kalan ve `ownerUid` içermeyen RTDB `leaderboard/{playerKey}`
 * kayıtlarını yalnızca doğrulanmış sunucu + Firebase Auth UID kontrolüyle güvenli şekilde devralır.
 * Devir sırasında mevcut puanlar asla artırılmaz/değiştirilmez.
 */
export async function claimLegacyRtdbLeaderboardAdmin(params: {
  verifiedUid: string;
  playerKey: string;
  expectedAccountId: string;
}): Promise<{ ok: boolean; statusCode: number; error?: string; weeklyPoints?: number; totalPoints?: number }> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return {
      ok: false,
      statusCode: 503,
      error: 'Firebase Admin SDK sunucuda yapılandırılmamış.',
    };
  }

  const cleanKey = sanitizeRtdbKey(params.playerKey);
  if (!cleanKey) {
    return { ok: false, statusCode: 400, error: 'Geçersiz liderlik anahtarı.' };
  }

  const rtdb = getDatabase(adminApp);
  const snap = await rtdb.ref(`leaderboard/${cleanKey}`).get();
  if (!snap.exists()) {
    return { ok: false, statusCode: 404, error: 'Eski liderlik kaydı bulunamadı.' };
  }

  const existing = snap.val() as Record<string, unknown>;
  if (typeof existing.ownerUid === 'string' && existing.ownerUid.length > 0) {
    if (existing.ownerUid !== params.verifiedUid) {
      return { ok: false, statusCode: 403, error: 'Bu liderlik kaydı başka bir kullanıcıya aittir.' };
    }
    return {
      ok: true,
      statusCode: 200,
      weeklyPoints: Number(existing.weeklyPoints) || 0,
      totalPoints: Number(existing.totalPoints) || 0,
    };
  }

  // Yalnızca eski 1.0.x kaydının id alanı doğrulanan kullanıcının accountId/uid değeriyle örtüşüyorsa sahiplen
  const legacyId = String(existing.id || '').trim();
  if (!legacyId || (legacyId !== params.expectedAccountId && legacyId !== params.verifiedUid)) {
    return { ok: false, statusCode: 403, error: 'Eski kayıt kimliği hesap sahipliğiyle eşleşmiyor.' };
  }

  await rtdb.ref(`leaderboard/${cleanKey}`).update({
    ownerUid: params.verifiedUid,
    migratedFromLegacyAt: Date.now(),
  });

  return {
    ok: true,
    statusCode: 200,
    weeklyPoints: Math.max(0, Math.round(Number(existing.weeklyPoints) || 0)),
    totalPoints: Math.max(0, Math.round(Number(existing.totalPoints) || 0)),
  };
}

export async function verifyOnlineRoomOutcomeAdmin(params: {
  roomCode: string;
  uid: string;
  playerId: string;
  expectedRosterVersion?: string;
}): Promise<
  | {
      ok: true;
      matchSeq: number;
      minigameType: string;
      roundIdsCount: number;
      rosterVersion: string | null;
      playerScore: number;
      opponentScore: number;
    }
  | { ok: false; error: string; errorCode?: string }
> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return { ok: false, error: 'Firebase Admin SDK sunucuda yapılandırılmamış.' };
  }

  try {
    const db = getFirestore(adminApp);
    const snap = await db.collection('rooms').doc(params.roomCode.toUpperCase()).get();
    if (!snap.exists) {
      return { ok: false, error: 'Çevrimiçi oda Firestore kaydı bulunamadı.' };
    }
    const room = snap.data() as Record<string, unknown>;
    const memberUids = Array.isArray(room.memberUids) ? room.memberUids : [];
    if (!memberUids.includes(params.uid)) {
      return { ok: false, error: 'Kullanıcı bu çevrimiçi odanın üyesi değil.' };
    }
    const roomRosterVersion = normalizeRosterVersion(room.rosterVersion);
    if (
      params.expectedRosterVersion &&
      !areRosterVersionsCompatible(roomRosterVersion, params.expectedRosterVersion)
    ) {
      return {
        ok: false,
        errorCode: 'roster_version_mismatch',
        error: ROSTER_VERSION_MISMATCH_ERROR,
      };
    }
    if (
      room.guestRosterVersion !== undefined &&
      room.guestRosterVersion !== null &&
      !areRosterVersionsCompatible(roomRosterVersion, room.guestRosterVersion)
    ) {
      return {
        ok: false,
        errorCode: 'roster_version_mismatch',
        error: ROSTER_VERSION_MISMATCH_ERROR,
      };
    }
    if (room.state !== 'game_over') {
      return { ok: false, error: 'Çevrimiçi maç henüz tamamlanmamış.' };
    }
    const roundIds = Array.isArray(room.roundIds) ? room.roundIds : [];
    if (roundIds.length === 0) {
      return { ok: false, error: 'Çevrimiçi oda soru dizisi doğrulanamadı.' };
    }

    const scores = (room.scores && typeof room.scores === 'object' ? room.scores : {}) as Record<
      string,
      unknown
    >;
    const hostId = String(room.hostId || '');
    const guestId = String(room.guestId || '');
    const callerKey =
      params.uid === room.hostUid
        ? hostId
        : params.uid === room.guestUid
        ? guestId
        : params.playerId;
    const oppKey = callerKey === hostId ? guestId : hostId;

    return {
      ok: true,
      matchSeq: Math.max(1, Math.round(Number(room.matchSeq) || 1)),
      minigameType: String(room.minigameType || 'two_clubs'),
      roundIdsCount: roundIds.length,
      rosterVersion: roomRosterVersion,
      playerScore: Math.max(0, Math.round(Number(scores[callerKey]) || 0)),
      opponentScore: Math.max(0, Math.round(Number(scores[oppKey]) || 0)),
    };
  } catch {
    return { ok: false, error: 'Firestore oda sonucu doğrulanamadı.' };
  }
}

export async function deleteUserFirebaseRecordsAdmin(params: {
  uid?: string;
  accountId?: string;
  displayName?: string;
  deleteAuthUser?: boolean;
}): Promise<{
  rtdbCleared: boolean;
  firestoreCleared: boolean;
  authDeleted: boolean;
}> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return { rtdbCleared: false, firestoreCleared: false, authDeleted: false };
  }
  let rtdbCleared = false;
  let firestoreCleared = false;
  let authDeleted = false;

  try {
    const rtdb = getDatabase(adminApp);
    if (params.accountId) {
      await rtdb
        .ref(`leaderboard/${sanitizeRtdbKey(params.accountId)}`)
        .remove()
        .then(() => {
          rtdbCleared = true;
        })
        .catch(() => {});
    }
    if (params.uid) {
      await rtdb
        .ref(`leaderboard/${sanitizeRtdbKey(params.uid)}`)
        .remove()
        .then(() => {
          rtdbCleared = true;
        })
        .catch(() => {});
      const db = getFirestore(adminApp);
      await db
        .collection('users')
        .doc(params.uid)
        .delete()
        .then(() => {
          firestoreCleared = true;
        })
        .catch(() => {});

      const key = params.displayName ? normalizeUsernameKey(params.displayName) : '';
      if (key.length >= 3 && key.length <= 32) {
        for (const colName of ['publicProfiles', 'usernames'] as const) {
          const ref = db.collection(colName).doc(key);
          const snap = await ref.get().catch(() => null);
          if (snap?.exists && snap.data()?.ownerUid === params.uid) {
            await ref.delete().catch(() => {});
          }
        }
      }

      if (params.deleteAuthUser) {
        await getAuth(adminApp)
          .deleteUser(params.uid)
          .then(() => {
            authDeleted = true;
          })
          .catch((err: unknown) => {
            const code = (err as { code?: string })?.code;
            if (code === 'auth/user-not-found') {
              authDeleted = true;
            }
          });
      }
    }
  } catch {
    // ignore cleanup failures
  }

  return { rtdbCleared, firestoreCleared, authDeleted };
}

export function hashDeletedAccountIdentity(rawId: string): string {
  return crypto
    .createHash('sha256')
    .update(`deleted_account_v1:${String(rawId || '').trim()}`)
    .digest('hex');
}

export async function recordDeletedAccountTombstoneAdmin(params: {
  accountId?: string;
  uid?: string;
}): Promise<boolean> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return false;
  const targets = [params.accountId, params.uid]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  if (targets.length === 0) return false;
  try {
    const db = getFirestore(adminApp);
    const now = Date.now();
    for (const id of new Set(targets)) {
      const hash = hashDeletedAccountIdentity(id);
      await db.collection('deleted_accounts').doc(hash).set(
        {
          identityHash: hash,
          deletedAt: now,
          serverDeletedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    return true;
  } catch {
    return false;
  }
}

export async function saveModerationReportAdmin(report: {
  id: string;
  reporterId: string;
  targetId: string;
  targetName: string;
  reason: string;
  details: string;
  reviewStatus: 'pending_review';
  autoActionTaken: false;
  createdAt: number;
}): Promise<boolean> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return false;
  try {
    const db = getFirestore(adminApp);
    await db
      .collection('userReports')
      .doc(report.id)
      .set({
        ...report,
        source: 'backend_api',
        serverCreatedAt: FieldValue.serverTimestamp(),
      });
    return true;
  } catch {
    return false;
  }
}

const BACKEND_ACCOUNTS_COLLECTION = 'backend_accounts';
const BACKEND_PURCHASES_COLLECTION = 'backend_purchases';
const BACKEND_MATCH_SESSIONS_COLLECTION = 'backend_match_sessions';
const BACKEND_REWARD_CLAIMS_COLLECTION = 'backend_reward_claims';

export function hashPurchaseToken(purchaseToken: string): string {
  return crypto
    .createHash('sha256')
    .update(String(purchaseToken || '').trim())
    .digest('hex');
}

function serializeAccountForCloud(record: PersistentAccountRecord): Record<string, unknown> {
  return {
    accountId: record.accountId,
    username: record.username,
    usernameKey: record.usernameKey,
    recoveryCode: record.recoveryCode,
    recoveryCodeNormalized: normalizeRecoveryCode(record.recoveryCode),
    sessionSecret: record.sessionSecret || null,
    googleUid: record.googleUid || null,
    profileJson: JSON.stringify(record.profile).slice(0, 120000),
    progressionJson: JSON.stringify(record.progression).slice(0, 240000),
    verifiedPurchasesJson: JSON.stringify(record.verifiedPurchases || []).slice(0, 120000),
    createdAt: record.createdAt || Date.now(),
    updatedAt: record.updatedAt || Date.now(),
  };
}

function deserializeAccountFromCloud(data: Record<string, unknown> | undefined): PersistentAccountRecord | null {
  if (!data || typeof data.accountId !== 'string' || !data.accountId.trim()) return null;
  try {
    const profile =
      typeof data.profileJson === 'string'
        ? JSON.parse(data.profileJson)
        : (data.profile as PersistentAccountRecord['profile']);
    const progression =
      typeof data.progressionJson === 'string'
        ? JSON.parse(data.progressionJson)
        : (data.progression as PersistentAccountRecord['progression']);
    const verifiedPurchases =
      typeof data.verifiedPurchasesJson === 'string'
        ? JSON.parse(data.verifiedPurchasesJson)
        : Array.isArray(data.verifiedPurchases)
        ? data.verifiedPurchases
        : [];
    if (!profile || !progression) return null;
    return {
      accountId: data.accountId,
      username: String(data.username || profile.name || 'Oyuncu'),
      usernameKey: String(data.usernameKey || normalizeUsernameKey(String(data.username || profile.name || ''))),
      recoveryCode: String(data.recoveryCode || ''),
      sessionSecret: typeof data.sessionSecret === 'string' && data.sessionSecret ? data.sessionSecret : undefined,
      googleUid: typeof data.googleUid === 'string' && data.googleUid ? data.googleUid : undefined,
      verifiedPurchases: Array.isArray(verifiedPurchases) ? verifiedPurchases : [],
      profile,
      progression,
      createdAt: Number(data.createdAt) || Date.now(),
      updatedAt: Number(data.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export async function loadBackendAccountsAdmin(limitCount = 2000): Promise<PersistentAccountRecord[]> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return [];
  try {
    const db = getFirestore(adminApp);
    const snap = await db
      .collection(BACKEND_ACCOUNTS_COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(Math.max(1, Math.min(5000, limitCount)))
      .get();
    const out: PersistentAccountRecord[] = [];
    for (const doc of snap.docs) {
      const parsed = deserializeAccountFromCloud(doc.data());
      if (parsed) out.push(parsed);
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchBackendAccountByIdAdmin(accountId: string): Promise<PersistentAccountRecord | null> {
  const cleanId = String(accountId || '').trim();
  if (!cleanId) return null;
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return null;
  try {
    const db = getFirestore(adminApp);
    const snap = await db.collection(BACKEND_ACCOUNTS_COLLECTION).doc(cleanId).get();
    if (!snap.exists) return null;
    return deserializeAccountFromCloud(snap.data());
  } catch {
    return null;
  }
}

export async function fetchBackendAccountByRecoveryCodeAdmin(
  normalizedCode: string
): Promise<PersistentAccountRecord | null> {
  const code = normalizeRecoveryCode(normalizedCode);
  if (!code) return null;
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return null;
  try {
    const db = getFirestore(adminApp);
    const snap = await db
      .collection(BACKEND_ACCOUNTS_COLLECTION)
      .where('recoveryCodeNormalized', '==', code)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return deserializeAccountFromCloud(snap.docs[0]?.data());
  } catch {
    return null;
  }
}

export async function fetchBackendAccountByGoogleUidAdmin(
  googleUid: string
): Promise<PersistentAccountRecord | null> {
  const cleanUid = String(googleUid || '').trim();
  if (!cleanUid) return null;
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return null;
  try {
    const db = getFirestore(adminApp);
    const snap = await db
      .collection(BACKEND_ACCOUNTS_COLLECTION)
      .where('googleUid', '==', cleanUid)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return deserializeAccountFromCloud(snap.docs[0]?.data());
  } catch {
    return null;
  }
}

export async function persistBackendAccountAdmin(record: PersistentAccountRecord): Promise<boolean> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp || !record?.accountId) return false;
  try {
    const db = getFirestore(adminApp);
    await db
      .collection(BACKEND_ACCOUNTS_COLLECTION)
      .doc(record.accountId)
      .set(serializeAccountForCloud(record), { merge: true });
    return true;
  } catch {
    return false;
  }
}

export async function deleteBackendAccountAdmin(accountId: string): Promise<boolean> {
  const cleanId = String(accountId || '').trim();
  if (!cleanId) return false;
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return false;
  try {
    const db = getFirestore(adminApp);
    await db.collection(BACKEND_ACCOUNTS_COLLECTION).doc(cleanId).delete();
    return true;
  } catch {
    return false;
  }
}

export async function claimVerifiedPurchaseTokenAdmin(params: {
  purchaseToken: string;
  accountId: string;
  productId: string;
  itemId: string;
  orderId?: string;
}): Promise<{ ok: boolean; alreadyOwnedBySameAccount?: boolean; conflict?: boolean }> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return { ok: true };
  }
  const tokenHash = hashPurchaseToken(params.purchaseToken);
  if (!tokenHash) return { ok: false };
  try {
    const db = getFirestore(adminApp);
    const docRef = db.collection(BACKEND_PURCHASES_COLLECTION).doc(tokenHash);
    try {
      await docRef.create({
        tokenHash,
        accountId: params.accountId,
        productId: params.productId,
        itemId: params.itemId,
        orderId: params.orderId || null,
        verifiedAt: Date.now(),
      });
      return { ok: true, alreadyOwnedBySameAccount: false };
    } catch {
      const existing = await docRef.get();
      const data = existing.data();
      if (data && data.accountId === params.accountId) {
        return { ok: true, alreadyOwnedBySameAccount: true };
      }
      if (data && data.accountId) {
        return { ok: false, conflict: true };
      }
      return { ok: false };
    }
  } catch {
    return { ok: false };
  }
}

export async function hasVerifiedPurchaseTokenAdmin(purchaseToken: string): Promise<boolean> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return false;
  const tokenHash = hashPurchaseToken(purchaseToken);
  if (!tokenHash) return false;
  try {
    const db = getFirestore(adminApp);
    const snap = await db.collection(BACKEND_PURCHASES_COLLECTION).doc(tokenHash).get();
    return snap.exists;
  } catch {
    return false;
  }
}

function serializeMatchSessionForCloud(session: ServerMatchSession): Record<string, unknown> {
  return {
    sessionId: session.sessionId,
    accountId: session.accountId,
    minigameType: session.minigameType,
    mode: session.mode,
    roomCode: session.roomCode || null,
    matchSeq: session.matchSeq ?? null,
    rosterVersion: session.rosterVersion || null,
    startedAt: session.startedAt,
    roundsJson: JSON.stringify(session.rounds).slice(0, 240000),
    scoredRounds: Array.from(session.scoredRounds),
    verifiedPlayerScore: session.verifiedPlayerScore,
    verifiedCorrectAnswers: session.verifiedCorrectAnswers,
    completed: Boolean(session.completed),
    expiresAt: session.startedAt + 45 * 60 * 1000,
    updatedAt: Date.now(),
  };
}

function deserializeMatchSessionFromCloud(data: Record<string, unknown> | undefined): ServerMatchSession | null {
  if (!data || typeof data.sessionId !== 'string' || typeof data.accountId !== 'string') return null;
  try {
    const rounds =
      typeof data.roundsJson === 'string'
        ? (JSON.parse(data.roundsJson) as MinigameRoundPayload[])
        : [];
    const scoredArr = Array.isArray(data.scoredRounds)
      ? data.scoredRounds.map((x) => Number(x)).filter((x) => Number.isFinite(x))
      : [];
    return {
      sessionId: data.sessionId,
      accountId: data.accountId,
      minigameType: (String(data.minigameType || 'two_clubs') as MinigameType),
      mode: String(data.mode || 'solo'),
      roomCode: typeof data.roomCode === 'string' && data.roomCode ? data.roomCode : undefined,
      matchSeq: typeof data.matchSeq === 'number' && Number.isFinite(data.matchSeq) ? data.matchSeq : undefined,
      rosterVersion: typeof data.rosterVersion === 'string' && data.rosterVersion ? data.rosterVersion : undefined,
      startedAt: Number(data.startedAt) || Date.now(),
      rounds: Array.isArray(rounds) ? rounds : [],
      scoredRounds: new Set<number>(scoredArr),
      verifiedPlayerScore: Math.max(0, Number(data.verifiedPlayerScore) || 0),
      verifiedCorrectAnswers: Math.max(0, Number(data.verifiedCorrectAnswers) || 0),
      completed: Boolean(data.completed),
    };
  } catch {
    return null;
  }
}

export async function persistMatchSessionAdmin(session: ServerMatchSession): Promise<boolean> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp || !session?.sessionId) return false;
  try {
    const db = getFirestore(adminApp);
    await db
      .collection(BACKEND_MATCH_SESSIONS_COLLECTION)
      .doc(session.sessionId)
      .set(serializeMatchSessionForCloud(session), { merge: true });
    return true;
  } catch {
    return false;
  }
}

export async function fetchMatchSessionAdmin(sessionId: string): Promise<ServerMatchSession | null> {
  const cleanId = String(sessionId || '').trim();
  if (!cleanId) return null;
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return null;
  try {
    const db = getFirestore(adminApp);
    const snap = await db.collection(BACKEND_MATCH_SESSIONS_COLLECTION).doc(cleanId).get();
    if (!snap.exists) return null;
    return deserializeMatchSessionFromCloud(snap.data());
  } catch {
    return null;
  }
}

export async function loadActiveMatchSessionsAdmin(
  now: number = Date.now(),
  limitCount = 500
): Promise<ServerMatchSession[]> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return [];
  try {
    const db = getFirestore(adminApp);
    const snap = await db
      .collection(BACKEND_MATCH_SESSIONS_COLLECTION)
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'desc')
      .limit(Math.max(1, Math.min(1000, limitCount)))
      .get();
    const out: ServerMatchSession[] = [];
    for (const doc of snap.docs) {
      const parsed = deserializeMatchSessionFromCloud(doc.data());
      if (parsed && !parsed.completed) {
        out.push(parsed);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function createFirebaseAccountCloudAdapter(): AccountCloudAdapter | null {
  if (!isFirebaseAdminConfigured()) return null;
  return {
    loadAccounts: loadBackendAccountsAdmin,
    getById: fetchBackendAccountByIdAdmin,
    getByRecoveryCode: fetchBackendAccountByRecoveryCodeAdmin,
    getByGoogleUid: fetchBackendAccountByGoogleUidAdmin,
    saveAccount: async (record) => {
      await persistBackendAccountAdmin(record);
    },
    deleteAccount: deleteBackendAccountAdmin,
    claimPurchaseToken: claimVerifiedPurchaseTokenAdmin,
  };
}

export async function loadRoomMatchSessionsAdmin(
  roomCode: string,
  matchSeq: number
): Promise<ServerMatchSession[]> {
  const cleanCode = String(roomCode || '').trim().toUpperCase();
  if (!cleanCode) return [];
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return [];
  try {
    const db = getFirestore(adminApp);
    // Single-field where query avoids requiring any custom Firestore composite index on Spark plan
    const snap = await db
      .collection(BACKEND_MATCH_SESSIONS_COLLECTION)
      .where('roomCode', '==', cleanCode)
      .limit(20)
      .get();
    const out: ServerMatchSession[] = [];
    for (const doc of snap.docs) {
      const parsed = deserializeMatchSessionFromCloud(doc.data());
      if (parsed && (parsed.matchSeq ?? 1) === matchSeq) {
        out.push(parsed);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function claimMatchRewardAtomicAdmin(params: {
  claimKey: string;
  sessionId: string;
  accountId: string;
  roomCode?: string;
  matchSeq?: number;
  coinsAwarded: number;
  pointsAwarded: number;
  won?: boolean;
  fallbackAccountRecord?: PersistentAccountRecord;
  requireAccountCredit?: boolean;
}): Promise<{
  ok: boolean;
  duplicate?: boolean;
  creditedAccount?: PersistentAccountRecord | null;
}> {
  const cleanClaimKey = sanitizeRtdbKey(params.claimKey);
  const cleanSessionId = String(params.sessionId || '').trim();
  const cleanAccountId = String(params.accountId || '').trim();
  if (!cleanClaimKey || !cleanSessionId || !cleanAccountId) return { ok: false, duplicate: false };
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return { ok: true, duplicate: false, creditedAccount: null };
  }
  try {
    const db = getFirestore(adminApp);
    const claimRef = db.collection(BACKEND_REWARD_CLAIMS_COLLECTION).doc(cleanClaimKey);
    const sessionRef = db.collection(BACKEND_MATCH_SESSIONS_COLLECTION).doc(cleanSessionId);
    const accountRef = db.collection(BACKEND_ACCOUNTS_COLLECTION).doc(cleanAccountId);

    return await db.runTransaction(async (tx) => {
      const claimSnap = await tx.get(claimRef);
      if (claimSnap.exists) {
        return { ok: false, duplicate: true };
      }
      const sessionSnap = await tx.get(sessionRef);
      if (sessionSnap.exists && sessionSnap.data()?.completed === true) {
        return { ok: false, duplicate: true };
      }
      const accountSnap = await tx.get(accountRef);
      const baseAccount = accountSnap.exists
        ? deserializeAccountFromCloud(accountSnap.data())
        : params.fallbackAccountRecord || null;

      if (!baseAccount && params.requireAccountCredit) {
        // Hesap dokümanı yoksa claim kaydı oluşturmadan işlemi temiz biçimde iptal et (ödül kaybı olmaz)
        return { ok: false, duplicate: false };
      }

      const now = Date.now();
      let creditedAccount: PersistentAccountRecord | null = null;

      if (baseAccount) {
        const nextProgression = applyVerifiedMatchRewardToProgression(baseAccount.progression, {
          coinsAwarded: params.coinsAwarded,
          pointsAwarded: params.pointsAwarded,
          won: Boolean(params.won),
        });
        creditedAccount = {
          ...baseAccount,
          progression: nextProgression,
          updatedAt: now,
        };
        tx.set(accountRef, serializeAccountForCloud(creditedAccount), { merge: true });
      }

      tx.create(claimRef, {
        claimKey: params.claimKey,
        sessionId: cleanSessionId,
        accountId: cleanAccountId,
        roomCode: params.roomCode || null,
        matchSeq: params.matchSeq ?? null,
        coinsAwarded: params.coinsAwarded,
        pointsAwarded: params.pointsAwarded,
        won: Boolean(params.won),
        accountCreditedAtomically: Boolean(creditedAccount),
        creditedCoinsAfter: creditedAccount?.progression.coins ?? null,
        creditedWeeklyPointsAfter: creditedAccount?.progression.weeklyPoints ?? null,
        creditedTotalPointsAfter: creditedAccount?.progression.totalPoints ?? null,
        claimedAt: now,
      });

      if (sessionSnap.exists) {
        tx.set(sessionRef, { completed: true, updatedAt: now }, { merge: true });
      }

      return { ok: true, duplicate: false, creditedAccount };
    });
  } catch {
    return { ok: false, duplicate: false };
  }
}

export function createFirebaseMatchSessionCloudAdapter(): MatchSessionCloudAdapter | null {
  if (!isFirebaseAdminConfigured()) return null;
  return {
    loadActiveSessions: loadActiveMatchSessionsAdmin,
    getSessionById: fetchMatchSessionAdmin,
    loadRoomSessions: loadRoomMatchSessionsAdmin,
    saveSession: async (session) => {
      await persistMatchSessionAdmin(session);
    },
    claimRewardAtomic: claimMatchRewardAtomicAdmin,
  };
}
