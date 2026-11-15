import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineMatchEngine } from './onlineEngine';
import { MATCH_PAIRINGS, PLAYERS } from './database';
import { XOX_BOARDS } from './minigamesData';
import { generateMinigameRounds } from './minigameEngine';
import { MinigameRoundPayload, MinigameType, PlayerProfile } from './types';

function makeProfile(id: string, name: string): PlayerProfile {
  return { id, name, avatar: '⚽', score: 0 };
}

function fixedRounds(type: MinigameType, count: number): MinigameRoundPayload[] {
  if (type === 'two_clubs') {
    const rmManU =
      MATCH_PAIRINGS.find(
        (p) =>
          (p.club1Id === 'real_madrid' && p.club2Id === 'manchester_united') ||
          (p.club1Id === 'manchester_united' && p.club2Id === 'real_madrid')
      ) || MATCH_PAIRINGS[0];
    return Array.from({ length: count }, (_, idx) => ({
      minigameType: 'two_clubs',
      pairing: { ...rmManU, id: `${rmManU.id}_${idx}` },
    }));
  }
  if (type === 'xox') {
    return Array.from({ length: count }, () => ({
      minigameType: 'xox',
      xoxBoard: XOX_BOARDS[0],
    }));
  }
  return generateMinigameRounds(type, count);
}

test('createRoom and joinRoom preserve selected minigameType and enforce 2-player capacity', () => {
  const engine = new OnlineMatchEngine(fixedRounds);
  const p1 = makeProfile('u1', 'KralForvet');
  const p2 = makeProfile('u2', 'KadikoyBogasi');
  const p3 = makeProfile('u3', 'Misafir');

  const room = engine.createRoom(p1, 'career');
  assert.equal(room.code.length, 5);
  assert.equal(room.minigameType, 'career');

  const missing = engine.joinRoom('ZZZZZ', p2);
  assert.equal(missing.ok, false);

  const joined = engine.joinRoom(room.code, p2);
  assert.equal(joined.ok, true);
  if (joined.ok) {
    assert.equal(joined.room.minigameType, 'career');
  }

  const full = engine.joinRoom(room.code, p3);
  assert.equal(full.ok, false);
});

test('enqueueQuickMatch matches players by same minigameType and supports cancel', () => {
  const engine = new OnlineMatchEngine(fixedRounds);
  const p1 = makeProfile('u1', 'Oyuncu 1');
  const p2 = makeProfile('u2', 'Oyuncu 2');
  const p3 = makeProfile('u3', 'Oyuncu 3');

  const first = engine.enqueueQuickMatch(p1, 'silhouette');
  assert.equal(first.matched, false);

  // Player queueing for career should NOT match silhouette player
  const diffMode = engine.enqueueQuickMatch(p2, 'career');
  assert.equal(diffMode.matched, false);
  assert.equal(engine.queue.length, 2);

  engine.cancelQuickMatch('u2');
  assert.equal(engine.queue.length, 1);

  const sameMode = engine.enqueueQuickMatch(p3, 'silhouette');
  assert.equal(sameMode.matched, true);
  if (sameMode.matched) {
    assert.equal(sameMode.room.minigameType, 'silhouette');
    assert.equal(sameMode.room.players.length, 2);
  }
});

test('submitAnswer is server-authoritative and prevents concurrent double-scoring', () => {
  const engine = new OnlineMatchEngine(fixedRounds);
  const p1 = makeProfile('u1', 'Oyuncu 1');
  const p2 = makeProfile('u2', 'Oyuncu 2');

  engine.enqueueQuickMatch(p1, 'two_clubs');
  const match = engine.enqueueQuickMatch(p2, 'two_clubs');
  assert.equal(match.matched, true);
  if (!match.matched) return;

  const { room } = match;
  engine.beginCountdown(room);
  const early = engine.submitAnswer(room, 'u1', 'Cristiano Ronaldo');
  assert.equal(early.accepted, false);
  assert.equal(early.reason, 'not_playing');

  engine.startRound(room);
  room.roundTimeRemaining = 12;

  const wrong = engine.submitAnswer(room, 'u2', 'Messi');
  assert.equal(wrong.accepted, false);
  assert.equal(wrong.reason, 'invalid_answer');
  assert.equal(room.players[1].stats.totalWrongAttempts, 1);

  const win = engine.submitAnswer(room, 'u1', 'Cristiano Ronaldo');
  assert.equal(win.accepted, true);
  assert.equal(win.winnerId, 'u1');
  assert.equal(win.scores?.['u1'], 1);

  const late = engine.submitAnswer(room, 'u2', 'David Beckham');
  assert.equal(late.accepted, false);
  assert.equal(late.reason, 'not_playing');
  assert.equal(room.scores['u2'], 0);
});

