import React from 'react';

interface BrandTitleProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MiniFootballSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 64 64"
    aria-hidden="true"
    className={`inline-block shrink-0 drop-shadow-[0_0_10px_rgba(34,211,238,0.65)] ${className}`}
  >
    <defs>
      <radialGradient id="brandBallBase" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="55%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#94a3b8" />
      </radialGradient>
      <linearGradient id="brandBallRim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="35%" stopColor="#ec4899" />
        <stop offset="70%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#facc15" />
      </linearGradient>
    </defs>
    {/* Dış Neon Parlak Çember */}
    <circle cx="32" cy="32" r="29" fill="url(#brandBallBase)" stroke="url(#brandBallRim)" strokeWidth="3.2" />
    {/* Klasik Futbol Topu Beşgenleri */}
    <polygon points="32,20 43,28 39,40 25,40 21,28" fill="#0f172a" />
    <polygon points="32,5 39,11 36,18 28,18 25,11" fill="#0f172a" />
    <polygon points="55,22 52,32 45,30 45,22 50,17" fill="#0f172a" />
    <polygon points="9,22 14,17 19,22 19,30 12,32" fill="#0f172a" />
    <polygon points="48,51 40,54 38,46 44,41 51,44" fill="#0f172a" />
    <polygon points="16,51 13,44 20,41 26,46 24,54" fill="#0f172a" />
    {/* Dikiş Bağlantıları */}
    <path
      d="M32 18 L32 20 M43 28 L45 27 M21 28 L19 27 M39 40 L41 43 M25 40 L23 43"
      stroke="#1e293b"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    {/* Üst Işık Yansıması */}
    <ellipse cx="23" cy="18" rx="7" ry="4" transform="rotate(-25 23 18)" fill="#ffffff" fillOpacity="0.45" />
  </svg>
);

export const BrandTitle: React.FC<BrandTitleProps> = ({
  size = 'lg',
  className = '',
}) => {
  const textSizeClass =
    size === 'sm'
      ? 'text-sm sm:text-base tracking-tight'
      : size === 'md'
      ? 'text-xl sm:text-2xl tracking-tight'
      : 'text-3xl sm:text-5xl tracking-tighter';

  const ballSizeClass =
    size === 'sm'
      ? 'w-3.5 h-3.5 sm:w-4 sm:h-4'
      : size === 'md'
      ? 'w-5 h-5 sm:w-6 sm:h-6'
      : 'w-7 h-7 sm:w-10 sm:h-10';

  const gapClass =
    size === 'sm' ? 'gap-1' : size === 'md' ? 'gap-1.5' : 'gap-2 sm:gap-2.5';

  return (
    <span
      data-testid={`brand-title-${size}`}
      aria-label="3-2-1 FUTBOL"
      className={`inline-flex items-center justify-center font-black uppercase select-none leading-none whitespace-nowrap ${textSizeClass} ${gapClass} ${className}`}
    >
      <span className="brand-gradient-text drop-shadow-[0_0_16px_rgba(168,85,247,0.45)]">
        3-2-1
      </span>
      <span className="inline-flex items-center">
        <span className="brand-gradient-text drop-shadow-[0_0_16px_rgba(236,72,153,0.45)]">
          FUTB
        </span>
        <span className="inline-flex items-center mx-[1px]">
          <span className="brand-ball-bounce-a inline-flex items-center justify-center">
            <MiniFootballSvg className={ballSizeClass} />
          </span>
        </span>
        <span className="brand-gradient-text drop-shadow-[0_0_16px_rgba(34,211,238,0.45)]">
          L
        </span>
      </span>
    </span>
  );
};
