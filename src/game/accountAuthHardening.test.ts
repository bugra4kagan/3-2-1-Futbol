import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { AccountStore, buildPublicProfileFromRecord } from './accountStore.js';
import {
  AccountHttpDeps,
  CloudStateSyncPayload,
  VerifiedFirebaseCaller,
  handleAccountRegisterRequest,
  handleAccountSyncRequest,
} from './accountHttpHandlers.js';
import { createInitialProgression } from './retentionEngine.js';
import { SERVER_STARTER_COINS, SERVER_STARTER_POINTS } from './serverSecurity.js';
import { PlayerProfile, PublicPlayerProfile, UserProgression } from './types.js';

function createTempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'futbol-auth-hardening-'));
  const filePath = path.join(dir, 'accounts.json');
  const store = new AccountStore(filePath);
  return {
    store,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function makeProfile(id: string, name: string): PlayerProfile {
  return {
    id,
    name,
    avatar: '⚽',
    score: 0,
    favoriteClubId: 'gs',
    accountStats: {
      totalMatches: 0,
      totalWins: 0,
      badgesEarned: [],
    },
  };
}

function headerGetter(headers: Record<string, string | undefined>) {
  const lower = new Map<string, string>();
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined) lower.set(k.toLowerCase(), v);
  }
  return (name: string) => lower.get(name.toLowerCase());
}

function createHarness(
  store: AccountStore,
  tokenMap: Record<string, VerifiedFirebaseCaller | null>
): { deps: AccountHttpDeps; cloudWrites: CloudStateSyncPayload[] } {
  const cloudWrites: CloudStateSyncPayload[] = [];
  const liveLeaderboard = new Map<string, PublicPlayerProfile>();

  const deps: AccountHttpDeps = {
    accountStore: store,
    verifyFirebaseBearerToken: async (token?: string) => {
      if (!token) return null;
      return tokenMap[token] ?? null;
    },
    syncAuthoritativeUserStateAdmin: async (payload) => {
      cloudWrites.push(payload);
      return { syncedFirestore: true, syncedRtdb: true };
    },
    buildPublicProfileFromRecord,
    liveLeaderboard,
  };

  return { deps, cloudWrites };
}

test('İlk Google girişi: sunucu 200 Coin ve 180 Lig Puanı verir ve Admin SDK bulut yedeklemesini yazar', async () => {
  const { store, cleanup } = createTempStore();
  try {
    const { deps, cloudWrites } = createHarness(store, {
      'valid-google-token-alice': {
        uid: 'google_uid_alice',
        email: 'alice@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      },
    });

    const forgedClientProg = {
      ...createInitialProgression('acc_alice_1'),
      coins: 99999,
      weeklyPoints: 99999,
      totalPoints: 99999,
      matchesPlayed: 42,
      wins: 40,
      adFree: true,
      unlockedGiftIds: ['store_ad_free', 'trophy_wc'],
    } as UserProgression;

    const res = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'valid-google-token-alice' }),
      body: {
        accountId: 'acc_alice_1',
        profile: makeProfile('acc_alice_1', 'AliceStar'),
        progression: forgedClientProg,
        googleUid: 'google_uid_alice',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(typeof res.body.sessionToken === 'string' && res.body.sessionToken.length > 20);
    assert.deepEqual(res.body.cloudSync, { syncedFirestore: true, syncedRtdb: true });

    const acc = res.body.account as {
      accountId: string;
      profile: PlayerProfile;
      progression: UserProgression;
    };
    assert.equal(acc.accountId, 'acc_alice_1');
    assert.equal(acc.progression.coins, SERVER_STARTER_COINS);
    assert.equal(acc.progression.weeklyPoints, SERVER_STARTER_POINTS);
    assert.equal(acc.progression.totalPoints, SERVER_STARTER_POINTS);
    assert.equal(acc.progression.matchesPlayed, 0);
    assert.equal(acc.progression.wins, 0);
    assert.equal(acc.progression.adFree, false);
    assert.deepEqual(acc.progression.unlockedGiftIds, []);

    assert.equal(cloudWrites.length, 1);
    assert.equal(cloudWrites[0].uid, 'google_uid_alice');
    assert.equal(cloudWrites[0].progression.coins, 200);
    assert.equal(cloudWrites[0].progression.weeklyPoints, 180);
    assert.equal(cloudWrites[0].progression.totalPoints, 180);
  } finally {
    cleanup();
  }
});

