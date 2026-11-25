import React, { useEffect, useState } from 'react';
import { Play, Sparkles, Settings, ShieldCheck } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useLanguage } from '../game/LanguageContext';
import { BrandTitle } from './BrandTitle';

interface AnimatedIntroProps {
  onEnter: () => void;
  onOpenSettings: () => void;
}

export const AnimatedIntro: React.FC<AnimatedIntroProps> = ({
  onEnter,
  onOpenSettings,
}) => {
  const [pulseStage, setPulseStage] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    const t1 = setTimeout(() => setPulseStage(1), 80);
    const t2 = setTimeout(() => {
      setPulseStage(2);
      sounds.playCountdown(1);
    }, 450);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleStart = () => {
    sounds.playWhistle();
    onEnter();
  };

  return (
    <div
      data-testid="animated-intro"
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between px-4 pb-4 bg-[#101C16] pitch-turf-backdrop text-[#F2ECD9] overflow-x-clip select-none"
    >
      {/* Classic Stadium Floodlight Horizon */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(60,128,82,0.24),transparent_65%)] pointer-events-none" />

      {/* Seamless Safe-Area Top Bar */}
      <header
        data-testid="intro-top-bar"
        className="relative z-40 w-full max-w-xl flex items-center justify-between pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.45rem))] pb-2.5 sm:pb-4 bg-transparent"
      >
        <div className="flex items-center gap-2">
          <span
            data-testid="intro-season-badge"
            className="text-xs font-black tracking-widest text-[#D9B76B] uppercase px-3 py-1 rounded-full bg-[#244632] border border-[#D9B76B]/45"
          >
            SEASON 26 • FREE TO PLAY
          </span>
        </div>

        <button
          type="button"
          data-testid="header-settings-btn"
          onClick={onOpenSettings}
          className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-[#244632] hover:bg-[#2a523b] border border-[#D9B76B]/35 text-[#D9B76B] transition-colors active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center"
          title={t('settings')}
          aria-label={t('settings')}
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Centerpiece: Original Official Shield Logo */}
      <div className="relative z-10 my-auto flex flex-col items-center text-center px-4 max-w-md">
        <div className="relative mb-4">
          <div
            className={`relative w-44 h-44 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-3xl overflow-hidden shadow-2xl border-2 border-[#D9B76B] bg-[#183022] flex items-center justify-center transition-transform duration-300 hover:scale-[1.03] ${
              pulseStage >= 1 ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="3-2-1 Futbol Orijinal Logosu"
              className="w-full h-full object-cover select-none"
            />
          </div>
        </div>

        {/* Dynamic Title */}
        <div className="space-y-1.5 mt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#244632] border border-[#D9B76B]/45 text-[#D9B76B] text-xs font-black tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('introBadge')}</span>
          </div>

          <h1 className="pt-1 flex justify-center">
            <BrandTitle size="lg" />
          </h1>
          <p className="text-xs sm:text-sm text-[#A8B6A5] font-medium max-w-xs mx-auto">
            {t('introSubtitle')}
          </p>
        </div>

        {/* Enter Button */}
        <div className="w-full mt-6 space-y-2.5">
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-4 px-6 rounded-2xl bg-[#D9B76B] hover:bg-[#e5c784] text-[#101C16] font-display font-extrabold text-xl sm:text-2xl tracking-wider uppercase shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer border border-[#F2ECD9]/40 touch-manipulation"
            aria-label="Oyuna Başla"
          >
            <Play className="w-5 h-5 fill-[#101C16]" />
            <span>{t('introStart')}</span>
          </button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-[#A8B6A5] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#3C8052]" />
            <span>{t('introLeagues')}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-2 text-[11px] text-[#A8B6A5]/80 font-medium">
        <span>{t('introFooter')}</span>
      </footer>
    </div>
  );
};
