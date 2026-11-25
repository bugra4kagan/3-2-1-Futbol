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
  serverTimestamp,
} from 'firebase/firestore';
import { ref, get, set, remove } from 'firebase/database';

const PROJECT_ID = 'futbol-9013e';

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

function validUserPayload(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    userId: uid,
    displayName: 'TestOyuncu',
    usernameKey: 'testoyuncu',
    email: 'oyuncu@example.com',
    avatar: '⚽',
    coins: 500,
    weeklyPoints: 100,
    totalPoints: 200,
    unlockedGiftIds: ['avatar_classic'],
    adFree: false,
    permanentMultiplier2x: false,
    progressionJson: '{"coins":500}',
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

test('Firestore Dirty Dozen & Ownership Rules', async () => {
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
      validUserPayload('uid_unverified', { email: 'unverified@example.com' })
    )
  );

  // 2. Owner with verified email succeeds on /users
  await assertSucceeds(
    setDoc(doc(verifiedCtx.firestore(), 'users', 'uid_alice'), validUserPayload('uid_alice'))
  );

  // 3. UID spoofing & cross-user read blocked
  await assertFails(getDoc(doc(bobCtx.firestore(), 'users', 'uid_alice')));
  await assertFails(
    setDoc(doc(bobCtx.firestore(), 'users', 'uid_alice'), validUserPayload('uid_alice'))
  );

  // 4. Email spoofing blocked
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validUserPayload('uid_bob', { email: 'oyuncu@example.com' })
    )
  );

  // 5. Shadow admin field & client-forged timestamp blocked
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validUserPayload('uid_bob', { email: 'bob@example.com', isAdmin: true })
    )
  );
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validUserPayload('uid_bob', { email: 'bob@example.com', updatedAt: new Date() })
    )
  );

  // 6. Extreme coin/score injection blocked
  await assertFails(
    setDoc(
      doc(bobCtx.firestore(), 'users', 'uid_bob'),
      validUserPayload('uid_bob', { email: 'bob@example.com', coins: 9999999 })
    )
  );

  // 7. Listing /users, /usernames, /publicProfiles blocked
  await assertFails(getDocs(query(collection(verifiedCtx.firestore(), 'users'), limit(10))));
  await assertFails(getDocs(query(collection(anonCtx.firestore(), 'usernames'), limit(10))));
  await assertFails(getDocs(query(collection(anonCtx.firestore(), 'publicProfiles'), limit(10))));

  // 8. Username reservation hijack & deletion guard
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

  // 9. Public profile PII injection blocked
  await assertFails(
    setDoc(doc(bobCtx.firestore(), 'publicProfiles', 'bob_pro'), {
      usernameKey: 'bob_pro',
      ownerUid: 'uid_bob',
      displayName: 'BobPro',
      avatar: '⚽',
      hasCrown: false,
      weeklyPoints: 100,
      totalPoints: 100,
      statsJson: '{}',
      email: 'bob@example.com',
      updatedAt: serverTimestamp(),
    })
  );
});

