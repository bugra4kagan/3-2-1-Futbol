import { PLAYERS } from './database';
import { getPlayerAsset, PlayerAssetMeta } from './playerAssets';
import { Player } from './types';
import { normalizeText, validateAnswerForPlayerIds } from './validator';

export const MAX_SILHOUETTE_ATTEMPTS = 8;

export type SilhouetteClubMatch = 'exact' | 'same_league' | 'none';
export type SilhouetteNumericDirection = 'exact' | 'higher' | 'lower';

export interface SilhouetteGuessResult {
  guessedPlayer: Player;
  guessedAsset: PlayerAssetMeta;
  isCorrect: boolean;
  clubMatch: SilhouetteClubMatch;
  nationalityMatch: boolean;
  positionMatch: boolean;
  age: number;
  ageDirection: SilhouetteNumericDirection;
  shirtNumber: number;
  shirtDirection: SilhouetteNumericDirection;
}

export function getPortraitBlurPx(wrongGuessCount: number, revealed: boolean): number {
  if (revealed) return 0;
  return Math.max(8, 24 - wrongGuessCount * 2.5);
}

export function compareSilhouetteGuess(
  guessedPlayerId: string,
  targetPlayerId: string
): SilhouetteGuessResult | null {
  const guessedPlayer = PLAYERS[guessedPlayerId];
  const targetPlayer = PLAYERS[targetPlayerId];
  if (!guessedPlayer || !targetPlayer) return null;

  const guessedAsset = getPlayerAsset(guessedPlayerId);
  const targetAsset = getPlayerAsset(targetPlayerId);

  const isCorrect = guessedPlayer.id === targetPlayer.id;

  const sameClub =
    isCorrect ||
    normalizeText(guessedAsset.clubName) === normalizeText(targetAsset.clubName) ||
    Boolean(
      guessedAsset.clubId &&
        targetAsset.clubId &&
        guessedAsset.clubId === targetAsset.clubId &&
        guessedAsset.league === targetAsset.league
    );

  const clubMatch: SilhouetteClubMatch = sameClub
    ? 'exact'
    : guessedAsset.league === targetAsset.league
    ? 'same_league'
    : 'none';

  const nationalityMatch = guessedPlayer.nationality === targetPlayer.nationality;
  const positionMatch = guessedPlayer.position === targetPlayer.position;

  const ageDirection: SilhouetteNumericDirection =
    targetAsset.age === guessedAsset.age
      ? 'exact'
      : targetAsset.age > guessedAsset.age
      ? 'higher'
      : 'lower';

  const shirtDirection: SilhouetteNumericDirection =
    targetAsset.shirtNumber === guessedAsset.shirtNumber
      ? 'exact'
      : targetAsset.shirtNumber > guessedAsset.shirtNumber
      ? 'higher'
      : 'lower';

  return {
    guessedPlayer,
    guessedAsset,
    isCorrect,
    clubMatch,
    nationalityMatch,
    positionMatch,
    age: guessedAsset.age,
    ageDirection,
    shirtNumber: guessedAsset.shirtNumber,
    shirtDirection,
  };
}

const ALL_PLAYERS_LIST: Player[] = Object.values(PLAYERS);
const ALL_PLAYER_IDS: string[] = Object.keys(PLAYERS);

export function searchSilhouettePlayers(
  rawQuery: string,
  excludePlayerIds: string[] = [],
  limit: number = 8
): Player[] {
  const normQuery = normalizeText(rawQuery);
  if (!normQuery || normQuery.length < 1) return [];

  const excludeSet = new Set(excludePlayerIds);
  const scored: { player: Player; score: number }[] = [];

  for (const player of ALL_PLAYERS_LIST) {
    if (excludeSet.has(player.id)) continue;

    const normName = normalizeText(player.name);
    const normCommon = player.commonName ? normalizeText(player.commonName) : '';
    const normAliases = player.aliases.map(normalizeText);

    let score = 0;

    if (normName === normQuery || normCommon === normQuery) {
      score = 100;
    } else if (normName.startsWith(normQuery)) {
      score = 90;
    } else if (normName.split(' ').some((w) => w.startsWith(normQuery))) {
      score = 80;
    } else if (normCommon && normCommon.startsWith(normQuery)) {
      score = 75;
    } else if (normAliases.some((a) => a === normQuery)) {
      score = 72;
    } else if (normAliases.some((a) => a.startsWith(normQuery))) {
      score = 65;
    } else if (normName.includes(normQuery)) {
      score = 55;
    } else if (normAliases.some((a) => a.includes(normQuery))) {
      score = 45;
    }

    if (score > 0) {
      scored.push({ player, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
  return scored.slice(0, limit).map((s) => s.player);
}

export function resolveGuessedPlayerFromInput(
  rawInput: string,
  targetPlayerId?: string
): Player | null {
  const norm = normalizeText(rawInput);
  if (!norm || norm.length < 2) return null;

  // If the target player itself matches cleanly, prioritize exact target recognition
  if (targetPlayerId && PLAYERS[targetPlayerId]) {
    const targetMatch = validateAnswerForPlayerIds(rawInput, [targetPlayerId]);
    if (targetMatch.isValid && targetMatch.player) {
      return targetMatch.player;
    }
  }

  // Exact full name or commonName match across all players
  for (const player of ALL_PLAYERS_LIST) {
    if (
      normalizeText(player.name) === norm ||
      (player.commonName && normalizeText(player.commonName) === norm)
    ) {
      return player;
    }
  }

  // Top autocomplete match when unambiguous
  const searched = searchSilhouettePlayers(rawInput, [], 3);
  if (searched.length === 1) {
    return searched[0];
  }

  // Exact alias match across all players
  for (const player of ALL_PLAYERS_LIST) {
    if (player.aliases.some((a) => normalizeText(a) === norm)) {
      return player;
    }
  }

  // General fuzzy validation across database
  const anyMatch = validateAnswerForPlayerIds(rawInput, ALL_PLAYER_IDS);
  return anyMatch.isValid ? anyMatch.player : searched[0] || null;
}
