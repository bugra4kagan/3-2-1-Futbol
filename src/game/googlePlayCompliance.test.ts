import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureAdMobConsent,
  getAdMobConsentState,
  initializeAdMob,
  openAdPrivacyOptionsForm,
} from '../services/admobService';
import { showInterstitialAd, showRewardedAd } from '../services/adService';
import {
  executeGooglePlayPurchase,
  isGooglePlayBillingAvailable,
} from '../services/playBillingService';
import { isAdsEnabled, isRealMoneyIapEnabled } from './monetizationFlags';
import { AccountStore } from './accountStore';
import {
  exportFirebaseSparkBackup,
  hashDeletedAccountIdentityForRestore,
  restoreFirebaseSparkBackup,
} from './firebaseBackup';
import { scanReleaseDirectory } from '../../scripts/verify-release-bundle.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..', '..');

test('public/assets/aistudio unused reference folder is completely removed from source tree', () => {
  assert.equal(fs.existsSync(path.join(REPO, 'public', 'assets', 'aistudio')), false);
});

test('unused real press photos folder public/players is completely removed while procedural anime SVG & branding assets remain intact', () => {
  assert.equal(fs.existsSync(path.join(REPO, 'public', 'players')), false);
  const avatarSrc = fs.readFileSync(path.join(REPO, 'src', 'components', 'PlayerAvatar.tsx'), 'utf8');
  assert.ok(avatarSrc.includes('viewBox="0 0 220 260"'), 'PlayerAvatar.tsx procedural anime SVG must remain intact');
  assert.equal(/<img\b/i.test(avatarSrc), false, 'PlayerAvatar.tsx must not render third-party raster photos');
  assert.equal(fs.existsSync(path.join(REPO, 'public', 'icons', 'brand-logo.webp')), true);
  assert.equal(fs.existsSync(path.join(REPO, 'branding', 'google-play-icon-512x512.png')), true);
  assert.equal(fs.existsSync(path.join(REPO, 'src', 'components', 'ClubBadge.tsx')), true);
  assert.equal(fs.existsSync(path.join(REPO, 'src', 'components', 'ProfileIconSvg.tsx')), true);
});

test('legal and license pages exist, use valid Turkish UTF-8 with zero raw \\uXXXX escapes, and match store app name', () => {
  const pages = [
    'public/gizlilik.html',
    'public/privacy.html',
    'public/hesap-sil.html',
    'public/kullanim-kosullari.html',
    'public/lisanslar.html',
  ];
  for (const rel of pages) {
    const content = fs.readFileSync(path.join(REPO, rel), 'utf8');
    assert.ok(content.includes('3-2-1 Futbol : Kafa Kafaya'), `${rel} missing store app name`);
    assert.equal(
      /\\u[0-9a-fA-F]{4}/.test(content),
      false,
      `${rel} must not contain raw \\uXXXX escape sequences`
    );
  }
  const deletionHtml = fs.readFileSync(path.join(REPO, 'public/hesap-sil.html'), 'utf8');
  assert.ok(deletionHtml.includes('Hesabımı ve Verilerimi'));
  assert.ok(deletionHtml.includes('321futboloyunu@gmail.com'));
});

test('app metadata files align on store listing title 3-2-1 Futbol : Kafa Kafaya', () => {
  const files = [
    'android/app/src/main/res/values/strings.xml',
    'capacitor.config.ts',
    'public/manifest.json',
    'index.html',
  ];
  for (const rel of files) {
    const content = fs.readFileSync(path.join(REPO, rel), 'utf8');
    assert.ok(content.includes('3-2-1 Futbol : Kafa Kafaya'), `${rel} title mismatch`);
  }
});

