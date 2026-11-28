import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { CLUBS, MATCH_PAIRINGS, PLAYERS, PLAYERS_LIST } from './database';
import { resolveClubBadgeMeta } from './clubBadgeCatalog';
import { NEW_12_CLUB_IDS, sortAndCleanCareerHistory } from './expandedQuestionPools';
import { generateMinigameRounds, validateMinigameAnswer } from './minigameEngine';
import { CAREER_CHALLENGES, COUNTRY_CLUB_CHALLENGES, XOX_BOARDS } from './minigamesData';
import { DEFAULT_PLAYER_PHOTO, PLAYER_ASSETS } from './playerAssets';
import { ensureExpandedRosterSync } from './rosterNodeLoader';
import {
  PLAYER_ID_ALIASES,
  QUESTION_ELIGIBLE_PLAYER_IDS,
  ROSTER_DATA_VERSION,
  getRosterHydrationStatus,
  isCareerChronologyVerified,
  isPlayerQuestionEligible,
  resolveCanonicalPlayerId,
} from './rosterLoader';
import { getSearchIndexSize, searchPlayersForAutocomplete } from './silhouetteEngine';
import { ServerMatchLedger } from './serverSecurity';
import { isAdsEnabled, isRealMoneyIapEnabled } from './monetizationFlags';

const YOUTH_POLLUTION_RE =
  /\b(u-?1[4-9]|u-?2[0-3]|under-?\d{2}|youth|reserves?|academy|juniors?|women|ladies|feminin|femenino|castilla|b team|jong)\b/i;

test('25k compact roster hydrates 24,959 unique verified players & 345 clubs while preserving original IDs and procedural SVG portraits', () => {
  const originalBaseIds = new Set(PLAYERS_LIST.slice(0, 3049).map((p) => p.id));
  const originalClubIds = new Set(Object.keys(CLUBS).slice(0, 133));

  const status = ensureExpandedRosterSync();
  assert.equal(status.hydrated, true);
  assert.equal(status.version, ROSTER_DATA_VERSION);
  assert.equal(ROSTER_DATA_VERSION, '2026.11.26-v345-r2');
  assert.equal(PLAYERS_LIST.length, 24959, `Expected exactly 24,959 unique players after 41 verified merges, got ${PLAYERS_LIST.length}`);
  assert.equal(status.totalPlayers, 24959);

  const uniquePlayerIds = new Set(PLAYERS_LIST.map((p) => p.id));
  assert.equal(uniquePlayerIds.size, 24959, 'Expected all 24,959 player IDs to be unique');
  for (const origId of originalBaseIds) {
    assert.ok(PLAYERS[origId], `Missing preserved base player ID: ${origId}`);
  }
  for (const cid of originalClubIds) {
    assert.ok(CLUBS[cid], `Missing preserved base club ID: ${cid}`);
  }
  assert.equal(Object.keys(CLUBS).length, 345, 'Expected 333 preserved + 12 newly verified clubs = 345');

  // Verify every club including the 12 newly added ones has valid procedural SVG badge metadata
  for (const [cid, club] of Object.entries(CLUBS)) {
    const badge = resolveClubBadgeMeta(cid, club.name, club);
    assert.ok(badge.monogram.length >= 1, `Missing monogram for club ${cid}`);
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(badge.primaryColor), `Invalid primary color on club ${cid}`);
  }

  for (const newClubId of NEW_12_CLUB_IDS) {
    assert.ok(CLUBS[newClubId], `Missing newly approved club: ${newClubId}`);
    const seniorLinked = PLAYERS_LIST.filter(
      (p) =>
        p.clubId === newClubId ||
        (p.careerHistory || []).some((h) => !h.isYouth && h.clubId === newClubId)
    );
    assert.ok(seniorLinked.length >= 50, `Expected >=50 verified players for ${newClubId}, got ${seniorLinked.length}`);
  }

  // Verify unused real press photos (public/players) remain removed and procedural SVG tokens are used
  const playersDir = path.resolve(process.cwd(), 'public', 'players');
  assert.equal(fs.existsSync(playersDir), false, 'Unused real press photos folder public/players must be removed');
  assert.equal(DEFAULT_PLAYER_PHOTO, 'svg-avatar:default');

  // Verify career repairs & Nov 2026 transfers were applied strictly cleanly
  assert.ok(status.verifiedCareerRepairsApplied >= 2000, 'Expected >= 2,000 verified career repair records');
  assert.ok(status.verifiedTransfersApplied >= 100, 'Expected >= 100 verified live-checked transfer updates');
  assert.ok(status.questionEligibleCount >= 3049 && status.questionEligibleCount < 12000);
  assert.equal(getSearchIndexSize(), 24959);

  // Verify newly added players have clean senior clubs without unmarked youth pollution in careerHistory
  const newPlayers = PLAYERS_LIST.slice(3049);
  for (const np of newPlayers) {
    assert.ok(PLAYER_ASSETS[np.id], `Missing PLAYER_ASSETS entry for ${np.id}`);
    assert.equal(PLAYER_ASSETS[np.id].photoUrl, 'svg-avatar:default');
    assert.ok(Array.isArray(np.careerHistory) && np.careerHistory.length >= 1);
    for (const h of np.careerHistory || []) {
      if (!h.isYouth) {
        assert.ok(!YOUTH_POLLUTION_RE.test(h.club), `Unexpected unmarked youth club on new player ${np.id}: ${h.club}`);
      }
    }
  }
});

