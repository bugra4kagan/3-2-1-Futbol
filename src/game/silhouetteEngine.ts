import rawPlayersData from '../data/players.json';
import { PLAYERS } from './database';
import { EXTRA_PLAYERS_50 } from './extraPlayers50';
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

let ALL_PLAYERS_LIST: Player[] = [];
let ALL_PLAYER_IDS: string[] = [];

interface IndexedPlayerSearchEntry {
  player: Player;
  normName: string;
  nameWords: string[];
  normCommon: string;
  normAliases: string[];
  popularityScore: number;
}

// Capture the 3,049 curated base players at module load before the 25k expansion hydrates PLAYERS.
const BASE_CURATED_PLAYER_IDS = new Set<string>(Object.keys(PLAYERS));

const TURKISH_BIG_FOUR_CLUB_IDS = new Set<string>([
  'galatasaray',
  'fenerbahce',
  'besiktas',
  'trabzonspor',
]);

const GLOBAL_ELITE_CLUB_IDS = new Set<string>([
  'real_madrid',
  'barcelona',
  'manchester_united',
  'manchester_city',
  'liverpool',
  'arsenal',
  'chelsea',
  'bayern_munich',
  'psg',
  'juventus',
  'ac_milan',
  'inter_milan',
  'atletico_madrid',
  'borussia_dortmund',
  'tottenham',
  'ajax',
  'benfica',
  'porto',
  'napoli',
  'as_roma',
  'sevilla',
]);

// Curated household-star priority map from players.json + EXTRA_PLAYERS_50.
const HOUSEHOLD_STAR_RANK_BY_ID = new Map<string, number>();
(rawPlayersData as Array<{ id?: string }>).forEach((item, idx, arr) => {
  if (item?.id && !HOUSEHOLD_STAR_RANK_BY_ID.has(item.id)) {
    HOUSEHOLD_STAR_RANK_BY_ID.set(item.id, 1200 + (arr.length - idx));
  }
});
EXTRA_PLAYERS_50.forEach((item, idx, arr) => {
  if (item?.id && !HOUSEHOLD_STAR_RANK_BY_ID.has(item.id)) {
    HOUSEHOLD_STAR_RANK_BY_ID.set(item.id, 1050 + (arr.length - idx));
  }
});

const ICONIC_SUPERSTAR_BOOST: Record<string, number> = {
  cristiano_ronaldo: 600,
  lionel_messi: 590,
  ronaldo_nazario: 520,
  ronaldinho_gaucho: 500,
  ronaldinho: 500,
  neymar_jr: 470,
  neymar: 470,
  kylian_mbappe: 465,
  erling_haaland: 460,
  mohamed_salah: 455,
  zlatan_ibrahimovic: 450,
  arda_guler: 450,
  mauro_icardi: 445,
  victor_osimhen: 445,
  lamine_yamal: 445,
  zinedine_zidane: 445,
  diego_maradona: 445,
  pele: 445,
  arda_turan: 440,
  hakan_calhanoglu: 440,
  vinicius_junior: 440,
  jude_bellingham: 440,
  mesut_ozil: 435,
  wesley_sneijder: 435,
  alex_de_souza: 435,
  robert_lewandowski: 435,
  luka_modric: 435,
  fernando_muslera: 430,
  kevin_de_bruyne: 430,
  karim_benzema: 430,
  kaka: 430,
  thierry_henry: 430,
  didier_drogba: 430,
  roberto_carlos: 430,
  david_beckham: 430,
  luis_suarez: 430,
  harry_kane: 425,
  kenan_yildiz: 425,
  jamal_musiala: 425,
  angel_di_maria: 425,
  gianluigi_buffon: 425,
  paolo_maldini: 425,
  wayne_rooney: 425,
  andres_iniesta: 425,
  xavi_hernandez: 425,
  ferdi_kadioglu: 420,
  dries_mertens: 420,
  edin_dzeko: 420,
  ngolo_kante: 420,
  thomas_muller: 420,
  manuel_neuer: 420,
  sergio_ramos: 420,
  gareth_bale: 420,
  antoine_griezmann: 420,
  eden_hazard: 420,
  virgil_van_dijk: 420,
  rodri: 420,
  bukayo_saka: 420,
  pedri: 420,
  bruno_fernandes: 420,
  lautaro_martinez: 420,
  paulo_dybala: 420,
  sadio_mane: 420,
  leroy_sane: 418,
  kerem_akturkoglu: 415,
  baris_alper_yilmaz: 415,
  dusan_tadic: 415,
  burak_yilmaz: 415,
  sabri_sarioglu: 410,
  semih_senturk: 410,
};

