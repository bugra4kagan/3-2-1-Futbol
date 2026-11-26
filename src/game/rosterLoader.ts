import { CLUBS, CURATED_MATCH_PAIRINGS, MATCH_PAIRINGS, PLAYERS, PLAYERS_LIST } from './database';
import {
  buildExpandedCareerChallenges,
  buildExpandedCountryClubChallenges,
  buildExpandedMatchPairings,
  buildExpandedXoxBoards,
  extractCareerEndYear,
  extractCareerStartYear,
  isCareerChronologyVerified,
  isReserveOrYouthClubName,
  normalizeCareerYearRange,
  sortAndCleanCareerHistory,
} from './expandedQuestionPools';
import {
  CAREER_CHALLENGES,
  COUNTRY_CLUB_CHALLENGES,
  CURATED_CAREER_CHALLENGES,
  CURATED_COUNTRY_CLUB_CHALLENGES,
  CURATED_XOX_BOARDS,
  XOX_BOARDS,
} from './minigamesData';
import { DEFAULT_PLAYER_PHOTO, PLAYER_ASSETS } from './playerAssets';
import {
  PLAYER_ID_ALIASES,
  ROSTER_DATA_VERSION,
  resolveCanonicalPlayerId,
  setPlayerIdAliases,
} from './rosterVersion';
import { rebuildPlayerSearchIndex } from './silhouetteEngine';
import { CareerHistoryEntry, Club, Player } from './types';
import { invalidateValidatorIndexCache } from './validator';

export {
  PLAYER_ID_ALIASES,
  ROSTER_DATA_VERSION,
  resolveCanonicalPlayerId,
  normalizeCareerYearRange,
  extractCareerStartYear,
  extractCareerEndYear,
  isCareerChronologyVerified,
  sortAndCleanCareerHistory,
};

export const DEFAULT_ROSTER_LICENSE_ATTRIBUTION =
  'Oyuncu ve kulüp temel meta verileri OpenFootball players.db (CC0 1.0), Wikidata (CC0 1.0) ve Wikipedia futbolcu biyografileri (CC BY-SA 4.0) kaynaklarından türetilmiştir.';

export type ExistingUpdateTuple =
  | [string, number, string, number, Array<[number, string]>, string[]]
  | [
      string,
      number,
      string,
      number,
      Array<[number, string]>,
      string[],
      string[]?,
      ('active' | 'retired' | 'legend' | null)?,
      boolean?,
    ];

export interface CompactRosterPayload {
  version: string;
  generatedAt?: string;
  licenseAttribution?: string;
  playerAliases?: Record<string, string>;
  stats?: {
    basePlayerCount?: number;
    addedPlayerCount?: number;
    totalPlayerCount?: number;
    baseClubCount?: number;
    addedClubCount?: number;
    totalClubCount?: number;
    verifiedCareerRepairsApplied?: number;
    verifiedTransfersApplied?: number;
    youthFlagsFixed?: number;
    questionEligibleAddedCount?: number;
    duplicatesMergedCount?: number;
    nationalitiesNormalizedCount?: number;
    malformedYearsFixedCount?: number;
  };
  pos: Array<'GK' | 'DF' | 'MF' | 'FW'>;
  nat: Array<[string, string]>;
  leagues: string[];
  clubIds: string[];
  // [id, name, shortName, natIdx, primary, secondary, accent, founded, stadium]
  addedClubs: Array<[string, string, string, number, string, string, string, number, string]>;
  // [playableClubIdIdxOrMinus1, clubName, natIdx]
  clubDict: Array<[number, string, number]>;
  existingUpdates: ExistingUpdateTuple[];
  // [id, name, aliases, natIdx, posIdx, age, currentClubDictIdx, leagueIdx, seniorPlayableClubIndices, [[clubDictIdx, years], ...], statusCode, qFlag, srcMeta]
  players: Array<
    [
      string,
      string,
      string[],
      number,
      number,
      number,
      number,
      number,
      number[],
      Array<[number, string]>,
      number,
      number,
      string,
    ]
  >;
}

export interface RosterHydrationStatus {
  hydrated: boolean;
  version: string;
  licenseAttribution: string;
  totalPlayers: number;
  totalClubs: number;
  verifiedCareerRepairsApplied: number;
  verifiedTransfersApplied: number;
  youthFlagsFixed: number;
  questionEligibleCount: number;
  answerPoolCount: number;
}

