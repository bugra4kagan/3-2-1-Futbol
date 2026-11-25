import React from 'react';
import { Home, Trophy, User } from 'lucide-react';
import { MainTab } from '../game/types';

interface BottomNavBarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  hasClaimableGift?: boolean;
  pendingFriendRequestsCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Ana Gezinme"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#101B24] border-t border-white/10 pb-[max(0.3rem,env(safe-area-inset-bottom))]"
    >
      <div className="max-w-xl mx-auto px-4 h-16 grid grid-cols-3 items-center gap-2">
        {/* 1. Ana Sayfa */}
        <button
          type="button"
          data-testid="nav-tab-play"
          onClick={() => onSelectTab('play')}
          className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'play'
              ? 'text-[#22C55E] bg-[#123D2B]/65 font-black'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] font-semibold'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] tracking-tight">Ana Sayfa</span>
        </button>

        {/* 2. Lig */}
        <button
          type="button"
          data-testid="nav-tab-league"
          onClick={() => onSelectTab('league')}
          className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'league'
              ? 'text-[#22C55E] bg-[#123D2B]/65 font-black'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] font-semibold'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[11px] tracking-tight">Lig</span>
        </button>

        {/* 3. Profil */}
        <button
          type="button"
          data-testid="nav-tab-profile"
          onClick={() => onSelectTab('profile')}
          className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[#22C55E] bg-[#123D2B]/65 font-black'
              : 'text-[#94A3B8] hover:text-[#F8FAFC] font-semibold'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[11px] tracking-tight">Profil</span>
        </button>
      </div>
    </nav>
  );
};