export function computePlayerPopularityScore(player: Player): number {
  let score = 0;

  const starRank = HOUSEHOLD_STAR_RANK_BY_ID.get(player.id);
  if (starRank !== undefined) {
    score += starRank;
  } else if (BASE_CURATED_PLAYER_IDS.has(player.id)) {
    score += 450;
  }

  const iconicBoost = ICONIC_SUPERSTAR_BOOST[player.id];
  if (iconicBoost) {
    score += iconicBoost;
  }

  let turkishClubBonus = 0;
  let globalClubBonus = 0;
  const seenClubIds = new Set<string>();
  if (player.clubId) seenClubIds.add(player.clubId);
  if (player.careerHistory) {
    for (let i = 0; i < player.careerHistory.length; i += 1) {
      const cid = player.careerHistory[i]?.clubId;
      if (cid) seenClubIds.add(cid);
    }
  }
  seenClubIds.forEach((cid) => {
    if (TURKISH_BIG_FOUR_CLUB_IDS.has(cid)) {
      turkishClubBonus += 25;
    } else if (GLOBAL_ELITE_CLUB_IDS.has(cid)) {
      globalClubBonus += 18;
    }
  });
  score += Math.min(75, turkishClubBonus);
  score += Math.min(90, globalClubBonus);

  if (player.commonName) {
    score += 25;
  }
  if (player.aliases && player.aliases.length > 0) {
    score += Math.min(40, player.aliases.length * 12);
  }
  if (seenClubIds.size > 0) {
    score += Math.min(40, seenClubIds.size * 6);
  }

  return score;
}

let PRECOMPUTED_PLAYER_SEARCH: IndexedPlayerSearchEntry[] = [];
let PLAYER_BIGRAM_INDEX: Map<string, number[]> = new Map();

export function rebuildPlayerSearchIndex(sourcePlayers?: readonly Player[]): number {
  const list = sourcePlayers ? [...sourcePlayers] : Object.values(PLAYERS);
  ALL_PLAYERS_LIST = list;
  ALL_PLAYER_IDS = list.map((p) => p.id);

  PRECOMPUTED_PLAYER_SEARCH = list.map((player) => {
    const normName = normalizeText(player.name);
    return {
      player,
      normName,
      nameWords: normName.split(' ').filter(Boolean),
      normCommon: player.commonName ? normalizeText(player.commonName) : '',
      normAliases: (player.aliases || []).map(normalizeText),
      popularityScore: computePlayerPopularityScore(player),
    };
  });

  const map = new Map<string, number[]>();
  const addStringBigrams = (str: string, idx: number, seenForPlayer: Set<string>) => {
    if (!str || str.length < 2) return;
    for (let i = 0; i < str.length - 1; i += 1) {
      const bg = str.slice(i, i + 2);
      if (bg.includes(' ') || seenForPlayer.has(bg)) continue;
      seenForPlayer.add(bg);
      let bucket = map.get(bg);
      if (!bucket) {
        bucket = [];
        map.set(bg, bucket);
      }
      bucket.push(idx);
    }
  };

  for (let i = 0; i < PRECOMPUTED_PLAYER_SEARCH.length; i += 1) {
    const entry = PRECOMPUTED_PLAYER_SEARCH[i];
    const seen = new Set<string>();
    addStringBigrams(entry.normName, i, seen);
    addStringBigrams(entry.normCommon, i, seen);
    for (const alias of entry.normAliases) {
      addStringBigrams(alias, i, seen);
    }
  }
  PLAYER_BIGRAM_INDEX = map;
  return ALL_PLAYERS_LIST.length;
}

export function getSearchIndexSize(): number {
  return ALL_PLAYERS_LIST.length;
}

rebuildPlayerSearchIndex();

function getCandidateIndicesForQuery(normQuery: string): number[] | null {
  const tokens = normQuery.split(' ').filter((t) => t.length >= 2);
  if (tokens.length === 0) return null;
  const buckets: number[][] = [];
  for (const tok of tokens) {
    for (let i = 0; i < tok.length - 1; i += 1) {
      const bucket = PLAYER_BIGRAM_INDEX.get(tok.slice(i, i + 2));
      if (!bucket || bucket.length === 0) return [];
      buckets.push(bucket);
    }
  }
  if (buckets.length === 0) return null;
  buckets.sort((a, b) => a.length - b.length);
  let result = buckets[0];
  // Intersect top smallest sorted buckets (since insertion order i is strictly increasing!)
  const maxIntersectBuckets = Math.min(buckets.length, 4);
  for (let bIdx = 1; bIdx < maxIntersectBuckets && result.length > 24; bIdx += 1) {
    const other = buckets[bIdx];
    const next: number[] = [];
    let i = 0;
    let j = 0;
    while (i < result.length && j < other.length) {
      if (result[i] === other[j]) {
        next.push(result[i]);
        i += 1;
        j += 1;
      } else if (result[i] < other[j]) {
        i += 1;
      } else {
        j += 1;
      }
    }
    result = next;
    if (result.length === 0) return [];
  }
  return result;
}

