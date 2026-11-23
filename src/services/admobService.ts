import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { RewardAdPluginEvents, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import type { AdMobPlugin } from '@capacitor-community/admob';
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

function getEnvString(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const val = env?.[key];
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function getAdMobEnvConfig() {
  const platform = getPlatformKey();
  const defaults = ADMOB_OFFICIAL_TEST_IDS[platform];
  return {
    appId: getEnvString('VITE_ADMOB_APP_ID') ?? defaults.appId,
    rewardedId: getEnvString('VITE_ADMOB_REWARDED_ID') ?? defaults.rewarded,
    interstitialId: getEnvString('VITE_ADMOB_INTERSTITIAL_ID') ?? defaults.interstitial,
    bannerId: getEnvString('VITE_ADMOB_BANNER_ID') ?? defaults.banner,
  };
}

let admobInitialized = false;

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
  if (admobInitialized) return true;
  if (!isNativeCapacitorRuntime()) return false;

  const plugin = await getAdMobPlugin();
  if (!plugin) return false;

  try {
    const { rewardedId, interstitialId, bannerId } = getAdMobEnvConfig();
    const isUsingTestIds =
      rewardedId === ADMOB_OFFICIAL_TEST_IDS.android.rewarded ||
      interstitialId === ADMOB_OFFICIAL_TEST_IDS.android.interstitial ||
      bannerId === ADMOB_OFFICIAL_TEST_IDS.android.banner;

    await plugin.initialize({
      initializeForTesting: isUsingTestIds,
    });
    admobInitialized = true;
    logTelemetryEvent('admob_initialized', { platform: getPlatformKey() });
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
): Promise<{ shown: boolean; rewarded: boolean; adUnitId: string }> {
  const adUnitId = resolveRewardedAdUnitId(placement, overrideAdId);
  if (!isNativeCapacitorRuntime()) {
    return { shown: false, rewarded: false, adUnitId };
  }

  const plugin = await getAdMobPlugin();
  if (!plugin) {
    return { shown: false, rewarded: false, adUnitId };
  }

  let rewardedByListener = false;
  let listenerHandle: PluginListenerHandle | null = null;
  let shown = false;

  try {
    await initializeAdMob();
    listenerHandle = await plugin.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewardedByListener = true;
    });

    await plugin.prepareRewardVideoAd({
      adId: adUnitId,
      isTesting: adUnitId === ADMOB_OFFICIAL_TEST_IDS[getPlatformKey()].rewarded,
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
    return { shown, rewarded: false, adUnitId };
  } finally {
    if (listenerHandle) {
      await listenerHandle.remove().catch(() => {});
    }
  }
}

export async function showNativeInterstitialAd(
  overrideAdId?: string
): Promise<{ shown: boolean; adUnitId: string }> {
  const adUnitId = resolveInterstitialAdUnitId(overrideAdId);
  if (!isNativeCapacitorRuntime()) {
    return { shown: false, adUnitId };
  }

  const plugin = await getAdMobPlugin();
  if (!plugin) {
    return { shown: false, adUnitId };
  }

  try {
    await initializeAdMob();
    await plugin.prepareInterstitial({
      adId: adUnitId,
      isTesting: adUnitId === ADMOB_OFFICIAL_TEST_IDS[getPlatformKey()].interstitial,
    });
    await plugin.showInterstitial();
    logTelemetryEvent('admob_interstitial_shown', { platform: getPlatformKey() });
    return { shown: true, adUnitId };
  } catch (err) {
    captureError(err, { stage: 'admob_interstitial' });
    return { shown: false, adUnitId };
  }
}

export async function showNativeBannerAd(overrideAdId?: string): Promise<boolean> {
  if (!isNativeCapacitorRuntime()) return false;
  const plugin = await getAdMobPlugin();
  if (!plugin) return false;

  const adUnitId = resolveBannerAdUnitId(overrideAdId);
  try {
    await initializeAdMob();
    await plugin.showBanner({
      adId: adUnitId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      isTesting: adUnitId === ADMOB_OFFICIAL_TEST_IDS[getPlatformKey()].banner,
    });
    return true;
  } catch (err) {
    captureError(err, { stage: 'admob_banner_show' });
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
    // ignore hide errors
  }
}
