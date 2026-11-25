import {
  RewardedPlacement,
  getAdMobEnvConfig,
  showNativeInterstitialAd,
  showNativeRewardedAd,
} from './admobService';

export interface AdMobUnitConfig {
  android: {
    rewardedCoins: string;
    rewardedRematch: string;
    rewardedEnergy: string;
    interstitial: string;
  };
  ios: {
    rewardedCoins: string;
    rewardedRematch: string;
    rewardedEnergy: string;
    interstitial: string;
  };
}

/**
 * Google AdMob / Capacitor Native Bridge için hazır Reklam Birimi ID (Unit ID) yapılandırması.
 * Mağaza yayını öncesinde test ID'leri gerçek AdMob panelinden alınan ID'lerle değiştirilir.
 */
export const ADMOB_UNIT_IDS: AdMobUnitConfig = {
  android: {
    rewardedCoins: 'ca-app-pub-3940256099942544/5224354917',
    rewardedRematch: 'ca-app-pub-3940256099942544/5224354917',
    rewardedEnergy: 'ca-app-pub-3940256099942544/5224354917',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
  ios: {
    rewardedCoins: 'ca-app-pub-3940256099942544/1712485313',
    rewardedRematch: 'ca-app-pub-3940256099942544/1712485313',
    rewardedEnergy: 'ca-app-pub-3940256099942544/1712485313',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
  },
};

export type AdRewardPurpose =
  | 'double_match_reward'
  | 'free_coins'
  | 'free_coins_250'
  | 'rematch_unlock'
  | 'energy_refill_2'
  | 'wheel_spin'
  | 'double_daily_chest'
  | 'last_chance_revive'
  | 'weekend_cup_entry'
  | 'streak_saver';

export interface AdWatchResult {
  completed: boolean;
  provider: 'capacitor_admob' | 'web_simulation' | 'vip_bypass';
  adUnitId: string;
  rewardAmountCoins: number;
  rewardAmountEnergy: number;
}

export interface InterstitialAdResult {
  shown: boolean;
  skippedByVip: boolean;
  provider: 'capacitor_admob' | 'web_simulation' | 'vip_bypass';
  adUnitId: string;
}

interface CapacitorAdMobPlugin {
  prepareRewardVideoAd?: (opts: { adId: string }) => Promise<void>;
  showRewardVideoAd?: () => Promise<{ type?: string; amount?: number }>;
  prepareInterstitial?: (opts: { adId: string }) => Promise<void>;
  showInterstitial?: () => Promise<void>;
}

interface CapacitorWindow extends Window {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => 'android' | 'ios' | 'web';
    Plugins?: {
      AdMob?: CapacitorAdMobPlugin;
    };
  };
}

export const SIMULATED_AD_DURATION_MS = 3000;
export const COMPLETED_MATCHES_AD_STORAGE_KEY = '321_completed_matches_ad_count';
export const INTERSTITIAL_MATCH_INTERVAL = 3;

export function getCompletedMatchAdCount(storage?: Pick<Storage, 'getItem'> | null): number {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!target) return 0;
  try {
    const raw = target.getItem(COMPLETED_MATCHES_AD_STORAGE_KEY);
    const parsed = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function incrementCompletedMatchAdCount(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): number {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const next = getCompletedMatchAdCount(target) + 1;
  if (target) {
    try {
      target.setItem(COMPLETED_MATCHES_AD_STORAGE_KEY, String(next));
    } catch {
      // ignore quota / private mode errors
    }
  }
  return next;
}

export function shouldTriggerInterstitialForMatchCount(
  completedMatches: number,
  isVipAdFree: boolean
): boolean {
  if (isVipAdFree) return false;
  return completedMatches > 0 && completedMatches % INTERSTITIAL_MATCH_INTERVAL === 0;
}

export function getInterstitialAdUnitId(): string {
  const envCfg = getAdMobEnvConfig();
  if (envCfg.interstitialId) return envCfg.interstitialId;
  const win = typeof window !== 'undefined' ? (window as CapacitorWindow) : null;
  const platform = win?.Capacitor?.getPlatform?.() === 'ios' ? 'ios' : 'android';
  return ADMOB_UNIT_IDS[platform].interstitial;
}

export function hasNativeInterstitialBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as CapacitorWindow;
  return Boolean(
    win.Capacitor?.isNativePlatform?.() &&
      win.Capacitor?.Plugins?.AdMob?.prepareInterstitial &&
      win.Capacitor?.Plugins?.AdMob?.showInterstitial
  );
}

type InterstitialPresenter = (adUnitId: string) => Promise<void>;
let activeInterstitialPresenter: InterstitialPresenter | null = null;

export function setInterstitialPresenter(presenter: InterstitialPresenter | null): void {
  activeInterstitialPresenter = presenter;
}

export function getAdUnitIdForPlatform(_purpose: AdRewardPurpose): string {
  const envCfg = getAdMobEnvConfig();
  if (envCfg.rewardedId) return envCfg.rewardedId;
  const win = typeof window !== 'undefined' ? (window as CapacitorWindow) : null;
  const platform = win?.Capacitor?.getPlatform?.() === 'ios' ? 'ios' : 'android';
  return ADMOB_UNIT_IDS[platform].rewardedCoins;
}

export function hasNativeAdMobBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as CapacitorWindow;
  return Boolean(
    win.Capacitor?.isNativePlatform?.() &&
      win.Capacitor?.Plugins?.AdMob?.prepareRewardVideoAd &&
      win.Capacitor?.Plugins?.AdMob?.showRewardVideoAd
  );
}

