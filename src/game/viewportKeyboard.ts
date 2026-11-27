export interface ViewportKeyboardInput {
  visualHeight?: number | null;
  innerHeight?: number | null;
  visualWidth?: number | null;
  innerWidth?: number | null;
  baselineHeight?: number | null;
  isInputFocused?: boolean;
}

export interface ViewportKeyboardMetrics {
  viewportHeight: number;
  viewportWidth: number;
  baselineHeight: number;
  isKeyboardOpen: boolean;
  isCompactHeight: boolean;
  isUltraCompactHeight: boolean;
}

const KEYBOARD_HEIGHT_DROP_THRESHOLD_PX = 120;
const COMPACT_MATCH_HEIGHT_PX = 660;
const ULTRA_COMPACT_MATCH_HEIGHT_PX = 520;
const KEYBOARD_FOCUSED_HEIGHT_PX = 580;

/**
 * Computes consistent portrait match viewport height & virtual-keyboard open state from browser/WebView dimensions
 * without double-subtracting keyboard height. Layout always remains portrait/vertical across all screen sizes.
 */
export function computeMatchKeyboardMetrics(
  input: ViewportKeyboardInput
): ViewportKeyboardMetrics {
  const rawHeight =
    typeof input.visualHeight === 'number' && Number.isFinite(input.visualHeight) && input.visualHeight > 0
      ? input.visualHeight
      : typeof input.innerHeight === 'number' && Number.isFinite(input.innerHeight) && input.innerHeight > 0
      ? input.innerHeight
      : 844;

  const rawWidth =
    typeof input.visualWidth === 'number' && Number.isFinite(input.visualWidth) && input.visualWidth > 0
      ? input.visualWidth
      : typeof input.innerWidth === 'number' && Number.isFinite(input.innerWidth) && input.innerWidth > 0
      ? input.innerWidth
      : 390;

  const viewportHeight = Math.max(240, Math.round(rawHeight));
  const viewportWidth = Math.max(240, Math.round(rawWidth));

  const prevBaseline =
    typeof input.baselineHeight === 'number' &&
    Number.isFinite(input.baselineHeight) &&
    input.baselineHeight > 0
      ? Math.round(input.baselineHeight)
      : viewportHeight;

  const baselineHeight = Math.max(prevBaseline, viewportHeight);
  const heightDrop = baselineHeight - viewportHeight;

  const isKeyboardOpen =
    heightDrop >= KEYBOARD_HEIGHT_DROP_THRESHOLD_PX ||
    Boolean(input.isInputFocused && viewportHeight <= KEYBOARD_FOCUSED_HEIGHT_PX);

  const isCompactHeight = isKeyboardOpen || viewportHeight < COMPACT_MATCH_HEIGHT_PX;
  const isUltraCompactHeight = viewportHeight < ULTRA_COMPACT_MATCH_HEIGHT_PX;

  return {
    viewportHeight,
    viewportWidth,
    baselineHeight,
    isKeyboardOpen,
    isCompactHeight,
    isUltraCompactHeight,
  };
}
