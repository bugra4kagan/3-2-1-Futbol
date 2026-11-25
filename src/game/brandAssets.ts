import brandLogoUrl from '../assets/brand-logo.jpg';

export type GameLogoVariant = 'full' | 'compact' | 'icon';

/**
 * Reusable central brand logo asset.
 * Swapping `src/assets/brand-logo.jpg` (and `public/logo.jpg`) updates all logo variants in sync.
 */
export const BRAND_LOGO_SRC = brandLogoUrl;
export const BRAND_PUBLIC_LOGO_PATH = './logo.jpg';
export const BRAND_LOGO_ALT = '3-2-1 Futbol: Online Düello Logosu';
