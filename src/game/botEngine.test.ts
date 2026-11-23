import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseBotXoxCell,
  computeHumanizedBotDelayMs,
  getBotRoundPlan,
  getBotXoxTurnConfig,
} from './botEngine';
import { createEmptyXoxBoard, generateMinigameRounds } from './minigameEngine';

test('bot speed and accuracy scale strictly across easy < medium < hard', () => {
  const easy = getBotRoundPlan('easy', 'two_clubs');
  const med = getBotRoundPlan('medium', 'two_clubs');
  const hard = getBotRoundPlan('hard', 'two_clubs');

  assert.equal(easy.minDelayMs, 4500);
  assert.equal(easy.maxDelayMs, 7500);
  assert.equal(easy.accuracy, 0.65);

  assert.equal(med.minDelayMs, 2500);
  assert.equal(med.maxDelayMs, 4500);
  assert.equal(med.accuracy, 0.82);

  assert.equal(hard.minDelayMs, 1500);
  assert.equal(hard.maxDelayMs, 3000);
  assert.equal(hard.accuracy, 0.94);

  assert.ok(hard.minDelayMs < med.minDelayMs && med.minDelayMs < easy.minDelayMs);
  assert.ok(hard.maxDelayMs < med.maxDelayMs && med.maxDelayMs < easy.maxDelayMs);
  assert.ok(hard.accuracy > med.accuracy && med.accuracy > easy.accuracy);

  const silHard = getBotRoundPlan('hard', 'silhouette');
  const silEasy = getBotRoundPlan('easy', 'silhouette');
  assert.ok(silHard.maxDelayMs < silEasy.minDelayMs);

  for (const r of [0, 0.15, 0.5, 0.85, 0.9999]) {
    const d = computeHumanizedBotDelayMs(med, () => r);
    assert.ok(d >= med.minDelayMs && d <= med.maxDelayMs);
  }

  const xoxHard = getBotXoxTurnConfig('hard');
  const xoxMed = getBotXoxTurnConfig('medium');
  const xoxEasy = getBotXoxTurnConfig('easy');
  assert.ok(xoxHard.missRate <= 0.05);
  assert.ok(xoxHard.delayMs < xoxMed.delayMs && xoxMed.delayMs < xoxEasy.delayMs);
});

test('chooseBotXoxCell takes immediate win, blocks human 3-in-a-row threat, and prefers center', () => {
  const xoxRound = generateMinigameRounds('xox', 1)[0];

  // 1. Immediate win takes top priority
  const winBoard = createEmptyXoxBoard();
  winBoard[0][0] = { ownerId: 'bot', symbol: 'O', playerName: 'A' };
  winBoard[0][1] = { ownerId: 'bot', symbol: 'O', playerName: 'B' };
  winBoard[1][0] = { ownerId: 'p1', symbol: 'X', playerName: 'C' };
  winBoard[1][1] = { ownerId: 'p1', symbol: 'X', playerName: 'D' };
  const winChoice = chooseBotXoxCell(winBoard, 'bot', 'p1', xoxRound, 'hard');
  assert.deepEqual(winChoice, { row: 0, col: 2 });

  // 2. Blocks human immediate win when bot doesn't have an immediate win
  const blockBoard = createEmptyXoxBoard();
  blockBoard[0][0] = { ownerId: 'p1', symbol: 'X', playerName: 'A' };
  blockBoard[1][1] = { ownerId: 'p1', symbol: 'X', playerName: 'B' };
  blockBoard[0][1] = { ownerId: 'bot', symbol: 'O', playerName: 'C' };
  const blockChoice = chooseBotXoxCell(blockBoard, 'bot', 'p1', xoxRound, 'medium');
  assert.deepEqual(blockChoice, { row: 2, col: 2 });

  // 3. Takes center on empty board for medium/hard
  const emptyBoard = createEmptyXoxBoard();
  const centerChoice = chooseBotXoxCell(emptyBoard, 'bot', 'p1', xoxRound, 'hard');
  assert.deepEqual(centerChoice, { row: 1, col: 1 });
});