test('Mevcut Google hesabıyla yeni cihazdan giriş ve mevcut ilerlemenin korunması', async () => {
  const { store, cleanup } = createTempStore();
  try {
    // Mevcut kıdemli kullanıcı kaydı oluştur (Firestore backend_accounts üzerinden geri yüklenen canlı kullanıcı)
    const veteranProg: UserProgression = {
      ...createInitialProgression('acc_vet_1'),
      coins: 875,
      weeklyPoints: 410,
      totalPoints: 1920,
      matchesPlayed: 18,
      wins: 12,
      losses: 6,
      adFree: true,
      unlockedGiftIds: ['store_ad_free'],
    };
    store.applyAuthoritativeAccountSnapshot({
      accountId: 'acc_vet_1',
      username: 'KidemliKral',
      usernameKey: 'kidemlikral',
      recoveryCode: '321-VET1',
      googleUid: 'google_uid_vet',
      profile: makeProfile('acc_vet_1', 'KidemliKral'),
      progression: veteranProg,
      createdAt: Date.now() - 86400_000,
      updatedAt: Date.now() - 3600_000,
    });

    const { deps, cloudWrites } = createHarness(store, {
      'valid-google-token-vet': {
        uid: 'google_uid_vet',
        email: 'vet@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      },
    });

    // Yeni tarayıcıda bambaşka yerel UUID ve 'Futbol Gurmesi' varsayılan adıyla giriş yapıyor
    const res = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'valid-google-token-vet' }),
      body: {
        accountId: 'brand_new_device_local_id',
        profile: makeProfile('brand_new_device_local_id', 'Futbol Gurmesi'),
        progression: {
          ...createInitialProgression('brand_new_device_local_id'),
          coins: 50000,
          weeklyPoints: 50000,
        },
        googleUid: 'google_uid_vet',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    const acc = res.body.account as {
      accountId: string;
      profile: PlayerProfile;
      progression: UserProgression;
    };
    assert.equal(acc.accountId, 'acc_vet_1');
    assert.equal(acc.profile.name, 'KidemliKral');
    assert.equal(acc.progression.coins, 875);
    assert.equal(acc.progression.weeklyPoints, 410);
    assert.equal(acc.progression.totalPoints, 1920);
    assert.equal(acc.progression.matchesPlayed, 18);
    assert.equal(acc.progression.wins, 12);
    assert.equal(acc.progression.adFree, true);
    assert.equal(cloudWrites.length, 1);
  } finally {
    cleanup();
  }
});

