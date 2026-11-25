import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ADMOB_OFFICIAL_TEST_IDS,
  isOfficialAdMobTestId,
  resolveAdMobConfig,
} from './admobService';

test('AdMob Debug/Dev uses official Google Test IDs when env vars are omitted', () => {
  const devConfig = resolveAdMobConfig({
    platform: 'android',
    isProductionBuild: false,
  });
  assert.equal(devConfig.mode, 'debug_test');
  assert.equal(devConfig.isUsingTestIds, true);
  assert.equal(devConfig.appId, ADMOB_OFFICIAL_TEST_IDS.android.appId);
  assert.equal(devConfig.rewardedId, ADMOB_OFFICIAL_TEST_IDS.android.rewarded);
  assert.equal(devConfig.interstitialId, ADMOB_OFFICIAL_TEST_IDS.android.interstitial);

  const debugApkConfig = resolveAdMobConfig({
    platform: 'android',
    isProductionBuild: true,
    allowTestFallback: true,
  });
  assert.equal(debugApkConfig.mode, 'debug_test');
  assert.equal(debugApkConfig.isUsingTestIds, true);
  assert.equal(debugApkConfig.rewardedId, ADMOB_OFFICIAL_TEST_IDS.android.rewarded);
});

test('AdMob Production bundle NEVER falls back silently to Google Test IDs when secrets are missing', () => {
  const missingProd = resolveAdMobConfig({
    platform: 'android',
    isProductionBuild: true,
    allowTestFallback: false,
    appId: undefined,
    rewardedId: undefined,
    interstitialId: undefined,
    bannerId: undefined,
  });

  assert.equal(missingProd.mode, 'production');
  assert.equal(missingProd.isProductionReady, false);
  assert.equal(missingProd.isUsingTestIds, false);
  assert.equal(missingProd.appId, '');
  assert.equal(missingProd.rewardedId, '');
  assert.equal(missingProd.interstitialId, '');
  assert.deepEqual(missingProd.missingProductionKeys, [
    'VITE_ADMOB_APP_ID',
    'VITE_ADMOB_REWARDED_ID',
    'VITE_ADMOB_INTERSTITIAL_ID',
  ]);
});

test('AdMob Production rejects accidental Google Test IDs and accepts real publisher IDs', () => {
  const pollutedProd = resolveAdMobConfig({
    platform: 'android',
    isProductionBuild: true,
    allowTestFallback: false,
    appId: ADMOB_OFFICIAL_TEST_IDS.android.appId,
    rewardedId: ADMOB_OFFICIAL_TEST_IDS.android.rewarded,
    interstitialId: ADMOB_OFFICIAL_TEST_IDS.android.interstitial,
  });

  assert.equal(pollutedProd.isProductionReady, false);
  assert.equal(isOfficialAdMobTestId(ADMOB_OFFICIAL_TEST_IDS.android.rewarded), true);
  assert.equal(pollutedProd.missingProductionKeys.length, 3);

  const realProd = resolveAdMobConfig({
    platform: 'android',
    isProductionBuild: true,
    allowTestFallback: false,
    appId: 'ca-app-pub-1234567890123456~1111111111',
    rewardedId: 'ca-app-pub-1234567890123456/2222222222',
    interstitialId: 'ca-app-pub-1234567890123456/3333333333',
  });

  assert.equal(realProd.mode, 'production');
  assert.equal(realProd.isProductionReady, true);
  assert.equal(realProd.isUsingTestIds, false);
  assert.deepEqual(realProd.missingProductionKeys, []);
});

test('CI workflow and Android build.gradle consistently map ADMOB_APP_ID and VITE_ADMOB_* variables', () => {
  const workflow = fs.readFileSync(
    path.resolve(process.cwd(), '.github/workflows/build-android.yml'),
    'utf8'
  );
  const gradle = fs.readFileSync(
    path.resolve(process.cwd(), 'android/app/build.gradle'),
    'utf8'
  );

  assert.ok(workflow.includes('ADMOB_APP_ID: ${{ secrets.ADMOB_APP_ID || secrets.VITE_ADMOB_APP_ID }}'));
  assert.ok(workflow.includes('VITE_ADMOB_APP_ID: ${{ secrets.ADMOB_APP_ID || secrets.VITE_ADMOB_APP_ID }}'));
  assert.ok(workflow.includes('VITE_ADMOB_REWARDED_ID: ${{ secrets.ADMOB_REWARDED_ID || secrets.VITE_ADMOB_REWARDED_ID }}'));
  assert.ok(workflow.includes('VITE_ADMOB_INTERSTITIAL_ID: ${{ secrets.ADMOB_INTERSTITIAL_ID || secrets.VITE_ADMOB_INTERSTITIAL_ID }}'));
  assert.ok(workflow.includes('VITE_ADMOB_BANNER_ID: ${{ secrets.ADMOB_BANNER_ID || secrets.VITE_ADMOB_BANNER_ID }}'));
  assert.ok(gradle.includes("System.getenv('ADMOB_APP_ID')"));
  assert.ok(gradle.includes("System.getenv('VITE_ADMOB_APP_ID')"));
});
