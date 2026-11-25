import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYERS } from './database';
import { getRoundValidPlayerIds } from './minigameEngine';
import { MAX_SILHOUETTE_ATTEMPTS } from './silhouetteEngine';
import {
  RoomRecord,
  applyRoomAdvance,
  applyRoomAnswer,
  applyRoomBeginRound,
  applyRoomExpire,
  applyRoomJoin,
  applyRoomRematch,
  createRoomRecord,
  getRoomPhase,
  getRoomPhaseKey,
  getRoomRoundPayload,
  isValidRoomCode,
  normalizeRoomCode,
  normalizeRoomRecord,
  parseRoomXoxState,
} from './roomEngine';
import { MinigameType, PlayerProfile } from './types';

const host: PlayerProfile = { id: 'u_host01', name: 'Ev Sahibi', avatar: '⚽', score: 0 };
const guest: PlayerProfile = { id: 'u_guest02', name: 'Misafir', avatar: '🔥', score: 0, favoriteClubId: 'gs' };
const NOW = 1_700_000_000_000;

function privateRoom(minigameType: MinigameType = 'two_clubs'): RoomRecord {
  return createRoomRecord({
    code: 'ABC234',
    source: 'private',
    minigameType,
    host,
    hostUid: 'uidHost',
    now: NOW,
    seed: 42,
  });
}

function playingRoom(minigameType: MinigameType = 'two_clubs'): RoomRecord {
  const joined = applyRoomJoin(privateRoom(minigameType), guest, 'uidGuest', NOW + 1000);
  assert.ok(joined.ok);
  const started = applyRoomBeginRound(joined.room, getRoomPhase(joined.room), NOW + 4000);
  assert.ok(started);
  return started;
}

function validAnswerFor(room: RoomRecord, cellPos?: { row: number; col: number }): string {
  const round = getRoomRoundPayload(room);
  assert.ok(round);
  const id = getRoundValidPlayerIds(round, cellPos)[0];
  assert.ok(id, 'round should have at least one valid player');
  return PLAYERS[id].name;
}

test('room codes normalize to 6 uppercase alphanumerics', () => {
  assert.equal(normalizeRoomCode(' ab-c 23 4 '), 'ABC234');
  assert.equal(isValidRoomCode('ABC234'), true);
  assert.equal(isValidRoomCode('ABC23'), false);
  assert.equal(isValidRoomCode('abc234'), false);
});

test('private room starts waiting with only the host as member', () => {
  const room = privateRoom();
  assert.equal(room.state, 'waiting');
  assert.deepEqual(room.memberUids, ['uidHost']);
  assert.equal(room.guestId, null);
  assert.equal(Object.keys(room.players).length, 1);
  assert.equal(room.roundIds.length > 0, true);
  // Firestore rejects undefined values — optional fields must be omitted
  assert.equal('favoriteClubId' in room.players[room.hostId], false);
});

test('joining fills the guest slot and starts the countdown', () => {
  const res = applyRoomJoin(privateRoom(), guest, 'uidGuest', NOW + 500);
  assert.ok(res.ok);
  assert.equal(res.room.state, 'countdown');
  assert.equal(res.room.guestId, 'u_guest02');
  assert.equal(res.room.guestUid, 'uidGuest');
  assert.deepEqual(res.room.memberUids, ['uidHost', 'uidGuest']);
  assert.equal(res.room.players.u_guest02.favoriteClubId, 'gs');
  assert.equal(res.room.scores.u_guest02, 0);
});

test('same Firebase account on two devices keeps a single member uid', () => {
  const res = applyRoomJoin(privateRoom(), guest, 'uidHost', NOW + 500);
  assert.ok(res.ok);
  assert.deepEqual(res.room.memberUids, ['uidHost']);
});

