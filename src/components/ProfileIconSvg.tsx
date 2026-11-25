import React from 'react';
import { ProfileIconId, normalizeProfileIconId } from '../game/profileIcons';

interface ProfileIconSvgProps {
  iconId?: string | null;
  isBot?: boolean;
  className?: string;
}

/**
 * Handcrafted uniform 32x32 duotone vector sports icons in classic pitch cream (#F2ECD9)
 * and warm gold (#D9B76B) with consistent 1.9px strokes across all 10 profile icons.
 */
export const ProfileIconSvg: React.FC<ProfileIconSvgProps> = ({
  iconId,
  isBot = false,
  className = 'w-6 h-6',
}) => {
  if (isBot || iconId === 'bot' || iconId === '🤖') {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <path
          d="M16 4v3.5"
          stroke="#D9B76B"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="16" cy="3.5" r="1.5" fill="#D9B76B" />
        <rect
          x="6.5"
          y="8.5"
          width="19"
          height="16.5"
          rx="4.5"
          fill="#183022"
          stroke="#F2ECD9"
          strokeWidth="1.9"
        />
        <rect
          x="9.5"
          y="12.5"
          width="13"
          height="5"
          rx="2.5"
          fill="#3C8052"
          fillOpacity="0.45"
          stroke="#D9B76B"
          strokeWidth="1.5"
        />
        <circle cx="13" cy="15" r="1.2" fill="#F2ECD9" />
        <circle cx="19" cy="15" r="1.2" fill="#F2ECD9" />
        <path
          d="M12 21h8"
          stroke="#A8B6A5"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const resolved: ProfileIconId = normalizeProfileIconId(iconId);

  switch (resolved) {
    case 'ball':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <circle
            cx="16"
            cy="16"
            r="11.5"
            fill="#183022"
            stroke="#F2ECD9"
            strokeWidth="1.9"
          />
          <polygon
            points="16,10.5 21,14.1 19.1,20 12.9,20 11,14.1"
            fill="#D9B76B"
            stroke="#F2ECD9"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M16 4.7V10.5M26.8 12.3L21 14.1M22.7 25.3L19.1 20M9.3 25.3L12.9 20M5.2 12.3L11 14.1"
            stroke="#F2ECD9"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'trophy':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <path
            d="M10 6.5h12v6.2a6 6 0 0 1-12 0V6.5Z"
            fill="#D9B76B"
            fillOpacity="0.28"
            stroke="#F2ECD9"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M10 8.5H6.5a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4H10M22 8.5h3.5a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4H22"
            stroke="#D9B76B"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 18.7v4.8M11.5 23.5h9M10 26.5h12"
            stroke="#F2ECD9"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'crown':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <path
            d="M5.5 22.5L4.5 11l6.2 4.8L16 8l5.3 7.8L27.5 11l-1 11.5H5.5Z"
            fill="#D9B76B"
            fillOpacity="0.32"
            stroke="#F2ECD9"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 25.5h19"
            stroke="#D9B76B"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="16" cy="7.5" r="1.4" fill="#D9B76B" />
          <circle cx="4.5" cy="10.5" r="1.2" fill="#D9B76B" />
          <circle cx="27.5" cy="10.5" r="1.2" fill="#D9B76B" />
        </svg>
      );

    case 'medal':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <path
            d="M11 4.5h3.5l1.5 6.5-3.8 1L11 4.5ZM21 4.5h-3.5L16 11l3.8 1L21 4.5Z"
            fill="#3C8052"
            fillOpacity="0.55"
            stroke="#F2ECD9"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle
            cx="16"
            cy="20"
            r="7.2"
            fill="#D9B76B"
            fillOpacity="0.3"
            stroke="#F2ECD9"
            strokeWidth="1.9"
          />
          <path
            d="M16 15.8l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.4 1.2.5-2.6-1.9-1.8 2.6-.4 1.2-2.4Z"
            fill="#D9B76B"
            stroke="#D9B76B"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'boot':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <path
            d="M7 10.5l5.5-.5 1.8 4.2c1.8 1.5 4.5 2 8.2 2.3 2.5.2 4 1.5 4 3.5V22H6.5v-5.5L7 10.5Z"
            fill="#3C8052"
            fillOpacity="0.5"
            stroke="#F2ECD9"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M13 13l2.2-.8M14.3 15.2l2.1-.6"
            stroke="#D9B76B"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M8.5 22v2.8M13.5 22v2.8M19.5 22v2.8M24.2 22v2.8"
            stroke="#D9B76B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'glove':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <path
            d="M10.5 14V7.2a1.8 1.8 0 0 1 3.6 0V12M14.1 12V6a1.8 1.8 0 0 1 3.6 0v6M17.7 12V7.2a1.8 1.8 0 0 1 3.6 0v7.6M21.3 13.8V10a1.7 1.7 0 0 1 3.4 0v7.4c0 3.7-2.6 6.3-6.2 6.6h-4c-2.6 0-4.8-1.5-5.8-4L6.8 15a1.8 1.8 0 0 1 3.3-1.4l.4 1V14Z"
            fill="#3C8052"
            fillOpacity="0.48"
            stroke="#F2ECD9"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="11"
            y="24"
            width="10"
            height="3.5"
            rx="1.2"
            fill="#D9B76B"
            fillOpacity="0.35"
            stroke="#D9B76B"
            strokeWidth="1.6"
          />
        </svg>
      );

    case 'target':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <circle
            cx="16"
            cy="16"
            r="10.8"
            fill="#183022"
            stroke="#F2ECD9"
            strokeWidth="1.9"
          />
          <circle
            cx="16"
            cy="16"
            r="6.2"
            fill="#3C8052"
            fillOpacity="0.45"
            stroke="#D9B76B"
            strokeWidth="1.8"
          />
          <circle cx="16" cy="16" r="2.2" fill="#D9B76B" />
          <path
            d="M16 3.5v3M16 25.5v3M3.5 16h3M25.5 16h3"
            stroke="#F2ECD9"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'lightning':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <path
            d="M17.5 4.2L8.2 17h6.6l-1.3 10.8L23.8 14.5h-6.8l.5-10.3Z"
            fill="#D9B76B"
            fillOpacity="0.38"
            stroke="#F2ECD9"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'shield':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <path
            d="M16 4.5L6.5 8.2v7.3c0 5.9 3.9 10.2 9.5 12 5.6-1.8 9.5-6.1 9.5-12V8.2L16 4.5Z"
            fill="#3C8052"
            fillOpacity="0.52"
            stroke="#F2ECD9"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M16 8.8v14.2M10.5 13.5h11"
            stroke="#D9B76B"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'star':
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
          <path
            d="M16 4.8l3.3 6.8 7.5 1.1-5.4 5.3 1.3 7.5L16 22l-6.7 3.5 1.3-7.5-5.4-5.3 7.5-1.1L16 4.8Z"
            fill="#D9B76B"
            fillOpacity="0.35"
            stroke="#F2ECD9"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="16" r="2.2" fill="#D9B76B" />
        </svg>
      );
  }
};
