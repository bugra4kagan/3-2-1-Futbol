import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_FORCE_UPDATE_ENABLED,
  ROSTER_DATA_VERSION,
  ROSTER_VERSION_MISMATCH_ERROR,
  areRosterVersionsCompatible,
  isValidRosterVersion,
} from './rosterVersion';
import {
  applyRoomJoin,
  applyRoomRematch,
  applyRoomRematchResponse,
  createRoomRecord,
  selectMatchmakingCandidates,
  validateRematchRosterCompatibility,
  type MatchmakingQueueCandidate,
} from './roomEngine';
import {
  ServerMatchLedger,
  type MatchSessionCloudAdapter,
  type ServerMatchSession,
} from './serverSecurity';
import {
  AccountStore,
  applyVerifiedMatchRewardToProgression,
  type PersistentAccountRecord,
} from './accountStore';
import { PLAYERS } from './database';
import { createInitialProgression } from './retentionEngine';
import type { MinigameType, PlayerProfile } from './types';

const NOW = 1_760_000_000_000;

function makePlayer(id: string, name: string): PlayerProfile {
  return { id, name, avatar: 'avatar_classic_ball', score: 0 };
}

test('rosterVersion validation & forced-update safety flag', () => {
  assert.equal(AUTO_FORCE_UPDATE_ENABLED, false);
  assert.equal(
    ROSTER_VERSION_MISMATCH_ERROR,
    'Rakibinle farklı oyun sürümleri kullanıyorsunuz. Çevrimiçi oynamak için oyunu güncelle.'
  );
  assert.equal(isValidRosterVersion(ROSTER_DATA_VERSION), true);
  assert.equal(isValidRosterVersion('1.0.9-legacy'), true);
  assert.equal(isValidRosterVersion(''), false);
  assert.equal(isValidRosterVersion('ab'), false);
  assert.equal(isValidRosterVersion('bad version with spaces'), false);
  assert.equal(isValidRosterVersion(null), false);
  assert.equal(areRosterVersionsCompatible(ROSTER_DATA_VERSION, ROSTER_DATA_VERSION), true);
  assert.equal(areRosterVersionsCompatible(ROSTER_DATA_VERSION, '1.0.9-legacy'), false);
  assert.equal(areRosterVersionsCompatible(ROSTER_DATA_VERSION, undefined), false);
  assert.equal(areRosterVersionsCompatible('', ''), false);
});

