export type UiTheme = 'modern' | 'klasik';

export const UI_THEME_STORAGE_KEY = '321_ui_theme';

/**
 * Centralized dark football matchday palette tokens.
 */
export const MATCHDAY_THEME = {
  bgPrimary: '#080E14',
  bgSecondary: '#101B24',
  bgCard: '#14232C',
  accentPrimary: '#22C55E',
  accentDark: '#123D2B',
  textPrimary: '#F8FAFC',
  textMuted: '#94A3B8',
  danger: '#EF4444',
  countdown: '#FBBF24',
} as const;

export function loadUiTheme(): UiTheme {
  return 'modern';
}

export function saveUiTheme(_theme: UiTheme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, 'modern');
  } catch {
    // ignore storage errors
  }
}

export function applyUiTheme(_theme: UiTheme = 'modern'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', 'modern');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', MATCHDAY_THEME.bgPrimary);
  }
}
