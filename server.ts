import express from 'express';
import fs from 'node:fs';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRandomPairings, validateAnswerForPairing } from './src/game/validator.js';
import { MATCH_PAIRINGS } from './src/game/database.js';
import { ensureExpandedRosterSync } from './src/game/rosterNodeLoader.js';
import {
  ROSTER_VERSION_MISMATCH_ERROR,
  areRosterVersionsCompatible,
} from './src/game/rosterVersion.js';
import {
  FriendActivityEvent,
  FriendRequestEntry,
  MinigameType,
  PublicPlayerProfile,
} from './src/game/types.js';
import { AccountStore, buildPublicProfileFromRecord } from './src/game/accountStore.js';
import {
  expressHeaderReader,
  handleAccountRegisterRequest,
  handleAccountSyncRequest,
} from './src/game/accountHttpHandlers.js';
import {
  isLegacyFlaggedUsername,
  normalizeUsernameKey,
  sanitizePublicDisplayName,
} from './src/game/accountEngine.js';
import {
  ServerMatchLedger,
  SlidingRateLimiter,
  applySecurityHeaders,
  sanitizeLeaderboardNumbers,
} from './src/game/serverSecurity.js';
import {
  findGooglePlaySkuByItemId,
  findGooglePlaySkuByProductId,
  findRestorableGooglePlaySkuByItemId,
  findRestorableGooglePlaySkuByProductId,
} from './src/game/billingCatalog.js';
import { verifyGooglePlayProductReceipt } from './src/game/googlePlayVerifier.js';
import {
  claimLegacyRtdbLeaderboardAdmin,
  createFirebaseAccountCloudAdapter,
  createFirebaseMatchSessionCloudAdapter,
  deleteUserFirebaseRecordsAdmin,
  isFirebaseAdminConfigured,
  recordDeletedAccountTombstoneAdmin,
  saveModerationReportAdmin,
  syncAuthoritativeUserStateAdmin,
  verifyFirebaseBearerToken,
  verifyOnlineRoomOutcomeAdmin,
} from './src/game/firebaseAdminService.js';

const VALID_MINIGAMES: MinigameType[] = [
  'two_clubs',
  'xox',
  'career',
  'country_club',
  'silhouette',
];

function parseMinigameType(raw: unknown): MinigameType {
  const s = String(raw || 'two_clubs') as MinigameType;
  return VALID_MINIGAMES.includes(s) ? s : 'two_clubs';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(applySecurityHeaders);

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '');
  const staticAllowed = new Set<string>([
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    'https://bugra4kagan.github.io',
  ]);
  if (process.env.APP_URL?.trim()) {
    try {
      staticAllowed.add(new URL(process.env.APP_URL.trim()).origin);
    } catch {
      // ignore invalid APP_URL
    }
  }
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  for (const item of extra) {
    if (item === '*') return true;
    staticAllowed.add(item);
  }
  if (staticAllowed.has(normalized)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)) return true;
  return false;
}