/**
 * Akıllı arama: 2 veya daha fazla karakter girildiğinde Türkçe/İngilizce karakter duyarsız eşleşen
 * futbolcuları uyruk ve mevki bilgileriyle döndürür.
 */
export function searchPlayersForAutocomplete(
  rawQuery: string,
  excludePlayerIds: string[] = [],
  limit: number = 6
): Player[] {
  const normQuery = normalizeText(rawQuery);
  if (!normQuery || normQuery.length < 2) return [];
  return searchSilhouettePlayers(rawQuery, excludePlayerIds, limit);
}

export function searchSilhouettePlayers(
  rawQuery: string,
  excludePlayerIds: string[] = [],
  limit: number = 6
): Player[] {
  const normQuery = normalizeText(rawQuery);
  if (!normQuery || normQuery.length < 1) return [];

  const excludeSet = excludePlayerIds.length > 0 ? new Set(excludePlayerIds) : null;
  const indexedIndices = normQuery.length >= 2 ? getCandidateIndicesForQuery(normQuery) : null;
  if (indexedIndices && indexedIndices.length === 0) return [];

  const scored: { player: Player; matchTier: number; subRank: number }[] = [];
  const totalCount = indexedIndices ? indexedIndices.length : PRECOMPUTED_PLAYER_SEARCH.length;

  for (let k = 0; k < totalCount; k += 1) {
    const entry = PRECOMPUTED_PLAYER_SEARCH[indexedIndices ? indexedIndices[k] : k];
    const { player, normName, nameWords, normCommon, normAliases, popularityScore } = entry;
    if (excludeSet && excludeSet.has(player.id)) continue;

    let matchTier = 0;
    let subRank = 0;

    const isExactName = normName === normQuery;
    const isExactCommon = Boolean(normCommon) && normCommon === normQuery;
    const isExactAlias = normAliases.some((a) => a === normQuery);
    const isExactWord = normQuery.length >= 3 && nameWords.includes(normQuery);

    if (isExactName && normQuery.includes(' ')) {
      // Tier 3: Full multi-word exact match (e.g. "cristiano ronaldo", "ronaldo guiaro")
      matchTier = 3;
      subRank = popularityScore + 500;
    } else if (isExactName || isExactCommon || isExactAlias || isExactWord) {
      // Tier 2 (Exact single-token / alias / word match):
      // Combines exact-match bonus with popularityScore so global stars ("Cristiano Ronaldo", "Ronaldo Nazário")
      // always outrank obscure mononyms ("Ronaldo") while exact superstars ("Rodri", "Kaká", "Pelé") stay #1.
      matchTier = 2;
      subRank =
        popularityScore +
        (isExactName ? 450 : isExactCommon ? 320 : isExactAlias ? 310 : 300);
    } else {
      const isFullPrefix = normName.startsWith(normQuery);
      const isWordPrefix = nameWords.some((w) => w.startsWith(normQuery));
      const isCommonPrefix = Boolean(normCommon && normCommon.startsWith(normQuery));
      const isAliasPrefix = normAliases.some((a) => a.startsWith(normQuery));

      if (isFullPrefix || isWordPrefix || isCommonPrefix || isAliasPrefix) {
        // Tier 2 (Prefix match): Shares Tier 2 with single-word exact matches so mid-typing queries
        // like "ronald" still keep Cristiano Ronaldo, Ronaldo Nazário & Ronaldinho ahead of obscure "Ronald ..." players.
        matchTier = 2;
        subRank =
          popularityScore +
          (isFullPrefix ? 120 : isWordPrefix ? 100 : isCommonPrefix ? 90 : 80);
      } else {
        const isNameSub = normName.includes(normQuery);
        const isCommonSub = Boolean(normCommon && normCommon.includes(normQuery));
        const isAliasSub = normAliases.some((a) => a.includes(normQuery));

        if (isNameSub || isCommonSub || isAliasSub) {
          // Tier 1: Other / substring matches ranked by popularity first.
          matchTier = 1;
          subRank = popularityScore + (isNameSub ? 20 : isCommonSub ? 15 : 5);
        }
      }
    }

    if (matchTier > 0) {
      scored.push({ player, matchTier, subRank });
    }
  }

  scored.sort((a, b) =>
    b.matchTier !== a.matchTier
      ? b.matchTier - a.matchTier
      : b.subRank !== a.subRank
      ? b.subRank - a.subRank
      : a.player.name < b.player.name
      ? -1
      : a.player.name > b.player.name
      ? 1
      : 0
  );
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
