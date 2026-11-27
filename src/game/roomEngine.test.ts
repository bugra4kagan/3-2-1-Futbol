import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYERS } from './database';
import { getRoundValidPlayerIds } from './minigameEngine';
import { MAX_SILHOUETTE_ATTEMPTS } from './silhouetteEngine';
import {
  MatchmakingQueueCandidate,
  RoomRecord,
  applyRoomAdvance,
  applyRoomAbandon,
  applyRoomAnswer,
  applyRoomBeginRound,
  applyRoomDisconnectForfeit,
  applyRoomDisconnectGrace,
  applyRoomExpire,
  applyRoomJoin,
  applyRoomRematch,
  applyRoomRematchResponse,
  applyRoomResumeFromDisconnect,
  DISCONNECT_GRACE_MAX_TOTAL_MS_PER_PLAYER,
  DISCONNECT_GRACE_TIMEOUT_MS,
  REMATCH_OFFER_TIMEOUT_MS,
  REMATCH_REQUEST_COOLDOWN_MS,
  createRoomRecord,
  getRoomPhase,
  getRoomPhaseKey,
  getRoomRoundPayload,
  isValidRoomCode,
  normalizeRoomCode,
  normalizeRoomRecord,
  parseRoomXoxState,
  selectMatchmakingCandidates,
} from './roomEngine';
import { ONLINE_MATCHMAKING_TIMEOUT_MS } from './realtimeSyncHelpers';
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

test('rematch waits for both votes, then resets into a new match excluding prior roundIds', () => {
  const room = playingRoom();
  const over: RoomRecord = { ...room, state: 'game_over', scores: { u_host01: 3, u_guest02: 1 } };
  const oneVote = applyRoomRematch(over, host.id, NOW + 1000, 7);
  assert.ok(oneVote);
  assert.equal(oneVote.state, 'game_over');
  assert.equal(oneVote.players.u_host01.rematchRequested, true);
  assert.equal(oneVote.rematchOffer?.status, 'pending');
  assert.equal(oneVote.rematchOffer?.expiresAt, NOW + 1000 + REMATCH_OFFER_TIMEOUT_MS);

  // Anti-spam cooldown rejects repeated requests from same player
  assert.equal(applyRoomRematch(oneVote, host.id, NOW + 2000, 8), null);

  const both = applyRoomRematch(oneVote, guest.id, NOW + 2000, 777);
  assert.ok(both);
  assert.equal(both.state, 'countdown');
  assert.equal(both.matchSeq, over.matchSeq + 1);
  assert.equal(both.currentRoundIndex, 0);
  assert.deepEqual(both.scores, { u_host01: 0, u_guest02: 0 });
  assert.equal(both.players.u_guest02.rematchRequested, false);
  assert.equal(both.rematchOffer, null);
  const oldSet = new Set(over.roundIds);
  assert.equal(both.roundIds.some((id) => oldSet.has(id)), false);
});

test('rematch decline and 20s timeout expire cleanly without restarting', () => {
  const room = playingRoom();
  const over: RoomRecord = { ...room, state: 'game_over', scores: { u_host01: 3, u_guest02: 2 } };

  const offered = applyRoomRematch(over, host.id, NOW + 1000, 11);
  assert.ok(offered);

  const declined = applyRoomRematchResponse(offered, guest.id, 'decline', NOW + 3000);
  assert.ok(declined);
  assert.equal(declined.state, 'game_over');
  assert.equal(declined.rematchOffer?.status, 'declined');
  assert.equal(declined.players.u_host01.rematchRequested, false);
  // Cooldown prevents instant re-spam before REMATCH_REQUEST_COOLDOWN_MS elapses
  assert.equal(applyRoomRematch(declined, host.id, NOW + 3500, 12), null);
  assert.ok(applyRoomRematch(declined, host.id, NOW + 3000 + REMATCH_REQUEST_COOLDOWN_MS + 500, 12));

  // Timeout after 20s marks offer expired
  const expiredEarly = applyRoomRematchResponse(offered, guest.id, 'expire', NOW + 1000 + REMATCH_OFFER_TIMEOUT_MS - 1);
  assert.equal(expiredEarly, null);
  const expired = applyRoomRematchResponse(offered, guest.id, 'expire', NOW + 1000 + REMATCH_OFFER_TIMEOUT_MS + 1);
  assert.ok(expired);
  assert.equal(expired.state, 'game_over');
  assert.equal(expired.rematchOffer?.status, 'expired');
  assert.equal(DISCONNECT_GRACE_TIMEOUT_MS, 45000);
});

