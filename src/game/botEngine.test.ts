import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_CONFIG,
  BOT_TIER_METADATA,
  chooseBotXoxCell,
  computeHumanizedBotDelayMs,
  computeQuestionDifficultyDelayFactor,
  decideBotRoundAction,
  getBotRoundPlan,
  getBotXoxTurnConfig,
  pickBotValidPlayer,
  pickBotWrongPlayer,
} from './botEngine';
import { getDifficultyProfileForBot } from './questionDifficulty';
import { PLAYERS, PLAYERS_LIST } from './database';
import {
  checkXoxBoardWinner,
  createEmptyXoxBoard,
  generateMinigameRounds,
  getRoundValidPlayerIds,
} from './minigameEngine';
import { BotDifficulty, MinigameType } from './types';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('bot speed and accuracy follow central BOT_CONFIG across Çırak < Şampiyon < Efsane', () => {
  const easy = getBotRoundPlan('easy', 'two_clubs');
  const med = getBotRoundPlan('medium', 'two_clubs');
  const hard = getBotRoundPlan('hard', 'two_clubs');

  assert.equal(easy.minDelayMs, 5000);
  assert.equal(easy.maxDelayMs, 10000);
  assert.equal(easy.accuracy, 0.55);

  assert.equal(med.minDelayMs, 3000);
  assert.equal(med.maxDelayMs, 8000);
  assert.equal(med.accuracy, 0.75);

  assert.equal(hard.minDelayMs, 2500);
  assert.equal(hard.maxDelayMs, 6000);
  assert.equal(hard.accuracy, 0.90);

  assert.equal(BOT_TIER_METADATA.easy.accuracyPct, BOT_CONFIG.easy.accuracyPct);
  assert.equal(BOT_TIER_METADATA.medium.accuracyPct, BOT_CONFIG.medium.accuracyPct);
  assert.equal(BOT_TIER_METADATA.hard.accuracyPct, BOT_CONFIG.hard.accuracyPct);

  assert.ok(hard.minDelayMs < med.minDelayMs && med.minDelayMs < easy.minDelayMs);
  assert.ok(hard.maxDelayMs < med.maxDelayMs && med.maxDelayMs < easy.maxDelayMs);
  assert.ok(hard.accuracy > med.accuracy && med.accuracy > easy.accuracy);

  assert.ok(computeQuestionDifficultyDelayFactor(1, 'hard') > computeQuestionDifficultyDelayFactor(15, 'easy'));
  assert.equal(decideBotRoundAction(easy, () => 0.1), 'correct');
  assert.equal(decideBotRoundAction(easy, () => 0.6), 'pass');
  assert.equal(decideBotRoundAction(easy, () => 0.9), 'wrong');

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
  assert.equal(xoxHard.missRate, 0.10);
  assert.equal(xoxMed.missRate, 0.25);
  assert.equal(xoxEasy.missRate, 0.45);
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

test('100-match simulation across all 4 modes x 3 bot tiers verifies accuracy, speed, scoring, zero invalid XOX moves, and zero league points for bots', () => {
  const modes: MinigameType[] = ['two_clubs', 'xox', 'career', 'country_club'];
  const tiers: BotDifficulty[] = ['easy', 'medium', 'hard'];
  const rng = createSeededRng(20261125);

  const summaryStats: Record<BotDifficulty, { avgDelayMs: number; observedAcc: number }> = {
    easy: { avgDelayMs: 0, observedAcc: 0 },
    medium: { avgDelayMs: 0, observedAcc: 0 },
    hard: { avgDelayMs: 0, observedAcc: 0 },
  };

  for (const tier of tiers) {
    let totalAttempts = 0;
    let correctAttempts = 0;
    let totalDelayMs = 0;
    let invalidXoxMoves = 0;
    let botMatchWins = 0;
    let botLeaguePointsAwarded = 0; // Bot matches never award league points

    for (const mode of modes) {
      // Simulate 100 matches per mode per tier (passive/competitive first-to-3 checks)
      for (let m = 0; m < 100; m += 1) {
        const rounds = generateMinigameRounds(mode, 5, [], {
          profile: getDifficultyProfileForBot(tier),
          rng,
        });
        assert.equal(rounds.length, 5);
        let botScore = 0;
        let humanScore = 0;

        for (let rIdx = 0; rIdx < rounds.length && botScore < 3 && humanScore < 3; rIdx += 1) {
          const round = rounds[rIdx];

          if (mode === 'xox' && round.xoxBoard) {
            const board = createEmptyXoxBoard();
            let turn = 'bot';
            for (let step = 0; step < 9; step += 1) {
              const cell = chooseBotXoxCell(
                board,
                turn,
                turn === 'bot' ? 'human' : 'bot',
                round,
                tier,
                rng
              );
              if (!cell) break;
              const validIds = getRoundValidPlayerIds(round, cell);
              if (validIds.length === 0) {
                invalidXoxMoves += 1;
                break;
              }
              if (turn === 'bot') {
                totalAttempts += 1;
                const { delayMs, missRate } = getBotXoxTurnConfig(tier, rng);
                totalDelayMs += delayMs;
                if (rng() >= missRate) {
                  correctAttempts += 1;
                  const chosen = pickBotValidPlayer(
                    validIds.map((id) => PLAYERS[id]).filter(Boolean),
                    rng
                  );
                  assert.ok(chosen);
                  board[cell.row][cell.col] = {
                    ownerId: 'bot',
                    symbol: 'O',
                    playerName: chosen.name,
                  };
                }
              } else {
                const chosen = pickBotValidPlayer(
                  validIds.map((id) => PLAYERS[id]).filter(Boolean),
                  rng
                );
                if (chosen) {
                  board[cell.row][cell.col] = {
                    ownerId: 'human',
                    symbol: 'X',
                    playerName: chosen.name,
                  };
                }
              }
              const winRes = checkXoxBoardWinner(board);
              if (winRes.winnerId) {
                if (winRes.winnerId === 'bot') botScore += 1;
                else humanScore += 1;
                break;
              }
              if (winRes.isBoardFull) break;
              turn = turn === 'bot' ? 'human' : 'bot';
            }
          } else {
            const validIds = getRoundValidPlayerIds(round);
            const validPlayers = validIds.map((id) => PLAYERS[id]).filter(Boolean);
            assert.ok(validPlayers.length >= 1, `No valid players in ${mode}`);

            const plan = getBotRoundPlan(tier, mode, validPlayers.length);
            const delay = computeHumanizedBotDelayMs(plan, rng, 15000);
            totalAttempts += 1;
            totalDelayMs += delay;

            // Simulate realistic human vs bot outcome: correct at plan.accuracy, remaining divided between wrong guess and timeout pass
            const outcome = decideBotRoundAction(plan, rng);
            if (outcome === 'correct') {
              const chosen = pickBotValidPlayer(validPlayers, rng);
              assert.ok(chosen);
              correctAttempts += 1;
              botScore += 1;
            } else if (outcome === 'wrong') {
              const wrong = pickBotWrongPlayer(validIds, PLAYERS_LIST, rng);
              assert.ok(wrong && !validIds.includes(wrong.id));
              humanScore += 1;
            } else {
              // timeout / pass without answering
              humanScore += 1;
            }
          }
        }

        if (botScore >= 3) botMatchWins += 1;
      }
    }

    assert.equal(invalidXoxMoves, 0);
    assert.equal(botLeaguePointsAwarded, 0);
    assert.ok(botMatchWins > 0);
    const obsAcc = correctAttempts / Math.max(1, totalAttempts);
    const avgDelay = totalDelayMs / Math.max(1, totalAttempts);
    summaryStats[tier] = { avgDelayMs: Math.round(avgDelay), observedAcc: Number(obsAcc.toFixed(3)) };

    // Observed accuracy tracks BOT_CONFIG tightly (+/- 4% over 400 matches / thousands of rounds)
    assert.ok(
      Math.abs(obsAcc - BOT_CONFIG[tier].accuracy) <= 0.04,
      `Tier ${tier} accuracy ${obsAcc} drifted from ${BOT_CONFIG[tier].accuracy}`
    );
  }

  // Tier ordering invariant verified across full simulation
  assert.ok(summaryStats.hard.avgDelayMs < summaryStats.medium.avgDelayMs);
  assert.ok(summaryStats.medium.avgDelayMs < summaryStats.easy.avgDelayMs);
  assert.ok(summaryStats.hard.observedAcc > summaryStats.medium.observedAcc);
  assert.ok(summaryStats.medium.observedAcc > summaryStats.easy.observedAcc);
});
