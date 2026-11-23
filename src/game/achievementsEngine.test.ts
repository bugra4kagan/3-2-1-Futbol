import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAchievementsToProgression,
  CAREER_ACHIEVEMENTS,
  claimAchievementReward,
  createInitialAchievementsState,
  recordAchievementMatchOutcome,
  recordAchievementPlayerGuess,
  syncAchievementsFromProgression,
} from './achievementsEngine';
import { createInitialProgression, recordMatchOutcome } from './retentionEngine';
import { PLAYERS } from './database';

test('CAREER_ACHIEVEMENTS defines all 20 achievements and strictly enforces one-time claims', () => {
  assert.equal(CAREER_ACHIEVEMENTS.length, 20);
  const uniqueIds = new Set(CAREER_ACHIEVEMENTS.map((a) => a.id));
  assert.equal(uniqueIds.size, 20);

  let state = createInitialAchievementsState();
  let prog = createInitialProgression('ach_test');

  // 1. Speed win + first win
  prog = { ...prog, wins: 1, bestWinStreak: 1 };
  const matchRes = recordAchievementMatchOutcome(
    { won: true, durationSec: 12, progression: prog },
    state
  );
  state = matchRes.state;
  assert.ok(state.unlockedIds.includes('first_goal'));
  assert.ok(state.unlockedIds.includes('speed_machine'));

  // Claim first_goal (+100 Coin) and persist onto progression
  const claimRes = claimAchievementReward('first_goal', state);
  assert.equal(claimRes.claimed, true);
  assert.equal(claimRes.rewardCoins, 100);
  state = claimRes.state;
  prog = applyAchievementsToProgression(prog, state);
  assert.ok(prog.claimedAchievements?.includes('first_goal'));
  assert.ok(prog.unlockedAchievements?.includes('first_goal'));

  // Cannot double-claim or re-trigger after subsequent matches or syncs
  const doubleClaim = claimAchievementReward('first_goal', state);
  assert.equal(doubleClaim.claimed, false);
  assert.equal(doubleClaim.rewardCoins, 0);

  // Simulate playing another match & stale local achievement cache cleared, syncing from prog
  prog = { ...prog, wins: 2, bestWinStreak: 2 };
  const afterStaleReset = syncAchievementsFromProgression(prog, createInitialAchievementsState());
  assert.ok(afterStaleReset.state.claimedIds.includes('first_goal'));
  assert.ok(afterStaleReset.state.unlockedIds.includes('first_goal'));
  assert.ok(!afterStaleReset.newlyUnlocked.some((a) => a.id === 'first_goal'));
  assert.equal(claimAchievementReward('first_goal', afterStaleReset.state).claimed, false);

  const followUpMatch = recordAchievementMatchOutcome(
    { won: true, durationSec: 10, progression: prog },
    afterStaleReset.state
  );
  state = followUpMatch.state;
  assert.ok(!followUpMatch.newlyUnlocked.some((a) => a.id === 'first_goal'));
  assert.ok(!followUpMatch.newlyUnlocked.some((a) => a.id === 'speed_machine'));

  // 2. Super Lig guesses
  const muslera = PLAYERS.fernando_muslera;
  for (let i = 0; i < 15; i++) {
    state = recordAchievementPlayerGuess(muslera, state).state;
  }
  assert.ok(state.unlockedIds.includes('super_lig_gourmet'));

  // 3. Wins, streaks, mode masteries, tournament, daily streaks, collector, daily challenges, UCL star
  let modeWinProg = prog;
  for (let i = 0; i < 10; i++) {
    modeWinProg = recordMatchOutcome(modeWinProg, {
      won: true,
      isDraw: false,
      minigameType: 'xox',
      stats: {
        totalCorrect: 3,
        totalWrongAttempts: 0,
        fastestAnswerSec: 5,
        currentStreak: 3,
        maxStreak: 3,
        clutchAnswers: 0,
        trailedThenWon: false,
      },
    }).progression;
  }
  assert.equal(modeWinProg.modeWinCounts?.xox, 10);

  prog = {
    ...modeWinProg,
    wins: 100,
    bestWinStreak: 15,
    modeWinCounts: {
      two_clubs: 10,
      xox: 10,
      career: 10,
      country_club: 10,
    },
    tournamentWins: 1,
    dailyLogin: { streakDays: 30, lastClaimDate: '2026-11-23' },
    unlockedGiftIds: ['pp_1', 'pp_2', 'pp_3', 'pp_4', 'pp_5'],
    dailyChallengeHistory: {
      '2026-11-20': { dateKey: '2026-11-20', puzzleNumber: 1, correctCount: 3, totalRounds: 3, elapsedSec: 20, rewardCoins: 200, rewardPoints: 100, completedAt: 1700000001000 },
      '2026-11-21': { dateKey: '2026-11-21', puzzleNumber: 2, correctCount: 3, totalRounds: 3, elapsedSec: 20, rewardCoins: 200, rewardPoints: 100, completedAt: 1700000002000 },
      '2026-11-22': { dateKey: '2026-11-22', puzzleNumber: 3, correctCount: 3, totalRounds: 3, elapsedSec: 20, rewardCoins: 200, rewardPoints: 100, completedAt: 1700000003000 },
    },
    leagueTierId: 'champions_league',
  };

  const syncRes = syncAchievementsFromProgression(prog, state);
  state = syncRes.state;
  assert.equal(state.unlockedIds.length, 20);
  assert.ok(state.unlockedIds.includes('ten_wins'));
  assert.ok(state.unlockedIds.includes('fifty_wins'));
  assert.ok(state.unlockedIds.includes('hundred_wins'));
  assert.ok(state.unlockedIds.includes('hat_trick_master'));
  assert.ok(state.unlockedIds.includes('seven_streak'));
  assert.ok(state.unlockedIds.includes('invincible_armada'));
  assert.ok(state.unlockedIds.includes('master_two_clubs'));
  assert.ok(state.unlockedIds.includes('master_xox'));
  assert.ok(state.unlockedIds.includes('master_career'));
  assert.ok(state.unlockedIds.includes('master_country_club'));
  assert.ok(state.unlockedIds.includes('tournament_champion'));
  assert.ok(state.unlockedIds.includes('daily_streak_3'));
  assert.ok(state.unlockedIds.includes('daily_streak_7'));
  assert.ok(state.unlockedIds.includes('daily_streak_30'));
  assert.ok(state.unlockedIds.includes('collector'));
  assert.ok(state.unlockedIds.includes('daily_regular'));
  assert.ok(state.unlockedIds.includes('ucl_star'));
});
