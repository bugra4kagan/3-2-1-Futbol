import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpponentMiniSummary } from './opponentSummary';
import { MatchPlayerStats, PlayerProfile } from './types';

const SAMPLE_STATS: MatchPlayerStats = {
  fastestAnswerSec: 4.2,
  totalCorrect: 2,
  totalWrongAttempts: 1,
  currentStreak: 0,
  maxStreak: 2,
  clutchAnswers: 0,
  trailedThenWon: false,
};

test('buildOpponentMiniSummary uses explicit accountStats when available and computes exact win rate', () => {
  const opponent: PlayerProfile = {
    id: 'p_online_1',
    name: 'KralForvet',
    avatar: '⚡',
    score: 2,
    favoriteClubId: 'fenerbahce',
    accountStats: {
      totalMatches: 20,
      totalWins: 15,
      badgesEarned: ['speed'],
    },
  };

  const summary = buildOpponentMiniSummary(opponent, SAMPLE_STATS, {
    opponentScore: 2,
    userScore: 3,
  });

  assert.equal(summary.isBot, false);
  assert.equal(summary.totalMatches, 20);
  assert.equal(summary.totalWins, 15);
  assert.equal(summary.winRatePct, 75);
  assert.equal(summary.accuracyPct, 67);
  assert.equal(summary.fastestAnswerSec, 4.2);
  assert.equal(summary.maxStreak, 2);
  assert.equal(summary.recentForm.length, 5);
  assert.equal(summary.recentForm[4], 'L');
  assert.equal(summary.favoriteClubId, 'fenerbahce');
});

test('buildOpponentMiniSummary generates deterministic stats for bots and appends current match result to recentForm', () => {
  const botOpponent: PlayerProfile = {
    id: 'bot_ai',
    name: 'Futbol Profesörü',
    avatar: '🧠',
    score: 3,
  };

  const summaryA = buildOpponentMiniSummary(botOpponent, SAMPLE_STATS, {
    opponentScore: 3,
    userScore: 1,
  });
  const summaryB = buildOpponentMiniSummary(botOpponent, SAMPLE_STATS, {
    opponentScore: 3,
    userScore: 1,
  });

  assert.equal(summaryA.isBot, true);
  assert.deepEqual(summaryA, summaryB);
  assert.ok(summaryA.winRatePct >= 40 && summaryA.winRatePct <= 90);
  assert.equal(summaryA.recentForm.length, 5);
  assert.equal(summaryA.recentForm[4], 'W');
});

test('buildOpponentMiniSummary returns null accuracyPct when opponent had 0 match attempts', () => {
  const summary = buildOpponentMiniSummary(
    { id: 'bot_ai', name: 'Çırak Bot', avatar: '🤖', score: 0 },
    {
      fastestAnswerSec: null,
      totalCorrect: 0,
      totalWrongAttempts: 0,
      currentStreak: 0,
      maxStreak: 0,
      clutchAnswers: 0,
      trailedThenWon: false,
    },
    { opponentScore: 1, userScore: 1 }
  );

  assert.equal(summary.accuracyPct, null);
  assert.equal(summary.recentForm[4], 'D');
});
