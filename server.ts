import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRandomPairings, validateAnswerForPairing } from './src/game/validator.js';
import { MATCH_PAIRINGS } from './src/game/database.js';
import {
  FriendActivityEvent,
  FriendRequestEntry,
  MinigameType,
  PlayerProfile,
  PublicPlayerProfile,
} from './src/game/types.js';
import { OnlineMatchEngine, OnlineRoom } from './src/game/onlineEngine.js';
import { AccountStore, buildPublicProfileFromRecord } from './src/game/accountStore.js';
import { normalizeUsernameKey } from './src/game/accountEngine.js';

const VALID_MINIGAMES: MinigameType[] = ['two_clubs', 'xox', 'career', 'country_club'];

function parseMinigameType(raw: unknown): MinigameType {
  const s = String(raw || 'two_clubs') as MinigameType;
  return VALID_MINIGAMES.includes(s) ? s : 'two_clubs';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '512kb' }));

// API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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

// Seed leaderboard from persisted accounts on server startup
for (const acc of accountStore.listAll()) {
  liveLeaderboard.set(acc.accountId, buildPublicProfileFromRecord(acc));
}

function getSortedLiveLeaderboard(): LiveLeaderboardRecord[] {
  return Array.from(liveLeaderboard.values())
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

app.get('/api/accounts/by-id/:accountId', (req, res) => {
  const rec = accountStore.getByAccountId(String(req.params.accountId || '').trim());
  if (!rec) {
    return res.json({ ok: false, found: false });
  }
  res.json({
    ok: true,
    found: true,
    account: {
      accountId: rec.accountId,
      recoveryCode: rec.recoveryCode,
      profile: rec.profile,
      progression: rec.progression,
    },
  });
});

app.delete('/api/accounts/by-id/:accountId', (req, res) => {
  const accountId = String(req.params.accountId || '').trim();
  if (!accountId) {
    return res.status(400).json({ ok: false, error: 'Geçersiz hesap kimliği.' });
  }
  const deleted = accountStore.deleteByAccountId(accountId);
  liveLeaderboard.delete(accountId);
  res.json({ ok: true, deleted });
});

app.post('/api/accounts/register', (req, res) => {
  const { accountId, profile, progression, googleUid } = req.body || {};
  if (!accountId || !profile?.name || !progression) {
    return res.status(400).json({ ok: false, error: 'Hesap bilgileri eksik.' });
  }
  const result = accountStore.registerOrUpdate({
    accountId: String(accountId),
    profile,
    progression,
    googleUid: googleUid ? String(googleUid) : undefined,
  });
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.reason,
      suggestions: result.suggestions || [],
    });
  }

  const acc = result.account;
  liveLeaderboard.set(acc.accountId, buildPublicProfileFromRecord(acc));

  res.json({
    ok: true,
    account: {
      accountId: acc.accountId,
      recoveryCode: acc.recoveryCode,
      profile: acc.profile,
      progression: acc.progression,
    },
  });
});

app.post('/api/accounts/sync', (req, res) => {
  const { accountId, profile, progression, googleUid } = req.body || {};
  if (!accountId || !progression) {
    return res.status(400).json({ ok: false, error: 'Senkronizasyon verisi eksik.' });
  }
  const syncRes = accountStore.syncProgression({
    accountId: String(accountId),
    profile,
    progression,
    googleUid: googleUid ? String(googleUid) : undefined,
  });
  if (!syncRes.ok || !syncRes.account) {
    return res.json({ ok: false });
  }
  liveLeaderboard.set(syncRes.account.accountId, buildPublicProfileFromRecord(syncRes.account));
  res.json({
    ok: true,
    recoveryCode: syncRes.account.recoveryCode,
  });
});