app.use((req, res, next) => {
  const origin = req.header('origin');
  if (origin && isAllowedCorsOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Account-Token, X-Firebase-Id-Token, X-Firebase-AppCheck'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '512kb' }));

const recoverLimiter = new SlidingRateLimiter(10, 5 * 60 * 1000);
const accountWriteLimiter = new SlidingRateLimiter(45, 60 * 1000);
const socialLimiter = new SlidingRateLimiter(30, 60 * 1000);
const serverRosterStatus = ensureExpandedRosterSync();
const serverMatchLedger = new ServerMatchLedger();

function getClientRateKey(req: express.Request): string {
  const fwd = req.header('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0] : req.ip || req.socket?.remoteAddress || 'unknown').trim();
  return ip.slice(0, 96);
}

function readAccountToken(req: express.Request): string | undefined {
  const direct = req.header('x-account-token');
  if (direct && direct.trim()) return direct.trim();
  const authHeader = req.header('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

function enforceRateLimit(
  limiter: SlidingRateLimiter,
  req: express.Request,
  res: express.Response
): boolean {
  const check = limiter.consume(getClientRateKey(req));
  if (!check.allowed) {
    res.setHeader('Retry-After', String(check.retryAfterSec));
    res.status(429).json({
      ok: false,
      error: 'Çok fazla istek gönderildi. Lütfen kısa süre bekleyip tekrar dene.',
    });
    return false;
  }
  return true;
}

const REQUIRE_CLOUD_PERSISTENCE =
  process.env.NODE_ENV === 'production' || process.env.REQUIRE_CLOUD_PERSISTENCE === 'true';

function isUnsafeLocalStorageBlocked(): boolean {
  return REQUIRE_CLOUD_PERSISTENCE && !isFirebaseAdminConfigured();
}

const CLOUD_PERSISTENCE_PROTECTED_PREFIXES = [
  '/api/accounts/register',
  '/api/accounts/sync',
  '/api/accounts/recover',
  '/api/accounts/by-id',
  '/api/leaderboard/sync',
  '/api/matches',
  '/api/store/spend-coins',
  '/api/migration/claim-legacy-rtdb',
  '/api/billing/verify-google-play',
];

// API Endpoints
app.get('/healthz', (_req, res) => {
  const blocked = isUnsafeLocalStorageBlocked();
  res.status(200).json({
    ok: true,
    status: blocked ? 'degraded_missing_firebase_admin' : 'ok',
    uptimeSec: Math.round(process.uptime()),
    firebaseAdminConfigured: isFirebaseAdminConfigured(),
    cloudPersistenceReady: !blocked,
    unsafeLocalStorageBlocked: blocked,
    localDiskFallbackEnabled: accountStore.hasLocalDiskPersistence(),
    rosterVersion: serverRosterStatus.version,
    totalPlayers: serverRosterStatus.totalPlayers,
    totalClubs: serverRosterStatus.totalClubs,
  });
});

app.get('/api/health', (_req, res) => {
  const blocked = isUnsafeLocalStorageBlocked();
  res.json({
    ok: true,
    status: blocked ? 'degraded_missing_firebase_admin' : 'ok',
    time: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    firebaseAdminConfigured: isFirebaseAdminConfigured(),
    cloudPersistenceReady: !blocked,
    unsafeLocalStorageBlocked: blocked,
    localDiskFallbackEnabled: accountStore.hasLocalDiskPersistence(),
    rosterVersion: serverRosterStatus.version,
    totalPlayers: serverRosterStatus.totalPlayers,
    totalClubs: serverRosterStatus.totalClubs,
  });
});

app.use((req, res, next) => {
  if (
    isUnsafeLocalStorageBlocked() &&
    CLOUD_PERSISTENCE_PROTECTED_PREFIXES.some((prefix) => req.path.startsWith(prefix))
  ) {
    return res.status(503).json({
      ok: false,
      code: 'CLOUD_PERSISTENCE_UNAVAILABLE',
      error:
        'Firebase Admin bağlantısı eksik olduğu için güvensiz yerel veri depolaması engellendi.',
    });
  }
  next();
});

type LiveLeaderboardRecord = PublicPlayerProfile;

const EMPTY_MINIGAME_COUNTS: Record<MinigameType, number> = {
  two_clubs: 0,
  silhouette: 0,
  xox: 0,
  career: 0,
  country_club: 0,
};

function sanitizeMinigameCounts(raw: unknown): Record<MinigameType, number> {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    two_clubs: Math.max(0, Number(obj.two_clubs) || 0),
    silhouette: Math.max(0, Number(obj.silhouette) || 0),
    xox: Math.max(0, Number(obj.xox) || 0),
    career: Math.max(0, Number(obj.career) || 0),
    country_club: Math.max(0, Number(obj.country_club) || 0),
  };
}

const liveLeaderboard = new Map<string, LiveLeaderboardRecord>();
const accountStore = new AccountStore();
accountStore.setCloudAdapter(createFirebaseAccountCloudAdapter());
serverMatchLedger.setCloudAdapter(createFirebaseMatchSessionCloudAdapter());

// Seed leaderboard from persisted accounts on server startup
for (const acc of accountStore.listAll()) {
  liveLeaderboard.set(acc.accountId, buildPublicProfileFromRecord(acc));
}

async function hydrateBackendStateFromCloud(): Promise<void> {
  try {
    const [restoredAccounts, restoredSessions] = await Promise.all([
      accountStore.hydrateFromCloud(2000),
      serverMatchLedger.hydrateFromCloud(500),
    ]);
    for (const acc of accountStore.listAll()) {
      liveLeaderboard.set(acc.accountId, buildPublicProfileFromRecord(acc));
    }
    if (restoredAccounts > 0 || restoredSessions > 0) {
      console.log(
        `[CloudHydration] Restored ${restoredAccounts} accounts and ${restoredSessions} active match sessions from Firestore.`
      );
    }
  } catch (err) {
    console.warn('[CloudHydration] Non-fatal hydration error:', err);
  }
}

function sanitizeLeaderboardEntry(rec: LiveLeaderboardRecord): LiveLeaderboardRecord {
  return {
    ...rec,
    name: sanitizePublicDisplayName(rec.name, rec.id),
    usernameKey: isLegacyFlaggedUsername(rec.name) ? undefined : rec.usernameKey,
  };
}

function getSortedLiveLeaderboard(): LiveLeaderboardRecord[] {
  return Array.from(liveLeaderboard.values())
    .map(sanitizeLeaderboardEntry)
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
    .slice(0, 50);
}

// Persistent Account & Unique Username Endpoints
app.get('/api/accounts/check-username', (req, res) => {
  const name = String(req.query.name || '');
  const accountId = req.query.accountId ? String(req.query.accountId) : undefined;
  const googleUid = req.query.googleUid ? String(req.query.googleUid) : undefined;
  const result = accountStore.checkUsername(name, accountId, googleUid);
  res.json(result);
});

app.get('/api/accounts/suggest-name', (_req, res) => {
  res.json({ ok: true, name: accountStore.suggestRandomStarterName() });
});

app.get('/api/accounts/by-id/:accountId', async (req, res) => {
  const accountId = String(req.params.accountId || '').trim();
  const rec = await accountStore.resolveByAccountIdAsync(accountId);
  if (!rec) {
    return res.json({ ok: false, found: false });
  }
  const token = readAccountToken(req);
  if (!accountStore.verifyAccountSession(accountId, token)) {
    return res.status(401).json({ ok: false, error: 'Oturum doğrulaması gerekli.' });
  }
  res.json({
    ok: true,
    found: true,
    requiresUsernameRename: isLegacyFlaggedUsername(rec.profile?.name || rec.username),
    account: {
      accountId: rec.accountId,
      recoveryCode: rec.recoveryCode,
      profile: rec.profile,
      progression: rec.progression,
    },
  });
});

app.delete('/api/accounts/by-id/:accountId', async (req, res) => {
  if (!enforceRateLimit(accountWriteLimiter, req, res)) return;
  const accountId = String(req.params.accountId || '').trim();
  if (!accountId) {
    return res.status(400).json({ ok: false, error: 'Geçersiz hesap kimliği.' });
  }
  const verifiedUser = await verifyFirebaseBearerToken(req.header('x-firebase-id-token'));
  const existing = await accountStore.resolveByAccountIdAsync(accountId);
  if (!existing && !verifiedUser) {
    return res.json({
      ok: true,
      deleted: false,
      firebaseCleanup: { rtdbCleared: false, firestoreCleared: false, authDeleted: false },
    });
  }
  const token = readAccountToken(req);
  const sessionValid = existing ? accountStore.verifyAccountSession(accountId, token) : false;
  const googleOwnerValid = Boolean(
    verifiedUser?.uid && (!existing?.googleUid || existing.googleUid === verifiedUser.uid)
  );
  if (!sessionValid && !googleOwnerValid) {
    return res.status(401).json({ ok: false, error: 'Bu hesabı silme yetkin yok.' });
  }

  const deleted = existing ? await accountStore.deleteByAccountIdAsync(accountId) : false;
  liveLeaderboard.delete(accountId);
  // Silinen hesabın bekleyen tüm arkadaşlık isteklerini temizle
  for (let i = serverFriendRequests.length - 1; i >= 0; i--) {
    const reqEntry = serverFriendRequests[i];
    if (reqEntry.fromPlayerId === accountId || reqEntry.toPlayerId === accountId) {
      serverFriendRequests.splice(i, 1);
    }
  }
  const resolvedUid = verifiedUser?.uid || existing?.googleUid;
  const firebaseCleanup = await deleteUserFirebaseRecordsAdmin({
    uid: resolvedUid,
    accountId,
    displayName: existing?.profile?.name || existing?.username,
    deleteAuthUser: Boolean(verifiedUser?.uid),
  });
  const tombstoneRecorded = await recordDeletedAccountTombstoneAdmin({
    accountId,
    uid: resolvedUid,
  });
  res.json({ ok: true, deleted, firebaseCleanup, tombstoneRecorded });
});

app.post('/api/accounts/register', async (req, res) => {
  const response = await handleAccountRegisterRequest({
    deps: {
      accountStore,
      verifyFirebaseBearerToken,
      syncAuthoritativeUserStateAdmin,
      buildPublicProfileFromRecord,
      liveLeaderboard,
      rateLimiter: accountWriteLimiter,
      clientRateKey: getClientRateKey(req),
    },
    body: req.body,
    getHeader: expressHeaderReader(req),
  });
  if (response.headers) {
    for (const [k, v] of Object.entries(response.headers)) {
      res.setHeader(k, v);
    }
  }
  return res.status(response.status).json(response.body);
});

app.post('/api/accounts/sync', async (req, res) => {
  const response = await handleAccountSyncRequest({
    deps: {
      accountStore,
      verifyFirebaseBearerToken,
      syncAuthoritativeUserStateAdmin,
      buildPublicProfileFromRecord,
      liveLeaderboard,
      rateLimiter: accountWriteLimiter,
      clientRateKey: getClientRateKey(req),
    },
    body: req.body,
    getHeader: expressHeaderReader(req),
  });
  if (response.headers) {
    for (const [k, v] of Object.entries(response.headers)) {
      res.setHeader(k, v);
    }
  }
  return res.status(response.status).json(response.body);
});

app.post('/api/accounts/recover', async (req, res) => {
  if (!enforceRateLimit(recoverLimiter, req, res)) return;
  const { recoveryCode, username } = req.body || {};
  const result = await accountStore.recoverByCodeAsync(
    String(recoveryCode || ''),
    username ? String(username) : undefined
  );
  if (!result.ok) {
    return res.status(404).json({ ok: false, error: result.reason });
  }
  const acc = result.account;
  const sessionToken = accountStore.issueSessionTokenForAccount(acc);
  res.json({
    ok: true,
    sessionToken,
    requiresUsernameRename: isLegacyFlaggedUsername(acc.profile?.name || acc.username),
    account: {
      accountId: acc.accountId,
      recoveryCode: acc.recoveryCode,
      profile: acc.profile,
      progression: acc.progression,
    },
  });
});

app.get('/api/leaderboard', (_req, res) => {
  const players = getSortedLiveLeaderboard();
  res.json({ players, entries: players });
});

app.post('/api/leaderboard/sync', async (req, res) => {
  if (!enforceRateLimit(accountWriteLimiter, req, res)) return;
  const body = req.body || {};
  const { id, friendCode, name, avatar, weeklyPoints, totalPoints, subtitle, hasCrown } = body;
  if (!id || !name) {
    return res.status(400).json({ error: 'Missing player identity' });
  }
  const cleanId = String(id).trim().slice(0, 64);
  const storedAccount = await accountStore.resolveByAccountIdAsync(cleanId);
  if (!storedAccount && process.env.ALLOW_LEGACY_UNLINKED_LEADERBOARD_SYNC !== 'true') {
    return res.status(401).json({
      ok: false,
      error: 'Liderlik tablosu güncellemesi için kayıtlı hesap oturumu gereklidir.',
    });
  }
  if (storedAccount) {
    const token = readAccountToken(req);
    if (!accountStore.verifyAccountSession(cleanId, token)) {
      return res.status(401).json({ ok: false, error: 'Liderlik tablosu güncelleme yetkisi doğrulanamadı.' });
    }
  } else if (isLegacyFlaggedUsername(String(name))) {
    return res.status(400).json({ ok: false, error: 'Geçersiz veya uygunsuz kullanıcı adı liderlik tablosuna yazılamaz.' });
  }
  const existing = liveLeaderboard.get(cleanId);
  const prevWeekly = existing?.weeklyPoints ?? 0;
  let prevTopWeekly = 0;
  for (const rec of liveLeaderboard.values()) {
    if (rec.id !== cleanId && rec.weeklyPoints > prevTopWeekly) {
      prevTopWeekly = rec.weeklyPoints;
    }
  }
  const cleanName = sanitizePublicDisplayName(String(name).slice(0, 20), cleanId);
  // Kayıtlı hesaplarda sunucunun doğrulanmış puanı esastır; istemciden gelen keyfi puan artırımı kabul edilmez
  const boundedScores = storedAccount
    ? {
        weeklyPoints: storedAccount.progression.weeklyPoints,
        totalPoints: storedAccount.progression.totalPoints,
      }
    : sanitizeLeaderboardNumbers(existing, weeklyPoints, totalPoints);
  const nextWeekly = boundedScores.weeklyPoints;
  const nextAvatar = String(avatar || existing?.avatar || '⚽').slice(0, 64);
  const nextFriendCode = friendCode ? String(friendCode).slice(0, 12) : existing?.friendCode;
  liveLeaderboard.set(cleanId, {
    id: cleanId,
    usernameKey: isLegacyFlaggedUsername(String(name))
      ? undefined
      : normalizeUsernameKey(cleanName) || existing?.usernameKey,
    friendCode: friendCode ? String(friendCode).slice(0, 12) : existing?.friendCode,
    name: cleanName,
    avatar: String(avatar || existing?.avatar || '⚽').slice(0, 64),
    favoriteClubId:
      typeof body.favoriteClubId === 'string' && body.favoriteClubId
        ? body.favoriteClubId.slice(0, 64)
        : existing?.favoriteClubId,
    subtitle: subtitle ? String(subtitle).slice(0, 32) : undefined,
    equippedCrest:
      typeof body.equippedCrest === 'string' ? body.equippedCrest.slice(0, 64) : existing?.equippedCrest,
    equippedFrame:
      typeof body.equippedFrame === 'string' ? body.equippedFrame.slice(0, 64) : existing?.equippedFrame,
    equippedBadge:
      typeof body.equippedBadge === 'string' ? body.equippedBadge.slice(0, 16) : existing?.equippedBadge,
    hasCrown: Boolean(hasCrown),
    weeklyPoints: boundedScores.weeklyPoints,
    totalPoints: boundedScores.totalPoints,
    matchesPlayed:
      body.matchesPlayed !== undefined
        ? Math.max(0, Number(body.matchesPlayed) || 0)
        : existing?.matchesPlayed ?? 0,
    wins:
      body.wins !== undefined ? Math.max(0, Number(body.wins) || 0) : existing?.wins ?? 0,
    losses:
      body.losses !== undefined ? Math.max(0, Number(body.losses) || 0) : existing?.losses ?? 0,
    winStreak:
      body.winStreak !== undefined
        ? Math.max(0, Number(body.winStreak) || 0)
        : existing?.winStreak ?? 0,
    bestWinStreak:
      body.bestWinStreak !== undefined
        ? Math.max(0, Number(body.bestWinStreak) || 0)
        : existing?.bestWinStreak ?? 0,
    totalCorrectAnswers:
      body.totalCorrectAnswers !== undefined
        ? Math.max(0, Number(body.totalCorrectAnswers) || 0)
        : existing?.totalCorrectAnswers ?? 0,
    totalWrongAttempts:
      body.totalWrongAttempts !== undefined
        ? Math.max(0, Number(body.totalWrongAttempts) || 0)
        : existing?.totalWrongAttempts ?? 0,
    fastestAnswerSec:
      typeof body.fastestAnswerSec === 'number' && Number.isFinite(body.fastestAnswerSec)
        ? body.fastestAnswerSec
        : body.fastestAnswerSec === null
        ? null
        : existing?.fastestAnswerSec ?? null,
    clutchAnswers:
      body.clutchAnswers !== undefined
        ? Math.max(0, Number(body.clutchAnswers) || 0)
        : existing?.clutchAnswers ?? 0,
    minigameMatchCounts: body.minigameMatchCounts
      ? sanitizeMinigameCounts(body.minigameMatchCounts)
      : existing?.minigameMatchCounts ?? { ...EMPTY_MINIGAME_COUNTS },
    dailyStreakDays:
      body.dailyStreakDays !== undefined
        ? Math.max(0, Number(body.dailyStreakDays) || 0)
        : existing?.dailyStreakDays ?? 0,
    tournamentWins:
      body.tournamentWins !== undefined
        ? Math.max(0, Number(body.tournamentWins) || 0)
        : existing?.tournamentWins ?? 0,
    tournamentsPlayed:
      body.tournamentsPlayed !== undefined
        ? Math.max(0, Number(body.tournamentsPlayed) || 0)
        : existing?.tournamentsPlayed ?? 0,
    updatedAt: Date.now(),
  });

  if (!body.suppressAutoHighScore && nextWeekly > prevWeekly) {
    const crossedTier =
      nextWeekly >= 500 && Math.floor(nextWeekly / 500) > Math.floor(prevWeekly / 500);
    const tookOverallLead = nextWeekly >= 300 && prevTopWeekly > 0 && nextWeekly > prevTopWeekly;
    if (crossedTier || tookOverallLead) {
      broadcastFriendActivity({
        id: `hs_${cleanId}_${Math.round(nextWeekly)}`,
        type: 'high_score',
        actorId: cleanId,
        actorFriendCode: nextFriendCode,
        actorName: cleanName,
        actorAvatar: nextAvatar,
        title: `${cleanName} yüksek skor yaptı!`,
        message: tookOverallLead
          ? `${Math.round(nextWeekly).toLocaleString('tr-TR')} puanla haftalık liderliğe yükseldi!`
          : `Haftalık ${Math.round(nextWeekly).toLocaleString('tr-TR')} puan barajını aştı!`,
        scoreValue: Math.round(nextWeekly),
        createdAt: Date.now(),
      });
    }
  }

  res.json({ ok: true, players: getSortedLiveLeaderboard() });
});

// Public Player Profile Search & Inspection (Zero PII / Zero Wallet Coins)
app.get('/api/profiles', (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
  const merged = new Map<string, PublicPlayerProfile>();

  for (const profile of accountStore.searchPublicProfiles(q, limit)) {
    merged.set(profile.id, profile);
  }

  const lowerQ = q.toLowerCase();
  const normQ = normalizeUsernameKey(q);
  for (const live of liveLeaderboard.values()) {
    const existing = merged.get(live.id);
    if (!q) {
      if (!existing || live.updatedAt > existing.updatedAt) {
        merged.set(live.id, live);
      }
      continue;
    }
    const codeLower = (live.friendCode || '').toLowerCase();
    const keyLower = (live.usernameKey || normalizeUsernameKey(live.name)).toLowerCase();
    if (
      live.name.toLowerCase().includes(lowerQ) ||
      (normQ.length > 0 && keyLower.includes(normQ)) ||
      codeLower.includes(lowerQ) ||
      live.id.toLowerCase() === lowerQ
    ) {
      if (!existing || live.updatedAt > existing.updatedAt) {
        merged.set(live.id, live);
      }
    }
  }

  const profiles = Array.from(merged.values())
    .map(sanitizeLeaderboardEntry)
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.totalPoints - a.totalPoints)
    .slice(0, limit);

  res.json({ ok: true, profiles });
});

app.get('/api/profiles/:identifier', (req, res) => {
  const identifier = String(req.params.identifier || '').trim();
  if (!identifier) {
    return res.status(400).json({ ok: false, found: false });
  }

  const fromStore = accountStore.findPublicProfile(identifier);
  const normId = normalizeUsernameKey(identifier);
  const lowerId = identifier.toLowerCase();

  let fromLive: PublicPlayerProfile | null = liveLeaderboard.get(identifier) || null;
  if (!fromLive) {
    for (const live of liveLeaderboard.values()) {
      const liveKey = live.usernameKey || normalizeUsernameKey(live.name);
      if (
        live.id === identifier ||
        (normId && liveKey === normId) ||
        (live.friendCode && live.friendCode.toLowerCase() === lowerId) ||
        live.name.toLowerCase() === lowerId
      ) {
        fromLive = live;
        break;
      }
    }
  }

  const chosen =
    fromStore && fromLive
      ? fromLive.updatedAt >= fromStore.updatedAt
        ? { ...fromStore, ...fromLive }
        : fromStore
      : fromLive || fromStore;

  if (!chosen) {
    return res.json({ ok: false, found: false });
  }

  res.json({ ok: true, found: true, profile: sanitizeLeaderboardEntry(chosen) });
});

app.get('/api/pairings', (_req, res) => {
  res.json({ pairings: getRandomPairings(10) });
});

app.post('/api/validate', (req, res) => {
  const { answer, pairingId } = req.body || {};
  if (typeof answer !== 'string' || typeof pairingId !== 'string') {
    return res.status(400).json({ error: 'Invalid answer payload' });
  }
  const pairing = MATCH_PAIRINGS.find((p) => p.id === pairingId);
  if (!pairing) {
    return res.status(404).json({ error: 'Pairing not found' });
  }
  const result = validateAnswerForPairing(answer.slice(0, 120), pairing);
  res.json(result);
});

// ── Sunucu Doğrulamalı Maç Oturumu & Ödül İşlemleri ──
app.post('/api/matches/start', async (req, res) => {
  if (!enforceRateLimit(accountWriteLimiter, req, res)) return;
  const { accountId, minigameType, mode, roundIds, roomCode, matchSeq, rosterVersion } = req.body || {};
  const cleanId = String(accountId || '').trim().slice(0, 64);
  if (!cleanId) {
    return res.status(400).json({ ok: false, error: 'Geçersiz oyuncu kimliği.' });
  }
  const cleanMode = String(mode || 'solo').trim();
  const isOnlineRequest = cleanMode.startsWith('online') || Boolean(roomCode);
  if (
    (isOnlineRequest || rosterVersion !== undefined) &&
    !areRosterVersionsCompatible(rosterVersion, serverRosterStatus.version)
  ) {
    return res.status(409).json({
      ok: false,
      errorCode: 'roster_version_mismatch',
      error: ROSTER_VERSION_MISMATCH_ERROR,
      serverRosterVersion: serverRosterStatus.version,
    });
  }
  const existing = await accountStore.resolveByAccountIdAsync(cleanId);
  if (existing && !accountStore.verifyAccountSession(cleanId, readAccountToken(req))) {
    return res.status(401).json({ ok: false, error: 'Hesap oturumu doğrulanamadı.' });
  }
  const session = serverMatchLedger.issueSession({
    accountId: cleanId,
    minigameType: String(minigameType || 'two_clubs'),
    mode: cleanMode,
    roomCode: typeof roomCode === 'string' ? roomCode : undefined,
    matchSeq: typeof matchSeq === 'number' ? matchSeq : undefined,
    rosterVersion: serverRosterStatus.version,
    roundIds: Array.isArray(roundIds) ? roundIds : undefined,
  });
  res.json({
    ok: true,
    matchSessionId: session.sessionId,
    startedAt: session.startedAt,
    roundsCount: session.rounds.length,
    rosterVersion: serverRosterStatus.version,
  });
});

app.post('/api/matches/answer', async (req, res) => {
  if (!enforceRateLimit(accountWriteLimiter, req, res)) return;
  const { accountId, matchSessionId, roundIndex, answer, cellPos } = req.body || {};
  const cleanId = String(accountId || '').trim().slice(0, 64);
  const existing = await accountStore.resolveByAccountIdAsync(cleanId);
  if (existing && !accountStore.verifyAccountSession(cleanId, readAccountToken(req))) {
    return res.status(401).json({ ok: false, error: 'Hesap oturumu doğrulanamadı.' });
  }
  await serverMatchLedger.resolveSessionAsync(String(matchSessionId || ''));
  const ansRes = serverMatchLedger.submitVerifiedAnswer({
    sessionId: String(matchSessionId || ''),
    accountId: cleanId,
    roundIndex: Number(roundIndex),
    answer: String(answer || ''),
    cellPos:
      cellPos && typeof cellPos.row === 'number' && typeof cellPos.col === 'number'
        ? { row: cellPos.row, col: cellPos.col }
        : undefined,
  });
  if (!ansRes.ok) {
    return res.status(400).json({ ok: false, error: ansRes.reason });
  }
  res.json({
    ok: true,
    valid: ansRes.valid,
    verifiedPlayerScore: ansRes.verifiedPlayerScore,
  });
});

app.post('/api/matches/complete', async (req, res) => {
  if (!enforceRateLimit(accountWriteLimiter, req, res)) return;
  const { accountId, matchSessionId, roomCode, botScores } = req.body || {};
  const cleanId = String(accountId || '').trim().slice(0, 64);
  const existing = await accountStore.resolveByAccountIdAsync(cleanId);
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'Hesap kaydı bulunamadı.' });
  }
  if (!accountStore.verifyAccountSession(cleanId, readAccountToken(req))) {
    return res.status(401).json({ ok: false, error: 'Hesap oturumu doğrulanamadı.' });
  }

  await serverMatchLedger.resolveSessionAsync(String(matchSessionId || ''));

  let serverVerifiedOpponentScore: number | null | undefined;
  let requireServerOpponentVerification = false;
  let roomClaimKey: string | undefined;
  const firebaseAuthToken = req.header('x-firebase-id-token');
  const verifiedUser = await verifyFirebaseBearerToken(firebaseAuthToken);

  if (roomCode) {
    if (!verifiedUser) {
      return res.status(401).json({
        ok: false,
        error: 'Çevrimiçi maç sonucu doğrulaması için geçerli Firebase kimlik doğrulaması gerekir.',
      });
    }
    const cleanRoomCode = String(roomCode).trim().toUpperCase();
    const roomCheck = await verifyOnlineRoomOutcomeAdmin({
      roomCode: cleanRoomCode,
      uid: verifiedUser.uid,
      playerId: cleanId,
      expectedRosterVersion: serverRosterStatus.version,
    });
    if (!roomCheck.ok) {
      const status = roomCheck.errorCode === 'roster_version_mismatch' ? 409 : 403;
      return res.status(status).json({
        ok: false,
        ...(roomCheck.errorCode ? { errorCode: roomCheck.errorCode } : {}),
        error: roomCheck.error,
      });
    }
    // İstemci tarafından değiştirilebilir Firestore oda skorlarına (roomCheck.playerScore / opponentScore) ASLA güvenilmez.
    // Her iki oyuncunun skoru yalnızca sunucuda /api/matches/answer ile doğrulanmış oturumlardan hesaplanır.
    const opponentServerScore = await serverMatchLedger.findOpponentVerifiedScoreAsync(
      cleanRoomCode,
      roomCheck.matchSeq,
      cleanId
    );
    if (opponentServerScore === null) {
      return res.status(403).json({
        ok: false,
        errorCode: 'unverified_opponent_session',
        error:
          'Her iki oyuncunun sunucu cevap doğrulaması bulunmadığından rekabetçi ödül verilemez.',
      });
    }
    serverVerifiedOpponentScore = opponentServerScore;
    requireServerOpponentVerification = true;
    roomClaimKey = `${cleanRoomCode}:${roomCheck.matchSeq}:${cleanId}`;
  }

  const normalizedBotScores =
    !roomCode &&
    botScores &&
    typeof botScores === 'object' &&
    typeof (botScores as { playerScore?: unknown }).playerScore === 'number' &&
    typeof (botScores as { opponentScore?: unknown }).opponentScore === 'number'
      ? {
          playerScore: (botScores as { playerScore: number }).playerScore,
          opponentScore: (botScores as { opponentScore: number }).opponentScore,
        }
      : undefined;

  const hasMult = Boolean(
    existing.progression.permanentMultiplier2x || (existing.progression.multiplier2xMatches ?? 0) > 0
  );
  const outcome = await serverMatchLedger.consumeVerifiedMatchSessionAsync({
    sessionId: String(matchSessionId || ''),
    accountId: cleanId,
    hasMultiplier2x: hasMult,
    botScores: normalizedBotScores,
    serverVerifiedOpponentScore,
    requireServerOpponentVerification,
    roomClaimKey,
    fallbackAccountRecord: existing,
    requireAccountCredit: isFirebaseAdminConfigured(),
  });

  if (!outcome.ok) {
    const statusCode = outcome.retryable ? 503 : outcome.duplicate ? 409 : 400;
    return res.status(statusCode).json({
      ok: false,
      retryable: Boolean(outcome.retryable),
      duplicate: Boolean(outcome.duplicate),
      error: outcome.reason,
    });
  }

  let updatedAccount = outcome.creditedAccount
    ? accountStore.applyAuthoritativeAccountSnapshot(outcome.creditedAccount)
    : null;

  if (!updatedAccount) {
    const applied = accountStore.recordVerifiedMatchReward({
      accountId: cleanId,
      coinsAwarded: outcome.coinsAwarded,
      pointsAwarded: outcome.pointsAwarded,
      won: outcome.won,
      isDraw: outcome.drew,
    });
    if (!applied.ok || !applied.account) {
      return res.status(500).json({ ok: false, error: 'Ödül işlenemedi.' });
    }
    updatedAccount = applied.account;
  }

  liveLeaderboard.set(updatedAccount.accountId, buildPublicProfileFromRecord(updatedAccount));
  const cloudSync = await syncAuthoritativeUserStateAdmin({
    uid: verifiedUser?.uid || updatedAccount.googleUid,
    accountId: updatedAccount.accountId,
    profile: updatedAccount.profile,
    progression: updatedAccount.progression,
    email: verifiedUser?.email,
  });

  res.json({
    ok: true,
    won: outcome.won,
    isDraw: outcome.drew,
    verifiedScore: outcome.verifiedScore,
    coinsAwarded: outcome.coinsAwarded,
    pointsAwarded: outcome.pointsAwarded,
    progression: updatedAccount.progression,
    cloudSync,
  });
});

app.post('/api/store/spend-coins', async (req, res) => {
  if (!enforceRateLimit(accountWriteLimiter, req, res)) return;
  const { accountId, itemId } = req.body || {};
  const cleanId = String(accountId || '').trim().slice(0, 64);
  await accountStore.resolveByAccountIdAsync(cleanId);
  if (!accountStore.verifyAccountSession(cleanId, readAccountToken(req))) {
    return res.status(401).json({ ok: false, error: 'Hesap oturumu doğrulanamadı.' });
  }
  const spendRes = accountStore.spendCoinsForItem({
    accountId: cleanId,
    itemId: String(itemId || ''),
  });
  if (!spendRes.ok || !spendRes.account) {
    return res.status(400).json({ ok: false, error: spendRes.reason || 'Harcama başarısız.' });
  }
  const verifiedUser = await verifyFirebaseBearerToken(req.header('x-firebase-id-token'));
  await syncAuthoritativeUserStateAdmin({
    uid: verifiedUser?.uid || spendRes.account.googleUid,
    accountId: spendRes.account.accountId,
    profile: spendRes.account.profile,
    progression: spendRes.account.progression,
    email: verifiedUser?.email,
  });
  res.json({ ok: true, progression: spendRes.account.progression });
});

app.post('/api/migration/claim-legacy-rtdb', async (req, res) => {
  if (!enforceRateLimit(accountWriteLimiter, req, res)) return;
  const { accountId, playerKey } = req.body || {};
  const cleanId = String(accountId || '').trim().slice(0, 64);
  if (!cleanId || !playerKey) {
    return res.status(400).json({ ok: false, error: 'Eksik geçiş parametresi.' });
  }
  await accountStore.resolveByAccountIdAsync(cleanId);
  if (!accountStore.verifyAccountSession(cleanId, readAccountToken(req))) {
    return res.status(401).json({ ok: false, error: 'Hesap oturumu doğrulanamadı.' });
  }
  const verifiedUser = await verifyFirebaseBearerToken(req.header('x-firebase-id-token'));
  if (!verifiedUser) {
    return res.status(401).json({
      ok: false,
      error: 'Eski RTDB kaydı devralma işlemi için geçerli Firebase Auth tokenı zorunludur.',
    });
  }
  const claim = await claimLegacyRtdbLeaderboardAdmin({
    verifiedUid: verifiedUser.uid,
    playerKey: String(playerKey),
    expectedAccountId: cleanId,
  });
  if (!claim.ok) {
    return res.status(claim.statusCode).json({ ok: false, error: claim.error });
  }
  res.json({
    ok: true,
    weeklyPoints: claim.weeklyPoints,
    totalPoints: claim.totalPoints,
  });
});

// ── Google Play Billing 9.1.0 Sunucu Doğrulaması ──
app.post('/api/billing/verify-google-play', async (req, res) => {
  if (!enforceRateLimit(accountWriteLimiter, req, res)) return;
  const { accountId, itemId, productId, purchaseToken, orderId, isRestore } = req.body || {};
  const cleanId = String(accountId || '').trim().slice(0, 64);
  if (!cleanId || !itemId || !productId || !purchaseToken) {
    return res.status(400).json({
      ok: false,
      verified: false,
      error: 'Eksik satın alma doğrulama bilgisi.',
    });
  }

  const existing = await accountStore.resolveByAccountIdAsync(cleanId);
  if (existing) {
    const token = readAccountToken(req);
    if (!accountStore.verifyAccountSession(cleanId, token)) {
      return res.status(401).json({
        ok: false,
        verified: false,
        error: 'Hesap oturumu doğrulanamadı.',
      });
    }
  }

  const verification = await verifyGooglePlayProductReceipt({
    itemId: String(itemId),
    productId: String(productId),
    purchaseToken: String(purchaseToken),
    allowLegacyRestore: Boolean(isRestore),
  });

  if (!verification.verified) {
    return res.status(verification.statusCode).json({
      ok: false,
      verified: false,
      error: verification.error || 'Google Play makbuzu doğrulanamadı.',
    });
  }

  const sku = Boolean(isRestore)
    ? findRestorableGooglePlaySkuByItemId(String(itemId)) ||
      findRestorableGooglePlaySkuByProductId(String(productId))
    : findGooglePlaySkuByItemId(String(itemId)) || findGooglePlaySkuByProductId(String(productId));
  if (!sku) {
    return res.status(400).json({ ok: false, verified: false, error: 'Geçersiz veya satışa kapalı ürün SKU.' });
  }

  if (existing) {
    const applied = await accountStore.applyVerifiedPurchaseAsync({
      accountId: cleanId,
      itemId: sku.itemId,
      productId: sku.productId,
      purchaseToken: String(purchaseToken),
      orderId: verification.orderId || (orderId ? String(orderId) : undefined),
      coinGrant: sku.coinGrant,
      grantAdFree: sku.grantAdFree,
      vipFrame: sku.vipFrame,
    });
    if (!applied.ok) {
      return res.status(409).json({
        ok: false,
        verified: false,
        error: 'Bu satın alma jetonu başka bir hesapta zaten kullanılmış.',
      });
    }
    const verifiedUser = await verifyFirebaseBearerToken(req.header('x-firebase-id-token'));
    if (applied.account) {
      await syncAuthoritativeUserStateAdmin({
        uid: verifiedUser?.uid || applied.account.googleUid,
        accountId: applied.account.accountId,
        profile: applied.account.profile,
        progression: applied.account.progression,
        email: verifiedUser?.email,
      });
    }
    return res.json({
      ok: true,
      verified: true,
      alreadyCredited: Boolean(applied.alreadyCredited),
      progression: applied.account?.progression,
    });
  }

  return res.json({
    ok: true,
    verified: true,
    alreadyCredited: false,
  });
});

// ── Google Play UGC Güvenliği: Kullanıcı Şikayet / Raporlama Uç Noktası ──
const REPORT_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const ALLOWED_REPORT_REASONS = new Set([
  'inappropriate_name',
  'harassment',
  'admin_impersonation',
  'cheating',
  'other',
]);

const userModerationReports: Array<{
  id: string;
  reporterId: string;
  targetId: string;
  targetName: string;
  reason: string;
  details: string;
  reviewStatus: 'pending_review';
  autoActionTaken: false;
  createdAt: number;
}> = [];

app.post('/api/moderation/report', async (req, res) => {
  if (!enforceRateLimit(socialLimiter, req, res)) return;
  const { reporterId, targetId, targetName, reason, details } = req.body || {};
  const cleanReporterId = String(reporterId || 'anon').trim().slice(0, 64) || 'anon';
  const cleanTargetId = String(targetId || '').trim().slice(0, 128);
  const cleanTargetName = String(targetName || 'Oyuncu').trim().slice(0, 64);
  const cleanReason = String(reason || '').trim();
  if (!cleanTargetId || !ALLOWED_REPORT_REASONS.has(cleanReason) || cleanReporterId === cleanTargetId) {
    return res.status(400).json({ ok: false, error: 'Geçersiz şikayet verisi.' });
  }

  const now = Date.now();
  const recentDuplicate = userModerationReports.find(
    (entry) =>
      entry.reporterId === cleanReporterId &&
      entry.targetId === cleanTargetId &&
      now - entry.createdAt < REPORT_DEDUP_WINDOW_MS
  );
  if (recentDuplicate) {
    return res.status(429).json({
      ok: false,
      duplicate: true,
      error: 'Bu oyuncu hakkında zaten yakın zamanda şikayet gönderdin. Ekibimiz inceleyecektir.',
    });
  }

  const report = {
    id: `rep_${now}_${Math.random().toString(36).slice(2, 8)}`,
    reporterId: cleanReporterId,
    targetId: cleanTargetId,
    targetName: cleanTargetName,
    reason: cleanReason,
    details: String(details || '').trim().slice(0, 300),
    reviewStatus: 'pending_review' as const,
    autoActionTaken: false as const,
    createdAt: now,
  };
  userModerationReports.push(report);
  if (userModerationReports.length > 500) {
    userModerationReports.splice(0, userModerationReports.length - 500);
  }
  const persistedToCloud = await saveModerationReportAdmin(report);
  res.json({
    ok: true,
    reportId: report.id,
    reviewStatus: report.reviewStatus,
    autoActionTaken: report.autoActionTaken,
    persistedToCloud,
  });
});

// Server-Backed 8-Player Friend Tournaments
interface ServerTournamentParticipant {
  id: string;
  name: string;
  avatar: string;
}

interface ServerTournamentRoom {
  code: string;
  title: string;
  hostId: string;
  minigameType: MinigameType;
  entryFeeCoins: number;
  prizeCoins: number;
  participants: ServerTournamentParticipant[];
  status: 'waiting' | 'started';
  createdAt: number;
}

const serverTournaments = new Map<string, ServerTournamentRoom>();

function generateServerTournamentCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'T';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return serverTournaments.has(code) ? generateServerTournamentCode() : code;
}

