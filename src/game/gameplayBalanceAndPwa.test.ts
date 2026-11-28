import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BOT_CONFIG,
  computeHumanizedBotDelayMs,
  decideBotRoundAction,
  getBotRoundPlan,
} from './botEngine';
import {
  DIFFICULTY_DISTRIBUTIONS,
  classifyPairingDifficulty,
  classifyQuestionDifficulty,
  hasHouseholdStarAnswer,
  isHouseholdStarPlayer,
} from './questionDifficulty';
import { generateMinigameRounds } from './minigameEngine';
import { createSeededRng } from './realtimeSyncHelpers';
import {
  acceptIncomingFriendRequest,
  createInitialProgression,
  getPendingIncomingRequestCount,
  isBotFriendRecord,
  receiveIncomingFriendRequest,
  sanitizeBotFriendsProgression,
} from './retentionEngine';
import { getAppVersionMetadata } from './appVersion';
import { ROSTER_DATA_VERSION } from './rosterVersion';
import {
  createPwaUpdateController,
  shouldShowPwaUpdateBanner,
} from '../services/pwaUpdateService';
import type { FriendRequestEntry, MinigameType } from './types';

test('exact target difficulty distributions across Çırak, Şampiyon, Efsane, and Online 1v1', () => {
  assert.deepEqual(DIFFICULTY_DISTRIBUTIONS.bot_easy, { easy: 1.0, medium: 0.0, hard: 0.0 });
  assert.deepEqual(DIFFICULTY_DISTRIBUTIONS.bot_medium, { easy: 0.70, medium: 0.30, hard: 0.0 });
  assert.deepEqual(DIFFICULTY_DISTRIBUTIONS.bot_hard, { easy: 0.40, medium: 0.45, hard: 0.15 });
  assert.deepEqual(DIFFICULTY_DISTRIBUTIONS.online, { easy: 0.70, medium: 0.25, hard: 0.05 });
});

test('Çırak (easy) questions across ALL 4 modes strictly guarantee well-known household footballers', () => {
  const modes: MinigameType[] = ['two_clubs', 'career', 'country_club', 'xox'];
  const rng = createSeededRng(20261126);

  for (const mode of modes) {
    const rounds = generateMinigameRounds(mode, 25, [], { profile: 'bot_easy', rng });
    assert.equal(rounds.length, 25);

    for (const r of rounds) {
      assert.equal(classifyQuestionDifficulty(r), 'easy', `${mode} Çırak round must be 100% easy`);
      if (mode === 'two_clubs' && r.pairing) {
        assert.equal(
          hasHouseholdStarAnswer(r.pairing.validPlayerIds),
          true,
          `Two Clubs easy pair ${r.pairing.id} must have >=1 household star`
        );
      } else if (mode === 'career' && r.career) {
        assert.equal(
          isHouseholdStarPlayer(r.career.playerId),
          true,
          `Career easy player ${r.career.playerId} must be a widely known household star`
        );
      } else if (mode === 'country_club' && r.countryClub) {
        assert.equal(
          hasHouseholdStarAnswer(r.countryClub.validPlayerIds),
          true,
          `Country+Club easy item ${r.countryClub.id} must have >=1 household star`
        );
      } else if (mode === 'xox' && r.xoxBoard) {
        const cells = Object.values(r.xoxBoard.cellValidPlayerIds);
        assert.equal(cells.length, 9);
        for (const [cellKey, ids] of Object.entries(r.xoxBoard.cellValidPlayerIds)) {
          assert.equal(
            hasHouseholdStarAnswer(ids),
            true,
            `XOX easy board ${r.xoxBoard.id} cell ${cellKey} must have >=1 household star`
          );
        }
      }
    }
  }

  // Many obscure valid answers alone MUST NOT make a question easy!
  const obscurePairing = {
    id: 'test_obscure_pair',
    club1Id: 'galatasaray',
    club2Id: 'rayo_vallecano',
    validPlayerIds: ['obscure_1', 'obscure_2', 'obscure_3', 'obscure_4', 'obscure_5', 'obscure_6', 'obscure_7'],
  };
  assert.notEqual(classifyPairingDifficulty(obscurePairing), 'easy');
});