test('Misafir hesabını doğrulanmış Google hesabına bağlama + hesap kurtarma', async () => {
  const { store, cleanup } = createTempStore();
  try {
    const { deps } = createHarness(store, {
      'valid-google-token-guest': {
        uid: 'google_uid_guest_link',
        email: 'misafir@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      },
    });

    // 1. Önce misafir olarak kayıt
    const guestReg = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({}),
      body: {
        accountId: 'acc_guest_9',
        profile: makeProfile('acc_guest_9', 'MisafirOyuncu'),
        progression: createInitialProgression('acc_guest_9'),
      },
    });
    assert.equal(guestReg.status, 200);
    const guestSessionToken = String(guestReg.body.sessionToken);
    const guestAccount = guestReg.body.account as {
      recoveryCode: string;
      progression: UserProgression;
    };
    assert.equal(guestAccount.progression.coins, 200);
    assert.equal(guestAccount.progression.weeklyPoints, 180);

    // 2. Oturum tokenı OLMADAN misafir hesabını kendi Google hesabına bağlama (ele geçirme) reddedilmeli
    const hijackWithoutSession = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'valid-google-token-guest' }),
      body: {
        accountId: 'acc_guest_9',
        profile: makeProfile('acc_guest_9', 'MisafirOyuncu'),
        progression: guestAccount.progression,
        googleUid: 'google_uid_guest_link',
      },
    });
    assert.equal(hijackWithoutSession.status, 401);

    // 3. Geçerli X-Account-Token + doğrulanmış Firebase ID Token ile misafir hesabını bağlama
    const linked = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({
        'X-Account-Token': guestSessionToken,
        'X-Firebase-Id-Token': 'valid-google-token-guest',
      }),
      body: {
        accountId: 'acc_guest_9',
        profile: makeProfile('acc_guest_9', 'MisafirOyuncu'),
        progression: guestAccount.progression,
        googleUid: 'google_uid_guest_link',
      },
    });
    assert.equal(linked.status, 200);
    assert.equal(store.getByAccountId('acc_guest_9')?.googleUid, 'google_uid_guest_link');

    // 4. Kurtarma kodu ile hesap kurtarma tüm değerleri ve session doğrulamasını korur
    const recovered = await store.recoverByCodeAsync(guestAccount.recoveryCode, 'MisafirOyuncu');
    assert.equal(recovered.ok, true);
    assert.equal(recovered.account?.accountId, 'acc_guest_9');
    assert.equal(recovered.account?.progression.coins, 200);
    assert.equal(recovered.account?.progression.weeklyPoints, 180);
    assert.equal(recovered.account?.googleUid, 'google_uid_guest_link');
  } finally {
    cleanup();
  }
});