test('1v1 matchmaking blocks old vs new rosterVersion and matches identical new versions', () => {
  const entries: MatchmakingQueueCandidate[] = [
    {
      playerKey: 'p_new_1',
      uid: 'uid_new_1',
      minigameType: 'two_clubs',
      rosterVersion: ROSTER_DATA_VERSION,
      profile: { id: 'p_new_1', name: 'YeniSurumBen', avatar: '⚽' },
      joinedAtMs: NOW - 1000,
      expiresAtMs: NOW + 60_000,
      matchedRoomCode: null,
    },
    {
      playerKey: 'p_old_1',
      uid: 'uid_old_1',
      minigameType: 'two_clubs',
      rosterVersion: '1.0.9-legacy',
      profile: { id: 'p_old_1', name: 'EskiSurum', avatar: '⚽' },
      joinedAtMs: NOW - 3000,
      expiresAtMs: NOW + 60_000,
      matchedRoomCode: null,
    },
    {
      playerKey: 'p_missing_ver',
      uid: 'uid_missing_ver',
      minigameType: 'two_clubs',
      profile: { id: 'p_missing_ver', name: 'Surumsuz', avatar: '⚽' },
      joinedAtMs: NOW - 2500,
      expiresAtMs: NOW + 60_000,
      matchedRoomCode: null,
    },
    {
      playerKey: 'p_new_2',
      uid: 'uid_new_2',
      minigameType: 'two_clubs',
      rosterVersion: ROSTER_DATA_VERSION,
      profile: { id: 'p_new_2', name: 'YeniSurumRakip', avatar: '⚽' },
      joinedAtMs: NOW - 1500,
      expiresAtMs: NOW + 60_000,
      matchedRoomCode: null,
    },
  ];

  // New client searching: must match ONLY p_new_2, never p_old_1 or p_missing_ver
  const newMatches = selectMatchmakingCandidates({
    entries,
    myKey: 'p_new_1',
    myUid: 'uid_new_1',
    myProfileId: 'p_new_1',
    minigameType: 'two_clubs',
    myRosterVersion: ROSTER_DATA_VERSION,
    now: NOW,
  });
  assert.deepEqual(
    newMatches.map((m) => m.playerKey),
    ['p_new_2']
  );

  // Old client searching against new-only pool: zero matches
  const oldVsNew = selectMatchmakingCandidates({
    entries: [
      {
        playerKey: 'p_old_searcher',
        uid: 'uid_old_searcher',
        minigameType: 'two_clubs',
        rosterVersion: '1.0.9-legacy',
        profile: { id: 'p_old_searcher', name: 'EskiArayan', avatar: '⚽' },
        joinedAtMs: NOW - 1000,
        expiresAtMs: NOW + 60_000,
        matchedRoomCode: null,
      },
      entries[3],
    ],
    myKey: 'p_old_searcher',
    myUid: 'uid_old_searcher',
    myProfileId: 'p_old_searcher',
    minigameType: 'two_clubs',
    myRosterVersion: '1.0.9-legacy',
    now: NOW,
  });
  assert.deepEqual(oldVsNew, []);

  // Invalid/empty caller version: zero matches
  const invalidCaller = selectMatchmakingCandidates({
    entries,
    myKey: 'p_new_1',
    myUid: 'uid_new_1',
    myProfileId: 'p_new_1',
    minigameType: 'two_clubs',
    myRosterVersion: '',
    now: NOW,
  });
  assert.deepEqual(invalidCaller, []);
});

test('private room join rejects version mismatch, missing version, or legacy room without version', () => {
  const room = createRoomRecord({
    code: 'VER234',
    source: 'private',
    minigameType: 'career',
    host: makePlayer('p_host', 'HostOyuncu'),
    hostUid: 'uid_host',
    now: NOW,
    seed: 101,
    rosterVersion: ROSTER_DATA_VERSION,
  });
  assert.equal(room.rosterVersion, ROSTER_DATA_VERSION);
  assert.equal(room.guestRosterVersion, null);

  // Old guest rejected with exact Turkish message
  const oldGuest = applyRoomJoin(room, makePlayer('p_old', 'EskiMisafir'), 'uid_old', NOW + 500, '1.0.9-legacy');
  assert.equal(oldGuest.ok, false);
  if (!oldGuest.ok) {
    assert.equal(oldGuest.error, ROSTER_VERSION_MISMATCH_ERROR);
  }

  // Missing/invalid guest version rejected
  const missingGuest = applyRoomJoin(room, makePlayer('p_null', 'BosMisafir'), 'uid_null', NOW + 600, '');
  assert.equal(missingGuest.ok, false);
  if (!missingGuest.ok) {
    assert.equal(missingGuest.error, ROSTER_VERSION_MISMATCH_ERROR);
  }

  // Legacy room missing rosterVersion rejected even for new guest
  const legacyRoom = { ...room, rosterVersion: undefined };
  const legacyJoin = applyRoomJoin(
    legacyRoom,
    makePlayer('p_new', 'YeniMisafir'),
    'uid_new',
    NOW + 700,
    ROSTER_DATA_VERSION
  );
  assert.equal(legacyJoin.ok, false);
  if (!legacyJoin.ok) {
    assert.equal(legacyJoin.error, ROSTER_VERSION_MISMATCH_ERROR);
  }

  // Compatible guest succeeds and stamps guestRosterVersion
  const okJoin = applyRoomJoin(
    room,
    makePlayer('p_ok', 'UyumluMisafir'),
    'uid_ok',
    NOW + 800,
    ROSTER_DATA_VERSION
  );
  assert.equal(okJoin.ok, true);
  if (okJoin.ok) {
    assert.equal(okJoin.room.guestRosterVersion, ROSTER_DATA_VERSION);
    assert.equal(okJoin.room.state, 'countdown');
  }
});

