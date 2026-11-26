import { getClubCrestUrl } from './clubLogos';
import {
  CareerChallenge,
  CareerHistoryEntry,
  Club,
  CountryClubChallenge,
  MatchPairing,
  Player,
  XoxBoardChallenge,
  XoxCondition,
} from './types';

export const NEW_12_CLUB_IDS = new Set<string>([
  'nec_nijmegen',
  'botafogo_fr',
  'al_ahli_saudi',
  'al_qadsiah',
  'bodrum_fk',
  'boluspor',
  'krc_genk',
  'az_alkmaar',
  'hnk_hajduk_split',
  'gnk_dinamo_zagreb',
  'cr_vasco_da_gama',
  'los_angeles_fc',
]);

const RESERVE_OR_YOUTH_CLUB_RE =
  /(?:\bAltyap[ıi]\b|\bGençlik\b|\bYouth\b|\bAcademy\b|\bReserves?\b|\bU1[5-9]\b|\bU2[0-3]\b|\bCastilla\b|\bMestalla\b|\bFabril\b|\bPromesas\b|\bPrimavera\b|\bJong\s+[A-Z]|\bNext\s*Gen\b|\bBar[cç]a\s+Atl[eè]tic\b|\s(?:II|III|IV)$|\sB$)/i;

export function isReserveOrYouthClubName(clubName: string): boolean {
  const trimmed = clubName.trim();
  if (!trimmed) return false;
  if (/^Willem II$/i.test(trimmed)) return false;
  return RESERVE_OR_YOUTH_CLUB_RE.test(trimmed);
}

export function normalizeCareerYearRange(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  let normalized = trimmed
    .replace(/\s*[–—−-]\s*/g, '–')
    .replace(/–(?:present|current|now|günümüz|gunumuz)$/i, '–Günümüz');

  // Fix 2-digit shorthand end year like 1998–04 -> 1998–2004, 1999–01 -> 1999–2001
  const shortMatch = normalized.match(/^(19\d\d|20\d\d)–(\d{2})$/);
  if (shortMatch) {
    const start = Number(shortMatch[1]);
    const endShort = Number(shortMatch[2]);
    const centuryBase = Math.floor(start / 100) * 100;
    const candidate = centuryBase + endShort;
    const resolvedEnd = candidate >= start ? candidate : candidate + 100;
    normalized = `${start}–${resolvedEnd}`;
  }

  return normalized;
}

