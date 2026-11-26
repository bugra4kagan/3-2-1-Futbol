import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  RewardAdPluginEvents,
  BannerAdSize,
  BannerAdPosition,
  AdmobConsentStatus,
  MaxAdContentRating,
} from '@capacitor-community/admob';
import type { AdMobPlugin } from '@capacitor-community/admob';
import { isAdsEnabled } from '../game/monetizationFlags';
import { captureError, logTelemetryEvent } from './telemetryService';

export type RewardedPlacement =
  | 'extra_wheel_spin'
  | 'double_coins'
  | 'hint'
  | 'energy_refill'
  | 'rematch_unlock';

export const ADMOB_OFFICIAL_TEST_IDS = {
  android: {
    appId: 'ca-app-pub-3940256099942544~3347511713',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    banner: 'ca-app-pub-3940256099942544/6300978111',
  },
  ios: {
    appId: 'ca-app-pub-3940256099942544~1458002511',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    banner: 'ca-app-pub-3940256099942544/2934735716',
  },
} as const;

const GOOGLE_TEST_PUBLISHER_PREFIX = 'ca-app-pub-3940256099942544';

export interface ResolvedAdMobConfig {
  mode: 'debug_test' | 'production';
  isProductionReady: boolean;
  isUsingTestIds: boolean;
  missingProductionKeys: string[];
  appId: string;
  rewardedId: string;
  interstitialId: string;
  bannerId: string;
}

function getEnvString(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const val = env?.[key];
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  } catch {
    return undefined;
  }
}

function isProductionEnv(): boolean {
  try {
    const env = (import.meta as unknown as { env?: { PROD?: boolean } }).env;
    return Boolean(env?.PROD);
  } catch {
    return false;
  }
}

export function isOfficialAdMobTestId(adUnitOrAppId?: string | null): boolean {
  if (!adUnitOrAppId) return false;
  return adUnitOrAppId.trim().startsWith(GOOGLE_TEST_PUBLISHER_PREFIX);
}

/**
 * Debug ve Production AdMob yapılandırmalarını kesin olarak ayırır.
 * Production (release) derlemelerde VITE_ADMOB_* değerleri eksikse veya yanlışlıkla test ID'si
 * taşıyorsa sessizce Google Test ID'sine düşmez; eksik anahtarları raporlayıp başlatmayı engeller.
 */
export function resolveAdMobConfig(overrides?: {
  platform?: 'android' | 'ios';
  isProductionBuild?: boolean;
  allowTestFallback?: boolean;
  appId?: string;
  rewardedId?: string;
  interstitialId?: string;
  bannerId?: string;
}): ResolvedAdMobConfig {
  const platform = overrides?.platform ?? getPlatformKey();
  const defaults = ADMOB_OFFICIAL_TEST_IDS[platform];
  const isProd = overrides?.isProductionBuild ?? isProductionEnv();
  const allowTestFallback =
    overrides?.allowTestFallback ?? getEnvString('VITE_ADMOB_ALLOW_TEST_FALLBACK') === 'true';

  const rawAppId = overrides?.appId ?? getEnvString('VITE_ADMOB_APP_ID');
  const rawRewarded = overrides?.rewardedId ?? getEnvString('VITE_ADMOB_REWARDED_ID');
  const rawInterstitial = overrides?.interstitialId ?? getEnvString('VITE_ADMOB_INTERSTITIAL_ID');
  const rawBanner = overrides?.bannerId ?? getEnvString('VITE_ADMOB_BANNER_ID');

  // Debug / Dev veya açıkça test fallback istenen Debug APK derlemeleri
  if (!isProd || allowTestFallback) {
    const appId = rawAppId ?? defaults.appId;
    const rewardedId = rawRewarded ?? defaults.rewarded;
    const interstitialId = rawInterstitial ?? defaults.interstitial;
    const bannerId = rawBanner ?? defaults.banner;
    const isUsingTestIds =
      isOfficialAdMobTestId(appId) ||
      isOfficialAdMobTestId(rewardedId) ||
      isOfficialAdMobTestId(interstitialId) ||
      isOfficialAdMobTestId(bannerId);

    return {
      mode: 'debug_test',
      isProductionReady: !isUsingTestIds,
      isUsingTestIds,
      missingProductionKeys: [],
      appId,
      rewardedId,
      interstitialId,
      bannerId,
    };
  }

  // Production / Release derleme: kesinlikle test ID fallback YOKTUR
  const missingProductionKeys: string[] = [];
  const validAppId = rawAppId && !isOfficialAdMobTestId(rawAppId) ? rawAppId : '';
  const validRewarded = rawRewarded && !isOfficialAdMobTestId(rawRewarded) ? rawRewarded : '';
  const validInterstitial =
    rawInterstitial && !isOfficialAdMobTestId(rawInterstitial) ? rawInterstitial : '';
  const validBanner = rawBanner && !isOfficialAdMobTestId(rawBanner) ? rawBanner : '';

  if (!validAppId) missingProductionKeys.push('VITE_ADMOB_APP_ID');
  if (!validRewarded) missingProductionKeys.push('VITE_ADMOB_REWARDED_ID');
  if (!validInterstitial) missingProductionKeys.push('VITE_ADMOB_INTERSTITIAL_ID');

  const isProductionReady = Boolean(validAppId && validRewarded && validInterstitial);
  return {
    mode: 'production',
    isProductionReady,
    isUsingTestIds: false,
    missingProductionKeys,
    appId: validAppId,
    rewardedId: validRewarded,
    interstitialId: validInterstitial,
    bannerId: validBanner,
  };
}