test('Sahte token, anonim token, UID uyuşmazlığı, sahte coin/puan artışı ve çapraz hesap ele geçirme reddedilir', async () => {
  const { store, cleanup } = createTempStore();
  try {
    const { deps, cloudWrites } = createHarness(store, {
      'anon-firebase-token': {
        uid: 'anon_uid_1',
        firebase: { sign_in_provider: 'anonymous' },
      },
      'alice-token': {
        uid: 'google_uid_alice',
        email: 'alice@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      },
      'mallory-token': {
        uid: 'google_uid_mallory',
        email: 'mallory@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      },
    });

    // 1. Geçersiz/sahte Firebase ID tokenı -> 401
    const forgedTokenRes = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'forged-jwt' }),
      body: {
        accountId: 'acc_bad_1',
        profile: makeProfile('acc_bad_1', 'BadTokenUser'),
        progression: createInitialProgression('acc_bad_1'),
      },
    });
    assert.equal(forgedTokenRes.status, 401);

    // 2a. Anonim Firebase tokenı ile Google UID bağlama girişimi -> 401 reddi
    const anonGoogleBindRes = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'anon-firebase-token' }),
      body: {
        accountId: 'acc_bad_2',
        profile: makeProfile('acc_bad_2', 'AnonTokenUser'),
        progression: createInitialProgression('acc_bad_2'),
        googleUid: 'anon_uid_1',
      },
    });
    assert.equal(anonGoogleBindRes.status, 401);

    // 2b. Eski 86e522b AAB uyumluluğu: googleUid olmayan misafir kaydında geçerli anonim token yok sayılır (200/180 misafir, sıfır bulut yazımı)
    const anonGuestFallbackRes = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'anon-firebase-token' }),
      body: {
        accountId: 'acc_anon_guest_compat',
        profile: makeProfile('acc_anon_guest_compat', 'AnonCompat'),
        progression: {
          ...createInitialProgression('acc_anon_guest_compat'),
          coins: 9999,
          weeklyPoints: 9999,
        },
      },
    });
    assert.equal(anonGuestFallbackRes.status, 200);
    assert.equal(anonGuestFallbackRes.body.cloudSync, undefined);
    assert.equal(cloudWrites.length, 0);
    const anonGuestAcc = anonGuestFallbackRes.body.account as { progression: UserProgression };
    assert.equal(anonGuestAcc.progression.coins, 200);
    assert.equal(anonGuestAcc.progression.weeklyPoints, 180);
    assert.equal(store.getByAccountId('acc_anon_guest_compat')?.googleUid, undefined);

    // 2c. Anonim token hiçbir şekilde mevcut hesap sahipliği kanıtı olarak kabul edilmez (X-Account-Token yoksa 401)
    const anonOwnershipAttempt = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'anon-firebase-token' }),
      body: {
        accountId: 'acc_anon_guest_compat',
        profile: makeProfile('acc_anon_guest_compat', 'AnonCompat'),
        progression: anonGuestAcc.progression,
      },
    });
    assert.equal(anonOwnershipAttempt.status, 401);

    // 3. Doğrulanmamış body.googleUid (token olmadan) -> 401
    const unverifiedUidRes = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({}),
      body: {
        accountId: 'acc_bad_3',
        profile: makeProfile('acc_bad_3', 'SpoofedUidUser'),
        progression: createInitialProgression('acc_bad_3'),
        googleUid: 'google_uid_alice',
      },
    });
    assert.equal(unverifiedUidRes.status, 401);

    // 4. Token UID != body.googleUid -> 403
    const mismatchRes = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'mallory-token' }),
      body: {
        accountId: 'acc_bad_4',
        profile: makeProfile('acc_bad_4', 'MismatchUser'),
        progression: createInitialProgression('acc_bad_4'),
        googleUid: 'google_uid_alice',
      },
    });
    assert.equal(mismatchRes.status, 403);

    // 5. Alice geçerli şekilde hesabını oluşturur; ardından Mallory bu hesabı ele geçiremez (403)
    const aliceReg = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'alice-token' }),
      body: {
        accountId: 'acc_alice_sec',
        profile: makeProfile('acc_alice_sec', 'AliceSec'),
        progression: createInitialProgression('acc_alice_sec'),
        googleUid: 'google_uid_alice',
      },
    });
    assert.equal(aliceReg.status, 200);
    const aliceToken = String(aliceReg.body.sessionToken);

    const malloryHijackTarget = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'mallory-token' }),
      body: {
        accountId: 'acc_alice_sec',
        profile: makeProfile('acc_alice_sec', 'AliceSec'),
        progression: createInitialProgression('acc_alice_sec'),
      },
    });
    assert.equal(malloryHijackTarget.status, 403);

    // 6. Mallory kendi hesabına sahte bakiye yazamaz ve başka bir mevcut hesabın üstüne Alice UID'sini bağlayamaz (409)
    const malloryOwn = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({ 'X-Firebase-Id-Token': 'mallory-token' }),
      body: {
        accountId: 'acc_mallory_sec',
        profile: makeProfile('acc_mallory_sec', 'MallorySec'),
        progression: {
          ...createInitialProgression('acc_mallory_sec'),
          coins: 77777,
          weeklyPoints: 77777,
        },
        googleUid: 'google_uid_mallory',
      },
    });
    assert.equal(malloryOwn.status, 200);
    const malloryAccount = malloryOwn.body.account as { progression: UserProgression };
    assert.equal(malloryAccount.progression.coins, 200);
    assert.equal(malloryAccount.progression.weeklyPoints, 180);

    const mallorySession = String(malloryOwn.body.sessionToken);
    const crossBindRes = await handleAccountSyncRequest({
      deps,
      getHeader: headerGetter({
        'X-Account-Token': mallorySession,
        'X-Firebase-Id-Token': 'alice-token',
      }),
      body: {
        accountId: 'acc_mallory_sec',
        progression: malloryAccount.progression,
      },
    });
    assert.equal(crossBindRes.status, 409);

    // 7. İstemciden gelen sahte /api/accounts/sync coin & puan şişirmesi sunucuda bastırılır
    const syncRes = await handleAccountSyncRequest({
      deps,
      getHeader: headerGetter({
        'X-Account-Token': aliceToken,
        'X-Firebase-Id-Token': 'alice-token',
      }),
      body: {
        accountId: 'acc_alice_sec',
        progression: {
          ...createInitialProgression('acc_alice_sec'),
          coins: 99999,
          weeklyPoints: 5000,
          totalPoints: 5000,
          matchesPlayed: 30,
          adFree: true,
        },
      },
    });
    assert.equal(syncRes.status, 200);
    assert.equal(store.getByAccountId('acc_alice_sec')?.progression.coins, 200);
    assert.equal(store.getByAccountId('acc_alice_sec')?.progression.weeklyPoints, 180);
    assert.equal(store.getByAccountId('acc_alice_sec')?.progression.totalPoints, 180);
    assert.equal(store.getByAccountId('acc_alice_sec')?.progression.adFree, false);
    assert.equal(cloudWrites.at(-1)?.progression.coins, 200);
  } finally {
    cleanup();
  }
});

