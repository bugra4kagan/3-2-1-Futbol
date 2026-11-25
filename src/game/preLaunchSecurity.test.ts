import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AccountStore } from './accountStore';
import { verifyGooglePlayProductReceipt } from './googlePlayVerifier';
import { createInitialProgression } from './retentionEngine';
import { ServerMatchLedger, sanitizeProgressionUpdate } from './serverSecurity';

test('strictActionVerification rejects client-fabricated matchesPlayed/coin/point inflation', () => {
  const prev = createInitialProgression('act_1');
  const forged = sanitizeProgressionUpdate(
    prev,
    {
      ...prev,
      matchesPlayed: prev.matchesPlayed + 25,
      wins: prev.wins + 25,
      coins: prev.coins + 20000,
      weeklyPoints: prev.weeklyPoints + 8000,
      totalPoints: prev.totalPoints + 8000,
      adFree: true,
      unlockedGiftIds: [...prev.unlockedGiftIds, 'store_ad_free'],
    },
    { strictActionVerification: true }
  );

  // Zero trust on client-sent matchesPlayed/counters: untrusted JSON sync grants 0 extra coins/points!
  assert.equal(forged.coins, prev.coins);
  assert.equal(forged.weeklyPoints, prev.weeklyPoints);
  assert.equal(forged.totalPoints, prev.totalPoints);
  assert.equal(forged.adFree, false);
  assert.equal(forged.unlockedGiftIds.includes('store_ad_free'), false);

  // Spending coins (e.g., store unlock) is still permitted
  const spend = sanitizeProgressionUpdate(
    { ...prev, coins: 2000 },
    { ...prev, coins: 1000, unlockedGiftIds: [...prev.unlockedGiftIds, 'frame_gold'] },
    { strictActionVerification: true }
  );
  assert.equal(spend.coins, 1000);

  // Existing VIP adFree entitlement is ALWAYS preserved
  const existingVip = { ...prev, adFree: true, unlockedGiftIds: [...prev.unlockedGiftIds, 'store_ad_free'] };
  const afterSync = sanitizeProgressionUpdate(
    existingVip,
    { ...existingVip, adFree: false, unlockedGiftIds: [] },
    { strictActionVerification: true }
  );
  assert.equal(afterSync.adFree, true);
  assert.ok(afterSync.unlockedGiftIds.includes('store_ad_free'));
});

test('ServerMatchLedger & AccountStore credit coins/points only from verified one-time server sessions', () => {
  const store = new AccountStore(null);
  const ledger = new ServerMatchLedger();
  const initProg = createInitialProgression('srv_p1');
  const reg = store.registerOrUpdate({
    accountId: 'srv_p1',
    profile: { id: 'srv_p1', name: 'SunucuOyuncusu', avatar: 'ball', score: 0 },
    progression: initProg,
  });
  assert.equal(reg.ok, true);

  const session = ledger.issueSession({
    accountId: 'srv_p1',
    minigameType: 'two_clubs',
    mode: 'solo',
    now: 1_700_000_000_000,
  });

  // Too fast (< 3000ms) is rejected
  const tooFast = ledger.consumeVerifiedMatchSession({
    sessionId: session.sessionId,
    accountId: 'srv_p1',
    playerScore: 3,
    opponentScore: 0,
    hasMultiplier2x: false,
    now: 1_700_000_000_500,
  });
  assert.equal(tooFast.ok, false);

  // Valid elapsed duration computes authoritative server reward
  const valid = ledger.consumeVerifiedMatchSession({
    sessionId: session.sessionId,
    accountId: 'srv_p1',
    playerScore: 3,
    opponentScore: 1,
    hasMultiplier2x: false,
    now: 1_700_000_045_000,
  });
  assert.equal(valid.ok, true);
  if (!valid.ok) return;

  const credited = store.recordVerifiedMatchReward({
    accountId: 'srv_p1',
    coinsAwarded: valid.coinsAwarded,
    pointsAwarded: valid.pointsAwarded,
    won: valid.won,
  });
  assert.equal(credited.ok, true);
  assert.equal(credited.account?.progression.coins, initProg.coins + valid.coinsAwarded);
  assert.equal(credited.account?.progression.weeklyPoints, initProg.weeklyPoints + valid.pointsAwarded);

  // Replaying same matchSessionId fails
  const replay = ledger.consumeVerifiedMatchSession({
    sessionId: session.sessionId,
    accountId: 'srv_p1',
    playerScore: 3,
    opponentScore: 1,
    hasMultiplier2x: false,
    now: 1_700_000_050_000,
  });
  assert.equal(replay.ok, false);
});

