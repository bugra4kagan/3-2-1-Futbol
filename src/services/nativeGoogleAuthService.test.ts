import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  GOOGLE_WEB_CLIENT_ID,
  exchangeGoogleIdTokenWithFirebase,
  signInWithNativeAndroidGoogle,
  signOutNativeAndroidGoogle,
} from './nativeGoogleAuthService';

test('signInWithNativeAndroidGoogle invokes Credential Manager GoogleAuth bridge with Web Client ID', async () => {
  let receivedServerClientId: string | undefined;
  const res = await signInWithNativeAndroidGoogle({
    isNativeAndroid: () => true,
    getBridge: () => ({
      signIn: async (opts) => {
        receivedServerClientId = opts?.serverClientId;
        return {
          ok: true,
          idToken: 'mock-google-id-token-123',
          email: 'oyuncu@gmail.com',
          displayName: 'Oyuncu',
        };
      },
    }),
  });

  assert.equal(receivedServerClientId, GOOGLE_WEB_CLIENT_ID);
  assert.equal(res.idToken, 'mock-google-id-token-123');
  assert.equal(res.email, 'oyuncu@gmail.com');
});

test('signInWithNativeAndroidGoogle rejects web environment and maps user cancel / missing credential cleanly', async () => {
  await assert.rejects(
    () =>
      signInWithNativeAndroidGoogle({
        isNativeAndroid: () => false,
        getBridge: () => null,
      }),
    /native-google-auth-android-only/
  );

  await assert.rejects(
    () =>
      signInWithNativeAndroidGoogle({
        isNativeAndroid: () => true,
        getBridge: () => ({
          signIn: async () => ({
            ok: false,
            code: 'USER_CANCELED',
            message: 'popup-closed-by-user',
          }),
        }),
      }),
    /popup-closed-by-user/
  );

  await assert.rejects(
    () =>
      signInWithNativeAndroidGoogle({
        isNativeAndroid: () => true,
        getBridge: () => ({
          signIn: async () => ({
            ok: false,
            code: 'NO_CREDENTIAL',
            message: 'no-google-credential',
          }),
        }),
      }),
    /native-google-no-credential/
  );
});

test('exchangeGoogleIdTokenWithFirebase links anonymous guest and recovers credential-already-in-use to restore existing Google account', async () => {
  const events: string[] = [];

  // 1. Misafir (anonim) kullanıcı ilk kez yeni Google hesabı bağlıyor
  const anonUser = { uid: 'anon_1', isAnonymous: true };
  const linkedUser = await exchangeGoogleIdTokenWithFirebase('id_token_new', {
    authStateReady: async () => {
      events.push('authStateReady');
    },
    getCurrentUser: () => anonUser,
    buildGoogleCredential: (tok) => ({ tok }),
    linkWithCredential: async (_u, cred) => {
      events.push(`link:${cred.tok}`);
      return { user: { uid: 'anon_1', isAnonymous: false } };
    },
    signInWithCredential: async () => {
      throw new Error('should not be called');
    },
  });
  assert.equal(linkedUser.uid, 'anon_1');
  assert.deepEqual(events, ['authStateReady', 'link:id_token_new']);

  // 2. Anonim kullanıcı zaten var olan başka bir Google hesabıyla giriş yapıyor (credential-already-in-use)
  const existingUser = await exchangeGoogleIdTokenWithFirebase('id_token_existing', {
    authStateReady: async () => {},
    getCurrentUser: () => anonUser,
    buildGoogleCredential: (tok) => ({ tok }),
    linkWithCredential: async () => {
      const err = new Error('credential already in use') as Error & { code?: string };
      err.code = 'auth/credential-already-in-use';
      throw err;
    },
    signInWithCredential: async (cred) => ({
      user: { uid: `restored_${cred.tok}`, isAnonymous: false },
    }),
  });
  assert.equal(existingUser.uid, 'restored_id_token_existing');

  // 3. Oturum yoksa doğrudan signInWithCredential kullanır
  const directUser = await exchangeGoogleIdTokenWithFirebase('id_token_direct', {
    getCurrentUser: () => null,
    buildGoogleCredential: (tok) => ({ tok }),
    linkWithCredential: async () => {
      throw new Error('should not link null user');
    },
    signInWithCredential: async (cred) => ({
      user: { uid: `direct_${cred.tok}`, isAnonymous: false },
    }),
  });
  assert.equal(directUser.uid, 'direct_id_token_direct');
});

test('signOutNativeAndroidGoogle clears credential state safely without throwing', async () => {
  let signedOut = false;
  await signOutNativeAndroidGoogle({
    isNativeAndroid: () => true,
    getBridge: () => ({
      signIn: async () => ({ ok: false }),
      signOut: async () => {
        signedOut = true;
        return { ok: true };
      },
    }),
  });
  assert.equal(signedOut, true);
});

test('Android build config, Credential Manager plugin registration, versionCode 7 and OAuth Web Client ID stay consistent', () => {
  const buildGradle = fs.readFileSync(
    path.resolve(process.cwd(), 'android/app/build.gradle'),
    'utf8'
  );
  assert.match(buildGradle, /applicationId\s+"com\.futbol321\.challenge"/);
  assert.match(buildGradle, /versionCode\s+7\b/);
  assert.match(buildGradle, /versionName\s+"1\.1\.2"/);
  assert.match(buildGradle, /androidx\.credentials:credentials:/);
  assert.match(buildGradle, /androidx\.credentials:credentials-play-services-auth:/);
  assert.match(buildGradle, /com\.google\.android\.libraries\.identity\.googleid:googleid:/);

  const mainActivity = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'android/app/src/main/java/com/futbol321/challenge/MainActivity.java'
    ),
    'utf8'
  );
  assert.match(mainActivity, /registerPlugin\(GoogleAuthPlugin\.class\)/);

  const proguard = fs.readFileSync(
    path.resolve(process.cwd(), 'android/app/proguard-rules.pro'),
    'utf8'
  );
  assert.match(proguard, /GoogleAuthPlugin/);
  assert.match(proguard, /androidx\.credentials/);

  const workflow = fs.readFileSync(
    path.resolve(process.cwd(), '.github/workflows/build-android.yml'),
    'utf8'
  );
  assert.match(workflow, /versionCode 7/);
  assert.match(workflow, /versionName "1\.1\.2"/);
  assert.doesNotMatch(workflow, /branches:\s*\n\s*-\s*main/);

  const googleServices = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'android/app/google-services.json'), 'utf8')
  ) as {
    client?: Array<{ oauth_client?: Array<{ client_id?: string; client_type?: number }> }>;
  };
  const webClients =
    googleServices.client?.[0]?.oauth_client?.filter((c) => c.client_type === 3) ?? [];
  assert.equal(
    webClients.some((c) => c.client_id === GOOGLE_WEB_CLIENT_ID),
    true
  );
});