test('Eski istemci uyumluluğu: Firebase ID tokenı olmadan misafir kayıt ve mevcut bağlı Google hesabı senkronizasyonu çalışır', async () => {
  const { store, cleanup } = createTempStore();
  try {
    const { deps, cloudWrites } = createHarness(store, {});

    // 1. Eski istemci misafir kaydı (X-Firebase-Id-Token ve googleUid olmadan)
    const legacyGuestReg = await handleAccountRegisterRequest({
      deps,
      getHeader: headerGetter({}),
      body: {
        accountId: 'acc_legacy_1',
        profile: makeProfile('acc_legacy_1', 'EskiIstemci'),
        progression: {
          ...createInitialProgression('acc_legacy_1'),
          coins: 900,
          weeklyPoints: 900,
        },
      },
    });
    assert.equal(legacyGuestReg.status, 200);
    assert.equal(legacyGuestReg.body.ok, true);
    const legacyToken = String(legacyGuestReg.body.sessionToken);
    const legacyAcc = legacyGuestReg.body.account as { progression: UserProgression };
    // Sunucu yine sabit başlangıç verir ve Admin SDK yazımı yapmaz
    assert.equal(legacyAcc.progression.coins, 200);
    assert.equal(legacyAcc.progression.weeklyPoints, 180);
    assert.equal(cloudWrites.length, 0);

    // 2. Zaten doğrulanarak bağlanmış eski istemci oturumu: aynı googleUid + geçerli X-Account-Token ile sync yapabilir
    store.registerOrUpdate({
      accountId: 'acc_legacy_bound',
      profile: makeProfile('acc_legacy_bound', 'EskiGoogleli'),
      progression: createInitialProgression('acc_legacy_bound'),
      googleUid: 'google_uid_existing_legacy',
    });
    const boundRec = store.getByAccountId('acc_legacy_bound')!;
    const boundSession = store.issueSessionTokenForAccount(boundRec);

    const legacySyncOk = await handleAccountSyncRequest({
      deps,
      getHeader: headerGetter({ 'X-Account-Token': boundSession }),
      body: {
        accountId: 'acc_legacy_bound',
        progression: boundRec.progression,
        googleUid: 'google_uid_existing_legacy',
      },
    });
    assert.equal(legacySyncOk.status, 200);
    assert.equal(legacySyncOk.body.ok, true);
    // Tokenlı eski istemci Admin SDK bulut yazımı tetiklemez
    assert.equal(cloudWrites.length, 0);

    // Farklı googleUid göndermeye çalışan eski istemci reddedilir
    const legacyDifferentUid = await handleAccountSyncRequest({
      deps,
      getHeader: headerGetter({ 'X-Account-Token': legacyToken }),
      body: {
        accountId: 'acc_legacy_1',
        progression: legacyAcc.progression,
        googleUid: 'google_uid_hijack_attempt',
      },
    });
    assert.equal(legacyDifferentUid.status, 401);
  } finally {
    cleanup();
  }
});
