import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  levenshteinDistance,
  isFuzzyMatch,
  validateAnswerForPairing,
} from './validator';
import { MATCH_PAIRINGS } from './database';

test('normalizeText handles Turkish characters properly', () => {
  assert.equal(normalizeText('ÇALHANOĞLU'), 'calhanoglu');
  assert.equal(normalizeText('ÖZİL'), 'ozil');
  assert.equal(normalizeText('Hakan Çalhanoğlu'), 'hakan calhanoglu');
  assert.equal(normalizeText('İlkay Gündoğan'), 'ilkay gundogan');
  assert.equal(normalizeText('Şükrü Saracoğlu'), 'sukru saracoglu');
});

test('normalizeText handles European accents and diacritics', () => {
  assert.equal(normalizeText('Cristiano Ronaldo'), 'cristiano ronaldo');
  assert.equal(normalizeText('Ángel Di María'), 'angel di maria');
  assert.equal(normalizeText('Zlatan Ibrahimović'), 'zlatan ibrahimovic');
  assert.equal(normalizeText('Martin Ødegaard'), 'martin odegaard');
});

test('levenshteinDistance computes edit distance correctly', () => {
  assert.equal(levenshteinDistance('ronaldo', 'ronaldo'), 0);
  assert.equal(levenshteinDistance('ronaldo', 'ronaldo7'), 1);
  assert.equal(levenshteinDistance('ibrahimovic', 'ibrahimoviç'), 1);
});

test('Real Madrid vs Manchester United accepts valid players', () => {
  const rmaMun = MATCH_PAIRINGS.find((p) => p.id === 'rma_mun')!;
  assert.ok(rmaMun, 'Pairing must exist');

  // Cristiano Ronaldo tests
  const res1 = validateAnswerForPairing('Ronaldo', rmaMun);
  assert.equal(res1.isValid, true);
  assert.equal(res1.player?.id, 'cristiano_ronaldo');

  const res2 = validateAnswerForPairing('CR7', rmaMun);
  assert.equal(res2.isValid, true);
  assert.equal(res2.player?.id, 'cristiano_ronaldo');

  const res3 = validateAnswerForPairing('cristiano ronaldo', rmaMun);
  assert.equal(res3.isValid, true);

  // Beckham
  const res4 = validateAnswerForPairing('Beckham', rmaMun);
  assert.equal(res4.isValid, true);
  assert.equal(res4.player?.id, 'david_beckham');

  // Angel Di Maria with Turkish / typo tolerance
  const res5 = validateAnswerForPairing('di maria', rmaMun);
  assert.equal(res5.isValid, true);
  assert.equal(res5.player?.id, 'angel_di_maria');

  // Invalid player for this pairing (e.g. Messi never played for Man Utd)
  const resInvalid = validateAnswerForPairing('Messi', rmaMun);
  assert.equal(resInvalid.isValid, false);
});

test('Barcelona vs PSG accepts Messi and Neymar and Ronaldinho', () => {
  const barPsg = MATCH_PAIRINGS.find((p) => p.id === 'bar_psg')!;
  assert.ok(barPsg);

  const resMessi = validateAnswerForPairing('Messi', barPsg);
  assert.equal(resMessi.isValid, true);
  assert.equal(resMessi.player?.id, 'lionel_messi');

  const resNeymar = validateAnswerForPairing('Neymar Jr', barPsg);
  assert.equal(resNeymar.isValid, true);
  assert.equal(resNeymar.player?.id, 'neymar_jr');

  const resIbra = validateAnswerForPairing('Ibra', barPsg);
  assert.equal(resIbra.isValid, true);
  assert.equal(resIbra.player?.id, 'zlatan_ibrahimovic');
});

test('Inter vs Milan accepts Hakan Calhanoglu with Turkish letters', () => {
  const intMil = MATCH_PAIRINGS.find((p) => p.id === 'int_mil')!;
  assert.ok(intMil);

  const resHakan = validateAnswerForPairing('Çalhanoğlu', intMil);
  assert.equal(resHakan.isValid, true);
  assert.equal(resHakan.player?.id, 'hakan_calhanoglu');
});

test('Galatasaray vs Fenerbahce accepts Burak Yilmaz and Batshuayi', () => {
  const gsFb = MATCH_PAIRINGS.find((p) => p.id === 'gs_fb')!;
  assert.ok(gsFb);

  const resBurak = validateAnswerForPairing('Burak Yılmaz', gsFb);
  assert.equal(resBurak.isValid, true);
  assert.equal(resBurak.player?.id, 'burak_yilmaz');

  const resBats = validateAnswerForPairing('Batshuayi', gsFb);
  assert.equal(resBats.isValid, true);
  assert.equal(resBats.player?.id, 'michy_batshuayi');
});

