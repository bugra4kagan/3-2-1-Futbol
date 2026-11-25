import { MATCH_PAIRINGS, PLAYERS, CLUBS } from './database';
import { Player, MatchPairing } from './types';
import { canonicalTwoClubsKey, selectDiverseItems } from './questionHistory';

/**
 * Normalizes text for football player recognition:
 * - Lowercases with locale awareness
 * - Handles Turkish specific characters (ç, ğ, ı, ö, ş, ü, İ, I)
 * - Removes accents / diacritics (é -> e, á -> a, ñ -> n, etc.)
 * - Strips punctuation and excessive whitespace
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  let normalized = text.trim();

  // Turkish character mapping
  normalized = normalized
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/ß/g, 'ss');

  // Decompose accents & remove combining diacritical marks
  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Lowercase
  normalized = normalized.toLowerCase();

  // Remove symbols / punctuation, keep letters, numbers and space
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Standard Levenshtein distance calculation
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Checks if input is an exact or fuzzy match for a target token/alias.
 * Allows 1 typo for words of length 4-7, and 2 typos for words > 7.
 */
export function isFuzzyMatch(userInput: string, targetAlias: string): boolean {
  const cleanUser = normalizeText(userInput);
  const cleanTarget = normalizeText(targetAlias);

  if (!cleanUser || !cleanTarget) return false;

  // Exact match
  if (cleanUser === cleanTarget) return true;

  // User input matches target when prefix or suffix is included
  if (cleanUser.length >= 4 && cleanTarget.includes(cleanUser)) return true;
  if (cleanTarget.length >= 4 && cleanUser.includes(cleanTarget)) return true;

  // Levenshtein threshold based on length
  const maxDistance = cleanTarget.length <= 4 ? 0 : cleanTarget.length <= 7 ? 1 : 2;
  const distance = levenshteinDistance(cleanUser, cleanTarget);

  return distance <= maxDistance;
}

export interface ValidationResult {
  isValid: boolean;
  player: Player | null;
  matchedAlias?: string;
  normalizedInput: string;
}

export function validateAnswerForPlayerIds(
  userInput: string,
  validPlayerIds: string[]
): ValidationResult {
  const norm = normalizeText(userInput);
  if (!norm || norm.length < 2) {
    return { isValid: false, player: null, normalizedInput: norm };
  }

  const eligiblePlayers = validPlayerIds
    .map((id) => PLAYERS[id])
    .filter(Boolean);

  for (const player of eligiblePlayers) {
    if (isFuzzyMatch(norm, player.name)) {
      return { isValid: true, player, matchedAlias: player.name, normalizedInput: norm };
    }

    if (player.commonName && isFuzzyMatch(norm, player.commonName)) {
      return { isValid: true, player, matchedAlias: player.commonName, normalizedInput: norm };
    }

    for (const alias of player.aliases) {
      if (isFuzzyMatch(norm, alias)) {
        return { isValid: true, player, matchedAlias: alias, normalizedInput: norm };
      }
    }
  }

  return { isValid: false, player: null, normalizedInput: norm };
}

/**
 * Validates whether an answer matches any eligible player for the pairing.
 */
export function validateAnswerForPairing(
  userInput: string,
  pairing: MatchPairing
): ValidationResult {
  return validateAnswerForPlayerIds(userInput, pairing.validPlayerIds);
}

/**
 * Returns a randomized, non-repeating set of match pairings for a game session
 */
export function getRandomPairings(
  count: number = 10,
  excludeIds: ReadonlySet<string> | readonly string[] = []
): MatchPairing[] {
  const { items } = selectDiverseItems(
    MATCH_PAIRINGS,
    Math.min(count, MATCH_PAIRINGS.length),
    excludeIds,
    (p) => p.id,
    Math.random,
    {
      getCanonicalKey: (p) => canonicalTwoClubsKey(p.club1Id, p.club2Id),
      getClubKeys: (p) => [p.club1Id, p.club2Id],
    }
  );
  return items;
}

/**
 * Helper to get club objects for a pairing
 */
export function getClubsForPairing(pairing: MatchPairing) {
  return {
    club1: CLUBS[pairing.club1Id],
    club2: CLUBS[pairing.club2Id],
  };
}

/**
 * Helper to get all valid players for a pairing
 */
export function getPlayersForPairing(pairing: MatchPairing): Player[] {
  return pairing.validPlayerIds
    .map((id) => PLAYERS[id])
    .filter((p): p is Player => Boolean(p));
}
