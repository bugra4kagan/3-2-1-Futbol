import test from 'node:test';
import assert from 'node:assert/strict';
import {
  USERNAME_INAPPROPRIATE_ERROR,
  USERNAME_SYSTEM_RESERVED_ERROR,
  USERNAME_TAKEN_ERROR,
  USERNAME_UNSUPPORTED_CHAR_ERROR,
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
import { AccountStore } from './accountStore';
import { auditAndMigrateLegacyUsernames } from './legacyModeration';
import { createInitialProgression } from './retentionEngine';

test('normalizeUsernameKey canonicalizes Turkish letters, case, whitespace, and punctuation', () => {
  assert.equal(normalizeUsernameKey('Ahmet Yılmaz'), 'ahmet_yilmaz');
  assert.equal(normalizeUsernameKey('  AHMET   YILMAZ '), 'ahmet_yilmaz');
  assert.equal(normalizeUsernameKey('ahmet_yilmaz'), 'ahmet_yilmaz');
  assert.equal(normalizeUsernameKey('Şampiyon_İcardi99'), 'sampiyon_icardi99');
});

test('validateUsernameFormat rejects empty, short, reserved defaults, and accepts valid names', () => {
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

test('validateUsername enforces moderation categories and exact Turkish error messages with zero false positives', () => {
  const inappropriateSamples = [
    'amk_krali',
    'o r o s p u',
    's1kt1rGit',
    'y@rr@k10',
    'аmk_kral', // Cyrillic homoglyph 'а'
    'o\u200Brospu', // zero-width bypass
    'p1c99',
    'g0t_34',
    'ananisik',
    'nazi_tr',
    'gebert99',
    'f.u.c.k.you',
    'b1tchPlz',
    '31ceken',
    'otuzbirci',
    'Kral31sj',
    '<script>alert(1)</script>',
    '123456',
    'f*u*c*k*10',
    'o_r_s_p_u',
    'p.u.s.t',
    'k4lt4k',
    'g3rz3k',
    'b0ll0cks',
    'n4z1_tr',
  ];

  for (const bad of inappropriateSamples) {
    const res = validateUsername(bad);
    assert.equal(res.ok, false, `Expected "${bad}" to be rejected`);
    assert.equal(res.error, USERNAME_INAPPROPRIATE_ERROR);
  }

  const systemImpersonationSamples = [
    'Admin',
    'Administrator',
    'Yönetici',
    'Moderator',
    'Moderatör',
    'Support',
    'Destek',
    'System',
    'Sistem',
    'Official',
    'Resmî',
    'Developer',
    'Geliştirici',
    'Owner',
    'GameMaster',
    'Bot',
    'Kurucu',
    'Yetkili',
    'admin123',
    'Mod_TR',
    'y0net1c1_1',
    'ResmiDestek',
    'Futbol_Bot',
  ];

  for (const sysName of systemImpersonationSamples) {
    const res = validateUsername(sysName);
    assert.equal(res.ok, false, `Expected reserved name "${sysName}" to be rejected`);
    assert.equal(res.error, USERNAME_SYSTEM_RESERVED_ERROR);
  }

  const unsupportedCharSamples = ['Kral⚽10', 'Ali#Can', 'Test\u200BUser'];
  for (const raw of unsupportedCharSamples) {
    const res = validateUsername(raw);
    assert.equal(res.ok, false, `Expected unsupported char "${raw}" to be rejected`);
    assert.equal(res.error, USERNAME_UNSUPPORTED_CHAR_ERROR);
  }

  // Innocent Turkish names, football clubs, "ModricFan", harmless numbers & dates MUST be allowed
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
    'FutbolKralı',
    'GolMakinesi',
    'Şampiyon1905',
    'Kartal1903',
    'Kanarya1907',
    'Fırtına1967',
    'MessiFan',
    'Ronaldo7',
    'Kaleci34',
    'Beşiktaşlı',
    'Galatasaraylı',
    'Fenerbahçeli',
    'Trabzonsporlu',
    'Kasımpaşalı',
    'ModricFan',
    'Hasan1905',
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
  assert.equal(isLegacyFlaggedUsername('Admin_TR'), true);
  assert.equal(sanitizePublicDisplayName('amk_kral', 'user_99'), masked);
});

test('AccountStore enforces case-insensitive uniqueness, self-preservation on icon edit, and server bypass rejection', () => {
  const store = new AccountStore(null);
  const prog1 = { ...createInitialProgression(), coins: 2500, weeklyPoints: 400 };
  const prog2 = { ...createInitialProgression(), coins: 900, weeklyPoints: 100 };

  const first = store.registerOrUpdate({
    accountId: 'acc_u1',
    profile: { id: 'acc_u1', name: 'FutbolKralı', avatar: 'ball', score: 0, favoriteClubId: 'galatasaray' },
    progression: prog1,
  });
  assert.equal(first.ok, true);

  // Exact/case-insensitive/Turkish-normalized collision is rejected with USERNAME_TAKEN_ERROR
  const collide = store.registerOrUpdate({
    accountId: 'acc_u2',
    profile: { id: 'acc_u2', name: 'futbolkrali', avatar: 'boot', score: 0 },
    progression: prog2,
  });
  assert.equal(collide.ok, false);
  if (!collide.ok) {
    assert.equal(collide.status, 409);
    assert.equal(collide.reason, USERNAME_TAKEN_ERROR);
  }

  // Server bypass attempt using reserved/profane name cannot register or sync over clean profile
  const spoofAdmin = store.registerOrUpdate({
    accountId: 'acc_u2',
    profile: { id: 'acc_u2', name: 'Admin_TR', avatar: 'shield', score: 0 },
    progression: prog2,
  });
  assert.equal(spoofAdmin.ok, false);

  // User 1 editing ONLY their icon keeps their own username smoothly
  const keepOwn = store.registerOrUpdate({
    accountId: 'acc_u1',
    profile: { id: 'acc_u1', name: 'FutbolKralı', avatar: 'glove', score: 0, favoriteClubId: 'fenerbahce' },
    progression: prog1,
  });
  assert.equal(keepOwn.ok, true);
  if (keepOwn.ok) {
    assert.equal(keepOwn.account.profile.avatar, 'glove');
    assert.equal(keepOwn.account.progression.coins, 2500);
  }

  // User 1 renames to GolMakinesi -> releases old key for User 2 and retains coins/accountId
  const renamed = store.registerOrUpdate({
    accountId: 'acc_u1',
    profile: { id: 'acc_u1', name: 'GolMakinesi', avatar: 'glove', score: 0 },
    progression: prog1,
  });
  assert.equal(renamed.ok, true);
  const reclaimed = store.registerOrUpdate({
    accountId: 'acc_u2',
    profile: { id: 'acc_u2', name: 'FutbolKralı', avatar: 'boot', score: 0 },
    progression: prog2,
  });
  assert.equal(reclaimed.ok, true);
});

test('auditAndMigrateLegacyUsernames supports dry-run and preserves coins, points, purchases, and IDs with zero data loss', () => {
  const cleanProg = {
    ...createInitialProgression(),
    coins: 5400,
    weeklyPoints: 1200,
    totalPoints: 8900,
    matchesPlayed: 42,
    unlockedGiftIds: ['adFree', 'gift_title_legend'],
  };
  const legacyRecords = [
    {
      accountId: 'acc_bad_1',
      username: 'amk_krali',
      usernameKey: 'amk_krali',
      recoveryCode: '321-ABCD-2345',
      googleUid: 'uid_bad_1',
      verifiedPurchases: [
        {
          productId: 'remove_ads',
          itemId: 'adFree',
          purchaseToken: 'tok_legit_1',
          verifiedAt: 1_700_000_000_000,
          source: 'google_play' as const,
        },
      ],
      profile: { id: 'acc_bad_1', name: 'amk_krali', avatar: 'trophy', score: 0, favoriteClubId: 'besiktas' },
      progression: cleanProg,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    },
    {
      accountId: 'acc_admin_2',
      username: 'Yönetici',
      usernameKey: 'yonetici',
      recoveryCode: '321-WXYZ-6789',
      profile: { id: 'acc_admin_2', name: 'Yönetici', avatar: 'shield', score: 0 },
      progression: createInitialProgression(),
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    },
    {
      accountId: 'acc_clean_3',
      username: 'Kartal1903',
      usernameKey: 'kartal1903',
      recoveryCode: '321-LMNP-4567',
      profile: { id: 'acc_clean_3', name: 'Kartal1903', avatar: 'ball', score: 0 },
      progression: createInitialProgression(),
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    },
  ];

  // Dry run leaves input records untouched
  const dry = auditAndMigrateLegacyUsernames(legacyRecords, { dryRun: true, now: 1_700_000_999_000 });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.flaggedCount, 2);
  assert.equal(dry.migratedCount, 0);
  assert.equal(dry.records[0].username, 'amk_krali');

  // Execute migration
  const migrated = auditAndMigrateLegacyUsernames(legacyRecords, { dryRun: false, now: 1_700_000_999_000 });
  assert.equal(migrated.migratedCount, 2);
  assert.equal(migrated.unchangedCount, 1);

  const migratedBad = migrated.records[0];
  assert.match(migratedBad.profile.name, /^Oyuncu\d{5}$/);
  assert.equal(migratedBad.accountId, 'acc_bad_1');
  assert.equal(migratedBad.googleUid, 'uid_bad_1');
  assert.equal(migratedBad.recoveryCode, '321-ABCD-2345');
  assert.equal(migratedBad.progression.coins, 5400);
  assert.equal(migratedBad.progression.weeklyPoints, 1200);
  assert.equal(migratedBad.progression.matchesPlayed, 42);
  assert.equal(migratedBad.verifiedPurchases?.length, 1);
  assert.deepEqual(migratedBad.progression.unlockedGiftIds, ['adFree', 'gift_title_legend']);
  assert.equal(migratedBad.profile.avatar, 'trophy');
  assert.equal(migratedBad.profile.favoriteClubId, 'besiktas');

  // Clean record stays identical
  assert.equal(migrated.records[2].profile.name, 'Kartal1903');
  assert.notEqual(migrated.records[0].usernameKey, migrated.records[1].usernameKey);
});

test('generateUniqueUsernameSuggestions avoids taken keys and returns 3 distinct clean options', () => {
  const taken = new Set(['kralforvet', 'kralforvet_10', 'kralforvet_99']);
  const suggestions = generateUniqueUsernameSuggestions('KralForvet', taken, 3);
  assert.equal(suggestions.length, 3);
  for (const s of suggestions) {
    assert.equal(taken.has(normalizeUsernameKey(s)), false);
    assert.equal(validateUsernameFormat(s).ok, true);
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
