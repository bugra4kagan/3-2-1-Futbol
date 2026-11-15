import {
  MinigameRoundPayload,
  MinigameType,
  Player,
  XoxCellMark,
} from './types';
import { MATCH_PAIRINGS, PLAYERS } from './database';
import { getRandomPairings, validateAnswerForPlayerIds } from './validator';
import {
  CAREER_CHALLENGES,
  COUNTRY_CLUB_CHALLENGES,
  SILHOUETTE_CHALLENGES,
  XOX_BOARDS,
} from './minigamesData';
import { getRoundItemId, selectDiverseItems } from './questionHistory';

export { getRoundItemId };

export interface MinigameMeta {
  id: MinigameType;
  title: string;
  shortTitle: string;
  description: string;
  badgeText: string;
  accentColor: 'emerald' | 'amber' | 'sky' | 'purple' | 'rose';
}

export const MINIGAME_OPTIONS: MinigameMeta[] = [
  {
    id: 'two_clubs',
    title: 'İki Kulüp Ortak Futbolcu',
    shortTitle: 'İki Kulüp',
    description: 'İki kulüpte de oynamış ortak futbolcuyu ilk bilen kazanır.',
    badgeText: 'Klasik 1v1',
    accentColor: 'emerald',
  },
  {
    id: 'silhouette',
    title: 'Futbolcuyu Tahmin Et',
    shortTitle: 'Futbolcu Tahmini',
    description: '2 dk sürede en fazla 8 hakla bulanık portre ve ipuçlarından yıldızı ilk bilen kazanır.',
    badgeText: '2 Dk • 8 Hak',
    accentColor: 'amber',
  },
  {
    id: 'xox',
    title: 'Futbol XOX (3x3)',
    shortTitle: 'Futbol XOX',
    description: 'Kulüp ve takım arkadaşı kesişimlerini bilerek 3’lü XOX sırası kur.',
    badgeText: 'Strateji 3x3',
    accentColor: 'purple',
  },
  {
    id: 'career',
    title: 'Geçmiş Kariyerden Tahmin',
    shortTitle: 'Kariyer Yolu',
    description: 'Transfer kronolojisi verilen futbolcuyu rakipten önce bul.',
    badgeText: 'Kariyer Bilgisi',
    accentColor: 'sky',
  },
  {
    id: 'country_club',
    title: '1 Ülke + 1 Kulüp',
    shortTitle: 'Ülke + Kulüp',
    description: 'Verilen ülkeden olup o kulüpte oynamış futbolcuyu ilk yaz.',
    badgeText: 'Bayrak & Arma',
    accentColor: 'rose',
  },
];

export function getMinigameMeta(type: MinigameType): MinigameMeta {
  return MINIGAME_OPTIONS.find((m) => m.id === type) || MINIGAME_OPTIONS[0];
}

export function getMinigamePoolSize(minigameType: MinigameType): number {
  switch (minigameType) {
    case 'two_clubs':
      return MATCH_PAIRINGS.length;
    case 'silhouette':
      return SILHOUETTE_CHALLENGES.length;
    case 'career':
      return CAREER_CHALLENGES.length;
    case 'country_club':
      return COUNTRY_CLUB_CHALLENGES.length;
    case 'xox':
      return XOX_BOARDS.length;
  }
}

export function generateMinigameRounds(
  minigameType: MinigameType,
  count: number = 12,
  excludeIds: ReadonlySet<string> | readonly string[] = []
): MinigameRoundPayload[] {
  if (minigameType === 'two_clubs') {
    return getRandomPairings(count, excludeIds).map((pairing) => ({
      minigameType: 'two_clubs',
      pairing,
    }));
  }

  if (minigameType === 'silhouette') {
    const { items } = selectDiverseItems(
      SILHOUETTE_CHALLENGES,
      count,
      excludeIds,
      (s) => s.id
    );
    return items.map((silhouette) => ({
      minigameType: 'silhouette',
      silhouette,
    }));
  }

  if (minigameType === 'career') {
    const { items } = selectDiverseItems(
      CAREER_CHALLENGES,
      count,
      excludeIds,
      (c) => c.id
    );
    return items.map((career) => ({
      minigameType: 'career',
      career,
    }));
  }

  if (minigameType === 'country_club') {
    const { items } = selectDiverseItems(
      COUNTRY_CLUB_CHALLENGES,
      count,
      excludeIds,
      (cc) => cc.id
    );
    return items.map((countryClub) => ({
      minigameType: 'country_club',
      countryClub,
    }));
  }

  const { items } = selectDiverseItems(XOX_BOARDS, count, excludeIds, (b) => b.id);
  return items.map((xoxBoard) => ({
    minigameType: 'xox',
    xoxBoard,
  }));
}

