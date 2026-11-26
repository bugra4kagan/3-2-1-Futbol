import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeText,
  levenshteinDistance,
  isFuzzyMatch,
  isAmbiguousSharedSurname,
  validateAnswerForPairing,
  validateAnswerForPlayerIds,
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

test('normalizeText handles Turkish I/İ/ı/i and all international diacritics identically', () => {
  assert.equal(normalizeText('Sørloth'), normalizeText('Sorloth'));
  assert.equal(normalizeText('João Félix'), normalizeText('Joao Felix'));
  assert.equal(normalizeText('İlkay Gündoğan'), normalizeText('Ilkay Gundogan'));
  assert.equal(normalizeText('Mesut Özil'), normalizeText('Mesut Ozil'));
  assert.equal(normalizeText('Kylian Mbappé'), normalizeText('Kylian Mbappe'));
  assert.equal(normalizeText('Luka Modrić'), normalizeText('Luka Modric'));
  assert.equal(normalizeText('Erling Håland'), normalizeText('Erling Haland'));
  assert.equal(normalizeText('Wojciech Szczęsny'), normalizeText('Wojciech Szczesny'));
  assert.equal(normalizeText('İSMAİL IŞIK ısparta'), 'ismail isik isparta');
});

test('validateAnswerForPlayerIds matches international and Turkish-normalized player names', () => {
  assert.equal(validateAnswerForPlayerIds('Sorloth', ['alexander_sorloth']).player?.id, 'alexander_sorloth');
  assert.equal(validateAnswerForPlayerIds('Sørloth', ['alexander_sorloth']).player?.id, 'alexander_sorloth');
  assert.equal(validateAnswerForPlayerIds('Joao Felix', ['joao_felix']).player?.id, 'joao_felix');
  assert.equal(validateAnswerForPlayerIds('Ilkay Gundogan', ['ilkay_gundogan']).player?.id, 'ilkay_gundogan');
  assert.equal(validateAnswerForPlayerIds('Mesut Ozil', ['mesut_ozil']).player?.id, 'mesut_ozil');
  assert.equal(validateAnswerForPlayerIds('Kylian Mbappe', ['kylian_mbappe']).player?.id, 'kylian_mbappe');
  assert.equal(validateAnswerForPlayerIds('Luka Modric', ['luka_modric']).player?.id, 'luka_modric');
  assert.equal(validateAnswerForPlayerIds('Erling Haland', ['erling_haaland']).player?.id, 'erling_haaland');
  assert.equal(validateAnswerForPlayerIds('Erling Håland', ['erling_haaland']).player?.id, 'erling_haaland');
  assert.equal(validateAnswerForPlayerIds('Wojciech Szczesny', ['wojciech_szczesny']).player?.id, 'wojciech_szczesny');
});

test('strict anti-collision blocks partial prefixes and ambiguous shared single surnames', () => {
  assert.equal(isFuzzyMatch('mert', 'Dries Mertens'), false);
  assert.equal(validateAnswerForPlayerIds('mert', ['dries_mertens']).isValid, false);
  assert.equal(validateAnswerForPlayerIds('Mertens', ['dries_mertens']).isValid, true);

  assert.equal(isAmbiguousSharedSurname('Silva'), true);
  assert.equal(isAmbiguousSharedSurname('Torres'), true);
  assert.equal(isAmbiguousSharedSurname('Dembele'), true);

  // Bare shared surname must not blindly match a specific player
  assert.equal(validateAnswerForPlayerIds('Silva', ['thiago_silva']).isValid, false);
  assert.equal(validateAnswerForPlayerIds('Torres', ['fernando_torres']).isValid, false);
  assert.equal(validateAnswerForPlayerIds('Dembele', ['ousmane_dembele']).isValid, false);
  assert.equal(validateAnswerForPlayerIds('Martinez', ['lautaro_martinez']).isValid, false);

  // Wrong first name with shared surname must also be rejected
  assert.equal(validateAnswerForPlayerIds('Thiago Silva', ['david_silva']).isValid, false);
  assert.equal(validateAnswerForPlayerIds('Fernando Torres', ['ferran_torres']).isValid, false);
  assert.equal(validateAnswerForPlayerIds('Ousmane Dembele', ['moussa_dembele_fr']).isValid, false);

  // Explicit full name matches accurately
  assert.equal(validateAnswerForPlayerIds('Thiago Silva', ['thiago_silva']).player?.id, 'thiago_silva');
  assert.equal(validateAnswerForPlayerIds('Ferran Torres', ['ferran_torres']).player?.id, 'ferran_torres');
});