app.post('/api/tournaments', (req, res) => {
  const { hostId, hostName, hostAvatar, minigameType, entryFeeCoins, title } = req.body || {};
  if (!hostId || !hostName) {
    return res.status(400).json({ error: 'Turnuva kurucu bilgisi eksik.' });
  }
  const fee = Math.max(100, Math.min(20000, Math.round(Number(entryFeeCoins) || 2000)));
  const code = generateServerTournamentCode();
  const room: ServerTournamentRoom = {
    code,
    title: String(title || 'Arkadaşlar Arası 8’li Turnuva').slice(0, 48),
    hostId: String(hostId).slice(0, 40),
    minigameType: parseMinigameType(minigameType),
    entryFeeCoins: fee,
    prizeCoins: fee * 3,
    participants: [
      {
        id: String(hostId).slice(0, 40),
        name: String(hostName).slice(0, 20),
        avatar: String(hostAvatar || '⚽').slice(0, 64),
      },
    ],
    status: 'waiting',
    createdAt: Date.now(),
  };
  serverTournaments.set(code, room);
  const hostProfile = liveLeaderboard.get(room.hostId);
  broadcastFriendActivity({
    id: `tourney_${code}`,
    type: 'tournament_started',
    actorId: room.hostId,
    actorFriendCode: hostProfile?.friendCode,
    actorName: String(hostName).slice(0, 20),
    actorAvatar: String(hostAvatar || '⚽').slice(0, 64),
    title: `${String(hostName).slice(0, 20)} yeni turnuva başlattı!`,
    message: `${room.title} • Katılım kodu: ${code}`,
    tournamentCode: code,
    tournamentTitle: room.title,
    minigameType: room.minigameType,
    createdAt: Date.now(),
  });
  res.json({ ok: true, tournament: room });
});

