import { CLUBS, MATCH_PAIRINGS, PLAYERS } from './database';
import rawPlayersData from '../data/players.json';
import { EXTRA_PLAYERS_50 } from './extraPlayers50';
import {
  CAREER_CHALLENGES,
  COUNTRY_CLUB_CHALLENGES,
  SILHOUETTE_CHALLENGES,
  XOX_BOARDS,
} from './minigamesData';
import {
  canonicalTwoClubsKey,
  SelectDiverseOptions,
  selectDiverseItems,
  shuffleFisherYates,
} from './questionHistory';
import {
  BotDifficulty,
  CareerChallenge,
  CountryClubChallenge,
  MatchPairing,
  MinigameRoundPayload,
  MinigameType,
  Player,
  SilhouetteChallenge,
  XoxBoardChallenge,
} from './types';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type DifficultyProfile =
  | 'bot_easy'
  | 'bot_medium'
  | 'bot_hard'
  | 'online'
  | 'balanced';

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export const DIFFICULTY_DISTRIBUTIONS: Record<DifficultyProfile, DifficultyDistribution> = {
  bot_easy: { easy: 1.0, medium: 0.0, hard: 0.0 },
  bot_medium: { easy: 0.70, medium: 0.30, hard: 0.0 },
  bot_hard: { easy: 0.40, medium: 0.45, hard: 0.15 },
  online: { easy: 0.70, medium: 0.25, hard: 0.05 },
  balanced: { easy: 0.50, medium: 0.35, hard: 0.15 },
};

export function getDifficultyProfileForBot(difficulty: BotDifficulty): DifficultyProfile {
  if (difficulty === 'easy') return 'bot_easy';
  if (difficulty === 'hard') return 'bot_hard';
  return 'bot_medium';
}

const SUPER_LIG_CLUB_IDS = new Set([
  'galatasaray',
  'fenerbahce',
  'besiktas',
  'trabzonspor',
  'basaksehir',
]);

const HIGH_PROFILE_CLUB_IDS = new Set([
  'galatasaray',
  'fenerbahce',
  'besiktas',
  'trabzonspor',
  'real_madrid',
  'barcelona',
  'atletico_madrid',
  'manchester_united',
  'manchester_city',
  'liverpool',
  'arsenal',
  'chelsea',
  'tottenham',
  'bayern_munich',
  'borussia_dortmund',
  'juventus',
  'inter_milan',
  'ac_milan',
  'napoli',
  'roma',
  'psg',
  'ajax',
  'porto',
  'benfica',
]);

const MAJOR_NATIONS = new Set([
  'Türkiye',
  'Brezilya',
  'Arjantin',
  'Fransa',
  'İngiltere',
  'Almanya',
  'İspanya',
  'İtalya',
  'Portekiz',
  'Hollanda',
  'Belçika',
  'Hırvatistan',
  'Uruguay',
]);

const RECOGNIZABLE_EUROPEAN_CLUB_IDS = new Set([
  ...HIGH_PROFILE_CLUB_IDS,
  'basaksehir',
  'sevilla',
  'valencia',
  'villarreal',
  'olympique_lyon',
  'olympique_marseille',
  'monaco',
  'lille',
  'lazio',
  'fiorentina',
  'atalanta',
  'bayer_leverkusen',
  'rb_leipzig',
  'sporting_cp',
  'psv_eindhoven',
  'feyenoord',
  'everton',
  'west_ham',
  'aston_villa',
  'newcastle_united',
  'leicester_city',
]);

/**
 * Geniş 25.000 futbolculuk geçerli cevap havuzundan bağımsız olarak,
 * Türkiye ve dünya futbolunda yaygın bilinen yıldızlar, Süper Lig ikonları ve efsaneler çekirdeği.
 */
const HOUSEHOLD_STAR_PLAYER_IDS = new Set<string>([
  ...(rawPlayersData as Array<{ id: string }>).map((p) => p.id),
  ...EXTRA_PLAYERS_50.map((p) => p.id),
]);

export function isHouseholdStarPlayer(playerId?: string | null): boolean {
  if (!playerId) return false;
  return HOUSEHOLD_STAR_PLAYER_IDS.has(playerId);
}

export function getHouseholdStarCount(validPlayerIds: readonly string[]): number {
  let count = 0;
  for (const id of validPlayerIds) {
    if (HOUSEHOLD_STAR_PLAYER_IDS.has(id)) count += 1;
  }
  return count;
}

