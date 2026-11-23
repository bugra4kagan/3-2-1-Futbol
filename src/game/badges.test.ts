import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlayerBadges, getBadgeCategoryLabel } from './badges';
import { MatchPlayerStats, PlayerProfile } from './types';

const mockProfile: PlayerProfile = {
  id: 'p1',
  name: 'Test Oyuncu',
  avatar: '⚽',
  score: 3,
};

test('awards Hızlı Yanıtlayıcı badge when player answers quickly or faster than opponent', () => {
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
  const speedBadge = badges.find((b) => b.id === 'fastest_answer');
  assert.ok(speedBadge);
  assert.equal(speedBadge.title, 'Hızlı Yanıtlayıcı');
  assert.equal(getBadgeCategoryLabel(speedBadge.badgeType), 'Hız');
});

test('awards Gol Makinesi and Futbol Ansiklopedisi badges when scoring 3+ goals', () => {
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
  const goalMachine = badges.find((b) => b.id === 'goal_machine');
  const profBadge = badges.find((b) => b.id === 'football_professor');
  assert.ok(goalMachine);
  assert.equal(goalMachine.title, 'Gol Makinesi');
  assert.ok(profBadge);
});

test('awards Geri Dönüş Kralı and Kale Duvarı based on match stats', () => {
  const comebackStats: MatchPlayerStats = {
    fastestAnswerSec: 3.1,
    totalCorrect: 3,
    totalWrongAttempts: 0,
    currentStreak: 3,
    maxStreak: 3,
    clutchAnswers: 0,
    trailedThenWon: true,
  };

  const comebackBadges = calculatePlayerBadges(mockProfile, comebackStats, undefined, true);
  assert.equal(comebackBadges.some((b) => b.id === 'comeback_king' && b.title === 'Geri Dönüş Kralı'), true);

  const cleanSweepOpponent: MatchPlayerStats = {
    fastestAnswerSec: null,
    totalCorrect: 0,
    totalWrongAttempts: 3,
    currentStreak: 0,
    maxStreak: 0,
    clutchAnswers: 0,
    trailedThenWon: false,
  };

  const sweepBadges = calculatePlayerBadges(mockProfile, comebackStats, cleanSweepOpponent, true);
  assert.equal(sweepBadges.some((b) => b.id === 'clean_sheet' && b.title === 'Kale Duvarı'), true);
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