app.post('/api/tournaments/announce', (req, res) => {
  const { actorId, actorFriendCode, actorName, actorAvatar, minigameType, title, tournamentCode } =
    req.body || {};
  if (!actorId || !actorName) {
    return res.status(400).json({ error: 'Turnuva duyuru bilgisi eksik.' });
  }
  const cleanId = String(actorId).slice(0, 64);
  const cleanName = String(actorName).slice(0, 20);
  const cleanTitle = String(title || '8’li Açık Kupa Turnuvası').slice(0, 64);
  const cleanCode = tournamentCode ? String(tournamentCode).trim().toUpperCase().slice(0, 12) : undefined;
  const event: FriendActivityEvent = {
    id: `tourney_open_${cleanId}_${Date.now()}`,
    type: 'tournament_started',
    actorId: cleanId,
    actorFriendCode: actorFriendCode ? String(actorFriendCode).slice(0, 12) : undefined,
    actorName: cleanName,
    actorAvatar: String(actorAvatar || '⚽').slice(0, 64),
    title: `${cleanName} yeni turnuva başlattı!`,
    message: cleanCode ? `${cleanTitle} • Kod: ${cleanCode}` : `${cleanTitle} sahasında mücadele başladı!`,
    tournamentCode: cleanCode,
    tournamentTitle: cleanTitle,
    minigameType: parseMinigameType(minigameType),
    createdAt: Date.now(),
  };
  broadcastFriendActivity(event);
  res.json({ ok: true, event });
});

