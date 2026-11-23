import test from 'node:test';
import assert from 'node:assert/strict';
import { getHapticPattern, haptics, triggerHaptic, NavigatorWithVibrate } from './haptics';

test('correct and wrong haptic patterns are distinct and lightweight', () => {
  const correct = getHapticPattern('correct');
  const wrong = getHapticPattern('wrong');

  assert.ok(Array.isArray(correct));
  assert.ok(Array.isArray(wrong));
  assert.notDeepEqual(correct, wrong);

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  assert.ok(sum(correct) > 0 && sum(correct) <= 100);
  assert.ok(sum(wrong) > 0 && sum(wrong) <= 150);
});

test('haptics.correct and haptics.wrong invoke navigator.vibrate with expected patterns', () => {
  const calls: Array<number | number[]> = [];
  const mockNav: NavigatorWithVibrate = {
    vibrate(pattern) {
      calls.push(pattern);
      return true;
    },
  };

  assert.equal(haptics.correct(mockNav), true);
  assert.equal(haptics.wrong(mockNav), true);
  assert.deepEqual(calls, [getHapticPattern('correct'), getHapticPattern('wrong')]);
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
