import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SPARK_BACKUP_COVERAGE_METADATA,
  SPARK_BACKUP_FIRESTORE_COLLECTIONS,
  SPARK_BACKUP_RTDB_PATHS,
  assertNoSecretMaterialInBackup,
  captureSecurityRulesSnapshot,
  exportFirebaseSparkBackup,
  reconcileLegacyUserWithAuthoritativeAccount,
  restoreFirebaseSparkBackup,
  restoreSecurityRulesToDirectory,
  verifyFirebaseSparkBackup,
  type BackupFirestoreLike,
  type BackupRtdbLike,
} from './firebaseBackup';

function createInMemoryFirebaseStores() {
  const firestoreData = new Map<string, Map<string, Record<string, unknown>>>();
  const rtdbData = new Map<string, unknown>();

  const db: BackupFirestoreLike = {
    collection(name: string) {
      if (!firestoreData.has(name)) {
        firestoreData.set(name, new Map());
      }
      const col = firestoreData.get(name)!;
      return {
        async get() {
          return {
            docs: Array.from(col.entries()).map(([id, data]) => ({
              id,
              data: () => structuredClone(data),
            })),
          };
        },
        doc(id: string) {
          return {
            async set(data: Record<string, unknown>) {
              col.set(id, structuredClone(data));
            },
          };
        },
      };
    },
  };

  const rtdb: BackupRtdbLike = {
    ref(rtdbPath: string) {
      return {
        async once() {
          return { val: () => structuredClone(rtdbData.get(rtdbPath) ?? null) };
        },
        async set(val: unknown) {
          rtdbData.set(rtdbPath, structuredClone(val));
        },
      };
    },
  };

  return { firestoreData, rtdbData, db, rtdb };
}

test('Spark backup covers all real Firestore collections, RTDB leaderboard, and .gitignore protects backups/', () => {
  assert.deepEqual(SPARK_BACKUP_FIRESTORE_COLLECTIONS, [
    'backend_accounts',
    'backend_purchases',
    'backend_match_sessions',
    'backend_reward_claims',
    'users',
    'usernames',
    'publicProfiles',
    'userReports',
  ]);
  assert.deepEqual(SPARK_BACKUP_RTDB_PATHS, ['leaderboard']);
  assert.deepEqual(SPARK_BACKUP_COVERAGE_METADATA.excludedEphemeralCollections, ['rooms']);
  assert.deepEqual(SPARK_BACKUP_COVERAGE_METADATA.excludedEphemeralSubcollections, [
    'matchmaking/{minigameType}/queue',
  ]);
  assert.ok(SPARK_BACKUP_COVERAGE_METADATA.excludedExternalSystems.length >= 3);

  const gitignore = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('backups/'), '.gitignore must exclude local backups/ directory');
});

