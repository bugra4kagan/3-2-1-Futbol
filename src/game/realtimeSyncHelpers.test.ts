import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONLINE_MATCHMAKING_FALLBACK_MS,
  generateSeededRoundIds,
  generateSixCharRoomCode,
  pickSmartBotOpponent,
  resolveRoundPayloadById,
  sanitizeRtdbKey,
} from './realtimeSyncHelpers';
import { MinigameType } from '../game/types';

test('RTDB helper generates 6-character uppercase room codes and sanitizes keys', () => {
  const code = generateSixCharRoomCode(() => 0.25);
  assert.equal(code.length, 6);
  assert.match(code, /^[A-Z0-9]{6}$/);

  assert.equal(sanitizeRtdbKey('user.name/123#abc'), 'user_name_123_abc');
});

test('generateSeededRoundIds produces identical non-repeating rounds from same seed across devices', () => {
  const modes: MinigameType[] = ['two_clubs', 'silhouette', 'career', 'country_club', 'xox'];
  for (const mode of modes) {
    const a = generateSeededRoundIds(mode, 10, 424242);
    const b = generateSeededRoundIds(mode, 10, 424242);
    assert.equal(a.length, 10);
    assert.deepEqual(a, b);
    assert.equal(new Set(a).size, 10);

    const firstPayload = resolveRoundPayloadById(mode, a[0]);
    assert.ok(firstPayload);
    assert.equal(firstPayload?.minigameType, mode);
  }
});

test('online matchmaking timeout is 12s and manual bot helper picks valid opponent metadata', () => {
  assert.equal(ONLINE_MATCHMAKING_FALLBACK_MS, 12000);
  const bot = pickSmartBotOpponent(() => 0.4);
  assert.ok(bot.id.length > 0);
  assert.ok(bot.name.length >= 4);
  assert.ok(bot.avatar.length > 0);
  assert.ok(['easy', 'medium', 'hard'].includes(bot.difficulty));
});
