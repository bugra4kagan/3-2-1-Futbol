import React, { useId } from 'react';

interface NightMatchPitchBackgroundProps {
  theme?: string;
}

interface PitchPalette {
  skyTop: string;
  turfDark: string;
  turfMid: string;
  stripeA: string;
  stripeB: string;
  glowPrimary: string;
  glowSecondary: string;
  lineColor: string;
  lineGlow: string;
  floodlightColor: string;
}

function resolvePitchPalette(_theme?: string): PitchPalette {
  // Unified dark football stadium night pitch (#080E14, #101B24, #123D2B, #22C55E)
  return {
    skyTop: '#080E14',
    turfDark: '#0C1720',
    turfMid: '#123D2B',
    stripeA: 'rgba(34, 197, 94, 0.08)',
    stripeB: 'rgba(16, 27, 36, 0.25)',
    glowPrimary: 'rgba(34, 197, 94, 0.16)',
    glowSecondary: 'rgba(18, 61, 43, 0.24)',
    lineColor: 'rgba(248, 250, 252, 0.42)',
    lineGlow: 'rgba(34, 197, 94, 0.38)',
    floodlightColor: 'rgba(248, 250, 252, 0.10)',
  };
}

export const NightMatchPitchBackground: React.FC<NightMatchPitchBackgroundProps> = ({ theme }) => {
  const uid = useId().replace(/:/g, '');
  const palette = resolvePitchPalette(theme);

  return (
    <div
      data-testid="night-match-pitch-bg"
      data-pitch-theme={theme || 'default'}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, ${palette.turfMid} 0%, ${palette.turfDark} 55%, ${palette.skyTop} 100%)`,
      }}
    >
      {/* Stadium Floodlight Cones from Top Left & Top Right + Neon Esports Backlight */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            `radial-gradient(circle at 12% -6%, ${palette.floodlightColor} 0%, transparent 46%)`,
            `radial-gradient(circle at 88% -6%, ${palette.floodlightColor} 0%, transparent 46%)`,
            `radial-gradient(ellipse at 25% 55%, ${palette.glowPrimary} 0%, transparent 55%)`,
            `radial-gradient(ellipse at 75% 45%, ${palette.glowSecondary} 0%, transparent 55%)`,
          ].join(','),
        }}
      />

      {/* Full-Screen Stadium Pitch & Glowing Lines (Top-Down / Slight Perspective Esports Turf) */}
      <svg
        viewBox="0 0 1000 1600"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full opacity-85"
      >
        <defs>
          <linearGradient id={`turf-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.skyTop} stopOpacity="0.95" />
            <stop offset="28%" stopColor={palette.turfMid} stopOpacity="0.92" />
            <stop offset="50%" stopColor={palette.turfDark} stopOpacity="0.95" />
            <stop offset="72%" stopColor={palette.turfMid} stopOpacity="0.92" />
            <stop offset="100%" stopColor={palette.skyTop} stopOpacity="0.98" />
          </linearGradient>

          <pattern
            id={`stripes-${uid}`}
            width="1000"
            height="140"
            patternUnits="userSpaceOnUse"
          >
            <rect x="0" y="0" width="1000" height="70" fill={palette.stripeA} />
            <rect x="0" y="70" width="1000" height="70" fill={palette.stripeB} />
          </pattern>

          <pattern
            id={`grid-${uid}`}
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="rgba(148, 163, 184, 0.05)"
              strokeWidth="1"
            />
          </pattern>

          <filter id={`neon-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id={`center-aura-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.lineGlow} stopOpacity="0.22" />
            <stop offset="65%" stopColor={palette.glowSecondary} stopOpacity="0.08" />
            <stop offset="100%" stopColor={palette.skyTop} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Stadium Base + Mowed Grass Stripes + Subtle Esports Micro-Grid */}
        <rect x="0" y="0" width="1000" height="1600" fill={`url(#turf-${uid})`} />
        <rect x="0" y="0" width="1000" height="1600" fill={`url(#stripes-${uid})`} />
        <rect x="0" y="0" width="1000" height="1600" fill={`url(#grid-${uid})`} />

        {/* Center Pitch Neon Glow Disc */}
        <circle cx="500" cy="800" r="280" fill={`url(#center-aura-${uid})`} />

        {/* Glowing Pitch Markings */}
        <g
          fill="none"
          stroke={palette.lineColor}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#neon-${uid})`}
        >
          {/* Outer Touchline & Goal Lines */}
          <rect x="75" y="75" width="850" height="1450" rx="6" />

          {/* Halfway Line */}
          <line x1="75" y1="800" x2="925" y2="800" />

          {/* Center Circle + Inner Esports Halo + Kickoff Spot */}
          <circle cx="500" cy="800" r="145" />
          <circle
            cx="500"
            cy="800"
            r="158"
            stroke={palette.lineGlow}
            strokeWidth="1.2"
            strokeDasharray="10 12"
            opacity="0.7"
          />
          <circle cx="500" cy="800" r="7" fill={palette.lineColor} stroke="none" />

          {/* Top Penalty Area (18-yard) & 6-yard Box */}
          <rect x="245" y="75" width="510" height="225" />
          <rect x="370" y="75" width="260" height="86" />
          {/* Top Goal Net Frame */}
          <rect x="432" y="47" width="136" height="28" strokeOpacity="0.65" strokeWidth="2.5" />
          {/* Top Penalty Spot & Arc */}
          <circle cx="500" cy="218" r="5.5" fill={palette.lineColor} stroke="none" />
          <path d="M 402 300 A 118 118 0 0 0 598 300" />

          {/* Bottom Penalty Area (18-yard) & 6-yard Box */}
          <rect x="245" y="1300" width="510" height="225" />
          <rect x="370" y="1439" width="260" height="86" />
          {/* Bottom Goal Net Frame */}
          <rect x="432" y="1525" width="136" height="28" strokeOpacity="0.65" strokeWidth="2.5" />
          {/* Bottom Penalty Spot & Arc */}
          <circle cx="500" cy="1382" r="5.5" fill={palette.lineColor} stroke="none" />
          <path d="M 402 1300 A 118 118 0 0 1 598 1300" />

          {/* Four Corner Quadrant Arcs */}
          <path d="M 75 108 A 33 33 0 0 0 108 75" />
          <path d="M 892 75 A 33 33 0 0 0 925 108" />
          <path d="M 75 1492 A 33 33 0 0 1 108 1525" />
          <path d="M 892 1525 A 33 33 0 0 1 925 1492" />
        </g>

        {/* Stadium Floodlight Fixtures at Top Corners */}
        <g opacity="0.55">
          <circle cx="65" cy="40" r="18" fill={palette.floodlightColor} />
          <circle cx="935" cy="40" r="18" fill={palette.floodlightColor} />
        </g>

        {/* Snowfall Flakes Accent for Winter Pitch */}
        {theme === 'winter_snow' && (
          <g fill="#f0f9ff" opacity="0.45">
            <circle cx="140" cy="210" r="3" />
            <circle cx="290" cy="390" r="2.2" />
            <circle cx="430" cy="180" r="2.5" />
            <circle cx="610" cy="310" r="3.2" />
            <circle cx="790" cy="220" r="2.6" />
            <circle cx="860" cy="520" r="2.8" />
            <circle cx="190" cy="640" r="2.4" />
            <circle cx="360" cy="760" r="3" />
            <circle cx="690" cy="690" r="2.5" />
            <circle cx="240" cy="980" r="3" />
            <circle cx="540" cy="1090" r="2.4" />
            <circle cx="770" cy="1180" r="3.1" />
            <circle cx="160" cy="1340" r="2.5" />
            <circle cx="840" cy="1390" r="2.8" />
          </g>
        )}

        {/* Royal Championship Crest Shimmer for Final Stadium */}
        {theme === 'final_stadium' && (
          <g stroke="rgba(253, 224, 71, 0.35)" fill="none" strokeWidth="1.5">
            <circle cx="500" cy="800" r="185" strokeDasharray="6 10" />
            <polygon points="500,765 510,790 536,790 515,805 523,830 500,815 477,830 485,805 464,790 490,790" fill="rgba(250, 204, 21, 0.14)" stroke="rgba(250, 204, 21, 0.45)" />
          </g>
        )}
      </svg>

      {/* Dark Semi-Transparent Overlay Scrim & Vignette for High Contrast Card/Text Readability */}
      <div
        className="absolute inset-0 bg-slate-950/48"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 50% 45%, rgba(2, 6, 23, 0.25) 0%, rgba(2, 6, 23, 0.72) 100%)',
        }}
      />
    </div>
  );
};
