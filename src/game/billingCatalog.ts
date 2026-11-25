export interface GooglePlaySkuMapping {
  itemId: string;
  productId: string;
  consumable: boolean;
  grantAdFree?: boolean;
  vipFrame?: boolean;
  coinGrant?: number;
}

/**
 * Google Play Console'daki resmi INAPP ürün tanımları (com.futbol321.challenge).
 */
export const GOOGLE_PLAY_PRODUCT_MAPPINGS: GooglePlaySkuMapping[] = [
  {
    itemId: 'store_ad_free',
    productId: 'com.futbol321.challenge.ad_free',
    consumable: false,
    grantAdFree: true,
  },
  {
    itemId: 'bundle_vip_adfree_frame',
    productId: 'com.futbol321.challenge.vip_bundle',
    consumable: false,
    grantAdFree: true,
    vipFrame: true,
  },
  {
    itemId: 'pack_coin_1500',
    productId: 'com.futbol321.challenge.coins_1500',
    consumable: true,
    coinGrant: 1500,
  },
  {
    itemId: 'pack_coin_5000',
    productId: 'com.futbol321.challenge.coins_5000',
    consumable: true,
    coinGrant: 5000,
  },
  {
    itemId: 'pack_coin_15000',
    productId: 'com.futbol321.challenge.coins_15000',
    consumable: true,
    coinGrant: 15000,
  },
];

export function findGooglePlaySkuByItemId(itemId: string): GooglePlaySkuMapping | null {
  return GOOGLE_PLAY_PRODUCT_MAPPINGS.find((m) => m.itemId === itemId) ?? null;
}

export function findGooglePlaySkuByProductId(productId: string): GooglePlaySkuMapping | null {
  return GOOGLE_PLAY_PRODUCT_MAPPINGS.find((m) => m.productId === productId) ?? null;
}
