import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calibrateServerTimeOffset,
  computeProgressionDigest,
  getAuthoritativeServerDate,
  getAuthoritativeServerNowMs,
  hasAuthoritativeServerClock,
} from './serverTime';
import { canUseFreeWheelSpin, getRemainingWheelCooldownMs } from './dailyWheelEngine';
import {
  DAILY_CHALLENGE_COOLDOWN_MS,
  canPlayDailyChallengeNow,
  getRemainingDailyChallengeCooldownMs,
} from './dailyChallengeEngine';
import { createInitialProgression } from './retentionEngine';

test('serverTimestamp offset prevents phone clock manipulation from bypassing 24h cooldowns', () => {
  const realServerNow = new Date('2026-11-23T12:00:00Z').getTime();
  // Suppose the user manually changes their phone clock +48 hours into the future
  const tamperedPhoneNow = realServerNow + 48 * 60 * 60 * 1000;
  calibrateServerTimeOffset(realServerNow, tamperedPhoneNow);

  assert.equal(hasAuthoritativeServerClock(), true);
  // Authoritative server clock stays anchored near realServerNow despite tampered phone clock
  const diffFromReal = Math.abs(
    getAuthoritativeServerNowMs() - (Date.now() + (realServerNow - tamperedPhoneNow))
  );
  assert.ok(diffFromReal < 5000);

  const authNow = new Date(realServerNow + 60 * 60 * 1000); // 1h after spin/play
  const prog = {
    ...createInitialProgression('sec_tester', authNow),
    wheelLastFreeSpinAt: realServerNow,
    dailyChallengeLastPlayedAt: realServerNow,
  };

  assert.equal(canUseFreeWheelSpin(prog, authNow), false);
  assert.equal(getRemainingWheelCooldownMs(prog, authNow), 23 * 60 * 60 * 1000);
  assert.equal(canPlayDailyChallengeNow(prog, authNow), false);
  assert.equal(
    getRemainingDailyChallengeCooldownMs(prog, authNow),
    DAILY_CHALLENGE_COOLDOWN_MS - 60 * 60 * 1000
  );

  // Reset server offset cleanly for remaining tests
  calibrateServerTimeOffset(Date.now(), Date.now());
  assert.ok(getAuthoritativeServerDate() instanceof Date);
});

test('computeProgressionDigest detects manual localStorage edits to coins, items, or weeklyPoints', () => {
  const baseline = {
    userId: 'u_sec_1',
    coins: 1500,
    weeklyPoints: 420,
    totalPoints: 2400,
    unlockedGiftIds: ['pp_starter_mbappe', 'frame_gold'],
    adFree: false,
    permanentMultiplier2x: false,
  };
  const sig = computeProgressionDigest(baseline);
  assert.equal(sig, computeProgressionDigest({ ...baseline, unlockedGiftIds: ['frame_gold', 'pp_starter_mbappe'] }));
  assert.notEqual(sig, computeProgressionDigest({ ...baseline, coins: 999999 }));
  assert.notEqual(sig, computeProgressionDigest({ ...baseline, weeklyPoints: 99999 }));
  assert.notEqual(sig, computeProgressionDigest({ ...baseline, adFree: true }));
  assert.notEqual(
    sig,
    computeProgressionDigest({
      ...baseline,
      unlockedGiftIds: [...baseline.unlockedGiftIds, 'pp_messi'],
    })
  );
});
