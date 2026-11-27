import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMatchKeyboardMetrics } from './viewportKeyboard';

test('computeMatchKeyboardMetrics detects keyboard open via visualViewport height drop without double subtraction', () => {
  const closed = computeMatchKeyboardMetrics({
    visualHeight: 844,
    innerHeight: 844,
    visualWidth: 390,
    innerWidth: 390,
    baselineHeight: 844,
    isInputFocused: false,
  });
  assert.equal(closed.viewportHeight, 844);
  assert.equal(closed.isKeyboardOpen, false);
  assert.equal(closed.isCompactHeight, false);

  const open = computeMatchKeyboardMetrics({
    visualHeight: 492,
    innerHeight: 492,
    visualWidth: 390,
    innerWidth: 390,
    baselineHeight: closed.baselineHeight,
    isInputFocused: true,
  });
  assert.equal(open.viewportHeight, 492);
  assert.equal(open.baselineHeight, 844);
  assert.equal(open.isKeyboardOpen, true);
  assert.equal(open.isCompactHeight, true);

  const restored = computeMatchKeyboardMetrics({
    visualHeight: 844,
    innerHeight: 844,
    visualWidth: 390,
    innerWidth: 390,
    baselineHeight: open.baselineHeight,
    isInputFocused: false,
  });
  assert.equal(restored.viewportHeight, 844);
  assert.equal(restored.isKeyboardOpen, false);
  assert.equal(restored.isCompactHeight, false);
});

test('computeMatchKeyboardMetrics handles narrow 320px phones and wide 768px-1280px tablets accurately', () => {
  const smallPhone = computeMatchKeyboardMetrics({
    visualHeight: 568,
    innerHeight: 568,
    visualWidth: 320,
    innerWidth: 320,
    isInputFocused: true,
  });
  assert.equal(smallPhone.viewportWidth, 320);
  assert.equal(smallPhone.isKeyboardOpen, true);
  assert.equal(smallPhone.isCompactHeight, true);

  const tabletLandscape = computeMatchKeyboardMetrics({
    visualHeight: 768,
    innerHeight: 768,
    visualWidth: 1024,
    innerWidth: 1024,
    baselineHeight: 768,
    isInputFocused: false,
  });
  assert.equal(tabletLandscape.isKeyboardOpen, false);
  assert.equal(tabletLandscape.isCompactHeight, false);
  assert.equal(tabletLandscape.isSideBySideMatchLayout, false);

  const tabletKeyboardOpen = computeMatchKeyboardMetrics({
    visualHeight: 440,
    innerHeight: 440,
    visualWidth: 1280,
    innerWidth: 1280,
    baselineHeight: 800,
    isInputFocused: true,
  });
  assert.equal(tabletKeyboardOpen.viewportHeight, 440);
  assert.equal(tabletKeyboardOpen.isKeyboardOpen, true);
  assert.equal(tabletKeyboardOpen.isUltraCompactHeight, true);
  assert.equal(tabletKeyboardOpen.isSideBySideMatchLayout, true);
});
