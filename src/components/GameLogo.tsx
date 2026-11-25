import React, { useId } from 'react';

interface GameLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-28 h-28 sm:w-32 sm:h-32',
  xl: 'w-44 h-44 sm:w-56 sm:h-56',
} as const;

/**
 * Bundled transparent vector crest logo for 3-2-1 FUTBOL.
 * Immune to network errors, asset path issues, and resolution scaling across Web and Android.
 */
export const GameLogo: React.FC<GameLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const shieldGrad = `shield-${uid}`;
  const goldRim = `rim-${uid}`;
  const ribbonGrad = `ribbon-${uid}`;

  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      role="img"
      aria-label="3-2-1 Futbol Logosu"
      data-testid={`game-logo-${size}`}
      className={`inline-block shrink-0 select-none ${SIZE_MAP[size]} ${className}`}
    >
      <defs>
        <linearGradient id={shieldGrad} x1="36" y1="20" x2="220" y2="236" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#168A52" />
          <stop offset="58%" stopColor="#183D2B" />
          <stop offset="100%" stopColor="#0B1220" />
        </linearGradient>
        <linearGradient id={goldRim} x1="28" y1="16" x2="228" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E5B94F" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#E5B94F" />
        </linearGradient>
        <linearGradient id={ribbonGrad} x1="22" y1="154" x2="234" y2="196" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="50%" stopColor="#E5B94F" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>

      {/* Outer Shield with Transparent Outer Backdrop */}
      <path
        d="M128 14L220 44V116C220 175 180 218 128 242C76 218 36 175 36 116V44L128 14Z"
        fill={`url(#${shieldGrad})`}
        stroke={`url(#${goldRim})`}
        strokeWidth="8.5"
        strokeLinejoin="round"
      />
      <path
        d="M128 28L206 53V115C206 165 172 203 128 225C84 203 50 165 50 115V53L128 28Z"
        stroke="#F5F3EB"
        strokeOpacity="0.22"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Subtle Center Turf Stripe */}
      <path d="M104 38H152V182H104V38Z" fill="#22C55E" fillOpacity="0.11" />

      {/* 3-2-1 Sport Header inside Shield */}
      <text
        x="128"
        y="88"
        textAnchor="middle"
        fill="#E5B94F"
        fontFamily="'Barlow Condensed', 'Inter', Arial, sans-serif"
        fontWeight="800"
        fontSize="49"
        letterSpacing="2"
      >
        3-2-1
      </text>

      {/* Classic White/Black Football */}
      <circle cx="128" cy="125" r="24" fill="#FFFFFF" stroke="#0B1220" strokeWidth="3.5" />
      <polygon points="128,112 140,120 135,134 121,134 116,120" fill="#0B1220" />
      <polygon points="128,102 135,107 132,112 124,112 121,107" fill="#0B1220" />
      <polygon points="148,116 145,126 140,123 140,116 144,112" fill="#0B1220" />
      <polygon points="108,116 112,112 116,116 116,123 111,126" fill="#0B1220" />
      <polygon points="141,142 134,145 133,138 138,134 144,136" fill="#0B1220" />
      <polygon points="115,142 112,136 118,134 123,138 122,145" fill="#0B1220" />
      <path
        d="M128 110V112M140 120H142M116 120H114M135 134L137 137M121 134L119 137"
        stroke="#0B1220"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Orange/Gold-Trimmed Ribbon Banner: FUTBOL */}
      <path
        d="M26 154H230L218 192H38L26 154Z"
        fill="#0B1220"
        stroke={`url(#${ribbonGrad})`}
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <text
        x="128"
        y="183"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="'Barlow Condensed', 'Inter', Arial, sans-serif"
        fontWeight="800"
        fontSize="33"
        letterSpacing="4"
      >
        FUTBOL
      </text>

      {/* Bottom Gold Star Accent */}
      <polygon
        points="128,201 132,209 141,210 134,216 136,225 128,220 120,225 122,216 115,210 124,209"
        fill="#E5B94F"
      />
    </svg>
  );
};

/**
 * Play Store Adaptive Launcher Icon Preview Card (visual preview only — does not alter Android mipmaps).
 */
export const GameLogoAppIconPreview: React.FC = () => (
  <div
    data-testid="app-icon-preview"
    className="inline-flex items-center gap-3 p-3 rounded-2xl bg-[#16212E] border border-[#E5B94F]/40"
  >
    <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-[#0B1220] via-[#183D2B] to-[#0B1220] border-2 border-[#E5B94F]/70 flex items-center justify-center shadow-lg shrink-0 p-1">
      <GameLogo size="sm" className="!w-11 !h-11" />
    </div>
    <div className="text-left min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#E5B94F]">
        Uygulama İkonu Önizleme
      </span>
      <span className="block text-xs font-bold text-[#F5F3EB] truncate">
        3-2-1 Futbol: Online Düello
      </span>
    </div>
  </div>
);
