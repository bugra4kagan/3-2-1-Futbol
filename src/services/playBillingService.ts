import { Capacitor } from '@capacitor/core';
import {
  findGooglePlaySkuByItemId,
  findGooglePlaySkuByProductId,
  findRestorableGooglePlaySkuByProductId,
  getActiveGooglePlayProductMappings,
  GOOGLE_PLAY_PRODUCT_MAPPINGS,
  type GooglePlaySkuMapping,
} from '../game/billingCatalog';
import {
  fetchBackendWithWakeupRetry,
  resolveBackendApiUrl,
} from './backendClient';
import { isRealMoneyIapEnabled } from '../game/monetizationFlags';

export {
  findGooglePlaySkuByItemId,
  findGooglePlaySkuByProductId,
  GOOGLE_PLAY_PRODUCT_MAPPINGS,
  type GooglePlaySkuMapping,
};

function readLocalAccountSessionToken(accountId: string): string | null {
  if (typeof window === 'undefined' || !accountId) return null;
  try {
    return window.localStorage.getItem(`321_server_session_token_${accountId}`);
  } catch {
    return null;
  }
}

export type PlayBillingPurchaseStatus =
  | 'PURCHASED'
  | 'PENDING'
  | 'USER_CANCELED'
  | 'ITEM_ALREADY_OWNED'
  | 'SERVICE_UNAVAILABLE'
  | 'ITEM_UNAVAILABLE'
  | 'BILLING_IN_PROGRESS'
  | 'WEB_UNSUPPORTED'
  | 'VERIFICATION_FAILED'
  | string;

export interface PlayStoreProductPriceInfo {
  productId: string;
  itemId: string;
  formattedPrice: string;
  priceCurrencyCode?: string;
}

export interface NativeBillingBridge {
  queryProducts: (opts: { productIds: string[] }) => Promise<{
    ok: boolean;
    products?: Array<{
      productId: string;
      formattedPrice?: string;
      priceCurrencyCode?: string;
    }>;
  }>;
  launchBillingFlow: (opts: {
    productId: string;
    obfuscatedAccountId?: string;
  }) => Promise<{
    ok: boolean;
    status: PlayBillingPurchaseStatus;
    purchaseToken?: string;
    orderId?: string;
    acknowledged?: boolean;
    productIds?: string[];
    message?: string;
  }>;
  acknowledgeOrConsumePurchase: (opts: {
    purchaseToken: string;
    consumable: boolean;
  }) => Promise<{ ok: boolean }>;
  queryOwnedPurchases: () => Promise<{
    ok: boolean;
    purchases?: Array<{
      purchaseToken: string;
      orderId?: string;
      acknowledged?: boolean;
      productIds?: string[];
    }>;
  }>;
}

function getPlayBillingBridge(): NativeBillingBridge | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return null;
    }
    const win = window as unknown as {
      Capacitor?: { Plugins?: { PlayBilling?: NativeBillingBridge } };
    };
    return win.Capacitor?.Plugins?.PlayBilling ?? null;
  } catch {
    return null;
  }
}

export function isGooglePlayBillingAvailable(): boolean {
  if (!isRealMoneyIapEnabled()) return false;
  return getPlayBillingBridge() !== null;
}

export async function fetchGooglePlayPrices(): Promise<Record<string, PlayStoreProductPriceInfo>> {
  if (!isRealMoneyIapEnabled()) return {};
  const bridge = getPlayBillingBridge();
  if (!bridge) return {};

  try {
    const productIds = getActiveGooglePlayProductMappings().map((m) => m.productId);
    const res = await bridge.queryProducts({ productIds });
    if (!res.ok || !Array.isArray(res.products)) return {};

    const byItemId: Record<string, PlayStoreProductPriceInfo> = {};
    for (const p of res.products) {
      const mapping = findGooglePlaySkuByProductId(p.productId);
      if (mapping && p.formattedPrice) {
        byItemId[mapping.itemId] = {
          productId: p.productId,
          itemId: mapping.itemId,
          formattedPrice: p.formattedPrice,
          priceCurrencyCode: p.priceCurrencyCode,
        };
      }
    }
    return byItemId;
  } catch {
    return {};
  }
}

