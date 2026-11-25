import test from 'node:test';
import assert from 'node:assert/strict';
import {
  USERNAME_INAPPROPRIATE_ERROR,
  generateRandomUniqueStarterName,
  generateRecoveryCode,
  generateUniqueUsernameSuggestions,
  isLegacyFlaggedUsername,
  normalizeRecoveryCode,
  normalizeUsernameKey,
  sanitizePublicDisplayName,
  validateUsername,
  validateUsernameFormat,
} from './accountEngine';

test('normalizeUsernameKey canonicalizes Turkish letters, case, whitespace, and punctuation', () => {
  assert.equal(normalizeUsernameKey('Ahmet Yılmaz'), 'ahmet_yilmaz');
  assert.equal(normalizeUsernameKey('  AHMET   YILMAZ '), 'ahmet_yilmaz');
  assert.equal(normalizeUsernameKey('ahmet_yilmaz'), 'ahmet_yilmaz');
  assert.equal(normalizeUsernameKey('Şampiyon_İcardi99'), 'sampiyon_icardi99');
});

test('validateUsernameFormat rejects empty, short, reserved placeholder defaults, and accepts valid names', () => {
  assert.equal(validateUsernameFormat('').ok, false);
  assert.equal(validateUsernameFormat('ab').ok, false);
  assert.equal(validateUsernameFormat('...').ok, false);
  assert.equal(validateUsernameFormat('Futbol Gurmesi').ok, false);
  assert.equal(validateUsernameFormat('Rakip Oyuncu').ok, false);
  assert.equal(validateUsernameFormat('Oyuncu').ok, false);

  const valid = validateUsernameFormat('  KralForvet_10  ');
  assert.equal(valid.ok, true);
  assert.equal(valid.cleanedDisplay, 'KralForvet_10');
  assert.equal(valid.key, 'kralforvet_10');
});

test('validateUsername rejects Turkish/English profanity, leetspeak, XSS, and inappropriate 31 combos while allowing innocent names', () => {
  const blockedSamples = [
    'amk_krali',
    'o r o s p u',
    's1kt1rGit',
    'y@rr@k10',
    'f.u.c.k.you',
    'b1tchPlz',
    '31ceken',
    'otuzbirci',
    'Kral31sj',
    '<script>alert(1)</script>',
    '123456',
  ];

  for (const bad of blockedSamples) {
    const res = validateUsername(bad);
    assert.equal(res.ok, false, `Expected "${bad}" to be rejected`);
    assert.equal(res.error, USERNAME_INAPPROPRIATE_ERROR);
  }

  // Innocent Turkish names, football clubs, harmless numbers & dates MUST be allowed
  const allowedSamples = [
    'Mehmet07',
    'Beşiktaş1903',
    'Galata_1905',
    'Arda_2024',
    'Ramazan10',
    'SametYılmaz',
    'KlasikKaptan',
    'PassMaster9',
    'MarioGotze',
    'Ahmet31Hatay',
    'Şampiyonİcardi',
  ];

  for (const good of allowedSamples) {
    const res = validateUsername(good);
    assert.equal(res.ok, true, `Expected "${good}" to be allowed, got: ${res.error}`);
  }
});

test('sanitizePublicDisplayName dynamically replaces flagged legacy usernames with Oyuncu #XXXX without altering clean names', () => {
  assert.equal(sanitizePublicDisplayName('Ahmet_10', 'user_1'), 'Ahmet_10');
  assert.equal(isLegacyFlaggedUsername('Ahmet_10'), false);

  const masked = sanitizePublicDisplayName('amk_kral', 'user_99');
  assert.match(masked, /^Oyuncu #\d{4}$/);
  assert.equal(isLegacyFlaggedUsername('amk_kral'), true);
  assert.equal(sanitizePublicDisplayName('amk_kral', 'user_99'), masked);
});

test('generateUniqueUsernameSuggestions avoids taken keys and returns 3 distinct options', () => {
  const taken = new Set(['kralforvet', 'kralforvet_10', 'kralforvet_99']);
  const suggestions = generateUniqueUsernameSuggestions('KralForvet', taken, 3);
  assert.equal(suggestions.length, 3);
  for (const s of suggestions) {
    assert.equal(taken.has(normalizeUsernameKey(s)), false);
  }
});

test('generateRandomUniqueStarterName returns valid unused handle and recovery codes format cleanly', () => {
  const taken = new Set(['maestro_100']);
  const generated = generateRandomUniqueStarterName(taken);
  assert.equal(validateUsernameFormat(generated).ok, true);
  assert.equal(taken.has(normalizeUsernameKey(generated)), false);

  const code = generateRecoveryCode();
  assert.match(code, /^321-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normalizeRecoveryCode(`  ${code.toLowerCase()}  `), code);
});
