import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AccountStore } from './accountStore';
import { verifyGooglePlayProductReceipt } from './googlePlayVerifier';
import { createInitialProgression } from './retentionEngine';
import { sanitizeProgressionUpdate } from './serverSecurity';

test('strictActionVerification blocks fabricated coin/point jumps without match/reward activity', () => {
  const prev = createInitialProgression('act_1');
  const forged = sanitizeProgressionUpdate(
    prev,
    {
      ...prev,
      coins: prev.coins + 20000,
      weeklyPoints: prev.weeklyPoints + 8000,
      totalPoints: prev.totalPoints + 8000,
      adFree: true,
      unlockedGiftIds: [...prev.unlockedGiftIds, 'store_ad_free'],
    },
    { strictActionVerification: true }
  );

  // Zero real matches/quests/achievements => only small rewarded-ad buffer allowed, NOT +20,000 coins or +8,000 points
  assert.equal(forged.coins, prev.coins + 500);
  assert.equal(forged.weeklyPoints, prev.weeklyPoints + 250);
  assert.equal(forged.totalPoints, prev.totalPoints + 250);
  // Self-escalation to adFree via unverified sync is blocked
  assert.equal(forged.adFree, false);
  assert.equal(forged.unlockedGiftIds.includes('store_ad_free'), false);

  // Legitimate match progression allows earned match coins and points
  const legit = sanitizeProgressionUpdate(
    prev,
    {
      ...prev,
      matchesPlayed: prev.matchesPlayed + 2,
      wins: prev.wins + 2,
      coins: prev.coins + 1200,
      weeklyPoints: prev.weeklyPoints + 500,
      totalPoints: prev.totalPoints + 500,
    },
    { strictActionVerification: true }
  );
  assert.equal(legit.coins, prev.coins + 1200);
  assert.equal(legit.weeklyPoints, prev.weeklyPoints + 500);

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

  // Idempotent repeat for same account
  const repeatSame = store.applyVerifiedPurchase({
    accountId: 'iap_a',
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.ad_free',
    purchaseToken: 'valid_gp_token_000011112222',
    grantAdFree: true,
  });
  assert.equal(repeatSame.ok, true);
  assert.equal(repeatSame.alreadyCredited, true);

  // Replay across another account must fail
  const replayOther = store.applyVerifiedPurchase({
    accountId: 'iap_b',
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.ad_free',
    purchaseToken: 'valid_gp_token_000011112222',
    grantAdFree: true,
  });
  assert.equal(replayOther.ok, false);
});

test('verifyGooglePlayProductReceipt refuses forged tokens and unconfigured verifier cleanly', async () => {
  const invalidToken = await verifyGooglePlayProductReceipt({
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.ad_free',
    purchaseToken: 'short',
    serviceAccount: null,
  });
  assert.equal(invalidToken.verified, false);
  assert.equal(invalidToken.statusCode, 400);

  const mismatchedSku = await verifyGooglePlayProductReceipt({
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.coins_15000',
    purchaseToken: 'valid_looking_token_1234567890',
    serviceAccount: null,
  });
  assert.equal(mismatchedSku.verified, false);
  assert.equal(mismatchedSku.statusCode, 400);

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
