import { getClubCrestUrl } from './clubLogos';
import {
  Club,
  CountryClubChallenge,
  MatchPairing,
  Player,
  XoxBoardChallenge,
  XoxCondition,
} from './types';

function canonicalClubPairKey(c1: string, c2: string): string {
  return c1 < c2 ? `${c1}__${c2}` : `${c2}__${c1}`;
}

/**
 * Verilen doğrulanmış `PLAYERS_LIST` verisinden (yalnızca A takım / senior geçmişi, `isYouth` hariç)
 * mevcut kürasyonları koruyarak yeni ve tekrar etmeyen "İki Kulüp" eşleşmeleri üretir.
 */
export function buildExpandedMatchPairings(
  playersList: readonly Player[],
  clubs: Record<string, Club>,
  curatedPairings: readonly MatchPairing[]
): MatchPairing[] {
  const existingKeys = new Set<string>();
  const existingIds = new Set<string>();
  const mergedCuratedByCanon = new Map<string, MatchPairing>();

  for (const p of curatedPairings) {
    const cKey = canonicalClubPairKey(p.club1Id, p.club2Id);
    const existing = mergedCuratedByCanon.get(cKey);
    if (existing) {
      const mergedValidIds = Array.from(
        new Set([...existing.validPlayerIds, ...p.validPlayerIds])
      );
      mergedCuratedByCanon.set(cKey, {
        ...existing,
        validPlayerIds: mergedValidIds,
      });
    } else {
      mergedCuratedByCanon.set(cKey, {
        ...p,
        validPlayerIds: Array.from(new Set(p.validPlayerIds)),
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

    if (seniorClubIds.length < 2) continue;

    for (let i = 0; i < seniorClubIds.length; i += 1) {
      for (let j = i + 1; j < seniorClubIds.length; j += 1) {
        const a = seniorClubIds[i];
        const b = seniorClubIds[j];
        const [c1, c2] = a < b ? [a, b] : [b, a];
        const key = `${c1}__${c2}`;
        if (existingKeys.has(key)) continue;

        let entry = pairBucket.get(key);
        if (!entry) {
          entry = { c1, c2, playerIds: [] };
          pairBucket.set(key, entry);
        }
        entry.playerIds.push(player.id);
      }
    }
  }

  const generated: MatchPairing[] = Array.from(pairBucket.entries())
    .filter(([, entry]) => entry.playerIds.length >= 2)
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
        playersList.find((pl) => pl.id === entry.playerIds[0])?.name || 'Ortak yıldızlar';
      return {
        id: existingIds.has(id) ? `${id}_ext` : id,
        club1Id: entry.c1,
        club2Id: entry.c2,
        validPlayerIds: entry.playerIds,
        funFact: `${club1Name} ve ${club2Name} formalarını giymiş ${entry.playerIds.length} futbolcu arasında ${sampleName} de yer alıyor.`,
      };
    });

  return [...dedupedCurated, ...generated];
}

/**
 * Verilen doğrulanmış `PLAYERS_LIST` verisinden mevcut kürasyonları bozmadan
 * Ülke + Kulüp soru havuzunu 900+ doğrulanmış kombinasyona çıkarır.
 */
export function buildExpandedCountryClubChallenges(
  playersList: readonly Player[],
  clubs: Record<string, Club>,
  curatedChallenges: readonly CountryClubChallenge[]
): CountryClubChallenge[] {
  const existingKeys = new Set<string>();
  const existingIds = new Set<string>();

  for (const c of curatedChallenges) {
    existingIds.add(c.id);
    existingKeys.add(`${c.country}||${c.clubId}`);
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

    for (const clubId of seniorClubIds) {
      const key = `${player.nationality}||${clubId}`;
      if (existingKeys.has(key)) continue;

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

  const generated: CountryClubChallenge[] = Array.from(bucket.entries())
    .filter(([, entry]) => entry.playerIds.length >= 2)
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
        playersList.find((pl) => pl.id === entry.playerIds[0])?.name || 'Ünlü isimler';
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

  return [...curatedChallenges, ...generated];
}

/**
 * Her 9 karesinde en az 2 doğrulanmış ortak futbolcu barındıran, 6 başlığı da farklı
 * ve tekrarsız deterministik 3x3 Futbol XOX tahtaları üretir.
 */
export function buildExpandedXoxBoards(
  playersList: readonly Player[],
  clubs: Record<string, Club>,
  curatedBoards: readonly XoxBoardChallenge[],
  targetTotalBoards = 320
): XoxBoardChallenge[] {
  const existingIds = new Set(curatedBoards.map((b) => b.id));
  const seenSignatures = new Set<string>();

  for (const b of curatedBoards) {
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

  // Build axis candidates: 28 clubs + 16 countries
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

  // Precompute compatibility map (axisA -> list of compatible axisB indices with >= 2 overlap)
  const intersectIds = (a: Set<string>, b: Set<string>): string[] => {
    const out: string[] = [];
    const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
    for (const id of smaller) {
      if (larger.has(id)) out.push(id);
    }
    return out;
  };

  // Precompute valid row triplets and match them against valid column triplets deterministically
  const generated: XoxBoardChallenge[] = [];
  const needed = Math.max(0, targetTotalBoards - curatedBoards.length);

  // Build adjacency of club row index -> compatible colAxis indices
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

  // Track club/country usage so generated boards spread across varied leagues & nations
  const pairUsage = new Map<string, number>();

  outer: for (let r1 = 0; r1 < clubAxes.length; r1 += 1) {
    for (let r2 = r1 + 1; r2 < clubAxes.length; r2 += 1) {
      // Quick intersect of compatible columns for (r1, r2)
      const cSet2 = new Set(compatColsPerRow[r2]);
      const commonCols12 = compatColsPerRow[r1].filter((cIdx) => cSet2.has(cIdx));
      if (commonCols12.length < 3) continue;

      for (let r3 = r2 + 1; r3 < clubAxes.length; r3 += 1) {
        const cSet3 = new Set(compatColsPerRow[r3]);
        const commonCols123 = commonCols12.filter((cIdx) => cSet3.has(cIdx));
        if (commonCols123.length < 3) continue;

        // Sort candidate cols by lowest reuse count to diversify boards
        const sortedCols = [...commonCols123].sort((a, b) => {
          const ua = pairUsage.get(colAxesPool[a].cond.id) || 0;
          const ub = pairUsage.get(colAxesPool[b].cond.id) || 0;
          return ua - ub;
        });

        const rowTriplet = [clubAxes[r1], clubAxes[r2], clubAxes[r3]];
        const rowSig = rowTriplet.map((r) => `${r.cond.type}:${r.cond.id}`).sort().join('|');

        // Pick non-overlapping column triplets (prefer up to 2 diverse col triplets per row triplet)
        let colTripletsCreatedForRows = 0;
        for (let ci = 0; ci < sortedCols.length && colTripletsCreatedForRows < 2; ci += 3) {
          if (ci + 2 >= sortedCols.length) break;
          const c1 = colAxesPool[sortedCols[ci]];
          const c2 = colAxesPool[sortedCols[ci + 1]];
          const c3 = colAxesPool[sortedCols[ci + 2]];
          const colSig = [c1, c2, c3].map((c) => `${c.cond.type}:${c.cond.id}`).sort().join('|');
          const sigKey = `${rowSig}::${colSig}`;
          if (seenSignatures.has(sigKey)) continue;

          // Ensure distinct labels across all 6 axes
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

  return [...curatedBoards, ...generated];
}