export function getAdMobEnvConfig() {
  return resolveAdMobConfig();
}

export interface AdMobConsentState {
  checked: boolean;
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
  status: string;
}

let admobInitialized = false;
let cachedConsentState: AdMobConsentState = {
  checked: false,
  canRequestAds: false,
  privacyOptionsRequired: false,
  status: AdmobConsentStatus.UNKNOWN,
};

export function getAdMobConsentState(): AdMobConsentState {
  return { ...cachedConsentState };
}

/**
 * Google UMP (User Messaging Platform) GDPR / EEA / UK / CH kullanıcı onayı akışı.
 * Reklam SDK'sı başlatılmadan önce onay durumunu sorgular ve gerekiyorsa Google onay formunu gösterir.
 */
export async function ensureAdMobConsent(forceRefresh = false): Promise<AdMobConsentState> {
  if (!isAdsEnabled() || !isNativeCapacitorRuntime()) {
    return {
      checked: true,
      canRequestAds: false,
      privacyOptionsRequired: false,
      status: AdmobConsentStatus.NOT_REQUIRED,
    };
  }
  if (cachedConsentState.checked && !forceRefresh) {
    return { ...cachedConsentState };
  }

  const plugin = await getAdMobPlugin();
  if (!plugin || typeof plugin.requestConsentInfo !== 'function') {
    cachedConsentState = {
      checked: true,
      canRequestAds: false,
      privacyOptionsRequired: false,
      status: AdmobConsentStatus.UNKNOWN,
    };
    return { ...cachedConsentState };
  }

  try {
    let info = await plugin.requestConsentInfo({
      tagForUnderAgeOfConsent: false,
    });
    if (
      info.status === AdmobConsentStatus.REQUIRED &&
      info.isConsentFormAvailable &&
      typeof plugin.showConsentForm === 'function'
    ) {
      info = await plugin.showConsentForm();
    }
    const canRequestAds =
      typeof info.canRequestAds === 'boolean'
        ? info.canRequestAds
        : info.status === AdmobConsentStatus.OBTAINED ||
          info.status === AdmobConsentStatus.NOT_REQUIRED;
    const privacyOptionsRequired =
      String(info.privacyOptionsRequirementStatus || '') === 'REQUIRED';

    cachedConsentState = {
      checked: true,
      canRequestAds,
      privacyOptionsRequired,
      status: String(info.status || AdmobConsentStatus.UNKNOWN),
    };
    logTelemetryEvent('admob_ump_consent_resolved', {
      status: cachedConsentState.status,
      canRequestAds: cachedConsentState.canRequestAds,
      privacyOptionsRequired: cachedConsentState.privacyOptionsRequired,
    });
    return { ...cachedConsentState };
  } catch (err) {
    captureError(err, { stage: 'admob_ump_consent' });
    cachedConsentState = {
      checked: true,
      canRequestAds: false,
      privacyOptionsRequired: false,
      status: AdmobConsentStatus.UNKNOWN,
    };
    return { ...cachedConsentState };
  }
}

