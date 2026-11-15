import { MinigameRoundPayload, MinigameType } from './types';

const STORAGE_KEY = 'football_seen_question_ids_v1';

export type SeenQuestionMap = Partial<Record<MinigameType, string[]>>;

export function shuffleFisherYates<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

/**
 * Selects `count` items prioritizing unseen items first (Fisher-Yates shuffled),
 * then wrapping cleanly only once the full pool has been exhausted.
 */
export function selectDiverseItems<T>(
  pool: readonly T[],
  count: number,
  excludeIds: ReadonlySet<string> | readonly string[],
  getId: (item: T) => string,
  rng: () => number = Math.random
): { items: T[]; cycledReset: boolean } {
  if (pool.length === 0) return { items: [], cycledReset: false };

  const seenSet = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);
  const unseen = shuffleFisherYates(
    pool.filter((item) => !seenSet.has(getId(item))),
    rng
  );

  if (unseen.length >= count) {
    return { items: unseen.slice(0, count), cycledReset: false };
  }

  // Not enough unseen left: use all remaining unseen first, then reshuffle seen pool
  // excluding whatever was already put in `unseen` so the same item never repeats inside a match.
  const pickedIds = new Set(unseen.map(getId));
  const seenRemainder = shuffleFisherYates(
    pool.filter((item) => !pickedIds.has(getId(item))),
    rng
  );

  const combined = [...unseen, ...seenRemainder];
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
    const mergedSet = new Set([...prev, ...ids.filter(Boolean)]);

    // Once the entire pool has been seen, reset history keeping only the current match's IDs
    // so the very next match never repeats what the player just saw.
    const nextList =
      mergedSet.size >= poolSize
        ? Array.from(new Set(ids.filter(Boolean)))
        : Array.from(mergedSet);

    map[minigameType] = nextList;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}
