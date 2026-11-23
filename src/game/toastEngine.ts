import {
  FriendActivityEvent,
  FriendEntry,
  ToastItem,
} from './types';
import { normalizeUsernameKey } from './accountEngine';

export const DEFAULT_TOAST_DURATION_MS = 8500;
export const MAX_VISIBLE_TOASTS = 4;

export function isEventFromFriend(
  event: Pick<FriendActivityEvent, 'actorId' | 'actorFriendCode' | 'actorName'>,
  selfId: string,
  selfFriendCode: string | undefined,
  friends: FriendEntry[]
): boolean {
  if (!event.actorId || event.actorId === selfId) {
    return false;
  }
  const eventCode = (event.actorFriendCode || '').trim().toUpperCase();
  const selfCode = (selfFriendCode || '').trim().toUpperCase();
  if (eventCode && selfCode && eventCode === selfCode) {
    return false;
  }

  const eventNameKey = normalizeUsernameKey(event.actorName || '');

  return friends.some((f) => {
    if (f.id && f.id === event.actorId) return true;
    const fCode = (f.friendCode || '').trim().toUpperCase();
    if (eventCode && fCode && eventCode === fCode) return true;
    const fNameKey = normalizeUsernameKey(f.name || '');
    if (eventNameKey.length >= 3 && fNameKey === eventNameKey) return true;
    return false;
  });
}

export interface HighScoreCheckInput {
  prevTotalPoints: number;
  prevWeeklyPoints: number;
  nextTotalPoints: number;
  nextWeeklyPoints: number;
  matchScoreEarned: number;
  won: boolean;
  isTournamentChampion?: boolean;
}

export function detectHighScoreMilestone(input: HighScoreCheckInput): {
  isHighScore: boolean;
  scoreValue: number;
  summary: string;
} {
  const prevWeekly = Math.max(0, Math.round(input.prevWeeklyPoints || 0));
  const nextWeekly = Math.max(0, Math.round(input.nextWeeklyPoints || 0));
  const nextTotal = Math.max(0, Math.round(input.nextTotalPoints || 0));
  const earned = Math.max(0, Math.round(input.matchScoreEarned || 0));

  if (input.isTournamentChampion) {
    return {
      isHighScore: true,
      scoreValue: nextWeekly,
      summary: `Turnuva şampiyonluğu ile ${nextWeekly.toLocaleString('tr-TR')} haftalık puana ulaştı`,
    };
  }

  const prevTier = Math.floor(prevWeekly / 500);
  const nextTier = Math.floor(nextWeekly / 500);
  if (nextWeekly >= 500 && nextTier > prevTier) {
    return {
      isHighScore: true,
      scoreValue: nextWeekly,
      summary: `Haftalık ${nextWeekly.toLocaleString('tr-TR')} puan barajını aştı`,
    };
  }

  if (input.won && earned >= 250) {
    return {
      isHighScore: true,
      scoreValue: nextWeekly > 0 ? nextWeekly : nextTotal,
      summary: `Tek maçta +${earned.toLocaleString('tr-TR')} puanlık yüksek skor yaptı`,
    };
  }

  return {
    isHighScore: false,
    scoreValue: nextWeekly,
    summary: '',
  };
}

export function buildToastFromFriendEvent(event: FriendActivityEvent): ToastItem {
  if (event.type === 'tournament_started') {
    const codePart = event.tournamentCode ? ` • Kod: ${event.tournamentCode}` : '';
    const detail = event.message || `${event.tournamentTitle || '8’li Turnuva'}${codePart}`;
    return {
      id: `toast_${event.id}`,
      eventId: event.id,
      type: 'tournament_started',
      actorId: event.actorId,
      actorFriendCode: event.actorFriendCode,
      actorName: event.actorName,
      actorAvatar: event.actorAvatar || '⚽',
      title: event.title || `${event.actorName} yeni turnuva başlattı!`,
      message: detail,
      badgeLabel: 'TURNUVA',
      tournamentCode: event.tournamentCode,
      minigameType: event.minigameType,
      createdAt: event.createdAt || Date.now(),
      durationMs: DEFAULT_TOAST_DURATION_MS,
    };
  }

  const formattedScore =
    typeof event.scoreValue === 'number' && event.scoreValue > 0
      ? `${Math.round(event.scoreValue).toLocaleString('tr-TR')} Puan`
      : '';
  const detail =
    event.message ||
    (formattedScore ? `${formattedScore} ile yeni yüksek skora ulaştı!` : 'Yeni yüksek skora ulaştı!');

  return {
    id: `toast_${event.id}`,
    eventId: event.id,
    type: 'high_score',
    actorId: event.actorId,
    actorFriendCode: event.actorFriendCode,
    actorName: event.actorName,
    actorAvatar: event.actorAvatar || '⚽',
    title: event.title || `${event.actorName} yüksek skor yaptı!`,
    message: detail,
    badgeLabel: 'YÜKSEK SKOR',
    scoreValue: event.scoreValue,
    createdAt: event.createdAt || Date.now(),
    durationMs: DEFAULT_TOAST_DURATION_MS,
  };
}

export function enqueueToast(
  queue: ToastItem[],
  nextToast: ToastItem,
  maxVisible: number = MAX_VISIBLE_TOASTS,
  seenEventIds?: Set<string>
): { queue: ToastItem[]; added: boolean } {
  if (nextToast.eventId) {
    if (seenEventIds?.has(nextToast.eventId)) {
      return { queue, added: false };
    }
    if (queue.some((t) => t.eventId === nextToast.eventId || t.id === nextToast.id)) {
      seenEventIds?.add(nextToast.eventId);
      return { queue, added: false };
    }
    seenEventIds?.add(nextToast.eventId);
  } else if (queue.some((t) => t.id === nextToast.id)) {
    return { queue, added: false };
  }

  const capped = [nextToast, ...queue].slice(0, Math.max(1, maxVisible));
  return { queue: capped, added: true };
}

export function dismissToast(queue: ToastItem[], toastId: string): ToastItem[] {
  return queue.filter((t) => t.id !== toastId);
}