app.post('/api/accounts/recover', (req, res) => {
  const { recoveryCode, username } = req.body || {};
  const result = accountStore.recoverByCode(
    String(recoveryCode || ''),
    username ? String(username) : undefined
  );
  if (!result.ok) {
    return res.status(404).json({ ok: false, error: result.reason });
  }
  const acc = result.account;
  res.json({
    ok: true,
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

app.post('/api/leaderboard/sync', (req, res) => {
  const body = req.body || {};
  const { id, friendCode, name, avatar, weeklyPoints, totalPoints, subtitle, hasCrown } = body;
  if (!id || !name) {
    return res.status(400).json({ error: 'Missing player identity' });
  }
  const cleanId = String(id).slice(0, 64);
  const existing = liveLeaderboard.get(cleanId);
  const prevWeekly = existing?.weeklyPoints ?? 0;
  let prevTopWeekly = 0;
  for (const rec of liveLeaderboard.values()) {
    if (rec.id !== cleanId && rec.weeklyPoints > prevTopWeekly) {
      prevTopWeekly = rec.weeklyPoints;
    }
  }
  const cleanName = String(name).slice(0, 20);
  const nextWeekly = Math.max(0, Number(weeklyPoints) || 0);
  const nextAvatar = String(avatar || existing?.avatar || '⚽').slice(0, 64);
  const nextFriendCode = friendCode ? String(friendCode).slice(0, 12) : existing?.friendCode;
  liveLeaderboard.set(cleanId, {
    id: cleanId,
    usernameKey: normalizeUsernameKey(cleanName) || existing?.usernameKey,
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
    weeklyPoints: Math.max(0, Number(weeklyPoints) || 0),
    totalPoints: Math.max(0, Number(totalPoints) || 0),
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

  res.json({ ok: true, found: true, profile: chosen });
});

app.get('/api/pairings', (_req, res) => {
  res.json({ pairings: getRandomPairings(10) });
});

app.post('/api/validate', (req, res) => {
  const { answer, pairingId } = req.body;
  const pairing = MATCH_PAIRINGS.find((p) => p.id === pairingId);
  if (!pairing) {
    return res.status(404).json({ error: 'Pairing not found' });
  }
  const result = validateAnswerForPairing(answer, pairing);
  res.json(result);
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

// Authoritative WebSocket Multiplayer Server
const wss = new WebSocketServer({ server, path: '/ws' });
const engine = new OnlineMatchEngine();

interface RoomTimers {
  countdownTimer: NodeJS.Timeout | null;
  roundTimer: NodeJS.Timeout | null;
  nextRoundTimer: NodeJS.Timeout | null;
  startDelayTimer: NodeJS.Timeout | null;
}

const playerSockets = new Map<string, WebSocket>();
const roomTimers = new Map<string, RoomTimers>();

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

function getOrCreateTimers(code: string): RoomTimers {
  let timers = roomTimers.get(code);
  if (!timers) {
    timers = {
      countdownTimer: null,
      roundTimer: null,
      nextRoundTimer: null,
      startDelayTimer: null,
    };
    roomTimers.set(code, timers);
  }
  return timers;
}

function clearRoomTimers(code: string) {
  const timers = roomTimers.get(code);
  if (!timers) return;
  if (timers.countdownTimer) clearInterval(timers.countdownTimer);
  if (timers.roundTimer) clearInterval(timers.roundTimer);
  if (timers.nextRoundTimer) clearTimeout(timers.nextRoundTimer);
  if (timers.startDelayTimer) clearTimeout(timers.startDelayTimer);
  timers.countdownTimer = null;
  timers.roundTimer = null;
  timers.nextRoundTimer = null;
  timers.startDelayTimer = null;
}

function sendToPlayer(playerId: string, message: Record<string, unknown>) {
  const ws = playerSockets.get(playerId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(room: OnlineRoom, message: Record<string, unknown>) {
  const payload = JSON.stringify(message);
  for (const entry of room.players) {
    const ws = playerSockets.get(entry.playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function startCountdown(room: OnlineRoom) {
  clearRoomTimers(room.code);
  const timers = getOrCreateTimers(room.code);
  const payload = engine.beginCountdown(room);

  broadcastToRoom(room, {
    type: 'round_countdown',
    ...payload,
  });

  timers.countdownTimer = setInterval(() => {
    room.countdownValue -= 1;
    if (room.countdownValue > 0) {
      broadcastToRoom(room, {
        type: 'countdown_tick',
        countdown: room.countdownValue,
      });
    } else {
      if (timers.countdownTimer) clearInterval(timers.countdownTimer);
      timers.countdownTimer = null;
      startRoundPlaying(room);
    }
  }, 1000);
}

function startRoundPlaying(room: OnlineRoom) {
  const timers = getOrCreateTimers(room.code);
  const payload = engine.startRound(room);

  broadcastToRoom(room, {
    type: 'round_started',
    ...payload,
  });

  if (timers.roundTimer) clearInterval(timers.roundTimer);

  timers.roundTimer = setInterval(() => {
    room.roundTimeRemaining -= 1;
    broadcastToRoom(room, {
      type: 'time_tick',
      timeRemaining: room.roundTimeRemaining,
    });

    if (room.roundTimeRemaining <= 0) {
      const expired = engine.expireRound(room);
      if (expired.xoxTurnPassed) {
        broadcastToRoom(room, {
          type: 'xox_updated',
          xoxState: expired.xoxState,
          timeRemaining: expired.timeRemaining ?? 15,
          turnNotice: 'Süre doldu, sıra geçti!',
          stats: expired.stats,
        });
        return;
      }

      if (timers.roundTimer) clearInterval(timers.roundTimer);
      timers.roundTimer = null;
      if (!expired.expired) return;

      broadcastToRoom(room, {
        type: 'round_ended',
        winnerId: null,
        scores: expired.scores,
        stats: expired.stats,
        reason: 'Süre doldu!',
        validPlayers: expired.validPlayers,
        funFact: expired.funFact,
        roundIndex: expired.roundIndex,
        xoxState: room.xoxState,
      });

      scheduleNextRoundOrFinish(room, expired.isMatchFinished);
    }
  }, 1000);
}

function scheduleNextRoundOrFinish(room: OnlineRoom, isMatchFinished: boolean) {
  const timers = getOrCreateTimers(room.code);
  if (timers.nextRoundTimer) clearTimeout(timers.nextRoundTimer);

  timers.nextRoundTimer = setTimeout(() => {
    timers.nextRoundTimer = null;
    if (!engine.rooms.has(room.code) || room.players.length < 2) return;

    if (isMatchFinished) {
      room.state = 'game_over';
      const statsMap: Record<string, unknown> = {};
      for (const p of room.players) {
        statsMap[p.playerId] = p.stats;
      }
      broadcastToRoom(room, {
        type: 'match_over',
        scores: room.scores,
        stats: statsMap,
        players: room.players.map((p) => ({
          ...p.profile,
          score: room.scores[p.playerId] || 0,
        })),
      });
    } else {
      room.currentRoundIndex += 1;
      startCountdown(room);
    }
  }, 3800);
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

  let currentRoom: OnlineRoom | null = null;
  let currentPlayerId: string | null = null;

  const removePlayerFromCurrentOrEngine = (playerId: string, knownRoom: OnlineRoom | null) => {
    engine.cancelQuickMatch(playerId);
    const targetRoom = knownRoom || engine.findRoomByPlayerId(playerId);
    if (!targetRoom) return;

    const roomCode = targetRoom.code;
    const wasActive = targetRoom.state !== 'waiting' && targetRoom.state !== 'game_over';
    const { isEmpty } = engine.removePlayer(targetRoom, playerId);
    if (isEmpty) {
      clearRoomTimers(roomCode);
      roomTimers.delete(roomCode);
    } else {
      clearRoomTimers(roomCode);
      broadcastToRoom(targetRoom, {
        type: 'opponent_disconnected',
        message: wasActive
          ? 'Rakibinin bağlantısı kesildi! Maç sonlandı.'
          : 'Rakip odadan ayrıldı.',
      });
    }
  };

  const cleanupPlayer = () => {
    if (!currentPlayerId) return;
    const pid = currentPlayerId;
    const knownRoom = currentRoom;
    currentPlayerId = null;
    currentRoom = null;

    const activeSock = playerSockets.get(pid);
    if (activeSock && activeSock !== ws) {
      // Another socket has already taken over this playerId
      return;
    }
    if (activeSock === ws) {
      playerSockets.delete(pid);
    }

    removePlayerFromCurrentOrEngine(pid, knownRoom);
  };

  const preparePlayerSession = (playerId: string) => {
    cleanupPlayer();
    const existingSock = playerSockets.get(playerId);
    if (existingSock && existingSock !== ws) {
      playerSockets.delete(playerId);
      removePlayerFromCurrentOrEngine(playerId, null);
      try {
        existingSock.close();
      } catch {
        // ignore
      }
    }
    currentPlayerId = playerId;
    playerSockets.set(playerId, ws);
  };

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

      if (msg.type === 'create_room') {
        const playerId = String(msg.playerId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        const minigameType = parseMinigameType(msg.minigameType);
        const rawMatches = Math.max(0, Math.min(100000, Math.round(Number(msg.accountStats?.totalMatches) || 0)));
        const rawWins = Math.max(0, Math.min(rawMatches, Math.round(Number(msg.accountStats?.totalWins) || 0)));
        const profile: PlayerProfile = {
          id: playerId,
          name: String(msg.name || 'Oyuncu 1').slice(0, 20),
          avatar: String(msg.avatar || '⚽'),
          favoriteClubId: msg.favoriteClubId ? String(msg.favoriteClubId) : undefined,
          accountStats: rawMatches > 0 ? { totalMatches: rawMatches, totalWins: rawWins, badgesEarned: [] } : undefined,
          score: 0,
        };
        preparePlayerSession(playerId);

        const room = engine.createRoom(profile, minigameType);
        currentRoom = room;

        ws.send(
          JSON.stringify({
            type: 'room_created',
            code: room.code,
            minigameType: room.minigameType,
            profile,
          })
        );
      } else if (msg.type === 'join_room') {
        const playerId = String(msg.playerId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        const rawMatches = Math.max(0, Math.min(100000, Math.round(Number(msg.accountStats?.totalMatches) || 0)));
        const rawWins = Math.max(0, Math.min(rawMatches, Math.round(Number(msg.accountStats?.totalWins) || 0)));
        const profile: PlayerProfile = {
          id: playerId,
          name: String(msg.name || 'Oyuncu 2').slice(0, 20),
          avatar: String(msg.avatar || '🔥'),
          favoriteClubId: msg.favoriteClubId ? String(msg.favoriteClubId) : undefined,
          accountStats: rawMatches > 0 ? { totalMatches: rawMatches, totalWins: rawWins, badgesEarned: [] } : undefined,
          score: 0,
        };
        preparePlayerSession(playerId);

        const result = engine.joinRoom(msg.code, profile);
        if (!result.ok) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: result.error,
            })
          );
          return;
        }

        currentRoom = result.room;

        ws.send(
          JSON.stringify({
            type: 'room_joined',
            code: result.room.code,
            minigameType: result.room.minigameType,
            profile,
            opponent: result.host,
          })
        );

        sendToPlayer(result.host.id, {
          type: 'opponent_joined',
          opponent: profile,
          minigameType: result.room.minigameType,
        });

        const timers = getOrCreateTimers(result.room.code);
        timers.startDelayTimer = setTimeout(() => {
          timers.startDelayTimer = null;
          if (engine.rooms.has(result.room.code) && result.room.players.length === 2) {
            startCountdown(result.room);
          }
        }, 1200);
      } else if (msg.type === 'quick_match') {
        const playerId = String(msg.playerId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        const minigameType = parseMinigameType(msg.minigameType);
        const rawMatches = Math.max(0, Math.min(100000, Math.round(Number(msg.accountStats?.totalMatches) || 0)));
        const rawWins = Math.max(0, Math.min(rawMatches, Math.round(Number(msg.accountStats?.totalWins) || 0)));
        const profile: PlayerProfile = {
          id: playerId,
          name: String(msg.name || 'Oyuncu').slice(0, 20),
          avatar: String(msg.avatar || '⚽'),
          favoriteClubId: msg.favoriteClubId ? String(msg.favoriteClubId) : undefined,
          accountStats: rawMatches > 0 ? { totalMatches: rawMatches, totalWins: rawWins, badgesEarned: [] } : undefined,
          score: 0,
        };
        preparePlayerSession(playerId);

        // Filter out closed sockets from queue before matching
        engine.queue = engine.queue.filter((item) => {
          const sock = playerSockets.get(item.playerId);
          return Boolean(sock && sock.readyState === WebSocket.OPEN);
        });

        const result = engine.enqueueQuickMatch(profile, minigameType);
        if (result.matched) {
          currentRoom = result.room;
          broadcastToRoom(result.room, {
            type: 'match_found',
            code: result.room.code,
            minigameType: result.room.minigameType,
            players: result.room.players.map((p) => p.profile),
          });

          const timers = getOrCreateTimers(result.room.code);
          timers.startDelayTimer = setTimeout(() => {
            timers.startDelayTimer = null;
            if (engine.rooms.has(result.room.code) && result.room.players.length === 2) {
              startCountdown(result.room);
            }
          }, 1200);
        } else {
          ws.send(
            JSON.stringify({
              type: 'matchmaking_waiting',
              minigameType,
              message: 'Rakip aranıyor...',
            })
          );
        }
      } else if (msg.type === 'cancel_matchmaking' || msg.type === 'leave_room') {
        cleanupPlayer();
      } else if (msg.type === 'submit_answer') {
        if (!currentPlayerId) return;
        const activeRoom = engine.findRoomByPlayerId(currentPlayerId);
        if (!activeRoom) return;
        currentRoom = activeRoom;

        const cellPos =
          typeof msg.row === 'number' && typeof msg.col === 'number'
            ? { row: msg.row, col: msg.col }
            : undefined;

        const outcome = engine.submitAnswer(
          activeRoom,
          currentPlayerId,
          String(msg.answer || ''),
          cellPos
        );

        if (outcome.accepted) {
          if (outcome.xoxMove) {
            broadcastToRoom(activeRoom, {
              type: 'xox_updated',
              xoxState: outcome.xoxState,
              lastMove: outcome.lastMove,
              timeRemaining: activeRoom.roundTimeRemaining,
              stats: outcome.stats,
            });
            return;
          }

          const timers = getOrCreateTimers(activeRoom.code);
          if (timers.roundTimer) {
            clearInterval(timers.roundTimer);
            timers.roundTimer = null;
          }

          broadcastToRoom(activeRoom, {
            type: 'round_ended',
            winnerId: outcome.winnerId ?? null,
            scores: outcome.scores,
            stats: outcome.stats,
            reason: outcome.winnerId
              ? `${outcome.winnerName || 'Oyuncu'} doğru bildi! (+1)`
              : 'Tahta doldu, tur berabere!',
            acceptedAnswer: outcome.acceptedAnswer,
            acceptedPlayerName: outcome.acceptedPlayerName,
            validPlayers: outcome.validPlayers,
            funFact: outcome.funFact,
            roundIndex: outcome.roundIndex,
            elapsedSec: outcome.elapsedSec,
            wasClutch: outcome.wasClutch,
            xoxState: outcome.xoxState,
          });

          scheduleNextRoundOrFinish(activeRoom, Boolean(outcome.isMatchFinished));
        } else if (outcome.roundExhausted) {
          const timers = getOrCreateTimers(activeRoom.code);
          if (timers.roundTimer) {
            clearInterval(timers.roundTimer);
            timers.roundTimer = null;
          }

          broadcastToRoom(activeRoom, {
            type: 'round_ended',
            winnerId: null,
            scores: outcome.scores,
            stats: outcome.stats,
            reason: 'Deneme hakları doldu!',
            validPlayers: outcome.validPlayers,
            funFact: outcome.funFact,
            roundIndex: outcome.roundIndex,
            xoxState: activeRoom.xoxState,
          });

          scheduleNextRoundOrFinish(activeRoom, Boolean(outcome.isMatchFinished));
        } else if (outcome.reason === 'invalid_answer' || outcome.reason === 'attempts_exhausted') {
          ws.send(
            JSON.stringify({
              type: 'answer_wrong',
              attempt: outcome.attempt,
              reason: outcome.reason,
              attemptsUsed: outcome.attemptsUsed,
              attemptsRemaining: outcome.attemptsRemaining,
              xoxTurnChanged: outcome.xoxTurnChanged,
              xoxState: outcome.xoxState,
              timeRemaining: outcome.xoxTurnChanged ? activeRoom.roundTimeRemaining : undefined,
            })
          );
          if (outcome.attempt) {
            for (const p of activeRoom.players) {
              if (p.playerId !== currentPlayerId) {
                sendToPlayer(p.playerId, {
                  type: 'opponent_wrong_attempt',
                  xoxTurnChanged: outcome.xoxTurnChanged,
                  xoxState: outcome.xoxState,
                  timeRemaining: outcome.xoxTurnChanged ? activeRoom.roundTimeRemaining : undefined,
                });
              }
            }
          }
        }
      } else if (msg.type === 'rematch_request') {
        if (!currentPlayerId) return;
        const activeRoom = engine.findRoomByPlayerId(currentPlayerId);
        if (!activeRoom) return;
        currentRoom = activeRoom;

        const rematchRes = engine.requestRematch(activeRoom, currentPlayerId);
        if (rematchRes.started) {
          clearRoomTimers(activeRoom.code);
          broadcastToRoom(activeRoom, {
            type: 'rematch_started',
            minigameType: activeRoom.minigameType,
            players: activeRoom.players.map((p) => p.profile),
          });
          startCountdown(activeRoom);
        } else if (rematchRes.readyCount === 1) {
          ws.send(JSON.stringify({ type: 'rematch_waiting' }));
          for (const p of activeRoom.players) {
            if (p.playerId !== currentPlayerId) {
              sendToPlayer(p.playerId, {
                type: 'opponent_rematch_requested',
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    notificationSubscribers.delete(ws);
    cleanupPlayer();
  });
});

// Vite Middleware integration
async function setupApp() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, () => {
    console.log(`3-2-1 Football Challenge server listening on port ${port}`);
  });
}

setupApp().catch(console.error);
