import { PLAYERS, PLAYERS_LIST } from './database';
import { isSouthAmericaLocalOnlyPlayer } from './minigameEngine';
import { Player } from './types';

export interface FriendChallengePayload {
  challengerName: string;
  challengerTimeSec: number;
  playerIds: string[];
}

function encodeBase64Url(jsonText: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(jsonText, 'utf8').toString('base64url');
    }
    const utf8Bytes = new TextEncoder().encode(jsonText);
    let binary = '';
    utf8Bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch {
    return '';
  }
}

function decodeBase64Url(code: string): string | null {
  try {
    const clean = code.trim();
    if (!clean) return null;
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(clean, 'base64url').toString('utf8');
    }
    const base64 = clean.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    const binary = atob(base64 + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Maçta öne çıkan futbolcuları 5 kişilik kesin bir kadro olarak ?challenge=... koduna paketler.
 */
export function buildChallengeLineupIds(seedIds: string[]): string[] {
  const uniqueValid: string[] = [];
  const seen = new Set<string>();

  for (const raw of seedIds) {
    const clean = raw.trim();
    if (clean && PLAYERS[clean] && !seen.has(clean)) {
      seen.add(clean);
      uniqueValid.push(clean);
      if (uniqueValid.length === 5) return uniqueValid;
    }
  }

  for (const p of PLAYERS_LIST) {
    if (
      !seen.has(p.id) &&
      !isSouthAmericaLocalOnlyPlayer(p) &&
      Array.isArray(p.careerHistory) &&
      p.careerHistory.length >= 2
    ) {
      seen.add(p.id);
      uniqueValid.push(p.id);
      if (uniqueValid.length === 5) break;
    }
  }
  return uniqueValid;
}

export function encodeFriendChallengeCode(payload: FriendChallengePayload): string {
  const lineup = buildChallengeLineupIds(payload.playerIds);
  const compact = {
    n: (payload.challengerName || 'Rakip').slice(0, 24),
    t: Math.max(1, Number((payload.challengerTimeSec || 25).toFixed(1))),
    p: lineup,
  };
  return encodeBase64Url(JSON.stringify(compact));
}

export function decodeFriendChallengeCode(code: string): FriendChallengePayload | null {
  const json = decodeBase64Url(code);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as { n?: unknown; t?: unknown; p?: unknown };
    if (!Array.isArray(parsed.p)) return null;
    const validIds = parsed.p
      .filter((id): id is string => typeof id === 'string' && Boolean(PLAYERS[id]))
      .slice(0, 5);
    if (validIds.length < 5) return null;
    return {
      challengerName: typeof parsed.n === 'string' && parsed.n.trim() ? parsed.n.trim() : 'Arkadaşın',
      challengerTimeSec: typeof parsed.t === 'number' && parsed.t > 0 ? parsed.t : 30,
      playerIds: validIds,
    };
  } catch {
    return null;
  }
}

export function buildFriendChallengeUrl(
  payload: FriendChallengePayload,
  baseHref?: string
): { code: string; url: string } {
  const code = encodeFriendChallengeCode(payload);
  const origin =
    baseHref ||
    (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://321futbol.app/');
  const sep = origin.includes('?') ? '&' : '?';
  return {
    code,
    url: `${origin}${sep}challenge=${encodeURIComponent(code)}`,
  };
}

export function resolveChallengePlayers(playerIds: string[]): Player[] {
  return playerIds.map((id) => PLAYERS[id]).filter((p): p is Player => Boolean(p));
}