app.post('/api/activity/high-score', (req, res) => {
  const { actorId, actorFriendCode, actorName, actorAvatar, scoreValue, summary, eventId } =
    req.body || {};
  if (!actorId || !actorName) {
    return res.status(400).json({ error: 'Skor duyuru bilgisi eksik.' });
  }
  const cleanId = String(actorId).slice(0, 64);
  const cleanName = String(actorName).slice(0, 20);
  const cleanScore = Math.max(0, Math.round(Number(scoreValue) || 0));
  const cleanSummary = String(
    summary || `${cleanScore.toLocaleString('tr-TR')} puanlık yüksek skor yaptı!`
  ).slice(0, 120);
  const event: FriendActivityEvent = {
    id: eventId ? String(eventId).slice(0, 64) : `hs_${cleanId}_${cleanScore}_${Date.now()}`,
    type: 'high_score',
    actorId: cleanId,
    actorFriendCode: actorFriendCode ? String(actorFriendCode).slice(0, 12) : undefined,
    actorName: cleanName,
    actorAvatar: String(actorAvatar || '⚽').slice(0, 64),
    title: `${cleanName} yüksek skor yaptı!`,
    message: cleanSummary,
    scoreValue: cleanScore,
    createdAt: Date.now(),
  };
  broadcastFriendActivity(event);
  res.json({ ok: true, event });
});