function mapPurposeToPlacement(purpose: AdRewardPurpose): RewardedPlacement {
  switch (purpose) {
    case 'wheel_spin':
      return 'extra_wheel_spin';
    case 'double_match_reward':
    case 'double_daily_chest':
    case 'free_coins':
    case 'free_coins_250':
      return 'double_coins';
    case 'last_chance_revive':
    case 'streak_saver':
      return 'hint';
    case 'rematch_unlock':
      return 'rematch_unlock';
    default:
      return 'energy_refill';
  }
}

class AdService {
  async showRewardedAd(
    purpose: AdRewardPurpose,
    options?: { adFreeBypass?: boolean; durationMs?: number }
  ): Promise<AdWatchResult> {
    const adUnitId = getAdUnitIdForPlatform(purpose);
    const rewardAmountCoins =
      purpose === 'free_coins_250' || purpose === 'free_coins' ? 250 : 0;
    const rewardAmountEnergy = purpose === 'energy_refill_2' ? 2 : 0;

    if (options?.adFreeBypass && purpose === 'double_match_reward') {
      return {
        completed: true,
        provider: 'vip_bypass',
        adUnitId,
        rewardAmountCoins,
        rewardAmountEnergy,
      };
    }

    // @capacitor-community/admob native plugin path (Android / iOS)
    const nativeAttempt = await showNativeRewardedAd(
      mapPurposeToPlacement(purpose),
      adUnitId
    );
    if (nativeAttempt.shown && nativeAttempt.rewarded) {
      return {
        completed: true,
        provider: 'capacitor_admob',
        adUnitId: nativeAttempt.adUnitId,
        rewardAmountCoins,
        rewardAmountEnergy,
      };
    }
    if (nativeAttempt.shown && !nativeAttempt.rewarded) {
      return {
        completed: false,
        provider: 'capacitor_admob',
        adUnitId: nativeAttempt.adUnitId,
        rewardAmountCoins: 0,
        rewardAmountEnergy: 0,
      };
    }

    if (hasNativeAdMobBridge()) {
      try {
        const win = window as CapacitorWindow;
        const admob = win.Capacitor!.Plugins!.AdMob!;
        await admob.prepareRewardVideoAd!({ adId: adUnitId });
        await admob.showRewardVideoAd!();
        return {
          completed: true,
          provider: 'capacitor_admob',
          adUnitId,
          rewardAmountCoins,
          rewardAmountEnergy,
        };
      } catch {
        // Native reklam yüklenemezse güvenli web simülasyonu devreye girer
      }
    }

    const waitMs = options?.durationMs ?? SIMULATED_AD_DURATION_MS;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    return {
      completed: true,
      provider: 'web_simulation',
      adUnitId,
      rewardAmountCoins,
      rewardAmountEnergy,
    };
  }

  async showInterstitialAd(options?: {
    adFree?: boolean;
    durationMs?: number;
  }): Promise<InterstitialAdResult> {
    const adUnitId = getInterstitialAdUnitId();

    // VIP Reklamsız kullanıcılara geçiş reklamı KESİNLİKLE gösterilmez
    if (options?.adFree) {
      return {
        shown: false,
        skippedByVip: true,
        provider: 'vip_bypass',
        adUnitId,
      };
    }

    // @capacitor-community/admob native interstitial path (Android / iOS)
    const nativeInterstitial = await showNativeInterstitialAd(adUnitId);
    if (nativeInterstitial.shown) {
      return {
        shown: true,
        skippedByVip: false,
        provider: 'capacitor_admob',
        adUnitId: nativeInterstitial.adUnitId,
      };
    }

    if (hasNativeInterstitialBridge()) {
      try {
        const win = window as CapacitorWindow;
        const admob = win.Capacitor!.Plugins!.AdMob!;
        await admob.prepareInterstitial!({ adId: adUnitId });
        await admob.showInterstitial!();
        return {
          shown: true,
          skippedByVip: false,
          provider: 'capacitor_admob',
          adUnitId,
        };
      } catch {
        // Native reklam yüklenemezse güvenli web simülasyonu devreye girer
      }
    }

    if (activeInterstitialPresenter) {
      await activeInterstitialPresenter(adUnitId);
      return {
        shown: true,
        skippedByVip: false,
        provider: 'web_simulation',
        adUnitId,
      };
    }

    const waitMs = options?.durationMs ?? SIMULATED_AD_DURATION_MS;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    return {
      shown: true,
      skippedByVip: false,
      provider: 'web_simulation',
      adUnitId,
    };
  }
}

export const adService = new AdService();

/**
 * Temiz AdMob / Simülasyon Ödüllü Reklam çağrı noktası.
 * İleride gerçek AdMob Rewarded Ad Unit ID bağlandığında tüm ekranlar bu fonksiyon üzerinden çalışır.
 */
export function showRewardedAd(
  purpose: AdRewardPurpose,
  options?: { adFreeBypass?: boolean; durationMs?: number }
): Promise<AdWatchResult> {
  return adService.showRewardedAd(purpose, options);
}

/**
 * Her 3 tamamlanan maçtan sonra (VIP Reklamsız aktif değilse) çağrılan Geçiş Reklamı fonksiyonu.
 */
export function showInterstitialAd(options?: {
  adFree?: boolean;
  durationMs?: number;
}): Promise<InterstitialAdResult> {
  return adService.showInterstitialAd(options);
}
