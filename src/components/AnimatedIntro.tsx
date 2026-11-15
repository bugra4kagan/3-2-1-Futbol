import React, { useEffect, useState } from 'react';
import { Play, Sparkles, Settings, ShieldCheck } from 'lucide-react';
import { sounds } from '../utils/audio';
import { useLanguage } from '../game/LanguageContext';

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
    // Sequence stages for dramatic entrance
    const t1 = setTimeout(() => setPulseStage(1), 300);
    const t2 = setTimeout(() => {
      setPulseStage(2);
      sounds.playCountdown(1);
    }, 800);
    const t3 = setTimeout(() => {
      setPulseStage(3);
    }, 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const handleStart = () => {
    sounds.playWhistle();
    onEnter();
  };

  return (
    <div
      data-testid="animated-intro"
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between p-4 bg-slate-950 text-white overflow-x-hidden select-none animate-screen-fade"
    >
      {/* Stadium Floodlights & Ambient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/25 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:28px_28px] opacity-15 pointer-events-none" />

      {/* Top Bar with Settings trigger */}
      <div className="relative z-10 w-full max-w-xl flex items-center justify-between pt-2 pb-2 sm:pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-widest text-emerald-400 uppercase px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40">
            OFFICIAL APP
          </span>
        </div>

        <button
          type="button"
          data-testid="header-settings-btn"
          onClick={onOpenSettings}
          className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition active:scale-95 cursor-pointer"
          title={t('settings')}
          aria-label={t('settings')}
        >
          <Settings className="w-4 h-4 text-emerald-400" />
        </button>
      </div>

      {/* Centerpiece: Animated Official Logo Emblem */}
      <div className="relative z-10 my-auto flex flex-col items-center text-center px-4 max-w-md">
        {/* Glowing Aura Ring behind Logo */}
        <div className="relative mb-4 group">
          <div className="absolute -inset-4 bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition duration-1000 animate-pulse pointer-events-none" />

          {/* Official Logo Image */}
          <div
            className={`relative w-44 h-44 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-400/50 bg-slate-900/90 flex items-center justify-center transform transition-all duration-700 hover:scale-105 ${
              pulseStage >= 1 ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
            }`}
          >
            <img
              src="/./logo.png"
              alt="3-2-1 Football Challenge Logosu"
              className="w-full h-full object-cover select-none drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Dynamic Title */}
        <div className="space-y-1 mt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-black tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {t('introBadge')}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase drop-shadow-lg pt-1">
            3-2-1 FOOTBALL
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xs mx-auto">
            {t('introSubtitle')}
          </p>
        </div>

        {/* Enter Button with energetic styling */}
        <div className="w-full mt-6 space-y-2.5">
          <button
            onClick={handleStart}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-base sm:text-lg tracking-wide uppercase shadow-xl shadow-emerald-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer border border-emerald-300/40"
            aria-label="Oyuna Başla"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>{t('introStart')}</span>
          </button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('introLeagues')}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-2 text-[11px] text-slate-500 font-medium">
        <span>{t('introFooter')}</span>
      </footer>
    </div>
  );
};
