import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  limit,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { ref, get, set, remove } from 'firebase/database';
import { AccountStore } from '../src/game/accountStore';
import {
  createFirebaseAccountCloudAdapter,
  createFirebaseMatchSessionCloudAdapter,
  getFirebaseAdminApp,
  verifyOnlineRoomOutcomeAdmin,
} from '../src/game/firebaseAdminService';
import {
  exportFirebaseSparkBackup,
  restoreFirebaseSparkBackup,
  verifyFirebaseSparkBackup,
} from '../src/game/firebaseBackup';
import { ROSTER_DATA_VERSION } from '../src/game/rosterVersion';
import { ServerMatchLedger } from '../src/game/serverSecurity';
import { createInitialProgression } from '../src/game/retentionEngine';

const PROJECT_ID = 'demo-futbol321';

let testEnv: RulesTestEnvironment;

function parseHostPort(envVal: string | undefined, fallbackHost: string, fallbackPort: number) {
  if (!envVal) return { host: fallbackHost, port: fallbackPort };
  const [host, portStr] = envVal.split(':');
  const port = Number(portStr) || fallbackPort;
  return { host: host || fallbackHost, port };
}

test.before(async () => {
  const firestoreAddr = parseHostPort(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1', 8080);
  const rtdbAddr = parseHostPort(process.env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1', 9000);

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: firestoreAddr.host,
      port: firestoreAddr.port,
      rules: fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
    database: {
      host: rtdbAddr.host,
      port: rtdbAddr.port,
      rules: fs.readFileSync(path.resolve(process.cwd(), 'database.rules.json'), 'utf8'),
    },
  });
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearDatabase();
});

test.after(async () => {
  await testEnv?.cleanup();
});