test('XOX online turn-based play alternates turns and awards win on 3-in-a-row', () => {
  const engine = new OnlineMatchEngine(fixedRounds);
  const p1 = makeProfile('u1', 'X Oyuncusu');
  const p2 = makeProfile('u2', 'O Oyuncusu');

  engine.enqueueQuickMatch(p1, 'xox');
  const match = engine.enqueueQuickMatch(p2, 'xox');
  assert.equal(match.matched, true);
  if (!match.matched) return;

  const { room } = match;
  engine.beginCountdown(room);
  engine.startRound(room);

  // Starter is u1 on round 0
  assert.equal(room.xoxState?.currentTurnPlayerId, 'u1');

  // u2 cannot play out of turn
  const outOfTurn = engine.submitAnswer(room, 'u2', 'Benzema', { row: 0, col: 0 });
  assert.equal(outOfTurn.accepted, false);
  assert.equal(outOfTurn.reason, 'not_your_turn');

  // u1 claims (0,0) with Benzema
  const m1 = engine.submitAnswer(room, 'u1', 'Karim Benzema', { row: 0, col: 0 });
  assert.equal(m1.accepted, true);
  assert.equal(m1.xoxMove, true);
  assert.equal(room.xoxState?.currentTurnPlayerId, 'u2');

  // u2 wrong answer passes turn back to u1
  const m2Wrong = engine.submitAnswer(room, 'u2', 'YanlisIsim', { row: 1, col: 0 });
  assert.equal(m2Wrong.accepted, false);
  assert.equal(m2Wrong.xoxTurnChanged, true);
  assert.equal(room.xoxState?.currentTurnPlayerId, 'u1');

  // u1 claims (0,1) with Mbappe -> passes to u2
  const m3 = engine.submitAnswer(room, 'u1', 'Mbappe', { row: 0, col: 1 });
  assert.equal(m3.accepted, true);

  // u2 claims (2,0) with Rooney -> passes to u1
  const m4 = engine.submitAnswer(room, 'u2', 'Wayne Rooney', { row: 2, col: 0 });
  assert.equal(m4.accepted, true);

  // u1 completes top row (0,2) with Roberto Carlos -> wins round!
  const m5 = engine.submitAnswer(room, 'u1', 'Roberto Carlos', { row: 0, col: 2 });
  assert.equal(m5.accepted, true);
  assert.equal(m5.winnerId, 'u1');
  assert.equal(room.scores['u1'], 1);
  assert.equal(room.state, 'round_ended');
});

test('match completes at first to 3 wins, timeout on round 1 does not end match, and rematch resets cleanly', () => {
  const engine = new OnlineMatchEngine(fixedRounds);
  const p1 = makeProfile('u1', 'Oyuncu 1');
  const p2 = makeProfile('u2', 'Oyuncu 2');

  engine.enqueueQuickMatch(p1, 'two_clubs');
  const match = engine.enqueueQuickMatch(p2, 'two_clubs');
  assert.equal(match.matched, true);
  if (!match.matched) return;

  const { room } = match;
  engine.startRound(room);
  const timeoutOutcome = engine.expireRound(room);
  assert.equal(timeoutOutcome.expired, true);
  assert.equal(timeoutOutcome.isMatchFinished, false);

  for (let r = 1; r <= 3; r++) {
    room.currentRoundIndex = r;
    engine.startRound(room);
    const out = engine.submitAnswer(room, 'u1', 'Casemiro');
    assert.equal(out.accepted, true);
    assert.equal(out.isMatchFinished, r === 3);
  }

  assert.equal(room.scores['u1'], 3);
  const r1 = engine.requestRematch(room, 'u1');
  assert.equal(r1.started, false);
  const r2 = engine.requestRematch(room, 'u2');
  assert.equal(r2.started, true);
  assert.equal(room.scores['u1'], 0);
  assert.equal(room.currentRoundIndex, 0);
});

