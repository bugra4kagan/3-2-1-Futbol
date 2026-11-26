import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHapticPattern,
  haptics,
  HAPTICS_PREF_STORAGE_KEY,
  isHapticsEnabled,
  setHapticsEnabled,
  triggerHaptic,
  NavigatorWithVibrate,
} from './haptics';

test('correct, wrong, victory, and countdown haptic patterns are distinct and lightweight', () => {
  const correct = getHapticPattern('correct');
  const wrong = getHapticPattern('wrong');
  const victory = getHapticPattern('victory');
  const countdown = getHapticPattern('countdown');

  assert.ok(Array.isArray(correct));
  assert.ok(Array.isArray(wrong));
  assert.ok(Array.isArray(victory));
  assert.ok(Array.isArray(countdown));
  assert.notDeepEqual(correct, wrong);
  assert.notDeepEqual(victory, correct);

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  assert.ok(sum(correct) > 0 && sum(correct) <= 100);
  assert.ok(sum(wrong) > 0 && sum(wrong) <= 150);
  assert.ok(sum(victory) > 0 && sum(victory) <= 300);
  assert.ok(sum(countdown) > 0 && sum(countdown) <= 100);
});

test('haptics.correct, wrong, victory, and countdown respect toggle state', () => {
  const calls: Array<number | number[]> = [];
  const store = new Map<string, string>();
  const originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  });

  const mockNav: NavigatorWithVibrate = {
    vibrate(pattern) {
      calls.push(pattern);
      return true;
    },
  };

  try {
    setHapticsEnabled(true);
    assert.equal(isHapticsEnabled(), true);
    assert.equal(haptics.correct(mockNav), true);
    assert.equal(haptics.wrong(mockNav), true);
    assert.equal(haptics.countdown(mockNav), true);
    assert.equal(haptics.victory(mockNav), true);
    assert.deepEqual(calls, [
      getHapticPattern('correct'),
      getHapticPattern('wrong'),
      getHapticPattern('countdown'),
      getHapticPattern('victory'),
    ]);

    setHapticsEnabled(false);
    assert.equal(store.get(HAPTICS_PREF_STORAGE_KEY), 'false');
    assert.equal(isHapticsEnabled(), false);
    assert.equal(haptics.correct(mockNav), false);
    assert.equal(haptics.wrong(mockNav), false);
    assert.equal(haptics.countdown(mockNav), false);
    assert.equal(haptics.victory(mockNav), false);
    assert.equal(calls.length, 4);
  } finally {
    setHapticsEnabled(true);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});

test('triggerHaptic safely no-ops when navigator.vibrate is unavailable or throws', () => {
  assert.equal(triggerHaptic('correct', undefined), false);
  assert.equal(triggerHaptic('wrong', {}), false);

  const throwingNav: NavigatorWithVibrate = {
    vibrate() {
      throw new Error('Not allowed');
    },
  };
  assert.equal(triggerHaptic('correct', throwingNav), false);
});