test('Çırak bot real-match simulation stays within 8-14s response window, ~35% accuracy, with both wrong guesses and timeouts', () => {
  const rng = createSeededRng(778899);
  const plan = getBotRoundPlan('easy', 'two_clubs', 8, 'easy');
  assert.ok(plan.minDelayMs >= 8000 && plan.maxDelayMs <= 14000);

  let correct = 0;
  let wrong = 0;
  let pass = 0;
  let minDelay = Infinity;
  let maxDelay = 0;
  let totalDelay = 0;
  const N = 1200;

  for (let i = 0; i < N; i += 1) {
    const delay = computeHumanizedBotDelayMs(plan, rng, 15000);
    minDelay = Math.min(minDelay, delay);
    maxDelay = Math.max(maxDelay, delay);
    totalDelay += delay;

    const outcome = decideBotRoundAction(plan, rng);
    if (outcome === 'correct') correct += 1;
    else if (outcome === 'wrong') wrong += 1;
    else pass += 1;
  }

  const acc = correct / N;
  assert.ok(Math.abs(acc - BOT_CONFIG.easy.accuracy) <= 0.04, `Çırak accuracy ${acc} should be ~0.35`);
  assert.ok(wrong > 150, 'Çırak should sometimes give wrong answers');
  assert.ok(pass > 150, 'Çırak should sometimes fail to answer (timeout/pass)');
  assert.ok(minDelay >= 8000, `Çırak minDelay ${minDelay}ms should be >= 8000ms`);
  assert.ok(maxDelay <= 14650, `Çırak maxDelay ${maxDelay}ms should fit within 15s round`);
  assert.ok(totalDelay / N >= 9500 && totalDelay / N <= 12500);
});

test('legacy & live bot friend requests are stripped from storage, sync, and red badge count while preserving real friends', () => {
  const legacyBotReqByName: FriendRequestEntry = {
    id: 'fr_legacy_cirak',
    fromPlayerId: 'legacy_999',
    fromFriendCode: 'FC1234',
    fromName: 'Çırak Bot',
    fromAvatar: '🤖',
    toPlayerId: 'u_me',
    toName: 'Ben',
    status: 'pending',
    createdAt: Date.now() - 100_000,
  };
  const legacyBotReqById: FriendRequestEntry = {
    id: 'fr_legacy_bot_id',
    fromPlayerId: 'bot_tr_2',
    fromFriendCode: 'BOT002',
    fromName: 'Şampiyon Bot',
    fromAvatar: '🤖',
    toPlayerId: 'u_me',
    toName: 'Ben',
    status: 'pending',
    createdAt: Date.now() - 90_000,
  };
  const realReq: FriendRequestEntry = {
    id: 'fr_real_ahmet',
    fromPlayerId: 'u_ahmet',
    fromFriendCode: 'AHM777',
    fromName: 'Ahmet10',
    fromAvatar: 'avatar_classic_ball',
    toPlayerId: 'u_me',
    toName: 'Ben',
    status: 'pending',
    createdAt: Date.now() - 10_000,
  };

  assert.equal(isBotFriendRecord(legacyBotReqByName), true);
  assert.equal(isBotFriendRecord(legacyBotReqById), true);
  assert.equal(isBotFriendRecord(realReq), false);
  // Real player whose name contains "robot" must NOT be false-positived
  assert.equal(isBotFriendRecord({ id: 'u_robot', friendCode: 'RBT123', name: 'RobotAli', avatar: '⚽' }), false);

  const base = createInitialProgression('u_me');
  const polluted = {
    ...base,
    friends: [
      {
        id: 'u_real_friend',
        friendCode: 'KER123',
        name: 'KeremGS',
        avatar: '⚽',
        weeklyPoints: 300,
        totalPoints: 1200,
        statusText: 'Çevrim içi',
        isOnline: true,
      },
      {
        id: 'bot_tr_1',
        friendCode: 'BOT001',
        name: 'Çırak Bot',
        avatar: '🤖',
        weeklyPoints: 100,
        totalPoints: 100,
        statusText: 'Bot',
        isOnline: false,
      },
    ],
    incomingFriendRequests: [legacyBotReqByName, legacyBotReqById, realReq],
    outgoingFriendRequests: [
      {
        ...legacyBotReqById,
        id: 'out_bot',
        fromPlayerId: 'u_me',
        fromName: 'Ben',
        toPlayerId: 'bot_tr_2',
        toName: 'Şampiyon Bot',
      },
    ],
  };

  // Even BEFORE sanitizing, red badge count MUST exclude bot requests (only 1 real request counted!)
  assert.equal(getPendingIncomingRequestCount(polluted), 1);

  // Attempting to accept a legacy bot request MUST fail and clean it up
  const badAccept = acceptIncomingFriendRequest(polluted, 'fr_legacy_cirak');
  assert.equal(badAccept.ok, false);
  assert.equal(badAccept.progression.incomingFriendRequests?.length, 1);

  // Sanitization removes all bots while preserving real friends and real requests 100%
  const sanitized = sanitizeBotFriendsProgression(polluted);
  assert.deepEqual(sanitized.friends.map((f) => f.id), ['u_real_friend']);
  assert.deepEqual(sanitized.incomingFriendRequests?.map((r) => r.id), ['fr_real_ahmet']);
  assert.equal(sanitized.outgoingFriendRequests?.length, 0);

  // New incoming bot friend request is ignored completely
  const afterBotIncoming = receiveIncomingFriendRequest(sanitized, legacyBotReqByName);
  assert.equal(afterBotIncoming.incomingFriendRequests?.length, 1);
});