export function hasHouseholdStarAnswer(validPlayerIds: readonly string[]): boolean {
  for (const id of validPlayerIds) {
    if (HOUSEHOLD_STAR_PLAYER_IDS.has(id)) return true;
  }
  return false;
}

const pairingDifficultyCache = new Map<string, QuestionDifficulty>();
const careerDifficultyCache = new Map<string, QuestionDifficulty>();
const countryClubDifficultyCache = new Map<string, QuestionDifficulty>();
const xoxDifficultyCache = new Map<string, QuestionDifficulty>();
const silhouetteDifficultyCache = new Map<string, QuestionDifficulty>();

function getPlayerFamiliarityScore(player?: Player | null): number {
  if (!player) return 0;
  let score = 0;

  if (HOUSEHOLD_STAR_PLAYER_IDS.has(player.id)) {
    score += 5;
  }

  const era = String(player.era || '').toLowerCase();
  if (era.includes('2020') || era.includes('günümüz')) {
    score += 3;
  } else if (era.includes('2010')) {
    score += 2;
  } else if (era.includes('2000')) {
    score += 1;
  }

  if (player.commonName) score += 1;
  if (player.photoUrl) score += 1;
  if (player.clubId && HIGH_PROFILE_CLUB_IDS.has(player.clubId)) score += 1;
  if (player.clubId && SUPER_LIG_CLUB_IDS.has(player.clubId)) score += 2;

  const history = player.careerHistory || [];
  let hasHighClub = false;
  let hasSuperLig = false;
  let hasModernYears = false;
  for (const step of history) {
    if (step.clubId && HIGH_PROFILE_CLUB_IDS.has(step.clubId)) hasHighClub = true;
    if (step.clubId && SUPER_LIG_CLUB_IDS.has(step.clubId)) hasSuperLig = true;
    if (/201[6-9]|202\d|Günümüz/i.test(step.years || '')) hasModernYears = true;
  }
  if (hasHighClub) score += 1;
  if (hasSuperLig) score += 2;
  if (hasModernYears) score += 1;

  return score;
}

export function classifyPairingDifficulty(pairing: MatchPairing): QuestionDifficulty {
  const cached = pairingDifficultyCache.get(pairing.id);
  if (cached) return cached;

  const c1Giant = HIGH_PROFILE_CLUB_IDS.has(pairing.club1Id);
  const c2Giant = HIGH_PROFILE_CLUB_IDS.has(pairing.club2Id);
  const c1Recognizable = RECOGNIZABLE_EUROPEAN_CLUB_IDS.has(pairing.club1Id);
  const c2Recognizable = RECOGNIZABLE_EUROPEAN_CLUB_IDS.has(pairing.club2Id);
  const hasSuperLig =
    SUPER_LIG_CLUB_IDS.has(pairing.club1Id) || SUPER_LIG_CLUB_IDS.has(pairing.club2Id);
  const validCount = pairing.validPlayerIds.length;
  const famousCount = getHouseholdStarCount(pairing.validPlayerIds);

  // Çok sayıda geçerli cevap tek başına kolaylık anlamına gelmez:
  // En az 1 yaygın olarak bilinen futbolcu + tanınmış büyük kulüp eşleşmesi şarttır.
  let tier: QuestionDifficulty;
  if (
    (c1Giant && c2Giant && famousCount >= 1) ||
    (hasSuperLig && c1Recognizable && c2Recognizable && famousCount >= 2)
  ) {
    tier = 'easy';
  } else if (
    famousCount >= 1 ||
    (validCount >= 5 && c1Recognizable && c2Recognizable)
  ) {
    tier = 'medium';
  } else {
    tier = 'hard';
  }

  pairingDifficultyCache.set(pairing.id, tier);
  return tier;
}

export function classifyCareerDifficulty(challenge: CareerChallenge): QuestionDifficulty {
  const cached = careerDifficultyCache.get(challenge.id);
  if (cached) return cached;

  // Kariyer Yolu kolay seviyesinde yalnızca gerçekten tanınmış yıldızlar ve efsaneler sorulur.
  if (isHouseholdStarPlayer(challenge.playerId)) {
    careerDifficultyCache.set(challenge.id, 'easy');
    return 'easy';
  }

  const player = PLAYERS[challenge.playerId];
  let score = getPlayerFamiliarityScore(player);

  const hasStepHighClub = challenge.steps.some(
    (s) => s.clubId && HIGH_PROFILE_CLUB_IDS.has(s.clubId)
  );
  const hasStepSuperLig = challenge.steps.some(
    (s) => s.clubId && SUPER_LIG_CLUB_IDS.has(s.clubId)
  );
  const hasRecentStep = challenge.steps.some((s) =>
    /201[8-9]|202\d|Günümüz/i.test(s.years || '')
  );

  if (hasStepHighClub) score += 2;
  if (hasStepSuperLig) score += 2;
  if (hasRecentStep) score += 1;

  const tier: QuestionDifficulty = score >= 7 ? 'medium' : 'hard';
  careerDifficultyCache.set(challenge.id, tier);
  return tier;
}

