import React, { useId } from 'react';
import { Club } from '../game/types';
import { BadgeShape, resolveClubBadgeMeta } from '../game/clubBadgeCatalog';

export interface ClubBadgeProps {
  club?: Club | null;
  clubId?: string;
  clubName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return 0.3;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function darkenHex(hex: string, factor = 0.58): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return '#0f172a';
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

function getShapePaths(shape: BadgeShape): { outer: string; recess: string; inner: string } {
  switch (shape) {
    case 'circle':
      return {
        outer: 'M 60 12 A 54 54 0 1 1 59.9 12 Z',
        recess: 'M 60 15.5 A 50.5 50.5 0 1 1 59.9 15.5 Z',
        inner: 'M 60 18.5 A 47.5 47.5 0 1 1 59.9 18.5 Z',
      };
    case 'oval':
      return {
        outer: 'M 60 10 C 90 10 106 34 106 69 C 106 104 90 128 60 128 C 30 128 14 104 14 69 C 14 34 30 10 60 10 Z',
        recess: 'M 60 13.5 C 87 13.5 102.5 36 102.5 69 C 102.5 102 87 124.5 60 124.5 C 33 124.5 17.5 102 17.5 69 C 17.5 36 33 13.5 60 13.5 Z',
        inner: 'M 60 17 C 84 17 99 38 99 69 C 99 100 84 121 60 121 C 36 121 21 100 21 69 C 21 38 36 17 60 17 Z',
      };
    case 'hex':
      return {
        outer: 'M 60 10 L 108 36 L 108 98 L 60 128 L 12 98 L 12 36 Z',
        recess: 'M 60 14 L 104 38 L 104 96 L 60 124 L 16 96 L 16 38 Z',
        inner: 'M 60 18 L 100 40 L 100 94 L 60 120 L 20 94 L 20 40 Z',
      };
    case 'diamond':
      return {
        outer: 'M 60 8 L 112 69 L 60 130 L 8 69 Z',
        recess: 'M 60 13 L 107 69 L 60 125 L 13 69 Z',
        inner: 'M 60 18 L 102 69 L 60 120 L 18 69 Z',
      };
    case 'banner':
      return {
        outer: 'M 14 16 L 106 16 L 106 80 C 106 105 84 123 60 132 C 36 123 14 105 14 80 Z',
        recess: 'M 17.5 19.5 L 102.5 19.5 L 102.5 79.5 C 102.5 102 82 119 60 127.5 C 38 119 17.5 102 17.5 79.5 Z',
        inner: 'M 21 23 L 99 23 L 99 79 C 99 99 80 115 60 123 C 40 115 21 99 21 79 Z',
      };
    case 'shield':
    default:
      return {
        outer: 'M10 19 L60 9 L110 19 L110 71 C110 101 84 123 60 133 C36 123 10 101 10 71 Z',
        recess: 'M13.5 21.5 L60 12 L106.5 21.5 L106.5 70.5 C106.5 98.5 82.5 119 60 128.5 C37.5 119 13.5 98.5 13.5 70.5 Z',
        inner: 'M17 24 L60 15 L103 24 L103 70 C103 96 81 116 60 125 C39 116 17 96 17 70 Z',
      };
  }
}

export const ClubBadge: React.FC<ClubBadgeProps> = ({
  club = null,
  clubId,
  clubName,
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const meta = resolveClubBadgeMeta(clubId || club?.id, clubName || club?.name, club);

  const sizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-10 h-10 sm:w-11 sm:h-11',
    md: 'w-14 h-14 sm:w-16 sm:h-16',
    lg: 'w-20 h-20 sm:w-28 sm:h-28',
    xl: 'w-28 h-28 sm:w-36 sm:h-36',
  };

  const primary = meta.primaryColor || '#1e293b';
  const secondary = meta.secondaryColor || '#06b6d4';
  const accent = meta.accentColor || '#facc15';
  const primaryDark = darkenHex(primary, 0.55);
  const isLightPrimary = hexLuminance(primary) > 0.68;
  const isLightSecondary = hexLuminance(secondary) > 0.68;

  const textFill = isLightPrimary && isLightSecondary ? '#0f172a' : '#ffffff';
  const plateFill = isLightPrimary ? 'rgba(15, 23, 42, 0.88)' : 'rgba(9, 13, 22, 0.78)';
  const shapes = getShapePaths(meta.shape);

  const monogram = meta.monogram.slice(0, 4);
  const fontSize =
    monogram.length <= 2
      ? 31
      : monogram.length === 3
      ? 24
      : 19;

  const monogramY = meta.shape === 'diamond' ? 71 : 69;

  return (
    <div
      data-testid="club-badge"
      data-badge-shape={meta.shape}
      data-badge-pattern={meta.pattern}
      title={`${meta.name}${meta.country ? ` (${meta.country})` : ''}`}
      className={`relative inline-flex items-center justify-center shrink-0 select-none transition-transform duration-200 ${
        size === 'xs' ? '' : 'hover:scale-105'
      } ${sizeMap[size]} ${className}`}
    >
      <svg
        viewBox="0 0 120 138"
        className="w-full h-full overflow-visible"
        role="img"
        aria-label={`${meta.name} kulüp rozeti`}
      >
        <defs>
          <filter id={`cb-shadow-${uid}`} x="-20%" y="-20%" width="140%" height="145%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#020617" floodOpacity="0.72" />
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={primary} floodOpacity="0.32" />
          </filter>

          <filter id={`cb-text-shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.4" floodColor="#020617" floodOpacity="0.95" />
          </filter>

          <linearGradient id={`cb-bevel-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="30%" stopColor="#94a3b8" />
            <stop offset="52%" stopColor="#e2e8f0" />
            <stop offset="78%" stopColor="#475569" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <linearGradient id={`cb-rim-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={secondary} stopOpacity="0.95" />
            <stop offset="50%" stopColor="#f8fafc" stopOpacity="0.85" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id={`cb-bg-${uid}`} x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor={primary} />
            <stop offset="58%" stopColor={primary} />
            <stop offset="100%" stopColor={primaryDark} />
          </linearGradient>

          <linearGradient id={`cb-gloss-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <clipPath id={`cb-clip-${uid}`}>
            <path d={shapes.inner} />
          </clipPath>
        </defs>

        <g filter={`url(#cb-shadow-${uid})`}>
          {/* Top Emblem: Crown or Stars */}
          {meta.emblem === 'crown' && (
            <g transform="translate(0, -2)">
              <polygon
                points="42,16 45,5 53,11 60,3 67,11 75,5 78,16"
                fill="#facc15"
                stroke="#090d16"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <rect x="42" y="15" width="36" height="3.5" rx="1.5" fill="#eab308" stroke="#090d16" strokeWidth="1" />
            </g>
          )}
          {meta.emblem === 'stars' && (
            <g fill="#facc15" stroke="#090d16" strokeWidth="0.9">
              <polygon points="44,9 45.4,12 48.6,12.4 46.2,14.5 46.8,17.6 44,16 41.2,17.6 41.8,14.5 39.4,12.4 42.6,12" />
              <polygon points="60,5 61.6,8.4 65.2,8.8 62.5,11.2 63.2,14.8 60,13 56.8,14.8 57.5,11.2 54.8,8.8 58.4,8.4" />
              <polygon points="76,9 77.4,12 80.6,12.4 78.2,14.5 78.8,17.6 76,16 73.2,17.6 73.8,14.5 71.4,12.4 74.6,12" />
            </g>
          )}
          {meta.emblem === 'laurel' && (
            <g fill="none" stroke="#facc15" strokeWidth="2.4" strokeLinecap="round" opacity="0.95">
              <path d="M 32 104 Q 14 78 24 44" />
              <path d="M 88 104 Q 106 78 96 44" />
            </g>
          )}

          {/* Outer 3D metallic crest shell */}
          <path
            d={shapes.outer}
            fill={`url(#cb-bevel-${uid})`}
            stroke={`url(#cb-rim-${uid})`}
            strokeWidth="1.8"
          />

          {/* Recessed dark metallic frame */}
          <path d={shapes.recess} fill="#090d16" />

          {/* Distinct Heraldic Pattern Inside Crest */}
          <g clipPath={`url(#cb-clip-${uid})`}>
            <rect x="6" y="6" width="108" height="128" fill={`url(#cb-bg-${uid})`} />

            {meta.pattern === 'vertical-stripes' && (
              <g>
                <rect x="20" y="6" width="14" height="128" fill={secondary} />
                <rect x="52" y="6" width="16" height="128" fill={secondary} />
                <rect x="86" y="6" width="14" height="128" fill={secondary} />
              </g>
            )}

            {meta.pattern === 'halves' && (
              <rect x="60" y="6" width="56" height="128" fill={secondary} />
            )}

            {meta.pattern === 'hoops' && (
              <g>
                <rect x="6" y="24" width="108" height="16" fill={secondary} />
                <rect x="6" y="58" width="108" height="18" fill={secondary} />
                <rect x="6" y="94" width="108" height="16" fill={secondary} />
              </g>
            )}

            {meta.pattern === 'sash' && (
              <polygon points="-8,116 102,4 128,26 16,136" fill={secondary} />
            )}

            {meta.pattern === 'center-pillar' && (
              <g>
                <rect x="44" y="6" width="32" height="128" fill={secondary} />
                <rect x="41" y="6" width="3" height="128" fill={accent} fillOpacity="0.85" />
                <rect x="76" y="6" width="3" height="128" fill={accent} fillOpacity="0.85" />
              </g>
            )}

            {meta.pattern === 'checkered' && (
              <g fill={secondary} fillOpacity="0.92">
                {[0, 1, 2, 3, 4].map((row) =>
                  [0, 1, 2, 3, 4].map((col) =>
                    (row + col) % 2 === 0 ? (
                      <rect
                        key={`${row}-${col}`}
                        x={10 + col * 20}
                        y={12 + row * 24}
                        width="20"
                        height="24"
                      />
                    ) : null
                  )
                )}
              </g>
            )}

            {meta.pattern === 'cross' && (
              <g fill={secondary}>
                <rect x="49" y="6" width="22" height="128" />
                <rect x="6" y="56" width="108" height="22" />
              </g>
            )}

            {meta.pattern === 'radial' && (
              <g>
                <circle cx="60" cy="68" r="34" fill={secondary} fillOpacity="0.28" stroke={secondary} strokeWidth="4" />
                <circle cx="60" cy="68" r="22" fill={primaryDark} fillOpacity="0.82" stroke={accent} strokeWidth="2" />
              </g>
            )}

            {/* High-Contrast Center Monogram Medallion / Plate */}
            {meta.shape === 'circle' || meta.shape === 'oval' ? (
              <circle
                cx="60"
                cy={monogramY}
                r="26"
                fill={plateFill}
                stroke={secondary}
                strokeOpacity="0.85"
                strokeWidth="1.8"
              />
            ) : (
              <rect
                x="22"
                y={monogramY - 17}
                width="76"
                height="34"
                rx="8"
                fill={plateFill}
                stroke={secondary}
                strokeOpacity="0.8"
                strokeWidth="1.6"
              />
            )}

            {/* Upper glass specular sheen */}
            <path
              d="M 10 8 L 110 8 L 110 52 C 84 62 36 62 10 52 Z"
              fill={`url(#cb-gloss-${uid})`}
            />
          </g>

          {/* Crisp inner rim stroke */}
          <path
            d={shapes.inner}
            fill="none"
            stroke="rgba(255,255,255,0.48)"
            strokeWidth="1.4"
          />

          {/* Bold Monogram */}
          <text
            x="60"
            y={monogramY}
            textAnchor="middle"
            dominantBaseline="central"
            fill={textFill}
            filter={`url(#cb-text-shadow-${uid})`}
            style={{
              fontFamily: "'Inter', 'Arial Black', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: `${fontSize}px`,
              letterSpacing: monogram.length >= 4 ? '-0.05em' : '0.02em',
            }}
          >
            {monogram}
          </text>
        </g>
      </svg>
    </div>
  );
};