test('45s disconnect grace pauses timer, enforces cumulative cap, restores room, and forfeits after 45s', () => {
  const room = playingRoom();
  const baseRoundStartedAt = room.roundStartedAt!;

  // Trigger 45s grace when guest drops
  const paused = applyRoomDisconnectGrace(room, guest.id, 11000, NOW + 5000);
  assert.ok(paused);
  // Firestore rule compatibility: room.state remains in allowed enum
  assert.equal(paused.state, 'playing');
  assert.equal(paused.disconnectGrace?.disconnectedKey, 'u_guest02');
  assert.equal(paused.disconnectGrace?.expiresAt, NOW + 5000 + DISCONNECT_GRACE_TIMEOUT_MS);

  // Cannot forfeit before 45s expires
  assert.equal(applyRoomDisconnectForfeit(paused, NOW + 40000), null);

  // Reconnect at +20s shifts timer forward cleanly & preserves cumulative pause budget on room
  const resumed = applyRoomResumeFromDisconnect(paused, guest.id, NOW + 25000);
  assert.ok(resumed);
  assert.equal(resumed.disconnectGrace, null);
  assert.equal(resumed.roundStartedAt, baseRoundStartedAt + 20000);
  assert.equal(resumed.pauseUsedMsByPlayer?.u_guest02, 20000);

  // Once cumulative pause budget (90s) is exhausted, further pauses are rejected to prevent stall abuse
  const budgeted = {
    ...resumed,
    pauseUsedMsByPlayer: { u_guest02: DISCONNECT_GRACE_MAX_TOTAL_MS_PER_PLAYER },
  };
  assert.equal(applyRoomDisconnectGrace(budgeted, guest.id, 9000, NOW + 30000), null);

  // If disconnected player stays offline >45s, connected host wins cleanly by <= +1 step (Firestore rule compliant)
  const forfeited = applyRoomDisconnectForfeit(paused, NOW + 5000 + DISCONNECT_GRACE_TIMEOUT_MS + 100);
  assert.ok(forfeited);
  assert.equal(forfeited.state, 'game_over');
  assert.equal(forfeited.scores.u_host01, 1);
  assert.equal(forfeited.disconnectGrace, null);
});

test('normalizeRoomRecord fills defaults for partial documents', () => {
  const partial = normalizeRoomRecord({ code: 'ABC234', state: 'waiting', minigameType: 'two_clubs', hostId: 'h' });
  assert.deepEqual(partial.players, {});
  assert.equal(partial.turnSeq, 0);
  assert.equal(partial.matchSeq, 1);
  assert.equal(parseRoomXoxState(partial), null);
});

test('private rooms never inject bots, preserve shared rounds across all 4 modes, and sync ready + countdown times', () => {
  const modes: MinigameType[] = ['two_clubs', 'xox', 'career', 'country_club'];
  for (const mode of modes) {
    const room = privateRoom(mode);
    assert.equal(room.source, 'private');
    assert.equal(room.state, 'waiting');
    assert.equal(Object.keys(room.players).some((k) => k.includes('bot')), false);
    assert.equal(room.players[room.hostId].ready, true);
    assert.equal(room.countdownEndsAt, null);

    // Lowercase & whitespace room code normalizes identically on join
    const normalized = normalizeRoomCode('  abc 234 ');
    assert.equal(normalized, room.code);

    const joinRes = applyRoomJoin(room, guest, 'uidGuest', NOW + 1000);
    assert.ok(joinRes.ok);
    const joined = joinRes.room;
    assert.equal(joined.minigameType, mode);
    assert.deepEqual(joined.roundIds, room.roundIds);
    assert.equal(joined.questionSeed, room.questionSeed);
    assert.equal(joined.players[room.hostId].ready, true);
    assert.equal(joined.players.u_guest02.ready, true);
    assert.equal(joined.state, 'countdown');
    assert.equal(joined.countdownStartedAt, NOW + 1000);
    assert.equal(joined.countdownEndsAt, NOW + 4000);

    // Same round resolution for both clients
    const payload = getRoomRoundPayload(joined);
    assert.ok(payload);
    assert.equal(payload.minigameType, mode);
  }
});

