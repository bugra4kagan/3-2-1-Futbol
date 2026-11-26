import React from 'react';
import { ProfileIconId, normalizeProfileIconId } from '../game/profileIcons';

interface ProfileIconSvgProps {
  iconId?: string | null;
  isBot?: boolean;
  className?: string;
}

/**
 * Rich, multi-colored semi-3D vector sports icons for the 10 free profile icons (+ Bot badge).
 * Colors follow the exact specification:
 *  1. Futbol Topu: beyaz & siyah
 *  2. Kupa: altın & bronz
 *  3. Taç: altın & kırmızı detay
 *  4. Madalya: altın & mavi kurdele
 *  5. Krampon: turuncu & siyah
 *  6. Kaleci Eldiveni: beyaz & yeşil
 *  7. Hedef: kırmızı & beyaz
 *  8. Şimşek: sarı & turuncu
 *  9. Kalkan: mavi & gümüş
 * 10. Yıldız: altın & krem
 */
export const ProfileIconSvg: React.FC<ProfileIconSvgProps> = ({
  iconId,
  isBot = false,
  className = 'w-6 h-6',
}) => {
  if (isBot || iconId === 'bot' || iconId === '🤖') {
    return (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
        <path d="M16 3.5V7" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="16" cy="3" r="1.8" fill="#F97316" />
        <rect x="6" y="7.5" width="20" height="17" rx="5" fill="#1E293B" stroke="#A8B3C2" strokeWidth="1.6" />
        <rect x="9" y="11.5" width="14" height="6" rx="2.5" fill="#0B1220" stroke="#F97316" strokeWidth="1.4" />
        <circle cx="12.8" cy="14.5" r="1.4" fill="#F97316" />
        <circle cx="19.2" cy="14.5" r="1.4" fill="#F97316" />
        <path d="M11.5 21H20.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  const clipId = React.useId();
  const resolved: ProfileIconId = normalizeProfileIconId(iconId);

  switch (resolved) {
    case 'ball':
      return (
        <svg
          viewBox="0 0 32 32"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          aria-hidden="true"
          className={className}
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx="16" cy="16" r="11.6" />
            </clipPath>
          </defs>
          <circle cx="16" cy="16" r="11.6" fill="#FFFFFF" />
          <g clipPath={`url(#${clipId})`}>
            <path d="M21.5 5.2A11.6 11.6 0 0 1 22 26.8A9.6 9.6 0 0 0 21.5 5.2Z" fill="#CBD5E1" />
            <polygon points="16,10.5 21,14.1 19.1,20 12.9,20 11,14.1" fill="#0B1220" />
            <polygon points="16,3.4 19.4,6.4 18.1,8.6 13.9,8.6 12.6,6.4" fill="#0B1220" />
            <polygon points="28.6,12.2 26.4,17.2 23.6,16 23.6,12.5 26.2,10.2" fill="#0B1220" />
            <polygon points="3.4,12.2 5.8,10.2 8.4,12.5 8.4,16 5.6,17.2" fill="#0B1220" />
            <polygon points="23.6,25.8 19.2,28.2 18.4,24.1 21.2,21.8 24.8,23.2" fill="#0B1220" />
            <polygon points="8.4,25.8 7.2,23.2 10.8,21.8 13.6,24.1 12.8,28.2" fill="#0B1220" />
            <path d="M16 8.6V10.5M21 14.1L23.6 13.6M11 14.1L8.4 13.6M19.1 20L21.2 21.8M12.9 20L10.8 21.8" stroke="#0B1220" strokeWidth="1.45" strokeLinecap="round" />
          </g>
          <circle cx="16" cy="16" r="11.6" stroke="#0B1220" strokeWidth="1.8" />
        </svg>
      );

    case 'trophy':
      return (
        <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" className={className}>
          <path d="M9.5 7H6a2.2 2.2 0 0 0-2.2 2.2v1.3a4.2 4.2 0 0 0 4.2 4.2h1.8" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M22.5 7H26a2.2 2.2 0 0 1 2.2 2.2v1.3a4.2 4.2 0 0 1-4.2 4.2h-1.8" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9.5 5.5H22.5V12.5A6.5 6.5 0 0 1 9.5 12.5V5.5Z" fill="#E5B94F" stroke="#B45309" strokeWidth="1.6" />
          <path d="M11.5 7.5H15.5V12.5C15.5 14.5 14 16 12.5 16.5C11.7 15.3 11.5 13.8 11.5 12.5V7.5Z" fill="#FDE68A" fillOpacity="0.65" />
          <rect x="14" y="19" width="4" height="4.5" fill="#D97706" />
          <path d="M10.5 23.5H21.5L23 27H9L10.5 23.5Z" fill="#92400E" stroke="#E5B94F" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );

    case 'crown':
      return (
        <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" className={className}>
          <path d="M4.5 22L3.8 10.5L10.4 15.8L16 7.5L21.6 15.8L28.2 10.5L27.5 22H4.5Z" fill="#E5B94F" stroke="#B45309" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M6 22H26V25.8H6V22Z" fill="#DC2626" stroke="#E5B94F" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="16" cy="7" r="2" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1" />
          <circle cx="4" cy="10" r="1.6" fill="#E5B94F" />
          <circle cx="28" cy="10" r="1.6" fill="#E5B94F" />
          <circle cx="16" cy="17.5" r="1.8" fill="#DC2626" />
        </svg>
      );

    case 'medal':
      return (
        <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" className={className}>
          <path d="M9.5 4H14.5L16.5 12.5H11.5L9.5 4Z" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M22.5 4H17.5L15.5 12.5H20.5L22.5 4Z" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1.3" strokeLinejoin="round" />
          <circle cx="16" cy="20" r="8" fill="#E5B94F" stroke="#B45309" strokeWidth="1.6" />
          <circle cx="16" cy="20" r="5.5" fill="#FDE68A" fillOpacity="0.45" />
          <polygon points="16,15.5 17.3,18.2 20.3,18.6 18.1,20.7 18.6,23.7 16,22.3 13.4,23.7 13.9,20.7 11.7,18.6 14.7,18.2" fill="#B45309" />
        </svg>
      );

    case 'boot':
      return (
        <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" className={className}>
          <path d="M6.5 10L12.5 9L14.5 13.5C16.8 15.2 20.2 15.8 24 16C26.5 16.2 27.8 17.8 27.8 20V22H5.5V16L6.5 10Z" fill="#F97316" stroke="#0B1220" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M5.5 19.5H27.8V22H5.5V19.5Z" fill="#0B1220" />
          <path d="M13 12.5L15.5 11.7M14.5 14.8L17 14" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="7.5" y="22" width="2.5" height="3.2" rx="0.8" fill="#0B1220" stroke="#FFFFFF" strokeWidth="0.9" />
          <rect x="13" y="22" width="2.5" height="3.2" rx="0.8" fill="#0B1220" stroke="#FFFFFF" strokeWidth="0.9" />
          <rect x="19" y="22" width="2.5" height="3.2" rx="0.8" fill="#0B1220" stroke="#FFFFFF" strokeWidth="0.9" />
          <rect x="24" y="22" width="2.5" height="3.2" rx="0.8" fill="#0B1220" stroke="#FFFFFF" strokeWidth="0.9" />
        </svg>
      );

    case 'glove':
      return (
        <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" className={className}>
          <path
            d="M10 13.5V7A1.8 1.8 0 0 1 13.6 7V12M13.6 12V5.8A1.8 1.8 0 0 1 17.2 5.8V12M17.2 12V7A1.8 1.8 0 0 1 20.8 7V13.8M20.8 13.8V10A1.7 1.7 0 0 1 24.2 10V17.4C24.2 21.1 21.6 23.6 18 24H13.5C10.9 24 8.7 22.5 7.7 20L5.8 15.2A1.8 1.8 0 0 1 9.1 13.8L9.6 15V13.5Z"
            fill="#FFFFFF"
            stroke="#168A52"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <rect x="11" y="13.5" width="9" height="6" rx="2" fill="#168A52" fillOpacity="0.22" />
          <rect x="10.5" y="23.8" width="11" height="4.2" rx="1.4" fill="#168A52" stroke="#183D2B" strokeWidth="1.4" />
        </svg>
      );

    case 'target':
      return (
        <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" className={className}>
          <circle cx="16" cy="16" r="12" fill="#DC2626" stroke="#991B1B" strokeWidth="1.4" />
          <circle cx="16" cy="16" r="8.4" fill="#FFFFFF" />
          <circle cx="16" cy="16" r="5" fill="#DC2626" />
          <circle cx="16" cy="16" r="2" fill="#FFFFFF" />
        </svg>
      );

    case 'lightning':
      return (
        <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" className={className}>
          <path
            d="M18.2 3.5L7.5 17.2H14.8L13 28.5L24.5 14H17.2L18.2 3.5Z"
            fill="#FACC15"
            stroke="#F97316"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M17.2 7L12.5 14.5H16.2L15.4 20.5" stroke="#FEF9C3" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    case 'shield':
      return (
        <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" className={className}>
          <path
            d="M16 4L6 8V15.5C6 21.6 10.1 26.2 16 28C21.9 26.2 26 21.6 26 15.5V8L16 4Z"
            fill="#3B82F6"
            stroke="#E2E8F0"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M16 6V26C20.8 24.4 24 20.5 24 15.5V9.2L16 6Z" fill="#1D4ED8" />
          <path d="M16 8.5V23.5M10.5 13.5H21.5" stroke="#E2E8F0" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'star':
      return (
        <svg viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" fill="none" aria-hidden="true" className={className}>
          <path
            d="M16 4.2L19.6 11.6L27.8 12.8L21.9 18.6L23.3 26.7L16 22.9L8.7 26.7L10.1 18.6L4.2 12.8L12.4 11.6L16 4.2Z"
            fill="#E5B94F"
            stroke="#B45309"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon points="16,8.2 18,12.5 22.6,13.2 19.3,16.4 20.1,21 16,18.8 11.9,21 12.7,16.4 9.4,13.2 14,12.5" fill="#F5F3EB" fillOpacity="0.65" />
        </svg>
      );
  }
};