app.post('/api/friends/request', (req, res) => {
  if (!enforceRateLimit(socialLimiter, req, res)) return;
  const body = req.body || {};
  const fromPlayerId = String(body.fromPlayerId || '').trim().slice(0, 64);
  const fromFriendCode = String(body.fromFriendCode || '').trim().toUpperCase().slice(0, 12);
  const fromName = String(body.fromName || '').trim().slice(0, 24);
  const fromAvatar = String(body.fromAvatar || '⚽').slice(0, 64);
  const toPlayerId = body.toPlayerId ? String(body.toPlayerId).trim().slice(0, 64) : undefined;
  const toFriendCode = body.toFriendCode
    ? String(body.toFriendCode).trim().toUpperCase().slice(0, 12)
    : undefined;
  const toName = String(body.toName || '').trim().slice(0, 24);

  if (!fromPlayerId || !fromName || (!toPlayerId && !toFriendCode && !toName)) {
    return res.status(400).json({ ok: false, error: 'Arkadaşlık isteği bilgileri eksik.' });
  }

  const matchedTarget = Array.from(liveLeaderboard.values()).find(
    (p) =>
      (toPlayerId && p.id === toPlayerId) ||
      (toFriendCode && p.friendCode?.toUpperCase() === toFriendCode) ||
      (toName && normalizeUsernameKey(p.name) === normalizeUsernameKey(toName))
  );

  const resolvedToId = matchedTarget?.id || toPlayerId;
  const resolvedToCode = matchedTarget?.friendCode || toFriendCode;
  const resolvedToName = matchedTarget?.name || toName || toFriendCode || 'Oyuncu';

  if (
    (resolvedToId && resolvedToId === fromPlayerId) ||
    (resolvedToCode && fromFriendCode && resolvedToCode === fromFriendCode)
  ) {
    return res.status(400).json({ ok: false, error: 'Kendine arkadaşlık isteği gönderemezsin.' });
  }

  if (
    Boolean(body.isBot) ||
    /^bot[_-]/i.test(fromPlayerId) ||
    /^BOT(\d+|_|$)/i.test(fromFriendCode) ||
    /^(çırak|cirak|şampiyon|sampiyon|efsane|yapay\s*zeka|ai)\s*bot$/i.test(fromName) ||
    (resolvedToId && /^bot[_-]/i.test(resolvedToId)) ||
    (resolvedToCode && /^BOT(\d+|_|$)/i.test(resolvedToCode)) ||
    /^(çırak|cirak|şampiyon|sampiyon|efsane|yapay\s*zeka|ai)\s*bot$/i.test(resolvedToName)
  ) {
    return res.status(400).json({ ok: false, error: 'Bot hesaplar arkadaşlık sistemine dahil edilemez.' });
  }

  const senderProfile = liveLeaderboard.get(fromPlayerId);
  const existing = serverFriendRequests.find(
    (r) =>
      r.status === 'pending' &&
      r.fromPlayerId === fromPlayerId &&
      ((resolvedToId && r.toPlayerId === resolvedToId) ||
        (resolvedToCode && r.toFriendCode === resolvedToCode) ||
        (normalizeUsernameKey(resolvedToName).length >= 2 &&
          normalizeUsernameKey(r.toName) === normalizeUsernameKey(resolvedToName)))
  );

  if (existing) {
    pushFriendRequestToTarget(existing);
    return res.json({ ok: true, request: existing, duplicate: true });
  }

  const requestEntry: FriendRequestEntry = {
    id: String(body.id || `fr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`).slice(0, 64),
    fromPlayerId,
    fromFriendCode: fromFriendCode || senderProfile?.friendCode || 'FC0000',
    fromName,
    fromAvatar,
    toPlayerId: resolvedToId,
    toFriendCode: resolvedToCode,
    toName: resolvedToName,
    toAvatar: matchedTarget?.avatar || (body.toAvatar ? String(body.toAvatar).slice(0, 64) : '⚽'),
    weeklyPoints: Number(body.weeklyPoints ?? senderProfile?.weeklyPoints ?? 0),
    totalPoints: Number(body.totalPoints ?? senderProfile?.totalPoints ?? 0),
    subtitle: senderProfile?.subtitle || (body.subtitle ? String(body.subtitle).slice(0, 32) : undefined),
    status: 'pending',
    isBot: Boolean(body.isBot || resolvedToId?.startsWith('bot_') || fromPlayerId.startsWith('bot_')),
    createdAt: Date.now(),
  };

  serverFriendRequests.push(requestEntry);
  if (serverFriendRequests.length > 500) {
    serverFriendRequests.shift();
  }

  pushFriendRequestToTarget(requestEntry);
  res.json({ ok: true, request: requestEntry });
});

