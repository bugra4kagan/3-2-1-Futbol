import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { CLUBS, MATCH_PAIRINGS, PLAYERS, PLAYERS_LIST } from './database';
import { resolveClubBadgeMeta } from './clubBadgeCatalog';
import { generateMinigameRounds, validateMinigameAnswer } from './minigameEngine';
import { CAREER_CHALLENGES, COUNTRY_CLUB_CHALLENGES, XOX_BOARDS } from './minigamesData';
import { DEFAULT_PLAYER_PHOTO, PLAYER_ASSETS } from './playerAssets';
import { ensureExpandedRosterSync } from './rosterNodeLoader';
import {
  QUESTION_ELIGIBLE_PLAYER_IDS,
  ROSTER_DATA_VERSION,
  getRosterHydrationStatus,
  isPlayerQuestionEligible,
} from './rosterLoader';
import { getSearchIndexSize, searchPlayersForAutocomplete } from './silhouetteEngine';
import { ServerMatchLedger } from './serverSecurity';

const YOUTH_POLLUTION_RE =
  /\b(u-?1[4-9]|u-?2[0-3]|under-?\d{2}|youth|reserves?|academy|juniors?|women|ladies|feminin|femenino|castilla|b team|jong)\b/i;

test('25k compact roster hydrates 25,000 unique verified players & 333 clubs while preserving original IDs and WebP-only portraits', () => {
  const originalBaseIds = new Set(PLAYERS_LIST.slice(0, 3049).map((p) => p.id));
  const originalClubIds = new Set(Object.keys(CLUBS).slice(0, 133));

  const status = ensureExpandedRosterSync();
  assert.equal(status.hydrated, true);
  assert.equal(status.version, ROSTER_DATA_VERSION);
  assert.equal(PLAYERS_LIST.length, 25000, `Expected exactly 25,000 players, got ${PLAYERS_LIST.length}`);
  assert.equal(status.totalPlayers, 25000);

  const uniquePlayerIds = new Set(PLAYERS_LIST.map((p) => p.id));
  assert.equal(uniquePlayerIds.size, 25000, 'Expected all 25,000 player IDs to be unique');
  for (const origId of originalBaseIds) {
    assert.ok(PLAYERS[origId], `Missing preserved base player ID: ${origId}`);
  }
  for (const cid of originalClubIds) {
    assert.ok(CLUBS[cid], `Missing preserved base club ID: ${cid}`);
  }
  assert.equal(Object.keys(CLUBS).length, 333, 'Expected 133 preserved + 200 newly curated clubs = 333');

  // Verify every club has valid neutral procedural badge metadata
  for (const [cid, club] of Object.entries(CLUBS)) {
    const badge = resolveClubBadgeMeta(cid, club.name, club);
    assert.ok(badge.monogram.length >= 1, `Missing monogram for club ${cid}`);
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(badge.primaryColor), `Invalid primary color on club ${cid}`);
  }

  // Verify public/players contains ONLY WebP portraits and zero PNG duplicates
  const playersDir = path.resolve(process.cwd(), 'public', 'players');
  const files = fs.readdirSync(playersDir);
  const pngFiles = files.filter((f) => f.toLowerCase().endsWith('.png'));
  const webpFiles = files.filter((f) => f.toLowerCase().endsWith('.webp'));
  assert.equal(pngFiles.length, 0, `Expected 0 PNG files remaining in public/players, found ${pngFiles.length}`);
  assert.equal(webpFiles.length, 256, `Expected 256 WebP files in public/players, found ${webpFiles.length}`);
  assert.equal(DEFAULT_PLAYER_PHOTO, '/players/default.webp');

  // Verify career repairs & recent transfers were applied strictly cleanly
  assert.ok(status.verifiedCareerRepairsApplied >= 1500, 'Expected >= 1,500 verified career repairs');
  assert.ok(status.verifiedTransfersApplied >= 300, 'Expected >= 300 verified transfers');
  assert.ok(status.questionEligibleCount >= 3049 && status.questionEligibleCount < 12000);
  assert.equal(getSearchIndexSize(), 25000);

  // Verify newly added players have clean senior clubs without youth pollution in careerHistory
  const newPlayers = PLAYERS_LIST.slice(3049);
  for (const np of newPlayers) {
    assert.ok(PLAYER_ASSETS[np.id], `Missing PLAYER_ASSETS entry for ${np.id}`);
    assert.equal(PLAYER_ASSETS[np.id].photoUrl, '/players/default.webp');
    assert.ok(Array.isArray(np.careerHistory) && np.careerHistory.length >= 1);
    for (const h of np.careerHistory || []) {
      assert.ok(!YOUTH_POLLUTION_RE.test(h.club), `Unexpected youth club on new player ${np.id}: ${h.club}`);
    }
  }
});

test('all 25,000 players expand valid answers across modes while keeping obscure players out of question prompts', () => {
  ensureExpandedRosterSync();

  // Pick a non-questionEligible obscure new player and confirm exclusion from CAREER_CHALLENGES
  const obscurePlayer = PLAYERS_LIST.slice(3049).find((p) => !isPlayerQuestionEligible(p.id));
  assert.ok(obscurePlayer, 'Expected answer-pool-only obscure players to exist');
  assert.ok(
    !CAREER_CHALLENGES.some((c) => c.playerId === obscurePlayer.id),
    'Obscure answer-pool-only player must not appear in CAREER_CHALLENGES'
  );

  // Confirm newly added player with 2 base clubs enriches Two Clubs validPlayerIds & passes validation
  const twoBaseClubsNewPlayer = PLAYERS_LIST.slice(3049).find((p) => {
    const seniorCids = Array.from(new Set((p.careerHistory || []).filter((h) => !h.isYouth && h.clubId).map((h) => h.clubId!)));
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

  // Validate both Country+Club and XOX validPlayerIds got enriched cleanly
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

test('25k autocomplete search & ServerMatchLedger answer validation run fast and match client/server roster version', () => {
  const status = ensureExpandedRosterSync();
  const rawJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'public', 'data', 'roster25k.v2.json'), 'utf8')
  ) as { version: string };
  assert.equal(status.version, rawJson.version);
  assert.equal(getRosterHydrationStatus().version, ROSTER_DATA_VERSION);

  // Benchmark 1000 autocomplete searches across 25,000 indexed players
  const t0 = performance.now();
  const sampleQueries = ['osimhen', 'messi', 'mbappe', 'musiala', 'dybala', 'asensio', 'kadioglu', 'ronaldo'];
  for (let i = 0; i < 1000; i += 1) {
    const q = sampleQueries[i % sampleQueries.length];
    const hits = searchPlayersForAutocomplete(q, [], 6);
    assert.ok(hits.length >= 1, `Expected autocomplete hits for ${q}`);
  }
  const elapsedMs = performance.now() - t0;
  assert.ok(elapsedMs < 1500, `1000 autocomplete searches across 25k should take < 1500ms, got ${elapsedMs.toFixed(1)}ms`);

  // Verify ServerMatchLedger validates newly added 25k answers identically to client
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

  // Verify round generation works cleanly for online profile across all 4 active modes
  for (const mode of ['two_clubs', 'xox', 'career', 'country_club'] as const) {
    const rounds = generateMinigameRounds(mode, 10, [], { profile: 'online' });
    assert.equal(rounds.length, 10);
  }
});
