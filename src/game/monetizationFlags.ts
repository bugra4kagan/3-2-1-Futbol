/**
 * Merkezi Gelir Elde Etme (Reklam & Gerçek Para IAP) Bayrakları.
 *
 * İlk Google Play kapalı test sürümünde (v1.1.0) gerçek reklamlar (AdMob) ve
 * gerçek para ile uygulama içi satın almalar (Play Billing) bilinçli olarak
 * KAPALI tutulur.
 *
 * - Mevcut doğrulanmış VIP / Reklamsız hakları (progression.adFree) asla silinmez.
 * - Oyun içi Coin ile kozmetik mağazası (arma, çerçeve, rozet, ünvan) tam çalışır.
 * - Gelecekte ayrı bir politika & UMP uyumluluk denetimi sonrası yalnızca açık
 *   build-time ortam değişkenleriyle (`VITE_ENABLE_ADS=true` / `VITE_ENABLE_REAL_MONEY_IAP=true`)
 *   güvenli biçimde yeniden etkinleştirilebilir.
 */

function readEnvFlag(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const raw = env?.[key];
    return typeof raw === 'string' ? raw.trim().toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export const CLOSED_TEST_ADS_DEFAULT_ENABLED = false;
export const CLOSED_TEST_REAL_MONEY_IAP_DEFAULT_ENABLED = false;

export function isAdsEnabled(override?: boolean): boolean {
  if (typeof override === 'boolean') return override;
  return readEnvFlag('VITE_ENABLE_ADS') === 'true';
}

export function isRealMoneyIapEnabled(override?: boolean): boolean {
  if (typeof override === 'boolean') return override;
  return readEnvFlag('VITE_ENABLE_REAL_MONEY_IAP') === 'true';
}
