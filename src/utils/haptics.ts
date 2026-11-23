/**
 * Lightweight tactile haptic feedback helper using the Web Vibration API (`navigator.vibrate`).
 * Safely degrades to a no-op on desktop browsers or devices without vibration support.
 */

export type HapticFeedbackType = 'correct' | 'wrong' | 'tap';

export const HAPTIC_PATTERNS: Record<HapticFeedbackType, number | number[]> = {
  // Subtle crisp double-tap for correct answers
  correct: [15, 30, 22],
  // Light, gentle double-buzz for wrong answers or lost rounds
  wrong: [35, 35, 40],
  // Subtle single pulse for UI button taps
  tap: 10,
};

export interface NavigatorWithVibrate {
  vibrate?: (pattern: number | number[]) => boolean;
}

export function getHapticPattern(type: HapticFeedbackType): number | number[] {
  const pattern = HAPTIC_PATTERNS[type];
  return Array.isArray(pattern) ? [...pattern] : pattern;
}

export function triggerHaptic(
  type: HapticFeedbackType,
  nav: NavigatorWithVibrate | undefined =
    typeof navigator !== 'undefined' ? (navigator as NavigatorWithVibrate) : undefined
): boolean {
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
  tap: (nav?: NavigatorWithVibrate): boolean => triggerHaptic('tap', nav),
};
