import React from 'react';
import {
  BRAND_LOGO_ALT,
  BRAND_LOGO_SRC,
  GameLogoVariant,
} from '../game/brandAssets';

interface GameLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: GameLogoVariant;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<GameLogoProps['size']>, string> = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-28 h-28 sm:w-32 sm:h-32',
  xl: 'w-40 h-40 sm:w-48 sm:h-48',
};

const VARIANT_CLASSES: Record<GameLogoVariant, string> = {
  full: 'rounded-3xl border-2 border-[#E5B94F]/85 shadow-xl ring-1 ring-[#F5F3EB]/20',
  compact: 'rounded-xl border border-[#E5B94F]/75 shadow-md',
  icon: 'rounded-2xl border-2 border-[#E5B94F]/85 shadow-md',
};

/**
 * Reusable logo component bound to the official 3-2-1 Futbol artwork (`brand-logo.webp`).
 * Supports full, compact header, and app-icon variants with crisp 1:1 aspect ratio and zero clipping.
 */
export const GameLogo: React.FC<GameLogoProps> = ({
  size = 'md',
  variant = size === 'xs' || size === 'sm' ? 'compact' : 'full',
  className = '',
}) => {
  return (
    <div
      data-testid={`game-logo-${size}`}
      data-logo-variant={variant}
      className={`relative inline-flex items-center justify-center shrink-0 aspect-square overflow-hidden select-none bg-[#011837] ${SIZE_MAP[size]} ${VARIANT_CLASSES[variant]} ${className}`}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt={BRAND_LOGO_ALT}
        decoding="async"
        draggable={false}
        className="w-full h-full object-contain object-center block"
      />
    </div>
  );
};

export const GameLogoAppIconPreview: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div className={`inline-flex items-center gap-3 ${className}`}>
    <div
      data-testid="app-icon-preview"
      className="w-16 h-16 rounded-2xl bg-[#011837] border-2 border-[#E5B94F]/85 shadow-lg flex items-center justify-center overflow-hidden shrink-0 aspect-square"
    >
      <img
        src={BRAND_LOGO_SRC}
        alt={BRAND_LOGO_ALT}
        decoding="async"
        draggable={false}
        className="w-full h-full object-contain object-center block"
      />
    </div>
    <div className="min-w-0 text-left">
      <span className="block text-xs font-black uppercase tracking-wider text-[#E5B94F]">
        Uygulama İkonu Önizleme
      </span>
      <span className="block text-xs font-bold text-[#F5F3EB]">
        3-2-1 Futbol: Online Düello
      </span>
    </div>
  </div>
);