export function classifyCountryClubDifficulty(
  challenge: CountryClubChallenge
): QuestionDifficulty {
  const cached = countryClubDifficultyCache.get(challenge.id);
  if (cached) return cached;

  const isMajorClub = HIGH_PROFILE_CLUB_IDS.has(challenge.clubId);
  const isSuperLig = SUPER_LIG_CLUB_IDS.has(challenge.clubId);
  const isMajorNation = MAJOR_NATIONS.has(challenge.country);
  const validCount = challenge.validPlayerIds.length;
  const famousCount = getHouseholdStarCount(challenge.validPlayerIds);

  // Kolay Ülke + Kulüp sorusu için büyük/Süper Lig kulübü + en az 1 yaygın bilinen futbolcu şarttır.
  let tier: QuestionDifficulty;
  if (
    (isMajorClub || isSuperLig) &&
    famousCount >= 1 &&
    (isMajorNation || famousCount >= 2)
  ) {
    tier = 'easy';
  } else if (
    famousCount >= 1 ||
    (validCount >= 4 && (isMajorClub || isSuperLig) && isMajorNation)
  ) {
    tier = 'medium';
  } else {
    tier = 'hard';
  }

  countryClubDifficultyCache.set(challenge.id, tier);
  return tier;
}

export function classifyXoxDifficulty(board: XoxBoardChallenge): QuestionDifficulty {
  const cached = xoxDifficultyCache.get(board.id);
  if (cached) return cached;

  const cells = Object.values(board.cellValidPlayerIds);
  const cellCounts = cells.map((arr) => arr.length);
  const minCell = cellCounts.length > 0 ? Math.min(...cellCounts) : 0;
  const famousCells = cells.filter((ids) => hasHouseholdStarAnswer(ids)).length;
  const allCellsHaveFamousPlayer = cells.length === 9 && famousCells === 9;
  const giantAxes = [...board.rows, ...board.cols].filter(
    (axis) =>
      (axis.type === 'club' && HIGH_PROFILE_CLUB_IDS.has(axis.id)) ||
      (axis.type === 'country' && MAJOR_NATIONS.has(axis.label)) ||
      axis.type === 'teammate'
  ).length;

  // Çırak / kolay XOX tahtasında 9 hücrenin TAMAMI yaygın bilinen en az 1 futbolcuyla çözülebilmelidir.
  let tier: QuestionDifficulty;
  if (allCellsHaveFamousPlayer && giantAxes >= 2) {
    tier = 'easy';
  } else if (cells.length === 9 && famousCells >= 6 && minCell >= 2 && giantAxes >= 1) {
    tier = 'medium';
  } else {
    tier = 'hard';
  }

  xoxDifficultyCache.set(board.id, tier);
  return tier;
}

export function classifySilhouetteDifficulty(
  challenge: SilhouetteChallenge
): QuestionDifficulty {
  const cached = silhouetteDifficultyCache.get(challenge.id);
  if (cached) return cached;

  const score = getPlayerFamiliarityScore(PLAYERS[challenge.playerId]);
  const tier: QuestionDifficulty = score >= 7 ? 'easy' : score >= 4 ? 'medium' : 'hard';
  silhouetteDifficultyCache.set(challenge.id, tier);
  return tier;
}

export function classifyQuestionDifficulty(round: MinigameRoundPayload): QuestionDifficulty {
  if (round.minigameType === 'two_clubs' && round.pairing) {
    return classifyPairingDifficulty(round.pairing);
  }
  if (round.minigameType === 'career' && round.career) {
    return classifyCareerDifficulty(round.career);
  }
  if (round.minigameType === 'country_club' && round.countryClub) {
    return classifyCountryClubDifficulty(round.countryClub);
  }
  if (round.minigameType === 'xox' && round.xoxBoard) {
    return classifyXoxDifficulty(round.xoxBoard);
  }
  if (round.minigameType === 'silhouette' && round.silhouette) {
    return classifySilhouetteDifficulty(round.silhouette);
  }
  return 'medium';
}