test('join is rejected for own room, full room, started or expired room', () => {
  const own = applyRoomJoin(privateRoom(), { ...host }, 'uidHost', NOW);
  assert.equal(own.ok, false);

  const joined = applyRoomJoin(privateRoom(), guest, 'uidGuest', NOW);
  assert.ok(joined.ok);
  const third = applyRoomJoin(joined.room, { id: 'u_third', name: 'Üçüncü', avatar: '⚡', score: 0 }, 'uid3', NOW);
  assert.equal(third.ok, false);
  if (!third.ok) assert.match(third.error, /dolu/);

  const rejoin = applyRoomJoin(joined.room, guest, 'uidGuest', NOW);
  assert.ok(rejoin.ok, 'the same guest can re-join');

  const expired = applyRoomJoin(privateRoom(), guest, 'uidGuest', NOW + 4 * 60 * 60 * 1000);
  assert.equal(expired.ok, false);
});

test('begin round is phase guarded so both clients can request it safely', () => {
  const joined = applyRoomJoin(privateRoom(), guest, 'uidGuest', NOW);
  assert.ok(joined.ok);
  const phase = getRoomPhase(joined.room);
  const started = applyRoomBeginRound(joined.room, phase, NOW + 3000);
  assert.ok(started);
  assert.equal(started.state, 'playing');
  assert.equal(applyRoomBeginRound(started, phase, NOW + 3100), null, 'second request is a no-op');
  assert.notEqual(getRoomPhaseKey(joined.room), getRoomPhaseKey(started));
});

test('correct answer wins the round and records score + elapsed time', () => {
  const room = playingRoom();
  const answer = validAnswerFor(room);
  const { next, outcome } = applyRoomAnswer(room, guest.id, answer, { elapsedSec: 2.34 }, NOW + 6000);
  assert.equal(outcome.accepted, true);
  assert.ok(next);
  assert.equal(next.state, 'round_ended');
  assert.equal(next.roundWinnerId, guest.id);
  assert.equal(next.roundEndReason, 'scored');
  assert.equal(next.scores.u_guest02, 1);
  assert.equal(next.players.u_guest02.score, 1);
  assert.equal(next.players.u_guest02.stats.totalCorrect, 1);
  assert.equal(next.roundElapsedSec, 2.3);

  // the loser's late answer cannot score anymore
  const late = applyRoomAnswer(next, host.id, answer, { elapsedSec: 2.5 }, NOW + 6100);
  assert.equal(late.outcome.accepted, false);
  assert.equal(late.next, null);
});

test('wrong answer pulses the opponent and keeps the round playing', () => {
  const room = playingRoom();
  const { next, outcome } = applyRoomAnswer(room, host.id, 'zzzz yok boyle oyuncu', {}, NOW + 6000);
  assert.equal(outcome.accepted, false);
  assert.equal(outcome.reason, 'invalid_answer');
  assert.ok(next);
  assert.equal(next.state, 'playing');
  assert.equal(next.wrongAttemptPulse?.byPlayerId, host.id);
  assert.equal(next.players[room.hostId].stats.totalWrongAttempts, 1);
});

test('silhouette ends the round when both players run out of attempts', () => {
  let room = playingRoom('silhouette');
  for (let i = 0; i < MAX_SILHOUETTE_ATTEMPTS; i++) {
    const res = applyRoomAnswer(room, host.id, 'zzzz yanlis', {}, NOW + 6000 + i);
    assert.ok(res.next);
    room = res.next;
  }
  assert.equal(room.state, 'playing');
  const blocked = applyRoomAnswer(room, host.id, 'zzzz yanlis', {}, NOW + 7000);
  assert.equal(blocked.outcome.reason, 'attempts_exhausted');
  assert.equal(blocked.next, null);

  for (let i = 0; i < MAX_SILHOUETTE_ATTEMPTS; i++) {
    const res = applyRoomAnswer(room, guest.id, 'zzzz yanlis', {}, NOW + 8000 + i);
    assert.ok(res.next);
    room = res.next;
  }
  assert.equal(room.state, 'round_ended');
  assert.equal(room.roundEndReason, 'attempts_exhausted');
});