test('all 24,959 players expand valid answers across 4 modes while preserving depth and chronology', () => {
  ensureExpandedRosterSync();

  const obscurePlayer = PLAYERS_LIST.slice(3049).find((p) => !isPlayerQuestionEligible(p.id));
  assert.ok(obscurePlayer, 'Expected answer-pool-only obscure players to exist');
  assert.ok(
    !CAREER_CHALLENGES.some((c) => c.playerId === obscurePlayer.id),
    'Obscure answer-pool-only player must not appear in CAREER_CHALLENGES'
  );

  const twoBaseClubsNewPlayer = PLAYERS_LIST.slice(3049).find((p) => {
    const seniorCids = Array.from(
      new Set((p.careerHistory || []).filter((h) => !h.isYouth && h.clubId).map((h) => h.clubId!))
    );
    return seniorCids.length >= 2;
  });
  assert.ok(twoBaseClubsNewPlayer, 'Expected newly added player spanning >=2 base clubs');

  const seniorCids = Array.from(
    new Set((twoBaseClubsNewPlayer.careerHistory || []).filter((h) => !h.isYouth && h.clubId).map((h) => h.clubId!))
  );
  const matchingPairing = MATCH_PAIRINGS.find(
    (m) =>
      (m.club1Id === seniorCids[0] && m.club2Id === seniorCids[1]) ||
      (m.club1Id === seniorCids[1] && m.club2Id === seniorCids[0]) ||
      (seniorCids.includes(m.club1Id) && seniorCids.includes(m.club2Id))
  );
  assert.ok(matchingPairing, 'Expected an existing MATCH_PAIRING matching a new multi-club player');
  assert.ok(
    matchingPairing.validPlayerIds.includes(twoBaseClubsNewPlayer.id),
    `Expected ${twoBaseClubsNewPlayer.id} to be valid answer on ${matchingPairing.id}`
  );

  // Every question across all 4 pools must have valid answers and no auto-pairing with a NEW_12 club below 3 players
  assert.ok(MATCH_PAIRINGS.every((m) => m.validPlayerIds.length >= 1));
  for (const m of MATCH_PAIRINGS) {
    if (m.id.startsWith('auto_pair_') && (NEW_12_CLUB_IDS.has(m.club1Id) || NEW_12_CLUB_IDS.has(m.club2Id))) {
      assert.ok(m.validPlayerIds.length >= 3, `Auto pairing with new club ${m.id} must have >=3 valid players`);
    }
  }
  assert.ok(COUNTRY_CLUB_CHALLENGES.every((cc) => cc.validPlayerIds.length >= 1));
  assert.ok(
    XOX_BOARDS.every((b) => Object.values(b.cellValidPlayerIds).every((ids) => ids.length >= 1))
  );

  // Every Career Challenge in CAREER_CHALLENGES must have monotonically ordered steps
  for (const ch of CAREER_CHALLENGES) {
    let prev = -1;
    for (const s of ch.steps) {
      const m = s.years.match(/^(\d{4})/);
      assert.ok(m, `Missing leading year on career step ${ch.playerId}: ${s.clubName} (${s.years})`);
      const sy = Number(m[1]);
      assert.ok(sy >= prev, `Unsorted career challenge ${ch.playerId}: ${prev} -> ${sy}`);
      prev = sy;
    }
  }

  assert.ok(COUNTRY_CLUB_CHALLENGES.some((cc) => cc.validPlayerIds.some((id) => !originalBasePlayer(id))));
  assert.ok(
    XOX_BOARDS.some((b) =>
      Object.values(b.cellValidPlayerIds).some((ids) => ids.some((id) => !originalBasePlayer(id)))
    )
  );

  function originalBasePlayer(id: string): boolean {
    return PLAYERS_LIST.slice(0, 3049).some((p) => p.id === id) && QUESTION_ELIGIBLE_PLAYER_IDS.has(id);
  }
});

