import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AccountStore,
  shouldUseLocalDiskFallback,
  type AccountCloudAdapter,
  type PersistentAccountRecord,
} from './accountStore';
import { normalizeRecoveryCode } from './accountEngine';
import {
  ServerMatchLedger,
  type MatchSessionCloudAdapter,
  type ServerMatchSession,
} from './serverSecurity';
import { createInitialProgression } from './retentionEngine';

function createMockAccountCloud(): {
  adapter: AccountCloudAdapter;
  accounts: Map<string, PersistentAccountRecord>;
  purchases: Map<string, string>;
} {
  const accounts = new Map<string, PersistentAccountRecord>();
  const purchases = new Map<string, string>();
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

  const adapter: AccountCloudAdapter = {
    async loadAccounts(limitCount = 2000) {
      return Array.from(accounts.values())
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, limitCount)
        .map(clone);
    },
    async getById(accountId) {
      const found = accounts.get(accountId);
      return found ? clone(found) : null;
    },
    async getByRecoveryCode(normalizedCode) {
      const code = normalizeRecoveryCode(normalizedCode);
      for (const acc of accounts.values()) {
        if (normalizeRecoveryCode(acc.recoveryCode) === code) {
          return clone(acc);
        }
      }
      return null;
    },
    async getByGoogleUid(googleUid) {
      for (const acc of accounts.values()) {
        if (acc.googleUid === googleUid) {
          return clone(acc);
        }
      }
      return null;
    },
    async saveAccount(record) {
      accounts.set(record.accountId, clone(record));
    },
    async deleteAccount(accountId) {
      return accounts.delete(accountId);
    },
    async claimPurchaseToken(params) {
      const owner = purchases.get(params.purchaseToken);
      if (owner && owner !== params.accountId) {
        return { ok: false, conflict: true };
      }
      if (owner === params.accountId) {
        return { ok: true, alreadyOwnedBySameAccount: true };
      }
      purchases.set(params.purchaseToken, params.accountId);
      return { ok: true, alreadyOwnedBySameAccount: false };
    },
  };

  return { adapter, accounts, purchases };
}

test('AccountStore survives Render ephemeral disk wipe via cloud hydration & cache-miss recovery', async () => {
  const tmpDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'render-persist-1-'));
  const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'render-persist-2-'));
  const cloud = createMockAccountCloud();

  try {
    const store1 = new AccountStore(path.join(tmpDir1, 'accounts.json'));
    store1.setCloudAdapter(cloud.adapter);

    const initialProg = createInitialProgression();
    const reg = store1.registerOrUpdate({
      accountId: 'acc_render_1',
      profile: {
        id: 'acc_render_1',
        name: 'KaptanBora',
        avatar: 'avatar_classic_ball',
        score: 0,
      },
      progression: initialProg,
    });
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    const sessionToken = store1.issueSessionTokenForAccount(reg.account);
    store1.recordVerifiedMatchReward({
      accountId: 'acc_render_1',
      coinsAwarded: 215,
      pointsAwarded: 140,
      won: true,
    });
    const buy = await store1.applyVerifiedPurchaseAsync({
      accountId: 'acc_render_1',
      itemId: 'store_ad_free',
      productId: 'futbol_remove_ads',
      purchaseToken: 'gp_tok_render_unique_1',
      orderId: 'GPA.1234-5678',
      grantAdFree: true,
    });
    assert.equal(buy.ok, true);
    await store1.flushCloudWrites();

    // Simulate Render Free cold restart on a brand-new container with empty local disk
    const storeAfterRestart = new AccountStore(path.join(tmpDir2, 'accounts.json'));
    storeAfterRestart.setCloudAdapter(cloud.adapter);

    const hydratedCount = await storeAfterRestart.hydrateFromCloud();
    assert.equal(hydratedCount, 1);

    const recoveredById = await storeAfterRestart.resolveByAccountIdAsync('acc_render_1');
    assert.ok(recoveredById);
    assert.equal(recoveredById.progression.weeklyPoints, initialProg.weeklyPoints + 140);
    assert.equal(recoveredById.progression.coins, initialProg.coins + 215);
    assert.equal(recoveredById.progression.adFree, true);
    assert.equal(storeAfterRestart.verifyAccountSession('acc_render_1', sessionToken), true);

    const recoveredByCode = await storeAfterRestart.recoverByCodeAsync(reg.account.recoveryCode);
    assert.equal(recoveredByCode.ok, true);

    // Register a second account and verify replayed purchase token is rejected atomically
    storeAfterRestart.registerOrUpdate({
      accountId: 'acc_render_2',
      profile: { id: 'acc_render_2', name: 'RakipMert', avatar: 'avatar_classic_ball', score: 0 },
      progression: createInitialProgression(),
    });
    const replay = await storeAfterRestart.applyVerifiedPurchaseAsync({
      accountId: 'acc_render_2',
      itemId: 'store_ad_free',
      productId: 'futbol_remove_ads',
      purchaseToken: 'gp_tok_render_unique_1',
      grantAdFree: true,
    });
    assert.equal(replay.ok, false);
  } finally {
    fs.rmSync(tmpDir1, { recursive: true, force: true });
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  }
});

