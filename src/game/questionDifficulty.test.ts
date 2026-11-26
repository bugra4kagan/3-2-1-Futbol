import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyQuestionDifficulty,
  DIFFICULTY_DISTRIBUTIONS,
  getDifficultyProfileForBot,
  getFullPoolCatalogStats,
} from './questionDifficulty';
import { generateMinigameRounds } from './minigameEngine';
import { generateSeededRoundIds, createSeededRng } from './realtimeSyncHelpers';
import { getRoundItemId } from './questionHistory';
import { MinigameType } from './types';

test('all 3049 players and question pools remain intact without deletions', () => {
  const stats = getFullPoolCatalogStats();
  assert.equal(stats.players, 3049);
  assert.equal(stats.two_clubs, 1329);
  assert.equal(stats.career, 2611);
  assert.equal(stats.country_club, 1060);
  assert.equal(stats.xox, 320);
});

test('difficulty classification populates easy, medium, and hard across all 4 active modes', () => {
  const modes: MinigameType[] = ['two_clubs', 'xox', 'career', 'country_club'];
  for (const mode of modes) {
    const rounds = generateMinigameRounds(mode, 100, [], {
      profile: 'balanced',
      rng: createSeededRng(101),
    });
    const counts = { easy: 0, medium: 0, hard: 0 };
    for (const r of rounds) {
      counts[classifyQuestionDifficulty(r)] += 1;
    }
    assert.ok(counts.easy > 10, `${mode} should have >=10 easy questions`);
    assert.ok(counts.medium > 10, `${mode} should have >=10 medium questions`);
    assert.ok(counts.hard > 5, `${mode} should have >=5 hard questions`);
  }
});

test('bot and online difficulty profiles follow requested exact percentages', () => {
  const profiles = [
    { profile: getDifficultyProfileForBot('easy'), expected: DIFFICULTY_DISTRIBUTIONS.bot_easy },
    { profile: getDifficultyProfileForBot('medium'), expected: DIFFICULTY_DISTRIBUTIONS.bot_medium },
    { profile: getDifficultyProfileForBot('hard'), expected: DIFFICULTY_DISTRIBUTIONS.bot_hard },
    { profile: 'online' as const, expected: DIFFICULTY_DISTRIBUTIONS.online },
  ];

  const modes: MinigameType[] = ['two_clubs', 'xox', 'career', 'country_club'];
  for (const mode of modes) {
    for (const { profile, expected } of profiles) {
      const sample = generateMinigameRounds(mode, 100, [], {
        profile,
        rng: createSeededRng(4242),
      });
      const actual = { easy: 0, medium: 0, hard: 0 };
      for (const r of sample) {
        actual[classifyQuestionDifficulty(r)] += 1;
      }
      assert.ok(
        Math.abs(actual.easy / 100 - expected.easy) <= 0.05,
        `${mode}/${profile} easy ratio ${actual.easy}% vs expected ${expected.easy * 100}%`
      );
      assert.ok(
        Math.abs(actual.medium / 100 - expected.medium) <= 0.05,
        `${mode}/${profile} medium ratio ${actual.medium}% vs expected ${expected.medium * 100}%`
      );
      assert.ok(
        Math.abs(actual.hard / 100 - expected.hard) <= 0.05,
        `${mode}/${profile} hard ratio ${actual.hard}% vs expected ${expected.hard * 100}%`
      );
    }
  }
});

test('online generateSeededRoundIds guarantees identical order across clients and avoids rematch repeats', () => {
  const modes: MinigameType[] = ['two_clubs', 'xox', 'career', 'country_club'];
  for (const mode of modes) {
    const clientA = generateSeededRoundIds(mode, 12, 998877);
    const clientB = generateSeededRoundIds(mode, 12, 998877);
    assert.deepEqual(clientA, clientB);
    assert.equal(new Set(clientA).size, 12);

    const rematch = generateSeededRoundIds(mode, 12, 112233, clientA);
    const priorSet = new Set(clientA);
    assert.equal(rematch.some((id) => priorSet.has(id)), false);
  }
  assert.equal(typeof getRoundItemId, 'function');
});
