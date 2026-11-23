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
  const clamped = Math.max(0, Math.min(8, Math.floor(wrongGuessCount)));
  const steps = [14, 11.5, 9, 7, 5, 3.5, 2.2, 1.2, 0];
  return steps[clamped] ?? 0;
}

export interface SilhouetteClueSummary {
  team: {
    status: 'exact' | 'league' | 'unknown';
    label: string;
    clubId?: string;
    clubName?: string;
  };
  nationality: {
    status: 'exact' | 'unknown';
    label: string;
    country?: string;
    flag?: string;
  };
  position: {
    status: 'exact' | 'hint';
    label: string;
  };
  age: {
    status: 'exact' | 'range' | 'unknown';
    label: string;
    min?: number;
    max?: number;
  };
  shirtNumber: {
    status: 'exact' | 'range' | 'unknown';
    label: string;
    min?: number;
    max?: number;
  };
}

export function summarizeSilhouetteClues(
  guesses: SilhouetteGuessResult[],
  targetPlayerId: string
): SilhouetteClueSummary {
  const targetPlayer = PLAYERS[targetPlayerId];
  const targetAsset = getPlayerAsset(targetPlayerId);

  let teamExact = false;
  let teamLeague = false;
  let nationalityExact = false;
  let positionExact = false;
  let ageExact = false;
  let minAge: number | undefined;
  let maxAge: number | undefined;
  let shirtExact = false;
  let minShirt: number | undefined;
  let maxShirt: number | undefined;

  for (const g of guesses) {
    if (g.clubMatch === 'exact') teamExact = true;
    else if (g.clubMatch === 'same_league') teamLeague = true;

    if (g.nationalityMatch) nationalityExact = true;
    if (g.positionMatch) positionExact = true;

    if (g.ageDirection === 'exact') {
      ageExact = true;
    } else if (g.ageDirection === 'higher') {
      minAge = minAge === undefined ? g.age + 1 : Math.max(minAge, g.age + 1);
    } else if (g.ageDirection === 'lower') {
      maxAge = maxAge === undefined ? g.age - 1 : Math.min(maxAge, g.age - 1);
    }

    if (g.shirtDirection === 'exact') {
      shirtExact = true;
    } else if (g.shirtDirection === 'higher') {
      minShirt = minShirt === undefined ? g.shirtNumber + 1 : Math.max(minShirt, g.shirtNumber + 1);
    } else if (g.shirtDirection === 'lower') {
      maxShirt = maxShirt === undefined ? g.shirtNumber - 1 : Math.min(maxShirt, g.shirtNumber - 1);
    }
  }

  let ageStatus: 'exact' | 'range' | 'unknown' = 'unknown';
  let ageLabel = '?';
  if (ageExact || (minAge !== undefined && maxAge !== undefined && minAge === maxAge)) {
    ageStatus = 'exact';
    ageLabel = String(targetAsset.age);
  } else if (minAge !== undefined && maxAge !== undefined) {
    ageStatus = 'range';
    ageLabel = `${minAge}–${maxAge}`;
  } else if (minAge !== undefined) {
    ageStatus = 'range';
    ageLabel = `${minAge}+`;
  } else if (maxAge !== undefined) {
    ageStatus = 'range';
    ageLabel = `≤${maxAge}`;
  }

  let shirtStatus: 'exact' | 'range' | 'unknown' = 'unknown';
  let shirtLabel = '#?';
  if (shirtExact || (minShirt !== undefined && maxShirt !== undefined && minShirt === maxShirt)) {
    shirtStatus = 'exact';
    shirtLabel = `#${targetAsset.shirtNumber}`;
  } else if (minShirt !== undefined && maxShirt !== undefined) {
    shirtStatus = 'range';
    shirtLabel = `#${minShirt}–${maxShirt}`;
  } else if (minShirt !== undefined) {
    shirtStatus = 'range';
    shirtLabel = `>#${minShirt - 1}`;
  } else if (maxShirt !== undefined) {
    shirtStatus = 'range';
    shirtLabel = `<#${maxShirt + 1}`;
  }

  return {
    team: teamExact
      ? {
          status: 'exact',
          label: targetAsset.clubName,
          clubId: targetAsset.clubId,
          clubName: targetAsset.clubName,
        }
      : teamLeague
      ? {
          status: 'league',
          label: targetAsset.league,
        }
      : {
          status: 'unknown',
          label: '?',
        },
    nationality: nationalityExact && targetPlayer
      ? {
          status: 'exact',
          label: targetPlayer.nationality,
          country: targetPlayer.nationality,
          flag: targetPlayer.flag,
        }
      : {
          status: 'unknown',
          label: '?',
        },
    position: {
      status: positionExact ? 'exact' : 'hint',
      label: targetPlayer?.position || '?',
    },
    age: {
      status: ageStatus,
      label: ageLabel,
      min: minAge,
      max: maxAge,
    },
    shirtNumber: {
      status: shirtStatus,
      label: shirtLabel,
      min: minShirt,
      max: maxShirt,
    },
  };
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

/**
 * Akıllı arama: 2 veya daha fazla karakter girildiğinde Türkçe/İngilizce karakter duyarsız eşleşen
 * futbolcuları uyruk ve mevki bilgileriyle döndürür.
 */
export function searchPlayersForAutocomplete(
  rawQuery: string,
  excludePlayerIds: string[] = [],
  limit: number = 8
): Player[] {
  const normQuery = normalizeText(rawQuery);
  if (!normQuery || normQuery.length < 2) return [];
  return searchSilhouettePlayers(rawQuery, excludePlayerIds, limit);
}

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
