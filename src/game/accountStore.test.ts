import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AccountStore } from './accountStore';
import { createInitialProgression } from './retentionEngine';

test('AccountStore enforces unique usernames case-insensitively across accounts and suggests alternatives', () => {
  const store = new AccountStore(null);
  const prog1 = createInitialProgression('u_1');
  const prog2 = createInitialProgression('u_2');

  const r1 = store.registerOrUpdate({
    accountId: 'u_1',
    profile: { id: 'u_1', name: 'ŞampiyonArda', avatar: '⚽', score: 0 },
    progression: prog1,
  });
  assert.equal(r1.ok, true);
  if (!r1.ok) throw new Error('expected ok');
  assert.match(r1.account.recoveryCode, /^321-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // Second player tries same name with different case/diacritics
  const dup = store.registerOrUpdate({
    accountId: 'u_2',
    profile: { id: 'u_2', name: 'sampiyonarda', avatar: '🔥', score: 0 },
    progression: prog2,
  });
  assert.equal(dup.ok, false);
  if (dup.ok) throw new Error('expected conflict');
  assert.equal(dup.status, 409);
  assert.ok(dup.suggestions && dup.suggestions.length === 3);

  // Same user can rename and release their old name
  const rename = store.registerOrUpdate({
    accountId: 'u_1',
    profile: { id: 'u_1', name: 'YeniKaptan10', avatar: '⚽', score: 0 },
    progression: prog1,
  });
  assert.equal(rename.ok, true);

  // Now second player CAN claim the released name
  const nowAvailable = store.registerOrUpdate({
    accountId: 'u_2',
    profile: { id: 'u_2', name: 'ŞampiyonArda', avatar: '🔥', score: 0 },
    progression: prog2,
  });
  assert.equal(nowAvailable.ok, true);
});

test('AccountStore persists accounts to disk across restarts and recovers them by recoveryCode', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '321fb-acc-'));
  const filePath = path.join(tmpDir, 'accounts.json');

  try {
    const store1 = new AccountStore(filePath);
    const prog = { ...createInitialProgression('u_persist'), coins: 2450, totalPoints: 890 };
    const created = store1.registerOrUpdate({
      accountId: 'u_persist',
      profile: {
        id: 'u_persist',
        name: 'KalıcıHesap99',
        avatar: 'pp:arda_guler',
        score: 0,
        favoriteClubId: 'fenerbahce',
      },
      progression: prog,
    });
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('expected ok');
    const code = created.account.recoveryCode;

    // Simulate full server restart with a brand new AccountStore instance
    const store2 = new AccountStore(filePath);
    const check = store2.checkUsername('kalicihesap99', 'other_user');
    assert.equal(check.available, false);

    const recovered = store2.recoverByCode(code);
    assert.equal(recovered.ok, true);
    if (!recovered.ok) throw new Error('expected recovery');
    assert.equal(recovered.account.accountId, 'u_persist');
    assert.equal(recovered.account.username, 'KalıcıHesap99');
    assert.equal(recovered.account.progression.coins, 2450);
    assert.equal(recovered.account.profile.favoriteClubId, 'fenerbahce');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('AccountStore findPublicProfile and searchPublicProfiles return public stats with zero PII or coins', () => {
  const store = new AccountStore(null);
  const prog = {
    ...createInitialProgression('u_pub_1'),
    friendCode: 'FC9191',
    coins: 9999,
    weeklyPoints: 740,
    totalPoints: 2150,
    matchesPlayed: 14,
    wins: 10,
    losses: 4,
    winStreak: 3,
    bestWinStreak: 5,
    totalCorrectAnswers: 42,
    totalWrongAttempts: 8,
    fastestAnswerSec: 1.9,
    clutchAnswers: 6,
    equippedTitle: 'Orta Saha Maestrosu',
    equippedFrame: 'gold',
    unlockedGiftIds: ['gift_title_legend'],
  };

  store.registerOrUpdate({
    accountId: 'u_pub_1',
    googleUid: 'google_secret_uid_123',
    profile: {
      id: 'u_pub_1',
      name: 'GolAvcısı10',
      avatar: 'pp:victor_osimhen',
      score: 0,
      favoriteClubId: 'galatasaray',
    },
    progression: prog,
  });

  const byId = store.findPublicProfile('u_pub_1');
  assert.ok(byId);
  assert.equal(byId.name, 'GolAvcısı10');
  assert.equal(byId.friendCode, 'FC9191');
  assert.equal(byId.favoriteClubId, 'galatasaray');
  assert.equal(byId.matchesPlayed, 14);
  assert.equal(byId.wins, 10);
  assert.equal(byId.fastestAnswerSec, 1.9);
  assert.equal(byId.hasCrown, true);

  // Strictly no PII or wallet coins exposed
  const rawObj = byId as unknown as Record<string, unknown>;
  assert.equal('recoveryCode' in rawObj, false);
  assert.equal('googleUid' in rawObj, false);
  assert.equal('email' in rawObj, false);
  assert.equal('coins' in rawObj, false);

  // Lookup by usernameKey (case/diacritic-insensitive) and friendCode
  const byName = store.findPublicProfile('golavcisi10');
  assert.equal(byName?.id, 'u_pub_1');

  const byCode = store.findPublicProfile('fc9191');
  assert.equal(byCode?.id, 'u_pub_1');

  const searchRes = store.searchPublicProfiles('golavci', 10);
  assert.equal(searchRes.length, 1);
  assert.equal(searchRes[0].id, 'u_pub_1');
});