export const QUESTION_ELIGIBLE_PLAYER_IDS = new Set<string>(
  PLAYERS_LIST.map((p) => p.id)
);

let rosterHydrated = false;
let activeRosterVersion = ROSTER_DATA_VERSION;
let activeLicenseAttribution = DEFAULT_ROSTER_LICENSE_ATTRIBUTION;
let lastStats = {
  verifiedCareerRepairsApplied: 0,
  verifiedTransfersApplied: 0,
  youthFlagsFixed: 0,
};
let inflightLoadPromise: Promise<RosterHydrationStatus> | null = null;

export function isPlayerQuestionEligible(playerId: string): boolean {
  return QUESTION_ELIGIBLE_PLAYER_IDS.has(resolveCanonicalPlayerId(playerId));
}

export function getRosterHydrationStatus(): RosterHydrationStatus {
  return {
    hydrated: rosterHydrated,
    version: activeRosterVersion,
    licenseAttribution: activeLicenseAttribution,
    totalPlayers: PLAYERS_LIST.length,
    totalClubs: Object.keys(CLUBS).length,
    verifiedCareerRepairsApplied: lastStats.verifiedCareerRepairsApplied,
    verifiedTransfersApplied: lastStats.verifiedTransfersApplied,
    youthFlagsFixed: lastStats.youthFlagsFixed,
    questionEligibleCount: QUESTION_ELIGIBLE_PLAYER_IDS.size,
    answerPoolCount: PLAYERS_LIST.length,
  };
}

