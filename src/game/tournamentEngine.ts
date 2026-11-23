import {
  BotDifficulty,
  MinigameType,
  PlayerProfile,
  TournamentBracketState,
  TournamentMatchSlot,
  TournamentMode,
  TournamentParticipant,
} from './types';

export const TOURNAMENT_OPEN_ENTRY_COINS = 2000;
export const TOURNAMENT_OPEN_PRIZE_COINS = 6000;
export const TOURNAMENT_OPEN_PRIZE_POINTS = 400;

export const FRIEND_TOURNAMENT_STAKES = [
  { entryCoins: 500, prizeCoins: 1500, label: '500 🪙 → 1.500 🪙' },
  { entryCoins: 1000, prizeCoins: 3000, label: '1.000 🪙 → 3.000 🪙' },
  { entryCoins: 2000, prizeCoins: 6000, label: '2.000 🪙 → 6.000 🪙' },
];

const TOURNAMENT_BOT_SEEDS: { name: string; avatar: string }[] = [
  { name: 'Bot #1 • Çırak', avatar: '🤖' },
  { name: 'Bot #2 • Forvet', avatar: '⚡' },
  { name: 'Bot #3 • Maestro', avatar: '🎯' },
  { name: 'Bot #4 • Şampiyon', avatar: '🧠' },
  { name: 'Bot #5 • Kaptan', avatar: '🛡️' },
  { name: 'Bot #6 • Efsane', avatar: '👑' },
  { name: 'Bot #7 • Golcü', avatar: '🔥' },
];

