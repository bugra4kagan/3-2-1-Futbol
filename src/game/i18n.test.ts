import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
  isSupportedLanguage,
  t,
} from './i18n';

test('all supported languages define every translation key without empty values', () => {
  const trKeys = Object.keys(TRANSLATIONS.tr);
  assert.ok(trKeys.length >= 25);

  for (const opt of LANGUAGE_OPTIONS) {
    assert.equal(isSupportedLanguage(opt.id), true);
    const dict = TRANSLATIONS[opt.id];
    assert.ok(dict, `Missing dictionary for ${opt.id}`);
    for (const key of trKeys) {
      const val = (dict as Record<string, string>)[key];
      assert.ok(
        typeof val === 'string' && val.trim().length > 0,
        `Missing or empty translation for ${opt.id}.${key}`
      );
    }
  }

  assert.equal(t('tr', 'settings'), 'Ayarlar');
  assert.equal(t('en', 'settings'), 'Settings');
  assert.equal(t('de', 'settings'), 'Einstellungen');
  assert.equal(t('es', 'settings'), 'Ajustes');
  assert.equal(isSupportedLanguage('fr'), false);
});
