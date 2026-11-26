import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_CHALLENGE_COOLDOWN_MS,
  DAILY_CHALLENGE_LOCK_STORAGE_KEY,
  DAILY_CHALLENGE_NEXT_AT_STORAGE_KEY,
  DAILY_CHALLENGE_ROUND_COUNT,
  calculateDailyChallengeReward,
  canPlayDailyChallengeNow,
  formatCountdownHMS,
  formatDailyShareSummary,
  generateDailyChallengeRounds,
  getDailyPuzzleNumber,
  getRemainingDailyChallengeCooldownMs,
  getTimeUntilMidnightCountdown,
  hasPlayedDailyChallengeToday,
  markDailyChallengePlayedToday,
  writeDailyChallengeCooldownEndMs,
} from './dailyChallengeEngine';
import {
  DEFAULT_STARTER_AVATAR,
  FREE_ICON_AVATARS,
  FREE_STARTER_PLAYER_AVATARS,
} from './avatarCatalog';
import { PLAYERS } from './database';
import {
  JOKER_COSTS,
  formatMaskedInitials,
  getInitialsHint,
  getNationalityPositionHint,
} from './jokerEngine';
import { adService, ADMOB_UNIT_IDS } from '../services/adService';

test('daily challenge generates deterministic 3 rounds per date and formats viral share summary', () => {
  const roundsA = generateDailyChallengeRounds('2026-02-11');
  const roundsB = generateDailyChallengeRounds('2026-02-11');
  const roundsNext = generateDailyChallengeRounds('2026-02-12');

  assert.equal(roundsA.length, DAILY_CHALLENGE_ROUND_COUNT);
  assert.deepEqual(roundsA, roundsB);
  assert.equal(roundsA[0].minigameType, 'two_clubs');
  assert.equal(roundsA[1].minigameType, 'career');
  assert.equal(roundsA[2].minigameType, 'country_club');
  assert.notDeepEqual(roundsA, roundsNext);

  const puzzle42 = getDailyPuzzleNumber('2026-02-11');
  assert.equal(puzzle42, 42);

  const shareText = formatDailyShareSummary({
    puzzleNumber: puzzle42,
    correctCount: 3,
    elapsedSec: 18.4,
  });
  assert.equal(
    shareText,
    '3-2-1 Football Challenge • Günlük #42 • 3/3 Doğru • 18.4 sn ⚽🔥'
  );

  const reward3 = calculateDailyChallengeReward(3);
  const reward1 = calculateDailyChallengeReward(1);
  assert.ok(reward3.coins > reward1.coins);
  assert.ok(reward3.points > reward1.points);
});

test('joker engine computes deterministic nationality/position and initials clues cleanly', () => {
  assert.equal(JOKER_COSTS.nationality_position, 100);
  assert.equal(JOKER_COSTS.initials, 150);

  assert.equal(formatMaskedInitials('Kylian Mbappé'), 'K**** M****');
  assert.equal(formatMaskedInitials('Arda Güler'), 'A*** G****');

  const validIds = ['burak_yilmaz', 'emre_belozoglu', 'caner_erkin'];
  const np1 = getNationalityPositionHint(validIds, 'round_1_gs_fb');
  const np2 = getNationalityPositionHint(validIds, 'round_1_gs_fb');
  const init1 = getInitialsHint(validIds, 'round_1_gs_fb');

  assert.ok(np1);
  assert.deepEqual(np1, np2);
  assert.equal(np1.nationality, 'Türkiye');
  assert.ok(init1);
  assert.equal(init1.playerId, np1.playerId);
  assert.ok(init1.maskedName.includes('*'));
});

test('adService exposes AdMob unit IDs and completes simulated rewarded ad cleanly', async () => {
  assert.ok(ADMOB_UNIT_IDS.android.rewardedCoins.startsWith('ca-app-pub-'));
  assert.ok(ADMOB_UNIT_IDS.ios.rewardedRematch.startsWith('ca-app-pub-'));

  // Closed test default blocks rewarded ads and fake coin rewards
  const closedRes = await adService.showRewardedAd('free_coins_250', { durationMs: 5 });
  assert.equal(closedRes.completed, false);
  assert.equal(closedRes.rewardAmountCoins, 0);
  assert.equal(closedRes.provider, 'disabled_closed_test');

  const res = await adService.showRewardedAd('free_coins_250', {
    durationMs: 5,
    overrideAdsEnabled: true,
  });
  assert.equal(res.completed, true);
  assert.equal(res.rewardAmountCoins, 250);
  assert.equal(res.provider, 'web_simulation');

  const vipRes = await adService.showRewardedAd('double_match_reward', { adFreeBypass: true });
  assert.equal(vipRes.completed, true);
  assert.equal(vipRes.provider, 'vip_bypass');
});

test('daily challenge locks to 1 play per calendar day with midnight HH:MM:SS countdown and starter PP pool uses real footballers', () => {
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  assert.equal(hasPlayedDailyChallengeToday('2026-11-22', storage), false);
  markDailyChallengePlayedToday('2026-11-22', storage);
  assert.equal(mem.get(DAILY_CHALLENGE_LOCK_STORAGE_KEY), '2026-11-22');
  assert.equal(hasPlayedDailyChallengeToday('2026-11-22', storage), true);
  assert.equal(hasPlayedDailyChallengeToday('2026-11-23', storage), false);

  const countdown = getTimeUntilMidnightCountdown(new Date(2026, 10, 22, 21, 5, 30));
  assert.equal(countdown.hours, 2);
  assert.equal(countdown.minutes, 54);
  assert.equal(countdown.seconds, 30);
  assert.equal(countdown.formatted, '02:54:30');

  // 24-hour Daily Challenge cooldown & HH:MM:SS formatter
  const mem24 = new Map<string, string>();
  const storage24 = {
    getItem: (k: string) => mem24.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem24.set(k, v);
    },
    removeItem: (k: string) => {
      mem24.delete(k);
    },
  };
  const t0 = new Date('2026-11-23T12:00:00');
  assert.equal(canPlayDailyChallengeNow(null, t0, storage24), true);
  writeDailyChallengeCooldownEndMs(t0.getTime() + DAILY_CHALLENGE_COOLDOWN_MS, storage24);
  assert.ok(mem24.get(DAILY_CHALLENGE_NEXT_AT_STORAGE_KEY));
  const after2h = new Date(t0.getTime() + 2 * 60 * 60 * 1000 + 30 * 1000);
  assert.equal(canPlayDailyChallengeNow(null, after2h, storage24), false);
  assert.equal(
    formatCountdownHMS(getRemainingDailyChallengeCooldownMs(null, after2h, storage24)),
    '21:59:30'
  );
  const after24h = new Date(t0.getTime() + DAILY_CHALLENGE_COOLDOWN_MS + 1000);
  assert.equal(canPlayDailyChallengeNow(null, after24h, storage24), true);

  // Every free starter PP must map to a real footballer in PLAYERS
  assert.ok(DEFAULT_STARTER_AVATAR.startsWith('pp:'));
  assert.ok(PLAYERS[DEFAULT_STARTER_AVATAR.slice(3)]);
  assert.ok(FREE_STARTER_PLAYER_AVATARS.length >= 6);
  for (const sp of FREE_STARTER_PLAYER_AVATARS) {
    assert.ok(PLAYERS[sp.playerId], `Starter PP ${sp.playerId} must exist in PLAYERS`);
  }
  assert.ok(FREE_ICON_AVATARS.includes('⚽'));
  assert.ok(FREE_ICON_AVATARS.includes('🏆'));
});
