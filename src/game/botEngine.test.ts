import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_CONFIG,
  BOT_TIER_METADATA,
  chooseBotXoxCell,
  computeHumanizedBotDelayMs,
  getBotRoundPlan,
  getBotXoxTurnConfig,
  pickBotValidPlayer,
  pickBotWrongPlayer,
} from './botEngine';
import { PLAYERS_LIST } from './database';
import { createEmptyXoxBoard, generateMinigameRounds } from './minigameEngine';

test('bot speed and accuracy follow central BOT_CONFIG across Çırak < Şampiyon < Efsane', () => {
  const easy = getBotRoundPlan('easy', 'two_clubs');
  const med = getBotRoundPlan('medium', 'two_clubs');
  const hard = getBotRoundPlan('hard', 'two_clubs');

  assert.equal(easy.minDelayMs, 3000);
  assert.equal(easy.maxDelayMs, 5000);
  assert.equal(easy.accuracy, 0.70);

  assert.equal(med.minDelayMs, 2500);
  assert.equal(med.maxDelayMs, 4000);
  assert.equal(med.accuracy, 0.85);

  assert.equal(hard.minDelayMs, 2000);
  assert.equal(hard.maxDelayMs, 3000);
  assert.equal(hard.accuracy, 0.95);

  assert.equal(BOT_TIER_METADATA.easy.accuracyPct, BOT_CONFIG.easy.accuracyPct);
  assert.equal(BOT_TIER_METADATA.medium.accuracyPct, BOT_CONFIG.medium.accuracyPct);
  assert.equal(BOT_TIER_METADATA.hard.accuracyPct, BOT_CONFIG.hard.accuracyPct);

  assert.ok(hard.minDelayMs < med.minDelayMs && med.minDelayMs < easy.minDelayMs);
  assert.ok(hard.maxDelayMs < med.maxDelayMs && med.maxDelayMs < easy.maxDelayMs);
  assert.ok(hard.accuracy > med.accuracy && med.accuracy > easy.accuracy);

  for (const r of [0, 0.15, 0.5, 0.85, 0.9999]) {
    const d = computeHumanizedBotDelayMs(med, () => r);
    assert.ok(d >= med.minDelayMs && d <= med.maxDelayMs);
  }

  // Clamping within remaining round time never exceeds timer
  const clamped = computeHumanizedBotDelayMs(easy, () => 0.99, 2400);
  assert.ok(clamped <= 2050);

  const xoxHard = getBotXoxTurnConfig('hard', () => 0.5);
  const xoxMed = getBotXoxTurnConfig('medium', () => 0.5);
  const xoxEasy = getBotXoxTurnConfig('easy', () => 0.5);
  assert.equal(xoxHard.missRate, 0.05);
  assert.equal(xoxMed.missRate, 0.15);
  assert.equal(xoxEasy.missRate, 0.30);
  assert.ok(xoxHard.delayMs < xoxMed.delayMs && xoxMed.delayMs < xoxEasy.delayMs);
});

test('pickBotValidPlayer and pickBotWrongPlayer pick valid vs real invalid DB players', () => {
  const samplePool = PLAYERS_LIST.slice(0, 4);
  const validIds = new Set(samplePool.map((p) => p.id));

  const validPick = pickBotValidPlayer(samplePool, () => 0.5);
  assert.ok(validPick && validIds.has(validPick.id));

  for (let i = 0; i < 10; i += 1) {
    const wrongPick = pickBotWrongPlayer(validIds, PLAYERS_LIST, () => i / 10);
    assert.ok(wrongPick);
    assert.equal(validIds.has(wrongPick.id), false);
  }
});

test('chooseBotXoxCell takes immediate win, blocks human 3-in-a-row threat, and prefers center', () => {
  const xoxRound = generateMinigameRounds('xox', 1)[0];

  const winBoard = createEmptyXoxBoard();
  winBoard[0][0] = { ownerId: 'bot', symbol: 'O', playerName: 'A' };
  winBoard[0][1] = { ownerId: 'bot', symbol: 'O', playerName: 'B' };
  winBoard[1][0] = { ownerId: 'p1', symbol: 'X', playerName: 'C' };
  winBoard[1][1] = { ownerId: 'p1', symbol: 'X', playerName: 'D' };
  const winChoice = chooseBotXoxCell(winBoard, 'bot', 'p1', xoxRound, 'hard');
  assert.deepEqual(winChoice, { row: 0, col: 2 });

  const blockBoard = createEmptyXoxBoard();
  blockBoard[0][0] = { ownerId: 'p1', symbol: 'X', playerName: 'A' };
  blockBoard[1][1] = { ownerId: 'p1', symbol: 'X', playerName: 'B' };
  blockBoard[0][1] = { ownerId: 'bot', symbol: 'O', playerName: 'C' };
  const blockChoice = chooseBotXoxCell(blockBoard, 'bot', 'p1', xoxRound, 'medium');
  assert.deepEqual(blockChoice, { row: 2, col: 2 });

  const emptyBoard = createEmptyXoxBoard();
  const centerChoice = chooseBotXoxCell(emptyBoard, 'bot', 'p1', xoxRound, 'hard');
  assert.deepEqual(centerChoice, { row: 1, col: 1 });
});
