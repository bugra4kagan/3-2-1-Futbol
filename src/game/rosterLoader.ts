import { CLUBS, MATCH_PAIRINGS, PLAYERS, PLAYERS_LIST } from './database';
import { COUNTRY_CLUB_CHALLENGES, XOX_BOARDS } from './minigamesData';
import { DEFAULT_PLAYER_PHOTO, PLAYER_ASSETS } from './playerAssets';
import { rebuildPlayerSearchIndex } from './silhouetteEngine';
import { CareerHistoryEntry, Club, Player } from './types';
import { invalidateValidatorIndexCache } from './validator';
import { ROSTER_DATA_VERSION } from './rosterVersion';

export { ROSTER_DATA_VERSION };
export const DEFAULT_ROSTER_LICENSE_ATTRIBUTION =
  'Oyuncu ve kulüp temel meta verileri OpenFootball players.db (CC0 1.0), Wikidata (CC0 1.0) ve Wikipedia futbolcu biyografileri (CC BY-SA 4.0) kaynaklarından türetilmiştir.';

export interface CompactRosterPayload {
  version: string;
  generatedAt?: string;
  licenseAttribution?: string;
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
  };
  pos: Array<'GK' | 'DF' | 'MF' | 'FW'>;
  nat: Array<[string, string]>;
  leagues: string[];
  clubIds: string[];
  // [id, name, shortName, natIdx, primary, secondary, accent, founded, stadium]
  addedClubs: Array<[string, string, string, number, string, string, string, number, string]>;
  // [playableClubIdIdxOrMinus1, clubName, natIdx]
  clubDict: Array<[number, string, number]>;
  // [playerId, newClubIdIdxOrMinus1, newClubName, newLeagueIdxOrMinus1, [[clubDictIdx, years], ...], markYouthClubs]
  existingUpdates: Array<[string, number, string, number, Array<[number, string]>, string[]]>;
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
  return QUESTION_ELIGIBLE_PLAYER_IDS.has(playerId);
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

function appendUniqueIds(target: string[], additions: Iterable<string>): void {
  const existing = new Set<string>(target);
  for (const id of additions) {
    if (!existing.has(id) && PLAYERS[id]) {
      existing.add(id);
      target.push(id);
    }
  }
}

function getIntersection(a: Set<string> | undefined, b: Set<string> | undefined): string[] {
  if (!a || !b || a.size === 0 || b.size === 0) return [];
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  const out: string[] = [];
  for (const id of smaller) {
    if (larger.has(id)) out.push(id);
  }
  return out;
}

