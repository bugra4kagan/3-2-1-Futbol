import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYERS } from './database';
import { PLAYER_ASSETS, getPlayerAsset } from './playerAssets';
import {
  MAX_SILHOUETTE_ATTEMPTS,
  compareSilhouetteGuess,
  getPortraitBlurPx,
  resolveGuessedPlayerFromInput,
  searchSilhouettePlayers,
} from './silhouetteEngine';
import { formatRoundTimer, getRoundDurationSeconds } from './roundTiming';

test('all 167 PLAYERS have valid photoUrl, age, shirtNumber, clubName, and league in PLAYER_ASSETS', () => {
  for (const pid of Object.keys(PLAYERS)) {
    const asset = PLAYER_ASSETS[pid];
    assert.ok(asset, `Missing PLAYER_ASSETS entry for ${pid}`);
    assert.ok(asset.photoUrl.startsWith('https://'), `Invalid photoUrl for ${pid}`);
    assert.ok(asset.age >= 18 && asset.age <= 75, `Invalid age ${asset.age} for ${pid}`);
    assert.ok(asset.shirtNumber >= 1 && asset.shirtNumber <= 99, `Invalid shirtNumber for ${pid}`);
    assert.ok(asset.clubName.length > 0, `Missing clubName for ${pid}`);
    assert.ok(asset.league.length > 0, `Missing league for ${pid}`);
  }
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
  // Lucas Torreira (Galatasaray, Süper Lig, Uruguay, MF, #34) vs Victor Osimhen (Galatasaray, Süper Lig, Nijerya, FW, #45)
  const sameClub = compareSilhouetteGuess('lucas_torreira', 'victor_osimhen');
  assert.ok(sameClub);
  assert.equal(sameClub.isCorrect, false);
  assert.equal(sameClub.clubMatch, 'exact');
  assert.equal(sameClub.nationalityMatch, false);
  assert.equal(sameClub.positionMatch, false);
  assert.equal(sameClub.ageDirection, 'lower'); // target Osimhen (27) < Torreira (30)
  assert.equal(sameClub.shirtDirection, 'higher'); // target Osimhen (#45) > Torreira (#34)

  // Mohamed Salah (Trabzonspor, Süper Lig) vs Victor Osimhen (Galatasaray, Süper Lig)
  const sameLeague = compareSilhouetteGuess('mohamed_salah', 'victor_osimhen');
  assert.ok(sameLeague);
  assert.equal(sameLeague.clubMatch, 'same_league');

  // Arda Güler (Real Madrid, La Liga) vs Victor Osimhen (Galatasaray, Süper Lig)
  const diffLeague = compareSilhouetteGuess('arda_guler', 'victor_osimhen');
  assert.ok(diffLeague);
  assert.equal(diffLeague.clubMatch, 'none');
  assert.equal(diffLeague.ageDirection, 'higher'); // 27 > 21

  // Exact hit
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

  const excluded = searchSilhouettePlayers('osimhen', ['victor_osimhen']);
  assert.equal(excluded.some((p) => p.id === 'victor_osimhen'), false);

  const resolved = resolveGuessedPlayerFromInput('icardi', 'victor_osimhen');
  assert.equal(resolved?.id, 'mauro_icardi');

  assert.equal(getPortraitBlurPx(0, false), 24);
  assert.ok(getPortraitBlurPx(3, false) < 24);
  assert.equal(getPortraitBlurPx(3, true), 0);
  assert.ok(getPlayerAsset('victor_osimhen').photoUrl.startsWith('https://'));
});
