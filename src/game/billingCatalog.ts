export interface GooglePlaySkuMapping {
  itemId: string;
  productId: string;
  consumable: boolean;
  grantAdFree?: boolean;
  vipFrame?: boolean;
  coinGrant?: number;
  activeForSale: boolean;
}

export const DEFAULT_AD_FREE_PLAY_SKU = 'com.futbol321.challenge.ad_free';

function readAdFreeSkuEnv(): string {
  try {
    const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const fromVite = viteEnv?.VITE_PLAY_BILLING_AD_FREE_SKU?.trim();
    if (fromVite) return fromVite;
  } catch {
    // ignore in Node
  }
  if (typeof process !== 'undefined' && process.env?.PLAY_BILLING_AD_FREE_SKU?.trim()) {
    return process.env.PLAY_BILLING_AD_FREE_SKU.trim();
  }
  return DEFAULT_AD_FREE_PLAY_SKU;
}

export function getAdFreeGooglePlayProductId(): string {
  return readAdFreeSkuEnv();
}

/**
 * Aktif satışta olan tek Google Play INAPP ürünü: mevcut "Reklamları Kaldır" (store_ad_free).
 * Yeni VIP Bundle veya gerçek parayla coin paketleri satışta değildir.
 */
export function getActiveGooglePlayProductMappings(): GooglePlaySkuMapping[] {
  return [
    {
      itemId: 'store_ad_free',
      productId: getAdFreeGooglePlayProductId(),
      consumable: false,
      grantAdFree: true,
      activeForSale: true,
    },
  ];
}

export const GOOGLE_PLAY_PRODUCT_MAPPINGS: GooglePlaySkuMapping[] = getActiveGooglePlayProductMappings();

/**
 * Önceden satın alınmış hakların "Satın Alımları Geri Yükle" sırasında korunması için
 * tanınan geçmiş (artık satışa kapalı) SKU kayıtları.
 */
const LEGACY_RESTORABLE_SKU_MAPPINGS: GooglePlaySkuMapping[] = [
  {
    itemId: 'bundle_vip_adfree_frame',
    productId: 'com.futbol321.challenge.vip_bundle',
    consumable: false,
    grantAdFree: true,
    vipFrame: true,
    activeForSale: false,
  },
];

export function findGooglePlaySkuByItemId(itemId: string): GooglePlaySkuMapping | null {
  return getActiveGooglePlayProductMappings().find((m) => m.itemId === itemId) ?? null;
}

export function findGooglePlaySkuByProductId(productId: string): GooglePlaySkuMapping | null {
  return getActiveGooglePlayProductMappings().find((m) => m.productId === productId) ?? null;
}

export function findRestorableGooglePlaySkuByProductId(productId: string): GooglePlaySkuMapping | null {
  return (
    findGooglePlaySkuByProductId(productId) ??
    LEGACY_RESTORABLE_SKU_MAPPINGS.find((m) => m.productId === productId) ??
    null
  );
}

export function findRestorableGooglePlaySkuByItemId(itemId: string): GooglePlaySkuMapping | null {
  return (
    findGooglePlaySkuByItemId(itemId) ??
    LEGACY_RESTORABLE_SKU_MAPPINGS.find((m) => m.itemId === itemId) ??
    null
  );
}
