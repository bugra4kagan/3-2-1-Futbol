import React, { useEffect, useState } from 'react';
import { Play, Sparkles, Settings, ShieldCheck, Trophy } from 'lucide-react';
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
  const [logoError, setLogoError] = useState(false);
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
      className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between px-4 pb-4 bg-slate-950 text-white overflow-x-clip select-none"
    >
      {/* Stadium Floodlights & Lightweight Static Gradient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/25 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(245,158,11,0.16),transparent_52%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:28px_28px] opacity-15 pointer-events-none" />

      {/* Seamless Safe-Area Top Bar (Transparent so background stadium glow flows unbroken) */}
      <header
        data-testid="intro-top-bar"
        className="relative z-40 w-full max-w-xl flex items-center justify-between pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.45rem))] pb-2.5 sm:pb-4 bg-transparent"
      >
        <div className="flex items-center gap-2">
          <span
            data-testid="intro-season-badge"
            className="text-xs font-black tracking-widest text-emerald-300 uppercase px-3 py-1 rounded-full bg-emerald-950/85 border border-emerald-400/45 shadow-[0_0_14px_rgba(16,185,129,0.2)]"
          >
            SEASON 26 • FREE TO PLAY
          </span>
        </div>

        <button
          type="button"
          data-testid="header-settings-btn"
          onClick={onOpenSettings}
          className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-colors active:scale-95 cursor-pointer touch-manipulation flex items-center justify-center"
          title={t('settings')}
          aria-label={t('settings')}
        >
          <Settings className="w-5 h-5 text-emerald-400" />
        </button>
      </header>

      {/* Centerpiece: Official Logo Emblem */}
      <div className="relative z-10 my-auto flex flex-col items-center text-center px-4 max-w-md">
        <div className="relative mb-4">
          <div
            className={`relative w-44 h-44 sm:w-64 sm:h-64 md:w-72 md:h-72 rounded-3xl overflow-hidden shadow-[0_0_45px_rgba(245,158,11,0.22)] border-2 border-amber-400/55 bg-slate-900 flex items-center justify-center transition-transform duration-300 hover:scale-[1.03] ${
              pulseStage >= 1 ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            {!logoError ? (
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="3-2-1 Futbol Logosu"
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover select-none"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900 via-slate-900 to-amber-900/60 p-4">
                <Trophy className="w-16 h-16 text-amber-400 mb-2" />
                <span className="text-2xl font-black tracking-tight text-white">3-2-1</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Title */}
        <div className="space-y-1 mt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-black tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {t('introBadge')}
          </div>

          <h1 className="pt-1 flex justify-center">
            <BrandTitle size="lg" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xs mx-auto">
            {t('introSubtitle')}
          </p>
        </div>

        {/* Enter Button */}
        <div className="w-full mt-6 space-y-2.5">
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-base sm:text-lg tracking-wide uppercase shadow-xl shadow-emerald-500/25 transition-transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer border border-emerald-300/40 touch-manipulation"
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