export async function openAdPrivacyOptionsForm(): Promise<{ ok: boolean; message: string }> {
  if (!isNativeCapacitorRuntime()) {
    return {
      ok: false,
      message: 'Reklam gizlilik tercihleri yalnızca mobil uygulamada kullanılabilir.',
    };
  }
  const plugin = await getAdMobPlugin();
  if (!plugin || typeof plugin.showPrivacyOptionsForm !== 'function') {
    return {
      ok: false,
      message: 'Reklam gizlilik formu bu cihazda şu anda kullanılamıyor.',
    };
  }
  try {
    await plugin.showPrivacyOptionsForm();
    await ensureAdMobConsent(true);
    return {
      ok: true,
      message: 'Reklam gizlilik tercihlerin güncellendi.',
    };
  } catch (err) {
    captureError(err, { stage: 'admob_privacy_options_form' });
    return {
      ok: false,
      message: 'Reklam gizlilik formu açılamadı. Lütfen daha sonra tekrar dene.',
    };
  }
}

function getPlatformKey(): 'android' | 'ios' {
  try {
    return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  } catch {
    return 'android';
  }
}

export function isNativeCapacitorRuntime(): boolean {
  try {
    return typeof window !== 'undefined' && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function getAdMobPlugin(): Promise<AdMobPlugin | null> {
  if (!isNativeCapacitorRuntime()) return null;
  try {
    const mod = await import('@capacitor-community/admob');
    return mod.AdMob;
  } catch (err) {
    captureError(err, { stage: 'admob_import' });
    return null;
  }
}

export async function initializeAdMob(): Promise<boolean> {
  if (!isAdsEnabled()) return false;
  if (admobInitialized) return true;
  if (!isNativeCapacitorRuntime()) return false;

  const config = getAdMobEnvConfig();
  if (config.mode === 'production' && !config.isProductionReady) {
    logTelemetryEvent(
      'admob_production_config_missing',
      { missing: config.missingProductionKeys.join(',') },
      'warning'
    );
    return false;
  }

  const consent = await ensureAdMobConsent();
  if (!consent.canRequestAds) {
    logTelemetryEvent(
      'admob_blocked_no_consent',
      { status: consent.status },
      'warning'
    );
    return false;
  }

  const plugin = await getAdMobPlugin();
  if (!plugin) return false;

  try {
    await plugin.initialize({
      initializeForTesting: config.isUsingTestIds,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      maxAdContentRating: MaxAdContentRating.Teen,
    });
    admobInitialized = true;
    logTelemetryEvent('admob_initialized', {
      platform: getPlatformKey(),
      mode: config.mode,
      testing: config.isUsingTestIds,
    });
    return true;
  } catch (err) {
    captureError(err, { stage: 'admob_initialize' });
    return false;
  }
}

export function resolveRewardedAdUnitId(
  _placement: RewardedPlacement,
  overrideAdId?: string
): string {
  if (overrideAdId && overrideAdId.trim().length > 0) return overrideAdId;
  return getAdMobEnvConfig().rewardedId;
}

export function resolveInterstitialAdUnitId(overrideAdId?: string): string {
  if (overrideAdId && overrideAdId.trim().length > 0) return overrideAdId;
  return getAdMobEnvConfig().interstitialId;
}

export function resolveBannerAdUnitId(overrideAdId?: string): string {
  if (overrideAdId && overrideAdId.trim().length > 0) return overrideAdId;
  return getAdMobEnvConfig().bannerId;
}

export async function showNativeRewardedAd(
  placement: RewardedPlacement,
  overrideAdId?: string
): Promise<{
  shown: boolean;
  rewarded: boolean;
  adUnitId: string;
  blockedReason?: 'missing_production_config' | 'disabled_closed_test';
}> {
  const config = getAdMobEnvConfig();
  const adUnitId = resolveRewardedAdUnitId(placement, overrideAdId);
  if (!isNativeCapacitorRuntime()) {
    return { shown: false, rewarded: false, adUnitId };
  }
  if (!isAdsEnabled()) {
    return {
      shown: false,
      rewarded: false,
      adUnitId: '',
      blockedReason: 'disabled_closed_test',
    };
  }

  if (config.mode === 'production' && !adUnitId) {
    return {
      shown: false,
      rewarded: false,
      adUnitId: '',
      blockedReason: 'missing_production_config',
    };
  }

  const plugin = await getAdMobPlugin();
  if (!plugin) {
    return { shown: false, rewarded: false, adUnitId };
  }

  let rewardedByListener = false;
  let listenerHandle: PluginListenerHandle | null = null;
  let shown = false;

  try {
    const initialized = await initializeAdMob();
    if (!initialized) {
      return {
        shown: false,
        rewarded: false,
        adUnitId,
        blockedReason: config.mode === 'production' ? 'missing_production_config' : undefined,
      };
    }

    listenerHandle = await plugin.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewardedByListener = true;
    });

    await plugin.prepareRewardVideoAd({
      adId: adUnitId,
      isTesting: isOfficialAdMobTestId(adUnitId),
    });
    const rewardItem = await plugin.showRewardVideoAd();
    shown = true;

    const granted = rewardedByListener || Boolean(rewardItem && (rewardItem.amount ?? 0) > 0);
    if (granted) {
      logTelemetryEvent('admob_rewarded_completed', {
        placement,
        amount: rewardItem?.amount ?? 1,
      });
    }
    return { shown: true, rewarded: granted, adUnitId };
  } catch (err) {
    captureError(err, { stage: 'admob_rewarded', placement });
    return { shown, rewarded: rewardedByListener, adUnitId };
  } finally {
    await listenerHandle?.remove().catch(() => {});
  }
}

