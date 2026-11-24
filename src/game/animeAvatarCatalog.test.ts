import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ANIME_UNLOCKABLE_ITEMS,
  ANIME_UNLOCKABLE_GIFTS,
  DEFAULT_ANIME_AVATAR_CONFIG,
  isAnimeAvatar,
  parseAnimeAvatar,
  serializeAnimeAvatar,
} from './animeAvatarCatalog';
import { createInitialProgression, purchaseGift } from './retentionEngine';

test('anime avatar serialization roundtrips cleanly and validates tokens', () => {
  const custom = {
    ...DEFAULT_ANIME_AVATAR_CONFIG,
    hairStyleId: 'tsubasa_sweep',
    hairColorId: 'gold_blonde',
    jerseyId: 'jersey_golden_champ',
    eyewearId: 'eyewear_cyber_visor',
    auraId: 'aura_golden_saiyan',
  };

  const token = serializeAnimeAvatar(custom);
  assert.equal(isAnimeAvatar(token), true);
  assert.equal(isAnimeAvatar('pp:lionel_messi'), false);

  const parsed = parseAnimeAvatar(token);
  assert.deepEqual(parsed, custom);

  // Unknown option IDs safely fall back to defaults
  const sanitized = parseAnimeAvatar('anime:sk=bad&hs=unknown&jr=jersey_emerald_ace');
  assert.equal(sanitized?.skinToneId, DEFAULT_ANIME_AVATAR_CONFIG.skinToneId);
  assert.equal(sanitized?.hairStyleId, DEFAULT_ANIME_AVATAR_CONFIG.hairStyleId);
  assert.equal(sanitized?.jerseyId, 'jersey_emerald_ace');
});

test('all unlockable anime gear sits in 1,500 - 6,000 Coin band and unlocks via purchaseGift', () => {
  assert.ok(ALL_ANIME_UNLOCKABLE_ITEMS.length >= 12);
  for (const item of ALL_ANIME_UNLOCKABLE_ITEMS) {
    assert.ok(
      item.costCoins >= 1500 && item.costCoins <= 6000,
      `Item ${item.id} price ${item.costCoins} outside 1500..6000 band`
    );
  }
  assert.equal(ANIME_UNLOCKABLE_GIFTS.length, ALL_ANIME_UNLOCKABLE_ITEMS.length);

  const prog = createInitialProgression('anime_tester');
  const blocked = purchaseGift(prog, 'gift_anime_eyewear_cyber_visor');
  assert.equal(blocked.ok, false);

  prog.coins = 5000;
  const bought = purchaseGift(prog, 'gift_anime_eyewear_cyber_visor');
  assert.equal(bought.ok, true);
  assert.equal(bought.progression.coins, 3200);
  assert.ok(bought.progression.unlockedGiftIds.includes('gift_anime_eyewear_cyber_visor'));
});
