import React, { useId } from 'react';
import {
  ANIME_ARMBANDS,
  ANIME_AURAS,
  ANIME_EYE_COLORS,
  ANIME_HAIR_COLORS,
  ANIME_JERSEYS,
  ANIME_SKIN_TONES,
  AnimeAvatarConfig,
} from '../game/animeAvatarCatalog';

interface AnimeFootballerSvgProps {
  config: AnimeAvatarConfig;
  className?: string;
}

export const AnimeFootballerSvg: React.FC<AnimeFootballerSvgProps> = ({
  config,
  className = 'w-full h-full',
}) => {
  const uid = useId().replace(/:/g, '');
  const skin =
    ANIME_SKIN_TONES.find((s) => s.id === config.skinToneId) || ANIME_SKIN_TONES[1];
  const hairCol =
    ANIME_HAIR_COLORS.find((h) => h.id === config.hairColorId) || ANIME_HAIR_COLORS[0];
  const eyeCol =
    ANIME_EYE_COLORS.find((e) => e.id === config.eyeColorId) || ANIME_EYE_COLORS[1];
  const jersey =
    ANIME_JERSEYS.find((j) => j.id === config.jerseyId) || ANIME_JERSEYS[0];

  const skinFill = skin.swatch || '#F3C5A2';
  const skinShadow = skin.secondarySwatch || '#D49A73';
  const hairMain = hairCol.swatch || '#1E293B';
  const hairHi = hairCol.secondarySwatch || '#475569';
  const eyeFill = eyeCol.swatch || '#06B6D4';
  const jerseyMain = jersey.swatch || '#1D4ED8';
  const jerseySec = jersey.secondarySwatch || '#FFFFFF';

  const aura = config.auraId;
  const bgStart =
    aura === 'aura_golden_saiyan'
      ? '#451A03'
      : aura === 'aura_emerald_surge'
      ? '#064E3B'
      : aura === 'aura_blue_lightning'
      ? '#082F49'
      : '#0F172A';
  const bgEnd =
    aura === 'aura_golden_saiyan'
      ? '#D97706'
      : aura === 'aura_emerald_surge'
      ? '#059669'
      : aura === 'aura_blue_lightning'
      ? '#0284C7'
      : '#1E293B';

  const isWink = config.expressionId === 'wink';
  const isFierce = config.eyeStyleId === 'fierce';
  const isCalm = config.eyeStyleId === 'calm';
  const eyeHeight = isCalm ? 6.5 : 8.5;

  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bgStart} />
          <stop offset="100%" stopColor={bgEnd} />
        </linearGradient>
        <linearGradient id={`kit-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={jerseyMain} />
          <stop offset="100%" stopColor={jerseySec} stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* Layer 1: Stadium / Anime Aura Background */}
      <rect width="160" height="160" fill={`url(#bg-${uid})`} />
      {/* Subtle anime speed lines */}
      <g stroke="#FFFFFF" strokeOpacity={aura === 'aura_none' ? '0.07' : '0.18'} strokeWidth="2">
        <line x1="12" y1="18" x2="36" y2="42" />
        <line x1="148" y1="18" x2="124" y2="42" />
        <line x1="6" y1="78" x2="28" y2="78" />
        <line x1="154" y1="78" x2="132" y2="78" />
      </g>

      {aura === 'aura_blue_lightning' && (
        <g fill="none" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20,124 30,96 22,96 34,64" />
          <polyline points="140,124 130,96 138,96 126,64" />
          <circle cx="80" cy="82" r="56" stroke="#7DD3FC" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.7" />
        </g>
      )}
      {aura === 'aura_emerald_surge' && (
        <g fill="none" stroke="#34D399" strokeWidth="2.5">
          <path d="M22 145 Q12 96 34 52" strokeLinecap="round" />
          <path d="M138 145 Q148 96 126 52" strokeLinecap="round" />
          <circle cx="80" cy="78" r="58" stroke="#6EE7B7" strokeWidth="1.5" opacity="0.65" />
        </g>
      )}
      {aura === 'aura_golden_saiyan' && (
        <g>
          <path
            d="M22 152 L32 95 L20 75 L40 46 L52 62 L80 14 L108 62 L120 46 L140 75 L128 95 L138 152 Z"
            fill="#FBBF24"
            fillOpacity="0.22"
            stroke="#FDE047"
            strokeWidth="2"
          />
          <circle cx="30" cy="40" r="2.5" fill="#FEF08A" />
          <circle cx="132" cy="36" r="3" fill="#FEF08A" />
          <circle cx="122" cy="64" r="2" fill="#FFFFFF" />
        </g>
      )}

      {/* Layer 2: Back Hair (for long / afro / tsubasa styles) */}
      {config.hairStyleId === 'afro_power' && (
        <circle cx="80" cy="58" r="42" fill={hairMain} />
      )}
      {config.hairStyleId === 'long_samurai' && (
        <>
          <circle cx="80" cy="24" r="13" fill={hairMain} />
          <path d="M68 24 Q80 16 92 24" stroke={jerseySec} strokeWidth="3" fill="none" />
          <path d="M44 58 L36 106 L52 98 Z" fill={hairMain} />
          <path d="M116 58 L124 106 L108 98 Z" fill={hairMain} />
        </>
      )}
      {config.hairStyleId === 'braid_dreads' && (
        <g fill={hairMain}>
          <rect x="38" y="48" width="9" height="58" rx="4.5" />
          <rect x="46" y="44" width="9" height="62" rx="4.5" />
          <rect x="113" y="48" width="9" height="58" rx="4.5" />
          <rect x="105" y="44" width="9" height="62" rx="4.5" />
        </g>
      )}

      {/* Layer 3: Football Jersey / Kit */}
      <path
        d="M22 160 C24 128 42 114 64 110 L96 110 C118 114 136 128 138 160 Z"
        fill={jerseyMain}
        stroke="#0F172A"
        strokeWidth="2"
      />
      {/* Jersey diagonal accent stripe & V-neck */}
      <path d="M46 114 L58 160 L72 160 L58 111 Z" fill={jerseySec} fillOpacity="0.9" />
      <path d="M114 114 L102 160 L88 160 L102 111 Z" fill={jerseySec} fillOpacity="0.28" />
      <path d="M62 110 L80 128 L98 110" fill="#0F172A" fillOpacity="0.35" stroke={jerseySec} strokeWidth="2.5" strokeLinejoin="round" />

      {/* Captain Armband */}
      {config.armbandId !== 'armband_none' && (
        <g>
          <rect
            x="25"
            y="134"
            width="20"
            height="11"
            rx="3"
            transform="rotate(-14 35 140)"
            fill={
              ANIME_ARMBANDS.find((a) => a.id === config.armbandId)?.swatch || '#DC2626'
            }
            stroke="#FFFFFF"
            strokeWidth="1.4"
          />
          <text
            x="35"
            y="143"
            textAnchor="middle"
            fontSize="8"
            fontWeight="900"
            fill="#FFFFFF"
            transform="rotate(-14 35 140)"
          >
            {config.armbandId === 'armband_legend_crown' ? '★' : 'C'}
          </text>
        </g>
      )}

      {/* Layer 4: Neck & Sharp Anime Jawline */}
      <rect x="70" y="94" width="20" height="22" rx="6" fill={skinShadow} />
      {/* Ears */}
      <ellipse cx="47" cy="76" rx="5.5" ry="9" fill={skinShadow} />
      <ellipse cx="113" cy="76" rx="5.5" ry="9" fill={skinShadow} />
      {/* Angular Anime Head */}
      <path
        d="M49 56 C49 36 111 36 111 56 L110 80 C109 94 94 106 80 109 C66 106 51 94 50 80 Z"
        fill={skinFill}
        stroke="#0F172A"
        strokeWidth="1.8"
      />
      {/* Subtle anime cheek cel-shadow */}
      <path d="M51 82 C55 96 68 105 80 108 C71 104 59 95 55 83 Z" fill={skinShadow} opacity="0.6" />

      {/* Layer 5: Anime Eyes & Brows */}
      {/* Eyebrows */}
      <path
        d={
          config.eyeStyleId === 'calm'
            ? 'M56 64 Q64 62 72 64'
            : 'M55 61 L73 66'
        }
        stroke={hairMain === '#E2E8F0' ? '#475569' : hairMain}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={
          config.eyeStyleId === 'calm'
            ? 'M88 64 Q96 62 104 64'
            : 'M105 61 L87 66'
        }
        stroke={hairMain === '#E2E8F0' ? '#475569' : hairMain}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left Eye */}
      <ellipse cx="64" cy="74" rx="7.8" ry={eyeHeight} fill="#FFFFFF" />
      <circle cx="65" cy="74.5" r="5" fill={eyeFill} />
      <circle cx="65" cy="74.5" r="2.3" fill="#0F172A" />
      <circle cx="62.8" cy="72" r="1.7" fill="#FFFFFF" />
      {isFierce && (
        <circle cx="65" cy="74.5" r="6.2" fill="none" stroke={eyeFill} strokeWidth="1" opacity="0.7" />
      )}
      <path d="M55 72 Q64 66 73 72" stroke="#0F172A" strokeWidth="2.8" strokeLinecap="round" fill="none" />

      {/* Right Eye (or Wink) */}
      {isWink ? (
        <path
          d="M87 74 Q96 69 105 74"
          stroke="#0F172A"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <>
          <ellipse cx="96" cy="74" rx="7.8" ry={eyeHeight} fill="#FFFFFF" />
          <circle cx="95" cy="74.5" r="5" fill={eyeFill} />
          <circle cx="95" cy="74.5" r="2.3" fill="#0F172A" />
          <circle cx="92.8" cy="72" r="1.7" fill="#FFFFFF" />
          {isFierce && (
            <circle cx="95" cy="74.5" r="6.2" fill="none" stroke={eyeFill} strokeWidth="1" opacity="0.7" />
          )}
          <path d="M87 72 Q96 66 105 72" stroke="#0F172A" strokeWidth="2.8" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* Anime Nose Shadow */}
      <path d="M80 79 L78.5 85 L81.5 85.5" stroke={skinShadow} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* Mouth / Expression */}
      {config.expressionId === 'grin' && (
        <path
          d="M69 92 Q80 100 91 92 Q80 94 69 92 Z"
          fill="#FFFFFF"
          stroke="#0F172A"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
      {config.expressionId === 'smirk' && (
        <path
          d="M71 93 Q81 97 90 90"
          stroke="#0F172A"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {config.expressionId === 'focused' && (
        <path
          d="M72 93 L88 93"
          stroke="#0F172A"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {config.expressionId === 'wink' && (
        <path
          d="M70 92 Q80 99 90 91"
          stroke="#0F172A"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Layer 6: Front Hair / Dynamic Anime Spikes */}
      {config.hairStyleId === 'spiky_striker' && (
        <g>
          <path
            d="M44 62 L38 42 L53 45 L50 23 L68 35 L78 16 L90 34 L109 22 L106 44 L122 41 L115 62 L108 50 L98 60 L88 47 L78 62 L68 48 L56 59 Z"
            fill={hairMain}
            stroke="#0F172A"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M62 39 L76 26 L86 38" stroke={hairHi} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.7" />
        </g>
      )}
      {config.hairStyleId === 'tsubasa_sweep' && (
        <g>
          <path
            d="M45 64 C42 36 62 20 84 22 C108 24 120 40 115 64 L106 52 L92 60 L80 48 L64 60 L54 50 Z"
            fill={hairMain}
            stroke="#0F172A"
            strokeWidth="1.6"
          />
          <path d="M84 22 L106 16 L98 30" fill={hairMain} />
          <path d="M56 42 Q80 32 104 42" stroke={hairHi} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.65" />
        </g>
      )}
      {config.hairStyleId === 'side_part_ace' && (
        <g>
          <path
            d="M46 62 C44 34 64 24 84 24 C106 24 116 40 114 62 L104 48 C92 42 74 44 54 62 Z"
            fill={hairMain}
            stroke="#0F172A"
            strokeWidth="1.6"
          />
          <path d="M62 36 Q84 30 100 38" stroke={hairHi} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
        </g>
      )}
      {config.hairStyleId === 'curtain_playmaker' && (
        <g>
          <path
            d="M45 64 C44 32 64 22 80 24 C96 22 116 32 115 64 L104 54 C96 42 84 44 80 55 C76 44 64 42 56 54 Z"
            fill={hairMain}
            stroke="#0F172A"
            strokeWidth="1.6"
          />
        </g>
      )}
      {config.hairStyleId === 'afro_power' && (
        <path
          d="M47 54 Q64 42 80 48 Q96 42 113 54"
          fill={hairMain}
          stroke={hairHi}
          strokeWidth="2"
        />
      )}
      {config.hairStyleId === 'braid_dreads' && (
        <path
          d="M46 54 C48 30 112 30 114 54 C102 44 58 44 46 54 Z"
          fill={hairMain}
          stroke="#0F172A"
          strokeWidth="1.6"
        />
      )}
      {config.hairStyleId === 'buzz_captain' && (
        <path
          d="M49 54 C50 32 110 32 111 54 C98 46 62 46 49 54 Z"
          fill={hairMain}
          stroke="#0F172A"
          strokeWidth="1.5"
        />
      )}
      {config.hairStyleId === 'long_samurai' && (
        <path
          d="M47 58 C48 32 112 32 113 58 L104 46 L84 56 L76 45 L56 54 Z"
          fill={hairMain}
          stroke="#0F172A"
          strokeWidth="1.6"
        />
      )}

      {/* Layer 7: Sport Visors / Sunglasses */}
      {config.eyewearId === 'eyewear_cyber_visor' && (
        <g>
          <path
            d="M49 66 L111 66 L107 80 L84 78 L80 74 L76 78 L53 80 Z"
            fill="#06B6D4"
            fillOpacity="0.65"
            stroke="#A5F3FC"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line x1="56" y1="70" x2="72" y2="70" stroke="#FFFFFF" strokeWidth="1.8" opacity="0.8" />
        </g>
      )}
      {config.eyewearId === 'eyewear_gold_shades' && (
        <g>
          <rect x="51" y="66" width="24" height="14" rx="4" fill="#0F172A" fillOpacity="0.88" stroke="#FBBF24" strokeWidth="2.2" />
          <rect x="85" y="66" width="24" height="14" rx="4" fill="#0F172A" fillOpacity="0.88" stroke="#FBBF24" strokeWidth="2.2" />
          <line x1="75" y1="71" x2="85" y2="71" stroke="#FBBF24" strokeWidth="2.2" />
        </g>
      )}
      {config.eyewearId === 'eyewear_neon_goggles' && (
        <g>
          <rect x="46" y="70" width="68" height="5" fill="#1E293B" />
          <rect x="52" y="65" width="23" height="15" rx="6" fill="#F97316" fillOpacity="0.72" stroke="#FFFFFF" strokeWidth="2" />
          <rect x="85" y="65" width="23" height="15" rx="6" fill="#F97316" fillOpacity="0.72" stroke="#FFFFFF" strokeWidth="2" />
          <line x1="75" y1="72" x2="85" y2="72" stroke="#FFFFFF" strokeWidth="2.4" />
        </g>
      )}

      {/* Layer 8: Headbands / Caps */}
      {config.headwearId === 'headwear_striker_band' && (
        <g>
          <path d="M47 50 Q80 43 113 50 L113 58 Q80 51 47 58 Z" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.2" />
          <path d="M74 50 L86 50" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {config.headwearId === 'headwear_aero_cap' && (
        <g>
          <path d="M45 48 C48 24 112 24 115 48 Z" fill="#0F172A" stroke="#22C55E" strokeWidth="2" />
          <path d="M108 42 L134 45 L130 52 L106 49 Z" fill="#16A34A" stroke="#0F172A" strokeWidth="1.4" />
        </g>
      )}
      {config.headwearId === 'headwear_blue_flame' && (
        <g>
          <path d="M46 49 Q80 41 114 49 L114 58 Q80 50 46 58 Z" fill="#0284C7" stroke="#7DD3FC" strokeWidth="1.5" />
          <path d="M113 52 L134 46 L126 58 Z" fill="#38BDF8" />
        </g>
      )}
    </svg>
  );
};