function mergeAliases(target: string[], additions: readonly string[], primaryName: string): void {
  const seen = new Set(target.map((a) => a.trim().toLowerCase()));
  const primaryLower = primaryName.trim().toLowerCase();
  for (const raw of additions) {
    const clean = String(raw || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (key === primaryLower || seen.has(key)) continue;
    seen.add(key);
    target.push(clean);
  }
}

export function hydrateCompactRoster(data: CompactRosterPayload): RosterHydrationStatus {
  if (rosterHydrated) {
    return getRosterHydrationStatus();
  }

  activeRosterVersion = data.version || ROSTER_DATA_VERSION;
  if (data.licenseAttribution) {
    activeLicenseAttribution = data.licenseAttribution;
  }

  setPlayerIdAliases(data.playerAliases);
  for (const legacyId of Object.keys(PLAYER_ID_ALIASES)) {
    QUESTION_ELIGIBLE_PLAYER_IDS.delete(legacyId);
  }

  // 1. Register playable clubs with procedural SVG colors (existing 333 + 12 approved new = 345)
  for (const cTuple of data.addedClubs) {
    const [id, name, shortName, natIdx, primary, secondary, accent, founded, stadium] = cTuple;
    if (CLUBS[id]) continue;
    const natPair = data.nat[natIdx] || ['Bilinmiyor', '🌍'];
    const clubObj: Club = {
      id,
      name,
      shortName,
      country: natPair[0],
      countryFlag: natPair[1],
      colors: {
        primary,
        secondary,
        accent,
        text: '#FFFFFF',
      },
      founded: founded || 1900,
      stadium: stadium || `${name} Stadyumu`,
    };
    CLUBS[id] = clubObj;
  }

  // Helper to resolve compact club dictionary entries into CareerHistoryEntry
  const resolveCareerStep = (clubDictIdx: number, years: string): CareerHistoryEntry => {
    const cleanYears = normalizeCareerYearRange(years);
    const dictEntry = data.clubDict[clubDictIdx];
    if (!dictEntry) {
      return { club: 'Kulüp', years: cleanYears, countryFlag: '🌍' };
    }
    const [playableIdx, clubName, natIdx] = dictEntry;
    const playableCid = playableIdx >= 0 ? data.clubIds[playableIdx] : undefined;
    const natPair = data.nat[natIdx] || ['Bilinmiyor', '🌍'];
    return {
      club: clubName,
      ...(playableCid && CLUBS[playableCid] ? { clubId: playableCid } : {}),
      years: cleanYears,
      countryFlag: playableCid && CLUBS[playableCid] ? CLUBS[playableCid].countryFlag : natPair[1],
    };
  };

  // 2. Apply strictly verified repairs, duplicate alias merges, and recent transfers to existing 3,049 base players
  for (const upd of data.existingUpdates) {
    const [
      playerId,
      newClubIdx,
      newClubName,
      newLeagueIdx,
      compactSpells,
      markYouthClubs,
      extraAliases,
      statusOverride,
      replaceCareer,
    ] = upd;
    const player = PLAYERS[playerId];
    if (!player) continue;

    if (extraAliases && extraAliases.length > 0) {
      mergeAliases(player.aliases, extraAliases, player.name);
    }

    if (markYouthClubs.length > 0 && Array.isArray(player.careerHistory)) {
      const youthSet = new Set(markYouthClubs);
      for (const h of player.careerHistory) {
        if (!h.isYouth && youthSet.has(h.club)) {
          h.isYouth = true;
        }
      }
    }

    if (compactSpells.length > 0) {
      const mappedSteps = compactSpells.map(([dIdx, yrs]) => resolveCareerStep(dIdx, yrs));
      if (replaceCareer) {
        player.careerHistory = mappedSteps;
      } else {
        if (!player.careerHistory) player.careerHistory = [];
        for (const step of mappedSteps) {
          player.careerHistory.push(step);
        }
      }
    }

    if (newClubName) {
      const resolvedNewCid = newClubIdx >= 0 ? data.clubIds[newClubIdx] : undefined;
      let clubLabel = newClubName;
      if (
        clubLabel !== 'Kulüpsüz' &&
        statusOverride === 'retired' &&
        !/\((?:Emekli|Efsane)\)$/i.test(clubLabel)
      ) {
        clubLabel = `${clubLabel} (Emekli)`;
      } else if (
        clubLabel !== 'Kulüpsüz' &&
        statusOverride === 'legend' &&
        !/\((?:Emekli|Efsane)\)$/i.test(clubLabel)
      ) {
        clubLabel = `${clubLabel} (Efsane)`;
      }

      player.clubName = clubLabel;
      if (resolvedNewCid && CLUBS[resolvedNewCid] && clubLabel !== 'Kulüpsüz') {
        player.clubId = resolvedNewCid;
      } else {
        delete player.clubId;
      }

      if (newLeagueIdx >= 0 && data.leagues[newLeagueIdx]) {
        player.league = data.leagues[newLeagueIdx];
      }

      if (PLAYER_ASSETS[playerId]) {
        PLAYER_ASSETS[playerId].clubName = clubLabel;
        if (player.clubId) {
          PLAYER_ASSETS[playerId].clubId = player.clubId;
        } else {
          delete PLAYER_ASSETS[playerId].clubId;
        }
        if (player.league) {
          PLAYER_ASSETS[playerId].league = player.league;
        }
      }
    }
  }

  // Clean & chronologically sort ALL base players' career histories (preserving same-year order)
  for (const basePlayer of PLAYERS_LIST) {
    if (Array.isArray(basePlayer.careerHistory) && basePlayer.careerHistory.length > 0) {
      basePlayer.careerHistory = sortAndCleanCareerHistory(basePlayer.careerHistory);
    }
  }

  // 3. Expand unique compact players into PLAYERS, PLAYERS_LIST, PLAYER_ASSETS
  const existingIdSet = new Set(PLAYERS_LIST.map((p) => p.id));

  for (const row of data.players) {
    const [
      id,
      name,
      aliases,
      natIdx,
      posIdx,
      age,
      currentClubDictIdx,
      leagueIdx,
      _playableClubIndices,
      compactSpells,
      statusCode,
      qFlag,
    ] = row;

    if (existingIdSet.has(id) || PLAYER_ID_ALIASES[id]) continue;
    existingIdSet.add(id);

    const natPair = data.nat[natIdx] || ['Bilinmiyor', '🌍'];
    const position = data.pos[posIdx] || 'MF';
    const currentStep =
      currentClubDictIdx >= 0
        ? resolveCareerStep(currentClubDictIdx, statusCode === 1 ? '2026–' : '')
        : { club: 'Kulüpsüz', years: '', countryFlag: natPair[1] };
    const leagueName =
      leagueIdx >= 0 && data.leagues[leagueIdx] ? data.leagues[leagueIdx] : 'Diğer';

    const rawCareerHistory: CareerHistoryEntry[] = compactSpells.map(([dIdx, yrs]) =>
      resolveCareerStep(dIdx, yrs)
    );
    if (rawCareerHistory.length === 0 && currentStep.club && currentStep.club !== 'Kulüpsüz') {
      rawCareerHistory.push(currentStep);
    }

    const careerHistory = sortAndCleanCareerHistory(rawCareerHistory);

    const cleanClubName = currentStep.club;
    let clubLabel = cleanClubName;
    if (cleanClubName !== 'Kulüpsüz') {
      if (statusCode === 2 && !/\(Efsane\)$/i.test(cleanClubName)) {
        clubLabel = `${cleanClubName} (Efsane)`;
      } else if (statusCode === 0 && !/\((?:Emekli|Efsane)\)$/i.test(cleanClubName)) {
        clubLabel = `${cleanClubName} (Emekli)`;
      }
    }

    const validCurrentClubId =
      cleanClubName !== 'Kulüpsüz' && currentStep.clubId && CLUBS[currentStep.clubId]
        ? currentStep.clubId
        : undefined;

    const playerObj: Player = {
      id,
      name,
      aliases: aliases || [],
      nationality: natPair[0],
      flag: natPair[1],
      position,
      photoUrl: DEFAULT_PLAYER_PHOTO,
      age: age || 28,
      shirtNumber: 10,
      clubName: clubLabel,
      ...(validCurrentClubId ? { clubId: validCurrentClubId } : {}),
      league: leagueName,
      careerHistory,
    };

    PLAYERS[id] = playerObj;
    PLAYERS_LIST.push(playerObj);
    PLAYER_ASSETS[id] = {
      photoUrl: DEFAULT_PLAYER_PHOTO,
      age: playerObj.age ?? 28,
      shirtNumber: 10,
      clubName: clubLabel,
      ...(validCurrentClubId ? { clubId: validCurrentClubId } : {}),
      league: leagueName,
    };

    if (qFlag === 1) {
      QUESTION_ELIGIBLE_PLAYER_IDS.add(id);
    }
  }

  // 3b. Back-link any exact/unambiguous 345-club matches onto base & compact players + senior steps
  const normClubName = (raw: string): string =>
    raw
      .replace(/\s*\((?:Kiralık|Emekli|Efsane|Altyapı)[^)]*\)$/i, '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const exact345Map = new Map<string, string>();
  for (const [cid, club] of Object.entries(CLUBS)) {
    const key = normClubName(club.name);
    if (key && !exact345Map.has(key)) exact345Map.set(key, cid);
  }
  const safeAliasToId: Array<[string, string]> = [
    ['corinthians', 'sc_corinthians_paulista'],
    ['sao paulo', 'sao_paulo_fc'],
    ['atletico mineiro', 'clube_atletico_mineiro'],
    ['vasco da gama', 'cr_vasco_da_gama'],
    ['dinamo zagreb', 'gnk_dinamo_zagreb'],
    ['hajduk split', 'hnk_hajduk_split'],
    ['botafogo fr', 'botafogo_fr'],
    ['nec nijmegen', 'nec_nijmegen'],
    ['al ahli saudi', 'al_ahli_saudi'],
    ['al qadsiah', 'al_qadsiah'],
    ['burnley fc', 'burnley_f_c'],
    ['cd leganes', 'cd_leganes'],
    ['man united', 'manchester_united'],
    ['man city', 'manchester_city'],
    ['rams basaksehir', 'basaksehir'],
    ['istanbul basaksehir', 'basaksehir'],
    ['olympique marsilya', 'marseille'],
    ['olympique lyon', 'lyon'],
    ['olympique lyonnais', 'lyon'],
    ['losc lille', 'lille'],
    ['fc bayern munih', 'bayern_munich'],
    ['bayern munich', 'bayern_munich'],
    ['bayer 04 leverkusen', 'bayer_leverkusen'],
    ['ajax', 'ajax'],
    ['krc genk', 'krc_genk'],
    ['az alkmaar', 'az_alkmaar'],
    ['los angeles fc', 'los_angeles_fc'],
  ];
  for (const [aliasKey, cid] of safeAliasToId) {
    if (CLUBS[cid] && !exact345Map.has(aliasKey)) {
      exact345Map.set(aliasKey, cid);
    }
  }

  for (const player of PLAYERS_LIST) {
    if (!player.clubId && player.clubName && player.clubName !== 'Kulüpsüz' && !player.clubName.includes('/')) {
      const bare = player.clubName.replace(/\s*\((?:Kiralık|Emekli|Efsane)[^)]*\)$/i, '').trim();
      if (!isReserveOrYouthClubName(bare)) {
        const matched = exact345Map.get(normClubName(bare));
        if (matched && CLUBS[matched]) {
          player.clubId = matched;
          if (PLAYER_ASSETS[player.id]) {
            PLAYER_ASSETS[player.id].clubId = matched;
          }
        }
      }
    }
    for (const step of player.careerHistory || []) {
      if (step.isYouth || step.clubId) continue;
      const bare = step.club.replace(/\s*\((?:Kiralık|Emekli|Efsane)[^)]*\)$/i, '').trim();
      if (isReserveOrYouthClubName(bare)) continue;
      const matched = exact345Map.get(normClubName(bare));
      if (matched && CLUBS[matched]) {
        step.clubId = matched;
        step.countryFlag = CLUBS[matched].countryFlag;
      }
    }
  }

  // 4. Atomically rebuild ALL 4 mode question pools from the cleaned hydrated dataset
  const poolOpts = { resolvePlayerId: resolveCanonicalPlayerId };

  const rebuiltPairings = buildExpandedMatchPairings(
    PLAYERS_LIST,
    CLUBS,
    CURATED_MATCH_PAIRINGS,
    poolOpts
  );
  MATCH_PAIRINGS.splice(0, MATCH_PAIRINGS.length, ...rebuiltPairings);

  const rebuiltCountryClubs = buildExpandedCountryClubChallenges(
    PLAYERS_LIST,
    CLUBS,
    CURATED_COUNTRY_CLUB_CHALLENGES,
    poolOpts
  );
  COUNTRY_CLUB_CHALLENGES.splice(0, COUNTRY_CLUB_CHALLENGES.length, ...rebuiltCountryClubs);

  const rebuiltXox = buildExpandedXoxBoards(
    PLAYERS_LIST,
    CLUBS,
    CURATED_XOX_BOARDS,
    320,
    poolOpts
  );
  XOX_BOARDS.splice(0, XOX_BOARDS.length, ...rebuiltXox);

  const rebuiltCareers = buildExpandedCareerChallenges(
    PLAYERS_LIST,
    CLUBS,
    CURATED_CAREER_CHALLENGES,
    QUESTION_ELIGIBLE_PLAYER_IDS,
    poolOpts
  );
  CAREER_CHALLENGES.splice(0, CAREER_CHALLENGES.length, ...rebuiltCareers);

  lastStats = {
    verifiedCareerRepairsApplied:
      data.stats?.verifiedCareerRepairsApplied ?? data.existingUpdates.length,
    verifiedTransfersApplied: data.stats?.verifiedTransfersApplied ?? 0,
    youthFlagsFixed: data.stats?.youthFlagsFixed ?? 0,
  };

  invalidateValidatorIndexCache();
  rebuildPlayerSearchIndex(PLAYERS_LIST);
  rosterHydrated = true;

  return getRosterHydrationStatus();
}