test('matchmaking timeout is 12 seconds and candidate selection excludes self, wrong mode, expired, and matched entries', () => {
  assert.equal(ONLINE_MATCHMAKING_TIMEOUT_MS, 12000);

  const now = 2_000_000_000;
  const entries: MatchmakingQueueCandidate[] = [
    {
      playerKey: 'u_me',
      uid: 'uid_me',
      minigameType: 'two_clubs',
      rosterVersion: '2026.11.26-v25k',
      profile: { id: 'u_me', name: 'Ben', avatar: '⚽' },
      joinedAtMs: now - 1000,
      expiresAtMs: now + 50000,
      matchedRoomCode: null,
    },
    // Same uid under different key -> rejected (self match prevention)
    {
      playerKey: 'u_me_tab2',
      uid: 'uid_me',
      minigameType: 'two_clubs',
      rosterVersion: '2026.11.26-v25k',
      profile: { id: 'u_me_tab2', name: 'Ben2', avatar: '⚽' },
      joinedAtMs: now - 5000,
      expiresAtMs: now + 50000,
      matchedRoomCode: null,
    },
    // Wrong minigameType -> rejected
    {
      playerKey: 'u_xox_user',
      uid: 'uid_xox',
      minigameType: 'xox',
      rosterVersion: '2026.11.26-v25k',
      profile: { id: 'u_xox_user', name: 'XoxRakip', avatar: '⚽' },
      joinedAtMs: now - 5000,
      expiresAtMs: now + 50000,
      matchedRoomCode: null,
    },
    // Already matched -> rejected
    {
      playerKey: 'u_taken',
      uid: 'uid_taken',
      minigameType: 'two_clubs',
      rosterVersion: '2026.11.26-v25k',
      profile: { id: 'u_taken', name: 'DoluRakip', avatar: '⚽' },
      joinedAtMs: now - 4000,
      expiresAtMs: now + 50000,
      matchedRoomCode: 'XYZ999',
    },
    // Expired -> rejected
    {
      playerKey: 'u_expired',
      uid: 'uid_expired',
      minigameType: 'two_clubs',
      rosterVersion: '2026.11.26-v25k',
      profile: { id: 'u_expired', name: 'EskiKayit', avatar: '⚽' },
      joinedAtMs: now - 40000,
      expiresAtMs: now - 1000,
      matchedRoomCode: null,
    },
    // Eligible waiting player (lexicographically earlier key but waited > 600ms)
    {
      playerKey: 'u_alpha',
      uid: 'uid_alpha',
      minigameType: 'two_clubs',
      rosterVersion: '2026.11.26-v25k',
      profile: { id: 'u_alpha', name: 'GercekRakip1', avatar: '⚽' },
      joinedAtMs: now - 3000,
      expiresAtMs: now + 50000,
      matchedRoomCode: null,
    },
    // Eligible waiting player (lexicographically larger key)
    {
      playerKey: 'u_zulu',
      uid: 'uid_zulu',
      minigameType: 'two_clubs',
      rosterVersion: '2026.11.26-v25k',
      profile: { id: 'u_zulu', name: 'GercekRakip2', avatar: '⚽' },
      joinedAtMs: now - 500,
      expiresAtMs: now + 50000,
      matchedRoomCode: null,
    },
  ];

  const picked = selectMatchmakingCandidates({
    entries,
    myKey: 'u_me',
    myUid: 'uid_me',
    myProfileId: 'u_me',
    minigameType: 'two_clubs',
    now,
  });

  // Earliest waiting valid opponent (u_alpha) comes first, then u_zulu; none of self/expired/matched/wrong-mode appear
  assert.deepEqual(
    picked.map((p) => p.playerKey),
    ['u_alpha', 'u_zulu']
  );

  // Two players in matchmaking never match across different minigames
  const xoxPicked = selectMatchmakingCandidates({
    entries,
    myKey: 'u_me',
    myUid: 'uid_me',
    myProfileId: 'u_me',
    minigameType: 'career',
    now,
  });
  assert.deepEqual(xoxPicked, []);
});

test('room join guards prevent empty/invalid codes, started rooms, full rooms, and own room re-entry', () => {
  assert.equal(isValidRoomCode(normalizeRoomCode(' ab12 ')), false);
  assert.equal(isValidRoomCode(normalizeRoomCode('   ab c234  ')), true);

  const started = playingRoom('country_club');
  const blockedJoin = applyRoomJoin(started, { id: 'u_late', name: 'GecKalan', avatar: '⚽', score: 0 }, 'uidLate', NOW + 6000);
  assert.equal(blockedJoin.ok, false);
});

test('applyRoomBeginRound rejects premature start before 3-2-1 countdown completes and applyRoomAbandon forfeits cleanly', () => {
  const joined = applyRoomJoin(privateRoom('xox'), guest, 'uidGuest', NOW + 1000);
  assert.ok(joined.ok);
  const premature = applyRoomBeginRound(joined.room, getRoomPhase(joined.room), NOW + 2000);
  assert.equal(premature, null);

  const started = applyRoomBeginRound(joined.room, getRoomPhase(joined.room), NOW + 4000);
  assert.ok(started);
  assert.equal(started.state, 'playing');

  const abandoned = applyRoomAbandon(started, guest.id, NOW + 8000);
  assert.ok(abandoned);
  assert.equal(abandoned.state, 'game_over');
  assert.equal(abandoned.scores.u_host01, 1);
  assert.equal(abandoned.disconnectGrace, null);
});
