/**
 * Firebase Realtime Database: live global leaderboard (leaderboard/{playerId}).
 *
 * 1v1 rooms and quick-match live in Cloud Firestore — see firestoreRoomService.ts.
 */
import { get, onValue, ref, remove, set } from 'firebase/database';
import { auth, ensureAnonymousFirebaseSession, rtdb } from '../firebase';
import { sanitizeRtdbKey } from '../game/realtimeSyncHelpers';
import { LeaguePlayerEntry, MinigameType, PlayerProfile, UserProgression } from '../game/types';

// ── 1. LIVE GLOBAL LEADERBOARD (leaderboard/{playerId}) ──

export async function syncPlayerToRtdbLeaderboard(
  prog: UserProgression,
  profile: PlayerProfile
): Promise<void> {
  if (!profile?.id) return;
  try {
    const firebaseUser = auth.currentUser || (await ensureAnonymousFirebaseSession());
    if (!firebaseUser?.uid) return;

    const key = sanitizeRtdbKey(profile.id);
    const payload: LeaguePlayerEntry & { ownerUid: string; updatedAt: number } = {
      id: profile.id,
      ownerUid: firebaseUser.uid,
      friendCode: prog.friendCode,
      name: profile.name,
      avatar: profile.avatar,
      favoriteClubId: profile.favoriteClubId,
      weeklyPoints: prog.weeklyPoints,
      totalPoints: prog.totalPoints,
      subtitle: prog.equippedTitle || '',
      equippedCrest: prog.equippedCrest || '',
      equippedFrame: prog.equippedFrame || '',
      equippedBadge: prog.equippedBadge || '',
      hasCrown: prog.unlockedGiftIds.includes('gift_title_legend'),
      matchesPlayed: prog.matchesPlayed,
      wins: prog.wins,
      losses: prog.losses,
      winStreak: prog.winStreak,
      bestWinStreak: prog.bestWinStreak,
      totalCorrectAnswers: prog.totalCorrectAnswers,
      totalWrongAttempts: prog.totalWrongAttempts,
      fastestAnswerSec: prog.fastestAnswerSec ?? null,
      clutchAnswers: prog.clutchAnswers,
      minigameMatchCounts: prog.minigameMatchCounts,
      dailyStreakDays: prog.dailyLogin?.streakDays ?? 0,
      tournamentWins: prog.tournamentWins ?? 0,
      tournamentsPlayed: prog.tournamentsPlayed ?? 0,
      updatedAt: Date.now(),
    };
    await set(ref(rtdb, `leaderboard/${key}`), payload);
  } catch {
    // Graceful offline / rules fallback: localStorage remains source of truth for UX
  }
}

export async function deletePlayerFromRtdbLeaderboard(playerId: string): Promise<void> {
  if (!playerId) return;
  try {
    const key = sanitizeRtdbKey(playerId);
    await remove(ref(rtdb, `leaderboard/${key}`));
  } catch {
    // Ignore cleanup errors if entry doesn't exist or user is already unauthenticated
  }
}

function normalizeLeaderboardSnapshot(raw: unknown): LeaguePlayerEntry[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries = Object.values(raw as Record<string, Record<string, unknown>>)
    .filter((v) => v && typeof v === 'object' && typeof v.name === 'string')
    .map((v): LeaguePlayerEntry => ({
      id: String(v.id || ''),
      friendCode: typeof v.friendCode === 'string' ? v.friendCode : undefined,
      name: String(v.name || 'Oyuncu'),
      avatar: String(v.avatar || '⚽'),
      weeklyPoints: Math.max(0, Number(v.weeklyPoints) || 0),
      totalPoints: Math.max(0, Number(v.totalPoints) || 0),
      subtitle: typeof v.subtitle === 'string' && v.subtitle ? v.subtitle : undefined,
      hasCrown: Boolean(v.hasCrown),
      favoriteClubId: typeof v.favoriteClubId === 'string' ? v.favoriteClubId : undefined,
      equippedCrest: typeof v.equippedCrest === 'string' && v.equippedCrest ? v.equippedCrest : undefined,
      equippedFrame: typeof v.equippedFrame === 'string' && v.equippedFrame ? v.equippedFrame : undefined,
      equippedBadge: typeof v.equippedBadge === 'string' && v.equippedBadge ? v.equippedBadge : undefined,
      matchesPlayed: Math.max(0, Number(v.matchesPlayed) || 0),
      wins: Math.max(0, Number(v.wins) || 0),
      losses: Math.max(0, Number(v.losses) || 0),
      winStreak: Math.max(0, Number(v.winStreak) || 0),
      bestWinStreak: Math.max(0, Number(v.bestWinStreak) || 0),
      totalCorrectAnswers: Math.max(0, Number(v.totalCorrectAnswers) || 0),
      totalWrongAttempts: Math.max(0, Number(v.totalWrongAttempts) || 0),
      fastestAnswerSec:
        typeof v.fastestAnswerSec === 'number' && Number.isFinite(v.fastestAnswerSec)
          ? v.fastestAnswerSec
          : null,
      clutchAnswers: Math.max(0, Number(v.clutchAnswers) || 0),
      minigameMatchCounts:
        v.minigameMatchCounts && typeof v.minigameMatchCounts === 'object'
          ? (v.minigameMatchCounts as Record<MinigameType, number>)
          : undefined,
      dailyStreakDays: Math.max(0, Number(v.dailyStreakDays) || 0),
      tournamentWins: Math.max(0, Number(v.tournamentWins) || 0),
      tournamentsPlayed: Math.max(0, Number(v.tournamentsPlayed) || 0),
    }));

  entries.sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.totalPoints - a.totalPoints);
  return entries;
}

export async function fetchRtdbLeaderboard(): Promise<LeaguePlayerEntry[]> {
  try {
    const snap = await get(ref(rtdb, 'leaderboard'));
    if (!snap.exists()) return [];
    return normalizeLeaderboardSnapshot(snap.val());
  } catch {
    return [];
  }
}

export function subscribeRtdbLeaderboard(
  onUpdate: (players: LeaguePlayerEntry[]) => void
): () => void {
  try {
    const lbRef = ref(rtdb, 'leaderboard');
    return onValue(
      lbRef,
      (snap) => {
        if (!snap.exists()) return;
        const list = normalizeLeaderboardSnapshot(snap.val());
        if (list.length > 0) {
          onUpdate(list);
        }
      },
      () => {
        // ignore listener permission/offline error silently
      }
    );
  } catch {
    return () => {};
  }
}