app.post('/api/friends/respond', (req, res) => {
  if (!enforceRateLimit(socialLimiter, req, res)) return;
  const body = req.body || {};
  const requestId = String(body.requestId || '').trim().slice(0, 64);
  const action: 'accept' | 'reject' = body.action === 'accept' ? 'accept' : 'reject';

  const idx = serverFriendRequests.findIndex((r) => r.id === requestId);
  let targetReq: FriendRequestEntry | null = idx >= 0 ? serverFriendRequests[idx] : null;

  if (idx >= 0) {
    serverFriendRequests.splice(idx, 1);
  } else if (body.fromPlayerId && (body.toPlayerId || body.toFriendCode || body.toName)) {
    targetReq = {
      id: requestId || `fr_${Date.now()}`,
      fromPlayerId: String(body.fromPlayerId),
      fromFriendCode: String(body.fromFriendCode || 'FC0000'),
      fromName: String(body.fromName || 'Oyuncu'),
      fromAvatar: String(body.fromAvatar || '⚽'),
      toPlayerId: body.toPlayerId ? String(body.toPlayerId) : undefined,
      toFriendCode: body.toFriendCode ? String(body.toFriendCode) : undefined,
      toName: String(body.toName || 'Oyuncu'),
      toAvatar: body.toAvatar ? String(body.toAvatar) : '⚽',
      weeklyPoints: Number(body.responderWeeklyPoints ?? 0),
      totalPoints: Number(body.responderTotalPoints ?? 0),
      subtitle: body.responderSubtitle ? String(body.responderSubtitle) : undefined,
      status: action === 'accept' ? 'accepted' : 'rejected',
      createdAt: Date.now(),
    };
  }

  if (!targetReq) {
    return res.json({ ok: true, action, request: null });
  }

  const enrichedReq: FriendRequestEntry = {
    ...targetReq,
    toPlayerId: body.responderId ? String(body.responderId) : targetReq.toPlayerId,
    toFriendCode: body.responderFriendCode
      ? String(body.responderFriendCode)
      : targetReq.toFriendCode,
    toName: body.responderName ? String(body.responderName) : targetReq.toName,
    toAvatar: body.responderAvatar ? String(body.responderAvatar) : targetReq.toAvatar,
    weeklyPoints: Number(body.responderWeeklyPoints ?? targetReq.weeklyPoints ?? 0),
    totalPoints: Number(body.responderTotalPoints ?? targetReq.totalPoints ?? 0),
    subtitle: body.responderSubtitle ? String(body.responderSubtitle) : targetReq.subtitle,
    status: action === 'accept' ? 'accepted' : 'rejected',
  };

  pushFriendResponseToSender(enrichedReq, action);
  res.json({ ok: true, action, request: enrichedReq });
});

app.get('/api/friends/pending', (req, res) => {
  const pid = String(req.query.playerId || '').trim();
  const code = String(req.query.friendCode || '').trim().toUpperCase();
  const nameKey = normalizeUsernameKey(String(req.query.name || ''));

  const incoming = serverFriendRequests.filter(
    (r) =>
      r.status === 'pending' &&
      !r.isBot &&
      !/^bot[_-]/i.test(r.fromPlayerId) &&
      !/^(çırak|cirak|şampiyon|sampiyon|efsane|yapay\s*zeka|ai)\s*bot$/i.test(r.fromName) &&
      ((pid && r.toPlayerId === pid) ||
        (code && r.toFriendCode?.toUpperCase() === code) ||
        (nameKey.length >= 2 && normalizeUsernameKey(r.toName) === nameKey))
  );
  res.json({ ok: true, incoming });
});

app.get('/api/tournaments/:code', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const room = serverTournaments.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Turnuva kodu bulunamadı.' });
  }
  res.json({ ok: true, tournament: room });
});

app.post('/api/tournaments/:code/join', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const room = serverTournaments.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Turnuva bulunamadı. Kodu kontrol et!' });
  }
  if (room.status === 'started') {
    return res.status(400).json({ error: 'Bu turnuva çoktan başladı!' });
  }
  const { playerId, name, avatar } = req.body || {};
  if (!playerId || !name) {
    return res.status(400).json({ error: 'Oyuncu bilgisi eksik.' });
  }
  const cleanId = String(playerId).slice(0, 40);
  const existing = room.participants.find((p) => p.id === cleanId);
  if (!existing) {
    if (room.participants.length >= 8) {
      return res.status(400).json({ error: 'Bu 8 kişilik turnuva tamamen doldu!' });
    }
    room.participants.push({
      id: cleanId,
      name: String(name).slice(0, 20),
      avatar: String(avatar || '⚽').slice(0, 64),
    });
  }
  res.json({ ok: true, tournament: room });
});

