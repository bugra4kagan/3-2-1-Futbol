import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AccountStore } from './accountStore';
import { createInitialProgression } from './retentionEngine';
import {
  ServerMatchLedger,
  SlidingRateLimiter,
  createAccountSessionToken,
  generateAccountAuthSecret,
  sanitizeLeaderboardNumbers,
  sanitizeProgressionUpdate,
  verifyAccountSessionToken,
} from './serverSecurity';
import { MATCH_PAIRINGS, PLAYERS } from './database';

test('HMAC account session tokens validate only matching accountId + secret via timing-safe compare', () => {
  const secret = generateAccountAuthSecret();
  const key = 'test_server_signing_key_32_chars_min';
  const token = createAccountSessionToken('player_123', secret, key);

  assert.equal(verifyAccountSessionToken('player_123', token, secret, key), true);
  assert.equal(verifyAccountSessionToken('player_999', token, secret, key), false);
  assert.equal(verifyAccountSessionToken('player_123', 'deadbeef', secret, key), false);
  assert.equal(verifyAccountSessionToken('player_123', token, 'wrong_secret', key), false);
  assert.equal(verifyAccountSessionToken('player_123', undefined, secret, key), false);
});

test('AccountStore issues and verifies session tokens and clamps extreme coin/point injections', () => {
  const store = new AccountStore(null);
  const initProg = createInitialProgression();
  const reg = store.registerOrUpdate({
    accountId: 'sec_user_1',
    profile: { id: 'sec_user_1', name: 'GuvenliOyuncu', avatar: 'ball', score: 0 },
    progression: { ...initProg, coins: 9999999, weeklyPoints: 9999999, totalPoints: 9999999 },
  });

  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  // Initial account bounds match Firestore create bounds
  assert.equal(reg.account.progression.coins, 50000);
  assert.equal(reg.account.progression.weeklyPoints, 25000);
  assert.equal(reg.account.progression.totalPoints, 250000);

  const token = store.issueSessionTokenForAccount(reg.account);
  assert.equal(store.verifyAccountSession('sec_user_1', token), true);
  assert.equal(store.verifyAccountSession('sec_user_1', '0'.repeat(64)), false);

  // Subsequent sync clamps gain delta and prevents lowering totalPoints
  const sync = store.syncProgression({
    accountId: 'sec_user_1',
    progression: {
      ...reg.account.progression,
      coins: 50000 + 500000,
      weeklyPoints: 25000 + 500000,
      totalPoints: 100,
    },
  });
  assert.equal(sync.ok, true);
  assert.equal(sync.account?.progression.coins, 75000);
  assert.equal(sync.account?.progression.weeklyPoints, 35000);
  assert.equal(sync.account?.progression.totalPoints, 250000);

  // Public profile never leaks sessionSecret or recoveryCode or coins
  const pub = store.findPublicProfile('sec_user_1');
  assert.ok(pub);
  assert.equal((pub as unknown as Record<string, unknown>).sessionSecret, undefined);
  assert.equal((pub as unknown as Record<string, unknown>).recoveryCode, undefined);
  assert.equal((pub as unknown as Record<string, unknown>).coins, undefined);

  const directSanitized = sanitizeProgressionUpdate(initProg, {
    ...initProg,
    coins: -50,
    weeklyPoints: 1000000,
    totalPoints: 1000000,
  });
  assert.equal(directSanitized.coins, 0);
  assert.equal(directSanitized.weeklyPoints, initProg.weeklyPoints + 10000);
  assert.equal(directSanitized.totalPoints, initProg.totalPoints + 10000);

  const lbClamp = sanitizeLeaderboardNumbers({ weeklyPoints: 100, totalPoints: 200 }, 999999, 50);
  assert.equal(lbClamp.weeklyPoints, 10100);
  assert.equal(lbClamp.totalPoints, 200);
});

test('SlidingRateLimiter enforces request ceiling per window and recovers after window elapses', () => {
  const limiter = new SlidingRateLimiter(3, 10000);
  const t0 = 1_700_000_000_000;

  assert.equal(limiter.consume('ip1', t0).allowed, true);
  assert.equal(limiter.consume('ip1', t0 + 100).allowed, true);
  assert.equal(limiter.consume('ip1', t0 + 200).allowed, true);
  const blocked = limiter.consume('ip1', t0 + 300);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 9);

  // Different IP unaffected
  assert.equal(limiter.consume('ip2', t0 + 300).allowed, true);

  // Allowed again once window clears
  assert.equal(limiter.consume('ip1', t0 + 10001).allowed, true);
});