test('Spark backup export -> SHA-256 verification -> tamper rejection -> isolated restore round-trip', async () => {
  const source = createInMemoryFirebaseStores();
  await source.db.collection('backend_accounts').doc('acc_1').set({
    accountId: 'acc_1',
    googleUid: 'uid_1',
    progression: {
      coins: 1800,
      weeklyPoints: 450,
      totalPoints: 2300,
      adFree: true,
      permanentMultiplier2x: false,
      unlockedGiftIds: ['avatar_classic_ball', 'store_ad_free'],
    },
    updatedAt: new Date('2026-11-26T10:00:00.000Z'),
  });
  await source.db.collection('backend_purchases').doc('hash_abc').set({
    accountId: 'acc_1',
    itemId: 'store_ad_free',
    productId: 'futbol_remove_ads',
  });
  await source.db.collection('backend_match_sessions').doc('sess_1').set({
    sessionId: 'sess_1',
    accountId: 'acc_1',
    roomCode: 'AB12CD',
    completed: true,
  });
  await source.db.collection('backend_reward_claims').doc('AB12CD:1:acc_1').set({
    claimKey: 'AB12CD:1:acc_1',
    accountId: 'acc_1',
  });
  // Forged legacy users/{uid} mirror trying to inflate coins & permanentMultiplier2x
  await source.db.collection('users').doc('uid_1').set({
    userId: 'uid_1',
    displayName: 'Kaptan',
    coins: 9_999_999,
    weeklyPoints: 999_999,
    totalPoints: 9_999_999,
    adFree: true,
    permanentMultiplier2x: true,
    unlockedGiftIds: ['avatar_classic_ball', 'store_ad_free', 'store_multiplier_2x'],
  });
  // Legacy-only user without backend_accounts trying to claim forged coins/adFree
  await source.db.collection('users').doc('uid_legacy_untrusted').set({
    userId: 'uid_legacy_untrusted',
    displayName: 'EskiHileli',
    coins: 500_000,
    weeklyPoints: 50_000,
    totalPoints: 100_000,
    adFree: true,
    permanentMultiplier2x: true,
    unlockedGiftIds: ['avatar_classic_ball', 'store_ad_free'],
  });
  await source.db.collection('usernames').doc('kaptan').set({
    usernameKey: 'kaptan',
    ownerUid: 'uid_1',
  });
  await source.db.collection('publicProfiles').doc('kaptan').set({
    usernameKey: 'kaptan',
    ownerUid: 'uid_1',
    weeklyPoints: 450,
  });
  await source.db.collection('userReports').doc('rep_1').set({
    reporterUid: 'uid_1',
    reason: 'inappropriate_name',
  });
  await source.rtdb.ref('leaderboard').set({
    acc_1: { id: 'acc_1', name: 'Kaptan', weeklyPoints: 450, totalPoints: 2300 },
  });

  const snapshot = await exportFirebaseSparkBackup({
    db: source.db,
    rtdb: source.rtdb,
    projectId: 'demo-futbol321',
    now: new Date('2026-11-26T12:00:00.000Z'),
  });

  assert.equal(verifyFirebaseSparkBackup(snapshot).ok, true);
  assert.equal(snapshot.counts.firestore.backend_accounts, 1);
  assert.equal(snapshot.counts.firestore.backend_purchases, 1);
  assert.equal(snapshot.counts.firestore.backend_reward_claims, 1);
  assert.equal(snapshot.counts.firestore.users, 2);
  assert.equal(snapshot.counts.rtdb.leaderboard, 1);

  // Tampering with even 1 coin breaks SHA-256 verification
  const tampered = structuredClone(snapshot);
  (tampered.collections.backend_accounts[0].data.progression as Record<string, unknown>).coins = 999999;
  assert.equal(verifyFirebaseSparkBackup(tampered).ok, false);

  // Secret leak check catches private keys
  assert.equal(
    assertNoSecretMaterialInBackup({ key: '-----BEGIN PRIVATE KEY-----\nabc' }).ok,
    false
  );

  // Dry-run restore does NOT mutate target store
  const target = createInMemoryFirebaseStores();
  const dryReport = await restoreFirebaseSparkBackup({
    db: target.db,
    rtdb: target.rtdb,
    snapshot,
    options: { dryRun: true },
  });
  assert.equal(dryReport.ok, true);
  assert.equal(dryReport.dryRun, true);
  assert.equal(target.firestoreData.get('backend_accounts')?.size || 0, 0);

  // Real isolated restore reconciles forged legacy users/{uid} safely!
  const restoreReport = await restoreFirebaseSparkBackup({
    db: target.db,
    rtdb: target.rtdb,
    snapshot,
    options: { dryRun: false },
  });
  assert.equal(restoreReport.ok, true);
  assert.equal(restoreReport.checksumVerified, true);
  assert.equal(restoreReport.legacyAnomalies.length, 2);

  // Authoritative account restored with exact balance
  const restoredAuth = target.firestoreData.get('backend_accounts')?.get('acc_1');
  assert.ok(restoredAuth);
  assert.equal((restoredAuth.progression as Record<string, unknown>).coins, 1800);

  // Mirror users/uid_1 was forced back to authoritative backend_accounts balance (NOT 9,999,999!)
  const restoredUser1 = target.firestoreData.get('users')?.get('uid_1');
  assert.ok(restoredUser1);
  assert.equal(restoredUser1.coins, 1800);
  assert.equal(restoredUser1.weeklyPoints, 450);
  assert.equal(restoredUser1.adFree, true);
  assert.equal(restoredUser1.permanentMultiplier2x, false);

  // Untrusted legacy-only user without backend_accounts or backend_purchases had forged coins/adFree stripped!
  const restoredLegacy = target.firestoreData.get('users')?.get('uid_legacy_untrusted');
  assert.ok(restoredLegacy);
  assert.equal(restoredLegacy.coins, 250);
  assert.equal(restoredLegacy.weeklyPoints, 0);
  assert.equal(restoredLegacy.totalPoints, 0);
  assert.equal(restoredLegacy.adFree, false);
  assert.equal(restoredLegacy.permanentMultiplier2x, false);

  // RTDB leaderboard restored cleanly
  const restoredLb = target.rtdbData.get('leaderboard') as Record<string, { weeklyPoints: number }>;
  assert.equal(restoredLb.acc_1.weeklyPoints, 450);
});

