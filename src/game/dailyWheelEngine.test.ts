import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_WHEEL_SLICES,
  MAX_WHEEL_AD_SPINS_PER_DAY,
  WHEEL_FREE_COOLDOWN_MS,
  applyWheelReward,
  canUseFreeWheelSpin,
  computeWheelTargetRotation,
  formatWheelCooldownBadge,
  getRemainingWheelAdSpins,
  getRemainingWheelCooldownMs,
  pickWeightedWheelSlice,
  resolveSliceIndexAtTopPointer,
} from './dailyWheelEngine';
import {
  MAX_DAILY_ENERGY,
  consumeFreeJokerOrSpendCoins,
  createInitialProgression,
  getEffectiveDailyEnergy,
  syncProgressionForToday,
} from './retentionEngine';

test('DAILY_WHEEL_SLICES defines 8 exact weighted slices with rare/jackpot low odds', () => {
  assert.equal(DAILY_WHEEL_SLICES.length, 8);
  const totalWeight = DAILY_WHEEL_SLICES.reduce((sum, s) => sum + s.weight, 0);
  assert.equal(totalWeight, 100);

  const jackpot = DAILY_WHEEL_SLICES.find((s) => s.amount === 2500);
  const rare = DAILY_WHEEL_SLICES.find((s) => s.amount === 1000);
  const coin100 = DAILY_WHEEL_SLICES.find((s) => s.amount === 100);
  const joker = DAILY_WHEEL_SLICES.find((s) => s.rewardType === 'joker');
  assert.ok(jackpot && jackpot.tier === 'jackpot' && jackpot.weight <= 2);
  assert.ok(rare && rare.tier === 'rare' && rare.weight <= 5);
  assert.ok(coin100 && coin100.weight >= 20);
  assert.ok(joker && joker.amount === 1);

  // Statistical sanity across 10,000 uniform deterministic samples
  const counts = new Map<string, number>();
  for (let i = 0; i < 10000; i++) {
    const slice = pickWeightedWheelSlice(() => (i + 0.37) / 10000);
    counts.set(slice.id, (counts.get(slice.id) ?? 0) + 1);
  }
  assert.ok((counts.get(coin100.id) ?? 0) > (counts.get(rare.id) ?? 0) * 4);
  assert.ok((counts.get(rare.id) ?? 0) > (counts.get(jackpot.id) ?? 0) * 2);
});

test('computeWheelTargetRotation always aligns top 12-oclock pointer onto selected slice', () => {
  const startAngles = [0, 33, 145, 789, 2410.5];
  const jitters = [0.05, 0.5, 0.95];

  for (const startDeg of startAngles) {
    for (let idx = 0; idx < DAILY_WHEEL_SLICES.length; idx++) {
      for (const jitter of jitters) {
        const target = computeWheelTargetRotation(startDeg, idx, jitter);
        assert.ok(target >= startDeg + 360 * 6, 'Should spin forward at least 6 full rotations');
        const landedSliceIdx = resolveSliceIndexAtTopPointer(target);
        assert.equal(
          landedSliceIdx,
          idx,
          `Expected landed slice ${idx} from start ${startDeg} with jitter ${jitter}, got ${landedSliceIdx}`
        );
      }
    }
  }
});