export async function showNativeInterstitialAd(
  overrideAdId?: string
): Promise<{
  shown: boolean;
  adUnitId: string;
  blockedReason?: 'missing_production_config' | 'disabled_closed_test';
}> {
  const config = getAdMobEnvConfig();
  const adUnitId = resolveInterstitialAdUnitId(overrideAdId);
  if (!isNativeCapacitorRuntime()) {
    return { shown: false, adUnitId };
  }
  if (!isAdsEnabled()) {
    return { shown: false, adUnitId: '', blockedReason: 'disabled_closed_test' };
  }

  if (config.mode === 'production' && !adUnitId) {
    return { shown: false, adUnitId: '', blockedReason: 'missing_production_config' };
  }

  const plugin = await getAdMobPlugin();
  if (!plugin) {
    return { shown: false, adUnitId };
  }

  try {
    const initialized = await initializeAdMob();
    if (!initialized) {
      return {
        shown: false,
        adUnitId,
        blockedReason: config.mode === 'production' ? 'missing_production_config' : undefined,
      };
    }
    await plugin.prepareInterstitial({
      adId: adUnitId,
      isTesting: isOfficialAdMobTestId(adUnitId),
    });
    await plugin.showInterstitial();
    logTelemetryEvent('admob_interstitial_shown', { adUnitId });
    return { shown: true, adUnitId };
  } catch (err) {
    captureError(err, { stage: 'admob_interstitial' });
    return { shown: false, adUnitId };
  }
}

export async function showNativeBannerAd(
  adFree: boolean,
  overrideAdId?: string
): Promise<boolean> {
  if (!isAdsEnabled() || adFree || !isNativeCapacitorRuntime()) return false;
  const config = getAdMobEnvConfig();
  const adUnitId = resolveBannerAdUnitId(overrideAdId);
  if (config.mode === 'production' && !adUnitId) return false;

  const plugin = await getAdMobPlugin();
  if (!plugin) return false;

  try {
    const initialized = await initializeAdMob();
    if (!initialized) return false;
    await plugin.showBanner({
      adId: adUnitId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: isOfficialAdMobTestId(adUnitId),
    });
    return true;
  } catch {
    return false;
  }
}

export async function hideNativeBannerAd(): Promise<void> {
  if (!isNativeCapacitorRuntime()) return;
  const plugin = await getAdMobPlugin();
  if (!plugin) return;
  try {
    await plugin.hideBanner();
  } catch {
    // ignore
  }
}
