import React, { useEffect } from 'react';
import { sounds } from '../utils/audio';

import { MinigameType } from '../game/types';

interface CountdownOverlayProps {
  countdown: number; // 3, 2, 1, or 0
  minigameType?: MinigameType;
  onComplete?: () => void;
}

const COUNTDOWN_SUBTITLES: Record<MinigameType, string> = {
  two_clubs: 'İki kulübün ortak futbolcusunu ilk yazan kazanır!',
  silhouette: 'En fazla 8 denemede futbolcuyu ilk tahmin eden kazanır!',
  xox: "Doğru futbolcularla 3'lü sıra kuran kazanır!",
  career: 'Kariyer basamaklarından futbolcuyu ilk bilen kazanır!',
  country_club: 'Verilen ülke ve kulübün ortak yıldızını ilk yazan kazanır!',
};

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  countdown,
  minigameType = 'two_clubs',
}) => {
  useEffect(() => {
    if (countdown > 0 && countdown <= 3) {
      sounds.playCountdown(countdown);
    } else if (countdown === 0) {
      sounds.playWhistle();
    }
  }, [countdown]);

  if (countdown <= 0) return null;

  return (
    <div
      data-testid="countdown-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-none select-none"
    >
      <div className="relative flex flex-col items-center justify-center px-4 text-center">
        {/* Pulsing Stadium Rings */}
        <div className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full border-4 border-emerald-500/30 animate-ping opacity-40" />
        <div className="absolute w-52 h-52 sm:w-64 sm:h-64 rounded-full border-2 border-emerald-400/60 animate-pulse" />

        {/* Scaled animated countdown number */}
        <div
          key={countdown}
          className="relative flex flex-col items-center animate-[bounce_0.6s_ease-out_1]"
        >
          <span className="font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-emerald-400 to-emerald-600 text-9xl sm:text-[14rem] drop-shadow-[0_0_40px_rgba(16,185,129,0.8)] scale-110">
            {countdown}
          </span>
          <span className="mt-2 text-xs sm:text-sm font-black tracking-widest text-emerald-300 uppercase px-4 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 shadow-inner">
            HAZIR OL!
          </span>
        </div>

        <p className="mt-8 text-xs sm:text-sm font-semibold text-slate-300 tracking-wide animate-pulse">
          {COUNTDOWN_SUBTITLES[minigameType] || COUNTDOWN_SUBTITLES.two_clubs}
        </p>
      </div>
    </div>
  );
};