test('reconcileLegacyUserWithAuthoritativeAccount honors verified backend_purchases for legacy-only accounts', () => {
  const res = reconcileLegacyUserWithAuthoritativeAccount({
    legacyUserDoc: {
      coins: 5000,
      weeklyPoints: 200,
      totalPoints: 1000,
      adFree: true,
      permanentMultiplier2x: true,
      unlockedGiftIds: ['avatar_classic_ball', 'store_ad_free', 'store_multiplier_2x'],
    },
    authoritativeAccount: null,
    verifiedPurchasesForAccount: [
      { itemId: 'store_ad_free', productId: 'futbol_remove_ads' },
    ],
  });

  assert.equal(res.trustedSource, 'legacy_sanitized');
  assert.equal(res.adFree, true); // backed by verified backend_purchases
  assert.equal(res.permanentMultiplier2x, false); // NOT backed -> stripped
  assert.equal(res.coins, 250); // unverified legacy coins capped
  assert.equal(res.weeklyPoints, 0);
  assert.ok(res.anomalies.includes('unverified_legacy_multiplier2x_stripped'));
});

test('security rules snapshot backs up firestore.rules & database.rules.json with SHA-256 and restores cleanly to isolated dir', async () => {
  const source = createInMemoryFirebaseStores();
  const securityRules = captureSecurityRulesSnapshot(process.cwd());
  assert.ok(securityRules.firestoreRules.includes('isValidRosterVersion'));
  assert.ok(securityRules.databaseRulesJson.includes('"leaderboard"'));
  assert.equal(securityRules.firestoreRulesSha256.length, 64);
  assert.equal(securityRules.databaseRulesSha256.length, 64);

  const snapshot = await exportFirebaseSparkBackup({
    db: source.db,
    rtdb: source.rtdb,
    projectId: 'demo-futbol321',
    securityRules,
  });
  assert.equal(verifyFirebaseSparkBackup(snapshot).ok, true);

  // Tampering 1 character in backed-up firestore.rules MUST fail verification
  const tamperedRules = structuredClone(snapshot);
  tamperedRules.securityRules!.firestoreRules += '\n// tampered';
  assert.equal(verifyFirebaseSparkBackup(tamperedRules).ok, false);

  // Isolated temp directory restore produces byte-for-byte identical rules files
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'futbol-rules-restore-'));
  try {
    const dryRes = restoreSecurityRulesToDirectory({ snapshot, targetDir: tmpDir, dryRun: true });
    assert.equal(dryRes.ok, true);
    assert.equal(fs.existsSync(path.join(tmpDir, 'firestore.rules')), false);

    const realRes = restoreSecurityRulesToDirectory({ snapshot, targetDir: tmpDir, dryRun: false });
    assert.equal(realRes.ok, true);
    assert.equal(
      fs.readFileSync(path.join(tmpDir, 'firestore.rules'), 'utf8'),
      securityRules.firestoreRules
    );
    assert.equal(
      fs.readFileSync(path.join(tmpDir, 'database.rules.json'), 'utf8'),
      securityRules.databaseRulesJson
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
