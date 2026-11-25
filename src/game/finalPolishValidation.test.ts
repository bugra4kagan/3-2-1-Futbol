import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUBS, MATCH_PAIRINGS, PLAYERS, PLAYERS_LIST } from './database';
import {
  CAREER_CHALLENGES,
  COUNTRY_CLUB_CHALLENGES,
  XOX_BOARDS,
} from './minigamesData';
import {
  generateMinigameRounds,
  getMinigamePoolSize,
  getRoundItemId,
} from './minigameEngine';
import { PLAYER_ASSETS } from './playerAssets';
import { resolvePlayerAppearance } from './appearanceResolver';
import { getClubCrestUrl } from './clubLogos';
import { PROFILE_ICONS, normalizeProfileIconId } from './profileIcons';
import {
  canonicalTwoClubsKey,
  getRoundCanonicalKey,
  selectDiverseItems,
} from './questionHistory';
import {
  getProfileStoreFrames,
  getProfileStoreTitles,
  STORE_ITEMS,
} from './storeCatalog';
import {
  createInitialProgression,
  equipStoreItem,
  purchaseStoreItem,
} from './retentionEngine';
import { MinigameType } from './types';

test('expanded question pools across all 4 modes meet target depth without broken references', () => {
  assert.ok(MATCH_PAIRINGS.length >= 750, `Expected >=750 pairings, got ${MATCH_PAIRINGS.length}`);
  assert.ok(CAREER_CHALLENGES.length >= 2400, `Expected >=2400 careers, got ${CAREER_CHALLENGES.length}`);
  assert.ok(COUNTRY_CLUB_CHALLENGES.length >= 500, `Expected >=500 country+club, got ${COUNTRY_CLUB_CHALLENGES.length}`);
  assert.ok(XOX_BOARDS.length >= 300, `Expected >=300 XOX boards, got ${XOX_BOARDS.length}`);

  // No symmetric duplicate (A-B vs B-A) inside MATCH_PAIRINGS
  const seenCanonPairs = new Set<string>();
  for (const p of MATCH_PAIRINGS) {
    const key = canonicalTwoClubsKey(p.club1Id, p.club2Id);
    assert.equal(seenCanonPairs.has(key), false, `Duplicate reversed club pairing: ${key}`);
    seenCanonPairs.add(key);
  }
});

test('1,000-question diversity check across all 4 modes verifies zero consecutive repeats and sliding history window', () => {
  const modes: MinigameType[] = ['two_clubs', 'xox', 'career', 'country_club'];

  for (const mode of modes) {
    const seenWindow: string[] = [];
    let generatedTotal = 0;
    let backToBackSameId = 0;
    let prevCanon = '';
    const uniqueCanonKeys = new Set<string>();

    while (generatedTotal < 1000) {
      const batch = generateMinigameRounds(mode, 10, seenWindow);
      assert.equal(batch.length, 10);

      for (const r of batch) {
        const id = getRoundItemId(r);
        const canon = getRoundCanonicalKey(r);
        assert.ok(id.length > 0);
        if (canon === prevCanon) backToBackSameId += 1;
        prevCanon = canon;
        uniqueCanonKeys.add(canon);

        seenWindow.push(id);
        if (canon !== id) seenWindow.push(canon);
        const maxKeep = Math.min(Math.max(120, getMinigamePoolSize(mode) - 1), 1500);
        if (seenWindow.length > maxKeep) {
          seenWindow.splice(0, seenWindow.length - maxKeep);
        }
      }
      generatedTotal += batch.length;
    }

    assert.equal(backToBackSameId, 0, `${mode} produced consecutive identical question!`);
    const expectedMinUnique = Math.min(getMinigamePoolSize(mode), mode === 'xox' ? 300 : 500);
    assert.ok(
      uniqueCanonKeys.size >= expectedMinUnique,
      `${mode} only yielded ${uniqueCanonKeys.size} unique questions over 1,000 draws`
    );
  }

  // Canonical key filter suppresses reversed A-B / B-A pairing when excludeIds holds B-A
  const rmaMun = MATCH_PAIRINGS.find((p) => p.id === 'rma_mun')!;
  const reversed = { ...rmaMun, id: 'mun_rma_reversed', club1Id: rmaMun.club2Id, club2Id: rmaMun.club1Id };
  const canonRes = selectDiverseItems(
    [rmaMun, reversed],
    2,
    [canonicalTwoClubsKey(rmaMun.club1Id, rmaMun.club2Id)],
    (p) => p.id,
    () => 0.4,
    { getCanonicalKey: (p) => canonicalTwoClubsKey(p.club1Id, p.club2Id) }
  );
  // Both items share canonical key -> deduplicated down to 1 unique pair
  assert.equal(new Set(canonRes.items.map((x) => canonicalTwoClubsKey(x.club1Id, x.club2Id))).size, 1);
});

