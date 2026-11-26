/**
 * Lightweight tactile haptic feedback helper.
 * Uses native Capacitor Haptics when installed on Android/iOS, falling back
 * smoothly to the Web Vibration API (`navigator.vibrate`). Safely degrades to
 * a no-op on desktop browsers or unsupported devices, and strictly respects
 * the user's persisted toggle (`321_haptics_enabled`).
 */

export type HapticFeedbackType = 'correct' | 'wrong' | 'victory' | 'countdown' | 'tap';

export const HAPTICS_PREF_STORAGE_KEY = '321_haptics_enabled';

export const HAPTIC_PATTERNS: Record<HapticFeedbackType, number | number[]> = {
  // Subtle crisp double-tap for correct answers
  correct: [15, 28, 22],
  // Light, distinct short double-buzz for wrong answers
  wrong: [35, 32, 38],
  // Short celebratory double-tap on match win
  victory: [18, 36, 18, 36, 28],
  // Gentle single tick at start of 3-2-1 countdown
  countdown: [14],
  // Subtle single pulse for UI taps
  tap: 10,
};

export interface NavigatorWithVibrate {
  vibrate?: (pattern: number | number[]) => boolean;
}

let inMemoryHapticsEnabled: boolean | null = null;

function getSafeStorage(): Storage | undefined {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as { localStorage?: Storage }).localStorage) {
    return (globalThis as { localStorage?: Storage }).localStorage;
  }
  return undefined;
}

export function isHapticsEnabled(): boolean {
  if (inMemoryHapticsEnabled !== null) return inMemoryHapticsEnabled;
  try {
    const raw = getSafeStorage()?.getItem(HAPTICS_PREF_STORAGE_KEY);
    if (raw === 'false') {
      inMemoryHapticsEnabled = false;
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  inMemoryHapticsEnabled = Boolean(enabled);
  try {
    getSafeStorage()?.setItem(HAPTICS_PREF_STORAGE_KEY, String(inMemoryHapticsEnabled));
  } catch {
    // ignore storage errors
  }
}

export function getHapticPattern(type: HapticFeedbackType): number | number[] {
  const pattern = HAPTIC_PATTERNS[type];
  return Array.isArray(pattern) ? [...pattern] : pattern;
}

function tryCapacitorNativeHaptic(type: HapticFeedbackType): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const win = window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: {
          Haptics?: {
            impact?: (opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>;
            notification?: (opts: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>;
            vibrate?: (opts: { duration: number }) => Promise<void>;
          };
        };
      };
    };
    if (!win.Capacitor?.isNativePlatform?.()) return false;
    const plugin = win.Capacitor.Plugins?.Haptics;
    if (!plugin) return false;

    if (type === 'victory' && plugin.notification) {
      void plugin.notification({ type: 'SUCCESS' }).catch(() => {});
      return true;
    }
    if (type === 'wrong' && plugin.notification) {
      void plugin.notification({ type: 'ERROR' }).catch(() => {});
      return true;
    }
    if (type === 'correct' && plugin.impact) {
      void plugin.impact({ style: 'MEDIUM' }).catch(() => {});
      return true;
    }
    if ((type === 'countdown' || type === 'tap') && plugin.impact) {
      void plugin.impact({ style: 'LIGHT' }).catch(() => {});
      return true;
    }
  } catch {
    // fallback to navigator.vibrate
  }
  return false;
}

export function triggerHaptic(
  type: HapticFeedbackType,
  nav: NavigatorWithVibrate | undefined =
    typeof navigator !== 'undefined' ? (navigator as NavigatorWithVibrate) : undefined
): boolean {
  if (!isHapticsEnabled()) {
    return false;
  }

  if (tryCapacitorNativeHaptic(type)) {
    return true;
  }

  if (!nav || typeof nav.vibrate !== 'function') {
    return false;
  }

  try {
    return Boolean(nav.vibrate(getHapticPattern(type)));
  } catch {
    return false;
  }
}

export const haptics = {
  correct: (nav?: NavigatorWithVibrate): boolean => triggerHaptic('correct', nav),
  wrong: (nav?: NavigatorWithVibrate): boolean => triggerHaptic('wrong', nav),
  victory: (nav?: NavigatorWithVibrate): boolean => triggerHaptic('victory', nav),
  countdown: (nav?: NavigatorWithVibrate): boolean => triggerHaptic('countdown', nav),
  tap: (nav?: NavigatorWithVibrate): boolean => triggerHaptic('tap', nav),
};