test('rematch enforces rosterVersion compatibility on request and accept while allowing decline', () => {
  const room = createRoomRecord({
    code: 'REM567',
    source: 'matchmaking',
    minigameType: 'country_club',
    host: makePlayer('p_host', 'Host'),
    hostUid: 'uid_host',
    guest: makePlayer('p_guest', 'Guest'),
    guestUid: 'uid_guest',
    now: NOW,
    seed: 202,
    rosterVersion: ROSTER_DATA_VERSION,
  });
  const endedRoom = { ...room, state: 'game_over' as const };

  // Mismatched caller cannot request rematch
  const badCheck = validateRematchRosterCompatibility(endedRoom, '1.0.8-old');
  assert.equal(badCheck.ok, false);
  if (!badCheck.ok) assert.equal(badCheck.error, ROSTER_VERSION_MISMATCH_ERROR);

  const rejectedReq = applyRoomRematch(endedRoom, 'p_host', NOW + 5000, 303, '1.0.8-old');
  assert.equal(rejectedReq, null);

  // Compatible host requests rematch
  const offered = applyRoomRematch(endedRoom, 'p_host', NOW + 5000, 303, ROSTER_DATA_VERSION);
  assert.ok(offered);
  assert.equal(offered.rematchOffer?.rosterVersion, ROSTER_DATA_VERSION);

  // Mismatched guest cannot accept
  const badAccept = applyRoomRematchResponse(offered, 'p_guest', 'accept', NOW + 6000, 404, '1.0.8-old');
  assert.equal(badAccept, null);

  // Compatible guest accepts -> new matchSeq starts with synced roundIndex & rosterVersion
  const accepted = applyRoomRematchResponse(offered, 'p_guest', 'accept', NOW + 6000, 404, ROSTER_DATA_VERSION);
  assert.ok(accepted);
  assert.equal(accepted.matchSeq, 2);
  assert.equal(accepted.roundIndex, 0);
  assert.equal(accepted.currentRoundIndex, 0);
  assert.equal(accepted.rosterVersion, ROSTER_DATA_VERSION);
  assert.equal(accepted.guestRosterVersion, ROSTER_DATA_VERSION);

  // Decline still works cleanly
  const declined = applyRoomRematchResponse(offered, 'p_guest', 'decline', NOW + 6000, 404, '1.0.8-old');
  assert.ok(declined);
  assert.equal(declined.rematchOffer?.status, 'declined');
});

