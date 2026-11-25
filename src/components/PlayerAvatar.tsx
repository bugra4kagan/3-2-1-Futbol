import React, { useId } from 'react';
import { resolvePlayerAppearance } from '../game/appearanceResolver';
import { PLAYERS } from '../game/database';
import { getFrameClasses } from '../game/storeCatalog';
import { Player, PlayerAppearance } from '../game/types';
import { DEFAULT_STARTER_AVATAR } from '../game/avatarCatalog';
import { normalizeProfileIconId } from '../game/profileIcons';
import { parseAnimeAvatar } from '../game/animeAvatarCatalog';
import { AnimeFootballerSvg } from './AnimeFootballerSvg';
import { CountryFlag } from './CountryFlag';
import { ProfileIconSvg } from './ProfileIconSvg';

export interface PlayerAvatarProps {
  player?: Player | null;
  appearance?: PlayerAppearance;
  avatar?: string;
  name?: string;
  jerseyNumber?: number;
  nationality?: string;
  flag?: string;
  position?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'card';
  variant?: 'rounded' | 'circle' | 'card';
  frame?: string;
  showHud?: boolean;
  isHiddenName?: boolean;
  blurPx?: number;
  className?: string;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function adjustHex(hex: string, factor: number, lift = 0): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return hex;
  const r = clampByte(parseInt(clean.slice(0, 2), 16) * factor + lift);
  const g = clampByte(parseInt(clean.slice(2, 4), 16) * factor + lift);
  const b = clampByte(parseInt(clean.slice(4, 6), 16) * factor + lift);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = React.memo(({
  player = null,
  appearance,
  avatar = DEFAULT_STARTER_AVATAR,
  name,
  jerseyNumber,
  nationality,
  flag,
  position,
  size = 'md',
  variant = 'rounded',
  frame,
  showHud,
  isHiddenName = false,
  blurPx = 0,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');

  // Resolve player entity when caller passes avatar="pp:<playerId>"
  const resolvedPlayer: Player | null =
    player || (avatar?.startsWith('pp:') ? PLAYERS[avatar.slice(3)] || null : null);

  const displayName = name || resolvedPlayer?.name || 'Oyuncu';
  const resolvedNumber = jerseyNumber ?? resolvedPlayer?.shirtNumber;
  const resolvedNationality = nationality ?? resolvedPlayer?.nationality;
  const resolvedFlag = flag ?? resolvedPlayer?.flag;
  const resolvedPosition = position ?? resolvedPlayer?.position;

  const resolvedAppearance: PlayerAppearance = appearance
    ? appearance
    : resolvePlayerAppearance(
        resolvedPlayer || {
          name: displayName,
          nationality: resolvedNationality,
        },
        displayName
      );

  const isCardMode = size === 'card' || variant === 'card';
  const shouldShowHud = showHud ?? isCardMode;
  const animeAvatarConfig = !resolvedPlayer && !appearance ? parseAnimeAvatar(avatar) : null;
  const isCustomEmojiAvatar = Boolean(
    !resolvedPlayer && !appearance && !animeAvatarConfig && avatar && !avatar.startsWith('pp:')
  );

  const boxSizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12 sm:w-14 sm:h-14',
    xl: 'w-14 h-14 sm:w-16 sm:h-16',
    card: 'w-44 h-52 sm:w-52 sm:h-60',
  };

  const iconFontSizeMap = {
    xs: 'text-sm',
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    card: 'text-6xl',
  };

  const radiusClass =
    variant === 'circle'
      ? 'rounded-full'
      : isCardMode
      ? 'rounded-2xl'
      : size === 'xs'
      ? 'rounded-lg'
      : size === 'sm'
      ? 'rounded-xl'
      : 'rounded-2xl';

  const frameClasses = getFrameClasses(frame);

  // For user profile badges (whenever no explicit `player` or `appearance` prop is passed),
  // render one of the 10 uniform vector football profile icons (falling back to 'ball').
  if (!player && !appearance) {
    const isBotBadge = avatar === '🤖' || avatar === 'bot';
    const iconSvgSizeMap = {
      xs: 'w-4 h-4',
      sm: 'w-5 h-5',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
      xl: 'w-9 h-9',
      card: 'w-20 h-20',
    };
    return (
      <div
        data-testid={isCardMode ? 'player-avatar-card' : 'player-avatar'}
        data-avatar-id={isBotBadge ? 'bot' : normalizeProfileIconId(avatar)}
        role="img"
        aria-label={`${displayName} profil simgesi`}
        className={`relative overflow-hidden shrink-0 select-none bg-[#16212E] border border-[#A8B3C2]/30 flex items-center justify-center ${boxSizeMap[size]} ${radiusClass} ${frameClasses} ${className}`}
      >
        <ProfileIconSvg
          iconId={isBotBadge ? 'bot' : avatar}
          isBot={isBotBadge}
          className={`relative z-10 ${iconSvgSizeMap[size]}`}
        />
      </div>
    );
  }

  // Palette derivations for cel-shading & multi-layer highlights
  const skinBase = resolvedAppearance.skinTone || '#e8b490';
  const skinShadow = adjustHex(skinBase, 0.72);
  const skinDeepShadow = adjustHex(skinBase, 0.54);
  const skinHighlight = adjustHex(skinBase, 0.92, 24);

  const hairBase = resolvedAppearance.hairColor || '#1e293b';
  const hairDark = adjustHex(hairBase, 0.56);
  const hairHighlight = adjustHex(hairBase, 0.95, 58);
  const hairRim = adjustHex(hairBase, 1.0, 92);

  const jerseyPrimary = resolvedAppearance.jerseyColors?.[0] || '#1d4ed8';
  const jerseySecondary = resolvedAppearance.jerseyColors?.[1] || '#06b6d4';
  const jerseyShadow = adjustHex(jerseyPrimary, 0.55);
  const jerseyLight = adjustHex(jerseyPrimary, 0.9, 28);

  const eyeBase = resolvedAppearance.eyeColor || '#78350f';
  const eyeDark = adjustHex(eyeBase, 0.48);
  const eyeBright = adjustHex(eyeBase, 1.0, 55);
  const signature = resolvedAppearance.signature || 'none';

  const safeBlur = Math.max(0, blurPx);

  return (
    <div
      data-testid={isCardMode ? 'player-avatar-card' : 'player-avatar'}
      className={`relative overflow-hidden shrink-0 select-none bg-[#090d16] shadow-lg ${boxSizeMap[size]} ${radiusClass} ${frameClasses} ${className}`}
    >
      {/* Neon Outer Chamfered Glow Border (not blurred even during Mystery Blur mode) */}
      {isCardMode && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 rounded-2xl border border-cyan-400/55 shadow-[inset_0_0_18px_rgba(236,72,153,0.22),0_0_22px_rgba(6,182,212,0.24)]"
        />
      )}

      {/* Portrait SVG Layer (receives CSS progressive blur in Who Are Ya mode) */}
      <div
        className="w-full h-full transition-[filter,transform] duration-300"
        style={
          safeBlur > 0
            ? {
                filter: `blur(${safeBlur}px) saturate(1.12)`,
                transform: `scale(${(1 + safeBlur * 0.006).toFixed(3)})`,
              }
            : undefined
        }
      >
        <svg
          viewBox="0 0 220 260"
          preserveAspectRatio={isCardMode ? 'xMidYMid slice' : 'xMidYMin slice'}
          className="w-full h-full block"
          role="img"
          aria-label={isHiddenName ? 'Gizli Futbolcu Portresi' : `${displayName} e-spor kartı`}
        >
          <defs>
            {/* Deep space navy -> electric purple card depth background */}
            <linearGradient id={`pa-bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#090d16" />
              <stop offset="48%" stopColor="#17133a" />
              <stop offset="78%" stopColor="#6d28d9" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#090d16" />
            </linearGradient>

            {/* Radial hero spotlight behind silhouette */}
            <radialGradient id={`pa-spot-${uid}`} cx="52%" cy="38%" r="55%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
              <stop offset="45%" stopColor="#6d28d9" stopOpacity="0.32" />
              <stop offset="80%" stopColor="#ec4899" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#090d16" stopOpacity="0" />
            </radialGradient>

            {/* Outer neon frame stroke gradient */}
            <linearGradient id={`pa-neon-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            {/* Diagonal carbon micro-grid */}
            <pattern id={`pa-carbon-${uid}`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <rect width="12" height="12" fill="transparent" />
              <line x1="0" y1="0" x2="0" y2="12" stroke="#ffffff" strokeOpacity="0.045" strokeWidth="2" />
              <line x1="6" y1="0" x2="6" y2="12" stroke="#06b6d4" strokeOpacity="0.04" strokeWidth="1" />
            </pattern>

            {/* Jersey shading */}
            <linearGradient id={`pa-jersey-${uid}`} x1="15%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor={jerseyLight} />
              <stop offset="45%" stopColor={jerseyPrimary} />
              <stop offset="100%" stopColor={jerseyShadow} />
            </linearGradient>

            {/* Skin cel gradient */}
            <linearGradient id={`pa-skin-${uid}`} x1="20%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor={skinHighlight} />
              <stop offset="52%" stopColor={skinBase} />
              <stop offset="100%" stopColor={skinShadow} />
            </linearGradient>

            {/* Hair depth gradient */}
            <linearGradient id={`pa-hair-${uid}`} x1="15%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor={hairHighlight} />
              <stop offset="35%" stopColor={hairBase} />
              <stop offset="100%" stopColor={hairDark} />
            </linearGradient>

            {/* Anime Iris radial gradient */}
            <radialGradient id={`pa-iris-${uid}`} cx="45%" cy="40%" r="55%">
              <stop offset="0%" stopColor={eyeBright} />
              <stop offset="58%" stopColor={eyeBase} />
              <stop offset="100%" stopColor={eyeDark} />
            </radialGradient>

            {/* Commander / Viking / Legend Aura gradients */}
            <linearGradient id={`pa-gold-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>

            <linearGradient id={`pa-viking-aura-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="55%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            {/* Character rim drop shadow */}
            <filter id={`pa-drop-${uid}`} x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#020617" floodOpacity="0.85" />
              <feDropShadow dx="-2" dy="0" stdDeviation="3" floodColor="#06b6d4" floodOpacity="0.35" />
              <feDropShadow dx="2" dy="0" stdDeviation="3" floodColor="#ec4899" floodOpacity="0.3" />
            </filter>

            {/* Card Chamfer Clip */}
            <clipPath id={`pa-card-clip-${uid}`}>
              <path d="M 12 3 L 208 3 L 217 14 L 217 246 L 206 257 L 14 257 L 3 246 L 3 14 Z" />
            </clipPath>
          </defs>

          <g clipPath={isCardMode ? `url(#pa-card-clip-${uid})` : undefined}>
            {/* 1. Background Layers */}
            <rect width="220" height="260" fill={`url(#pa-bg-${uid})`} />
            <rect width="220" height="260" fill={`url(#pa-carbon-${uid})`} />
            <rect width="220" height="260" fill={`url(#pa-spot-${uid})`} />

            {/* Diagonal stadium laser light streaks */}
            <g opacity="0.55">
              <polygon points="-20,210 175,-20 198,-20 3,210" fill="#06b6d4" fillOpacity="0.12" />
              <polygon points="35,270 235,30 245,30 45,270" fill="#ec4899" fillOpacity="0.14" />
              <line x1="-10" y1="190" x2="165" y2="-10" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.55" />
              <line x1="65" y1="270" x2="235" y2="65" stroke="#ec4899" strokeWidth="1.4" strokeOpacity="0.5" />
            </g>

            {/* Geometric e-sports energy hexagon behind shoulders */}
            <polygon
              points="110,24 184,66 184,154 110,196 36,154 36,66"
              fill="none"
              stroke={
                signature === 'viking'
                  ? `url(#pa-viking-aura-${uid})`
                  : signature === 'legend_crown' || signature === 'commander'
                  ? `url(#pa-gold-${uid})`
                  : `url(#pa-neon-${uid})`
              }
              strokeOpacity={signature !== 'none' ? '0.52' : '0.28'}
              strokeWidth={signature !== 'none' ? '2' : '1.5'}
            />

            {/* Signature Background Energy (Viking frost bolts / Commander aura / Keeper shield) */}
            {signature === 'viking' && (
              <g opacity="0.65">
                <polyline points="26,70 48,92 34,114 58,136" fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="194,68 172,92 186,115 162,138" fill="none" stroke="#7dd3fc" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            {signature === 'commander' && (
              <g opacity="0.55">
                <polygon points="110,16 122,42 98,42" fill="#f59e0b" fillOpacity="0.4" />
                <path d="M 32 148 L 52 126 M 188 148 L 168 126" stroke="#f59e0b" strokeWidth="2.6" strokeLinecap="round" />
              </g>
            )}
            {signature === 'keeper_aura' && (
              <path
                d="M 48 56 L 110 34 L 172 56 L 172 132 C 172 164 140 186 110 196 C 80 186 48 164 48 132 Z"
                fill="none"
                stroke="#10b981"
                strokeOpacity="0.45"
                strokeWidth="2.2"
                strokeDasharray="6 4"
              />
            )}

            {/* 2. Hero-Angle Cel-Shaded Anime Character */}
            <g filter={`url(#pa-drop-${uid})`}>
              {/* Back hair silhouette layer for long hair */}
              {resolvedAppearance.hairStyle === 'long-blonde' && (
                <path
                  d="M 60 80 C 46 112 45 154 58 182 L 154 184 C 165 152 162 110 148 76 Z"
                  fill={hairDark}
                />
              )}

              {/* Athletic Shoulders & Jersey Torso (Hero 3/4 Angle) */}
              <path
                d="M 18 265 C 22 204 42 178 78 168 L 146 170 C 180 178 198 206 204 265 Z"
                fill={`url(#pa-jersey-${uid})`}
                stroke="#090d16"
                strokeWidth="2"
              />

              {/* Jersey Secondary Athletic Shoulder Panels & Dynamic Folds */}
              <path
                d="M 25 256 C 30 206 47 183 78 173 L 88 181 C 62 198 52 225 50 256 Z"
                fill={jerseySecondary}
                fillOpacity="0.92"
              />
              <path
                d="M 148 175 C 175 186 190 212 195 256 L 176 256 C 172 226 162 199 140 183 Z"
                fill={jerseySecondary}
                fillOpacity="0.88"
              />

              {/* Crisp diagonal jersey cel-shading folds */}
              <path
                d="M 62 196 C 82 212 104 220 132 224 L 122 256 L 54 256 Z"
                fill="#020617"
                fillOpacity="0.22"
              />
              <path
                d="M 148 200 C 158 214 162 232 163 256 L 142 256 C 142 234 140 215 148 200 Z"
                fill="#020617"
                fillOpacity="0.28"
              />
              {/* Specular jersey shoulder highlight */}
              <path
                d="M 38 206 C 46 190 59 180 76 175"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.38"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Athletic V-Neck / Polo Collar Trim (Zero Brand Logos) */}
              <path
                d="M 76 167 L 114 198 L 148 170 L 140 162 L 114 185 L 85 161 Z"
                fill={jerseySecondary}
                stroke="#090d16"
                strokeWidth="1.5"
              />
              <path
                d="M 85 163 L 114 187 L 141 164"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.7"
                strokeWidth="1.8"
              />

              {/* Neck + Sharp Anime Chin Cel-Shadow */}
              <path
                d="M 86 138 L 90 168 L 114 186 L 139 166 L 138 136 Z"
                fill={skinBase}
              />
              {/* Sharp triangular chin shadow on neck */}
              <path
                d="M 88 138 L 138 138 L 137 156 C 122 164 102 162 89 152 Z"
                fill={skinDeepShadow}
              />
              {/* Neck side tendon cel-shadow */}
              <path
                d="M 122 148 L 138 144 L 139 166 L 123 176 Z"
                fill={skinShadow}
                fillOpacity="0.75"
              />

              {/* Left Near Ear (3/4 Hero Angle) */}
              <path
                d="M 65 103 C 56 102 54 119 60 129 C 64 134 69 133 72 128 Z"
                fill={skinShadow}
                stroke="#090d16"
                strokeWidth="1.6"
              />
              <path
                d="M 62 110 C 59 113 60 122 65 125"
                fill="none"
                stroke={skinDeepShadow}
                strokeWidth="1.5"
                strokeLinecap="round"
              />

              {/* Sculpted Hero-Angle Anime Head / Jawline */}
              <path
                d="M 68 82 C 68 55 92 42 118 44 C 145 46 158 67 156 96 C 155 117 148 134 134 146 C 124 155 112 157 100 153 C 83 147 71 131 68 112 Z"
                fill={`url(#pa-skin-${uid})`}
                stroke="#090d16"
                strokeWidth="1.8"
              />

              {/* Cheek & Jaw Cel-Shading Plane */}
              <path
                d="M 134 94 C 149 95 155 108 152 125 C 147 140 132 152 114 154 C 127 144 135 129 136 112 Z"
                fill={skinShadow}
                fillOpacity="0.65"
              />
              {/* Cheekbone anime rim highlight */}
              <path
                d="M 76 122 C 80 134 90 144 104 147"
                fill="none"
                stroke={skinHighlight}
                strokeOpacity="0.55"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Stylized Minimalist Anime Nose Shadow & Confident Mouth */}
              <polygon points="122,114 128,124 120,126" fill={skinDeepShadow} fillOpacity="0.72" />
              <path
                d="M 105 137 Q 118 139 128 134"
                fill="none"
                stroke="#090d16"
                strokeOpacity="0.75"
                strokeWidth="2.1"
                strokeLinecap="round"
              />

              {/* 3. Facial Hair Layer (4 Variants) */}
              {resolvedAppearance.facialHair === 'stubble' && (
                <path
                  d="M 74 126 C 80 142 94 152 112 154 C 132 153 147 141 151 124 C 142 135 130 141 115 142 C 98 143 84 137 74 126 Z"
                  fill={hairDark}
                  fillOpacity="0.42"
                />
              )}
              {resolvedAppearance.facialHair === 'beard' && (
                <g>
                  <path
                    d="M 70 116 C 72 140 90 157 115 157 C 138 156 152 139 154 115 C 147 129 136 138 119 140 C 98 141 82 133 70 116 Z"
                    fill={hairDark}
                    stroke="#090d16"
                    strokeWidth="1.2"
                  />
                  {/* Mustache connect */}
                  <path
                    d="M 102 131 Q 118 128 134 132 L 130 137 Q 117 134 104 136 Z"
                    fill={hairBase}
                  />
                  {/* Beard highlight */}
                  <path
                    d="M 94 147 Q 114 152 132 145"
                    fill="none"
                    stroke={hairHighlight}
                    strokeOpacity="0.55"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </g>
              )}
              {resolvedAppearance.facialHair === 'mustache' && (
                <path
                  d="M 102 131 Q 119 126 135 131 Q 130 137 118 134 Q 108 136 102 131 Z"
                  fill={hairDark}
                />
              )}

              {/* 4. Hair Layer — All 7 Styles with Multi-Layer Highlights */}
              {resolvedAppearance.hairStyle === 'short-fade' && (
                <g>
                  {/* Tapered fade side */}
                  <path
                    d="M 65 102 C 63 76 74 52 96 42 L 96 64 C 78 68 71 84 71 102 Z"
                    fill={hairDark}
                    fillOpacity="0.85"
                  />
                  {/* Sculpted top swept volume */}
                  <path
                    d="M 67 84 C 66 52 92 31 124 34 C 148 36 164 52 162 72 C 154 62 140 58 122 61 C 102 64 84 70 72 86 Z"
                    fill={`url(#pa-hair-${uid})`}
                    stroke="#090d16"
                    strokeWidth="1.6"
                  />
                  {/* Spiky bangs & specular ribbons */}
                  <path
                    d="M 88 50 Q 118 39 148 48"
                    fill="none"
                    stroke={hairRim}
                    strokeOpacity="0.65"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 102 58 Q 128 50 152 58"
                    fill="none"
                    stroke={hairHighlight}
                    strokeOpacity="0.7"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {resolvedAppearance.hairStyle === 'messy-medium' && (
                <g>
                  {/* Dynamic Blue Lock swept jagged locks */}
                  <path
                    d="M 62 104 C 55 68 76 34 114 31 C 148 29 170 50 165 86 L 154 78 L 150 96 L 138 74 L 128 96 L 116 70 L 98 95 L 91 74 L 74 96 Z"
                    fill={`url(#pa-hair-${uid})`}
                    stroke="#090d16"
                    strokeWidth="1.6"
                  />
                  {/* Multi-layer hair highlight streaks */}
                  <path
                    d="M 84 48 Q 116 36 146 47"
                    fill="none"
                    stroke={hairRim}
                    strokeOpacity="0.72"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 76 62 Q 108 50 138 60"
                    fill="none"
                    stroke={hairHighlight}
                    strokeOpacity="0.65"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {resolvedAppearance.hairStyle === 'curly-afro' && (
                <g>
                  {/* Dense sculptural curly crown */}
                  <path
                    d="M 59 102 C 47 86 50 61 65 49 C 72 30 96 22 117 26 C 140 22 162 35 166 56 C 176 69 171 91 157 101 C 149 78 134 65 114 66 C 90 66 74 79 68 102 Z"
                    fill={`url(#pa-hair-${uid})`}
                    stroke="#090d16"
                    strokeWidth="1.8"
                  />
                  {/* Layered curl pockets & highlights */}
                  <circle cx="88" cy="48" r="11" fill={hairBase} stroke={hairDark} strokeWidth="1.2" />
                  <circle cx="114" cy="40" r="13" fill={hairBase} stroke={hairDark} strokeWidth="1.2" />
                  <circle cx="140" cy="49" r="11" fill={hairBase} stroke={hairDark} strokeWidth="1.2" />
                  <path
                    d="M 80 42 Q 92 34 104 40 M 106 33 Q 120 27 132 35 M 134 42 Q 146 38 154 47"
                    fill="none"
                    stroke={hairRim}
                    strokeOpacity="0.7"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {resolvedAppearance.hairStyle === 'braided-bun' && (
                <g>
                  {/* Back braided top knot */}
                  <circle
                    cx="78"
                    cy="42"
                    r="17"
                    fill={hairDark}
                    stroke="#090d16"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M 67 36 Q 78 30 89 37 M 66 44 Q 78 39 90 45"
                    fill="none"
                    stroke={hairRim}
                    strokeOpacity="0.6"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Cornrow/braided scalp ridges swept back */}
                  <path
                    d="M 66 96 C 65 62 90 36 124 38 C 148 40 160 58 158 84 C 144 68 124 61 102 64 C 84 67 74 78 70 96 Z"
                    fill={`url(#pa-hair-${uid})`}
                    stroke="#090d16"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M 84 56 Q 112 45 144 54 M 78 68 Q 108 56 142 64"
                    fill="none"
                    stroke={hairHighlight}
                    strokeOpacity="0.78"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  {/* Loose anime front strand */}
                  <path
                    d="M 140 60 Q 152 78 145 96"
                    fill="none"
                    stroke={hairBase}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {resolvedAppearance.hairStyle === 'long-blonde' && (
                <g>
                  {/* Flowing golden/long locks framing left & crown */}
                  <path
                    d="M 62 112 C 55 72 74 34 116 33 C 149 33 166 56 162 92 L 154 148 L 146 108 C 142 82 126 67 104 68 C 82 69 72 90 70 128 L 58 148 Z"
                    fill={`url(#pa-hair-${uid})`}
                    stroke="#090d16"
                    strokeWidth="1.6"
                  />
                  {/* Multi-strand golden sheen ribbons */}
                  <path
                    d="M 82 48 Q 116 36 146 50"
                    fill="none"
                    stroke={hairRim}
                    strokeOpacity="0.85"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 68 86 C 64 106 64 128 62 146"
                    fill="none"
                    stroke={hairHighlight}
                    strokeOpacity="0.8"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {resolvedAppearance.hairStyle === 'buzzcut' && (
                <g>
                  <path
                    d="M 67 95 C 67 59 89 41 118 42 C 145 43 159 61 157 90 C 148 72 132 63 112 63 C 90 63 75 74 68 95 Z"
                    fill={`url(#pa-hair-${uid})`}
                    stroke="#090d16"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 86 52 Q 115 44 140 53"
                    fill="none"
                    stroke={hairHighlight}
                    strokeOpacity="0.48"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {resolvedAppearance.hairStyle === 'bald' && (
                <g>
                  {/* Crisp specular shine arcs on sculpted cranium */}
                  <path
                    d="M 86 56 Q 108 46 130 53"
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity="0.52"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <circle cx="80" cy="61" r="2.2" fill="#ffffff" fillOpacity="0.55" />
                </g>
              )}

              {/* 5. Expressive Blue Lock / Cel-Shaded Anime Eyes (Visor-Free!) */}
              <g data-testid="anime-eyes">
                {/* Left eye (near 3/4 perspective) */}
                <path
                  d="M 80 104 Q 93 96 105 103 Q 99 113 83 111 Z"
                  fill="#f8fafc"
                  stroke="#090d16"
                  strokeWidth="1.5"
                />
                {/* Top lid shadow */}
                <path d="M 81 104 Q 93 97 104 103" fill="none" stroke="#94a3b8" strokeWidth="1.8" />
                {/* Iris & pupil */}
                <circle cx="94" cy="105" r="5.3" fill={`url(#pa-iris-${uid})`} stroke="#090d16" strokeWidth="0.9" />
                <circle cx="94.5" cy="105.2" r="2.5" fill="#090d16" />
                {/* Dual anime catchlights */}
                <circle cx="92.2" cy="102.8" r="1.7" fill="#ffffff" />
                <circle cx="96.5" cy="107.2" r="0.9" fill="#ffffff" fillOpacity="0.9" />
                {/* Sharp top anime lash */}
                <path
                  d="M 78 104 Q 92 94 107 102"
                  fill="none"
                  stroke="#090d16"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />

                {/* Right eye (far 3/4 perspective) */}
                <path
                  d="M 122 102 Q 135 95 147 101 Q 143 111 124 110 Z"
                  fill="#f8fafc"
                  stroke="#090d16"
                  strokeWidth="1.5"
                />
                <path d="M 123 102 Q 135 96 146 101" fill="none" stroke="#94a3b8" strokeWidth="1.8" />
                <circle cx="135" cy="103.8" r="5.1" fill={`url(#pa-iris-${uid})`} stroke="#090d16" strokeWidth="0.9" />
                <circle cx="135.5" cy="104" r="2.4" fill="#090d16" />
                <circle cx="133.2" cy="101.6" r="1.6" fill="#ffffff" />
                <circle cx="137.4" cy="105.8" r="0.85" fill="#ffffff" fillOpacity="0.9" />
                <path
                  d="M 120 101 Q 135 93 149 100"
                  fill="none"
                  stroke="#090d16"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />

                {/* Confident anime eyebrows */}
                <path
                  d="M 77 95 Q 92 89 106 95"
                  fill="none"
                  stroke={hairDark}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <path
                  d="M 121 94 Q 135 88 148 93"
                  fill="none"
                  stroke={hairDark}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </g>

              {/* 6. Signature Footballer Traits (Osimhen Mask, Haaland Viking Band, Headband, Legend Crown, Commander Crest) */}
              {signature === 'mask' && (
                <g data-testid="signature-mask">
                  {/* Carbon-fiber protective face mask (Osimhen style) with clear eye cutouts */}
                  <path
                    d="M 69 94 C 74 87 95 86 112 91 C 128 86 146 86 155 93 L 154 115 C 145 119 131 119 124 115 L 118 126 L 108 125 L 103 115 C 94 120 79 121 70 116 Z"
                    fill="#0f172a"
                    fillOpacity="0.92"
                    stroke="#38bdf8"
                    strokeOpacity="0.55"
                    strokeWidth="1.2"
                    fillRule="evenodd"
                  />
                  {/* Re-draw crisp anime eyes brightly on top of mask eye openings */}
                  <path d="M 80 104 Q 93 96 105 103 Q 99 113 83 111 Z" fill="#f8fafc" stroke="#020617" strokeWidth="1.4" />
                  <circle cx="94" cy="105" r="5.1" fill={`url(#pa-iris-${uid})`} />
                  <circle cx="94.5" cy="105.2" r="2.4" fill="#090d16" />
                  <circle cx="92.2" cy="102.8" r="1.6" fill="#ffffff" />
                  <path d="M 122 102 Q 135 95 147 101 Q 143 111 124 110 Z" fill="#f8fafc" stroke="#020617" strokeWidth="1.4" />
                  <circle cx="135" cy="103.8" r="4.9" fill={`url(#pa-iris-${uid})`} />
                  <circle cx="135.5" cy="104" r="2.3" fill="#090d16" />
                  <circle cx="133.2" cy="101.6" r="1.5" fill="#ffffff" />
                  {/* Mask nose-bridge bevel highlight */}
                  <path d="M 109 94 L 115 94 L 114 119 L 110 119 Z" fill="#334155" fillOpacity="0.7" />
                </g>
              )}

              {(signature === 'headband' || signature === 'viking') && (
                <g data-testid={`signature-${signature}`}>
                  <path
                    d="M 68 83 Q 112 71 156 80 L 156 89 Q 112 80 68 92 Z"
                    fill={signature === 'viking' ? '#0284c7' : jerseySecondary}
                    stroke="#090d16"
                    strokeWidth="1.3"
                  />
                  <path
                    d="M 76 85 Q 112 76 148 83"
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity="0.65"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  {signature === 'viking' && (
                    /* Trailing Nordic headband ribbons on left */
                    <path
                      d="M 68 86 L 52 98 L 58 103 L 70 91 Z"
                      fill="#38bdf8"
                      stroke="#090d16"
                      strokeWidth="1.1"
                    />
                  )}
                </g>
              )}

              {signature === 'commander' && (
                <g data-testid="signature-commander">
                  {/* Golden commander lapel chevrons on jersey collar */}
                  <polygon points="84,180 94,174 96,181 86,187" fill={`url(#pa-gold-${uid})`} />
                  <polygon points="142,181 132,175 130,182 140,188" fill={`url(#pa-gold-${uid})`} />
                </g>
              )}

              {signature === 'legend_crown' && (
                <g data-testid="signature-legend-crown">
                  {/* Stylized golden champion crown crest floating subtly above crown */}
                  <polygon
                    points="92,26 98,13 110,21 122,13 128,26"
                    fill={`url(#pa-gold-${uid})`}
                    stroke="#090d16"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                  <circle cx="110" cy="21" r="1.8" fill="#ffffff" />
                </g>
              )}
            </g>

            {/* Chamfered inner metallic card trim */}
            {isCardMode && (
              <path
                d="M 12 3 L 208 3 L 217 14 L 217 246 L 206 257 L 14 257 L 3 246 L 3 14 Z"
                fill="none"
                stroke={`url(#pa-neon-${uid})`}
                strokeWidth="2.5"
              />
            )}
          </g>
        </svg>
      </div>

      {/* Custom Emoji Badge (for standard user/bot emoji avatars like ⚽, 🔥, 🦁) */}
      {isCustomEmojiAvatar && !shouldShowHud && (
        <span
          aria-hidden="true"
          className="absolute bottom-0.5 right-0.5 z-20 flex items-center justify-center rounded-full bg-slate-950/90 border border-cyan-400/60 shadow text-[9px] leading-none w-4 h-4"
        >
          {avatar}
        </span>
      )}

      {/* HUD OVERLAYS: Top Country Flag + Number/Position + Bottom Glassmorphism Name Bar */}
      {shouldShowHud && (
        <>
          {/* Top-left: Country Flag or Tactical Mask Badge */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1">
            {isHiddenName ? (
              <div className="px-2 py-0.5 rounded-lg bg-slate-950/85 border border-amber-400/55 text-amber-300 text-[10px] font-black tracking-wider shadow">
                ? GİZLİ
              </div>
            ) : (
              (resolvedNationality || resolvedFlag) && (
                <div className="p-1 rounded-xl bg-slate-950/92 border border-white/20 shadow-lg">
                  <CountryFlag
                    country={resolvedNationality}
                    flag={resolvedFlag}
                    size="sm"
                    variant="circle"
                  />
                </div>
              )
            )}
          </div>

          {/* Top-right: Position + Jersey Number or Mystery '?' Badge */}
          <div className="absolute top-2.5 right-2.5 z-20">
            {isHiddenName ? (
              <div className="w-7 h-7 rounded-lg bg-slate-950/90 border border-amber-400/60 text-amber-300 font-black text-sm flex items-center justify-center shadow-lg">
                ?
              </div>
            ) : (
              (resolvedPosition || resolvedNumber) && (
                <div className="px-2 py-1 rounded-xl bg-slate-950/92 border border-cyan-400/45 flex items-center gap-1 shadow-lg">
                  {resolvedPosition && (
                    <span className="text-[10px] font-black text-cyan-300 leading-none">
                      {resolvedPosition}
                    </span>
                  )}
                  {resolvedNumber ? (
                    <span className="text-[10px] font-mono font-black text-pink-300 leading-none">
                      #{resolvedNumber}
                    </span>
                  ) : null}
                </div>
              )
            )}
          </div>

          {/* Bottom Dark Glass-Style Name & Number Bar (Zero blur for 60 FPS) */}
          <div className="absolute bottom-0 inset-x-0 z-20 px-2.5 py-2 bg-slate-950/92 border-t border-cyan-400/35 flex items-center justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-white truncate">
              {isHiddenName ? '???' : displayName}
            </span>
            <span className="text-[11px] font-mono font-black text-cyan-300 shrink-0">
              {isHiddenName ? '#?' : resolvedNumber ? `#${resolvedNumber}` : isCustomEmojiAvatar ? avatar : ''}
            </span>
          </div>
        </>
      )}
    </div>
  );
});
