import React from 'react';

interface BrandTitleProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SportFootballSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 64 64"
    aria-hidden="true"
    className={`inline-block shrink-0 ${className}`}
  >
    <circle cx="32" cy="32" r="28" fill="#FFFFFF" stroke="#0B1220" strokeWidth="4" />
    <polygon points="32,20 43,28 39,40 25,40 21,28" fill="#0B1220" />
    <polygon points="32,6 39,12 36,18 28,18 25,12" fill="#0B1220" />
    <polygon points="54,23 51,32 45,30 45,22 50,18" fill="#0B1220" />
    <polygon points="10,23 14,18 19,22 19,30 13,32" fill="#0B1220" />
    <polygon points="48,50 40,53 38,46 44,41 51,44" fill="#0B1220" />
    <polygon points="16,50 13,44 20,41 26,46 24,53" fill="#0B1220" />
    <path
      d="M32 18 L32 20 M43 28 L45 27 M21 28 L19 27 M39 40 L41 43 M25 40 L23 43"
      stroke="#16212E"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);

export const BrandTitle: React.FC<BrandTitleProps> = ({
  size = 'lg',
  className = '',
}) => {
  const textSizeClass =
    size === 'sm'
      ? 'text-lg sm:text-xl tracking-wide'
      : size === 'md'
      ? 'text-2xl sm:text-3xl tracking-wide'
      : 'text-4xl sm:text-5xl tracking-wide';

  const ballSizeClass =
    size === 'sm'
      ? 'w-3.5 h-3.5 sm:w-4 sm:h-4'
      : size === 'md'
      ? 'w-5 h-5 sm:w-6 sm:h-6'
      : 'w-7 h-7 sm:w-9 sm:h-9';

  const gapClass =
    size === 'sm' ? 'gap-1.5' : size === 'md' ? 'gap-2' : 'gap-2 sm:gap-2.5';

  return (
    <span
      data-testid={`brand-title-${size}`}
      aria-label="3-2-1 FUTBOL"
      className={`font-display inline-flex items-center justify-center font-extrabold uppercase select-none leading-none whitespace-nowrap ${textSizeClass} ${gapClass} ${className}`}
    >
      <span className="text-[#E5B94F]">3-2-1</span>
      <span className="inline-flex items-center text-[#FFFFFF]">
        <span>FUTB</span>
        <span className="inline-flex items-center mx-[1.5px]">
          <SportFootballSvg className={ballSizeClass} />
        </span>
        <span>L</span>
      </span>
    </span>
  );
};
