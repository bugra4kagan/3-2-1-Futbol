import React from 'react';
import { BarChart3, Users, Trophy, User } from 'lucide-react';
import { MainTab } from '../game/types';
import { useLanguage } from '../game/LanguageContext';

interface BottomNavBarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  hasClaimableGift?: boolean;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  hasClaimableGift = false,
}) => {
  const { t } = useLanguage();

  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Ana Gezinme"
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 shadow-[0_-10px_30px_rgba(0,0,0,0.65)]"
    >
      <div className="max-w-xl mx-auto px-2 h-16 grid grid-cols-5 items-center relative">
        {/* 1. İstatistik */}
        <button
          type="button"
          data-testid="nav-tab-stats"
          onClick={() => onSelectTab('stats')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'stats'
              ? 'text-emerald-400 font-black'
              : 'text-slate-400 hover:text-slate-200 font-semibold'
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
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'friends'
              ? 'text-emerald-400 font-black'
              : 'text-slate-400 hover:text-slate-200 font-semibold'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] tracking-tight">{t('navFriends')}</span>
        </button>

        {/* 3. Center Elevated Play Button (Oyna) */}
        <div className="flex flex-col items-center justify-center relative -mt-5">
          <button
            type="button"
            data-testid="nav-tab-play"
            onClick={() => onSelectTab('play')}
            className={`w-14 h-14 rounded-full flex items-center justify-center border-4 border-slate-950 shadow-xl transition transform active:scale-95 cursor-pointer ${
              activeTab === 'play'
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-amber-500/35 scale-105'
                : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-slate-950 hover:scale-105 shadow-emerald-500/25'
            }`}
            aria-label={t('navPlay')}
          >
            <span className="text-2xl leading-none select-none">⚽</span>
          </button>
          <span
            className={`text-[10px] mt-0.5 tracking-tight ${
              activeTab === 'play'
                ? 'text-amber-300 font-black'
                : 'text-slate-300 font-bold'
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
              ? 'text-amber-400 font-black'
              : 'text-slate-400 hover:text-slate-200 font-semibold'
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
              ? 'text-emerald-400 font-black'
              : 'text-slate-400 hover:text-slate-200 font-semibold'
          }`}
        >
          <div className="relative">
            <User className="w-5 h-5" />
            {hasClaimableGift && (
              <span
                data-testid="profile-gift-dot"
                className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950 animate-pulse"
              />
            )}
          </div>
          <span className="text-[10px] tracking-tight">{t('navProfile')}</span>
        </button>
      </div>
    </nav>
  );
};
