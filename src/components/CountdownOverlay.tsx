import React, { useEffect, useRef, useState } from 'react';
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

function getStepStyle(value: number | 'go'): {
  label: string;
  colorClass: string;
  ringColor: string;
  badgeText: string;
} {
  if (value === 3) {
    return {
      label: '3',
      colorClass: 'text-[#F97316]',
      ringColor: 'border-[#F97316]/60',
      badgeText: 'HAZIR OL!',
    };
  }
  if (value === 2) {
    return {
      label: '2',
      colorClass: 'text-[#E5B94F]',
      ringColor: 'border-[#E5B94F]/60',
      badgeText: 'DİKKAT!',
    };
  }
  if (value === 1) {
    return {
      label: '1',
      colorClass: 'text-[#F5F3EB]',
      ringColor: 'border-[#F5F3EB]/65',
      badgeText: 'ODAKLAN!',
    };
  }
  return {
    label: 'BAŞLA!',
    colorClass: 'text-[#4ADE80]',
    ringColor: 'border-[#4ADE80]/75',
    badgeText: 'MAÇ BAŞLADI',
  };
}

/**
 * Lightweight 3-2-1-BAŞLA overlay using pure transform/opacity transitions.
 * Does not alter Firestore or match timer sync; flashes "BAŞLA!" briefly when countdown hits 0.
 */
export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  countdown,
  minigameType = 'two_clubs',
}) => {
  const [showGoFlash, setShowGoFlash] = useState(false);
  const prevCountdownRef = useRef<number>(countdown);
  const lastSoundStepRef = useRef<number | null>(null);
  const goTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevCountdownRef.current;
    prevCountdownRef.current = countdown;

    if (countdown > 0 && countdown <= 3) {
      if (goTimerRef.current) {
        clearTimeout(goTimerRef.current);
        goTimerRef.current = null;
      }
      setShowGoFlash(false);
      if (lastSoundStepRef.current !== countdown) {
        lastSoundStepRef.current = countdown;
        sounds.playCountdown(countdown);
      }
    } else if (countdown === 0 && prev > 0) {
      if (lastSoundStepRef.current !== 0) {
        lastSoundStepRef.current = 0;
        sounds.playWhistle();
      }
      setShowGoFlash(true);
      if (goTimerRef.current) clearTimeout(goTimerRef.current);
      goTimerRef.current = setTimeout(() => {
        goTimerRef.current = null;
        setShowGoFlash(false);
      }, 450);
    } else if (countdown <= 0 && prev <= 0) {
      lastSoundStepRef.current = null;
    }
  }, [countdown]);

  useEffect(() => {
    return () => {
      if (goTimerRef.current) {
        clearTimeout(goTimerRef.current);
        goTimerRef.current = null;
      }
    };
  }, []);

  if (countdown <= 0 && !showGoFlash) return null;

  const activeValue: number | 'go' = countdown > 0 ? countdown : 'go';
  const step = getStepStyle(activeValue);
  const isGo = activeValue === 'go';

  return (
    <div
      data-testid="countdown-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#092818]/88 pointer-events-none select-none"
    >
      <div className="relative flex flex-col items-center justify-center px-4 text-center">
        {/* Lightweight GPU Circle Rings (No blur, no heavy shadows) */}
        <div
          className={`absolute w-56 h-56 sm:w-68 sm:h-68 rounded-full border-2 ${step.ringColor} opacity-45 transition-colors duration-150`}
        />
        <div
          className={`absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full border ${step.ringColor} opacity-75 transition-colors duration-150`}
        />

        <div
          key={String(activeValue)}
          className="relative flex flex-col items-center animate-card-pop will-change-transform"
        >
          <span
            className={`font-score font-extrabold tracking-tight leading-none ${step.colorClass} ${
              isGo ? 'text-6xl sm:text-8xl tracking-wide' : 'text-9xl sm:text-[12rem]'
            }`}
          >
            {step.label}
          </span>
          <span className="mt-3 text-xs sm:text-sm font-black tracking-widest text-[#F5F3EB] uppercase px-4 py-1.5 rounded-full bg-[#134A2D] border border-[#E5B94F]/45">
            {step.badgeText}
          </span>
        </div>

        <p className="mt-8 text-xs sm:text-sm font-semibold text-[#D7E6DC] tracking-wide max-w-xs">
          {COUNTDOWN_SUBTITLES[minigameType] || COUNTDOWN_SUBTITLES.two_clubs}
        </p>
      </div>
    </div>
  );
};