export function generateTournamentCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'T';
  for (let i = 0; i < 4; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export function buildEightParticipants(
  userProfile: PlayerProfile,
  realParticipants: TournamentParticipant[] = []
): TournamentParticipant[] {
  const userSlot: TournamentParticipant = {
    id: userProfile.id,
    name: userProfile.name || 'Sen',
    avatar: userProfile.avatar || '⚽',
    isUser: true,
    isBot: false,
    seed: 1,
  };

  const mergedReal: TournamentParticipant[] = [userSlot];
  for (const rp of realParticipants) {
    if (rp.id !== userSlot.id && mergedReal.length < 8) {
      mergedReal.push({
        ...rp,
        isUser: rp.id === userSlot.id,
        seed: mergedReal.length + 1,
      });
    }
  }

  let botIdx = 0;
  while (mergedReal.length < 8) {
    const bot = TOURNAMENT_BOT_SEEDS[botIdx % TOURNAMENT_BOT_SEEDS.length];
    botIdx += 1;
    mergedReal.push({
      id: `t_bot_${botIdx}`,
      name: bot.name,
      avatar: bot.avatar,
      isUser: false,
      isBot: true,
      seed: mergedReal.length + 1,
    });
  }

  return mergedReal;
}

export function createTournamentBracket(params: {
  userProfile: PlayerProfile;
  mode: TournamentMode;
  minigameType: MinigameType;
  entryFeeCoins?: number;
  prizeCoins?: number;
  code?: string;
  title?: string;
  realParticipants?: TournamentParticipant[];
}): TournamentBracketState {
  const entryFeeCoins =
    params.entryFeeCoins ?? (params.mode === 'open_cup' ? TOURNAMENT_OPEN_ENTRY_COINS : 2000);
  const prizeCoins =
    params.prizeCoins ??
    (params.mode === 'open_cup' ? TOURNAMENT_OPEN_PRIZE_COINS : entryFeeCoins * 3);

  const participants = buildEightParticipants(
    params.userProfile,
    params.realParticipants || []
  );

  // Classic 8-seed knockout pairing: (1v8), (4v5), (2v7), (3v6)
  const qfPairs: [number, number][] = [
    [0, 7],
    [3, 4],
    [1, 6],
    [2, 5],
  ];

  const qf: TournamentMatchSlot[] = qfPairs.map(([i1, i2], idx) => ({
    id: `qf_${idx + 1}`,
    stage: 'qf',
    matchIndex: idx,
    p1: participants[i1],
    p2: participants[i2],
    winnerId: null,
    status: 'ready',
  }));

  const sf: TournamentMatchSlot[] = [0, 1].map((idx) => ({
    id: `sf_${idx + 1}`,
    stage: 'sf',
    matchIndex: idx,
    p1: null,
    p2: null,
    winnerId: null,
    status: 'pending',
  }));

  const finalMatch: TournamentMatchSlot = {
    id: 'final_1',
    stage: 'final',
    matchIndex: 0,
    p1: null,
    p2: null,
    winnerId: null,
    status: 'pending',
  };

  return {
    id: `trn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    code: params.code,
    title:
      params.title ||
      (params.mode === 'friends_cup'
        ? 'Arkadaşlar Arası 8’li Turnuva'
        : '8 Kişilik Şampiyonlar Turnuvası'),
    mode: params.mode,
    minigameType: params.minigameType,
    entryFeeCoins,
    prizeCoins,
    participants,
    qf,
    sf,
    finalMatch,
    currentStage: 'qf',
    status: 'active',
    championId: null,
  };
}

export function getTournamentMatchForUser(
  bracket: TournamentBracketState,
  userId: string
): {
  slot: TournamentMatchSlot | null;
  opponent: TournamentParticipant | null;
  stageLabel: string;
  matchNumber: number;
  botDifficulty: BotDifficulty;
} {
  if (bracket.status !== 'active' || bracket.currentStage === 'completed') {
    return {
      slot: null,
      opponent: null,
      stageLabel: 'Tamamlandı',
      matchNumber: 3,
      botDifficulty: 'hard',
    };
  }

  const list =
    bracket.currentStage === 'qf'
      ? bracket.qf
      : bracket.currentStage === 'sf'
      ? bracket.sf
      : [bracket.finalMatch];

  const slot =
    list.find(
      (m) => m.p1?.id === userId || m.p2?.id === userId
    ) || null;

  const opponent = slot
    ? slot.p1?.id === userId
      ? slot.p2
      : slot.p1
    : null;

  const stageLabel =
    bracket.currentStage === 'qf'
      ? 'Çeyrek Final (1/3)'
      : bracket.currentStage === 'sf'
      ? 'Yarı Final (2/3)'
      : 'Büyük Final (3/3)';

  const matchNumber =
    bracket.currentStage === 'qf' ? 1 : bracket.currentStage === 'sf' ? 2 : 3;

  const botDifficulty: BotDifficulty =
    bracket.currentStage === 'qf'
      ? 'easy'
      : bracket.currentStage === 'sf'
      ? 'medium'
      : 'hard';

  return { slot, opponent, stageLabel, matchNumber, botDifficulty };
}

function pickSimulatedWinner(
  slot: TournamentMatchSlot,
  rng: () => number
): TournamentParticipant | null {
  if (!slot.p1 && !slot.p2) return null;
  if (slot.p1 && !slot.p2) return slot.p1;
  if (!slot.p1 && slot.p2) return slot.p2;
  return rng() < 0.5 ? slot.p1 : slot.p2;
}

function resolveRemainingBracketStage(
  slots: TournamentMatchSlot[],
  rng: () => number
): { resolved: TournamentMatchSlot[]; winners: TournamentParticipant[] } {
  const winners: TournamentParticipant[] = [];
  const resolved = slots.map((slot) => {
    if (slot.status === 'completed' && slot.winnerId) {
      const w = slot.p1?.id === slot.winnerId ? slot.p1 : slot.p2;
      if (w) winners.push(w);
      return slot;
    }
    const chosen = pickSimulatedWinner(slot, rng);
    if (chosen) winners.push(chosen);
    return {
      ...slot,
      winnerId: chosen?.id || null,
      status: 'completed' as const,
    };
  });
  return { resolved, winners };
}

/**
 * Resolves the user's current knockout match (and simulates all parallel bracket matches),
 * advancing winners cleanly from Çeyrek Final -> Yarı Final -> Büyük Final.
 */
export function advanceTournamentAfterMatch(
  bracket: TournamentBracketState,
  userId: string,
  userWon: boolean,
  rng: () => number = Math.random
): TournamentBracketState {
  if (bracket.status !== 'active' || bracket.currentStage === 'completed') {
    return bracket;
  }

  const cloneSlot = (s: TournamentMatchSlot): TournamentMatchSlot => ({ ...s });
  let qf = bracket.qf.map(cloneSlot);
  let sf = bracket.sf.map(cloneSlot);
  let finalMatch: TournamentMatchSlot = cloneSlot(bracket.finalMatch);

  const applyUserResult = (slots: TournamentMatchSlot[]): TournamentMatchSlot[] =>
    slots.map((slot) => {
      if (slot.p1?.id === userId || slot.p2?.id === userId) {
        const userPart = slot.p1?.id === userId ? slot.p1 : slot.p2;
        const oppPart = slot.p1?.id === userId ? slot.p2 : slot.p1;
        const winner = userWon ? userPart : oppPart;
        return {
          ...slot,
          winnerId: winner?.id || null,
          status: 'completed',
        };
      }
      return slot;
    });

  if (bracket.currentStage === 'qf') {
    qf = applyUserResult(qf);
    const { resolved: qfResolved, winners: qfWinners } = resolveRemainingBracketStage(qf, rng);
    qf = qfResolved;

    sf = [
      {
        ...sf[0],
        p1: qfWinners[0] || null,
        p2: qfWinners[1] || null,
        status: 'ready',
      },
      {
        ...sf[1],
        p1: qfWinners[2] || null,
        p2: qfWinners[3] || null,
        status: 'ready',
      },
    ];

    if (!userWon) {
      // Simulate remainder of bracket so user sees final tournament champion
      const { resolved: sfDone, winners: sfWinners } = resolveRemainingBracketStage(sf, rng);
      sf = sfDone;
      finalMatch = {
        ...finalMatch,
        p1: sfWinners[0] || null,
        p2: sfWinners[1] || null,
      };
      const champ = pickSimulatedWinner(finalMatch, rng);
      finalMatch = {
        ...finalMatch,
        winnerId: champ?.id || null,
        status: 'completed',
      };
      return {
        ...bracket,
        qf,
        sf,
        finalMatch,
        currentStage: 'completed',
        status: 'eliminated',
        championId: champ?.id || null,
        userPlacementLabel: 'Çeyrek Finalist',
      };
    }

    return {
      ...bracket,
      qf,
      sf,
      finalMatch,
      currentStage: 'sf',
      status: 'active',
    };
  }

  if (bracket.currentStage === 'sf') {
    sf = applyUserResult(sf);
    const { resolved: sfResolved, winners: sfWinners } = resolveRemainingBracketStage(sf, rng);
    sf = sfResolved;

    finalMatch = {
      ...finalMatch,
      p1: sfWinners[0] || null,
      p2: sfWinners[1] || null,
      status: 'ready',
    };

    if (!userWon) {
      const champ = pickSimulatedWinner(finalMatch, rng);
      finalMatch = {
        ...finalMatch,
        winnerId: champ?.id || null,
        status: 'completed',
      };
      return {
        ...bracket,
        qf,
        sf,
        finalMatch,
        currentStage: 'completed',
        status: 'eliminated',
        championId: champ?.id || null,
        userPlacementLabel: 'Yarı Finalist',
      };
    }

    return {
      ...bracket,
      qf,
      sf,
      finalMatch,
      currentStage: 'final',
      status: 'active',
    };
  }

  // Final Stage
  const [resolvedFinal] = applyUserResult([finalMatch]);
  finalMatch = resolvedFinal;
  const championId = finalMatch.winnerId;

  return {
    ...bracket,
    qf,
    sf,
    finalMatch,
    currentStage: 'completed',
    status: userWon ? 'won' : 'eliminated',
    championId,
    userPlacementLabel: userWon ? 'Turnuva Şampiyonu 🏆' : 'Finalist (2.)',
  };
}