test('AccountStore.applyVerifiedPurchase is idempotent and rejects cross-account token replay', () => {
  const store = new AccountStore(null);
  const initA = createInitialProgression('iap_a');
  const initB = createInitialProgression('iap_b');

  const regA = store.registerOrUpdate({
    accountId: 'iap_a',
    profile: { id: 'iap_a', name: 'AliKaptan', avatar: 'ball', score: 0 },
    progression: initA,
  });
  const regB = store.registerOrUpdate({
    accountId: 'iap_b',
    profile: { id: 'iap_b', name: 'VeliGolcu', avatar: 'ball', score: 0 },
    progression: initB,
  });
  assert.ok(regA.ok && regB.ok);

  const firstApply = store.applyVerifiedPurchase({
    accountId: 'iap_a',
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.ad_free',
    purchaseToken: 'valid_gp_token_000011112222',
    grantAdFree: true,
  });
  assert.equal(firstApply.ok, true);
  assert.equal(firstApply.alreadyCredited, false);
  assert.equal(firstApply.account?.progression.adFree, true);

  const repeatSame = store.applyVerifiedPurchase({
    accountId: 'iap_a',
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.ad_free',
    purchaseToken: 'valid_gp_token_000011112222',
    grantAdFree: true,
  });
  assert.equal(repeatSame.ok, true);
  assert.equal(repeatSame.alreadyCredited, true);

  const replayOther = store.applyVerifiedPurchase({
    accountId: 'iap_b',
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.ad_free',
    purchaseToken: 'valid_gp_token_000011112222',
    grantAdFree: true,
  });
  assert.equal(replayOther.ok, false);
});

test('verifyGooglePlayProductReceipt rejects discontinued SKUs and unconfigured verifier cleanly', async () => {
  const invalidToken = await verifyGooglePlayProductReceipt({
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.ad_free',
    purchaseToken: 'short',
    serviceAccount: null,
  });
  assert.equal(invalidToken.verified, false);
  assert.equal(invalidToken.statusCode, 400);

  const closedCoinSku = await verifyGooglePlayProductReceipt({
    itemId: 'pack_coin_15000',
    productId: 'com.futbol321.challenge.coins_15000',
    purchaseToken: 'valid_looking_token_1234567890',
    serviceAccount: null,
  });
  assert.equal(closedCoinSku.verified, false);
  assert.equal(closedCoinSku.statusCode, 400);

  const missingCreds = await verifyGooglePlayProductReceipt({
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.ad_free',
    purchaseToken: 'valid_looking_token_1234567890',
    serviceAccount: null,
  });
  assert.equal(missingCreds.verified, false);
  assert.equal(missingCreds.statusCode, 503);
});

test('firebase.json and hardened database.rules.json enforce RTDB auth, ownership, and delta guards', () => {
  const fbJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase.json'), 'utf8'));
  assert.equal(fbJson.firestore.rules, 'firestore.rules');
  assert.equal(fbJson.database.rules, 'database.rules.json');
  assert.ok(fbJson.emulators?.firestore?.port);
  assert.ok(fbJson.emulators?.database?.port);

  const dbRules = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'database.rules.json'), 'utf8')
  );
  assert.equal(dbRules.rules['.read'], false);
  assert.equal(dbRules.rules['.write'], false);
  const lbRule = dbRules.rules.leaderboard['$playerKey'];
  assert.equal(lbRule['.read'], 'auth != null');
  assert.ok(String(lbRule['.write']).includes('auth.uid'));
  assert.ok(String(lbRule['.validate']).includes('weeklyPoints'));
});
