import { MATCH_PAIRINGS, PLAYERS } from './database';
import {
  CAREER_CHALLENGES,
  COUNTRY_CLUB_CHALLENGES,
  SILHOUETTE_CHALLENGES,
  XOX_BOARDS,
} from './minigamesData';
import { isSouthAmericaLocalOnlyPlayer } from './minigameEngine';
import { serializeAnimeAvatar, DEFAULT_ANIME_AVATAR_CONFIG } from './animeAvatarCatalog';
import {
  BotDifficulty,
  MinigameRoundPayload,
  MinigameType,
} from './types';

export const ONLINE_MATCHMAKING_FALLBACK_MS = 4000;

export function sanitizeRtdbKey(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[.#$/[\]]/g, '_');
  return cleaned || `player_${Date.now()}`;
}

export function generateSixCharRoomCode(rng: () => number = Math.random): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(rng() * chars.length)];
  }
  return code;
}

/** Deterministic PRNG so host & guest get identical shuffled rounds from questionSeed */
export function createSeededRng(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 123456789;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSeededRoundIds(
  minigameType: MinigameType,
  count: number = 12,
  seed: number = Date.now()
): string[] {
  const rng = createSeededRng(seed);
  let poolIds: string[] = [];

  if (minigameType === 'two_clubs') {
    poolIds = MATCH_PAIRINGS.map((p) => p.id);
  } else if (minigameType === 'silhouette') {
    poolIds = SILHOUETTE_CHALLENGES.filter(
      (s) => !isSouthAmericaLocalOnlyPlayer(PLAYERS[s.playerId])
    ).map((s) => s.id);
  } else if (minigameType === 'career') {
    poolIds = CAREER_CHALLENGES.filter(
      (c) => !isSouthAmericaLocalOnlyPlayer(PLAYERS[c.playerId])
    ).map((c) => c.id);
  } else if (minigameType === 'country_club') {
    poolIds = COUNTRY_CLUB_CHALLENGES.map((cc) => cc.id);
  } else {
    poolIds = XOX_BOARDS.map((b) => b.id);
  }

  const copy = [...poolIds];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

export function resolveRoundPayloadById(
  minigameType: MinigameType,
  roundId: string
): MinigameRoundPayload | null {
  if (minigameType === 'two_clubs') {
    const pairing = MATCH_PAIRINGS.find((p) => p.id === roundId) || MATCH_PAIRINGS[0];
    return pairing ? { minigameType: 'two_clubs', pairing } : null;
  }
  if (minigameType === 'silhouette') {
    const silhouette =
      SILHOUETTE_CHALLENGES.find((s) => s.id === roundId) || SILHOUETTE_CHALLENGES[0];
    return silhouette ? { minigameType: 'silhouette', silhouette } : null;
  }
  if (minigameType === 'career') {
    const career = CAREER_CHALLENGES.find((c) => c.id === roundId) || CAREER_CHALLENGES[0];
    return career ? { minigameType: 'career', career } : null;
  }
  if (minigameType === 'country_club') {
    const countryClub =
      COUNTRY_CLUB_CHALLENGES.find((cc) => cc.id === roundId) || COUNTRY_CLUB_CHALLENGES[0];
    return countryClub ? { minigameType: 'country_club', countryClub } : null;
  }
  const xoxBoard = XOX_BOARDS.find((b) => b.id === roundId) || XOX_BOARDS[0];
  return xoxBoard ? { minigameType: 'xox', xoxBoard } : null;
}

export interface SmartBotOpponent {
  id: string;
  name: string;
  avatar: string;
  difficulty: BotDifficulty;
}

const SMART_BOT_PROFILES: Omit<SmartBotOpponent, 'difficulty'>[] = [
  {
    id: 'rtdb_bot_emre10',
    name: 'Emre10_GS',
    avatar: serializeAnimeAvatar({
      ...DEFAULT_ANIME_AVATAR_CONFIG,
      hairStyleId: 'spiky_striker',
      hairColorId: 'crimson',
      jerseyId: 'jersey_crimson_striker',
      auraId: 'aura_blue_lightning',
    }),
  },
  {
    id: 'rtdb_bot_keremfb',
    name: 'KaptanKerem',
    avatar: 'pp:ferdi_kadioglu',
  },
  {
    id: 'rtdb_bot_mertpro',
    name: 'MertTaktik',
    avatar: serializeAnimeAvatar({
      ...DEFAULT_ANIME_AVATAR_CONFIG,
      hairStyleId: 'tsubasa_sweep',
      hairColorId: 'electric_blue',
      eyewearId: 'eyewear_cyber_visor',
      jerseyId: 'jersey_royal_galaxy',
    }),
  },
  {
    id: 'rtdb_bot_ardabjk',
    name: 'KartalArda9',
    avatar: 'pp:kenan_yildiz',
  },
  {
    id: 'rtdb_bot_canertr',
    name: 'CanerScout',
    avatar: 'pp:hakan_calhanoglu',
  },
  {
    id: 'rtdb_bot_emirx',
    name: 'EmirGolcu',
    avatar: serializeAnimeAvatar({
      ...DEFAULT_ANIME_AVATAR_CONFIG,
      hairStyleId: 'curtain_playmaker',
      hairColorId: 'gold_blonde',
      jerseyId: 'jersey_emerald_ace',
      armbandId: 'armband_neon_cap',
    }),
  },
];

export function pickSmartBotOpponent(rng: () => number = Math.random): SmartBotOpponent {
  const chosen =
    SMART_BOT_PROFILES[Math.floor(rng() * SMART_BOT_PROFILES.length)] ||
    SMART_BOT_PROFILES[0];
  const roll = rng();
  const difficulty: BotDifficulty =
    roll < 0.25 ? 'easy' : roll < 0.8 ? 'medium' : 'hard';
  return {
    ...chosen,
    difficulty,
  };
}
