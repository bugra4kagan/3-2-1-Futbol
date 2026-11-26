import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BASE_PLAYERS_LIST, CLUBS, PLAYERS, PLAYERS_LIST } from './database';
import { EXTRA_PLAYERS_50 } from './extraPlayers50';
import { EXTRA_PLAYERS_MORE_50 } from './extraPlayersMore50';
import { EXTRA_PLAYERS_THIRD_50 } from './extraPlayersThird50';
import { EXTRA_PLAYERS_FOURTH_100 } from './extraPlayersFourth100';
import { EXTRA_PLAYERS_FIFTH_150 } from './extraPlayersFifth150';
import { EXTRA_PLAYERS_SIXTH_100 } from './extraPlayersSixth100';
import { EXTRA_PLAYERS_SEVENTH_150 } from './extraPlayersSeventh150';
import { EXTRA_PLAYERS_EIGHTH_50 } from './extraPlayersEighth50';
import { EXTRA_PLAYERS_NINTH_50 } from './extraPlayersNinth50';
import { EXTRA_PLAYERS_TENTH_50 } from './extraPlayersTenth50';
import { EXTRA_PLAYERS_ELEVENTH_100 } from './extraPlayersEleventh100';
import { EXTRA_PLAYERS_TWELFTH_100 } from './extraPlayersTwelfth100';
import { EXTRA_PLAYERS_THIRTEENTH_100 } from './extraPlayersThirteenth100';
import { EXTRA_PLAYERS_FOURTEENTH_200 } from './extraPlayersFourteenth200';
import { EXTRA_PLAYERS_FIFTEENTH_150 } from './extraPlayersFifteenth150';
import { EXTRA_PLAYERS_SIXTEENTH_250 } from './extraPlayersSixteenth250';
import { EXTRA_PLAYERS_SEVENTEENTH_250 } from './extraPlayersSeventeenth250';
import { EXTRA_PLAYERS_EIGHTEENTH_250 } from './extraPlayersEighteenth250';
import { EXTRA_PLAYERS_NINETEENTH_250 } from './extraPlayersNineteenth250';
import { EXTRA_PLAYERS_TWENTIETH_BATCH } from './extraPlayersTwentieth';
import { KNOWN_WORLD_LEAGUES } from './clubBadgeCatalog';
import { isSouthAmericaLocalOnlyPlayer } from './minigameEngine';
import { computeAutoAppearance, resolvePlayerAppearance } from './appearanceResolver';
import { DEFAULT_PLAYER_PHOTO, PLAYER_ASSETS, getPlayerAsset } from './playerAssets';
import {
  MAX_SILHOUETTE_ATTEMPTS,
  compareSilhouetteGuess,
  getPortraitBlurPx,
  resolveGuessedPlayerFromInput,
  searchPlayersForAutocomplete,
  searchSilhouettePlayers,
  summarizeSilhouetteClues,
} from './silhouetteEngine';
import { formatRoundTimer, getRoundDurationSeconds } from './roundTiming';

import { SILHOUETTE_CHALLENGES } from './minigamesData';

