import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRandomPairings, validateAnswerForPairing } from './src/game/validator.js';
import { MATCH_PAIRINGS } from './src/game/database.js';
import { MinigameType, PlayerProfile } from './src/game/types.js';
import { OnlineMatchEngine, OnlineRoom } from './src/game/onlineEngine.js';

const VALID_MINIGAMES: MinigameType[] = ['two_clubs', 'silhouette', 'xox', 'career', 'country_club'];

function parseMinigameType(raw: unknown): MinigameType {
  const s = String(raw || 'two_clubs') as MinigameType;
  return VALID_MINIGAMES.includes(s) ? s : 'two_clubs';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

app.use(express.json());

// API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

interface LiveLeaderboardRecord {
  id: string;
  friendCode?: string;
  name: string;
  avatar: string;
  weeklyPoints: number;
  totalPoints: number;
  subtitle?: string;
  hasCrown?: boolean;
  updatedAt: number;
}

const liveLeaderboard = new Map<string, LiveLeaderboardRecord>();

function getSortedLiveLeaderboard(): LiveLeaderboardRecord[] {
  return Array.from(liveLeaderboard.values())
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
    .slice(0, 50);
}

app.get('/api/leaderboard', (_req, res) => {
  const players = getSortedLiveLeaderboard();
  res.json({ players, entries: players });
});

app.post('/api/leaderboard/sync', (req, res) => {
  const { id, friendCode, name, avatar, weeklyPoints, totalPoints, subtitle, hasCrown } =
    req.body || {};
  if (!id || !name) {
    return res.status(400).json({ error: 'Missing player identity' });
  }
  const cleanId = String(id).slice(0, 40);
  liveLeaderboard.set(cleanId, {
    id: cleanId,
    friendCode: friendCode ? String(friendCode).slice(0, 12) : undefined,
    name: String(name).slice(0, 20),
    avatar: String(avatar || '⚽').slice(0, 64),
    weeklyPoints: Math.max(0, Number(weeklyPoints) || 0),
    totalPoints: Math.max(0, Number(totalPoints) || 0),
    subtitle: subtitle ? String(subtitle).slice(0, 32) : undefined,
    hasCrown: Boolean(hasCrown),
    updatedAt: Date.now(),
  });
  res.json({ ok: true, players: getSortedLiveLeaderboard() });
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
  res.json({ ok: true, tournament: room });
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
