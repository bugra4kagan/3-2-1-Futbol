import React, { useEffect, useState } from 'react';
import { Club, Player, SilhouettePose } from '../game/types';
import { PlayerAssetMeta } from '../game/playerAssets';
import { getPortraitBlurPx } from '../game/silhouetteEngine';
import { getClubCrestUrl } from '../game/clubLogos';
import { CountryFlag } from './CountryFlag';

interface SilhouetteSvgProps {
  pose: SilhouettePose;
  jerseyNumber: number;
  accentColor?: string;
  player?: Player | null;
  asset?: PlayerAssetMeta | null;
  club?: Club | null;
  wrongGuessCount?: number;
  revealed?: boolean;
}

export const SilhouetteSvg: React.FC<SilhouetteSvgProps> = ({
  pose,
  jerseyNumber,
  accentColor = '#f59e0b',
  player = null,
  asset = null,
  club = null,
  wrongGuessCount = 0,
  revealed = false,
}) => {
  const [imgError, setImgError] = useState(false);

  const photoUrl = asset?.photoUrl || '';
  const blurPx = getPortraitBlurPx(wrongGuessCount, revealed);
  const clubCrest = getClubCrestUrl(asset?.clubId || club?.id, asset?.clubName || club?.name);

  useEffect(() => {
    setImgError(false);
  }, [photoUrl, player?.id]);

  // Primary Who-Are-Ya Real Portrait Stage
  if (photoUrl && !imgError) {
    return (
      <div
        data-testid="silhouette-portrait-frame"
        className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto rounded-3xl overflow-hidden bg-gradient-to-b from-slate-100 via-white to-slate-200 border-2 border-amber-400/55 shadow-2xl flex items-center justify-center select-none"
      >
        {/* Subtle studio vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(15,23,42,0.12)_100%)] pointer-events-none z-10" />

        {/* Real footballer portrait with controlled CSS blur */}
        <img
          data-testid="silhouette-portrait-img"
          src={photoUrl}
          alt={revealed && player ? player.name : 'Gizli Futbolcu'}
          loading="eager"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-top transition-[filter,transform] duration-500 pointer-events-none"
          style={{
            filter: blurPx > 0 ? `blur(${blurPx}px) saturate(1.05)` : 'blur(0px)',
            transform: blurPx > 0 ? 'scale(1.1)' : 'scale(1.0)',
          }}
        />

        {/* Top-left subtle info when unrevealed vs full identity badges when revealed */}
        {!revealed ? (
          <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-950/85 border border-amber-400/50 text-amber-300 font-black text-sm flex items-center justify-center shadow-md z-20">
            ?
          </div>
        ) : (
          player && (
            <div className="absolute top-2.5 left-2.5 z-20 flex flex-col items-start gap-1.5 bg-slate-950/85 backdrop-blur-sm border border-emerald-400/40 rounded-2xl px-2 py-1.5 shadow-lg">
              <span className="text-[11px] font-black text-emerald-300 leading-none">
                {player.position}
              </span>
              <CountryFlag
                country={player.nationality}
                flag={player.flag}
                size="sm"
                variant="circle"
              />
              {clubCrest && (
                <img
                  src={clubCrest}
                  alt={asset?.clubName || ''}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 object-contain"
                />
              )}
            </div>
          )
        )}

        {/* Reveal Name Pill */}
        {revealed && player && (
          <div className="absolute bottom-2 inset-x-2 z-20 px-2.5 py-1 rounded-xl bg-slate-950/90 border border-emerald-400/50 text-white text-xs font-black truncate shadow-lg">
            {player.name}
          </div>
        )}
      </div>
    );
  }

  // Fallback stylized SVG only if external portrait fails
  return (
    <div
      data-testid="silhouette-portrait-frame"
      className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 via-emerald-950/50 to-slate-950 border border-amber-400/35 shadow-2xl flex items-center justify-center select-none"
    >
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 w-56 h-40 opacity-35 blur-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:14px_14px] opacity-15 pointer-events-none" />
      <div className="absolute bottom-3 w-28 h-4 rounded-full bg-black/75 blur-sm pointer-events-none" />

      <div className="absolute top-2.5 right-3 w-7 h-7 rounded-full bg-slate-950/85 border border-emerald-400/40 text-emerald-300 font-black text-sm flex items-center justify-center shadow-md z-20">
        ?
      </div>

      <svg
        viewBox="0 0 200 200"
        className="relative z-10 w-40 h-40 sm:w-44 sm:h-44 drop-shadow-[0_0_16px_rgba(251,191,36,0.28)]"
        aria-label="Futbolcuyu Tahmin Et"
      >
        <defs>
          <linearGradient id="silBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <g fill="url(#silBodyGrad)" stroke="#fbbf24" strokeOpacity="0.45" strokeWidth="1.5">
          <circle cx="100" cy="40" r="16" />
          <path d="M80 60 L120 60 L114 118 L86 118 Z" />
          <path d="M82 62 L52 94 L62 102 L86 76 Z" />
          <path d="M118 62 L148 94 L138 102 L114 76 Z" />
          <path d="M87 116 L76 172 L90 172 L99 122 Z" />
          <path d="M113 116 L124 172 L110 172 L101 122 Z" />
        </g>
      </svg>

      {pose === 'gk_save' && (
        <span className="sr-only">Kaleci {jerseyNumber}</span>
      )}
    </div>
  );
};
