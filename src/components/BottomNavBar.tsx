import React from 'react';
import { BarChart3, Users, Trophy, User } from 'lucide-react';
import { MainTab } from '../game/types';
import { useLanguage } from '../game/LanguageContext';
import { ProfileIconSvg } from './ProfileIconSvg';

interface BottomNavBarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  hasClaimableGift?: boolean;
  pendingFriendRequestsCount?: number;
}

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
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#16212E] border-t border-[#A8B3C2]/20 shadow-[0_-6px_20px_rgba(0,0,0,0.5)] pb-[max(0.25rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-xl mx-auto px-2 h-16 grid grid-cols-5 items-center relative">
        {/* 1. İstatistik */}
        <button
          type="button"
          data-testid="nav-tab-stats"
          onClick={() => onSelectTab('stats')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'stats'
              ? 'text-[#E5B94F] font-black'
              : 'text-[#A8B3C2] hover:text-[#FFFFFF] font-semibold'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">{t('navStats')}</span>
        </button>

        {/* 2. Arkadaşlar */}
        <button
          type="button"
          data-testid="nav-tab-friends"
          onClick={() => onSelectTab('friends')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'friends'
              ? 'text-[#3B82F6] font-black'
              : 'text-[#A8B3C2] hover:text-[#FFFFFF] font-semibold'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5" />
            {pendingFriendRequestsCount > 0 && (
              <span
                data-testid="friends-request-badge"
                className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#DC2626] text-[#FFFFFF] border border-[#16212E] text-[10px] font-black leading-none flex items-center justify-center tabular-nums"
              >
                {pendingFriendRequestsCount > 9 ? '9+' : pendingFriendRequestsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">{t('navFriends')}</span>
        </button>

        {/* 3. Center Elevated Play Button (Oyna) */}
        <div className="flex flex-col items-center justify-center relative -mt-5">
          <button
            type="button"
            data-testid="nav-tab-play"
            onClick={() => onSelectTab('play')}
            className={`w-14 h-14 rounded-full flex items-center justify-center border-4 border-[#0B1220] shadow-xl transition transform active:scale-95 cursor-pointer ${
              activeTab === 'play'
                ? 'bg-[#168A52] text-[#FFFFFF] ring-2 ring-[#E5B94F]/80 scale-105'
                : 'bg-[#183D2B] text-[#FFFFFF] hover:bg-[#168A52] hover:scale-105'
            }`}
            aria-label={t('navPlay')}
          >
            <ProfileIconSvg iconId="ball" className="w-7 h-7" />
          </button>
          <span
            className={`text-[10px] mt-0.5 tracking-tight ${
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
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'league'
              ? 'text-[#E5B94F] font-black'
              : 'text-[#A8B3C2] hover:text-[#FFFFFF] font-semibold'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">{t('navLeague')}</span>
        </button>

        {/* 5. Profil */}
        <button
          type="button"
          data-testid="nav-tab-profile"
          onClick={() => onSelectTab('profile')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[#22C55E] font-black'
              : 'text-[#A8B3C2] hover:text-[#FFFFFF] font-semibold'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">{t('navProfile')}</span>
        </button>
      </div>
    </nav>
  );
};