test('clubLogos.ts contains zero third-party trademark HTTP URLs', () => {
  const content = fs.readFileSync(path.join(REPO, 'src/game/clubLogos.ts'), 'utf8');
  assert.equal(/https?:\/\//i.test(content), false, 'clubLogos.ts must not embed third-party URLs');
});

test('closed-test monetization flags disable real ads, fake ad rewards, and real-money IAP by default', async () => {
  assert.equal(isAdsEnabled(), false);
  assert.equal(isRealMoneyIapEnabled(), false);
  assert.equal(isGooglePlayBillingAvailable(), false);
  assert.equal(await initializeAdMob(), false);

  const rewarded = await showRewardedAd('free_coins_250', { durationMs: 0 });
  assert.equal(rewarded.completed, false);
  assert.equal(rewarded.rewardAmountCoins, 0);
  assert.equal(rewarded.rewardAmountEnergy, 0);
  assert.equal(rewarded.provider, 'disabled_closed_test');

  const interstitial = await showInterstitialAd({ adFree: false, durationMs: 0 });
  assert.equal(interstitial.shown, false);
  assert.equal(interstitial.provider, 'disabled_closed_test');

  const purchase = await executeGooglePlayPurchase({
    itemId: 'store_ad_free',
    accountId: 'acc_test_1',
  });
  assert.equal(purchase.ok, false);
  assert.equal(purchase.status, 'DISABLED');
});

test('AndroidManifest strips AD_ID & MobileAdsInitProvider and build.gradle release removes test App ID fallback', () => {
  const manifest = fs.readFileSync(
    path.join(REPO, 'android/app/src/main/AndroidManifest.xml'),
    'utf8'
  );
  assert.ok(manifest.includes('com.google.android.gms.permission.AD_ID'));
  assert.ok(manifest.includes('tools:node="remove"'));
  assert.ok(manifest.includes('com.google.android.gms.ads.MobileAdsInitProvider'));

  const gradle = fs.readFileSync(path.join(REPO, 'android/app/build.gradle'), 'utf8');
  const releaseBlock = gradle.split('buildTypes')[1]?.split('debug {')[0] || '';
  assert.equal(
    releaseBlock.includes('ca-app-pub-3940256099942544~3347511713'),
    false,
    'Release buildType must NOT fallback to Google Test App ID'
  );
});

test('AuthModal enforces explicit Terms of Service acceptance checkbox before UGC profile creation', () => {
  const authModal = fs.readFileSync(path.join(REPO, 'src/components/AuthModal.tsx'), 'utf8');
  assert.ok(authModal.includes('auth-terms-checkbox'));
  assert.ok(authModal.includes('!termsAccepted'));
  assert.ok(authModal.includes('kullanim-kosullari.html'));
});

test('unauthorized account deletion is rejected and backup restore skips tombstoned deleted accounts', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '321-del-test-'));
  try {
    const store = new AccountStore(path.join(tmpDir, 'accounts.json'));
    const reg = store.registerOrUpdate({
      accountId: 'acc_victim_1',
      profile: { id: 'acc_victim_1', name: 'TemizOyuncu', avatar: 'ball', score: 0 },
      progression: {
        coins: 500,
        weeklyPoints: 100,
        totalPoints: 250,
        unlockedGiftIds: [],
        adFree: false,
      } as unknown as Parameters<AccountStore['registerOrUpdate']>[0]['progression'],
    });
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    // Wrong token must NEVER authorize deletion
    assert.equal(store.verifyAccountSession('acc_victim_1', 'forged_token_xyz'), false);
    const validToken = store.issueSessionTokenForAccount(reg.account);
    assert.equal(store.verifyAccountSession('acc_victim_1', validToken), true);

    // Authorized deletion removes account & frees username
    const deleted = await store.deleteByAccountIdAsync('acc_victim_1');
    assert.equal(deleted, true);
    assert.equal(await store.resolveByAccountIdAsync('acc_victim_1'), null);

    // Backup restore MUST skip tombstoned deleted account across Firestore & RTDB
    const fakeDocs: Record<string, Map<string, Record<string, unknown>>> = {
      backend_accounts: new Map([
        ['acc_victim_1', { accountId: 'acc_victim_1', googleUid: 'uid_deleted_1' }],
        ['acc_active_2', { accountId: 'acc_active_2', googleUid: 'uid_active_2' }],
      ]),
      backend_purchases: new Map(),
      backend_match_sessions: new Map(),
      backend_reward_claims: new Map(),
      users: new Map([
        ['uid_deleted_1', { userId: 'uid_deleted_1', coins: 500 }],
        ['uid_active_2', { userId: 'uid_active_2', coins: 200 }],
      ]),
      usernames: new Map([
        ['temizoyuncu', { ownerUid: 'uid_deleted_1', displayName: 'TemizOyuncu' }],
      ]),
      publicProfiles: new Map([
        ['temizoyuncu', { ownerUid: 'uid_deleted_1', displayName: 'TemizOyuncu' }],
      ]),
      userReports: new Map(),
    };
    const makeDb = (collectionsMap: Record<string, Map<string, Record<string, unknown>>>) => ({
      collection: (name: string) => ({
        get: async () => ({
          docs: Array.from((collectionsMap[name] || new Map()).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          })),
        }),
        doc: (id: string) => ({
          set: async (data: Record<string, unknown>) => {
            if (!collectionsMap[name]) collectionsMap[name] = new Map();
            collectionsMap[name].set(id, data);
          },
        }),
      }),
    });
    const sourceRtdbData: Record<string, Record<string, unknown>> = {
      leaderboard: {
        acc_victim_1: { id: 'acc_victim_1', totalPoints: 250 },
        acc_active_2: { id: 'acc_active_2', totalPoints: 100 },
      },
    };
    const targetRtdbData: Record<string, unknown> = {};
    const snap = await exportFirebaseSparkBackup({
      db: makeDb(fakeDocs),
      rtdb: {
        ref: (p: string) => ({
          once: async () => ({ val: () => sourceRtdbData[p] ?? null }),
          set: async () => {},
        }),
      },
    });

    const targetDocs: Record<string, Map<string, Record<string, unknown>>> = {};
    const tombstones = new Set([
      hashDeletedAccountIdentityForRestore('acc_victim_1'),
      hashDeletedAccountIdentityForRestore('uid_deleted_1'),
    ]);
    const restoreRes = await restoreFirebaseSparkBackup({
      db: makeDb(targetDocs),
      rtdb: {
        ref: (p: string) => ({
          once: async () => ({ val: () => null }),
          set: async (val: unknown) => {
            targetRtdbData[p] = val;
          },
        }),
      },
      snapshot: snap,
      options: { deletedAccountHashes: tombstones },
    });

    assert.equal(restoreRes.ok, true);
    assert.equal(restoreRes.skippedDeletedAccountsCount, 5); // backend_account + user + username + publicProfile + leaderboard
    assert.equal(targetDocs.backend_accounts?.has('acc_victim_1'), false);
    assert.equal(targetDocs.backend_accounts?.has('acc_active_2'), true);
    assert.equal(targetDocs.users?.has('uid_deleted_1'), false);
    assert.equal(targetDocs.users?.has('uid_active_2'), true);
    assert.equal('acc_victim_1' in (targetRtdbData.leaderboard as Record<string, unknown>), false);
    assert.equal('acc_active_2' in (targetRtdbData.leaderboard as Record<string, unknown>), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('release bundle security scanner blocks personal screenshots, WhatsApp images, backups, and private keys', () => {
  const cleanPublic = scanReleaseDirectory(path.join(REPO, 'public'));
  assert.deepEqual(cleanPublic.violations, []);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '321-bundle-scan-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'WhatsApp_Image_2026.jpeg'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'Ekran_goruntusu_1.png'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'firebase-backup.json.enc'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'leak.js'), 'const k = "-----BEGIN PRIVATE KEY-----";');
    const bad = scanReleaseDirectory(tmpDir);
    assert.equal(bad.violations.length, 4);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('AdMob UMP consent helpers are exported and safely disabled in closed test', async () => {
  assert.equal(typeof ensureAdMobConsent, 'function');
  assert.equal(typeof getAdMobConsentState, 'function');
  assert.equal(typeof openAdPrivacyOptionsForm, 'function');
  const state = await ensureAdMobConsent();
  assert.equal(state.checked, true);
  assert.equal(state.canRequestAds, false);
});