export function isPopularOnlineItem(round: MinigameRoundPayload): boolean {
  if (round.minigameType === 'two_clubs' && round.pairing) {
    return (
      HIGH_PROFILE_CLUB_IDS.has(round.pairing.club1Id) ||
      HIGH_PROFILE_CLUB_IDS.has(round.pairing.club2Id)
    );
  }
  if (round.minigameType === 'career' && round.career) {
    return (
      getPlayerFamiliarityScore(PLAYERS[round.career.playerId]) >= 5 ||
      round.career.steps.some((s) => s.clubId && HIGH_PROFILE_CLUB_IDS.has(s.clubId))
    );
  }
  if (round.minigameType === 'country_club' && round.countryClub) {
    return (
      HIGH_PROFILE_CLUB_IDS.has(round.countryClub.clubId) ||
      MAJOR_NATIONS.has(round.countryClub.country)
    );
  }
  if (round.minigameType === 'xox' && round.xoxBoard) {
    return [...round.xoxBoard.rows, ...round.xoxBoard.cols].some(
      (a) => a.type === 'club' && HIGH_PROFILE_CLUB_IDS.has(a.id)
    );
  }
  return true;
}

function allocateQuotaCounts(
  count: number,
  distribution: DifficultyDistribution
): Record<QuestionDifficulty, number> {
  const keys: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
  const raw = keys.map((k) => ({
    key: k,
    exact: count * distribution[k],
    floor: Math.floor(count * distribution[k]),
  }));
  let assigned = raw.reduce((sum, r) => sum + r.floor, 0);
  const sortedRemainders = [...raw].sort(
    (a, b) => b.exact - b.floor - (a.exact - a.floor)
  );
  const result: Record<QuestionDifficulty, number> = {
    easy: raw[0].floor,
    medium: raw[1].floor,
    hard: raw[2].floor,
  };
  let idx = 0;
  while (assigned < count) {
    const bucket = sortedRemainders[idx % sortedRemainders.length];
    if (distribution[bucket.key] > 0) {
      result[bucket.key] += 1;
      assigned += 1;
    }
    idx += 1;
  }
  return result;
}