test('all 464+ PLAYERS preserve 314 base players + 50 + 50 + 50 new players with complete careerHistory and valid PLAYER_ASSETS', () => {
  const playerIds = Object.keys(PLAYERS);
  assert.equal(BASE_PLAYERS_LIST.length, 314, 'Expected original 314 base players preserved');
  assert.equal(EXTRA_PLAYERS_50.length, 50, 'Expected exactly 50 players in EXTRA_PLAYERS_50');
  assert.equal(EXTRA_PLAYERS_MORE_50.length, 50, 'Expected exactly 50 players in EXTRA_PLAYERS_MORE_50');
  assert.equal(EXTRA_PLAYERS_THIRD_50.length, 50, 'Expected exactly 50 players in EXTRA_PLAYERS_THIRD_50');
  assert.ok(
    EXTRA_PLAYERS_FOURTH_100.length >= 100,
    `Expected at least 100 players in EXTRA_PLAYERS_FOURTH_100, got ${EXTRA_PLAYERS_FOURTH_100.length}`
  );
  assert.ok(
    EXTRA_PLAYERS_FIFTH_150.length >= 150,
    `Expected at least 150 players in EXTRA_PLAYERS_FIFTH_150, got ${EXTRA_PLAYERS_FIFTH_150.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_SIXTH_100.length,
    100,
    `Expected exactly 100 players in EXTRA_PLAYERS_SIXTH_100, got ${EXTRA_PLAYERS_SIXTH_100.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_SEVENTH_150.length,
    150,
    `Expected exactly 150 players in EXTRA_PLAYERS_SEVENTH_150, got ${EXTRA_PLAYERS_SEVENTH_150.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_EIGHTH_50.length,
    50,
    `Expected exactly 50 players in EXTRA_PLAYERS_EIGHTH_50, got ${EXTRA_PLAYERS_EIGHTH_50.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_NINTH_50.length,
    50,
    `Expected exactly 50 players in EXTRA_PLAYERS_NINTH_50, got ${EXTRA_PLAYERS_NINTH_50.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_TENTH_50.length,
    50,
    `Expected exactly 50 players in EXTRA_PLAYERS_TENTH_50, got ${EXTRA_PLAYERS_TENTH_50.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_ELEVENTH_100.length,
    100,
    `Expected exactly 100 players in EXTRA_PLAYERS_ELEVENTH_100, got ${EXTRA_PLAYERS_ELEVENTH_100.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_TWELFTH_100.length,
    100,
    `Expected exactly 100 players in EXTRA_PLAYERS_TWELFTH_100, got ${EXTRA_PLAYERS_TWELFTH_100.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_THIRTEENTH_100.length,
    100,
    `Expected exactly 100 players in EXTRA_PLAYERS_THIRTEENTH_100, got ${EXTRA_PLAYERS_THIRTEENTH_100.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_FOURTEENTH_200.length,
    200,
    `Expected exactly 200 players in EXTRA_PLAYERS_FOURTEENTH_200, got ${EXTRA_PLAYERS_FOURTEENTH_200.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_FIFTEENTH_150.length,
    150,
    `Expected exactly 150 players in EXTRA_PLAYERS_FIFTEENTH_150, got ${EXTRA_PLAYERS_FIFTEENTH_150.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_SIXTEENTH_250.length,
    250,
    `Expected exactly 250 players in EXTRA_PLAYERS_SIXTEENTH_250, got ${EXTRA_PLAYERS_SIXTEENTH_250.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_SEVENTEENTH_250.length,
    250,
    `Expected exactly 250 players in EXTRA_PLAYERS_SEVENTEENTH_250, got ${EXTRA_PLAYERS_SEVENTEENTH_250.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_EIGHTEENTH_250.length,
    250,
    `Expected exactly 250 players in EXTRA_PLAYERS_EIGHTEENTH_250, got ${EXTRA_PLAYERS_EIGHTEENTH_250.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_NINETEENTH_250.length,
    250,
    `Expected exactly 250 players in EXTRA_PLAYERS_NINETEENTH_250, got ${EXTRA_PLAYERS_NINETEENTH_250.length}`
  );
  assert.equal(
    EXTRA_PLAYERS_TWENTIETH_BATCH.length,
    242,
    `Expected exactly 242 players in EXTRA_PLAYERS_TWENTIETH_BATCH, got ${EXTRA_PLAYERS_TWENTIETH_BATCH.length}`
  );
  const expectedTotal =
    464 +
    EXTRA_PLAYERS_FOURTH_100.length +
    EXTRA_PLAYERS_FIFTH_150.length +
    EXTRA_PLAYERS_SIXTH_100.length +
    EXTRA_PLAYERS_SEVENTH_150.length +
    EXTRA_PLAYERS_EIGHTH_50.length +
    EXTRA_PLAYERS_NINTH_50.length +
    EXTRA_PLAYERS_TENTH_50.length +
    EXTRA_PLAYERS_ELEVENTH_100.length +
    EXTRA_PLAYERS_TWELFTH_100.length +
    EXTRA_PLAYERS_THIRTEENTH_100.length +
    EXTRA_PLAYERS_FOURTEENTH_200.length +
    EXTRA_PLAYERS_FIFTEENTH_150.length +
    EXTRA_PLAYERS_SIXTEENTH_250.length +
    EXTRA_PLAYERS_SEVENTEENTH_250.length +
    EXTRA_PLAYERS_EIGHTEENTH_250.length +
    EXTRA_PLAYERS_NINETEENTH_250.length +
    EXTRA_PLAYERS_TWENTIETH_BATCH.length;
  assert.equal(expectedTotal, 3049, `Expected 3049 total footballers, got ${expectedTotal}`);
  assert.equal(PLAYERS_LIST.length, expectedTotal, `Expected ${expectedTotal} PLAYERS_LIST entries, got ${PLAYERS_LIST.length}`);
  assert.equal(playerIds.length, expectedTotal, `Expected ${expectedTotal} unique PLAYERS keys, got ${playerIds.length}`);
  assert.ok(SILHOUETTE_CHALLENGES.length >= expectedTotal, `Expected SILHOUETTE_CHALLENGES >= ${expectedTotal}, got ${SILHOUETTE_CHALLENGES.length}`);

  const seenIds = new Set(BASE_PLAYERS_LIST.map((p) => p.id));
  for (const extra of EXTRA_PLAYERS_50) {
    assert.equal(seenIds.has(extra.id), false, `Duplicate player ID ${extra.id} found in EXTRA_PLAYERS_50`);
    seenIds.add(extra.id);
    assert.ok(
      Array.isArray(extra.careerHistory) && extra.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra.id}`
    );
  }
  for (const extra2 of EXTRA_PLAYERS_MORE_50) {
    assert.equal(seenIds.has(extra2.id), false, `Duplicate player ID ${extra2.id} found in EXTRA_PLAYERS_MORE_50`);
    seenIds.add(extra2.id);
    assert.ok(
      Array.isArray(extra2.careerHistory) && extra2.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra2.id}`
    );
  }
  for (const extra3 of EXTRA_PLAYERS_THIRD_50) {
    assert.equal(seenIds.has(extra3.id), false, `Duplicate player ID ${extra3.id} found in EXTRA_PLAYERS_THIRD_50`);
    seenIds.add(extra3.id);
    assert.ok(
      Array.isArray(extra3.careerHistory) && extra3.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra3.id}`
    );
  }
  for (const extra4 of EXTRA_PLAYERS_FOURTH_100) {
    assert.equal(seenIds.has(extra4.id), false, `Duplicate player ID ${extra4.id} found in EXTRA_PLAYERS_FOURTH_100`);
    seenIds.add(extra4.id);
    assert.ok(
      Array.isArray(extra4.careerHistory) && extra4.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra4.id}`
    );
  }
  for (const extra5 of EXTRA_PLAYERS_FIFTH_150) {
    assert.equal(seenIds.has(extra5.id), false, `Duplicate player ID ${extra5.id} found in EXTRA_PLAYERS_FIFTH_150`);
    seenIds.add(extra5.id);
    assert.ok(
      Array.isArray(extra5.careerHistory) && extra5.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra5.id}`
    );
  }
  for (const extra6 of EXTRA_PLAYERS_SIXTH_100) {
    assert.equal(seenIds.has(extra6.id), false, `Duplicate player ID ${extra6.id} found in EXTRA_PLAYERS_SIXTH_100`);
    seenIds.add(extra6.id);
    assert.ok(
      Array.isArray(extra6.careerHistory) && extra6.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra6.id}`
    );
  }
  for (const extra7 of EXTRA_PLAYERS_SEVENTH_150) {
    assert.equal(seenIds.has(extra7.id), false, `Duplicate player ID ${extra7.id} found in EXTRA_PLAYERS_SEVENTH_150`);
    seenIds.add(extra7.id);
    assert.ok(
      Array.isArray(extra7.careerHistory) && extra7.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra7.id}`
    );
  }
  for (const extra8 of EXTRA_PLAYERS_EIGHTH_50) {
    assert.equal(seenIds.has(extra8.id), false, `Duplicate player ID ${extra8.id} found in EXTRA_PLAYERS_EIGHTH_50`);
    seenIds.add(extra8.id);
    assert.ok(
      Array.isArray(extra8.careerHistory) && extra8.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra8.id}`
    );
    const appearance = resolvePlayerAppearance(extra8);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra9 of EXTRA_PLAYERS_NINTH_50) {
    assert.equal(seenIds.has(extra9.id), false, `Duplicate player ID ${extra9.id} found in EXTRA_PLAYERS_NINTH_50`);
    seenIds.add(extra9.id);
    assert.ok(
      Array.isArray(extra9.careerHistory) && extra9.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra9.id}`
    );
    const appearance = resolvePlayerAppearance(extra9);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra10 of EXTRA_PLAYERS_TENTH_50) {
    assert.equal(seenIds.has(extra10.id), false, `Duplicate player ID ${extra10.id} found in EXTRA_PLAYERS_TENTH_50`);
    seenIds.add(extra10.id);
    assert.ok(
      Array.isArray(extra10.careerHistory) && extra10.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra10.id}`
    );
    const appearance = resolvePlayerAppearance(extra10);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra11 of EXTRA_PLAYERS_ELEVENTH_100) {
    assert.equal(seenIds.has(extra11.id), false, `Duplicate player ID ${extra11.id} found in EXTRA_PLAYERS_ELEVENTH_100`);
    seenIds.add(extra11.id);
    assert.ok(
      Array.isArray(extra11.careerHistory) && extra11.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra11.id}`
    );
    const appearance = resolvePlayerAppearance(extra11);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra12 of EXTRA_PLAYERS_TWELFTH_100) {
    assert.equal(seenIds.has(extra12.id), false, `Duplicate player ID ${extra12.id} found in EXTRA_PLAYERS_TWELFTH_100`);
    seenIds.add(extra12.id);
    assert.ok(
      Array.isArray(extra12.careerHistory) && extra12.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra12.id}`
    );
    const appearance = resolvePlayerAppearance(extra12);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra13 of EXTRA_PLAYERS_THIRTEENTH_100) {
    assert.equal(seenIds.has(extra13.id), false, `Duplicate player ID ${extra13.id} found in EXTRA_PLAYERS_THIRTEENTH_100`);
    seenIds.add(extra13.id);
    assert.ok(
      Array.isArray(extra13.careerHistory) && extra13.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra13.id}`
    );
    assert.equal(
      isSouthAmericaLocalOnlyPlayer(extra13),
      false,
      `Batch 13 player ${extra13.id} must have European/Super Lig/World Cup recognition`
    );
    const appearance = resolvePlayerAppearance(extra13);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra14 of EXTRA_PLAYERS_FOURTEENTH_200) {
    assert.equal(seenIds.has(extra14.id), false, `Duplicate player ID ${extra14.id} found in EXTRA_PLAYERS_FOURTEENTH_200`);
    seenIds.add(extra14.id);
    assert.ok(
      Array.isArray(extra14.careerHistory) && extra14.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra14.id}`
    );
    assert.equal(
      isSouthAmericaLocalOnlyPlayer(extra14),
      false,
      `Batch 14 player ${extra14.id} must have European/Super Lig/World Cup recognition`
    );
    const appearance = resolvePlayerAppearance(extra14);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra15 of EXTRA_PLAYERS_FIFTEENTH_150) {
    assert.equal(seenIds.has(extra15.id), false, `Duplicate player ID ${extra15.id} found in EXTRA_PLAYERS_FIFTEENTH_150`);
    seenIds.add(extra15.id);
    assert.ok(
      Array.isArray(extra15.careerHistory) && extra15.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra15.id}`
    );
    assert.equal(
      isSouthAmericaLocalOnlyPlayer(extra15),
      false,
      `Batch 15 player ${extra15.id} must have European/Super Lig/World Cup recognition`
    );
    const appearance = resolvePlayerAppearance(extra15);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra16 of EXTRA_PLAYERS_SIXTEENTH_250) {
    assert.equal(seenIds.has(extra16.id), false, `Duplicate player ID ${extra16.id} found in EXTRA_PLAYERS_SIXTEENTH_250`);
    seenIds.add(extra16.id);
    assert.ok(
      Array.isArray(extra16.careerHistory) && extra16.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra16.id}`
    );
    assert.equal(
      isSouthAmericaLocalOnlyPlayer(extra16),
      false,
      `Batch 16 player ${extra16.id} must have European/Top-5 league recognition`
    );
    const appearance = resolvePlayerAppearance(extra16);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra17 of EXTRA_PLAYERS_SEVENTEENTH_250) {
    assert.equal(seenIds.has(extra17.id), false, `Duplicate player ID ${extra17.id} found in EXTRA_PLAYERS_SEVENTEENTH_250`);
    seenIds.add(extra17.id);
    assert.ok(
      Array.isArray(extra17.careerHistory) && extra17.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra17.id}`
    );
    assert.equal(
      isSouthAmericaLocalOnlyPlayer(extra17),
      false,
      `Batch 17 player ${extra17.id} must have Super Lig/World Cup/Euro recognition`
    );
    const appearance = resolvePlayerAppearance(extra17);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra18 of EXTRA_PLAYERS_EIGHTEENTH_250) {
    assert.equal(seenIds.has(extra18.id), false, `Duplicate player ID ${extra18.id} found in EXTRA_PLAYERS_EIGHTEENTH_250`);
    seenIds.add(extra18.id);
    assert.ok(
      Array.isArray(extra18.careerHistory) && extra18.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra18.id}`
    );
    assert.equal(
      isSouthAmericaLocalOnlyPlayer(extra18),
      false,
      `Batch 18 player ${extra18.id} must have 1990s-2010s/Ballon d'Or recognition`
    );
    const appearance = resolvePlayerAppearance(extra18);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra19 of EXTRA_PLAYERS_NINETEENTH_250) {
    assert.equal(seenIds.has(extra19.id), false, `Duplicate player ID ${extra19.id} found in EXTRA_PLAYERS_NINETEENTH_250`);
    seenIds.add(extra19.id);
    assert.ok(
      Array.isArray(extra19.careerHistory) && extra19.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra19.id}`
    );
    assert.equal(
      isSouthAmericaLocalOnlyPlayer(extra19),
      false,
      `Batch 19 player ${extra19.id} must have top-flight/national team recognition`
    );
    const appearance = resolvePlayerAppearance(extra19);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  for (const extra20 of EXTRA_PLAYERS_TWENTIETH_BATCH) {
    assert.equal(seenIds.has(extra20.id), false, `Duplicate player ID ${extra20.id} found in EXTRA_PLAYERS_TWENTIETH_BATCH`);
    seenIds.add(extra20.id);
    assert.ok(
      Array.isArray(extra20.careerHistory) && extra20.careerHistory.length >= 2,
      `Expected complete multi-step careerHistory on ${extra20.id}`
    );
    assert.equal(
      isSouthAmericaLocalOnlyPlayer(extra20),
      false,
      `Batch 20 player ${extra20.id} must have European/Super Lig/World Cup recognition`
    );
    const appearance = resolvePlayerAppearance(extra20);
    assert.ok(appearance.hairStyle && appearance.skinTone && appearance.jerseyColors.length === 2);
  }
  assert.equal(KNOWN_WORLD_LEAGUES.length, 15, 'Expected all 15 known world leagues defined');

  assert.equal(fs.existsSync(path.resolve(process.cwd(), 'public', 'players')), false);
  assert.equal(DEFAULT_PLAYER_PHOTO, 'svg-avatar:default');

  for (const pid of playerIds) {
    const player = PLAYERS[pid];
    const asset = PLAYER_ASSETS[pid];
    assert.ok(asset, `Missing PLAYER_ASSETS entry for ${pid}`);
    assert.equal(asset.photoUrl, `svg-avatar:${pid}`, `Expected procedural SVG avatar token for ${pid}`);
    assert.equal(player.photoUrl, `svg-avatar:${pid}`, `Expected procedural SVG avatar token on player ${pid}`);
    assert.ok(!/^https?:\/\//i.test(asset.photoUrl), `External URL forbidden on ${pid}`);

    assert.ok(asset.age >= 17 && asset.age <= 95, `Invalid age ${asset.age} for ${pid}`);
    assert.ok(asset.shirtNumber >= 1 && asset.shirtNumber <= 99, `Invalid shirtNumber for ${pid}`);
    assert.ok(asset.clubName.length > 0, `Missing clubName for ${pid}`);
    assert.ok(asset.league.length > 0, `Missing league for ${pid}`);

    assert.ok(
      Array.isArray(player.careerHistory) && player.careerHistory.length >= 1,
      `Missing careerHistory for ${pid}`
    );
    for (const step of player.careerHistory!) {
      assert.ok(step.club.trim().length > 0, `Empty career club for ${pid}`);
      assert.ok(step.years.trim().length > 0, `Empty career years for ${pid}`);
      assert.ok(step.countryFlag.trim().length > 0, `Empty career flag for ${pid}`);
      if (step.clubId) {
        assert.ok(CLUBS[step.clubId], `Unknown clubId ${step.clubId} in careerHistory of ${pid}`);
      }
    }
  }

  // Spot check newly added star footballers & full youth-to-present histories
  assert.ok(PLAYERS.lamine_yamal, 'Missing new star Lamine Yamal');
  assert.ok(PLAYERS.pedri, 'Missing new star Pedri');
  assert.ok(PLAYERS.franz_beckenbauer, 'Missing new legend Franz Beckenbauer');
  assert.ok(PLAYERS.michael_olise, 'Missing new star Michael Olise');
  assert.ok(PLAYERS.alexander_isak, 'Missing new star Alexander Isak');
  assert.ok(PLAYERS.gabriel_sara, 'Missing new star Gabriel Sara');
  assert.ok(PLAYERS.franco_baresi, 'Missing new legend Franco Baresi');
  assert.ok(PLAYERS.alex_iwobi, 'Missing new star Alex Iwobi');
  assert.ok(PLAYERS.eusebio, 'Missing new legend Eusebio');
  assert.ok(PLAYERS.zico, 'Missing new legend Zico');
  assert.ok(PLAYERS.endrick, 'Missing new star Endrick');
  assert.ok(PLAYERS.deniz_undav, 'Missing new star Deniz Undav');
  assert.ok(PLAYERS.ferenc_puskas, 'Missing new legend Ferenc Puskas');
  assert.ok(PLAYERS.lev_yashin, 'Missing new legend Lev Yashin');
  assert.ok(PLAYERS.nuno_mendes, 'Missing new star Nuno Mendes');
  assert.ok(PLAYERS.mike_maignan, 'Missing new star Mike Maignan');
  assert.ok(PLAYERS.mario_jardel, 'Missing new legend Mario Jardel');
  assert.ok(PLAYERS.andriy_shevchenko, 'Missing new legend Andriy Shevchenko');
  assert.ok(PLAYERS.daniele_de_rossi, 'Missing new legend Daniele De Rossi');
  assert.ok(PLAYERS.okan_buruk, 'Missing new legend Okan Buruk');
  assert.ok(PLAYERS.unai_simon, 'Missing new star Unai Simon');
  assert.ok(PLAYERS.riccardo_calafiori, 'Missing new star Riccardo Calafiori');
  assert.ok(PLAYERS.kaoru_mitoma, 'Missing new star Kaoru Mitoma');
  assert.ok(PLAYERS.yusuf_akcicek, 'Missing new star Yusuf Akcicek');
  assert.ok(PLAYERS.can_bartu, 'Missing Batch 7 legend Can Bartu');
  assert.ok(PLAYERS.sepp_maier, 'Missing Batch 7 legend Sepp Maier');
  assert.ok(PLAYERS.marc_casado, 'Missing Batch 7 star Marc Casado');
  assert.ok(PLAYERS.inaki_williams, 'Missing Batch 7 star Inaki Williams');
  assert.ok(PLAYERS.cristiano_ronaldo.careerHistory!.some((c) => c.isYouth));

  assert.equal(PLAYER_ASSETS.mohamed_salah.clubId, 'trabzonspor');
  assert.equal(PLAYER_ASSETS.robert_lewandowski.clubName, 'Chicago Fire');
  assert.equal(PLAYER_ASSETS.edin_dzeko.clubId, 'schalke_04');
  assert.equal(PLAYER_ASSETS.luka_modric.clubId, 'ac_milan');
  assert.equal(MAX_SILHOUETTE_ATTEMPTS, 8);
});

test('roundTiming returns 120s for silhouette and 15s for all other minigames with clean m:ss formatting', () => {
  assert.equal(getRoundDurationSeconds('silhouette'), 120);
  assert.equal(getRoundDurationSeconds('two_clubs'), 15);
  assert.equal(getRoundDurationSeconds('career'), 15);
  assert.equal(getRoundDurationSeconds('country_club'), 15);
  assert.equal(getRoundDurationSeconds('xox'), 15);

  assert.equal(formatRoundTimer(120), '2:00');
  assert.equal(formatRoundTimer(75), '1:15');
  assert.equal(formatRoundTimer(60), '1:00');
  assert.equal(formatRoundTimer(45), '45s');
  assert.equal(formatRoundTimer(0), '0s');
});

test('compareSilhouetteGuess computes exact club, same league, country, position, age & shirt directions', () => {
  const sameClub = compareSilhouetteGuess('lucas_torreira', 'victor_osimhen');
  assert.ok(sameClub);
  assert.equal(sameClub.isCorrect, false);
  assert.equal(sameClub.clubMatch, 'exact');
  assert.equal(sameClub.nationalityMatch, false);
  assert.equal(sameClub.positionMatch, false);
  assert.equal(sameClub.ageDirection, 'lower');
  assert.equal(sameClub.shirtDirection, 'higher');

  const sameLeague = compareSilhouetteGuess('mohamed_salah', 'victor_osimhen');
  assert.ok(sameLeague);
  assert.equal(sameLeague.clubMatch, 'same_league');

  const diffLeague = compareSilhouetteGuess('arda_guler', 'victor_osimhen');
  assert.ok(diffLeague);
  assert.equal(diffLeague.clubMatch, 'none');
  assert.equal(diffLeague.ageDirection, 'higher');

  const exact = compareSilhouetteGuess('victor_osimhen', 'victor_osimhen');
  assert.ok(exact);
  assert.equal(exact.isCorrect, true);
  assert.equal(exact.clubMatch, 'exact');
  assert.equal(exact.nationalityMatch, true);
  assert.equal(exact.positionMatch, true);
  assert.equal(exact.ageDirection, 'exact');
  assert.equal(exact.shirtDirection, 'exact');
});

test('searchSilhouettePlayers handles Turkish diacritics, aliases, exclusions, and blur levels', () => {
  const guler = searchSilhouettePlayers('guler');
  assert.ok(guler.some((p) => p.id === 'arda_guler'));

  // Smart autocomplete requires >= 2 chars and handles Turkish/English chars seamlessly
  assert.equal(searchPlayersForAutocomplete('a').length, 0);
  assert.ok(searchPlayersForAutocomplete('sa').length <= 6);
  assert.ok(searchPlayersForAutocomplete('sa').some((p) => p.id === 'sabri_sarioglu' || p.id === 'mohamed_salah'));
  assert.ok(searchPlayersForAutocomplete('şentürk').some((p) => p.id === 'semih_senturk'));
  assert.ok(searchPlayersForAutocomplete('senturk').some((p) => p.id === 'semih_senturk'));
  assert.ok(searchPlayersForAutocomplete('kante').some((p) => p.id === 'ngolo_kante'));
  assert.ok(searchPlayersForAutocomplete('muller').some((p) => p.id === 'thomas_muller'));

  const yamal = searchSilhouettePlayers('yamal');
  assert.ok(yamal.some((p) => p.id === 'lamine_yamal'));

  const excluded = searchSilhouettePlayers('osimhen', ['victor_osimhen']);
  assert.equal(excluded.some((p) => p.id === 'victor_osimhen'), false);

  const resolved = resolveGuessedPlayerFromInput('icardi', 'victor_osimhen');
  assert.equal(resolved?.id, 'mauro_icardi');

  assert.equal(getPortraitBlurPx(0, false), 14);
  assert.ok(getPortraitBlurPx(1, false) < getPortraitBlurPx(0, false));
  assert.ok(getPortraitBlurPx(2, false) < getPortraitBlurPx(1, false));
  assert.equal(getPortraitBlurPx(3, false), 7);
  assert.ok(getPortraitBlurPx(6, false) < getPortraitBlurPx(3, false));
  assert.equal(getPortraitBlurPx(7, false), 1.2);
  assert.equal(getPortraitBlurPx(3, true), 0);
  assert.equal(getPlayerAsset('victor_osimhen').photoUrl, 'svg-avatar:victor_osimhen');
  assert.equal(getPlayerAsset('michael_olise').photoUrl, 'svg-avatar:michael_olise');
  assert.equal(getPlayerAsset('unknown_player_id').photoUrl, 'svg-avatar:default');
});

import { CAREER_CHALLENGES } from './minigamesData';
import { resolveClubBadgeMeta } from './clubBadgeCatalog';

test('all 414+ players resolve valid deterministic appearances with signatures and distinct ClubBadge styles', () => {
  const validHairStyles = new Set([
    'braided-bun',
    'long-blonde',
    'curly-afro',
    'short-fade',
    'buzzcut',
    'messy-medium',
    'bald',
  ]);
  const validFacialHairs = new Set(['none', 'beard', 'stubble', 'mustache']);
  const validSignatures = new Set([
    'none',
    'mask',
    'viking',
    'commander',
    'headband',
    'legend_crown',
    'keeper_aura',
  ]);
  const hexRegex = /^#[0-9a-fA-F]{6}$/;

  for (const [pid, player] of Object.entries(PLAYERS)) {
    const resolved = resolvePlayerAppearance(player);
    assert.ok(resolved, `Missing resolved appearance on ${pid}`);
    assert.ok(
      validHairStyles.has(resolved.hairStyle),
      `Invalid hairStyle ${resolved.hairStyle} on ${pid}`
    );
    assert.ok(
      hexRegex.test(resolved.hairColor),
      `Invalid hairColor ${resolved.hairColor} on ${pid}`
    );
    assert.ok(
      hexRegex.test(resolved.skinTone),
      `Invalid skinTone ${resolved.skinTone} on ${pid}`
    );
    assert.ok(
      validFacialHairs.has(resolved.facialHair),
      `Invalid facialHair ${resolved.facialHair} on ${pid}`
    );
    assert.ok(
      resolved.signature && validSignatures.has(resolved.signature),
      `Invalid signature ${resolved.signature} on ${pid}`
    );
    assert.ok(
      resolved.eyeColor && hexRegex.test(resolved.eyeColor),
      `Invalid eyeColor ${resolved.eyeColor} on ${pid}`
    );
    assert.equal(resolved.jerseyColors.length, 2, `Expected 2 jerseyColors on ${pid}`);
    assert.ok(hexRegex.test(resolved.jerseyColors[0]), `Invalid jersey primary on ${pid}`);
    assert.ok(hexRegex.test(resolved.jerseyColors[1]), `Invalid jersey secondary on ${pid}`);

    const auto1 = computeAutoAppearance({ ...player, appearance: undefined });
    const auto2 = computeAutoAppearance({ ...player, appearance: undefined });
    assert.deepEqual(auto1, auto2, `Non-deterministic auto appearance for ${pid}`);
  }

  // Spot check iconic player signature traits
  assert.equal(resolvePlayerAppearance(PLAYERS.victor_osimhen).signature, 'mask');
  assert.equal(resolvePlayerAppearance(PLAYERS.erling_haaland).signature, 'viking');
  assert.equal(resolvePlayerAppearance(PLAYERS.kylian_mbappe).signature, 'commander');
  assert.equal(resolvePlayerAppearance(PLAYERS.lionel_messi).signature, 'legend_crown');
  assert.equal(PLAYERS.michael_olise.appearance?.hairStyle, 'braided-bun');
  assert.equal(PLAYERS.erling_haaland.appearance?.hairStyle, 'long-blonde');

  const kosticAppearance = resolvePlayerAppearance(PLAYERS.filip_kostic);
  assert.deepEqual(kosticAppearance.jerseyColors, [
    CLUBS.fenerbahce.colors.primary,
    CLUBS.fenerbahce.colors.secondary,
  ]);

  const boeyAppearance = resolvePlayerAppearance(PLAYERS.sacha_boey);
  assert.deepEqual(boeyAppearance.jerseyColors, [
    CLUBS.bayern_munich.colors.primary,
    CLUBS.bayern_munich.colors.secondary,
  ]);

  const gabrielPaulistaAppearance = resolvePlayerAppearance(PLAYERS.gabriel_paulista);
  assert.deepEqual(gabrielPaulistaAppearance.jerseyColors, [
    CLUBS.besiktas.colors.primary,
    CLUBS.besiktas.colors.secondary,
  ]);

  // Verify every CLUBS entry + extra career step club resolves valid monogram, colors & distinct shapes/patterns
  const seenShapes = new Set<string>();
  const seenPatterns = new Set<string>();
  for (const club of Object.values(CLUBS)) {
    const meta = resolveClubBadgeMeta(club.id, club.name, club);
    assert.ok(meta.monogram.length >= 2 && meta.monogram.length <= 4, `Invalid monogram ${meta.monogram} for ${club.id}`);
    assert.ok(hexRegex.test(meta.primaryColor), `Invalid primaryColor for ${club.id}`);
    assert.ok(hexRegex.test(meta.secondaryColor), `Invalid secondaryColor for ${club.id}`);
    seenShapes.add(meta.shape);
    seenPatterns.add(meta.pattern);
  }
  assert.ok(seenShapes.size >= 5, `Expected varied club badge shapes, found ${seenShapes.size}`);
  assert.ok(seenPatterns.size >= 6, `Expected varied club badge patterns, found ${seenPatterns.size}`);

  // Distinct clubs should not look identical
  const gsMeta = resolveClubBadgeMeta('galatasaray', undefined, CLUBS.galatasaray);
  const fbMeta = resolveClubBadgeMeta('fenerbahce', undefined, CLUBS.fenerbahce);
  const bayMeta = resolveClubBadgeMeta('bayern_munich', undefined, CLUBS.bayern_munich);
  assert.notEqual(gsMeta.shape, fbMeta.shape);
  assert.notEqual(gsMeta.pattern, bayMeta.pattern);

  for (const player of PLAYERS_LIST) {
    for (const step of player.careerHistory || []) {
      const club = step.clubId ? CLUBS[step.clubId] : null;
      const meta = resolveClubBadgeMeta(step.clubId, step.club, club);
      assert.ok(meta.monogram.length >= 2 && meta.monogram.length <= 4, `Bad player career monogram for ${step.club}`);
      assert.ok(hexRegex.test(meta.primaryColor), `Bad player career primaryColor for ${step.club}`);
      assert.ok(hexRegex.test(meta.secondaryColor), `Bad player career secondaryColor for ${step.club}`);
    }
  }

  for (const challenge of CAREER_CHALLENGES) {
    for (const step of challenge.steps) {
      const club = step.clubId ? CLUBS[step.clubId] : null;
      const meta = resolveClubBadgeMeta(step.clubId, step.clubName, club);
      assert.ok(meta.monogram.length >= 2 && meta.monogram.length <= 4, `Bad career monogram for ${step.clubName}`);
      assert.ok(hexRegex.test(meta.primaryColor), `Bad career primaryColor for ${step.clubName}`);
      assert.ok(hexRegex.test(meta.secondaryColor), `Bad career secondaryColor for ${step.clubName}`);
    }
  }
});

test('summarizeSilhouetteClues starts with known position and narrows league, club, nationality, age and shirt bounds', () => {
  const initial = summarizeSilhouetteClues([], 'victor_osimhen');
  assert.equal(initial.position.label, 'FW');
  assert.equal(initial.team.status, 'unknown');
  assert.equal(initial.nationality.status, 'unknown');
  assert.equal(initial.age.status, 'unknown');
  assert.equal(initial.shirtNumber.status, 'unknown');

  const g1 = compareSilhouetteGuess('arda_guler', 'victor_osimhen')!;
  const g2 = compareSilhouetteGuess('mohamed_salah', 'victor_osimhen')!;
  const afterLeague = summarizeSilhouetteClues([g1, g2], 'victor_osimhen');
  assert.equal(afterLeague.team.status, 'league');
  assert.equal(afterLeague.team.label, 'Süper Lig');
  assert.equal(afterLeague.age.status, 'range');

  const g3 = compareSilhouetteGuess('lucas_torreira', 'victor_osimhen')!;
  const afterClub = summarizeSilhouetteClues([g1, g2, g3], 'victor_osimhen');
  assert.equal(afterClub.team.status, 'exact');
  assert.equal(afterClub.team.label, 'Galatasaray');
});

