import test from 'node:test';
import assert from 'node:assert/strict';
import { sounds } from './audio';

test('audio cues including playGoal and playFullTimeWhistle are callable safely in Node/SSR', () => {
  assert.equal(typeof sounds.playGoal, 'function');
  assert.equal(typeof sounds.playFullTimeWhistle, 'function');
  assert.equal(typeof sounds.playVictory, 'function');
  assert.equal(typeof sounds.playCorrect, 'function');
  assert.equal(typeof sounds.playWrong, 'function');

  assert.doesNotThrow(() => {
    sounds.playGoal();
    sounds.playFullTimeWhistle();
    sounds.playVictory();
    sounds.playCorrect();
    sounds.playWrong();
  });
});
