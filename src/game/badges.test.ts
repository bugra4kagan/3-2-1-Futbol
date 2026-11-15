import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlayerBadges } from './badges';
import { MatchPlayerStats, PlayerProfile } from './types';

const mockProfile: PlayerProfile = {
  id: 'p1',
  name: 'Test Oyuncu',
  avatar: '⚽',
  score: 60,
};

test('awards Fastest Answer badge when player answers quickly', () => {
  const stats: MatchPlayerStats = {
    fastestAnswerSec: 2.3,
    totalCorrect: 4,
    totalWrongAttempts: 2,
    currentStreak: 1,
    maxStreak: 2,
    clutchAnswers: 0,
    trailedThenWon: false,
  };

  const opponentStats: MatchPlayerStats = {
    fastestAnswerSec: 4.8,
    totalCorrect: 2,
    totalWrongAttempts: 1,
    currentStreak: 0,
    maxStreak: 1,
    clutchAnswers: 0,
    trailedThenWon: false,
  };

  const badges = calculatePlayerBadges(mockProfile, stats, opponentStats, true);
  const hasSpeed = badges.some((b) => b.id === 'fastest_answer');
  assert.equal(hasSpeed, true);
});

test('awards Football Professor badge when scoring 3+ correct rounds', () => {
  const stats: MatchPlayerStats = {
    fastestAnswerSec: 5.0,
    totalCorrect: 3,
    totalWrongAttempts: 1,
    currentStreak: 2,
    maxStreak: 3,
    clutchAnswers: 0,
    trailedThenWon: false,
  };

  const badges = calculatePlayerBadges(mockProfile, stats, undefined, true);
  const hasProf = badges.some((b) => b.id === 'football_professor');
  assert.equal(hasProf, true);
});

test('awards Sharpshooter badge when 0 wrong attempts', () => {
  const stats: MatchPlayerStats = {
    fastestAnswerSec: 6.0,
    totalCorrect: 3,
    totalWrongAttempts: 0,
    currentStreak: 1,
    maxStreak: 2,
    clutchAnswers: 0,
    trailedThenWon: false,
  };

  const badges = calculatePlayerBadges(mockProfile, stats, undefined, false);
  const hasSharp = badges.some((b) => b.id === 'sharpshooter');
  assert.equal(hasSharp, true);
});