export function getRoundValidPlayerIds(
  round: MinigameRoundPayload,
  cellPos?: { row: number; col: number }
): string[] {
  switch (round.minigameType) {
    case 'two_clubs':
      return round.pairing?.validPlayerIds || [];
    case 'silhouette':
      return round.silhouette ? [round.silhouette.playerId] : [];
    case 'career':
      return round.career ? [round.career.playerId] : [];
    case 'country_club':
      return round.countryClub?.validPlayerIds || [];
    case 'xox': {
      if (!round.xoxBoard || !cellPos) return [];
      const key = `${cellPos.row}_${cellPos.col}`;
      return round.xoxBoard.cellValidPlayerIds[key] || [];
    }
  }
}

export function getRoundRevealInfo(round: MinigameRoundPayload): {
  validPlayers: Player[];
  funFact?: string;
} {
  if (round.minigameType === 'two_clubs' && round.pairing) {
    return {
      validPlayers: round.pairing.validPlayerIds.map((id) => PLAYERS[id]).filter(Boolean),
      funFact: round.pairing.funFact,
    };
  }
  if (round.minigameType === 'silhouette' && round.silhouette) {
    const p = PLAYERS[round.silhouette.playerId];
    return {
      validPlayers: p ? [p] : [],
      funFact: round.silhouette.funFact,
    };
  }
  if (round.minigameType === 'career' && round.career) {
    const p = PLAYERS[round.career.playerId];
    return {
      validPlayers: p ? [p] : [],
      funFact: round.career.funFact,
    };
  }
  if (round.minigameType === 'country_club' && round.countryClub) {
    return {
      validPlayers: round.countryClub.validPlayerIds.map((id) => PLAYERS[id]).filter(Boolean),
      funFact: round.countryClub.funFact,
    };
  }
  if (round.minigameType === 'xox' && round.xoxBoard) {
    const allIds = new Set<string>();
    Object.values(round.xoxBoard.cellValidPlayerIds).forEach((list) => {
      list.forEach((id) => allIds.add(id));
    });
    return {
      validPlayers: Array.from(allIds).slice(0, 12).map((id) => PLAYERS[id]).filter(Boolean),
      funFact: `${round.xoxBoard.title} tahtası tamamlandı!`,
    };
  }
  return { validPlayers: [] };
}

export function validateMinigameAnswer(
  round: MinigameRoundPayload,
  answer: string,
  cellPos?: { row: number; col: number }
) {
  const validIds = getRoundValidPlayerIds(round, cellPos);
  return validateAnswerForPlayerIds(answer, validIds);
}

export function createEmptyXoxBoard(): (XoxCellMark | null)[][] {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
}

export interface XoxWinnerCheck {
  winnerId: string | null;
  winningCells: [number, number][] | null;
  isBoardFull: boolean;
}

const XOX_LINES: [number, number][][] = [
  // Rows
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  // Cols
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  // Diagonals
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
];

export function checkXoxBoardWinner(
  board: (XoxCellMark | null)[][]
): XoxWinnerCheck {
  for (const line of XOX_LINES) {
    const [a, b, c] = line;
    const m1 = board[a[0]][a[1]];
    const m2 = board[b[0]][b[1]];
    const m3 = board[c[0]][c[1]];
    if (m1 && m2 && m3 && m1.ownerId === m2.ownerId && m2.ownerId === m3.ownerId) {
      return {
        winnerId: m1.ownerId,
        winningCells: line,
        isBoardFull: false,
      };
    }
  }

  let filledCount = 0;
  const counts: Record<string, number> = {};
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = board[r][c];
      if (cell) {
        filledCount += 1;
        counts[cell.ownerId] = (counts[cell.ownerId] || 0) + 1;
      }
    }
  }

  if (filledCount === 9) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const winnerId = entries.length >= 2 && entries[0][1] > entries[1][1]
      ? entries[0][0]
      : entries.length === 1
      ? entries[0][0]
      : null;
    return {
      winnerId,
      winningCells: null,
      isBoardFull: true,
    };
  }

  return {
    winnerId: null,
    winningCells: null,
    isBoardFull: false,
  };
}