test('Settings version metadata and iOS Safari PWA Service Worker update controller protect active matches and user data', () => {
  const meta = getAppVersionMetadata();
  assert.equal(meta.appVersion, '1.1.2');
  assert.equal(meta.rosterVersion, ROSTER_DATA_VERSION);
  assert.ok(meta.buildCommit.length > 0);

  // Verify public/sw.js structure: version stamp placeholder, SKIP_WAITING, network-first HTML, scoped cache delete
  const swSource = fs.readFileSync(path.resolve(process.cwd(), 'public', 'sw.js'), 'utf8');
  assert.ok(swSource.includes('__SW_VERSION__'));
  assert.ok(swSource.includes("event.data.type === 'SKIP_WAITING'"));
  assert.ok(swSource.includes("cache: 'no-store'"));
  assert.ok(swSource.includes('321futbol-pwa-'));
  assert.equal(swSource.includes('localStorage.clear'), false);

  let reloadCount = 0;
  let postedMsg: unknown = null;
  const ctrl = createPwaUpdateController({
    reloadPage: () => {
      reloadCount += 1;
    },
    scheduleFallbackReload: () => {},
  });

  ctrl.attachRegistration(
    {
      waiting: {
        postMessage(msg) {
          postedMsg = msg;
        },
      },
      installing: null,
      update: async () => {},
      addEventListener: () => {},
    },
    true
  );

  assert.equal(ctrl.getState().updateAvailable, true);

  // Banner MUST NOT show during active match; applyUpdate MUST refuse mid-match!
  assert.equal(shouldShowPwaUpdateBanner({ updateAvailable: true, isInActiveMatch: true }), false);
  assert.equal(ctrl.applyUpdate({ isInActiveMatch: true }), false);
  assert.equal(reloadCount, 0);
  assert.equal(postedMsg, null);

  // Outside match: banner shows, user taps "Güncelle" -> SKIP_WAITING sent -> controllerchange reloads cleanly once!
  assert.equal(shouldShowPwaUpdateBanner({ updateAvailable: true, isInActiveMatch: false }), true);
  assert.equal(ctrl.applyUpdate({ isInActiveMatch: false }), true);
  assert.deepEqual(postedMsg, { type: 'SKIP_WAITING' });
  ctrl.notifyControllerChanged();
  ctrl.notifyControllerChanged(); // idempotent
  assert.equal(reloadCount, 1);
});
