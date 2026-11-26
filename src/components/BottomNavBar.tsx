import React from 'react';
import { BarChart3, Users, Trophy, User } from 'lucide-react';
import { MainTab } from '../game/types';
import { useLanguage } from '../game/LanguageContext';

interface BottomNavBarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  hasClaimableGift?: boolean;
  pendingFriendRequestsCount?: number;
}

const CenterPlayBallIcon: React.FC<{ active: boolean }> = ({ active }) => {
  const clipId = React.useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden="true"
      className="w-8 h-8 block shrink-0"
    >
      <defs>
        <clipPath id={`nav-ball-${clipId}`}>
          <circle cx="16" cy="16" r="11.5" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="11.5" fill="#FFFFFF" />
      <g clipPath={`url(#nav-ball-${clipId})`}>
        <path d="M7.5 23.8A11.5 11.5 0 0 0 24.5 23.8A11 11 0 0 1 7.5 23.8Z" fill="#D7E2EB" />
        <polygon points="16,11.1 20.7,14.5 18.9,20 13.1,20 11.3,14.5" fill="#0F2438" />
        <polygon points="16,3.3 19.3,5.8 18,7.9 14,7.9 12.7,5.8" fill="#0F2438" />
        <polygon points="28.3,12.1 26.5,16.8 23.9,15.6 23.9,12.5 26.3,10.5" fill="#0F2438" />
        <polygon points="3.7,12.1 5.7,10.5 8.1,12.5 8.1,15.6 5.5,16.8" fill="#0F2438" />
        <polygon points="23.6,25.9 19.4,28.1 18.6,24.2 21.4,22 24.5,23.2" fill="#0F2438" />
        <polygon points="8.4,25.9 7.5,23.2 10.6,22 13.4,24.2 12.6,28.1" fill="#0F2438" />
        <path
          d="M16 7.9V11.1M20.7 14.5L23.9 13.8M11.3 14.5L8.1 13.8M18.9 20L21.4 22M13.1 20L10.6 22"
          stroke="#0F2438"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>
      <circle
        cx="16"
        cy="16"
        r="11.5"
        stroke={active ? '#0F2438' : '#13304A'}
        strokeWidth="1.8"
      />
    </svg>
  );
};

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  pendingFriendRequestsCount = 0,
}) => {
  const { t } = useLanguage();

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Ana Gezinme"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E2F1F] border-t border-[#E5B94F]/30 shadow-[0_-4px_18px_rgba(0,0,0,0.38)] pb-[max(0.25rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-xl md:max-w-2xl mx-auto px-1.5 sm:px-2 h-16 grid grid-cols-5 items-center relative">
        {/* 1. İstatistik */}
        <button
          type="button"
          data-testid="nav-tab-stats"
          onClick={() => onSelectTab('stats')}
          className={`min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-xl transition cursor-pointer ${
            activeTab === 'stats'
              ? 'text-[#E5B94F] font-black'
              : 'text-[#C4D6CA] hover:text-[#FFFFFF] font-semibold'
          }`}
        >
          <BarChart3 className="w-5 h-5 shrink-0" />
          <span className="text-[10px] tracking-tight truncate max-w-full">{t('navStats')}</span>
        </button>

        {/* 2. Arkadaşlar */}
        <button
          type="button"
          data-testid="nav-tab-friends"
          onClick={() => onSelectTab('friends')}
          className={`min-w-0 relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-xl transition cursor-pointer ${
            activeTab === 'friends'
              ? 'text-[#60A5FA] font-black'
              : 'text-[#C4D6CA] hover:text-[#FFFFFF] font-semibold'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5 shrink-0" />
            {pendingFriendRequestsCount > 0 && (
              <span
                data-testid="friends-request-badge"
                className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#C93B32] text-[#FFFFFF] border border-[#0E2F1F] text-[10px] font-black leading-none flex items-center justify-center tabular-nums"
              >
                {pendingFriendRequestsCount > 9 ? '9+' : pendingFriendRequestsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight truncate max-w-full">{t('navFriends')}</span>
        </button>

        {/* 3. Center Elevated Play Button (Oyna) */}
        <div className="flex flex-col items-center justify-center relative -mt-5">
          <button
            type="button"
            data-testid="nav-tab-play"
            onClick={() => onSelectTab('play')}
            className={`w-14 h-14 p-0 rounded-full flex items-center justify-center border-[3px] shadow-lg transition-transform active:scale-95 cursor-pointer ${
              activeTab === 'play'
                ? 'bg-gradient-to-b from-[#219C5C] to-[#157543] border-[#E5B94F] ring-2 ring-[#F97316]/55 scale-105'
                : 'bg-[#134A2D] border-[#F5F3EB]/45 hover:border-[#E5B94F] hover:bg-[#19633C]'
            }`}
            aria-label={t('navPlay')}
            aria-current={activeTab === 'play' ? 'page' : undefined}
          >
            <CenterPlayBallIcon active={activeTab === 'play'} />
          </button>
          <span
            className={`text-[10px] mt-0.5 tracking-tight leading-none ${
              activeTab === 'play'
                ? 'text-[#E5B94F] font-black'
                : 'text-[#F5F3EB] font-bold'
            }`}
          >
            {t('navPlay')}
          </span>
        </div>

        {/* 4. Lig */}
        <button
          type="button"
          data-testid="nav-tab-league"
          onClick={() => onSelectTab('league')}
          className={`min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-xl transition cursor-pointer ${
            activeTab === 'league'
              ? 'text-[#E5B94F] font-black'
              : 'text-[#C4D6CA] hover:text-[#FFFFFF] font-semibold'
          }`}
        >
          <Trophy className="w-5 h-5 shrink-0" />
          <span className="text-[10px] tracking-tight truncate max-w-full">{t('navLeague')}</span>
        </button>

        {/* 5. Profil */}
        <button
          type="button"
          data-testid="nav-tab-profile"
          onClick={() => onSelectTab('profile')}
          className={`min-w-0 relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-xl transition cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[#4ADE80] font-black'
              : 'text-[#C4D6CA] hover:text-[#FFFFFF] font-semibold'
          }`}
        >
          <User className="w-5 h-5 shrink-0" />
          <span className="text-[10px] tracking-tight truncate max-w-full">{t('navProfile')}</span>
        </button>
      </div>
    </nav>
  );
};