export function selectDifficultyWeightedItems<T>(
  pool: readonly T[],
  count: number,
  excludeIds: ReadonlySet<string> | readonly string[],
  getId: (item: T) => string,
  getDifficulty: (item: T) => QuestionDifficulty,
  profile: DifficultyProfile,
  rng: () => number = Math.random,
  options?: SelectDiverseOptions<T> & {
    prioritizePredicate?: (item: T) => boolean;
  }
): T[] {
  if (pool.length === 0 || count <= 0) return [];
  const distribution = DIFFICULTY_DISTRIBUTIONS[profile];
  const quotas = allocateQuotaCounts(Math.min(count, pool.length), distribution);

  const buckets: Record<QuestionDifficulty, T[]> = {
    easy: [],
    medium: [],
    hard: [],
  };

  for (const item of pool) {
    buckets[getDifficulty(item)].push(item);
  }

  const allowedTiers = (['easy', 'medium', 'hard'] as const).filter(
    (tier) => distribution[tier] > 0
  );
  const allowedPool = allowedTiers.flatMap((tier) => buckets[tier]);
  const effectivePool = allowedPool.length > 0 ? allowedPool : [...pool];
  const targetCount = Math.min(count, effectivePool.length);
  const adjustedQuotas = allocateQuotaCounts(targetCount, distribution);

  // If online profile, optionally weight high-familiarity stars/leagues to front
  const prioritizeBucket = (items: T[]): T[] => {
    if (!options?.prioritizePredicate) return items;
    const priority = items.filter(options.prioritizePredicate);
    const rest = items.filter((item) => !options.prioritizePredicate!(item));
    return [...shuffleFisherYates(priority, rng), ...shuffleFisherYates(rest, rng)];
  };

  const chosen: T[] = [];
  const usedIds = new Set<string>();
  const usedCanons = new Set<string>();
  const baseExclude = new Set(excludeIds);

  const pickFromTier = (
    tier: QuestionDifficulty,
    needed: number,
    unseenOnly: boolean
  ) => {
    const remainingSlots = targetCount - chosen.length;
    const boundedNeeded = Math.min(needed, remainingSlots);
    if (boundedNeeded <= 0 || buckets[tier].length === 0) return;
    const candidates = buckets[tier].filter((item) => {
      const id = getId(item);
      const canon = options?.getCanonicalKey ? options.getCanonicalKey(item) : id;
      if (usedIds.has(id) || usedCanons.has(canon)) return false;
      if (unseenOnly && (baseExclude.has(id) || baseExclude.has(canon))) return false;
      return true;
    });
    if (candidates.length === 0) return;
    const orderedPool = prioritizeBucket(candidates);
    const combinedExclude = new Set<string>([...baseExclude, ...usedIds, ...usedCanons]);
    const { items } = selectDiverseItems(
      orderedPool,
      Math.min(boundedNeeded, orderedPool.length),
      combinedExclude,
      getId,
      rng,
      options
    );
    for (const item of items) {
      if (chosen.length >= targetCount) break;
      const id = getId(item);
      const canon = options?.getCanonicalKey ? options.getCanonicalKey(item) : id;
      if (usedIds.has(id) || usedCanons.has(canon)) continue;
      usedIds.add(id);
      usedCanons.add(canon);
      chosen.push(item);
    }
  };

  // Pass 1: hit exact difficulty quotas using unseen items first
  pickFromTier('easy', adjustedQuotas.easy, true);
  pickFromTier('medium', adjustedQuotas.medium, true);
  pickFromTier('hard', adjustedQuotas.hard, true);

  // Pass 2: if a tier lacked unseen items, try unseen items ONLY from allowed tiers before repeating
  if (chosen.length < targetCount) {
    const remainingUnseen = effectivePool.filter((item) => {
      const id = getId(item);
      const canon = options?.getCanonicalKey ? options.getCanonicalKey(item) : id;
      return !usedIds.has(id) && !usedCanons.has(canon) && !baseExclude.has(id) && !baseExclude.has(canon);
    });
    if (remainingUnseen.length > 0) {
      const combinedExclude = new Set<string>([...baseExclude, ...usedIds, ...usedCanons]);
      const { items } = selectDiverseItems(
        prioritizeBucket(remainingUnseen),
        Math.min(targetCount - chosen.length, remainingUnseen.length),
        combinedExclude,
        getId,
        rng,
        options
      );
      for (const item of items) {
        if (chosen.length >= targetCount) break;
        const id = getId(item);
        const canon = options?.getCanonicalKey ? options.getCanonicalKey(item) : id;
        if (!usedIds.has(id) && !usedCanons.has(canon)) {
          usedIds.add(id);
          usedCanons.add(canon);
          chosen.push(item);
        }
      }
    }
  }

  // Pass 3: only if unseen pool in allowed tiers is exhausted, backfill with previously seen items honoring quotas
  if (chosen.length < targetCount) {
    pickFromTier('easy', Math.max(0, adjustedQuotas.easy - chosen.filter((i) => getDifficulty(i) === 'easy').length), false);
    pickFromTier('medium', Math.max(0, adjustedQuotas.medium - chosen.filter((i) => getDifficulty(i) === 'medium').length), false);
    pickFromTier('hard', Math.max(0, adjustedQuotas.hard - chosen.filter((i) => getDifficulty(i) === 'hard').length), false);
  }

  // Final safeguard fill (strictly within allowed tiers when available)
  if (chosen.length < targetCount) {
    const remaining = effectivePool.filter((item) => {
      const id = getId(item);
      const canon = options?.getCanonicalKey ? options.getCanonicalKey(item) : id;
      return !usedIds.has(id) && !usedCanons.has(canon);
    });
    const combinedExclude = new Set<string>([...baseExclude, ...usedIds, ...usedCanons]);
    const { items } = selectDiverseItems(
      prioritizeBucket(remaining),
      Math.min(targetCount - chosen.length, remaining.length),
      combinedExclude,
      getId,
      rng,
      options
    );
    for (const item of items) {
      if (chosen.length >= targetCount) break;
      const id = getId(item);
      const canon = options?.getCanonicalKey ? options.getCanonicalKey(item) : id;
      if (!usedIds.has(id) && !usedCanons.has(canon)) {
        usedIds.add(id);
        usedCanons.add(canon);
        chosen.push(item);
      }
    }
  }

  return shuffleFisherYates(chosen, rng);
}

export function getFullPoolCatalogStats() {
  return {
    two_clubs: MATCH_PAIRINGS.length,
    career: CAREER_CHALLENGES.length,
    country_club: COUNTRY_CLUB_CHALLENGES.length,
    xox: XOX_BOARDS.length,
    silhouette: SILHOUETTE_CHALLENGES.length,
    clubs: Object.keys(CLUBS).length,
    players: Object.keys(PLAYERS).length,
  };
}

export { canonicalTwoClubsKey };
