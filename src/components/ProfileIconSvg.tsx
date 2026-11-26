import React from 'react';
import { ProfileIconId, normalizeProfileIconId } from '../game/profileIcons';

interface ProfileIconSvgProps {
  iconId?: string | null;
  isBot?: boolean;
  className?: string;
}

/**
 * Unified 10-icon scalable SVG sports icon set (+ Bot badge).
 * Shared standard across all 10 icons:
 *  - viewBox="0 0 32 32", width="100%", height="100%", preserveAspectRatio="xMidYMid meet"
 *  - Uniform stroke weight (~1.6), centered inside [3.5..28.5] safe area, transparent background
 *  - No crosses/religious symbols on Shield; authentic studded football cleat on Boot; symmetrical clipped Ball.
 */
export const ProfileIconSvg: React.FC<ProfileIconSvgProps> = ({
  iconId,
  isBot = false,
  className = 'w-6 h-6',
}) => {
  const uid = React.useId().replace(/:/g, '');

  if (isBot || iconId === 'bot' || iconId === '🤖') {
    return (
      <svg
        viewBox="0 0 32 32"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        aria-hidden="true"
        className={`block shrink-0 ${className}`}
      >
        <path d="M16 4V7.5" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="3.6" r="1.6" fill="#F97316" />
        <rect x="6" y="7.8" width="20" height="16.5" rx="4.8" fill="#1E293B" stroke="#E2E8F0" strokeWidth="1.6" />
        <rect x="9" y="11.8" width="14" height="5.6" rx="2.4" fill="#0B1220" stroke="#F97316" strokeWidth="1.4" />
        <circle cx="12.8" cy="14.6" r="1.4" fill="#F97316" />
        <circle cx="19.2" cy="14.6" r="1.4" fill="#F97316" />
        <path d="M11.8 20.8H20.2" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  const resolved: ProfileIconId = normalizeProfileIconId(iconId);
  const ballClipId = `ball-clip-${uid}`;
  const shieldClipId = `shield-clip-${uid}`;

  switch (resolved) {
    case 'ball':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          <defs>
            <clipPath id={ballClipId}>
              <circle cx="16" cy="16" r="11.5" />
            </clipPath>
          </defs>
          <circle cx="16" cy="16" r="11.5" fill="#FFFFFF" />
          <g clipPath={`url(#${ballClipId})`}>
            {/* Subtle spherical crescent shading */}
            <path d="M7.5 23.8A11.5 11.5 0 0 0 24.5 23.8A11 11 0 0 1 7.5 23.8Z" fill="#CBD5E1" />
            {/* Center classic pentagon */}
            <polygon points="16,11.1 20.7,14.5 18.9,20 13.1,20 11.3,14.5" fill="#0F172A" />
            {/* Symmetrical radial edge pentagons strictly inside clip */}
            <polygon points="16,3.3 19.3,5.8 18,7.9 14,7.9 12.7,5.8" fill="#0F172A" />
            <polygon points="28.3,12.1 26.5,16.8 23.9,15.6 23.9,12.5 26.3,10.5" fill="#0F172A" />
            <polygon points="3.7,12.1 5.7,10.5 8.1,12.5 8.1,15.6 5.5,16.8" fill="#0F172A" />
            <polygon points="23.6,25.9 19.4,28.1 18.6,24.2 21.4,22 24.5,23.2" fill="#0F172A" />
            <polygon points="8.4,25.9 7.5,23.2 10.6,22 13.4,24.2 12.6,28.1" fill="#0F172A" />
            {/* Seam lines */}
            <path
              d="M16 7.9V11.1M20.7 14.5L23.9 13.8M11.3 14.5L8.1 13.8M18.9 20L21.4 22M13.1 20L10.6 22"
              stroke="#0F172A"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
          <circle cx="16" cy="16" r="11.5" stroke="#0F172A" strokeWidth="1.65" />
        </svg>
      );

    case 'trophy':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          <path d="M9.5 7H6.2a2.2 2.2 0 0 0-2.2 2.2v1.2a4.2 4.2 0 0 0 4.2 4.2h1.5" stroke="#D97706" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M22.5 7H25.8a2.2 2.2 0 0 1 2.2 2.2v1.2a4.2 4.2 0 0 1-4.2 4.2h-1.5" stroke="#D97706" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M9.5 5.5H22.5V12.2A6.5 6.5 0 0 1 9.5 12.2V5.5Z" fill="#FBBF24" stroke="#B45309" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M11.6 7.5H15V12.3C15 14.1 13.8 15.5 12.4 16C11.8 14.9 11.6 13.6 11.6 12.3V7.5Z" fill="#FEF3C7" fillOpacity="0.7" />
          <rect x="14.2" y="18.6" width="3.6" height="4.4" fill="#D97706" stroke="#92400E" strokeWidth="1.2" />
          <path d="M10.5 23H21.5L23 26.8H9L10.5 23Z" fill="#78350F" stroke="#FBBF24" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );

    case 'crown':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          <path
            d="M5 21.5L4.4 11L10.6 15.8L16 7.8L21.4 15.8L27.6 11L27 21.5H5Z"
            fill="#FBBF24"
            stroke="#B45309"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect x="6" y="21.5" width="20" height="4" rx="1" fill="#DC2626" stroke="#FBBF24" strokeWidth="1.5" />
          <circle cx="16" cy="7.4" r="1.8" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1.1" />
          <circle cx="4.5" cy="10.4" r="1.5" fill="#FDE68A" stroke="#B45309" strokeWidth="0.9" />
          <circle cx="27.5" cy="10.4" r="1.5" fill="#FDE68A" stroke="#B45309" strokeWidth="0.9" />
          <circle cx="16" cy="17.2" r="1.7" fill="#DC2626" />
        </svg>
      );

    case 'medal':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          <path d="M9.5 4.2H14.5L16.4 12.2H11.5L9.5 4.2Z" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M22.5 4.2H17.5L15.6 12.2H20.5L22.5 4.2Z" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="16" cy="19.8" r="7.8" fill="#FBBF24" stroke="#B45309" strokeWidth="1.6" />
          <circle cx="16" cy="19.8" r="5.3" fill="#FEF3C7" fillOpacity="0.55" />
          <polygon points="16,15.4 17.3,18.1 20.2,18.5 18.1,20.5 18.6,23.4 16,22 13.4,23.4 13.9,20.5 11.8,18.5 14.7,18.1" fill="#B45309" />
        </svg>
      );

    case 'boot':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          {/* Authentic aerodynamic studded football cleat (zero wheel/skate shapes) */}
          <path
            d="M5.5 19.2C5.5 15.2 6.8 10.8 9.2 9.5L13 8.8C14.1 11.3 16.5 13 20 14C24.2 15.1 27.6 16 27.8 18.4C27.9 19.8 26.8 20.6 25 20.6H6.5C5.8 20.6 5.5 20 5.5 19.2Z"
            fill="#F97316"
            stroke="#0F172A"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          {/* Speed stripe & heel accent */}
          <path d="M7.6 17.6C10.8 17.2 13.5 15.6 15.2 13.4" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
          {/* Angled laces */}
          <path d="M14.2 11.4L16.6 10.6M16.2 13.2L18.6 12.4M18.4 14.8L20.6 14" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          {/* Sleek outsole plate */}
          <rect x="5.4" y="19.6" width="22.2" height="2.4" rx="1" fill="#0F172A" />
          {/* 4 sharp tapered metallic cleat studs (authentic football krampon dişleri) */}
          <polygon points="7.2,21.8 10.0,21.8 9.2,26.0 8.0,26.0" fill="#E2E8F0" stroke="#0F172A" strokeWidth="0.85" strokeLinejoin="round" />
          <polygon points="12.2,21.8 14.8,21.8 14.1,25.6 12.9,25.6" fill="#E2E8F0" stroke="#0F172A" strokeWidth="0.85" strokeLinejoin="round" />
          <polygon points="19.2,21.8 21.8,21.8 21.1,25.6 19.9,25.6" fill="#E2E8F0" stroke="#0F172A" strokeWidth="0.85" strokeLinejoin="round" />
          <polygon points="23.8,21.8 26.6,21.8 25.8,26.0 24.6,26.0" fill="#E2E8F0" stroke="#0F172A" strokeWidth="0.85" strokeLinejoin="round" />
        </svg>
      );

    case 'glove':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          <path
            d="M10 13.2V7A1.7 1.7 0 0 1 13.4 7V11.8M13.4 11.8V5.8A1.7 1.7 0 0 1 16.8 5.8V11.8M16.8 11.8V7A1.7 1.7 0 0 1 20.2 7V13.4M20.2 13.4V9.8A1.6 1.6 0 0 1 23.4 9.8V17C23.4 20.6 21 23.1 17.6 23.5H13.4C10.9 23.5 8.8 22 7.8 19.6L6 15A1.7 1.7 0 0 1 9.2 13.6L9.7 14.8V13.2Z"
            fill="#FFFFFF"
            stroke="#10B981"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect x="11" y="13.5" width="8.8" height="5.8" rx="1.8" fill="#10B981" fillOpacity="0.28" />
          <rect x="10.6" y="23.4" width="10.8" height="4.2" rx="1.4" fill="#10B981" stroke="#065F46" strokeWidth="1.5" />
          <path d="M13 25.5H19" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );

    case 'target':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          <circle cx="16" cy="16" r="11.5" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1.6" />
          <circle cx="16" cy="16" r="8.1" fill="#FFFFFF" />
          <circle cx="16" cy="16" r="4.8" fill="#DC2626" />
          <circle cx="16" cy="16" r="1.9" fill="#FFFFFF" />
        </svg>
      );

    case 'lightning':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          <path
            d="M18.2 4L7.8 17.2H14.8L13.2 28L24.2 14.2H17.2L18.2 4Z"
            fill="#FACC15"
            stroke="#EA580C"
            strokeWidth="1.65"
            strokeLinejoin="round"
          />
          <path d="M17.1 7.6L12.6 14.6H16.2L15.5 20" stroke="#FEF9C3" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      );

    case 'shield':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          <defs>
            <clipPath id={shieldClipId}>
              <path d="M16 4.2L6.2 8V15.4C6.2 21.3 10.3 25.8 16 27.6C21.7 25.8 25.8 21.3 25.8 15.4V8L16 4.2Z" />
            </clipPath>
          </defs>
          {/* Sporty neutral blue-and-silver athletic crest shield (NO cross / religious symbols) */}
          <g clipPath={`url(#${shieldClipId})`}>
            <path d="M6.2 4.2H25.8V27.6H6.2V4.2Z" fill="#2563EB" />
            <path d="M16 4.2H25.8V27.6H16V4.2Z" fill="#1E3A8A" />
            <path d="M6.2 10.2L16 6.8L25.8 10.2" stroke="#93C5FD" strokeWidth="1.6" />
          </g>
          <path
            d="M16 4.2L6.2 8V15.4C6.2 21.3 10.3 25.8 16 27.6C21.7 25.8 25.8 21.3 25.8 15.4V8L16 4.2Z"
            stroke="#E2E8F0"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          {/* Centered athletic star crest */}
          <polygon
            points="16,11.6 17.3,14.3 20.2,14.7 18.1,16.8 18.6,19.7 16,18.3 13.4,19.7 13.9,16.8 11.8,14.7 14.7,14.3"
            fill="#FBBF24"
            stroke="#FDE68A"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'star':
      return (
        <svg
          viewBox="0 0 32 32"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={`block shrink-0 ${className}`}
        >
          <path
            d="M16 4.4L19.5 11.6L27.5 12.8L21.7 18.4L23.1 26.4L16 22.6L8.9 26.4L10.3 18.4L4.5 12.8L12.5 11.6L16 4.4Z"
            fill="#FBBF24"
            stroke="#B45309"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <polygon
            points="16,8.4 17.9,12.4 22.3,13.1 19.1,16.2 19.9,20.6 16,18.5 12.1,20.6 12.9,16.2 9.7,13.1 14.1,12.4"
            fill="#FEF3C7"
            fillOpacity="0.68"
          />
        </svg>
      );
  }
};