export async function verifyGooglePlayPurchaseWithServer(params: {
  accountId: string;
  itemId: string;
  productId: string;
  purchaseToken: string;
  orderId?: string;
  isRestore?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{
  verified: boolean;
  alreadyCredited?: boolean;
  reason?: string;
}> {
  const fetcher = params.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) {
    return { verified: false, reason: 'Ağ bağlantısı kullanılamıyor.' };
  }
  try {
    const token = readLocalAccountSessionToken(params.accountId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['X-Account-Token'] = token;
    }
    const res = await fetchBackendWithWakeupRetry(
      '/api/billing/verify-google-play',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountId: params.accountId,
          itemId: params.itemId,
          productId: params.productId,
          purchaseToken: params.purchaseToken,
          orderId: params.orderId,
          isRestore: Boolean(params.isRestore),
        }),
      },
      {
        fetchImpl: fetcher,
        timeoutMs: 20000,
        retries: 2,
        retryDelayMs: 2000,
      }
    );
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      verified?: boolean;
      alreadyCredited?: boolean;
      error?: string;
    } | null;

    if (!res.ok || !data?.ok || !data?.verified) {
      return {
        verified: false,
        reason: data?.error || 'Satın alma sunucu tarafından doğrulanamadı.',
      };
    }
    return {
      verified: true,
      alreadyCredited: Boolean(data.alreadyCredited),
    };
  } catch {
    return {
      verified: false,
      reason: 'Doğrulama sunucusuna ulaşılamadı. Lütfen internet bağlantını kontrol et.',
    };
  }
}

export interface PurchaseExecutionResult {
  ok: boolean;
  status: PlayBillingPurchaseStatus;
  itemId: string;
  purchaseToken?: string;
  reason?: string;
}

/**
 * Gerçek Android cihazda Google Play Billing v7 üzerinden satın alma başlatır,
 * PURCHASED sonrası sunucu doğrulamasını bekler ve doğrulandığında acknowledge/consume yapar.
 * Çift satın almayı önlemek için permanent öğelerde mevcut owned kontrolü yapar.
 */
