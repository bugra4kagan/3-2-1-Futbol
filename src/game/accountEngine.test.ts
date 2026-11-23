import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRandomUniqueStarterName,
  generateRecoveryCode,
  generateUniqueUsernameSuggestions,
  normalizeRecoveryCode,
  normalizeUsernameKey,
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
