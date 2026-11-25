import React, { useEffect, useState } from 'react';
import { Play, Sparkles, Settings, ShieldCheck } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useLanguage } from '../game/LanguageContext';
import { BrandTitle } from './BrandTitle';
import { GameLogo } from './GameLogo';

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
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between px-4 pb-4 bg-[#0B1220] text-[#F5F3EB] overflow-x-clip select-none"
    >
      {/* Subtle Top Floodlight Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(22,138,82,0.18),transparent_60%)] pointer-events-none" />

      {/* Top Bar */}
      <header
        data-testid="intro-top-bar"
        className="relative z-40 w-full max-w-xl flex items-center justify-between pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.45rem))] pb-2.5 sm:pb-4 bg-transparent"
      >
        <div className="flex items-center gap-2">
          <span
            data-testid="intro-season-badge"
            className="text-xs font-black tracking-widest text-[#E5B94F] uppercase px-3 py-1 rounded-full bg-[#16212E] border border-[#E5B94F]/40"
          >
            SEASON 26 • FREE TO PLAY
          </span>
        </div>

        <button
          type="button"
          data-testid="header-settings-btn"
          onClick={onOpenSettings}
          className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-[#16212E] hover:bg-[#1E293B] border border-[#A8B3C2]/25 text-[#E5B94F] transition-colors active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center"
          title={t('settings')}
          aria-label={t('settings')}
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Centerpiece: Bundled Transparent Vector Shield Logo */}
      <div className="relative z-10 my-auto flex flex-col items-center text-center px-4 max-w-md">
        <div
          className={`relative mb-3 flex items-center justify-center transition-transform duration-300 ${
            pulseStage >= 1 ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          <GameLogo size="xl" />
        </div>

        {/* Dynamic Title */}
        <div className="space-y-1.5 mt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#183D2B] border border-[#168A52] text-[#22C55E] text-xs font-black tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 text-[#E5B94F]" />
            <span>{t('introBadge')}</span>
          </div>

          <h1 className="pt-1 flex justify-center">
            <BrandTitle size="lg" />
          </h1>
          <p className="text-xs sm:text-sm text-[#A8B3C2] font-medium max-w-xs mx-auto">
            {t('introSubtitle')}
          </p>
        </div>

        {/* Enter Button */}
        <div className="w-full mt-6 space-y-2.5">
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-4 px-6 rounded-2xl bg-[#168A52] hover:bg-[#1a9c5e] text-[#FFFFFF] font-display font-extrabold text-2xl tracking-wider uppercase shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer border border-[#22C55E]/45 touch-manipulation"
            aria-label="Oyuna Başla"
          >
            <Play className="w-5 h-5 fill-[#FFFFFF]" />
            <span>{t('introStart')}</span>
          </button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-[#A8B3C2] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>{t('introLeagues')}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-2 text-[11px] text-[#A8B3C2]/80 font-medium">
        <span>{t('introFooter')}</span>
      </footer>
    </div>
  );
};