app.post('/api/tournaments/:code/start', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const room = serverTournaments.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Turnuva bulunamadı.' });
  }
  room.status = 'started';
  res.json({ ok: true, tournament: room });
});

// WebSocket channel: friend activity & friend request notifications only.
// 1v1 private rooms and quick match run on Cloud Firestore
// (src/services/firestoreRoomService.ts), so they also work inside the Android APK.
const wss = new WebSocketServer({ server, path: '/ws' });

interface NotificationSubscription {
  ws: WebSocket;
  playerId: string;
  friendCode?: string;
  nameKey: string;
  friendIds: Set<string>;
  friendCodes: Set<string>;
  friendNameKeys: Set<string>;
}

const notificationSubscribers = new Map<WebSocket, NotificationSubscription>();
const recentFriendActivities: FriendActivityEvent[] = [];
const serverFriendRequests: FriendRequestEntry[] = [];

function doesRequestTargetSubscription(
  sub: NotificationSubscription,
  req: FriendRequestEntry
): boolean {
  if (!sub.playerId || sub.playerId === req.fromPlayerId) return false;
  if (req.toPlayerId && req.toPlayerId === sub.playerId) return true;
  if (req.toFriendCode && sub.friendCode && req.toFriendCode.toUpperCase() === sub.friendCode) {
    return true;
  }
  const toKey = normalizeUsernameKey(req.toName || '');
  if (toKey.length >= 3 && sub.nameKey === toKey) return true;
  return false;
}

function doesRequestSenderSubscription(
  sub: NotificationSubscription,
  req: FriendRequestEntry
): boolean {
  if (!sub.playerId) return false;
  if (req.fromPlayerId === sub.playerId) return true;
  if (req.fromFriendCode && sub.friendCode && req.fromFriendCode.toUpperCase() === sub.friendCode) {
    return true;
  }
  const fromKey = normalizeUsernameKey(req.fromName || '');
  if (fromKey.length >= 3 && sub.nameKey === fromKey) return true;
  return false;
}

function pushFriendRequestToTarget(req: FriendRequestEntry) {
  const payload = JSON.stringify({
    type: 'friend_request_received',
    request: req,
  });
  for (const [sock, sub] of notificationSubscribers.entries()) {
    if (sock.readyState !== WebSocket.OPEN) continue;
    if (doesRequestTargetSubscription(sub, req)) {
      sock.send(payload);
    }
  }
}

function pushFriendResponseToSender(req: FriendRequestEntry, action: 'accept' | 'reject') {
  const payload = JSON.stringify({
    type: 'friend_request_responded',
    request: req,
    action: action === 'accept' ? 'accepted' : 'rejected',
  });
  for (const [sock, sub] of notificationSubscribers.entries()) {
    if (sock.readyState !== WebSocket.OPEN) continue;
    if (doesRequestSenderSubscription(sub, req)) {
      sock.send(payload);
    }
  }
}

function doesSubscriptionMatchEvent(
  sub: NotificationSubscription,
  event: FriendActivityEvent
): boolean {
  if (!sub.playerId || sub.playerId === event.actorId) return false;
  const actorCode = (event.actorFriendCode || '').trim().toUpperCase();
  if (actorCode && sub.friendCode && actorCode === sub.friendCode) return false;

  if (sub.friendIds.has(event.actorId)) return true;
  if (actorCode && sub.friendCodes.has(actorCode)) return true;
  const actorKey = normalizeUsernameKey(event.actorName || '');
  if (actorKey.length >= 3 && sub.friendNameKeys.has(actorKey)) return true;
  return false;
}

function broadcastFriendActivity(event: FriendActivityEvent) {
  if (!recentFriendActivities.some((e) => e.id === event.id)) {
    recentFriendActivities.push(event);
    if (recentFriendActivities.length > 100) {
      recentFriendActivities.shift();
    }
  }

  const payload = JSON.stringify({
    type: 'friend_activity',
    event,
  });

  for (const [sock, sub] of notificationSubscribers.entries()) {
    if (sock.readyState !== WebSocket.OPEN) continue;
    if (doesSubscriptionMatchEvent(sub, event)) {
      sock.send(payload);
    }
  }
}

// WebSocket heartbeat to purge dead connections cleanly
interface AliveWebSocket extends WebSocket {
  isAlive?: boolean;
}

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    const aliveClient = client as AliveWebSocket;
    if (aliveClient.isAlive === false) {
      aliveClient.terminate();
      return;
    }
    aliveClient.isAlive = false;
    aliveClient.ping();
  });
}, 25000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (rawWs) => {
  const ws = rawWs as AliveWebSocket;
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'subscribe_notifications') {
        const pid = String(msg.playerId || '').trim().slice(0, 64);
        if (!pid) return;
        const cleanCode = msg.friendCode ? String(msg.friendCode).trim().toUpperCase().slice(0, 12) : undefined;
        const cleanNameKey = normalizeUsernameKey(String(msg.name || ''));
        const rawFriends = Array.isArray(msg.friends) ? msg.friends : [];
        const friendIds = new Set<string>();
        const friendCodes = new Set<string>();
        const friendNameKeys = new Set<string>();

        for (const item of rawFriends.slice(0, 200)) {
          if (!item || typeof item !== 'object') continue;
          const rec = item as Record<string, unknown>;
          if (typeof rec.id === 'string' && rec.id.trim()) friendIds.add(rec.id.trim().slice(0, 64));
          if (typeof rec.friendCode === 'string' && rec.friendCode.trim()) {
            friendCodes.add(rec.friendCode.trim().toUpperCase().slice(0, 12));
          }
          if (typeof rec.name === 'string') {
            const k = normalizeUsernameKey(rec.name);
            if (k.length >= 3) friendNameKeys.add(k);
          }
        }

        const sub: NotificationSubscription = {
          ws,
          playerId: pid,
          friendCode: cleanCode,
          nameKey: cleanNameKey,
          friendIds,
          friendCodes,
          friendNameKeys,
        };
        notificationSubscribers.set(ws, sub);

        const since = typeof msg.sinceTimestamp === 'number' ? msg.sinceTimestamp : Date.now() - 60000;
        for (const ev of recentFriendActivities) {
          if (ev.createdAt >= since && doesSubscriptionMatchEvent(sub, ev)) {
            ws.send(JSON.stringify({ type: 'friend_activity', event: ev }));
          }
        }
        for (const req of serverFriendRequests) {
          if (req.status === 'pending' && doesRequestTargetSubscription(sub, req)) {
            ws.send(JSON.stringify({ type: 'friend_request_received', request: req }));
          }
        }
        return;
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    notificationSubscribers.delete(ws);
  });
});

// Vite Middleware integration
async function setupApp() {
  const hydrationPromise = hydrateBackendStateFromCloud();
  await Promise.race([
    hydrationPromise,
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(indexHtmlPath);
      });
    } else {
      app.get('/', (_req, res) => {
        res.status(200).json({
          ok: true,
          service: '3-2-1-futbol-backend',
          status: 'ok',
          health: '/healthz',
        });
      });
      app.use((_req, res) => {
        res.status(404).json({ ok: false, error: 'Endpoint bulunamadı.' });
      });
    }
  }

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  server.listen(port, '0.0.0.0', () => {
    console.log(`3-2-1 Football Challenge server listening on 0.0.0.0:${port}`);
  });
}

let shuttingDown = false;
async function handleGracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Shutdown] Received ${signal}, flushing cloud writes...`);
  try {
    await Promise.allSettled([
      accountStore.flushCloudWrites(),
      serverMatchLedger.flushCloudWrites(),
    ]);
  } catch {
    // ignore flush errors on shutdown
  }
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', () => void handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void handleGracefulShutdown('SIGINT'));

setupApp().catch(console.error);
