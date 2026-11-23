import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAREER_RANK_TIERS,
  computeSpeedComboBonusCoins,
  createInitialCareerStats,
  getCareerRankProgress,
  getSpeedComboLabel,
  getWinRatePct,
  mergeCareerStatsWithProgression,
  recordCareerMatchStats,
} from './careerStatsEngine';
import { createInitialProgression } from './retentionEngine';

test('career rank tiers progress accurately across 0, 5, 15, 35 and 75+ wins', () => {
  assert.equal(CAREER_RANK_TIERS.length, 5);

  const r0 = getCareerRankProgress(0);
  assert.equal(r0.currentRank.title, 'Amatör');
  assert.equal(r0.nextRank?.title, 'Altyapı Yıldızı');
  assert.equal(r0.winsToNext, 5);
  assert.equal(r0.progressPct, 0);

  const r4 = getCareerRankProgress(4);
  assert.equal(r4.currentRank.title, 'Amatör');
  assert.equal(r4.winsToNext, 1);
  assert.equal(r4.progressPct, 80);

  const r5 = getCareerRankProgress(5);
  assert.equal(r5.currentRank.title, 'Altyapı Yıldızı');
  assert.equal(r5.nextRank?.title, 'Süper Lig Profesyoneli');

  const r15 = getCareerRankProgress(15);
  assert.equal(r15.currentRank.title, 'Süper Lig Profesyoneli');

  const r35 = getCareerRankProgress(35);
  assert.equal(r35.currentRank.title, 'Şampiyonlar Ligi Ustası');

  const r75 = getCareerRankProgress(75);
  assert.equal(r75.currentRank.title, "Ballon d'Or Efsanesi");
  assert.equal(r75.nextRank, null);
  assert.equal(r75.winsToNext, 0);
  assert.equal(r75.progressPct, 100);
});

test('recordCareerMatchStats tracks matches, win rate, fastest win time, and longest streak', () => {
  const baseProg = createInitialProgression('u_career_test');
  let stats = createInitialCareerStats();

  // Win #1 in 28.4 seconds
  const progAfterWin1 = { ...baseProg, matchesPlayed: 1, wins: 1, bestWinStreak: 1 };
  stats = recordCareerMatchStats(
    { won: true, matchDurationSec: 28.44, progression: progAfterWin1 },
    stats
  );
  assert.equal(stats.totalMatches, 1);
  assert.equal(stats.totalWins, 1);
  assert.equal(stats.bestMatchTimeSec, 28.4);
  assert.equal(getWinRatePct(stats), 100);

  // Loss should NOT overwrite bestMatchTimeSec even if match ended faster
  const progAfterLoss = { ...progAfterWin1, matchesPlayed: 2, wins: 1, bestWinStreak: 1 };
  stats = recordCareerMatchStats(
    { won: false, matchDurationSec: 12.0, progression: progAfterLoss },
    stats
  );
  assert.equal(stats.totalMatches, 2);
  assert.equal(stats.totalWins, 1);
  assert.equal(stats.bestMatchTimeSec, 28.4);
  assert.equal(getWinRatePct(stats), 50);

  // Win #2 in 19.2 seconds updates bestMatchTimeSec
  const progAfterWin2 = { ...progAfterLoss, matchesPlayed: 3, wins: 2, bestWinStreak: 3 };
  stats = recordCareerMatchStats(
    { won: true, matchDurationSec: 19.21, progression: progAfterWin2 },
    stats
  );
  assert.equal(stats.totalMatches, 3);
  assert.equal(stats.totalWins, 2);
  assert.equal(stats.bestMatchTimeSec, 19.2);
  assert.equal(stats.longestWinStreak, 3);
  assert.equal(getWinRatePct(stats), 67);

  // Merging with progression preserves stored best time while taking max counters
  const merged = mergeCareerStatsWithProgression(
    { ...progAfterWin2, matchesPlayed: 10, wins: 6, bestWinStreak: 5 },
    stats
  );
  assert.equal(merged.totalMatches, 10);
  assert.equal(merged.totalWins, 6);
  assert.equal(merged.bestMatchTimeSec, 19.2);
  assert.equal(merged.longestWinStreak, 5);
});

test('speed combo helper computes +15 Coins per combo level starting at 2x', () => {
  assert.equal(computeSpeedComboBonusCoins(0), 0);
  assert.equal(computeSpeedComboBonusCoins(1), 0);
  assert.equal(computeSpeedComboBonusCoins(2), 30);
  assert.equal(computeSpeedComboBonusCoins(3), 45);
  assert.equal(computeSpeedComboBonusCoins(4), 60);

  assert.equal(getSpeedComboLabel(0), null);
  assert.equal(getSpeedComboLabel(1), null);
  assert.equal(getSpeedComboLabel(2), '🔥 2x HIZ KOMBOSU!');
  assert.equal(getSpeedComboLabel(3), '⚡ 3x ŞİMŞEK HIZI!');
  assert.equal(getSpeedComboLabel(5), '🚀 5x SÜPER HIZ KOMBOSU!');
});