function validStarterUserPayload(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    userId: uid,
    displayName: 'TestOyuncu',
    usernameKey: 'testoyuncu',
    email: 'oyuncu@example.com',
    avatar: '⚽',
    coins: 250,
    weeklyPoints: 0,
    totalPoints: 0,
    unlockedGiftIds: ['avatar_classic'],
    adFree: false,
    permanentMultiplier2x: false,
    progressionJson: '{"coins":250}',
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

test('Firestore Zero-Trust Economy, AdFree Entitlements, Guest Linking & Dirty Dozen Rules', async () => {
  const verifiedCtx = testEnv.authenticatedContext('uid_alice', {
    email: 'oyuncu@example.com',
    email_verified: true,
  });
  const unverifiedCtx = testEnv.authenticatedContext('uid_unverified', {
    email: 'unverified@example.com',
    email_verified: false,
  });
  const bobCtx = testEnv.authenticatedContext('uid_bob', {
    email: 'bob@example.com',
    email_verified: true,
  });
  const anonCtx = testEnv.unauthenticatedContext();

  // 1. Unverified email rejected on /users
  await assertFails(
    setDoc(
      doc(unverifiedCtx.firestore(), 'users', 'uid_unverified'),
      validStarterUserPayload('uid_unverified', { email: 'unverified@example.com' })
    )
  );

  // 2. Owner with starter-only bounds succeeds on /users create
  await assertSucceeds(
    setDoc(doc(verifiedCtx.firestore(), 'users', 'uid_alice'), validStarterUserPayload('uid_alice'))
  );

  // 3. NEGATIVE: Client creating /users with forged coins, weeklyPoints, adFree, multiplier2x, or store_ad_free MUST FAIL
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validStarterUserPayload('uid_bob', { email: 'bob@example.com', coins: 500 })
    )
  );
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validStarterUserPayload('uid_bob', { email: 'bob@example.com', weeklyPoints: 100 })
    )
  );
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validStarterUserPayload('uid_bob', { email: 'bob@example.com', adFree: true })
    )
  );
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validStarterUserPayload('uid_bob', { email: 'bob@example.com', permanentMultiplier2x: true })
    )
  );
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validStarterUserPayload('uid_bob', {
        email: 'bob@example.com',
        unlockedGiftIds: ['avatar_classic', 'store_ad_free'],
      })
    )
  );

  // 4. NEGATIVE: Client updating /users to inflate coins, weeklyPoints, totalPoints, adFree, multiplier2x or unlockedGiftIds MUST FAIL
  await assertFails(
    updateDoc(doc(verifiedCtx.firestore(), 'users', 'uid_alice'), {
      coins: 260,
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(verifiedCtx.firestore(), 'users', 'uid_alice'), {
      weeklyPoints: 10,
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(verifiedCtx.firestore(), 'users', 'uid_alice'), {
      totalPoints: 10,
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(verifiedCtx.firestore(), 'users', 'uid_alice'), {
      adFree: true,
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(verifiedCtx.firestore(), 'users', 'uid_alice'), {
      permanentMultiplier2x: true,
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(verifiedCtx.firestore(), 'users', 'uid_alice'), {
      unlockedGiftIds: ['avatar_classic', 'store_ad_free'],
      updatedAt: serverTimestamp(),
    })
  );

  // 5. NEGATIVE: UID spoofing, email spoofing, shadow admin field & forged updatedAt
  await assertFails(getDoc(doc(bobCtx.firestore(), 'users', 'uid_alice')));
  await assertFails(
    setDoc(doc(bobCtx.firestore(), 'users', 'uid_alice'), validStarterUserPayload('uid_alice'))
  );
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validStarterUserPayload('uid_bob', { email: 'oyuncu@example.com' })
    )
  );
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validStarterUserPayload('uid_bob', { email: 'bob@example.com', isAdmin: true })
    )
  );
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validStarterUserPayload('uid_bob', { email: 'bob@example.com', updatedAt: new Date() })
    )
  );

  // 6. Listing /users, /usernames, /publicProfiles blocked
  await assertFails(getDocs(query(collection(verifiedCtx.firestore(), 'users'), limit(10))));
  await assertFails(getDocs(query(collection(anonCtx.firestore(), 'usernames'), limit(10))));
  await assertFails(getDocs(query(collection(anonCtx.firestore(), 'publicProfiles'), limit(10))));

  // 7. Username reservation hijack & unauthorized deletion blocked
  await assertSucceeds(
    setDoc(doc(verifiedCtx.firestore(), 'usernames', 'testoyuncu'), {
      usernameKey: 'testoyuncu',
      displayName: 'TestOyuncu',
      ownerUid: 'uid_alice',
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(bobCtx.firestore(), 'usernames', 'testoyuncu'), {
      displayName: 'Hijacked',
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(deleteDoc(doc(bobCtx.firestore(), 'usernames', 'testoyuncu')));

  // 8. Admin-seeded existing account balance & adFree preserved when guest links email; client cannot revoke or boost
  await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
    await setDoc(
      doc(adminCtx.firestore(), 'users', 'uid_guest_link'),
      validStarterUserPayload('uid_guest_link', {
        email: '',
        coins: 4500,
        weeklyPoints: 900,
        totalPoints: 3200,
        adFree: true,
        unlockedGiftIds: ['avatar_classic', 'store_ad_free'],
      })
    );
  });
  const linkedCtx = testEnv.authenticatedContext('uid_guest_link', {
    email: 'linked@example.com',
    email_verified: true,
  });
  // Linking verified email while preserving existing server coins/adFree succeeds cleanly
  await assertSucceeds(
    setDoc(
      doc(linkedCtx.firestore(), 'users', 'uid_guest_link'),
      validStarterUserPayload('uid_guest_link', {
        email: 'linked@example.com',
        avatar: '🥅',
        coins: 4500,
        weeklyPoints: 900,
        totalPoints: 3200,
        adFree: true,
        unlockedGiftIds: ['avatar_classic', 'store_ad_free'],
      })
    )
  );
  // Attempting to alter balance or revoke adFree after linking fails
  await assertFails(
    updateDoc(doc(linkedCtx.firestore(), 'users', 'uid_guest_link'), {
      coins: 5000,
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(linkedCtx.firestore(), 'users', 'uid_guest_link'), {
      adFree: false,
      updatedAt: serverTimestamp(),
    })
  );

  // 9. PublicProfile: client cannot mint non-zero points, crown, or inject PII
  await assertFails(
    setDoc(doc(bobCtx.firestore(), 'publicProfiles', 'bob_pro'), {
      usernameKey: 'bob_pro',
      ownerUid: 'uid_bob',
      displayName: 'BobPro',
      avatar: '⚽',
      hasCrown: false,
      weeklyPoints: 500,
      totalPoints: 500,
      statsJson: '{}',
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    setDoc(doc(bobCtx.firestore(), 'publicProfiles', 'bob_pro'), {
      usernameKey: 'bob_pro',
      ownerUid: 'uid_bob',
      displayName: 'BobPro',
      avatar: '⚽',
      hasCrown: true,
      weeklyPoints: 0,
      totalPoints: 0,
      statsJson: '{}',
      updatedAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(bobCtx.firestore(), 'publicProfiles', 'bob_pro'), {
      usernameKey: 'bob_pro',
      ownerUid: 'uid_bob',
      displayName: 'BobPro',
      avatar: '⚽',
      hasCrown: false,
      weeklyPoints: 0,
      totalPoints: 0,
      statsJson: '{}',
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(bobCtx.firestore(), 'publicProfiles', 'bob_pro'), {
      weeklyPoints: 250,
      updatedAt: serverTimestamp(),
    })
  );
});

test('Firestore Private Room, Matchmaking Queue, rosterVersion Enforcement & UGC User Report Rules', async () => {
  const hostCtx = testEnv.authenticatedContext('uid_host');
  const guestCtx = testEnv.authenticatedContext('uid_guest');
  const intruderCtx = testEnv.authenticatedContext('uid_intruder');

  // NEGATIVE: Creating room without rosterVersion or with invalid rosterVersion MUST FAIL
  await assertFails(
    setDoc(doc(hostCtx.firestore(), 'rooms', 'NOVER1'), {
      code: 'NOVER1',
      source: 'private',
      minigameType: 'two_clubs',
      hostUid: 'uid_host',
      guestUid: null,
      hostId: 'p_host',
      guestId: null,
      memberUids: ['uid_host'],
      players: { p_host: { id: 'p_host', name: 'Host' } },
      scores: {},
      state: 'waiting',
      roundIndex: 0,
      matchSeq: 1,
      questionSeed: 12345,
      roundIds: [1, 2, 3],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    setDoc(doc(hostCtx.firestore(), 'rooms', 'BADVR1'), {
      code: 'BADVR1',
      source: 'private',
      minigameType: 'two_clubs',
      rosterVersion: 'invalid space version',
      hostUid: 'uid_host',
      guestUid: null,
      hostId: 'p_host',
      guestId: null,
      memberUids: ['uid_host'],
      players: { p_host: { id: 'p_host', name: 'Host' } },
      scores: {},
      state: 'waiting',
      roundIndex: 0,
      matchSeq: 1,
      questionSeed: 12345,
      roundIds: [1, 2, 3],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await assertSucceeds(
    setDoc(doc(hostCtx.firestore(), 'rooms', 'AB12CD'), {
      code: 'AB12CD',
      source: 'private',
      minigameType: 'two_clubs',
      rosterVersion: ROSTER_DATA_VERSION,
      guestRosterVersion: null,
      hostUid: 'uid_host',
      guestUid: null,
      hostId: 'p_host',
      guestId: null,
      memberUids: ['uid_host'],
      players: { p_host: { id: 'p_host', name: 'Host' } },
      scores: {},
      state: 'waiting',
      roundIndex: 0,
      matchSeq: 1,
      questionSeed: 12345,
      roundIds: [1, 2, 3],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // NEGATIVE: Guest joining with missing or mismatched guestRosterVersion MUST FAIL
  await assertFails(
    updateDoc(doc(guestCtx.firestore(), 'rooms', 'AB12CD'), {
      guestUid: 'uid_guest',
      guestId: 'p_guest',
      memberUids: ['uid_host', 'uid_guest'],
      players: { p_host: { id: 'p_host', name: 'Host' }, p_guest: { id: 'p_guest', name: 'Guest' } },
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(guestCtx.firestore(), 'rooms', 'AB12CD'), {
      guestUid: 'uid_guest',
      guestId: 'p_guest',
      guestRosterVersion: '1.0.9-legacy',
      memberUids: ['uid_host', 'uid_guest'],
      players: { p_host: { id: 'p_host', name: 'Host' }, p_guest: { id: 'p_guest', name: 'Guest' } },
      updatedAt: serverTimestamp(),
    })
  );

  // Guest cannot inject score when joining even with matching guestRosterVersion
  await assertFails(
    updateDoc(doc(guestCtx.firestore(), 'rooms', 'AB12CD'), {
      guestUid: 'uid_guest',
      guestId: 'p_guest',
      guestRosterVersion: ROSTER_DATA_VERSION,
      memberUids: ['uid_host', 'uid_guest'],
      players: { p_host: { id: 'p_host', name: 'Host' }, p_guest: { id: 'p_guest', name: 'Guest' } },
      scores: { p_host: 0, p_guest: 9 },
      updatedAt: serverTimestamp(),
    })
  );

  // Clean guest join with matching guestRosterVersion succeeds
  await assertSucceeds(
    updateDoc(doc(guestCtx.firestore(), 'rooms', 'AB12CD'), {
      guestUid: 'uid_guest',
      guestId: 'p_guest',
      guestRosterVersion: ROSTER_DATA_VERSION,
      memberUids: ['uid_host', 'uid_guest'],
      players: { p_host: { id: 'p_host', name: 'Host' }, p_guest: { id: 'p_guest', name: 'Guest' } },
      updatedAt: serverTimestamp(),
    })
  );

  // NEGATIVE: Mutating rosterVersion after room creation MUST FAIL
  await assertFails(
    updateDoc(doc(hostCtx.firestore(), 'rooms', 'AB12CD'), {
      rosterVersion: '1.0.9-legacy',
      updatedAt: serverTimestamp(),
    })
  );

  // First scoring jump straight to 10 rejected; +1 increment allowed
  await assertFails(
    updateDoc(doc(hostCtx.firestore(), 'rooms', 'AB12CD'), {
      scores: { p_host: 10 },
      updatedAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    updateDoc(doc(hostCtx.firestore(), 'rooms', 'AB12CD'), {
      scores: { p_host: 1 },
      updatedAt: serverTimestamp(),
    })
  );

  // Rematch transition preserves rosterVersion & guestRosterVersion; tampering fails
  await assertSucceeds(
    updateDoc(doc(hostCtx.firestore(), 'rooms', 'AB12CD'), {
      state: 'game_over',
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(hostCtx.firestore(), 'rooms', 'AB12CD'), {
      matchSeq: 2,
      guestRosterVersion: '1.0.9-legacy',
      state: 'countdown',
      scores: { p_host: 0, p_guest: 0 },
      roundIndex: 0,
      updatedAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    updateDoc(doc(hostCtx.firestore(), 'rooms', 'AB12CD'), {
      matchSeq: 2,
      guestRosterVersion: ROSTER_DATA_VERSION,
      state: 'countdown',
      scores: { p_host: 0, p_guest: 0 },
      roundIndex: 0,
      updatedAt: serverTimestamp(),
    })
  );

  // Matchmaking queue: missing rosterVersion rejected; cross-version claim rejected via getAfter; same-version claim succeeds
  await assertFails(
    setDoc(doc(hostCtx.firestore(), 'matchmaking', 'two_clubs', 'queue', 'q_no_ver'), {
      playerKey: 'q_no_ver',
      uid: 'uid_host',
      minigameType: 'two_clubs',
      profile: { id: 'p_host', name: 'Host' },
      joinedAt: serverTimestamp(),
      matchedRoomCode: null,
    })
  );
  await assertSucceeds(
    setDoc(doc(hostCtx.firestore(), 'matchmaking', 'two_clubs', 'queue', 'q_old_host'), {
      playerKey: 'q_old_host',
      uid: 'uid_host',
      minigameType: 'two_clubs',
      rosterVersion: '1.0.9-legacy',
      profile: { id: 'p_host', name: 'OldHost' },
      joinedAt: serverTimestamp(),
      matchedRoomCode: null,
    })
  );
  await assertSucceeds(
    setDoc(doc(hostCtx.firestore(), 'matchmaking', 'two_clubs', 'queue', 'q_new_host'), {
      playerKey: 'q_new_host',
      uid: 'uid_host',
      minigameType: 'two_clubs',
      rosterVersion: ROSTER_DATA_VERSION,
      profile: { id: 'p_host', name: 'NewHost' },
      joinedAt: serverTimestamp(),
      matchedRoomCode: null,
    })
  );

  // NEGATIVE: New guest attempting to claim old host's queue doc with a new-version room MUST FAIL
  await assertFails(
    runTransaction(guestCtx.firestore(), async (tx) => {
      const qRef = doc(guestCtx.firestore(), 'matchmaking', 'two_clubs', 'queue', 'q_old_host');
      await tx.get(qRef);
      tx.set(doc(guestCtx.firestore(), 'rooms', 'MMBAD1'), {
        code: 'MMBAD1',
        source: 'matchmaking',
        minigameType: 'two_clubs',
        rosterVersion: ROSTER_DATA_VERSION,
        guestRosterVersion: ROSTER_DATA_VERSION,
        hostUid: 'uid_guest',
        guestUid: 'uid_host',
        hostId: 'p_guest',
        guestId: 'p_host',
        memberUids: ['uid_guest', 'uid_host'],
        players: { p_guest: { id: 'p_guest', name: 'Guest' }, p_host: { id: 'p_host', name: 'OldHost' } },
        scores: { p_guest: 0, p_host: 0 },
        state: 'countdown',
        roundIndex: 0,
        matchSeq: 1,
        questionSeed: 999,
        roundIds: [1, 2, 3],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.update(qRef, { matchedRoomCode: 'MMBAD1' });
    })
  );

  // POSITIVE: New guest claiming new host's queue doc with matching rosterVersion room SUCCEEDS
  await assertSucceeds(
    runTransaction(guestCtx.firestore(), async (tx) => {
      const qRef = doc(guestCtx.firestore(), 'matchmaking', 'two_clubs', 'queue', 'q_new_host');
      await tx.get(qRef);
      tx.set(doc(guestCtx.firestore(), 'rooms', 'MMOK22'), {
        code: 'MMOK22',
        source: 'matchmaking',
        minigameType: 'two_clubs',
        rosterVersion: ROSTER_DATA_VERSION,
        guestRosterVersion: ROSTER_DATA_VERSION,
        hostUid: 'uid_guest',
        guestUid: 'uid_host',
        hostId: 'p_guest',
        guestId: 'p_host',
        memberUids: ['uid_guest', 'uid_host'],
        players: { p_guest: { id: 'p_guest', name: 'Guest' }, p_host: { id: 'p_host', name: 'NewHost' } },
        scores: { p_guest: 0, p_host: 0 },
        state: 'countdown',
        roundIndex: 0,
        matchSeq: 1,
        questionSeed: 999,
        roundIds: [1, 2, 3],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.update(qRef, { matchedRoomCode: 'MMOK22' });
    })
  );

  // Intruder cannot mutate or delete active 2-player room
  await assertFails(
    updateDoc(doc(intruderCtx.firestore(), 'rooms', 'AB12CD'), {
      scores: { p_host: 1, p_guest: 5 },
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(deleteDoc(doc(intruderCtx.firestore(), 'rooms', 'AB12CD')));

  // UGC Report: signed-in user can create only as self; reading, updating, deleting or spoofing reporterUid rejected
  await assertFails(
    setDoc(doc(guestCtx.firestore(), 'userReports', 'rep_spoof'), {
      reporterUid: 'uid_host',
      targetId: 'bad_user',
      targetName: 'BadUser',
      reason: 'inappropriate_name',
      createdAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(guestCtx.firestore(), 'userReports', 'rep_123'), {
      reporterUid: 'uid_guest',
      targetId: 'bad_user',
      targetName: 'BadUser',
      reason: 'inappropriate_name',
      details: 'Uygunsuz kullanici adi',
      createdAt: serverTimestamp(),
    })
  );
  await assertFails(getDoc(doc(guestCtx.firestore(), 'userReports', 'rep_123')));
  await assertFails(deleteDoc(doc(guestCtx.firestore(), 'userReports', 'rep_123')));
});

test('RTDB Leaderboard Rules block ALL client writes & unauthorized legacy claiming while permitting auth reads', async () => {
  const anonCtx = testEnv.unauthenticatedContext();
  const aliceCtx = testEnv.authenticatedContext('uid_alice');
  const malloryCtx = testEnv.authenticatedContext('uid_mallory');

  // Seed existing server/legacy entries via Admin (rules bypassed)
  await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
    await set(ref(adminCtx.database(), 'leaderboard/alice_key'), {
      id: 'alice_key',
      name: 'Alice',
      ownerUid: 'uid_alice',
      weeklyPoints: 450,
      totalPoints: 1200,
      updatedAt: Date.now(),
    });
    await set(ref(adminCtx.database(), 'leaderboard/legacy_ali'), {
      id: 'legacy_ali',
      name: 'Ali10x',
      weeklyPoints: 1200,
      totalPoints: 3400,
      updatedAt: Date.now() - 10000,
    });
  });

  // Unauthenticated read & write blocked
  await assertFails(get(ref(anonCtx.database(), 'leaderboard')));
  await assertFails(
    set(ref(anonCtx.database(), 'leaderboard/anon_fake'), {
      id: 'anon_fake',
      name: 'Anon',
      ownerUid: 'anon',
      weeklyPoints: 9999,
      totalPoints: 9999,
      updatedAt: Date.now(),
    })
  );

  // Authenticated player can READ leaderboard
  await assertSucceeds(get(ref(malloryCtx.database(), 'leaderboard')));

  // NEGATIVE: Even owner client cannot directly create, inflate or delete RTDB leaderboard (only Firebase Admin SDK backend writes)
  await assertFails(
    set(ref(aliceCtx.database(), 'leaderboard/alice_new'), {
      id: 'alice_new',
      name: 'AliceNew',
      ownerUid: 'uid_alice',
      weeklyPoints: 100,
      totalPoints: 100,
      updatedAt: Date.now(),
    })
  );
  await assertFails(
    set(ref(aliceCtx.database(), 'leaderboard/alice_key'), {
      id: 'alice_key',
      name: 'Alice',
      ownerUid: 'uid_alice',
      weeklyPoints: 9999,
      totalPoints: 9999,
      updatedAt: Date.now(),
    })
  );
  await assertFails(remove(ref(aliceCtx.database(), 'leaderboard/alice_key')));

  // NEGATIVE: Mallory cannot hijack/claim legacy 1.0.x record without ownerUid directly from client
  await assertFails(
    set(ref(malloryCtx.database(), 'leaderboard/legacy_ali'), {
      id: 'legacy_ali',
      name: 'MalloryHijack',
      ownerUid: 'uid_mallory',
      weeklyPoints: 9999,
      totalPoints: 9999,
      updatedAt: Date.now(),
    })
  );
  await assertFails(
    set(ref(aliceCtx.database(), 'leaderboard/legacy_ali'), {
      id: 'legacy_ali',
      name: 'Ali10x',
      ownerUid: 'uid_alice',
      weeklyPoints: 1200,
      totalPoints: 3400,
      updatedAt: Date.now(),
    })
  );
});

test('Firebase Admin Firestore Emulator persists accounts, coins, purchases & online match verification across restarts while denying direct client access', async () => {
  const accountAdapter = createFirebaseAccountCloudAdapter();
  const matchAdapter = createFirebaseMatchSessionCloudAdapter();
  assert.ok(accountAdapter, 'Firestore Emulator Admin AccountCloudAdapter aktif olmalı');
  assert.ok(matchAdapter, 'Firestore Emulator Admin MatchSessionCloudAdapter aktif olmalı');

  const store1 = new AccountStore(null);
  store1.setCloudAdapter(accountAdapter);
  const ledger1 = new ServerMatchLedger();
  ledger1.setCloudAdapter(matchAdapter);

  const initProg = createInitialProgression('acc_emu_1');
  const reg = store1.registerOrUpdate({
    accountId: 'acc_emu_1',
    googleUid: 'uid_alice',
    profile: { id: 'acc_emu_1', name: 'EmulatorKaptan', avatar: 'avatar_classic_ball', score: 0 },
    progression: initProg,
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  const sessionToken = store1.issueSessionTokenForAccount(reg.account);
  const session = ledger1.issueSession({
    accountId: 'acc_emu_1',
    minigameType: 'two_clubs',
    mode: 'online_room',
    roomCode: 'EMU999',
    matchSeq: 1,
    rosterVersion: ROSTER_DATA_VERSION,
    now: Date.now() - 10_000,
  });
  const oppSession = ledger1.issueSession({
    accountId: 'acc_emu_2',
    minigameType: 'two_clubs',
    mode: 'online_room',
    roomCode: 'EMU999',
    matchSeq: 1,
    rosterVersion: ROSTER_DATA_VERSION,
    now: Date.now() - 10_000,
  });
  const roomRoundIds = session.rounds
    .slice(0, 5)
    .map((r) => r.pairing?.id || '')
    .filter(Boolean);

  // Seed finished authoritative room outcome in Firestore Emulator (first with mismatched version, then valid)
  await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
    await setDoc(doc(adminCtx.firestore(), 'rooms', 'EMUMIS'), {
      code: 'EMUMIS',
      rosterVersion: '1.0.9-legacy',
      guestRosterVersion: '1.0.9-legacy',
      hostId: 'acc_emu_1',
      hostUid: 'uid_alice',
      guestId: 'acc_emu_2',
      guestUid: 'uid_bob',
      memberUids: ['uid_alice', 'uid_bob'],
      minigameType: 'two_clubs',
      roundIds: roomRoundIds,
      state: 'game_over',
      matchSeq: 1,
      scores: { acc_emu_1: 3, acc_emu_2: 1 },
    });
    await setDoc(doc(adminCtx.firestore(), 'rooms', 'EMU999'), {
      code: 'EMU999',
      rosterVersion: ROSTER_DATA_VERSION,
      guestRosterVersion: ROSTER_DATA_VERSION,
      hostId: 'acc_emu_1',
      hostUid: 'uid_alice',
      guestId: 'acc_emu_2',
      guestUid: 'uid_bob',
      memberUids: ['uid_alice', 'uid_bob'],
      minigameType: 'two_clubs',
      roundIds: roomRoundIds,
      state: 'game_over',
      matchSeq: 1,
      scores: { acc_emu_1: 3, acc_emu_2: 1 },
    });
  });

  // Version mismatch on server room verification MUST FAIL with roster_version_mismatch
  const mismatchOutcome = await verifyOnlineRoomOutcomeAdmin({
    roomCode: 'EMUMIS',
    uid: 'uid_alice',
    playerId: 'acc_emu_1',
    expectedRosterVersion: ROSTER_DATA_VERSION,
  });
  assert.equal(mismatchOutcome.ok, false);
  if (!mismatchOutcome.ok) {
    assert.equal(mismatchOutcome.errorCode, 'roster_version_mismatch');
  }

  const roomOutcome = await verifyOnlineRoomOutcomeAdmin({
    roomCode: 'EMU999',
    uid: 'uid_alice',
    playerId: 'acc_emu_1',
    expectedRosterVersion: ROSTER_DATA_VERSION,
  });
  assert.equal(roomOutcome.ok, true);
  if (!roomOutcome.ok) return;
  assert.equal(roomOutcome.playerScore, 3);
  assert.equal(roomOutcome.opponentScore, 1);

  // Forged Firestore room score without server-verified answers MUST fail
  const tamperedFail = await ledger1.consumeVerifiedMatchSessionAsync({
    sessionId: session.sessionId,
    accountId: 'acc_emu_1',
    hasMultiplier2x: false,
    serverVerifiedOpponentScore: null,
    requireServerOpponentVerification: true,
    roomClaimKey: `EMU999:${roomOutcome.matchSeq}:acc_emu_1`,
    minDurationMs: 1000,
    now: Date.now(),
  });
  assert.equal(tamperedFail.ok, false);

  // Submit 3 valid answers for host & 1 valid answer for opponent via server session
  for (let i = 0; i < 3; i++) {
    const pid = session.rounds[i]?.pairing?.validPlayerIds[0];
    assert.ok(pid);
    const ansRes = ledger1.submitVerifiedAnswer({
      sessionId: session.sessionId,
      accountId: 'acc_emu_1',
      roundIndex: i,
      answer: pid,
    });
    assert.equal(ansRes.ok, true);
    if (ansRes.ok) assert.equal(ansRes.valid, true);
  }
  const oppPid = oppSession.rounds[0]?.pairing?.validPlayerIds[0];
  assert.ok(oppPid);
  const oppAnsRes = ledger1.submitVerifiedAnswer({
    sessionId: oppSession.sessionId,
    accountId: 'acc_emu_2',
    roundIndex: 0,
    answer: oppPid,
  });
  assert.equal(oppAnsRes.ok, true);
  await ledger1.flushCloudWrites();

  // Verify opponent server score hydrates cleanly from Firestore Emulator (zero client room score trust!)
  const serverVerifiedOppScore = await ledger1.findOpponentVerifiedScoreAsync(
    'EMU999',
    roomOutcome.matchSeq,
    'acc_emu_1'
  );
  assert.equal(serverVerifiedOppScore, 1);

  const reward = await ledger1.consumeVerifiedMatchSessionAsync({
    sessionId: session.sessionId,
    accountId: 'acc_emu_1',
    hasMultiplier2x: false,
    serverVerifiedOpponentScore: serverVerifiedOppScore,
    requireServerOpponentVerification: true,
    roomClaimKey: `EMU999:${roomOutcome.matchSeq}:acc_emu_1`,
    minDurationMs: 1000,
    now: Date.now(),
  });
  assert.equal(reward.ok, true);
  if (!reward.ok) return;
  assert.equal(reward.won, true);

  // Atomic Firestore Transaction double-claim protection: second claim MUST fail even from a fresh ledger instance!
  const freshLedger = new ServerMatchLedger();
  freshLedger.setCloudAdapter(matchAdapter);
  const dupSession = freshLedger.issueSession({
    accountId: 'acc_emu_1',
    minigameType: 'two_clubs',
    mode: 'online_room',
    roomCode: 'EMU999',
    matchSeq: 1,
    rosterVersion: ROSTER_DATA_VERSION,
    now: Date.now() - 10_000,
  });
  const dupPid = dupSession.rounds[0]?.pairing?.validPlayerIds[0];
  assert.ok(dupPid);
  freshLedger.submitVerifiedAnswer({
    sessionId: dupSession.sessionId,
    accountId: 'acc_emu_1',
    roundIndex: 0,
    answer: dupPid,
  });
  const doubleClaimAttempt = await freshLedger.consumeVerifiedMatchSessionAsync({
    sessionId: dupSession.sessionId,
    accountId: 'acc_emu_1',
    hasMultiplier2x: false,
    serverVerifiedOpponentScore: 1,
    requireServerOpponentVerification: true,
    roomClaimKey: `EMU999:${roomOutcome.matchSeq}:acc_emu_1`,
    minDurationMs: 1000,
    now: Date.now(),
  });
  assert.equal(doubleClaimAttempt.ok, false);

  store1.recordVerifiedMatchReward({
    accountId: 'acc_emu_1',
    coinsAwarded: reward.coinsAwarded,
    pointsAwarded: reward.pointsAwarded,
    won: reward.won,
  });
  const buy = await store1.applyVerifiedPurchaseAsync({
    accountId: 'acc_emu_1',
    itemId: 'store_ad_free',
    productId: 'futbol_remove_ads',
    purchaseToken: 'emu_gp_token_unique_12345',
    orderId: 'GPA.EMU-0001',
    grantAdFree: true,
  });
  assert.equal(buy.ok, true);
  await store1.flushCloudWrites();
  await ledger1.flushCloudWrites();

  // NEGATIVE: Clients CANNOT read or write server-only backend_* collections directly (including backend_reward_claims)
  const aliceCtx = testEnv.authenticatedContext('uid_alice', {
    email: 'alice@example.com',
    email_verified: true,
  });
  await assertFails(getDoc(doc(aliceCtx.firestore(), 'backend_accounts', 'acc_emu_1')));
  await assertFails(
    setDoc(doc(aliceCtx.firestore(), 'backend_accounts', 'acc_emu_fake'), { coins: 999999 })
  );
  await assertFails(
    setDoc(doc(aliceCtx.firestore(), 'backend_purchases', 'fake_hash'), { accountId: 'acc_emu_1' })
  );
  await assertFails(getDoc(doc(aliceCtx.firestore(), 'backend_match_sessions', session.sessionId)));
  await assertFails(
    getDoc(doc(aliceCtx.firestore(), 'backend_reward_claims', `EMU999:${roomOutcome.matchSeq}:acc_emu_1`))
  );
  await assertFails(
    setDoc(doc(aliceCtx.firestore(), 'backend_reward_claims', 'forged_claim'), { accountId: 'acc_emu_1' })
  );

  // Free Spark-plan backup & isolated restore verification directly on Firebase Emulator
  const adminApp = getFirebaseAdminApp();
  assert.ok(adminApp);
  const adminDb = getFirestore(adminApp);
  const backupSnapshot = await exportFirebaseSparkBackup({
    db: adminDb as unknown as Parameters<typeof exportFirebaseSparkBackup>[0]['db'],
    rtdb: null,
    projectId: PROJECT_ID,
  });
  assert.equal(verifyFirebaseSparkBackup(backupSnapshot).ok, true);
  assert.equal(backupSnapshot.counts.firestore.backend_accounts, 1);
  assert.equal(backupSnapshot.counts.firestore.backend_purchases, 1);
  assert.ok(backupSnapshot.counts.firestore.backend_reward_claims >= 1);

  // Wipe Firestore Emulator completely, then restore from Spark backup and verify full recovery
  await testEnv.clearFirestore();
  const restoreRes = await restoreFirebaseSparkBackup({
    db: adminDb as unknown as Parameters<typeof restoreFirebaseSparkBackup>[0]['db'],
    rtdb: null,
    snapshot: backupSnapshot,
    options: { dryRun: false },
  });
  assert.equal(restoreRes.ok, true);
  assert.equal(restoreRes.checksumVerified, true);
  assert.equal(restoreRes.restoredFirestoreCounts.backend_accounts, 1);
  assert.equal(restoreRes.restoredFirestoreCounts.backend_purchases, 1);

  // Simulate full Render container wipe & restart (zero local disk, empty RAM) after restore!
  const storeAfterRestart = new AccountStore(null);
  storeAfterRestart.setCloudAdapter(accountAdapter);
  const restoredCount = await storeAfterRestart.hydrateFromCloud();
  assert.equal(restoredCount, 1);

  const restoredAccount = await storeAfterRestart.resolveByAccountIdAsync('acc_emu_1');
  assert.ok(restoredAccount);
  assert.equal(restoredAccount.progression.coins, initProg.coins + reward.coinsAwarded);
  assert.equal(restoredAccount.progression.weeklyPoints, initProg.weeklyPoints + reward.pointsAwarded);
  assert.equal(restoredAccount.progression.adFree, true);
  assert.equal(storeAfterRestart.verifyAccountSession('acc_emu_1', sessionToken), true);

  // Replaying same Play Billing purchase token on second account MUST fail even after restart
  storeAfterRestart.registerOrUpdate({
    accountId: 'acc_emu_2',
    googleUid: 'uid_bob',
    profile: { id: 'acc_emu_2', name: 'EmulatorBob', avatar: 'avatar_classic_ball', score: 0 },
    progression: createInitialProgression('acc_emu_2'),
  });
  const replayRes = await storeAfterRestart.applyVerifiedPurchaseAsync({
    accountId: 'acc_emu_2',
    itemId: 'store_ad_free',
    productId: 'futbol_remove_ads',
    purchaseToken: 'emu_gp_token_unique_12345',
    grantAdFree: true,
  });
  assert.equal(replayRes.ok, false);
});
