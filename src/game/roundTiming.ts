import { MinigameType } from './types';

export function getRoundDurationSeconds(minigameType: MinigameType): number {
  return minigameType === 'silhouette' ? 120 : 15;
}

export function getClutchThresholdSeconds(minigameType: MinigameType): number {
  return minigameType === 'silhouette' ? 15 : 4;
}

export function formatRoundTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  if (safe >= 60) {
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
  return `${safe}s`;
}
