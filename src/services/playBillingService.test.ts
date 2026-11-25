import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeGooglePlayPurchase,
  findGooglePlaySkuByItemId,
  restoreGooglePlayPurchases,
  type NativeBillingBridge,
} from './playBillingService';

test('Web / non-Play environment blocks real-money purchase instead of unlocking free VIP', async () => {
  const res = await executeGooglePlayPurchase({
    itemId: 'store_ad_free',
    accountId: 'player_1',
    bridgeOverride: null,
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, 'WEB_UNSUPPORTED');
});

test('Double purchase on already-owned non-consumable is prevented cleanly', async () => {
  let launched = false;
  const mockBridge: NativeBillingBridge = {
    queryProducts: async () => ({ ok: true, products: [] }),
    launchBillingFlow: async () => {
      launched = true;
      return { ok: false, status: 'USER_CANCELED' };
    },
    acknowledgeOrConsumePurchase: async () => ({ ok: true }),
    queryOwnedPurchases: async () => ({ ok: true, purchases: [] }),
  };

  const res = await executeGooglePlayPurchase({
    itemId: 'store_ad_free',
    accountId: 'player_1',
    alreadyOwned: true,
    bridgeOverride: mockBridge,
  });
  assert.equal(res.ok, false);
  assert.equal(res.status, 'ITEM_ALREADY_OWNED');
  assert.equal(launched, false);
});

test('Play Billing handles USER_CANCELED, PENDING and failed server verification without acknowledging', async () => {
  let ackCount = 0;
  const canceledBridge: NativeBillingBridge = {
    queryProducts: async () => ({ ok: true, products: [] }),
    queryOwnedPurchases: async () => ({ ok: true, purchases: [] }),
    launchBillingFlow: async () => ({ ok: false, status: 'USER_CANCELED' }),
    acknowledgeOrConsumePurchase: async () => {
      ackCount += 1;
      return { ok: true };
    },
  };

  const canceled = await executeGooglePlayPurchase({
    itemId: 'store_ad_free',
    accountId: 'player_1',
    bridgeOverride: canceledBridge,
  });
  assert.equal(canceled.ok, false);
  assert.equal(canceled.status, 'USER_CANCELED');
  assert.equal(ackCount, 0);

  const pendingBridge: NativeBillingBridge = {
    ...canceledBridge,
    launchBillingFlow: async () => ({
      ok: false,
      status: 'PENDING',
      purchaseToken: 'tok_pending_1234567890',
    }),
  };
  const pending = await executeGooglePlayPurchase({
    itemId: 'store_ad_free',
    accountId: 'player_1',
    bridgeOverride: pendingBridge,
  });
  assert.equal(pending.ok, false);
  assert.equal(pending.status, 'PENDING');
  assert.equal(ackCount, 0);

  const purchasedUnverifiedBridge: NativeBillingBridge = {
    ...canceledBridge,
    launchBillingFlow: async () => ({
      ok: true,
      status: 'PURCHASED',
      purchaseToken: 'tok_forged_1234567890',
      orderId: 'GPA.0000-0000-0000-00000',
      acknowledged: false,
      productIds: [findGooglePlaySkuByItemId('store_ad_free')!.productId],
    }),
  };

  const unverified = await executeGooglePlayPurchase({
    itemId: 'store_ad_free',
    accountId: 'player_1',
    bridgeOverride: purchasedUnverifiedBridge,
    fetchImpl: async () =>
      new Response(JSON.stringify({ ok: false, verified: false, error: 'Geçersiz makbuz' }), {
        status: 400,
      }),
  });
  assert.equal(unverified.ok, false);
  assert.equal(unverified.status, 'VERIFICATION_FAILED');
  assert.equal(ackCount, 0);
});

test('Play Billing grants right and acknowledges only after backend verification succeeds', async () => {
  let acknowledgedTokens: string[] = [];
  const adFreeSku = findGooglePlaySkuByItemId('store_ad_free')!;
  const mockBridge: NativeBillingBridge = {
    queryProducts: async () => ({ ok: true, products: [] }),
    queryOwnedPurchases: async () => ({ ok: true, purchases: [] }),
    launchBillingFlow: async () => ({
      ok: true,
      status: 'PURCHASED',
      purchaseToken: 'tok_valid_1234567890abcdef',
      orderId: 'GPA.1234-5678-9012-34567',
      acknowledged: false,
      productIds: [adFreeSku.productId],
    }),
    acknowledgeOrConsumePurchase: async ({ purchaseToken }) => {
      acknowledgedTokens.push(purchaseToken);
      return { ok: true };
    },
  };

  const verified = await executeGooglePlayPurchase({
    itemId: 'store_ad_free',
    accountId: 'player_1',
    bridgeOverride: mockBridge,
    fetchImpl: async () =>
      new Response(JSON.stringify({ ok: true, verified: true, alreadyCredited: false }), {
        status: 200,
      }),
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.status, 'PURCHASED');
  assert.deepEqual(acknowledgedTokens, ['tok_valid_1234567890abcdef']);

  // Restore Purchases restores owned verified non-consumables cleanly
  const restoreBridge: NativeBillingBridge = {
    ...mockBridge,
    queryOwnedPurchases: async () => ({
      ok: true,
      purchases: [
        {
          purchaseToken: 'tok_valid_1234567890abcdef',
          acknowledged: true,
          productIds: [adFreeSku.productId],
        },
      ],
    }),
  };
  const restored = await restoreGooglePlayPurchases({
    accountId: 'player_1',
    bridgeOverride: restoreBridge,
    fetchImpl: async () =>
      new Response(JSON.stringify({ ok: true, verified: true, alreadyCredited: true }), {
        status: 200,
      }),
  });
  assert.equal(restored.hadNativeStore, true);
  assert.deepEqual(restored.restoredItemIds, ['store_ad_free']);
});