test('xox: move passes the turn and bumps turnSeq; wrong player is rejected', () => {
  const room = playingRoom('xox');
  const xox = parseRoomXoxState(room);
  assert.equal(xox?.currentTurnPlayerId, host.id, 'host starts and UI gets the raw player id');

  const notMine = applyRoomAnswer(room, guest.id, 'x', { cellPos: { row: 0, col: 0 } }, NOW + 5000);
  assert.equal(notMine.outcome.reason, 'not_your_turn');

  const answer = validAnswerFor(room, { row: 0, col: 0 });
  const moved = applyRoomAnswer(room, host.id, answer, { cellPos: { row: 0, col: 0 } }, NOW + 5000);
  assert.equal(moved.outcome.accepted, true);
  assert.ok(moved.next);
  assert.equal(moved.next.xoxTurnPlayerId, 'u_guest02');
  assert.equal(moved.next.turnSeq, room.turnSeq + 1);
  assert.equal(parseRoomXoxState(moved.next)?.board[0][0]?.symbol, 'X');

  const taken = applyRoomAnswer(moved.next, guest.id, answer, { cellPos: { row: 0, col: 0 } }, NOW + 5100);
  assert.equal(taken.outcome.reason, 'invalid_cell');
});

test('expire: standard round times out once; stale phase is ignored', () => {
  const room = playingRoom();
  const phase = getRoomPhase(room);
  const expired = applyRoomExpire(room, phase, NOW + 20000);
  assert.ok(expired);
  assert.equal(expired.state, 'round_ended');
  assert.equal(expired.roundEndReason, 'timeout');
  assert.equal(applyRoomExpire(expired, phase, NOW + 20100), null);
});

test('expire: xox passes the turn first, then ends the round', () => {
  const room = playingRoom('xox');
  const first = applyRoomExpire(room, getRoomPhase(room), NOW + 20000);
  assert.ok(first);
  assert.equal(first.state, 'playing');
  assert.equal(first.xoxTurnPlayerId, 'u_guest02');
  assert.equal(applyRoomExpire(first, getRoomPhase(room), NOW + 20001), null, 'old turn phase is stale');

  const second = applyRoomExpire(first, getRoomPhase(first), NOW + 36000);
  assert.ok(second);
  assert.equal(second.state, 'round_ended');
  assert.equal(second.roundEndReason, 'timeout');
});

test('advance goes to next countdown, and to game over at 3 points', () => {
  const room = playingRoom();
  const ended = applyRoomExpire(room, getRoomPhase(room), NOW + 20000);
  assert.ok(ended);
  const next = applyRoomAdvance(ended, getRoomPhase(ended), NOW + 24000);
  assert.ok(next);
  assert.equal(next.state, 'countdown');
  assert.equal(next.currentRoundIndex, 1);
  assert.equal(applyRoomAdvance(next, getRoomPhase(ended), NOW + 24100), null);

  const winning: RoomRecord = { ...ended, scores: { ...ended.scores, u_guest02: 3 } };
  const over = applyRoomAdvance(winning, getRoomPhase(winning), NOW + 24000);
  assert.equal(over?.state, 'game_over');
});

test('rematch waits for both votes, then resets into a new match', () => {
  const room = playingRoom();
  const over: RoomRecord = { ...room, state: 'game_over', scores: { u_host01: 3, u_guest02: 1 } };
  const oneVote = applyRoomRematch(over, host.id, NOW + 1000, 7);
  assert.ok(oneVote);
  assert.equal(oneVote.state, 'game_over');
  assert.equal(oneVote.players.u_host01.rematchRequested, true);

  const both = applyRoomRematch(oneVote, guest.id, NOW + 2000, 7);
  assert.ok(both);
  assert.equal(both.state, 'countdown');
  assert.equal(both.matchSeq, over.matchSeq + 1);
  assert.equal(both.currentRoundIndex, 0);
  assert.deepEqual(both.scores, { u_host01: 0, u_guest02: 0 });
  assert.equal(both.players.u_guest02.rematchRequested, false);
});

test('normalizeRoomRecord fills defaults for partial documents', () => {
  const partial = normalizeRoomRecord({ code: 'ABC234', state: 'waiting', minigameType: 'two_clubs', hostId: 'h' });
  assert.deepEqual(partial.players, {});
  assert.equal(partial.turnSeq, 0);
  assert.equal(partial.matchSeq, 1);
  assert.equal(parseRoomXoxState(partial), null);
});
