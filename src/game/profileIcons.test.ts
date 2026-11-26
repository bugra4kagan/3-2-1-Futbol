import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_PROFILE_ICON_IDS,
  DEFAULT_PROFILE_ICON_ID,
  PROFILE_ICONS,
  getProfileIconLabel,
  isValidProfileIconId,
  normalizeProfileIconId,
} from './profileIcons';
import { PlayerProfile } from './types';

test('PROFILE_ICONS defines exactly 10 free football icons with unique IDs and Turkish labels', () => {
  assert.equal(PROFILE_ICONS.length, 10);
  const expectedOrder = [
    'ball',
    'trophy',
    'crown',
    'medal',
    'boot',
    'glove',
    'target',
    'lightning',
    'shield',
    'star',
  ];
  assert.deepEqual(
    PROFILE_ICONS.map((icon) => icon.id),
    expectedOrder
  );
  assert.equal(ALLOWED_PROFILE_ICON_IDS.size, 10);
  assert.equal(DEFAULT_PROFILE_ICON_ID, 'ball');
  for (const icon of PROFILE_ICONS) {
    assert.ok(icon.label.trim().length > 0);
    assert.ok(icon.shortLabel.trim().length > 0);
  }
});

test('isValidProfileIconId and normalizeProfileIconId accept only the 10 curated IDs and fallback to ball', () => {
  for (const icon of PROFILE_ICONS) {
    assert.equal(isValidProfileIconId(icon.id), true);
    assert.equal(normalizeProfileIconId(icon.id), icon.id);
    assert.equal(getProfileIconLabel(icon.id), icon.label);
  }

  const invalidOrLegacyInputs = [
    undefined,
    null,
    '',
    '⚽',
    '🏆',
    'pp:hakan_calhanoglu',
    'anime:v1:default',
    'custom-svg',
    'unicorn',
  ];
  for (const raw of invalidOrLegacyInputs) {
    assert.equal(isValidProfileIconId(raw), false);
    assert.equal(normalizeProfileIconId(raw), 'ball');
  }
  assert.equal(getProfileIconLabel('pp:arda_guler'), 'Futbol Topu');
});

test('selected profile icon persists cleanly across profile serialization roundtrip', () => {
  const savedProfile: PlayerProfile = {
    id: 'acc_test_1',
    name: 'GolKrali10',
    avatar: normalizeProfileIconId('glove'),
    score: 0,
    favoriteClubId: 'galatasaray',
  };

  const json = JSON.stringify(savedProfile);
  const restored = JSON.parse(json) as PlayerProfile;

  assert.equal(restored.avatar, 'glove');
  assert.equal(normalizeProfileIconId(restored.avatar), 'glove');

  // Legacy saved account with paid player PP should seamlessly normalize to default ball icon
  const legacySaved = JSON.stringify({ ...savedProfile, avatar: 'pp:lionel_messi' });
  const restoredLegacy = JSON.parse(legacySaved) as PlayerProfile;
  assert.equal(normalizeProfileIconId(restoredLegacy.avatar), 'ball');
});

test('ProfileIconSvg and BottomNavBar follow unified SVG specs without skates or crosses', () => {
  const iconSvgSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ProfileIconSvg.tsx'),
    'utf8'
  );
  const bottomNavSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/BottomNavBar.tsx'),
    'utf8'
  );

  // Unified SVG viewport & alignment
  assert.match(iconSvgSource, /viewBox="0 0 32 32"/);
  assert.match(iconSvgSource, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(bottomNavSource, /viewBox="0 0 32 32"/);
  assert.match(bottomNavSource, /preserveAspectRatio="xMidYMid meet"/);

  // Clipped spherical ball in both components
  assert.match(iconSvgSource, /clipPath/);
  assert.match(bottomNavSource, /clipPath/);

  // Every icon case exists cleanly in the switch
  for (const icon of PROFILE_ICONS) {
    assert.ok(
      iconSvgSource.includes(`case '${icon.id}':`),
      `Missing SVG case for ${icon.id}`
    );
  }

  // Boot case must have studs and zero circular wheels
  const bootMatch = iconSvgSource.match(/case 'boot':([\s\S]*?)case 'glove':/);
  assert.ok(bootMatch, 'Expected boot SVG block');
  assert.ok(!bootMatch[1].includes('<circle'), 'Boot icon must not contain circular wheel shapes');

  // Shield case must be athletic crest (no cross plus/horizontal+vertical bisecting cross paths)
  const shieldMatch = iconSvgSource.match(/case 'shield':([\s\S]*?)case 'star':/);
  assert.ok(shieldMatch, 'Expected shield SVG block');
  assert.ok(shieldMatch[1].includes('polygon'), 'Shield crest should feature athletic emblem polygon');
  assert.ok(!/M16 7V24[\s\S]*M9\.5 14H22\.5/.test(shieldMatch[1]), 'Shield must not contain a cross emblem');
});
