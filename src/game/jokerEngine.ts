import { PLAYERS } from './database';
import { Player } from './types';

export const JOKER_COSTS = {
  nationality_position: 100,
  initials: 150,
} as const;

export type JokerKind = keyof typeof JOKER_COSTS;

export interface NationalityPositionHint {
  playerId: string;
  nationality: string;
  flag: string;
  positionCode: Player['position'];
  positionLabel: string;
}

export interface InitialsHint {
  playerId: string;
  maskedName: string;
  wordCount: number;
}

export function getTurkishPositionLabel(position: Player['position']): string {
  switch (position) {
    case 'GK':
      return 'Kaleci (GK)';
    case 'DF':
      return 'Defans (DF)';
    case 'MF':
      return 'Orta Saha (MF)';
    case 'FW':
      return 'Forvet (FW)';
  }
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Picks a deterministic target footballer for Joker hints within a round
 * so repeated clicks or UI re-renders never switch target mid-round.
 */
export function pickDeterministicTargetPlayer(
  validPlayerIds: string[],
  roundSeed: string
): Player | null {
  const candidates = validPlayerIds
    .map((id) => PLAYERS[id])
    .filter((p): p is Player => Boolean(p));
  if (candidates.length === 0) return null;
  const idx = hashSeed(roundSeed) % candidates.length;
  return candidates[idx];
}

export function formatMaskedInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .map((part) => {
      const first = part[0]?.toUpperCase() || '';
      const stars = '*'.repeat(Math.max(2, Math.min(4, part.length - 1)));
      return `${first}${stars}`;
    })
    .join(' ');
}

export function getNationalityPositionHint(
  validPlayerIds: string[],
  roundSeed: string
): NationalityPositionHint | null {
  const target = pickDeterministicTargetPlayer(validPlayerIds, roundSeed);
  if (!target) return null;
  return {
    playerId: target.id,
    nationality: target.nationality,
    flag: target.flag,
    positionCode: target.position,
    positionLabel: getTurkishPositionLabel(target.position),
  };
}

export function getInitialsHint(
  validPlayerIds: string[],
  roundSeed: string
): InitialsHint | null {
  const target = pickDeterministicTargetPlayer(validPlayerIds, roundSeed);
  if (!target) return null;
  const displayName = target.commonName || target.name;
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    playerId: target.id,
    maskedName: formatMaskedInitials(displayName),
    wordCount: words.length,
  };
}
