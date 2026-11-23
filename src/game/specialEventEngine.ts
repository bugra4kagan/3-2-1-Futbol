import { PLAYERS_LIST, PLAYERS } from './database';
import { isSouthAmericaLocalOnlyPlayer } from './minigameEngine';
import { getLocalDateKey } from './retentionEngine';
import { Player } from './types';

export interface SpecialEventState {
  dateKey: string;
  freeEntryUsed: boolean;
  runsCompletedToday: number;
  jackpotsWon: number;
}

export const SPECIAL_EVENT_STORAGE_KEY = '321_special_event_v1';
export const SPECIAL_EVENT_COIN_COST = 250;
export const SPECIAL_EVENT_JACKPOT_COINS = 1200;
export const SPECIAL_EVENT_STARS_COUNT = 5;

export function createInitialSpecialEventState(now: Date = new Date()): SpecialEventState {
  return {
    dateKey: getLocalDateKey(now),
    freeEntryUsed: false,
    runsCompletedToday: 0,
    jackpotsWon: 0,
  };
}

export function loadSpecialEventState(now: Date = new Date()): SpecialEventState {
  const today = getLocalDateKey(now);
  const fresh = createInitialSpecialEventState(now);
  if (typeof window === 'undefined' || !window.localStorage) return fresh;
  try {
    const raw = window.localStorage.getItem(SPECIAL_EVENT_STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<SpecialEventState>;
    if (parsed.dateKey !== today) {
      saveSpecialEventState(fresh);
      return fresh;
    }
    return {
      ...fresh,
      ...parsed,
    };
  } catch {
    return fresh;
  }
}

export function saveSpecialEventState(state: SpecialEventState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SPECIAL_EVENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function canUseFreeSpecialEventEntry(
  state: SpecialEventState,
  now: Date = new Date()
): boolean {
  const today = getLocalDateKey(now);
  return state.dateKey !== today || !state.freeEntryUsed;
}

export function markSpecialEventEntryUsed(
  entryType: 'free' | 'ad' | 'coin',
  state: SpecialEventState = loadSpecialEventState(),
  now: Date = new Date()
): SpecialEventState {
  const today = getLocalDateKey(now);
  const base = state.dateKey === today ? state : createInitialSpecialEventState(now);
  const next: SpecialEventState = {
    ...base,
    freeEntryUsed: entryType === 'free' ? true : base.freeEntryUsed,
  };
  saveSpecialEventState(next);
  return next;
}

export function recordSpecialEventFinish(
  wonJackpot: boolean,
  state: SpecialEventState = loadSpecialEventState(),
  now: Date = new Date()
): SpecialEventState {
  const today = getLocalDateKey(now);
  const base = state.dateKey === today ? state : createInitialSpecialEventState(now);
  const next: SpecialEventState = {
    ...base,
    runsCompletedToday: base.runsCompletedToday + 1,
    jackpotsWon: base.jackpotsWon + (wonJackpot ? 1 : 0),
  };
  saveSpecialEventState(next);
  return next;
}

/**
 * "Derbi & Efsaneler Kupası" 5 yıldızlı maraton için Süper Lig derbi yıldızları ve dünya efsanelerinden
 * rastgele 5 futbolcu seçer.
 */
export function pickSpecialEventLineup(count: number = SPECIAL_EVENT_STARS_COUNT): Player[] {
  const pool = PLAYERS_LIST.filter(
    (p) =>
      !isSouthAmericaLocalOnlyPlayer(p) &&
      Array.isArray(p.careerHistory) &&
      p.careerHistory.length >= 2 &&
      (p.league === 'Süper Lig' ||
        p.league === 'Efsane' ||
        p.league === 'Premier League' ||
        p.league === 'La Liga' ||
        p.league === 'Serie A')
  );

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  if (selected.length < count) {
    return Object.values(PLAYERS).slice(0, count);
  }
  return selected;
}