export function extractCareerStartYear(years: string): number | null {
  if (!years || years.includes('?')) return null;
  const match = years.trim().match(/^(19\d\d|20\d\d)(?:$|[–—−-])/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1900 && year <= 2026 ? year : null;
}

export function extractCareerEndYear(years: string): number | null {
  const trimmed = String(years || '').trim();
  if (!trimmed || trimmed.includes('?')) return null;
  if (/[–—−-](?:Günümüz|gunumuz|present|current|now)$/i.test(trimmed)) {
    return 2026;
  }
  const rangeMatch = trimmed.match(/^(?:19\d\d|20\d\d)[–—−-](19\d\d|20\d\d)$/);
  if (rangeMatch) {
    const year = Number(rangeMatch[1]);
    return year >= 1900 && year <= 2027 ? year : null;
  }
  const singleMatch = trimmed.match(/^(19\d\d|20\d\d)$/);
  if (singleMatch) {
    const year = Number(singleMatch[1]);
    return year >= 1900 && year <= 2026 ? year : null;
  }
  return null;
}

export function isCareerChronologyVerified(entries: readonly CareerHistoryEntry[]): boolean {
  if (entries.length < 2) return false;
  let prevStart = -1;
  for (const entry of entries) {
    const start = extractCareerStartYear(entry.years);
    if (start === null) return false;
    // Reject explicitly malformed end ranges (e.g. '2024-2021') while allowing open '2024–'
    const hasExplicitEnd = /[–—−-]\s*\d/.test(entry.years);
    if (hasExplicitEnd) {
      const end = extractCareerEndYear(entry.years);
      if (end === null || end < start) return false;
    }
    if (start < prevStart) return false;
    prevStart = start;
  }
  return true;
}

function normalizeClubStemForDedup(clubName: string): string {
  return clubName
    .replace(/\((?:Kiralık|Altyapı|Emekli|Efsane)[^)]*\)/gi, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(?:fc|cf|sc|ac|as|ss|sv|vfl|vfb|tsg|fsv|rcd|rc|cd|ud|sd|ca|se|cr|ec|fk|sk|pfk|afc|bk|ik|if|fk|club|calcio|fotball|fútbol|futebol)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Kariyer adımlarını temizler, tekilleştirir ve yalnızca farklı başlangıç yılları arasında
 * kronolojik sıralama uygular. Aynı yıl içindeki transferlerin sırasını asla tahmin etmez.
 */
export function sortAndCleanCareerHistory(
  entries: readonly CareerHistoryEntry[]
): CareerHistoryEntry[] {
  const cleaned: CareerHistoryEntry[] = [];
  const seenMap = new Map<string, number>();

  for (const raw of entries) {
    const clubName = (raw.club || '').trim();
    if (!clubName) continue;

    const normalizedYears = normalizeCareerYearRange(raw.years);
    // Drop pure dash placeholders when there is no year digit at all
    if (normalizedYears === '–' || normalizedYears === '-') continue;

    const inferredYouth = raw.isYouth || /\(Altyapı\)/i.test(clubName) || isReserveOrYouthClubName(clubName);
    const stem = raw.clubId || normalizeClubStemForDedup(clubName) || clubName.toLowerCase();
    const isLoan = /\(Kiralık\)/i.test(clubName);
    const dedupKey = `${stem}::${normalizedYears}::${inferredYouth ? 'Y' : 'S'}`;

    const entry: CareerHistoryEntry = {
      ...raw,
      club: clubName,
      years: normalizedYears || raw.years,
      ...(inferredYouth ? { isYouth: true } : {}),
    };

    const existingIdx = seenMap.get(dedupKey);
    if (existingIdx === undefined) {
      seenMap.set(dedupKey, cleaned.length);
      cleaned.push(entry);
    } else {
      const prev = cleaned[existingIdx];
      // Merge clubId or (Kiralık) label if better specified
      cleaned[existingIdx] = {
        ...prev,
        club: isLoan && !/\(Kiralık\)/i.test(prev.club) ? entry.club : prev.club,
        ...(!prev.clubId && entry.clubId ? { clubId: entry.clubId } : {}),
        countryFlag: prev.countryFlag !== '🌍' ? prev.countryFlag : entry.countryFlag,
        ...(prev.isYouth || entry.isYouth ? { isYouth: true } : {}),
      };
    }
  }

  // Sort ONLY elements that have a valid leading start year relative to each other,
  // preserving relative order for equal start years AND keeping null-year slots untouched.
  const sortablePositions: number[] = [];
  const sortableItems: Array<{ entry: CareerHistoryEntry; startYear: number; origIdx: number }> = [];

  for (let i = 0; i < cleaned.length; i += 1) {
    const sy = extractCareerStartYear(cleaned[i].years);
    if (sy !== null) {
      sortablePositions.push(i);
      sortableItems.push({ entry: cleaned[i], startYear: sy, origIdx: i });
    }
  }

  sortableItems.sort((a, b) => {
    if (a.startYear !== b.startYear) {
      return a.startYear - b.startYear;
    }
    return a.origIdx - b.origIdx;
  });

  for (let k = 0; k < sortablePositions.length; k += 1) {
    cleaned[sortablePositions[k]] = sortableItems[k].entry;
  }

  return cleaned;
}

function canonicalClubPairKey(c1: string, c2: string): string {
  return c1 < c2 ? `${c1}__${c2}` : `${c2}__${c1}`;
}

export interface PoolBuildOptions {
  resolvePlayerId?: (id: string) => string;
}

/**
 * Verilen doğrulanmış `PLAYERS_LIST` verisinden (yalnızca A takım / senior geçmişi, `isYouth` hariç)
 * mevcut kürasyonları koruyarak yeni ve tekrar etmeyen "İki Kulüp" eşleşmeleri üretir.
 */
export function buildExpandedMatchPairings(
  playersList: readonly Player[],
  clubs: Record<string, Club>,
  curatedPairings: readonly MatchPairing[],
  options: PoolBuildOptions = {}
): MatchPairing[] {
  const resolveId = options.resolvePlayerId || ((id: string) => id);
  const playersById = new Map<string, Player>();
  for (const pl of playersList) {
    playersById.set(pl.id, pl);
  }

  const existingKeys = new Set<string>();
  const existingIds = new Set<string>();
  const mergedCuratedByCanon = new Map<string, MatchPairing>();

  for (const p of curatedPairings) {
    if (!clubs[p.club1Id] || !clubs[p.club2Id]) continue;
    const cKey = canonicalClubPairKey(p.club1Id, p.club2Id);
    const cleanedIds = Array.from(
      new Set(p.validPlayerIds.map((id) => resolveId(id)).filter((id) => playersById.has(id)))
    );
    const existing = mergedCuratedByCanon.get(cKey);
    if (existing) {
      const mergedValidIds = Array.from(new Set([...existing.validPlayerIds, ...cleanedIds]));
      if (mergedValidIds.length === 0) continue;
      mergedCuratedByCanon.set(cKey, {
        ...existing,
        validPlayerIds: mergedValidIds,
      });
    } else {
      mergedCuratedByCanon.set(cKey, {
        ...p,
        validPlayerIds: cleanedIds,
      });
      existingIds.add(p.id);
      existingKeys.add(cKey);
    }
  }

  const dedupedCurated = Array.from(mergedCuratedByCanon.values());
  const pairBucket = new Map<string, { c1: string; c2: string; playerIds: string[] }>();

  for (const player of playersList) {
    const seniorClubIds = Array.from(
      new Set(
        (player.careerHistory || [])
          .filter(
            (step) =>
              !step.isYouth &&
              step.clubId &&
              clubs[step.clubId] &&
              Boolean(getClubCrestUrl(step.clubId, step.club))
          )
          .map((step) => step.clubId as string)
      )
    );

    if (player.clubId && clubs[player.clubId] && Boolean(getClubCrestUrl(player.clubId, player.clubName))) {
      if (!seniorClubIds.includes(player.clubId)) {
        seniorClubIds.push(player.clubId);
      }
    }

    if (seniorClubIds.length < 2) continue;

    for (let i = 0; i < seniorClubIds.length; i += 1) {
      for (let j = i + 1; j < seniorClubIds.length; j += 1) {
        const a = seniorClubIds[i];
        const b = seniorClubIds[j];
        const [c1, c2] = a < b ? [a, b] : [b, a];
        const key = `${c1}__${c2}`;

        if (existingKeys.has(key)) {
          const curated = mergedCuratedByCanon.get(key);
          if (curated && !curated.validPlayerIds.includes(player.id)) {
            curated.validPlayerIds.push(player.id);
          }
          continue;
        }

        let entry = pairBucket.get(key);
        if (!entry) {
          entry = { c1, c2, playerIds: [] };
          pairBucket.set(key, entry);
        }
        entry.playerIds.push(player.id);
      }
    }
  }

  const validCurated = dedupedCurated.filter((p) => p.validPlayerIds.length > 0);

  const generated: MatchPairing[] = Array.from(pairBucket.entries())
    .filter(([, entry]) => {
      const minRequired =
        NEW_12_CLUB_IDS.has(entry.c1) || NEW_12_CLUB_IDS.has(entry.c2) ? 3 : 2;
      return entry.playerIds.length >= minRequired;
    })
    .sort((a, b) => {
      if (b[1].playerIds.length !== a[1].playerIds.length) {
        return b[1].playerIds.length - a[1].playerIds.length;
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 1200)
    .map(([key, entry]) => {
      const id = `auto_pair_${key}`;
      const club1Name = clubs[entry.c1]?.name || entry.c1;
      const club2Name = clubs[entry.c2]?.name || entry.c2;
      const sampleName =
        playersById.get(entry.playerIds[0])?.name || 'Ortak yıldızlar';
      return {
        id: existingIds.has(id) ? `${id}_ext` : id,
        club1Id: entry.c1,
        club2Id: entry.c2,
        validPlayerIds: entry.playerIds,
        funFact: `${club1Name} ve ${club2Name} formalarını giymiş ${entry.playerIds.length} futbolcu arasında ${sampleName} de yer alıyor.`,
      };
    });

  return [...validCurated, ...generated];
}

/**
 * Verilen doğrulanmış `PLAYERS_LIST` verisinden mevcut kürasyonları bozmadan
 * Ülke + Kulüp soru havuzunu 900+ doğrulanmış kombinasyona çıkarır.
 */
export function buildExpandedCountryClubChallenges(
  playersList: readonly Player[],
  clubs: Record<string, Club>,
  curatedChallenges: readonly CountryClubChallenge[],
  options: PoolBuildOptions = {}
): CountryClubChallenge[] {
  const resolveId = options.resolvePlayerId || ((id: string) => id);
  const playersById = new Map<string, Player>();
  for (const pl of playersList) {
    playersById.set(pl.id, pl);
  }

  const existingKeys = new Set<string>();
  const existingIds = new Set<string>();
  const curatedByKey = new Map<string, CountryClubChallenge>();

  for (const c of curatedChallenges) {
    if (!clubs[c.clubId]) continue;
    const key = `${c.country}||${c.clubId}`;
    const cleanedIds = Array.from(
      new Set(c.validPlayerIds.map((id) => resolveId(id)).filter((id) => playersById.has(id)))
    );
    const cloned: CountryClubChallenge = {
      ...c,
      validPlayerIds: cleanedIds,
    };
    existingIds.add(c.id);
    existingKeys.add(key);
    curatedByKey.set(key, cloned);
  }

  const bucket = new Map<
    string,
    { country: string; countryFlag: string; clubId: string; playerIds: string[] }
  >();

  for (const player of playersList) {
    if (!player.nationality || !player.flag) continue;
    const seniorClubIds = Array.from(
      new Set(
        (player.careerHistory || [])
          .filter(
            (step) =>
              !step.isYouth &&
              step.clubId &&
              clubs[step.clubId] &&
              Boolean(getClubCrestUrl(step.clubId, step.club))
          )
          .map((step) => step.clubId as string)
      )
    );
    if (player.clubId && clubs[player.clubId] && Boolean(getClubCrestUrl(player.clubId, player.clubName))) {
      if (!seniorClubIds.includes(player.clubId)) {
        seniorClubIds.push(player.clubId);
      }
    }

    for (const clubId of seniorClubIds) {
      const key = `${player.nationality}||${clubId}`;
      if (existingKeys.has(key)) {
        const curated = curatedByKey.get(key);
        if (curated && !curated.validPlayerIds.includes(player.id)) {
          curated.validPlayerIds.push(player.id);
        }
        continue;
      }

      let entry = bucket.get(key);
      if (!entry) {
        entry = {
          country: player.nationality,
          countryFlag: player.flag,
          clubId,
          playerIds: [],
        };
        bucket.set(key, entry);
      }
      entry.playerIds.push(player.id);
    }
  }

  const validCurated = Array.from(curatedByKey.values()).filter(
    (c) => c.validPlayerIds.length > 0
  );

  const generated: CountryClubChallenge[] = Array.from(bucket.entries())
    .filter(([, entry]) => {
      const minRequired = NEW_12_CLUB_IDS.has(entry.clubId) ? 3 : 2;
      return entry.playerIds.length >= minRequired;
    })
    .sort((a, b) => {
      if (b[1].playerIds.length !== a[1].playerIds.length) {
        return b[1].playerIds.length - a[1].playerIds.length;
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 1000)
    .map(([, entry], idx) => {
      const clubName = clubs[entry.clubId]?.name || entry.clubId;
      const sampleName =
        playersById.get(entry.playerIds[0])?.name || 'Ünlü isimler';
      const baseId = `cc_auto_${entry.clubId}_${idx}`;
      return {
        id: existingIds.has(baseId) ? `${baseId}_x` : baseId,
        country: entry.country,
        countryFlag: entry.countryFlag,
        clubId: entry.clubId,
        validPlayerIds: entry.playerIds,
        funFact: `${entry.countryFlag} ${entry.country} uyruklu ${entry.playerIds.length} futbolcu ${clubName} forması giydi (ör. ${sampleName}).`,
      };
    });

  return [...validCurated, ...generated];
}

/**
 * Her 9 karesinde en az 2 doğrulanmış ortak futbolcu barındıran, 6 başlığı da farklı
 * ve tekrarsız deterministik 3x3 Futbol XOX tahtaları üretir.
 */
export function buildExpandedXoxBoards(
  playersList: readonly Player[],
  clubs: Record<string, Club>,
  curatedBoards: readonly XoxBoardChallenge[],
  targetTotalBoards = 320,
  options: PoolBuildOptions = {}
): XoxBoardChallenge[] {
  const resolveId = options.resolvePlayerId || ((id: string) => id);
  const playersById = new Map<string, Player>();
  for (const pl of playersList) {
    playersById.set(pl.id, pl);
  }

  const existingIds = new Set(curatedBoards.map((b) => b.id));
  const seenSignatures = new Set<string>();

  const normalizedCuratedBoards: XoxBoardChallenge[] = [];
  for (const b of curatedBoards) {
    const cleanedCells: Record<string, string[]> = {};
    for (const [cellKey, ids] of Object.entries(b.cellValidPlayerIds)) {
      cleanedCells[cellKey] = Array.from(
        new Set(ids.map((id) => resolveId(id)).filter((id) => playersById.has(id)))
      );
    }
    normalizedCuratedBoards.push({
      ...b,
      cellValidPlayerIds: cleanedCells,
    });
    const rowSig = b.rows.map((r) => `${r.type}:${r.id}`).sort().join('|');
    const colSig = b.cols.map((c) => `${c.type}:${c.id}`).sort().join('|');
    seenSignatures.add(`${rowSig}::${colSig}`);
    seenSignatures.add(`${colSig}::${rowSig}`);
  }

  // Index club -> players (senior only) & country -> players
  const clubPlayers = new Map<string, Set<string>>();
  const countryPlayers = new Map<string, { flag: string; ids: Set<string> }>();

  for (const player of playersList) {
    const seniorClubIds = Array.from(
      new Set(
        (player.careerHistory || [])
          .filter(
            (step) =>
              !step.isYouth &&
              step.clubId &&
              clubs[step.clubId] &&
              Boolean(getClubCrestUrl(step.clubId, step.club))
          )
          .map((step) => step.clubId as string)
      )
    );
    if (player.clubId && clubs[player.clubId] && Boolean(getClubCrestUrl(player.clubId, player.clubName))) {
      if (!seniorClubIds.includes(player.clubId)) {
        seniorClubIds.push(player.clubId);
      }
    }

    for (const cid of seniorClubIds) {
      let set = clubPlayers.get(cid);
      if (!set) {
        set = new Set<string>();
        clubPlayers.set(cid, set);
      }
      set.add(player.id);
    }

    if (player.nationality && player.flag) {
      let cEntry = countryPlayers.get(player.nationality);
      if (!cEntry) {
        cEntry = { flag: player.flag, ids: new Set<string>() };
        countryPlayers.set(player.nationality, cEntry);
      }
      cEntry.ids.add(player.id);
    }
  }

  // Pick top 28 densest clubs & top 16 densest countries as axis pool
  const topClubIds = Array.from(clubPlayers.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 28)
    .map(([id]) => id);

  const topCountries = Array.from(countryPlayers.entries())
    .sort((a, b) => b[1].ids.size - a[1].ids.size)
    .slice(0, 16)
    .map(([name, info]) => ({ name, flag: info.flag, ids: info.ids }));

  type AxisCandidate = { cond: XoxCondition; members: Set<string> };
  const clubAxes: AxisCandidate[] = topClubIds.map((cid) => ({
    cond: {
      type: 'club',
      id: cid,
      label: clubs[cid]?.name || cid,
      flag: clubs[cid]?.countryFlag,
    },
    members: clubPlayers.get(cid)!,
  }));

  const colAxesPool: AxisCandidate[] = [
    ...topCountries.map((cn) => ({
      cond: {
        type: 'country' as const,
        id: cn.name,
        label: cn.name,
        flag: cn.flag,
      },
      members: cn.ids,
    })),
    ...clubAxes,
  ];

  const intersectIds = (a: Set<string>, b: Set<string>): string[] => {
    const out: string[] = [];
    const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
    for (const id of smaller) {
      if (larger.has(id)) out.push(id);
    }
    return out;
  };

  // Enrich curated boards' non-teammate cells
  const getAxisMembers = (cond: XoxCondition): Set<string> | undefined =>
    cond.type === 'club'
      ? clubPlayers.get(cond.id)
      : cond.type === 'country'
      ? countryPlayers.get(cond.id)?.ids
      : undefined;

  for (const b of normalizedCuratedBoards) {
    for (let r = 0; r < 3; r += 1) {
      const rMem = getAxisMembers(b.rows[r]);
      for (let c = 0; c < 3; c += 1) {
        const cMem = getAxisMembers(b.cols[c]);
        if (!rMem || !cMem) continue;
        const common = intersectIds(rMem, cMem);
        if (common.length > 0) {
          const existing = new Set(b.cellValidPlayerIds[`${r}_${c}`] || []);
          for (const id of common) existing.add(id);
          b.cellValidPlayerIds[`${r}_${c}`] = Array.from(existing);
        }
      }
    }
  }

  const validCurated = normalizedCuratedBoards.filter((b) =>
    Object.values(b.cellValidPlayerIds).every((ids) => ids.length > 0)
  );

  const generated: XoxBoardChallenge[] = [];
  const needed = Math.max(0, targetTotalBoards - validCurated.length);

  const compatColsPerRow: number[][] = clubAxes.map((rAx) => {
    const ok: number[] = [];
    for (let j = 0; j < colAxesPool.length; j += 1) {
      const cAx = colAxesPool[j];
      if (rAx.cond.type === cAx.cond.type && rAx.cond.id === cAx.cond.id) continue;
      if (intersectIds(rAx.members, cAx.members).length >= 2) {
        ok.push(j);
      }
    }
    return ok;
  });

  const pairUsage = new Map<string, number>();

  outer: for (let r1 = 0; r1 < clubAxes.length; r1 += 1) {
    for (let r2 = r1 + 1; r2 < clubAxes.length; r2 += 1) {
      const cSet2 = new Set(compatColsPerRow[r2]);
      const commonCols12 = compatColsPerRow[r1].filter((cIdx) => cSet2.has(cIdx));
      if (commonCols12.length < 3) continue;

      for (let r3 = r2 + 1; r3 < clubAxes.length; r3 += 1) {
        const cSet3 = new Set(compatColsPerRow[r3]);
        const commonCols123 = commonCols12.filter((cIdx) => cSet3.has(cIdx));
        if (commonCols123.length < 3) continue;

        const sortedCols = [...commonCols123].sort((a, b) => {
          const ua = pairUsage.get(colAxesPool[a].cond.id) || 0;
          const ub = pairUsage.get(colAxesPool[b].cond.id) || 0;
          return ua - ub;
        });

        const rowTriplet = [clubAxes[r1], clubAxes[r2], clubAxes[r3]];
        const rowSig = rowTriplet.map((r) => `${r.cond.type}:${r.cond.id}`).sort().join('|');

        let colTripletsCreatedForRows = 0;
        for (let ci = 0; ci < sortedCols.length && colTripletsCreatedForRows < 2; ci += 3) {
          if (ci + 2 >= sortedCols.length) break;
          const c1 = colAxesPool[sortedCols[ci]];
          const c2 = colAxesPool[sortedCols[ci + 1]];
          const c3 = colAxesPool[sortedCols[ci + 2]];
          const colSig = [c1, c2, c3].map((c) => `${c.cond.type}:${c.cond.id}`).sort().join('|');
          const sigKey = `${rowSig}::${colSig}`;
          if (seenSignatures.has(sigKey)) continue;

          const allAxisIds = new Set([
            ...rowTriplet.map((r) => `${r.cond.type}:${r.cond.id}`),
            ...[c1, c2, c3].map((c) => `${c.cond.type}:${c.cond.id}`),
          ]);
          if (allAxisIds.size !== 6) continue;

          const colTriplet = [c1, c2, c3];
          const cellValidPlayerIds: Record<string, string[]> = {};
          let validBoard = true;

          for (let rr = 0; rr < 3; rr += 1) {
            for (let cc = 0; cc < 3; cc += 1) {
              const ids = intersectIds(rowTriplet[rr].members, colTriplet[cc].members);
              if (ids.length < 2) {
                validBoard = false;
                break;
              }
              cellValidPlayerIds[`${rr}_${cc}`] = ids;
            }
            if (!validBoard) break;
          }

          if (!validBoard) continue;

          seenSignatures.add(sigKey);
          seenSignatures.add(`${colSig}::${rowSig}`);
          colTripletsCreatedForRows += 1;

          for (const col of colTriplet) {
            pairUsage.set(col.cond.id, (pairUsage.get(col.cond.id) || 0) + 1);
          }

          const idxNum = generated.length + 1;
          const boardId = existingIds.has(`xox_auto_${idxNum}`)
            ? `xox_auto_${idxNum}_ext`
            : `xox_auto_${idxNum}`;
          generated.push({
            id: boardId,
            title: `${rowTriplet[0].cond.label} • ${rowTriplet[1].cond.label} • ${rowTriplet[2].cond.label}`,
            rows: [rowTriplet[0].cond, rowTriplet[1].cond, rowTriplet[2].cond],
            cols: [colTriplet[0].cond, colTriplet[1].cond, colTriplet[2].cond],
            cellValidPlayerIds,
          });

          if (generated.length >= needed) {
            break outer;
          }
        }
      }
    }
  }

  return [...validCurated, ...generated];
}

/**
 * Kariyer Yolu (Career Path) havuzunu kürasyonları koruyarak ve yalnızca kronolojisi
 * doğrulanmış A takım kariyerlerini dahil ederek oluşturur.
 */
export function buildExpandedCareerChallenges(
  playersList: readonly Player[],
  clubs: Record<string, Club>,
  curatedChallenges: readonly CareerChallenge[],
  eligiblePlayerIds?: ReadonlySet<string>,
  options: PoolBuildOptions = {}
): CareerChallenge[] {
  const resolveId = options.resolvePlayerId || ((id: string) => id);
  const playersById = new Map<string, Player>();
  for (const pl of playersList) {
    playersById.set(pl.id, pl);
  }

  const validCurated: CareerChallenge[] = [];
  const curatedPlayerIds = new Set<string>();

  for (const item of curatedChallenges) {
    const canonPid = resolveId(item.playerId);
    if (!playersById.has(canonPid) || curatedPlayerIds.has(canonPid)) continue;
    curatedPlayerIds.add(canonPid);
    validCurated.push({
      ...item,
      playerId: canonPid,
      steps: item.steps.map((s) => {
        const nextStep: CareerChallenge['steps'][number] = {
          clubName: s.clubName,
          years: normalizeCareerYearRange(s.years),
          countryFlag: s.countryFlag,
          ...(s.clubId && clubs[s.clubId] ? { clubId: s.clubId } : {}),
        };
        return nextStep;
      }),
    });
  }

  const generated: CareerChallenge[] = [];
  for (const player of playersList) {
    if (curatedPlayerIds.has(player.id)) continue;
    if (eligiblePlayerIds && !eligiblePlayerIds.has(player.id)) continue;

    const cleanedHistory = sortAndCleanCareerHistory(player.careerHistory || []);
    const seniorEntries = cleanedHistory
      .filter((entry) => !entry.isYouth && !isReserveOrYouthClubName(entry.club))
      .filter((entry) => Boolean(getClubCrestUrl(entry.clubId, entry.club)));

    if (seniorEntries.length < 2) continue;
    if (!isCareerChronologyVerified(seniorEntries)) continue;

    generated.push({
      id: `car_auto_${player.id}`,
      playerId: player.id,
      steps: seniorEntries.map((entry) => ({
        ...(entry.clubId && clubs[entry.clubId] ? { clubId: entry.clubId } : {}),
        clubName: entry.club,
        years: normalizeCareerYearRange(entry.years),
        countryFlag: entry.countryFlag,
      })),
      funFact: `${player.name} (${player.flag} ${player.nationality}) kariyeri boyunca ${seniorEntries.length} farklı döneme imza attı.`,
    });
  }

  return [...validCurated, ...generated];
}