test('ServerMatchLedger enforces strict server-verified opponent sessions across all 4 modes and atomic double-claim protection', async () => {
  const claimedKeys = new Set<string>();
  const persistedSessions = new Map<string, ServerMatchSession>();

  const mockCloudAdapter: MatchSessionCloudAdapter = {
    async loadActiveSessions() {
      return Array.from(persistedSessions.values()).map((s) => structuredClone(s));
    },
    async saveSession(session) {
      persistedSessions.set(session.sessionId, structuredClone(session));
    },
    async getSessionById(sessionId) {
      const s = persistedSessions.get(sessionId);
      return s ? structuredClone(s) : null;
    },
    async loadRoomSessions(roomCode, matchSeq) {
      const out: ServerMatchSession[] = [];
      for (const s of persistedSessions.values()) {
        if (s && s.roomCode === roomCode && (s.matchSeq || 1) === matchSeq) {
          out.push(structuredClone(s));
        }
      }
      return out;
    },
    async claimRewardAtomic(params) {
      // Simulate async network latency so concurrent calls race
      await new Promise((resolve) => setTimeout(resolve, 15));
      if (claimedKeys.has(params.claimKey)) {
        return { ok: false, duplicate: true };
      }
      claimedKeys.add(params.claimKey);
      return { ok: true };
    },
  };

  const modes: MinigameType[] = ['two_clubs', 'xox', 'career', 'country_club'];

  for (const mode of modes) {
    const ledger = new ServerMatchLedger();
    ledger.setCloudAdapter(mockCloudAdapter);
    const roomCode = `M${mode.slice(0, 3).toUpperCase()}99`;

    const hostSession = ledger.issueSession({
      accountId: `acc_host_${mode}`,
      minigameType: mode,
      mode: 'online_room',
      roomCode,
      matchSeq: 1,
      rosterVersion: ROSTER_DATA_VERSION,
      now: NOW - 15_000,
    });
    const guestSession = ledger.issueSession({
      accountId: `acc_guest_${mode}`,
      minigameType: mode,
      mode: 'online_room',
      roomCode,
      matchSeq: 1,
      rosterVersion: ROSTER_DATA_VERSION,
      now: NOW - 15_000,
    });

    // Helper to extract valid scoring submission(s) for each mode
    const resolveName = (playerId: string) => PLAYERS[playerId]?.name || playerId;
    const submitWinningRound = (targetLedger: ServerMatchLedger, session: ServerMatchSession, roundIndex: number) => {
      const r = session.rounds[roundIndex];
      assert.ok(r, `Round ${roundIndex} missing for ${mode}`);
      if (mode === 'two_clubs') {
        const ans = targetLedger.submitVerifiedAnswer({
          sessionId: session.sessionId,
          accountId: session.accountId,
          roundIndex,
          answer: resolveName(r.pairing!.validPlayerIds[0]),
        });
        assert.equal(ans.ok, true);
        if (ans.ok) assert.equal(ans.valid, true);
        return;
      }
      if (mode === 'career') {
        const ans = targetLedger.submitVerifiedAnswer({
          sessionId: session.sessionId,
          accountId: session.accountId,
          roundIndex,
          answer: resolveName(r.career!.playerId),
        });
        assert.equal(ans.ok, true);
        if (ans.ok) assert.equal(ans.valid, true);
        return;
      }
      if (mode === 'country_club') {
        const ans = targetLedger.submitVerifiedAnswer({
          sessionId: session.sessionId,
          accountId: session.accountId,
          roundIndex,
          answer: resolveName(r.countryClub!.validPlayerIds[0]),
        });
        assert.equal(ans.ok, true);
        if (ans.ok) assert.equal(ans.valid, true);
        return;
      }
      // xox: submit 3 distinct valid cells to score the XOX round
      const entries = Object.entries(r.xoxBoard!.cellValidPlayerIds).filter(([, ids]) => ids.length > 0);
      assert.ok(entries.length >= 3, 'XOX board must have at least 3 valid cells');
      for (const [cellKey, validIds] of entries.slice(0, 3)) {
        const [rowStr, colStr] = cellKey.split('_');
        const ans = targetLedger.submitVerifiedAnswer({
          sessionId: session.sessionId,
          accountId: session.accountId,
          roundIndex,
          answer: resolveName(validIds[0]),
          cellPos: { row: Number(rowStr), col: Number(colStr) },
        });
        assert.equal(ans.ok, true);
        if (ans.ok) assert.equal(ans.valid, true);
      }
    };

    // Host scores 2 verified rounds; guest has NOT submitted any yet
    for (let i = 0; i < 2; i++) {
      submitWinningRound(ledger, hostSession, i);
    }

    // 1) Online reward MUST FAIL if serverVerifiedOpponentScore is null (no client score fallback!)
    const noOppSessionRes = await ledger.consumeVerifiedMatchSessionAsync({
      sessionId: hostSession.sessionId,
      accountId: hostSession.accountId,
      hasMultiplier2x: false,
      serverVerifiedOpponentScore: null,
      requireServerOpponentVerification: true,
      roomClaimKey: `${roomCode}:1:${hostSession.accountId}`,
      minDurationMs: 1000,
      now: NOW,
    });
    assert.equal(noOppSessionRes.ok, false);

    // Guest scores 1 verified round (server now has verified session for opponent)
    submitWinningRound(ledger, guestSession, 0);
    await ledger.flushCloudWrites();

    const oppScore = await ledger.findOpponentVerifiedScoreAsync(roomCode, 1, hostSession.accountId);
    assert.equal(oppScore, 1);

    // 2) Concurrent double-claim race: strictly ONE succeeds, second MUST fail atomically!
    const claimKey = `${roomCode}:1:${hostSession.accountId}`;
    const [r1, r2] = await Promise.all([
      ledger.consumeVerifiedMatchSessionAsync({
        sessionId: hostSession.sessionId,
        accountId: hostSession.accountId,
        hasMultiplier2x: false,
        serverVerifiedOpponentScore: oppScore,
        requireServerOpponentVerification: true,
        roomClaimKey: claimKey,
        minDurationMs: 1000,
        now: NOW,
      }),
      ledger.consumeVerifiedMatchSessionAsync({
        sessionId: hostSession.sessionId,
        accountId: hostSession.accountId,
        hasMultiplier2x: false,
        serverVerifiedOpponentScore: oppScore,
        requireServerOpponentVerification: true,
        roomClaimKey: claimKey,
        minDurationMs: 1000,
        now: NOW,
      }),
    ]);

    const successes = [r1, r2].filter((r) => r.ok);
    const failures = [r1, r2].filter((r) => !r.ok);
    assert.equal(successes.length, 1, `${mode}: concurrent double-claim must grant reward exactly once`);
    assert.equal(failures.length, 1, `${mode}: second concurrent claim must be rejected`);
    if (successes[0] && successes[0].ok) {
      assert.equal(successes[0].won, true);
      assert.equal(successes[0].verifiedScore, 2);
      assert.ok(successes[0].coinsAwarded > 0);
      assert.ok(successes[0].pointsAwarded > 0);
    }

    // 3) Replay after completion using a fresh ledger instance backed by the same cloud adapter MUST fail
    const restartedLedger = new ServerMatchLedger();
    restartedLedger.setCloudAdapter(mockCloudAdapter);
    const replaySession = restartedLedger.issueSession({
      accountId: hostSession.accountId,
      minigameType: mode,
      mode: 'online_room',
      roomCode,
      matchSeq: 1,
      rosterVersion: ROSTER_DATA_VERSION,
      now: NOW - 15_000,
    });
    submitWinningRound(restartedLedger, replaySession, 0);
    const replayAttempt = await restartedLedger.consumeVerifiedMatchSessionAsync({
      sessionId: replaySession.sessionId,
      accountId: hostSession.accountId,
      hasMultiplier2x: false,
      serverVerifiedOpponentScore: 0,
      requireServerOpponentVerification: true,
      roomClaimKey: claimKey,
      minDurationMs: 1000,
      now: NOW,
    });
    assert.equal(replayAttempt.ok, false);
  }
});

