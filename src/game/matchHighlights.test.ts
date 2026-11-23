import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchHighlightsSummary } from './matchHighlights';
import { MatchPlayerStats, MatchRoundHighlight, PlayerProfile } from './types';

const user: PlayerProfile = {
  id: 'u_1',
  name: 'KralForvet',
  avatar: '⚽',
  score: 3,
};

const bot: PlayerProfile = {
  id: 'bot_ai',
  name: 'Futbol Profesörü',
  avatar: '🧠',
  score: 1,
};

const userStats: MatchPlayerStats = {
  fastestAnswerSec: 1.8,
  totalCorrect: 3,
  totalWrongAttempts: 1,
  currentStreak: 2,
  maxStreak: 2,
  clutchAnswers: 1,
  trailedThenWon: true,
};

const botStats: MatchPlayerStats = {
  fastestAnswerSec: 4.4,
  totalCorrect: 1,
  totalWrongAttempts: 2,
  currentStreak: 0,
  maxStreak: 1,
  clutchAnswers: 0,
  trailedThenWon: false,
};

test('buildMatchHighlightsSummary computes goal statistics, fastest answers ranking, and key moments', () => {
  const rounds: MatchRoundHighlight[] = [
    {
      roundNumber: 1,
      minigameType: 'two_clubs',
      winnerPlayerId: bot.id,
      winnerName: bot.name,
      acceptedAnswer: 'Wesley Sneijder',
      elapsedSec: 4.4,
      wasClutch: false,
      reason: 'scored',
      scoreAfter: { p1: 0, p2: 1 },
    },
    {
      roundNumber: 2,
      minigameType: 'two_clubs',
      winnerPlayerId: null,
      elapsedSec: null,
      reason: 'timeout',
      scoreAfter: { p1: 0, p2: 1 },
    },
    {
      roundNumber: 3,
      minigameType: 'two_clubs',
      winnerPlayerId: user.id,
      winnerName: user.name,
      acceptedAnswer: 'Didier Drogba',
      elapsedSec: 3.2,
      wasClutch: false,
      reason: 'scored',
      scoreAfter: { p1: 1, p2: 1 },
    },
    {
      roundNumber: 4,
      minigameType: 'two_clubs',
      winnerPlayerId: user.id,
      winnerName: user.name,
      acceptedAnswer: 'Arda Turan',
      elapsedSec: 1.8,
      wasClutch: false,
      reason: 'scored',
      scoreAfter: { p1: 2, p2: 1 },
    },
    {
      roundNumber: 5,
      minigameType: 'two_clubs',
      winnerPlayerId: user.id,
      winnerName: user.name,
      acceptedAnswer: 'Lukas Podolski',
      elapsedSec: 12.6,
      wasClutch: true,
      reason: 'scored',
      scoreAfter: { p1: 3, p2: 1 },
    },
  ];

  const summary = buildMatchHighlightsSummary({
    player1: user,
    player2: bot,
    player1Stats: userStats,
    player2Stats: botStats,
    roundHighlights: rounds,
  });

  assert.equal(summary.totalGoals, 4);
  assert.equal(summary.player1Goals, 3);
  assert.equal(summary.player2Goals, 1);
  assert.equal(summary.player1GoalSharePct, 75);
  assert.equal(summary.player2GoalSharePct, 25);
  assert.equal(summary.totalRoundsPlayed, 5);
  assert.equal(summary.decisiveGoalRounds, 4);
  assert.equal(summary.deadlockRounds, 1);
  assert.equal(summary.avgGoalsPerRound, 0.8);
  assert.equal(summary.totalAttempts, 7);
  assert.equal(summary.accuracyRatePct, 57);

  // Fastest answers sorted ascending
  assert.equal(summary.fastestAnswers.length, 4);
  assert.equal(summary.fastestAnswers[0].rank, 1);
  assert.equal(summary.fastestAnswers[0].answerText, 'Arda Turan');
  assert.equal(summary.fastestAnswers[0].elapsedSec, 1.8);
  assert.equal(summary.fastestAnswers[1].answerText, 'Didier Drogba');
  assert.equal(summary.fastestAnswers[2].answerText, 'Wesley Sneijder');
  assert.equal(summary.fastestAnswers[3].wasClutch, true);
  assert.equal(summary.averageAnswerSec, 5.5);

  // Key moments include opener, fastest, clutch, and decider
  const kinds = summary.keyMoments.map((m) => m.kind);
  assert.ok(kinds.includes('opener'));
  assert.ok(kinds.includes('fastest'));
  assert.ok(kinds.includes('clutch'));
  assert.ok(kinds.includes('decider'));
});

test('buildMatchHighlightsSummary gracefully falls back when roundHighlights is empty', () => {
  const summary = buildMatchHighlightsSummary({
    player1: user,
    player2: bot,
    player1Stats: userStats,
    player2Stats: botStats,
  });

  assert.equal(summary.totalGoals, 4);
  assert.equal(summary.player1Goals, 3);
  assert.equal(summary.player2Goals, 1);
  assert.equal(summary.fastestAnswers.length, 2);
  assert.equal(summary.matchFastestAnswer?.elapsedSec, 1.8);
  assert.equal(summary.matchFastestAnswer?.playerName, user.name);
  assert.ok(summary.keyMoments.some((m) => m.kind === 'fastest'));
});
