export type UiTheme = 'modern' | 'klasik';

export const UI_THEME_STORAGE_KEY = '321_ui_theme';

export function loadUiTheme(): UiTheme {
  if (typeof window === 'undefined') return 'modern';
  try {
    const raw = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
    return raw === 'klasik' ? 'klasik' : 'modern';
  } catch {
    return 'modern';
  }
}

export function saveUiTheme(theme: UiTheme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

export function applyUiTheme(theme: UiTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', theme === 'klasik' ? '#14532d' : '#020617');
  }
}