export async function ensureExpandedRosterLoaded(): Promise<RosterHydrationStatus> {
  if (rosterHydrated) {
    return getRosterHydrationStatus();
  }
  if (inflightLoadPromise) {
    return inflightLoadPromise;
  }

  inflightLoadPromise = (async () => {
    try {
      // In Node environment, delegate dynamically to Node loader (kept separate from Vite browser chunk)
      if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
        try {
          const nodeLoaderSpec = './rosterNodeLoader' + '.js';
          const mod = (await import(/* @vite-ignore */ nodeLoaderSpec)) as {
            ensureExpandedRosterSync: () => RosterHydrationStatus;
          };
          return mod.ensureExpandedRosterSync();
        } catch {
          return getRosterHydrationStatus();
        }
      }

      const base =
        (typeof import.meta !== 'undefined' &&
          (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
        '/';
      const normalizedBase = base.endsWith('/') ? base : `${base}/`;
      const url = `${normalizedBase}data/roster25k.v2.json?v=${encodeURIComponent(ROSTER_DATA_VERSION)}`;

      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} loading ${url}`);
      }
      const data = (await res.json()) as CompactRosterPayload;
      return hydrateCompactRoster(data);
    } catch (err) {
      console.warn('[RosterLoader] Falling back to embedded 3,049 base roster:', err);
      return getRosterHydrationStatus();
    } finally {
      inflightLoadPromise = null;
    }
  })();

  return inflightLoadPromise;
}