test('firestore.rules maintains default-deny, email verification, score bounds, and room join guards', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  assert.ok(rules.includes('allow read, write: if false;'), 'Global default-deny must exist');
  assert.ok(rules.includes('allow list: if false;'), 'Collection listing must remain blocked');
  assert.ok(rules.includes('isEmailVerifiedIfPresent()'), 'Verified email check required for user backup');
  assert.ok(rules.includes('request.auth.token.email_verified == true'));
  assert.ok(rules.includes('data.updatedAt == request.time'), 'Server timestamp enforcement missing');
  assert.ok(rules.includes('incoming().scores == existing().scores'), 'Room join must prevent score injection');
  assert.ok(rules.includes('incoming().memberUids == [request.auth.uid]'), 'Waiting room must start with host only');
  assert.ok(rules.includes('request.query.limit != null && request.query.limit <= 25'), 'Queue list limit check missing');
  assert.ok(rules.includes('lastActivityScore <= 50000000'), 'Public activity score cap missing');
});

test('dual-player online score binding verifies BOTH players via server ledger and blocks rematch double rewards', () => {
  const ledger = new ServerMatchLedger();
  const pairing0 = MATCH_PAIRINGS[0];
  const validAnswerName = PLAYERS[pairing0.validPlayerIds[0]].name;
  const roundIds = MATCH_PAIRINGS.slice(0, 5).map((p) => p.id);

  const hostSession = ledger.issueSession({
    accountId: 'acc_host',
    minigameType: 'two_clubs',
    mode: 'online_room',
    roomCode: 'RMCH01',
    matchSeq: 1,
    roundIds,
    now: 1_700_000_000_000,
  });
  const guestSession = ledger.issueSession({
    accountId: 'acc_guest',
    minigameType: 'two_clubs',
    mode: 'online_room',
    roomCode: 'RMCH01',
    matchSeq: 1,
    roundIds,
    now: 1_700_000_000_000,
  });

  // Guest legitimately answers 2 rounds on the server; host answers 1 round
  const ansH0 = ledger.submitVerifiedAnswer({
    sessionId: hostSession.sessionId,
    accountId: 'acc_host',
    roundIndex: 0,
    answer: validAnswerName,
  });
  assert.equal(ansH0.ok && ansH0.valid, true);

  const p1Name = PLAYERS[MATCH_PAIRINGS[1].validPlayerIds[0]].name;
  const p2Name = PLAYERS[MATCH_PAIRINGS[2].validPlayerIds[0]].name;
  ledger.submitVerifiedAnswer({ sessionId: guestSession.sessionId, accountId: 'acc_guest', roundIndex: 1, answer: p1Name });
  ledger.submitVerifiedAnswer({ sessionId: guestSession.sessionId, accountId: 'acc_guest', roundIndex: 2, answer: p2Name });

  // Server cross-check detects opponent actually scored 2 even if Firestore reported 0
  const detectedOppScore = ledger.findOpponentVerifiedScore('RMCH01', 1, 'acc_host');
  assert.equal(detectedOppScore, 2);

  // Trying to claim 3 goals when server only verified 1 is rejected
  const forged = ledger.consumeVerifiedMatchSession({
    sessionId: hostSession.sessionId,
    accountId: 'acc_host',
    hasMultiplier2x: false,
    roomVerifiedScores: { playerScore: 3, opponentScore: 0 },
    roomClaimKey: 'RMCH01:1:acc_host',
    now: 1_700_000_020_000,
  });
  assert.equal(forged.ok, false);

  // Legitimate claim with server-bounded opponentScore (2) accurately registers host loss (won: false)
  const legitHostClaim = ledger.consumeVerifiedMatchSession({
    sessionId: hostSession.sessionId,
    accountId: 'acc_host',
    hasMultiplier2x: false,
    roomVerifiedScores: { playerScore: 1, opponentScore: Math.max(0, detectedOppScore ?? 0) },
    roomClaimKey: 'RMCH01:1:acc_host',
    now: 1_700_000_020_000,
  });
  assert.equal(legitHostClaim.ok, true);
  if (legitHostClaim.ok) {
    assert.equal(legitHostClaim.won, false);
    assert.equal(legitHostClaim.verifiedScore, 1);
  }

  // Re-claiming same matchSeq session fails (blocks double reward)
  const replay = ledger.consumeVerifiedMatchSession({
    sessionId: hostSession.sessionId,
    accountId: 'acc_host',
    hasMultiplier2x: false,
    roomVerifiedScores: { playerScore: 1, opponentScore: 2 },
    roomClaimKey: 'RMCH01:1:acc_host',
    now: 1_700_000_025_000,
  });
  assert.equal(replay.ok, false);

  // Rematch (matchSeq: 2) issues a brand-new unique sessionId so both matches stay independent
  const rematchSession = ledger.issueSession({
    accountId: 'acc_host',
    minigameType: 'two_clubs',
    mode: 'online_room',
    roomCode: 'RMCH01',
    matchSeq: 2,
    roundIds: MATCH_PAIRINGS.slice(5, 10).map((p) => p.id),
    now: 1_700_000_030_000,
  });
  assert.notEqual(rematchSession.sessionId, hostSession.sessionId);
});
