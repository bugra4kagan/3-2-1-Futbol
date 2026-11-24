import React, { useId } from 'react';
import { Club, Player, SilhouettePose } from '../game/types';
import { PlayerAssetMeta } from '../game/playerAssets';
import { PlayerAvatar } from './PlayerAvatar';
import { ClubBadge } from './ClubBadge';

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

const POSITION_TR_LABELS: Record<Player['position'], string> = {
  GK: 'Kaleci',
  DF: 'Defans',
  MF: 'Orta Saha',
  FW: 'Forvet',
};

export const SilhouetteSvg: React.FC<SilhouetteSvgProps> = ({
  pose,
  jerseyNumber,
  player = null,
  asset = null,
  club = null,
  revealed = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const positionLabel = player?.position
    ? `${POSITION_TR_LABELS[player.position]} (${player.position})`
    : 'Bilinmiyor';
  const leagueLabel = asset?.league || player?.league || 'Uluslararası';
  const clubCount = player?.careerHistory?.length
    ? new Set(player.careerHistory.map((c) => c.club.toLowerCase())).size
    : 1;
  const thirdClueLabel =
    clubCount > 1 ? `Kariyer: ${clubCount} Kulüp` : `Forma #${jerseyNumber}`;

  if (revealed) {
    return (
      <div
        data-testid="silhouette-portrait-frame"
        data-revealed="true"
        className="relative mx-auto inline-flex items-center justify-center select-none"
      >
        <PlayerAvatar
          player={player}
          jerseyNumber={jerseyNumber}
          size="card"
          variant="card"
          showHud={true}
          isHiddenName={false}
          blurPx={0}
          className="border-2 border-emerald-400/75 shadow-2xl"
        />

        {(club || asset?.clubName) && (
          <div className="absolute top-12 left-2.5 z-30 p-1 rounded-xl bg-slate-950/92 border border-emerald-400/45 shadow-lg">
            <ClubBadge
              club={club}
              clubId={asset?.clubId}
              clubName={asset?.clubName}
              size="xs"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="silhouette-portrait-frame"
      data-revealed="false"
      className="relative mx-auto w-64 sm:w-72 rounded-2xl bg-gradient-to-br from-[#090d16] via-[#131836] to-[#1e1b4b] border-2 border-cyan-400/55 shadow-[0_0_28px_rgba(6,182,212,0.22)] p-3 select-none overflow-hidden"
    >
      {/* Top Status Strip */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="px-2 py-0.5 rounded-lg bg-slate-950/90 border border-amber-400/55 text-amber-300 text-[10px] font-black tracking-wider whitespace-nowrap">
          ? GİZLİ FUTBOLCU
        </span>
        <span className="px-2 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 text-[10px] font-black tracking-wide whitespace-nowrap">
          {player?.era ? player.era : 'AKTİF YILDIZ'}
        </span>
      </div>

      {/* Crisp Zero-Blur Neon Silhouette Figure */}
      <div
        data-testid="silhouette-mystery-figure"
        className="relative mx-auto w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center"
      >
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full"
          role="img"
          aria-label="Gizli Futbolcu Silüeti"
        >
          <defs>
            <linearGradient id={`sil-ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id={`sil-body-${uid}`} x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#090d16" />
            </linearGradient>
            <filter id={`sil-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#06b6d4" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Sharp geometric tactical hexagon backdrop */}
          <polygon
            points="80,8 144,44 144,116 80,152 16,116 16,44"
            fill="#0b1120"
            stroke={`url(#sil-ring-${uid})`}
            strokeWidth="2.2"
          />
          <polygon
            points="80,16 136,48 136,112 80,144 24,112 24,48"
            fill="none"
            stroke="#38bdf8"
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Sharp-edged Player Bust Silhouette */}
          <g filter={`url(#sil-glow-${uid})`}>
            {/* Shoulders & Athletic Torso */}
            <path
              d="M 32 138 C 35 108 50 96 68 92 L 92 92 C 110 96 125 108 128 138 L 80 150 Z"
              fill={`url(#sil-body-${uid})`}
              stroke="#22d3ee"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Neck */}
            <rect x="70" y="76" width="20" height="20" rx="4" fill="#0f172a" />
            {/* Head */}
            <ellipse
              cx="80"
              cy="56"
              rx="23"
              ry="27"
              fill={`url(#sil-body-${uid})`}
              stroke="#22d3ee"
              strokeWidth="2"
            />
            {/* Crisp Neon ? Emblem */}
            <text
              x="80"
              y="62"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#fbbf24"
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 900,
                fontSize: '34px',
              }}
            >
              ?
            </text>
          </g>
        </svg>
      </div>

      {/* 3 Starting Clues Inside Mystery Card */}
      <div
        data-testid="silhouette-starting-clues"
        className="mt-2 grid grid-cols-1 gap-1.5 text-left"
      >
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-500/35">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Mevki
          </span>
          <span className="text-[11px] font-black text-cyan-300 truncate">
            {positionLabel}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-amber-500/35">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Lig
          </span>
          <span className="text-[11px] font-black text-amber-300 truncate">
            {leagueLabel}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-emerald-500/35">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            İpucu
          </span>
          <span className="text-[11px] font-black text-emerald-300 truncate tabular-nums">
            {thirdClueLabel}
          </span>
        </div>
      </div>

      {pose === 'gk_save' && (
        <span className="sr-only">Kaleci {jerseyNumber}</span>
      )}
    </div>
  );
};
