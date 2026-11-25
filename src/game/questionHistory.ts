import { MinigameRoundPayload, MinigameType } from './types';

const STORAGE_KEY = 'football_seen_question_ids_v1';
export const MIN_RECENT_QUESTION_WINDOW = 60;

export type SeenQuestionMap = Partial<Record<MinigameType, string[]>>;

export function shuffleFisherYates<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function canonicalTwoClubsKey(club1Id: string, club2Id: string): string {
  return club1Id < club2Id ? `pair:${club1Id}__${club2Id}` : `pair:${club2Id}__${club1Id}`;
}

export function getRoundItemId(round: MinigameRoundPayload): string {
  switch (round.minigameType) {
    case 'two_clubs':
      return round.pairing?.id || '';
    case 'silhouette':
      return round.silhouette?.id || '';
    case 'career':
      return round.career?.id || '';
    case 'country_club':
      return round.countryClub?.id || '';
    case 'xox':
      return round.xoxBoard?.id || '';
  }
}

export function getRoundCanonicalKey(round: MinigameRoundPayload): string {
  if (round.minigameType === 'two_clubs' && round.pairing) {
    return canonicalTwoClubsKey(round.pairing.club1Id, round.pairing.club2Id);
  }
  return getRoundItemId(round);
}

export interface SelectDiverseOptions<T> {
  getCanonicalKey?: (item: T) => string;
  getClubKeys?: (item: T) => readonly string[];
}

function reorderAvoidConsecutiveClubs<T>(
  candidates: T[],
  count: number,
  getId: (item: T) => string,
  options?: SelectDiverseOptions<T>
): T[] {
  if (!options?.getClubKeys && !options?.getCanonicalKey) {
    return candidates.slice(0, count);
  }

  const remaining = [...candidates];
  const chosen: T[] = [];
  const usedCanonical = new Set<string>();
  let prevClubs = new Set<string>();

  while (chosen.length < count && remaining.length > 0) {
    let pickIdx = remaining.findIndex((item) => {
      const canon = options.getCanonicalKey ? options.getCanonicalKey(item) : getId(item);
      if (usedCanonical.has(canon)) return false;
      if (!options.getClubKeys) return true;
      const clubs = options.getClubKeys(item);
      return clubs.every((c) => !prevClubs.has(c));
    });

    if (pickIdx < 0) {
      pickIdx = remaining.findIndex((item) => {
        const canon = options.getCanonicalKey ? options.getCanonicalKey(item) : getId(item);
        return !usedCanonical.has(canon);
      });
    }

    if (pickIdx < 0) {
      pickIdx = 0;
    }

    const [picked] = remaining.splice(pickIdx, 1);
    chosen.push(picked);
    const canon = options.getCanonicalKey ? options.getCanonicalKey(picked) : getId(picked);
    usedCanonical.add(canon);
    prevClubs = new Set(options.getClubKeys ? options.getClubKeys(picked) : []);
  }

  return chosen;
}

/**
 * Selects `count` items prioritizing unseen items first (Fisher-Yates shuffled),
 * deduplicating symmetric canonical keys (e.g., A-B === B-A) and spreading clubs across consecutive questions.
 */
export function selectDiverseItems<T>(
  pool: readonly T[],
  count: number,
  excludeIds: ReadonlySet<string> | readonly string[],
  getId: (item: T) => string,
  rng: () => number = Math.random,
  options?: SelectDiverseOptions<T>
): { items: T[]; cycledReset: boolean } {
  if (pool.length === 0) return { items: [], cycledReset: false };

  const seenSet = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);
  const getKey = (item: T) => getId(item);
  const getCanon = (item: T) => (options?.getCanonicalKey ? options.getCanonicalKey(item) : getId(item));

  // Deduplicate canonical keys inside pool first after shuffling so randomized symmetric duplicates collapse
  const shuffledPool = shuffleFisherYates(pool, rng);
  const uniqueByCanon: T[] = [];
  const seenCanonInPool = new Set<string>();
  for (const item of shuffledPool) {
    const cKey = getCanon(item);
    if (!seenCanonInPool.has(cKey)) {
      seenCanonInPool.add(cKey);
      uniqueByCanon.push(item);
    }
  }

  const unseen = uniqueByCanon.filter(
    (item) => !seenSet.has(getKey(item)) && !seenSet.has(getCanon(item))
  );

  if (unseen.length >= count) {
    return {
      items: reorderAvoidConsecutiveClubs(unseen, count, getKey, options),
      cycledReset: false,
    };
  }

  // Not enough unseen left: use all remaining unseen first, then pull oldest seen pool entries
  // excluding whatever was already chosen in `unseen`.
  const pickedCanons = new Set(unseen.map(getCanon));
  const seenRemainder = uniqueByCanon.filter((item) => !pickedCanons.has(getCanon(item)));

  const combined = [...unseen, ...seenRemainder];
  if (combined.length >= count) {
    return {
      items: reorderAvoidConsecutiveClubs(combined, count, getKey, options),
      cycledReset: true,
    };
  }

  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    result.push(combined[i % combined.length]);
  }
  return { items: result, cycledReset: true };
}

export function loadSeenQuestionMap(): SeenQuestionMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SeenQuestionMap) : {};
  } catch {
    return {};
  }
}

export function getSeenIdsForMinigame(minigameType: MinigameType): Set<string> {
  const map = loadSeenQuestionMap();
  const list = map[minigameType];
  return new Set(Array.isArray(list) ? list : []);
}

export function recordSeenQuestions(
  minigameType: MinigameType,
  ids: readonly string[],
  poolSize: number
): void {
  if (typeof window === 'undefined' || ids.length === 0) return;
  try {
    const map = loadSeenQuestionMap();
    const prev = Array.isArray(map[minigameType]) ? map[minigameType]! : [];
    const cleanedNew = ids.filter(Boolean);
    const merged: string[] = [];
    const seen = new Set<string>();

    // Preserve recency order so the trailing `keepRecentCount` entries stay protected
    for (const id of [...prev, ...cleanedNew]) {
      if (seen.has(id)) {
        const oldIdx = merged.indexOf(id);
        if (oldIdx >= 0) merged.splice(oldIdx, 1);
      }
      seen.add(id);
      merged.push(id);
    }

    const keepRecentCount = Math.min(Math.max(MIN_RECENT_QUESTION_WINDOW, cleanedNew.length), Math.max(0, poolSize - 1));
    const nextList =
      merged.length >= poolSize
        ? merged.slice(-Math.max(cleanedNew.length, keepRecentCount))
        : merged;

    map[minigameType] = nextList;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}