test('Firestore Private Room, Matchmaking Queue & UGC User Report Rules', async () => {
  const hostCtx = testEnv.authenticatedContext('uid_host');
  const guestCtx = testEnv.authenticatedContext('uid_guest');
  const intruderCtx = testEnv.authenticatedContext('uid_intruder');

  // Create private room with host only
  await assertSucceeds(
    setDoc(doc(hostCtx.firestore(), 'rooms', 'AB12CD'), {
      code: 'AB12CD',
      roomKind: 'private',
      minigameType: 'two_clubs',
      hostUid: 'uid_host',
      guestUid: null,
      hostId: 'p_host',
      guestId: null,
      memberUids: ['uid_host'],
      players: { p_host: { id: 'p_host', name: 'Host' } },
      scores: { p_host: 0 },
      state: 'waiting',
      roundIndex: 0,
      matchSeq: 1,
      questionSeed: 12345,
      roundIds: [1, 2, 3],
      updatedAt: serverTimestamp(),
    })
  );

  // Guest cannot inject score when joining
  await assertFails(
    updateDoc(doc(guestCtx.firestore(), 'rooms', 'AB12CD'), {
      guestUid: 'uid_guest',
      guestId: 'p_guest',
      memberUids: ['uid_host', 'uid_guest'],
      players: { p_host: { id: 'p_host', name: 'Host' }, p_guest: { id: 'p_guest', name: 'Guest' } },
      scores: { p_host: 0, p_guest: 9 },
      updatedAt: serverTimestamp(),
    })
  );

  // Clean guest join succeeds
  await assertSucceeds(
    updateDoc(doc(guestCtx.firestore(), 'rooms', 'AB12CD'), {
      guestUid: 'uid_guest',
      guestId: 'p_guest',
      memberUids: ['uid_host', 'uid_guest'],
      players: { p_host: { id: 'p_host', name: 'Host' }, p_guest: { id: 'p_guest', name: 'Guest' } },
      updatedAt: serverTimestamp(),
    })
  );

  // Intruder cannot read, update or delete active 2-player room
  await assertFails(getDoc(doc(intruderCtx.firestore(), 'rooms', 'AB12CD')));
  await assertFails(deleteDoc(doc(intruderCtx.firestore(), 'rooms', 'AB12CD')));

  // UGC Report: signed-in user can create, nobody can read/delete
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

test('RTDB Leaderboard Rules enforce Auth, Owner UID & Monotonic Delta Bounds', async () => {
  const anonCtx = testEnv.unauthenticatedContext();
  const aliceCtx = testEnv.authenticatedContext('uid_alice');
  const malloryCtx = testEnv.authenticatedContext('uid_mallory');

  // Unauthenticated read & write blocked
  await assertFails(get(ref(anonCtx.database(), 'leaderboard')));
  await assertFails(
    set(ref(anonCtx.database(), 'leaderboard/alice_key'), {
      id: 'alice_key',
      name: 'Alice',
      ownerUid: 'uid_alice',
      weeklyPoints: 100,
      totalPoints: 100,
      updatedAt: Date.now(),
    })
  );

  // Arbitrary points jump (> 25000 on create) rejected
  await assertFails(
    set(ref(aliceCtx.database(), 'leaderboard/alice_key'), {
      id: 'alice_key',
      name: 'Alice',
      ownerUid: 'uid_alice',
      weeklyPoints: 999999,
      totalPoints: 999999,
      updatedAt: Date.now(),
    })
  );

  // Valid owner write succeeds
  await assertSucceeds(
    set(ref(aliceCtx.database(), 'leaderboard/alice_key'), {
      id: 'alice_key',
      name: 'Alice',
      ownerUid: 'uid_alice',
      weeklyPoints: 250,
      totalPoints: 400,
      updatedAt: Date.now(),
    })
  );

  // Authenticated player can read leaderboard
  await assertSucceeds(get(ref(malloryCtx.database(), 'leaderboard')));

  // Mallory cannot overwrite or delete Alice's leaderboard entry
  await assertFails(
    set(ref(malloryCtx.database(), 'leaderboard/alice_key'), {
      id: 'alice_key',
      name: 'Mallory',
      ownerUid: 'uid_mallory',
      weeklyPoints: 500,
      totalPoints: 500,
      updatedAt: Date.now(),
    })
  );
  await assertFails(remove(ref(malloryCtx.database(), 'leaderboard/alice_key')));

  // Alice cannot jump > 10000 in a single sync
  await assertFails(
    set(ref(aliceCtx.database(), 'leaderboard/alice_key'), {
      id: 'alice_key',
      name: 'Alice',
      ownerUid: 'uid_alice',
      weeklyPoints: 25000,
      totalPoints: 400,
      updatedAt: Date.now(),
    })
  );

  // Alice can validly update within bounds & delete on account deletion
  await assertSucceeds(
    set(ref(aliceCtx.database(), 'leaderboard/alice_key'), {
      id: 'alice_key',
      name: 'Alice',
      ownerUid: 'uid_alice',
      weeklyPoints: 550,
      totalPoints: 700,
      updatedAt: Date.now(),
    })
  );
  await assertSucceeds(remove(ref(aliceCtx.database(), 'leaderboard/alice_key')));
});
