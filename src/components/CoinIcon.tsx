import React from 'react';

interface CoinIconProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<CoinIconProps['size']>, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

/**
 * Reusable crisp gold coin SVG with subtle 3D rim and embossed star/football emblem.
 */
export const CoinIcon: React.FC<CoinIconProps> = ({
  className = '',
  size = 'sm',
}) => {
  const sizeClass = SIZE_CLASSES[size];
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`inline-block shrink-0 ${sizeClass} ${className}`}
    >
      {/* Outer shaded 3D rim */}
      <circle cx="16" cy="17" r="13.5" fill="#B45309" />
      {/* Gold coin body */}
      <circle cx="16" cy="15.5" r="13.5" fill="#F59E0B" stroke="#FDE68A" strokeWidth="1.6" />
      {/* Inner recessed coin ring */}
      <circle cx="16" cy="15.5" r="10.2" fill="#FBBF24" stroke="#D97706" strokeWidth="1.3" />
      {/* Specular shine */}
      <path
        d="M9.5 10.5C11.2 8.1 13.7 7 16.5 7"
        stroke="#FEF3C7"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Embossed star emblem */}
      <path
        d="M16 9.3L17.9 13.1L22.1 13.7L19.05 16.65L19.75 20.85L16 18.85L12.25 20.85L12.95 16.65L9.9 13.7L14.1 13.1L16 9.3Z"
        fill="#FFFBEB"
        stroke="#B45309"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
};