test('career chronology sorter preserves same-year order without guessing, and all Nov 2026 updates, loans, nationalities, and duplicate aliases are clean', () => {
  ensureExpandedRosterSync();

  // 1. Chronology unit test: differing start years sort ascending; equal start years stay untouched
  const sorted = sortAndCleanCareerHistory([
    { club: 'Club C', years: '2024–2026', countryFlag: '🇹🇷' },
    { club: 'Club B1 (Same Year First)', years: '2021–2022', countryFlag: '🇩🇪' },
    { club: 'Club B2 (Same Year Second)', years: '2021–2023', countryFlag: '🇪🇸' },
    { club: 'Club A', years: '2018-20', countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  ]);
  assert.deepEqual(
    sorted.map((s) => `${s.club}:${s.years}`),
    [
      'Club A:2018–2020',
      'Club B1 (Same Year First):2021–2022',
      'Club B2 (Same Year Second):2021–2023',
      'Club C:2024–2026',
    ]
  );
  assert.equal(isCareerChronologyVerified(sorted), true);
  assert.equal(
    isCareerChronologyVerified([
      { club: 'Broken', years: '2019–2010', countryFlag: '🇮🇹' },
      { club: 'Next', years: '2015–2017', countryFlag: '🇮🇹' },
    ]),
    false
  );

  // 2. Nationality & flag sanity: 0 Uluslararası and 0 bare 2-letter ASCII flag codes
  for (const p of PLAYERS_LIST) {
    assert.notEqual(p.nationality, 'Uluslararası', `Unresolved nationality on ${p.id}`);
    const flag = p.flag || '';
    assert.ok(!/^[a-z-]{2,6}$/i.test(flag), `Invalid ASCII flag code on ${p.id}: ${flag}`);
  }

  // 3. Verified duplicate merging preserves canonical resolution while keeping distinct homonyms separate
  assert.equal(resolveCanonicalPlayerId('jamal_musiala_q96072055'), 'jamal_musiala');
  assert.ok(PLAYER_ID_ALIASES['gabriel'] === 'gabriel_paulista');
  assert.ok(!PLAYERS['jamal_musiala_q96072055']);
  assert.ok(PLAYERS['luis_suarez'] && PLAYERS['luis_suarez_q28736721'], 'Uruguay & Colombia Luis Suárez homonyms must both stay distinct');

  // 4. Verified 26 Nov 2026 transfers, loan separation, free agents, verified retirements & 345-club linking
  assert.equal(PLAYERS['cenk_tosun'].clubId, 'kasimpasa');
  assert.equal(PLAYERS['dusan_tadic'].clubId, 'nec_nijmegen');
  assert.equal(PLAYERS['vincent_aboubakar'].clubId, 'bodrum_fk');
  assert.equal(PLAYERS['tijjani_reijnders'].clubId, 'al_qadsiah');
  assert.equal(PLAYERS['hakim_ziyech'].clubId, 'botafogo_fr');
  assert.equal(PLAYERS['cristiano_ronaldo'].clubId, 'al_nassr');
  assert.equal(PLAYERS['lionel_messi'].clubId, 'inter_miami');
  assert.equal(PLAYERS['son_heung_min'].clubId, 'los_angeles_fc');
  assert.equal(PLAYERS['gabriel_paulista'].clubId, 'sc_corinthians_paulista');
  assert.equal(PLAYERS['fred'].clubName, 'Clube Atlético Mineiro');
  assert.equal(PLAYERS['fred'].clubId, 'clube_atletico_mineiro', 'Stale Fenerbahçe clubId must be replaced by Clube Atlético Mineiro');
  assert.equal(PLAYERS['emre_mor'].clubName, 'Kulüpsüz');
  assert.equal(PLAYERS['emre_mor'].clubId, undefined);
  assert.equal(PLAYERS['mauro_icardi'].clubName, 'Kulüpsüz');
  assert.equal(PLAYERS['mauro_icardi'].clubId, undefined);
  assert.equal(PLAYERS['altay_bayindir'].clubName, 'Celta Vigo (Kiralık)');
  assert.equal(PLAYERS['ronald_araujo'].clubName, 'Liverpool FC (Kiralık)');
  assert.match(PLAYERS['ciro_immobile'].clubName || '', /\(Emekli\)$/);
  assert.match(PLAYERS['ivan_rakitic'].clubName || '', /\(Emekli\)$/);
  // Unverified veterans age >= 45 MUST NOT be auto-marked retired by age alone (e.g. active GK Fábio age 46)
  assert.equal(PLAYERS['fabio_q677923'].clubName, 'Fluminense FC');

  // 5. Google Play compliance gates stay off
  assert.equal(isAdsEnabled(), false);
  assert.equal(isRealMoneyIapEnabled(), false);
});

test('25k autocomplete search & ServerMatchLedger answer validation run fast and match client/server roster version', () => {
  const status = ensureExpandedRosterSync();
  const rawJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'public', 'data', 'roster25k.v2.json'), 'utf8')
  ) as { version: string };
  assert.equal(status.version, rawJson.version);
  assert.equal(getRosterHydrationStatus().version, ROSTER_DATA_VERSION);

  const t0 = performance.now();
  const sampleQueries = ['osimhen', 'messi', 'mbappe', 'musiala', 'dybala', 'asensio', 'kadioglu', 'ronaldo'];
  for (let i = 0; i < 1000; i += 1) {
    const q = sampleQueries[i % sampleQueries.length];
    const hits = searchPlayersForAutocomplete(q, [], 6);
    assert.ok(hits.length >= 1, `Expected autocomplete hits for ${q}`);
  }
  const elapsedMs = performance.now() - t0;
  assert.ok(elapsedMs < 1500, `1000 autocomplete searches across 25k should take < 1500ms, got ${elapsedMs.toFixed(1)}ms`);

  // Popularity ranking verification across the full 24,959-player hydrated roster
  const ronaldo25k = searchPlayersForAutocomplete('ronaldo', [], 6);
  assert.equal(ronaldo25k[0]?.id, 'cristiano_ronaldo', `Expected Cristiano Ronaldo #1 in 25k roster, got ${ronaldo25k.map((p) => p.name).join(', ')}`);
  assert.equal(ronaldo25k[1]?.id, 'ronaldo_nazario', `Expected Ronaldo Nazário #2 in 25k roster, got ${ronaldo25k.map((p) => p.name).join(', ')}`);

  const ronald25k = searchPlayersForAutocomplete('ronald', [], 6);
  assert.equal(ronald25k[0]?.id, 'cristiano_ronaldo');
  assert.ok(
    ronald25k.slice(0, 3).some((p) => p.id === 'ronaldo_nazario'),
    `Expected Ronaldo Nazário in top 3 for "ronald", got ${ronald25k.map((p) => p.name).join(', ')}`
  );

  const me25k = searchPlayersForAutocomplete('me', [], 6);
  assert.equal(me25k[0]?.id, 'lionel_messi', `Expected Lionel Messi #1 for "me" in 25k roster, got ${me25k.map((p) => p.name).join(', ')}`);

  const arda25k = searchPlayersForAutocomplete('arda', [], 6);
  assert.ok(
    arda25k.slice(0, 2).some((p) => p.id === 'arda_guler') &&
      arda25k.slice(0, 2).some((p) => p.id === 'arda_turan'),
    `Expected Arda Güler & Arda Turan in top 2 for "arda" in 25k roster, got ${arda25k.map((p) => p.name).join(', ')}`
  );

  const sa25k = searchPlayersForAutocomplete('sa', [], 6);
  assert.ok(
    sa25k.slice(0, 3).some((p) => p.id === 'mohamed_salah'),
    `Expected Mohamed Salah in top 3 for "sa" in 25k roster, got ${sa25k.map((p) => p.name).join(', ')}`
  );

  const gsFb = MATCH_PAIRINGS.find((p) => p.id === 'gs_fb')!;
  const roundRes = validateMinigameAnswer({ minigameType: 'two_clubs', pairing: gsFb }, 'Michy Batshuayi');
  assert.equal(roundRes.isValid, true);

  const ledger = new ServerMatchLedger();
  const session = ledger.issueSession({
    accountId: 'test_acc_25k',
    minigameType: 'two_clubs',
    mode: 'online_match',
    roundIds: [gsFb.id],
  });
  const srvRes = ledger.submitVerifiedAnswer({
    sessionId: session.sessionId,
    accountId: 'test_acc_25k',
    roundIndex: 0,
    answer: 'Michy Batshuayi',
  });
  assert.equal(srvRes.ok, true);
  assert.equal(srvRes.valid, true);

  for (const mode of ['two_clubs', 'xox', 'career', 'country_club'] as const) {
    const rounds = generateMinigameRounds(mode, 10, [], { profile: 'online' });
    assert.equal(rounds.length, 10);
  }
});