test('AccountStore resolveByAccountIdAsync recovers an account on cold cache miss even without preload', async () => {
  const tmpDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'render-miss-1-'));
  const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'render-miss-2-'));
  const cloud = createMockAccountCloud();

  try {
    const store1 = new AccountStore(path.join(tmpDir1, 'accounts.json'));
    store1.setCloudAdapter(cloud.adapter);
    store1.registerOrUpdate({
      accountId: 'acc_miss_99',
      profile: { id: 'acc_miss_99', name: 'CacheMissUser', avatar: 'avatar_classic_ball', score: 0 },
      progression: createInitialProgression(),
    });
    await store1.flushCloudWrites();

    const coldStore = new AccountStore(path.join(tmpDir2, 'accounts.json'));
    coldStore.setCloudAdapter(cloud.adapter);
    assert.equal(coldStore.getByAccountId('acc_miss_99'), null);

    const resolved = await coldStore.resolveByAccountIdAsync('acc_miss_99');
    assert.ok(resolved);
    assert.equal(resolved.profile.name, 'CacheMissUser');
  } finally {
    fs.rmSync(tmpDir1, { recursive: true, force: true });
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  }
});

test('ServerMatchLedger survives Render restart and completes restored match session safely', async () => {
  const sessions = new Map<string, ServerMatchSession>();
  const adapter: MatchSessionCloudAdapter = {
    async loadActiveSessions() {
      return Array.from(sessions.values()).map((s) => ({
        ...s,
        scoredRounds: new Set(s.scoredRounds),
      }));
    },
    async getSessionById(sessionId) {
      const s = sessions.get(sessionId);
      return s ? { ...s, scoredRounds: new Set(s.scoredRounds) } : null;
    },
    async saveSession(session) {
      sessions.set(session.sessionId, {
        ...session,
        scoredRounds: new Set(session.scoredRounds),
      });
    },
  };

  const ledger1 = new ServerMatchLedger();
  ledger1.setCloudAdapter(adapter);
  const startedAt = Date.now() - 10_000;
  const session = ledger1.issueSession({
    accountId: 'acc_match_render',
    minigameType: 'two_clubs',
    mode: 'solo',
    now: startedAt,
  });
  await ledger1.flushCloudWrites();

  // Simulate restart with fresh ledger
  const ledger2 = new ServerMatchLedger();
  ledger2.setCloudAdapter(adapter);
  const restoredCount = await ledger2.hydrateFromCloud();
  assert.equal(restoredCount, 1);

  const restored = await ledger2.resolveSessionAsync(session.sessionId);
  assert.ok(restored);

  const outcome = ledger2.consumeVerifiedMatchSession({
    sessionId: session.sessionId,
    accountId: 'acc_match_render',
    hasMultiplier2x: false,
    minDurationMs: 1000,
    now: Date.now(),
  });
  assert.equal(outcome.ok, true);
});

test('shouldUseLocalDiskFallback and AccountStore block unsafe local .data persistence in production mode', () => {
  assert.equal(shouldUseLocalDiskFallback({ NODE_ENV: 'production' }), false);
  assert.equal(shouldUseLocalDiskFallback({ NODE_ENV: 'test', REQUIRE_CLOUD_PERSISTENCE: 'true' }), false);
  assert.equal(
    shouldUseLocalDiskFallback({ NODE_ENV: 'test', DISABLE_LOCAL_ACCOUNT_DISK_FALLBACK: 'true' }),
    false
  );
  assert.equal(shouldUseLocalDiskFallback({ NODE_ENV: 'development' }), true);

  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const prodStore = new AccountStore();
    assert.equal(prodStore.hasLocalDiskPersistence(), false);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('ServerMatchLedger enforces Firestore verified room scores for online matches and prevents duplicate room reward claims', () => {
  const ledger = new ServerMatchLedger();
  const startedAt = Date.now() - 10_000;

  const onlineSession1 = ledger.issueSession({
    accountId: 'acc_online_1',
    minigameType: 'two_clubs',
    mode: 'online_room',
    now: startedAt,
  });

  // Omitting verified Firestore room scores on an online match MUST fail
  const missingRoomScores = ledger.consumeVerifiedMatchSession({
    sessionId: onlineSession1.sessionId,
    accountId: 'acc_online_1',
    hasMultiplier2x: false,
    minDurationMs: 1000,
    now: Date.now(),
  });
  assert.equal(missingRoomScores.ok, false);

  // Supplying Firestore-verified room outcome succeeds once for ROOM1:seq1
  const validOnline = ledger.consumeVerifiedMatchSession({
    sessionId: onlineSession1.sessionId,
    accountId: 'acc_online_1',
    hasMultiplier2x: false,
    roomVerifiedScores: { playerScore: 3, opponentScore: 1 },
    roomClaimKey: 'ROOM1:1:acc_online_1',
    minDurationMs: 1000,
    now: Date.now(),
  });
  assert.equal(validOnline.ok, true);
  if (validOnline.ok) {
    assert.equal(validOnline.verifiedScore, 3);
    assert.equal(validOnline.won, true);
  }

  // Attempting to claim the exact same finished room matchSeq with another session fails
  const secondSession = ledger.issueSession({
    accountId: 'acc_online_1',
    minigameType: 'two_clubs',
    mode: 'online_room',
    now: startedAt,
  });
  const duplicateRoomClaim = ledger.consumeVerifiedMatchSession({
    sessionId: secondSession.sessionId,
    accountId: 'acc_online_1',
    hasMultiplier2x: false,
    roomVerifiedScores: { playerScore: 5, opponentScore: 0 },
    roomClaimKey: 'ROOM1:1:acc_online_1',
    minDurationMs: 1000,
    now: Date.now(),
  });
  assert.equal(duplicateRoomClaim.ok, false);
});
