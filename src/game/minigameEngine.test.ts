import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYERS, CLUBS } from './database';
import {
  CAREER_CHALLENGES,
  COUNTRY_CLUB_CHALLENGES,
  SILHOUETTE_CHALLENGES,
  XOX_BOARDS,
} from './minigamesData';
import {
  MINIGAME_OPTIONS,
  checkXoxBoardWinner,
  createEmptyXoxBoard,
  generateMinigameRounds,
  validateMinigameAnswer,
} from './minigameEngine';
import { getClubCrestUrl } from './clubLogos';

test('all silhouette, career, country+club, and XOX data reference valid PLAYERS and CLUBS', () => {
  assert.ok(SILHOUETTE_CHALLENGES.length >= 12);
  for (const s of SILHOUETTE_CHALLENGES) {
    assert.ok(PLAYERS[s.playerId], `Missing silhouette player: ${s.playerId}`);
    assert.ok(CLUBS[s.hintClubId], `Missing silhouette hint club: ${s.hintClubId}`);
  }

  const silhouetteMeta = MINIGAME_OPTIONS.find((m) => m.id === 'silhouette');
  assert.equal(silhouetteMeta?.title, 'Futbolcuyu Tahmin Et');

  assert.ok(CAREER_CHALLENGES.length >= 12);
  for (const c of CAREER_CHALLENGES) {
    assert.ok(PLAYERS[c.playerId], `Missing career player: ${c.playerId}`);
    assert.ok(c.steps.length >= 3);
    for (const step of c.steps) {
      if (step.clubId) {
        assert.ok(CLUBS[step.clubId], `Missing career club: ${step.clubId}`);
      }
      const crestUrl = getClubCrestUrl(step.clubId, step.clubName);
      assert.ok(
        Boolean(crestUrl),
        `Missing crest URL for career step ${c.playerId} -> ${step.clubName}`
      );
    }
  }

  assert.ok(COUNTRY_CLUB_CHALLENGES.length >= 15);
  for (const cc of COUNTRY_CLUB_CHALLENGES) {
    assert.ok(CLUBS[cc.clubId], `Missing country+club club: ${cc.clubId}`);
    assert.ok(cc.validPlayerIds.length >= 1);
    for (const pid of cc.validPlayerIds) {
      assert.ok(PLAYERS[pid], `Missing country+club player: ${pid}`);
      assert.equal(PLAYERS[pid].nationality, cc.country);
    }
  }

  assert.ok(XOX_BOARDS.length >= 4);
  for (const board of XOX_BOARDS) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const key = `${r}_${c}`;
        const list = board.cellValidPlayerIds[key];
        assert.ok(list && list.length >= 2, `Board ${board.id} cell ${key} must have >= 2 players`);
        for (const pid of list) {
          assert.ok(PLAYERS[pid], `Board ${board.id} cell ${key} missing player: ${pid}`);
        }
      }
    }
  }
});

test('validateMinigameAnswer works across silhouette, career, country_club, and xox', () => {
  const silRound = generateMinigameRounds('silhouette', 1)[0];
  const silTarget = PLAYERS[silRound.silhouette!.playerId];
  assert.equal(validateMinigameAnswer(silRound, silTarget.name).isValid, true);
  assert.equal(validateMinigameAnswer(silRound, 'TamamenYanlisOyuncu').isValid, false);

  const carRound = generateMinigameRounds('career', 1)[0];
  const carTarget = PLAYERS[carRound.career!.playerId];
  assert.equal(validateMinigameAnswer(carRound, carTarget.name).isValid, true);

  const ccRound = generateMinigameRounds('country_club', 1)[0];
  const ccValid = PLAYERS[ccRound.countryClub!.validPlayerIds[0]];
  assert.equal(validateMinigameAnswer(ccRound, ccValid.name).isValid, true);

  const xoxRound = generateMinigameRounds('xox', 1)[0];
  const xoxValid = PLAYERS[xoxRound.xoxBoard!.cellValidPlayerIds['1_1'][0]];
  assert.equal(validateMinigameAnswer(xoxRound, xoxValid.name, { row: 1, col: 1 }).isValid, true);
});

test('checkXoxBoardWinner detects 3-in-a-row diagonals and full-board majority', () => {
  const board = createEmptyXoxBoard();
  board[0][0] = { ownerId: 'p1', symbol: 'X', playerName: 'A' };
  board[1][1] = { ownerId: 'p1', symbol: 'X', playerName: 'B' };
  board[2][2] = { ownerId: 'p1', symbol: 'X', playerName: 'C' };

  const diag = checkXoxBoardWinner(board);
  assert.equal(diag.winnerId, 'p1');
  assert.deepEqual(diag.winningCells, [[0, 0], [1, 1], [2, 2]]);

  // Full board without 3-in-a-row: 5 cells for p2 wins
  const full = [
    [
      { ownerId: 'p2', symbol: 'O' as const, playerName: '1' },
      { ownerId: 'p1', symbol: 'X' as const, playerName: '2' },
      { ownerId: 'p2', symbol: 'O' as const, playerName: '3' },
    ],
    [
      { ownerId: 'p1', symbol: 'X' as const, playerName: '4' },
      { ownerId: 'p1', symbol: 'X' as const, playerName: '5' },
      { ownerId: 'p2', symbol: 'O' as const, playerName: '6' },
    ],
    [
      { ownerId: 'p2', symbol: 'O' as const, playerName: '7' },
      { ownerId: 'p2', symbol: 'O' as const, playerName: '8' },
      { ownerId: 'p1', symbol: 'X' as const, playerName: '9' },
    ],
  ];
  const maj = checkXoxBoardWinner(full);
  assert.equal(maj.isBoardFull, true);
  assert.equal(maj.winnerId, 'p2');
});

import { getRoundItemId } from './questionHistory';

test('generateMinigameRounds prioritizes unseen items so consecutive matches do not repeat questions', () => {
  const match1Sil = generateMinigameRounds('silhouette', 12, []);
  const seenSil = new Set(match1Sil.map(getRoundItemId));
  assert.equal(seenSil.size, 12);

  const match2Sil = generateMinigameRounds('silhouette', 12, seenSil);
  for (const r of match2Sil) {
    assert.equal(seenSil.has(getRoundItemId(r)), false, 'Match 2 should not repeat Match 1 silhouettes');
  }

  const match1Two = generateMinigameRounds('two_clubs', 12, []);
  const seenTwo = new Set(match1Two.map(getRoundItemId));
  const match2Two = generateMinigameRounds('two_clubs', 12, seenTwo);
  for (const r of match2Two) {
    assert.equal(seenTwo.has(getRoundItemId(r)), false, 'Match 2 should not repeat Match 1 club pairings');
  }
});

