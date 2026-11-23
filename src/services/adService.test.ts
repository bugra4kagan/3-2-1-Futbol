import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPLETED_MATCHES_AD_STORAGE_KEY,
  INTERSTITIAL_MATCH_INTERVAL,
  getCompletedMatchAdCount,
  incrementCompletedMatchAdCount,
  shouldTriggerInterstitialForMatchCount,
  showInterstitialAd,
} from './adService';

function createMemoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

test('completed match ad counter persists in storage and triggers interstitial every 3 matches only for non-VIP', async () => {
  const storage = createMemoryStorage();
  assert.equal(INTERSTITIAL_MATCH_INTERVAL, 3);
  assert.equal(getCompletedMatchAdCount(storage), 0);

  const triggeredMatches: number[] = [];
  for (let i = 1; i <= 9; i++) {
    const count = incrementCompletedMatchAdCount(storage);
    assert.equal(count, i);
    assert.equal(storage.getItem(COMPLETED_MATCHES_AD_STORAGE_KEY), String(i));
    if (shouldTriggerInterstitialForMatchCount(count, false)) {
      triggeredMatches.push(count);
    }
    // VIP Ad-Free must NEVER trigger interstitial
    assert.equal(shouldTriggerInterstitialForMatchCount(count, true), false);
  }
  assert.deepEqual(triggeredMatches, [3, 6, 9]);

  // showInterstitialAd respects VIP bypass immediately
  const vipRes = await showInterstitialAd({ adFree: true, durationMs: 0 });
  assert.equal(vipRes.shown, false);
  assert.equal(vipRes.skippedByVip, true);
  assert.equal(vipRes.provider, 'vip_bypass');

  // Non-VIP shows interstitial cleanly
  const stdRes = await showInterstitialAd({ adFree: false, durationMs: 0 });
  assert.equal(stdRes.shown, true);
  assert.equal(stdRes.skippedByVip, false);
});