test('all 3,049+ footballers have unique IDs, valid positions, career clubs, portraits, and club crests', () => {
  assert.ok(PLAYERS_LIST.length >= 2800, `Expected >=2800 players, got ${PLAYERS_LIST.length}`);
  const idSet = new Set<string>();

  for (const player of PLAYERS_LIST) {
    assert.ok(player.id && !idSet.has(player.id), `Duplicate or empty player ID: ${player.id}`);
    idSet.add(player.id);
    assert.ok(player.name && player.name.trim().length > 1);
    assert.ok(player.nationality && player.flag);
    assert.ok(['GK', 'DF', 'MF', 'FW'].includes(player.position));
    assert.ok(PLAYERS[player.id]);
    assert.ok(PLAYER_ASSETS[player.id], `Missing PLAYER_ASSETS entry for ${player.id}`);

    const app = resolvePlayerAppearance(player, player.name);
    assert.ok(app.hairStyle && app.hairColor && app.skinTone && app.jerseyColors.length === 2);
  }

  for (const clubId of Object.keys(CLUBS)) {
    assert.ok(getClubCrestUrl(clubId), `Missing club crest URL for ${clubId}`);
  }
});

test('profile embedded store catalog has 6 frames, 4 titles, ad-free package, coin error handling, and 10 icons', () => {
  const frames = getProfileStoreFrames();
  const titles = getProfileStoreTitles();
  assert.equal(frames.length, 6);
  assert.deepEqual(
    frames.map((f) => [f.title, f.costCoins]),
    [
      ['Gümüş Çerçeve', 500],
      ['Klasik Çerçeve', 750],
      ['Altın Çerçeve', 1500],
      ['Şampiyon Çerçeve', 3000],
      ['Elmas Çerçeve', 4000],
      ['Efsane Çerçeve', 5000],
    ]
  );

  assert.equal(titles.length, 4);
  assert.deepEqual(
    titles.map((t) => [t.title, t.costCoins]),
    [
      ['Futbol Gurmesi', 500],
      ['Taktik Ustası', 1000],
      ['Futbol Profesörü', 2000],
      ['Futbol Ansiklopedisi', 3000],
    ]
  );

  const adFree = STORE_ITEMS.find((i) => i.id === 'store_ad_free');
  assert.ok(adFree && adFree.priceTry === 149.99);

  // Insufficient coin balance is cleanly rejected
  const poor = createInitialProgression();
  const failBuy = purchaseStoreItem({ ...poor, coins: 100 }, 'frame_silver', 'coins');
  assert.equal(failBuy.ok, false);
  assert.ok(failBuy.reason?.includes('Yetersiz'));

  // Buying and equipping a frame + title succeeds and deducts exact coins
  const rich = { ...poor, coins: 10000 };
  const buyFrame = purchaseStoreItem(rich, 'frame_diamond', 'coins');
  assert.equal(buyFrame.ok, true);
  assert.equal(buyFrame.progression.coins, 6000);
  const eqFrame = equipStoreItem(buyFrame.progression, 'frame_diamond');
  assert.equal(eqFrame.ok, true);
  assert.equal(eqFrame.progression.equippedFrame, 'diamond');

  const buyTitle = purchaseStoreItem(eqFrame.progression, 'title_futbol_ansiklopedisi', 'coins');
  assert.equal(buyTitle.ok, true);
  assert.equal(buyTitle.progression.coins, 3000);
  assert.equal(buyTitle.progression.equippedTitle, 'Futbol Ansiklopedisi');

  // 10 distinct colored profile icon options
  assert.equal(PROFILE_ICONS.length, 10);
  assert.equal(normalizeProfileIconId('crown'), 'crown');
  assert.equal(normalizeProfileIconId('nonexistent_icon'), 'ball');
});
