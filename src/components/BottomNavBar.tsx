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

const CenterPlayBallIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    aria-hidden="true"
    className="w-8 h-8 block shrink-0"
  >
    {/* Crisp centered white football with deep navy-black pentagons — zero clipping or oval drift */}
    <circle
      cx="18"
      cy="18"
      r="13.5"
      fill="#FFFFFF"
      stroke={active ? '#0F2438' : '#13304A'}
      strokeWidth="2"
    />
    {/* Subtle lower shading arc inside circle bounds */}
    <path
      d="M7.8 25.4A13.5 13.5 0 0 0 28.2 25.4A13 13 0 0 1 7.8 25.4Z"
      fill="#D7E2EB"
    />
    {/* Central classic pentagon */}
    <polygon
      points="18,12 23.4,16 21.3,22.3 14.7,22.3 12.6,16"
      fill="#0F2438"
    />
    {/* Outer edge segments strictly clipped cleanly inside r=13.5 */}
    <polygon points="18,4.6 21.4,7.4 20.1,9.3 15.9,9.3 14.6,7.4" fill="#0F2438" />
    <polygon points="30.6,14.2 28.8,19.1 26.2,17.9 26.2,14.5 28.6,12.5" fill="#0F2438" />
    <polygon points="5.4,14.2 7.4,12.5 9.8,14.5 9.8,17.9 7.2,19.1" fill="#0F2438" />
    <polygon points="24.8,28.1 20.7,30.1 20,26.6 23.1,24.4 26,25.6" fill="#0F2438" />
    <polygon points="11.2,28.1 10,25.6 12.9,24.4 16,26.6 15.3,30.1" fill="#0F2438" />
    {/* Seam lines connecting central pentagon */}
    <path
      d="M18 9.3V12M23.4 16L26.2 15.3M12.6 16L9.8 15.3M21.3 22.3L23.1 24.4M14.7 22.3L12.9 24.4"
      stroke="#0F2438"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

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
