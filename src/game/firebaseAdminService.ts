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
import { normalizeUsernameKey } from './accountEngine.js';
import { sanitizeRtdbKey } from './realtimeSyncHelpers.js';
import type { PlayerProfile, UserProgression } from './types.js';

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

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    parseServiceAccountFromEnv() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
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
        await db
          .collection('publicProfiles')
          .doc(usernameKey)
          .set(
            {
              usernameKey,
              ownerUid: cleanUid,
              displayName: displayName.slice(0, 32),
              avatar: (params.profile?.avatar || '⚽').slice(0, 64),
              friendCode: params.progression.friendCode || '',
              hasCrown: safeUnlocked.includes('gift_title_legend'),
              weeklyPoints: safeWeekly,
              totalPoints: safeTotal,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }
      syncedFirestore = true;
    } catch {
      syncedFirestore = false;
    }
  }

  try {
    const rtdb = getDatabase(adminApp);
    const key = sanitizeRtdbKey(params.accountId || cleanUid || displayName);
    await rtdb.ref(`leaderboard/${key}`).update({
      id: params.accountId,
      ownerUid: cleanUid || params.accountId,
      friendCode: params.progression.friendCode || null,
      name: displayName.slice(0, 32),
      avatar: (params.profile?.avatar || '⚽').slice(0, 64),
      weeklyPoints: safeWeekly,
      totalPoints: safeTotal,
      updatedAt: Date.now(),
    });
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
}): Promise<
  | { ok: true; matchSeq: number; playerScore: number; opponentScore: number }
  | { ok: false; error: string }
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
    if (room.state !== 'game_over') {
      return { ok: false, error: 'Çevrimiçi maç henüz tamamlanmamış.' };
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
}): Promise<void> {
  const adminApp = getFirebaseAdminApp();
  if (!adminApp) return;
  try {
    const rtdb = getDatabase(adminApp);
    if (params.accountId) {
      await rtdb.ref(`leaderboard/${sanitizeRtdbKey(params.accountId)}`).remove().catch(() => {});
    }
    if (params.uid) {
      await rtdb.ref(`leaderboard/${sanitizeRtdbKey(params.uid)}`).remove().catch(() => {});
      const db = getFirestore(adminApp);
      await db.collection('users').doc(params.uid).delete().catch(() => {});
    }
  } catch {
    // ignore cleanup failures
  }
}