test('daily wheel spin cycle enforces 24h free cooldown + max 3 ad spins per day', () => {
  const day1 = new Date('2026-04-01T10:00:00');
  const nextMorning = new Date('2026-04-02T08:30:00'); // 22.5h later -> still in 24h cooldown
  const after24h = new Date(day1.getTime() + WHEEL_FREE_COOLDOWN_MS + 1000);

  let prog = createInitialProgression('wheel_tester', day1);
  assert.equal(canUseFreeWheelSpin(prog, day1), true);
  assert.equal(getRemainingWheelCooldownMs(prog, day1), 0);
  assert.equal(formatWheelCooldownBadge(0), 'ÇEVİR');
  assert.equal(getRemainingWheelAdSpins(prog, day1), MAX_WHEEL_AD_SPINS_PER_DAY);

  // 1) Use free spin (+250 Coin)
  const coin250 = DAILY_WHEEL_SLICES.find((s) => s.id === 'coins_250')!;
  const freeRes = applyWheelReward(prog, coin250, { spinKind: 'free' }, day1);
  assert.equal(freeRes.ok, true);
  assert.equal(freeRes.progression.coins, prog.coins + 250);
  prog = freeRes.progression;

  assert.equal(canUseFreeWheelSpin(prog, day1), false);
  const oneHourLater = new Date(day1.getTime() + 61 * 60 * 1000);
  assert.equal(
    formatWheelCooldownBadge(getRemainingWheelCooldownMs(prog, oneHourLater)),
    '22:59 kaldı'
  );
  const blockedFree = applyWheelReward(prog, coin250, { spinKind: 'free' }, day1);
  assert.equal(blockedFree.ok, false);

  // 2) Ad spins 3/3 -> 2/3 -> 1/3 -> 0/3
  for (let remaining = 3; remaining >= 1; remaining--) {
    assert.equal(getRemainingWheelAdSpins(prog, day1), remaining);
    const adRes = applyWheelReward(prog, DAILY_WHEEL_SLICES[0], { spinKind: 'ad' }, day1);
    assert.equal(adRes.ok, true);
    prog = adRes.progression;
  }

  assert.equal(getRemainingWheelAdSpins(prog, day1), 0);
  const blockedAd = applyWheelReward(prog, DAILY_WHEEL_SLICES[0], { spinKind: 'ad' }, day1);
  assert.equal(blockedAd.ok, false);

  // 3) Next calendar morning (22.5h later): ad spins reset to 3/3, free spin still on 24h cooldown
  const day2Prog = syncProgressionForToday(prog, nextMorning);
  assert.equal(canUseFreeWheelSpin(day2Prog, nextMorning), false);
  assert.equal(
    formatWheelCooldownBadge(getRemainingWheelCooldownMs(day2Prog, nextMorning)),
    '01:30 kaldı'
  );
  assert.equal(getRemainingWheelAdSpins(day2Prog, nextMorning), 3);

  // 4) After full 24h cooldown: free spin is unlocked again
  assert.equal(canUseFreeWheelSpin(day2Prog, after24h), true);
  assert.equal(getRemainingWheelCooldownMs(day2Prog, after24h), 0);
});

test('wheel energy and free joker rewards update progression and free joker skips coin cost', () => {
  const now = new Date('2026-04-01T12:00:00');
  let prog = createInitialProgression('joker_tester', now);
  prog = { ...prog, dailyEnergy: 2, coins: 40 };

  const energy2 = DAILY_WHEEL_SLICES.find((s) => s.id === 'energy_2')!;
  const eRes = applyWheelReward(prog, energy2, { spinKind: 'free' }, now);
  assert.equal(eRes.ok, true);
  assert.equal(getEffectiveDailyEnergy(eRes.progression, now), 4);
  assert.ok(getEffectiveDailyEnergy(eRes.progression, now) <= MAX_DAILY_ENERGY);

  const jokerSlice = DAILY_WHEEL_SLICES.find((s) => s.rewardType === 'joker')!;
  const jRes = applyWheelReward(eRes.progression, jokerSlice, { spinKind: 'ad' }, now);
  assert.equal(jRes.ok, true);
  assert.equal(jRes.progression.freeJokerTickets, 1);

  // Even with only 40 coins (< 150), using a joker consumes the 1 free ticket without spending coins
  const spend1 = consumeFreeJokerOrSpendCoins(jRes.progression, 150);
  assert.equal(spend1.ok, true);
  assert.equal(spend1.usedFreeJoker, true);
  assert.equal(spend1.progression.freeJokerTickets, 0);
  assert.equal(spend1.progression.coins, 40);

  // Next joker with 0 tickets and 40 coins is properly rejected
  const spend2 = consumeFreeJokerOrSpendCoins(spend1.progression, 150);
  assert.equal(spend2.ok, false);
  assert.equal(spend2.usedFreeJoker, false);
});