test('existing accounts, coins, league points, and purchases remain intact across hardening flow', async () => {
  const store = new AccountStore(null);
  const prog = createInitialProgression('acc_existing_1');
  prog.coins = 3250;
  prog.weeklyPoints = 640;
  prog.totalPoints = 4120;
  prog.adFree = true;
  prog.unlockedGiftIds = ['avatar_classic_ball', 'store_ad_free'];

  const created = store.registerOrUpdate({
    accountId: 'acc_existing_1',
    googleUid: 'uid_existing_1',
    profile: { id: 'acc_existing_1', name: 'EskiKaptan', avatar: 'avatar_classic_ball', score: 0 },
    progression: prog,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const purchase = await store.applyVerifiedPurchaseAsync({
    accountId: 'acc_existing_1',
    itemId: 'bundle_vip_adfree_frame',
    productId: 'futbol_vip_bundle',
    purchaseToken: 'gp_existing_preserve_token_123456',
    orderId: 'GPA.EXISTING-1',
    coinGrant: 500,
    grantAdFree: true,
    vipFrame: true,
  });
  assert.equal(purchase.ok, true);

  const resolved = await store.resolveByAccountIdAsync('acc_existing_1');
  assert.ok(resolved);
  assert.equal(resolved.progression.coins, 3750);
  assert.equal(resolved.progression.weeklyPoints, 640);
  assert.equal(resolved.progression.totalPoints, 4120);
  assert.equal(resolved.progression.adFree, true);
});

test('transient atomic transaction failure never burns match session or loses coins/points, and retry credits atomically once', async () => {
  const store = new AccountStore(null);
  const initProg = createInitialProgression('acc_retry_1');
  const reg = store.registerOrUpdate({
    accountId: 'acc_retry_1',
    googleUid: 'uid_retry_1',
    profile: { id: 'acc_retry_1', name: 'RetryKaptan', avatar: 'avatar_classic_ball', score: 0 },
    progression: initProg,
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;

  let transientFailOnce = true;
  const claimed = new Set<string>();
  let cloudAccount: PersistentAccountRecord = structuredClone(reg.account);

  const ledger = new ServerMatchLedger();
  ledger.setCloudAdapter({
    async loadActiveSessions() {
      return [];
    },
    async getSessionById() {
      return null;
    },
    async saveSession() {},
    async claimRewardAtomic(params) {
      // 1st call simulates transient Firestore transaction abort (zero writes committed)
      if (transientFailOnce) {
        transientFailOnce = false;
        return { ok: false, duplicate: false };
      }
      if (claimed.has(params.claimKey)) {
        return { ok: false, duplicate: true };
      }
      claimed.add(params.claimKey);
      const nextProg = applyVerifiedMatchRewardToProgression(cloudAccount.progression, {
        coinsAwarded: params.coinsAwarded,
        pointsAwarded: params.pointsAwarded,
        won: params.won,
      });
      cloudAccount = { ...cloudAccount, progression: nextProg, updatedAt: Date.now() };
      return { ok: true, duplicate: false, creditedAccount: structuredClone(cloudAccount) };
    },
  });

  const session = ledger.issueSession({
    accountId: 'acc_retry_1',
    minigameType: 'two_clubs',
    mode: 'online_room',
    roomCode: 'RTY123',
    matchSeq: 1,
    rosterVersion: ROSTER_DATA_VERSION,
    now: NOW - 12_000,
  });
  const validId = session.rounds[0]!.pairing!.validPlayerIds[0];
  ledger.submitVerifiedAnswer({
    sessionId: session.sessionId,
    accountId: 'acc_retry_1',
    roundIndex: 0,
    answer: PLAYERS[validId]?.name || validId,
  });

  // 1st attempt fails transiently -> retryable: true, session NOT burned, zero coins/points lost!
  const firstTry = await ledger.consumeVerifiedMatchSessionAsync({
    sessionId: session.sessionId,
    accountId: 'acc_retry_1',
    hasMultiplier2x: false,
    serverVerifiedOpponentScore: 0,
    requireServerOpponentVerification: true,
    roomClaimKey: 'RTY123:1:acc_retry_1',
    fallbackAccountRecord: reg.account,
    requireAccountCredit: true,
    minDurationMs: 1000,
    now: NOW,
  });
  assert.equal(firstTry.ok, false);
  if (!firstTry.ok) {
    assert.equal(firstTry.retryable, true);
    assert.equal(firstTry.duplicate, false);
  }
  assert.equal(cloudAccount.progression.coins, initProg.coins);

  // 2nd attempt (retry) succeeds atomically and returns the credited account snapshot!
  const secondTry = await ledger.consumeVerifiedMatchSessionAsync({
    sessionId: session.sessionId,
    accountId: 'acc_retry_1',
    hasMultiplier2x: false,
    serverVerifiedOpponentScore: 0,
    requireServerOpponentVerification: true,
    roomClaimKey: 'RTY123:1:acc_retry_1',
    fallbackAccountRecord: reg.account,
    requireAccountCredit: true,
    minDurationMs: 1000,
    now: NOW,
  });
  assert.equal(secondTry.ok, true);
  if (!secondTry.ok) return;
  assert.ok(secondTry.creditedAccount);
  store.applyAuthoritativeAccountSnapshot(secondTry.creditedAccount);

  const synced = await store.resolveByAccountIdAsync('acc_retry_1');
  assert.ok(synced);
  assert.equal(synced.progression.coins, initProg.coins + secondTry.coinsAwarded);
  assert.equal(synced.progression.weeklyPoints, initProg.weeklyPoints + secondTry.pointsAwarded);

  // 3rd attempt MUST be rejected as duplicate with zero double-credit!
  const thirdTry = await ledger.consumeVerifiedMatchSessionAsync({
    sessionId: session.sessionId,
    accountId: 'acc_retry_1',
    hasMultiplier2x: false,
    serverVerifiedOpponentScore: 0,
    requireServerOpponentVerification: true,
    roomClaimKey: 'RTY123:1:acc_retry_1',
    fallbackAccountRecord: synced,
    requireAccountCredit: true,
    minDurationMs: 1000,
    now: NOW,
  });
  assert.equal(thirdTry.ok, false);
  assert.equal(cloudAccount.progression.coins, initProg.coins + secondTry.coinsAwarded);
});

test('server crash immediately AFTER atomic transaction commit (before HTTP response) preserves coins/points and prevents double reward on restart', async () => {
  const claimed = new Set<string>();
  const cloudSessions = new Map<string, ServerMatchSession>();
  const initProg = createInitialProgression('acc_crash_post');
  const cloudAccounts = new Map<string, PersistentAccountRecord>();

  const storeBeforeCrash = new AccountStore(null);
  const reg = storeBeforeCrash.registerOrUpdate({
    accountId: 'acc_crash_post',
    googleUid: 'uid_crash_post',
    profile: { id: 'acc_crash_post', name: 'CrashTest', avatar: 'avatar_classic_ball', score: 0 },
    progression: initProg,
  });
  assert.equal(reg.ok, true);
  if (!reg.ok) return;
  cloudAccounts.set(reg.account.accountId, structuredClone(reg.account));

  const sharedMatchAdapter: MatchSessionCloudAdapter = {
    async loadActiveSessions() {
      return Array.from(cloudSessions.values()).map((s) => structuredClone(s));
    },
    async getSessionById(id) {
      const s = cloudSessions.get(id);
      return s ? structuredClone(s) : null;
    },
    async saveSession(s) {
      cloudSessions.set(s.sessionId, structuredClone(s));
    },
    async claimRewardAtomic(params) {
      if (claimed.has(params.claimKey)) {
        return { ok: false, duplicate: true };
      }
      const existing = cloudAccounts.get(params.accountId);
      if (!existing) return { ok: false, duplicate: false };
      const nextProg = applyVerifiedMatchRewardToProgression(existing.progression, {
        coinsAwarded: params.coinsAwarded,
        pointsAwarded: params.pointsAwarded,
        won: params.won,
      });
      const updated = { ...existing, progression: nextProg, updatedAt: Date.now() };
      cloudAccounts.set(params.accountId, structuredClone(updated));
      claimed.add(params.claimKey);
      const sess = cloudSessions.get(params.sessionId);
      if (sess) sess.completed = true;
      return { ok: true, duplicate: false, creditedAccount: structuredClone(updated) };
    },
  };

  const ledgerBeforeCrash = new ServerMatchLedger();
  ledgerBeforeCrash.setCloudAdapter(sharedMatchAdapter);
  const session = ledgerBeforeCrash.issueSession({
    accountId: 'acc_crash_post',
    minigameType: 'two_clubs',
    mode: 'online_room',
    roomCode: 'CRSH99',
    matchSeq: 1,
    rosterVersion: ROSTER_DATA_VERSION,
    now: NOW - 10_000,
  });
  const validId = session.rounds[0]!.pairing!.validPlayerIds[0];
  ledgerBeforeCrash.submitVerifiedAnswer({
    sessionId: session.sessionId,
    accountId: 'acc_crash_post',
    roundIndex: 0,
    answer: PLAYERS[validId]?.name || validId,
  });
  await ledgerBeforeCrash.flushCloudWrites();

  // Atomic transaction commits -> SIMULATE IMMEDIATE PROCESS CRASH (never call storeBeforeCrash.applyAuthoritativeAccountSnapshot or send HTTP response!)
  const committed = await ledgerBeforeCrash.consumeVerifiedMatchSessionAsync({
    sessionId: session.sessionId,
    accountId: 'acc_crash_post',
    hasMultiplier2x: false,
    serverVerifiedOpponentScore: 0,
    requireServerOpponentVerification: true,
    roomClaimKey: 'CRSH99:1:acc_crash_post',
    requireAccountCredit: true,
    minDurationMs: 1000,
    now: NOW,
  });
  assert.equal(committed.ok, true);
  if (!committed.ok) return;

  // --- FULL SERVER RESTART (empty RAM) ---
  const storeAfterRestart = new AccountStore(null);
  storeAfterRestart.setCloudAdapter({
    loadAccounts: async () => Array.from(cloudAccounts.values()).map((a) => structuredClone(a)),
    getById: async (id) => {
      const a = cloudAccounts.get(id);
      return a ? structuredClone(a) : null;
    },
    getByRecoveryCode: async () => null,
    getByGoogleUid: async () => null,
    saveAccount: async (rec) => {
      cloudAccounts.set(rec.accountId, structuredClone(rec));
    },
    deleteAccount: async () => true,
  });
  await storeAfterRestart.hydrateFromCloud();

  // 1) Zero reward loss: restarted server ALREADY has exact credited coins & league points!
  const recovered = await storeAfterRestart.resolveByAccountIdAsync('acc_crash_post');
  assert.ok(recovered);
  assert.equal(recovered.progression.coins, initProg.coins + committed.coinsAwarded);
  assert.equal(recovered.progression.weeklyPoints, initProg.weeklyPoints + committed.pointsAwarded);
  assert.equal(recovered.progression.totalPoints, initProg.totalPoints + committed.pointsAwarded);

  // 2) Zero double reward: client didn't receive HTTP response before crash and retries -> MUST be rejected as duplicate!
  const ledgerAfterRestart = new ServerMatchLedger();
  ledgerAfterRestart.setCloudAdapter(sharedMatchAdapter);
  const retrySession = ledgerAfterRestart.issueSession({
    accountId: 'acc_crash_post',
    minigameType: 'two_clubs',
    mode: 'online_room',
    roomCode: 'CRSH99',
    matchSeq: 1,
    rosterVersion: ROSTER_DATA_VERSION,
    now: NOW - 10_000,
  });
  const retryPid = retrySession.rounds[0]!.pairing!.validPlayerIds[0];
  ledgerAfterRestart.submitVerifiedAnswer({
    sessionId: retrySession.sessionId,
    accountId: 'acc_crash_post',
    roundIndex: 0,
    answer: PLAYERS[retryPid]?.name || retryPid,
  });
  const retryAfterCrash = await ledgerAfterRestart.consumeVerifiedMatchSessionAsync({
    sessionId: retrySession.sessionId,
    accountId: 'acc_crash_post',
    hasMultiplier2x: false,
    serverVerifiedOpponentScore: 0,
    requireServerOpponentVerification: true,
    roomClaimKey: 'CRSH99:1:acc_crash_post',
    requireAccountCredit: true,
    minDurationMs: 1000,
    now: NOW,
  });
  assert.equal(retryAfterCrash.ok, false);
  if (!retryAfterCrash.ok) assert.equal(retryAfterCrash.duplicate, true);
  assert.equal(cloudAccounts.get('acc_crash_post')!.progression.coins, initProg.coins + committed.coinsAwarded);
});
