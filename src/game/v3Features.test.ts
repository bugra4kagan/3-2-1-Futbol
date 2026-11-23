import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOOTBALL_PASS_TIERS,
  PASS_XP_MATCH_WIN,
  awardFootballPassXp,
  claimFootballPassTierReward,
  createInitialFootballPassState,
  getPassCurrentTier,
} from './footballPassEngine';
import {
  BIG_CHEST_BASE_COINS,
  claimV3BigDailyChest,
  claimV3DailyQuestReward,
  createInitialV3DailyQuestsState,
  doubleV3BigDailyChest,
  isLoginStreakAtRisk,
  recordV3QuestMatchEnd,
  recordV3QuestPlayerGuess,
  saveUserLoginStreakWithYesterday,
} from './v3DailyQuestsEngine';
import {
  canUseFreeSpecialEventEntry,
  createInitialSpecialEventState,
  markSpecialEventEntryUsed,
  pickSpecialEventLineup,
} from './specialEventEngine';
import {
  buildFriendChallengeUrl,
  decodeFriendChallengeCode,
} from './challengeCodeEngine';
import { PLAYERS } from './database';
import { createInitialProgression } from './retentionEngine';

test('Football Pass enforces 15 tiers, XP accumulation, and separate Free/VIP claims', () => {
  assert.equal(FOOTBALL_PASS_TIERS.length, 15);
  let pass = createInitialFootballPassState();
  let prog = createInitialProgression('pass_u1');

  // Earn 100 XP (2 match wins) -> Tier 1 unlocked
  pass = awardFootballPassXp(PASS_XP_MATCH_WIN, pass).state;
  pass = awardFootballPassXp(PASS_XP_MATCH_WIN, pass).state;
  assert.equal(getPassCurrentTier(pass.xp), 1);

  const freeClaim = claimFootballPassTierReward(1, 'free', false, prog, pass);
  assert.equal(freeClaim.ok, true);
  assert.equal(freeClaim.progression.coins, prog.coins + 100);

  // VIP locked when not VIP
  const lockedVip = claimFootballPassTierReward(1, 'vip', false, freeClaim.progression, freeClaim.passState);
  assert.equal(lockedVip.ok, false);

  // VIP unlocked grants 500 Coin
  const unlockedVip = claimFootballPassTierReward(1, 'vip', true, freeClaim.progression, freeClaim.passState);
  assert.equal(unlockedVip.ok, true);
  assert.equal(unlockedVip.progression.coins, freeClaim.progression.coins + 500);
});

test('V3 Daily Quests track 3 dynamic goals, Big Chest + 2x Ad Double, and Streak Saver detection', () => {
  const now = new Date('2026-11-22T14:00:00');
  let q = createInitialV3DailyQuestsState(now);
  const muslera = PLAYERS.fernando_muslera;

  for (let i = 0; i < 5; i++) {
    q = recordV3QuestPlayerGuess(muslera, q, now);
  }
  for (let i = 0; i < 3; i++) {
    q = recordV3QuestMatchEnd({ won: true, fastestAnswerSec: i === 0 ? 11.2 : 18 }, q, now);
  }

  for (const item of q.quests) {
    const res = claimV3DailyQuestReward(item.id, q, now);
    assert.equal(res.claimed, true);
    q = res.state;
  }

  const chest = claimV3BigDailyChest(q, now);
  assert.equal(chest.claimed, true);
  assert.equal(chest.rewardCoins, BIG_CHEST_BASE_COINS);

  const doubled = doubleV3BigDailyChest(chest.state, now);
  assert.equal(doubled.doubled, true);
  assert.equal(doubled.bonusCoins, BIG_CHEST_BASE_COINS);

  // Streak saver triggers if yesterday missed and streakDays >= 1
  const progRisk = {
    ...createInitialProgression('streak_u1', now),
    dailyLogin: { streakDays: 5, lastClaimDate: '2026-11-19' },
  };
  assert.equal(isLoginStreakAtRisk(progRisk, doubled.state, now), true);

  const savedProg = saveUserLoginStreakWithYesterday(progRisk, now);
  assert.equal(savedProg.dailyLogin.streakDays, 5);
  assert.equal(isLoginStreakAtRisk(savedProg, doubled.state, now), false);
});

test('Special Event 5-star lineup & Friend Challenge ?challenge=... round-trip cleanly', () => {
  const lineup = pickSpecialEventLineup(5);
  assert.equal(lineup.length, 5);

  const now = new Date('2026-11-22T15:00:00');
  let ev = createInitialSpecialEventState(now);
  assert.equal(canUseFreeSpecialEventEntry(ev, now), true);
  ev = markSpecialEventEntryUsed('free', ev, now);
  assert.equal(canUseFreeSpecialEventEntry(ev, now), false);

  const { code, url } = buildFriendChallengeUrl(
    {
      challengerName: 'Kaptan',
      challengerTimeSec: 18.4,
      playerIds: lineup.map((p) => p.id),
    },
    'https://321futbol.app/'
  );
  assert.ok(url.includes('?challenge='));
  const decoded = decodeFriendChallengeCode(code);
  assert.ok(decoded);
  assert.equal(decoded!.challengerName, 'Kaptan');
  assert.equal(decoded!.challengerTimeSec, 18.4);
  assert.deepEqual(decoded!.playerIds, lineup.map((p) => p.id));
});