test('silhouette online room allocates 120 seconds per round vs 15 seconds for standard modes', () => {
  const engine = new OnlineMatchEngine(fixedRounds);
  const p1 = makeProfile('u1', 'Kaptan');
  const p2 = makeProfile('u2', 'Golcu');

  const silRoom = engine.createRoom(p1, 'silhouette');
  assert.equal(silRoom.roundTimeRemaining, 120);
  engine.joinRoom(silRoom.code, p2);
  engine.startRound(silRoom);
  assert.equal(silRoom.roundTimeRemaining, 120);

  // Elapsed time calculation on 120s round works cleanly
  silRoom.roundTimeRemaining = 95;
  const targetName = PLAYERS[silRoom.rounds[0].silhouette!.playerId].name;
  const silWin = engine.submitAnswer(silRoom, 'u1', targetName);
  assert.equal(silWin.accepted, true);
  assert.equal(silWin.winnerId, 'u1');
  assert.equal(silRoom.players[0].stats.fastestAnswerSec, 25);

  const stdRoom = engine.createRoom(p1, 'two_clubs');
  assert.equal(stdRoom.roundTimeRemaining, 15);
  engine.joinRoom(stdRoom.code, p2);
  engine.startRound(stdRoom);
  assert.equal(stdRoom.roundTimeRemaining, 15);
});

test('silhouette online room enforces 8-attempt cap and ends round with 0 points when both players exhaust 8 tries', () => {
  const engine = new OnlineMatchEngine(fixedRounds);
  const p1 = makeProfile('u1', 'Kaptan');
  const p2 = makeProfile('u2', 'Golcu');

  const room = engine.createRoom(p1, 'silhouette');
  engine.joinRoom(room.code, p2);
  engine.beginCountdown(room);
  engine.startRound(room);

  for (let i = 1; i <= 7; i++) {
    const res = engine.submitAnswer(room, 'u1', 'TamamenYanlisOyuncu');
    assert.equal(res.accepted, false);
    assert.equal(res.reason, 'invalid_answer');
    assert.equal(res.attemptsUsed, i);
    assert.equal(res.attemptsRemaining, 8 - i);
    assert.equal(res.roundExhausted, undefined);
  }

  // 8th wrong guess by p1 locks p1 without ending round since p2 still has attempts
  const p1Eighth = engine.submitAnswer(room, 'u1', 'TamamenYanlisOyuncu');
  assert.equal(p1Eighth.accepted, false);
  assert.equal(p1Eighth.reason, 'attempts_exhausted');
  assert.equal(p1Eighth.attemptsRemaining, 0);
  assert.equal(p1Eighth.roundExhausted, undefined);
  assert.equal(room.state, 'playing');

  // 9th guess by p1 is immediately blocked
  const p1Ninth = engine.submitAnswer(room, 'u1', PLAYERS[room.rounds[0].silhouette!.playerId].name);
  assert.equal(p1Ninth.accepted, false);
  assert.equal(p1Ninth.reason, 'attempts_exhausted');

  // p2 exhausts 8 attempts -> round ends with 0 points awarded
  for (let i = 1; i <= 7; i++) {
    const res = engine.submitAnswer(room, 'u2', 'TamamenYanlisOyuncu');
    assert.equal(res.accepted, false);
  }
  const p2Eighth = engine.submitAnswer(room, 'u2', 'TamamenYanlisOyuncu');
  assert.equal(p2Eighth.accepted, false);
  assert.equal(p2Eighth.roundExhausted, true);
  assert.equal(room.state, 'round_ended');
  assert.equal(room.scores['u1'], 0);
  assert.equal(room.scores['u2'], 0);
});