export async function executeGooglePlayPurchase(params: {
  itemId: string;
  accountId: string;
  alreadyOwned?: boolean;
  bridgeOverride?: NativeBillingBridge | null;
  fetchImpl?: typeof fetch;
  overrideIapEnabled?: boolean;
}): Promise<PurchaseExecutionResult> {
  const allowRealMoneyPurchase =
    params.overrideIapEnabled !== undefined
      ? params.overrideIapEnabled
      : params.bridgeOverride !== undefined
      ? true
      : isRealMoneyIapEnabled();
  if (!allowRealMoneyPurchase) {
    return {
      ok: false,
      status: 'DISABLED',
      itemId: params.itemId,
      reason: 'Gerçek para ile satın alma işlemleri kapalı test süresince devre dışıdır.',
    };
  }
  const mapping = findGooglePlaySkuByItemId(params.itemId);
  if (!mapping) {
    return {
      ok: false,
      status: 'INVALID_PRODUCT',
      itemId: params.itemId,
      reason: 'Bu ürün Google Play kataloğunda tanımlı değil.',
    };
  }

  if (!mapping.consumable && params.alreadyOwned) {
    return {
      ok: false,
      status: 'ITEM_ALREADY_OWNED',
      itemId: params.itemId,
      reason: 'Bu kalıcı hak hesabında zaten aktif.',
    };
  }

  const bridge = params.bridgeOverride !== undefined ? params.bridgeOverride : getPlayBillingBridge();
  if (!bridge) {
    return {
      ok: false,
      status: 'WEB_UNSUPPORTED',
      itemId: params.itemId,
      reason:
        'Gerçek para ile satın alma işlemleri yalnızca Google Play Store üzerinden yüklenen Android uygulamasında yapılabilir.',
    };
  }

  // Satın alma öncesi çift işlem / Play'de zaten sahiplik kontrolü
  if (!mapping.consumable) {
    try {
      const ownedRes = await bridge.queryOwnedPurchases();
      const matchedOwned = (ownedRes.purchases || []).find((p) =>
        p.productIds?.includes(mapping.productId)
      );
      if (matchedOwned?.purchaseToken) {
        const verifyOwned = await verifyGooglePlayPurchaseWithServer({
          accountId: params.accountId,
          itemId: mapping.itemId,
          productId: mapping.productId,
          purchaseToken: matchedOwned.purchaseToken,
          orderId: matchedOwned.orderId,
          fetchImpl: params.fetchImpl,
        });
        if (verifyOwned.verified) {
          if (!matchedOwned.acknowledged) {
            await bridge
              .acknowledgeOrConsumePurchase({
                purchaseToken: matchedOwned.purchaseToken,
                consumable: false,
              })
              .catch(() => {});
          }
          return {
            ok: true,
            status: 'PURCHASED',
            itemId: mapping.itemId,
            purchaseToken: matchedOwned.purchaseToken,
          };
        }
      }
    } catch {
      // Devam et
    }
  }

  const flowRes = await bridge.launchBillingFlow({
    productId: mapping.productId,
    obfuscatedAccountId: params.accountId,
  });

  if (flowRes.status === 'PENDING') {
    return {
      ok: false,
      status: 'PENDING',
      itemId: mapping.itemId,
      purchaseToken: flowRes.purchaseToken,
      reason:
        'Ödemen Google Play tarafından beklemede. Onaylandığında Satın Alımları Geri Yükle ile hemen hesabına tanımlanacak.',
    };
  }

  if (flowRes.status === 'USER_CANCELED') {
    return {
      ok: false,
      status: 'USER_CANCELED',
      itemId: mapping.itemId,
      reason: 'Satın alma iptal edildi.',
    };
  }

  if (!flowRes.ok || flowRes.status !== 'PURCHASED' || !flowRes.purchaseToken) {
    return {
      ok: false,
      status: flowRes.status || 'BILLING_ERROR',
      itemId: mapping.itemId,
      reason: flowRes.message || 'Google Play ödemesi tamamlanamadı.',
    };
  }

  // Sunucu tarafında Google Play doğrulaması yapılmadan hak verme ve acknowledge yapma!
  const verifyRes = await verifyGooglePlayPurchaseWithServer({
    accountId: params.accountId,
    itemId: mapping.itemId,
    productId: mapping.productId,
    purchaseToken: flowRes.purchaseToken,
    orderId: flowRes.orderId,
    fetchImpl: params.fetchImpl,
  });

  if (!verifyRes.verified) {
    return {
      ok: false,
      status: 'VERIFICATION_FAILED',
      itemId: mapping.itemId,
      purchaseToken: flowRes.purchaseToken,
      reason: verifyRes.reason || 'Satın alma doğrulaması başarısız.',
    };
  }

  if (!flowRes.acknowledged) {
    await bridge
      .acknowledgeOrConsumePurchase({
        purchaseToken: flowRes.purchaseToken,
        consumable: mapping.consumable,
      })
      .catch(() => {});
  }

  return {
    ok: true,
    status: 'PURCHASED',
    itemId: mapping.itemId,
    purchaseToken: flowRes.purchaseToken,
  };
}

export async function restoreGooglePlayPurchases(params: {
  accountId: string;
  bridgeOverride?: NativeBillingBridge | null;
  fetchImpl?: typeof fetch;
}): Promise<{
  restoredItemIds: string[];
  hadNativeStore: boolean;
}> {
  const bridge = params.bridgeOverride !== undefined ? params.bridgeOverride : getPlayBillingBridge();
  if (!bridge) {
    return { restoredItemIds: [], hadNativeStore: false };
  }

  try {
    const res = await bridge.queryOwnedPurchases();
    if (!res.ok || !Array.isArray(res.purchases)) {
      return { restoredItemIds: [], hadNativeStore: true };
    }

    const restoredItemIds: string[] = [];
    for (const p of res.purchases) {
      if (!p.purchaseToken || !Array.isArray(p.productIds)) continue;
      for (const productId of p.productIds) {
        const mapping = findRestorableGooglePlaySkuByProductId(productId);
        if (!mapping || mapping.consumable) continue;
        const verifyRes = await verifyGooglePlayPurchaseWithServer({
          accountId: params.accountId,
          itemId: mapping.itemId,
          productId: mapping.productId,
          purchaseToken: p.purchaseToken,
          orderId: p.orderId,
          isRestore: true,
          fetchImpl: params.fetchImpl,
        });
        if (verifyRes.verified) {
          restoredItemIds.push(mapping.itemId);
          if (!p.acknowledged) {
            await bridge
              .acknowledgeOrConsumePurchase({
                purchaseToken: p.purchaseToken,
                consumable: false,
              })
              .catch(() => {});
          }
        }
      }
    }

    return {
      restoredItemIds: Array.from(new Set(restoredItemIds)),
      hadNativeStore: true,
    };
  } catch {
    return { restoredItemIds: [], hadNativeStore: true };
  }
}