export function hydrateCompactRoster(data: CompactRosterPayload): RosterHydrationStatus {
  if (rosterHydrated) {
    return getRosterHydrationStatus();
  }

  activeRosterVersion = data.version || ROSTER_DATA_VERSION;
  if (data.licenseAttribution) {
    activeLicenseAttribution = data.licenseAttribution;
  }

  // 1. Register new playable clubs with procedural SVG colors
  for (const cTuple of data.addedClubs) {
    const [id, name, shortName, natIdx, primary, secondary, accent, founded, stadium] = cTuple;
    if (CLUBS[id]) continue;
    const natPair = data.nat[natIdx] || ['Uluslararası', '🌍'];
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
    const dictEntry = data.clubDict[clubDictIdx];
    if (!dictEntry) {
      return { club: 'Kulüp', years, countryFlag: '🌍' };
    }
    const [playableIdx, clubName, natIdx] = dictEntry;
    const playableCid = playableIdx >= 0 ? data.clubIds[playableIdx] : undefined;
    const natPair = data.nat[natIdx] || ['Uluslararası', '🌍'];
    return {
      club: clubName,
      ...(playableCid && CLUBS[playableCid] ? { clubId: playableCid } : {}),
      years,
      countryFlag: playableCid && CLUBS[playableCid] ? CLUBS[playableCid].countryFlag : natPair[1],
    };
  };

  // 2. Apply strictly verified repairs and recent transfers to existing 3,049 players
  for (const upd of data.existingUpdates) {
    const [playerId, newClubIdx, newClubName, newLeagueIdx, compactSpells, markYouthClubs] = upd;
    const player = PLAYERS[playerId];
    if (!player) continue;

    if (markYouthClubs.length > 0 && Array.isArray(player.careerHistory)) {
      const youthSet = new Set(markYouthClubs);
      for (const h of player.careerHistory) {
        if (!h.isYouth && youthSet.has(h.club)) {
          h.isYouth = true;
        }
      }
    }

    if (compactSpells.length > 0) {
      if (!player.careerHistory) player.careerHistory = [];
      const seenClubs = new Set(
        player.careerHistory.map((h) => `${h.clubId || h.club.toLowerCase()}::${h.years}`)
      );
      for (const [dIdx, yrs] of compactSpells) {
        const step = resolveCareerStep(dIdx, yrs);
        const key = `${step.clubId || step.club.toLowerCase()}::${step.years}`;
        if (!seenClubs.has(key)) {
          seenClubs.add(key);
          player.careerHistory.push(step);
        }
      }
    }

    if (newClubName) {
      const resolvedNewCid = newClubIdx >= 0 ? data.clubIds[newClubIdx] : undefined;
      player.clubName = newClubName;
      if (resolvedNewCid && CLUBS[resolvedNewCid]) {
        player.clubId = resolvedNewCid;
      }
      if (newLeagueIdx >= 0 && data.leagues[newLeagueIdx]) {
        player.league = data.leagues[newLeagueIdx];
      }
      if (PLAYER_ASSETS[playerId]) {
        PLAYER_ASSETS[playerId].clubName = newClubName;
        if (player.clubId) PLAYER_ASSETS[playerId].clubId = player.clubId;
        if (player.league) PLAYER_ASSETS[playerId].league = player.league;
      }
    }
  }

  // 3. Expand all 21,951 newly verified players into PLAYERS, PLAYERS_LIST, PLAYER_ASSETS
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

    if (existingIdSet.has(id)) continue;
    existingIdSet.add(id);

    const natPair = data.nat[natIdx] || ['Uluslararası', '🌍'];
    const position = data.pos[posIdx] || 'MF';
    const currentStep = resolveCareerStep(currentClubDictIdx, '2025-');
    const leagueName = leagueIdx >= 0 && data.leagues[leagueIdx] ? data.leagues[leagueIdx] : 'Uluslararası';

    const careerHistory: CareerHistoryEntry[] = compactSpells.map(([dIdx, yrs]) =>
      resolveCareerStep(dIdx, yrs)
    );
    if (careerHistory.length === 0) {
      careerHistory.push(currentStep);
    }

    const clubLabel =
      statusCode === 2
        ? `${currentStep.club} (Efsane)`
        : statusCode === 0
        ? `${currentStep.club} (Emekli)`
        : currentStep.club;

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
      ...(currentStep.clubId ? { clubId: currentStep.clubId } : {}),
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
      ...(currentStep.clubId ? { clubId: currentStep.clubId } : {}),
      league: leagueName,
    };

    if (qFlag === 1) {
      QUESTION_ELIGIBLE_PLAYER_IDS.add(id);
    }
  }

  // 4. Rebuild inverted club/country indexes across all 25,000 players and enrich valid answer pools
  const clubToPlayerIds = new Map<string, Set<string>>();
  const countryToPlayerIds = new Map<string, Set<string>>();
  const countryClubToPlayerIds = new Map<string, Set<string>>();

  for (const player of PLAYERS_LIST) {
    if (player.nationality) {
      let cSet = countryToPlayerIds.get(player.nationality);
      if (!cSet) {
        cSet = new Set<string>();
        countryToPlayerIds.set(player.nationality, cSet);
      }
      cSet.add(player.id);
    }

    const seniorIds = new Set<string>();
    if (player.clubId && CLUBS[player.clubId]) {
      seniorIds.add(player.clubId);
    }
    for (const h of player.careerHistory || []) {
      if (!h.isYouth && h.clubId && CLUBS[h.clubId]) {
        seniorIds.add(h.clubId);
      }
    }

    for (const cid of seniorIds) {
      let clSet = clubToPlayerIds.get(cid);
      if (!clSet) {
        clSet = new Set<string>();
        clubToPlayerIds.set(cid, clSet);
      }
      clSet.add(player.id);

      if (player.nationality) {
        const ccKey = `${player.nationality}||${cid}`;
        let ccSet = countryClubToPlayerIds.get(ccKey);
        if (!ccSet) {
          ccSet = new Set<string>();
          countryClubToPlayerIds.set(ccKey, ccSet);
        }
        ccSet.add(player.id);
      }
    }
  }

  for (const pairing of MATCH_PAIRINGS) {
    const common = getIntersection(
      clubToPlayerIds.get(pairing.club1Id),
      clubToPlayerIds.get(pairing.club2Id)
    );
    if (common.length > 0) {
      appendUniqueIds(pairing.validPlayerIds, common);
    }
  }

  for (const cc of COUNTRY_CLUB_CHALLENGES) {
    const matched = countryClubToPlayerIds.get(`${cc.country}||${cc.clubId}`);
    if (matched && matched.size > 0) {
      appendUniqueIds(cc.validPlayerIds, matched);
    }
  }

  const getXoxAxisSet = (cond: { type: 'club' | 'country' | 'teammate'; id: string }): Set<string> | undefined =>
    cond.type === 'club'
      ? clubToPlayerIds.get(cond.id)
      : cond.type === 'country'
      ? countryToPlayerIds.get(cond.id)
      : undefined;

  for (const board of XOX_BOARDS) {
    for (let r = 0; r < 3; r += 1) {
      const rSet = getXoxAxisSet(board.rows[r]);
      for (let c = 0; c < 3; c += 1) {
        const cSet = getXoxAxisSet(board.cols[c]);
        const key = `${r}_${c}`;
        const existing = board.cellValidPlayerIds[key] || [];
        const common = getIntersection(rSet, cSet);
        if (common.length > 0) {
          appendUniqueIds(existing, common);
          board.cellValidPlayerIds[key] = existing;
        }
      }
    }
  }

  lastStats = {
    verifiedCareerRepairsApplied: data.stats?.verifiedCareerRepairsApplied ?? data.existingUpdates.length,
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
      const url = `${normalizedBase}data/roster25k.v2.json`;

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
