import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addFriendByCodeOrEntry,
  buildLeagueStandings,
  canClaimDailyReward,
  claimDailyQuest,
  claimDailyReward,
  consumeEnergyDrink,
  createInitialProgression,
  equipStoreItem,
  getLocalDateKey,
  getMondayWeekKey,
  getTimeUntilNextMondayReset,
  grantExtraRewards,
  linkSocialAccount,
  purchaseGift,
  purchaseStoreItem,
  recordMatchOutcome,
  SOCIAL_LINK_BONUS_COINS,
  syncProgressionForToday,
  unlinkSocialAccount,
} from './retentionEngine';
import { STAR_PP_AVATARS } from './avatarCatalog';

test('daily login reward increments streak across consecutive days and grants coins/points', () => {
  const day1 = new Date(2026, 10, 10, 12, 0, 0);
  const day2 = new Date(2026, 10, 11, 12, 0, 0);
  const day4 = new Date(2026, 10, 13, 12, 0, 0);

  let prog = createInitialProgression('user_1', day1);
  assert.equal(canClaimDailyReward(prog, day1), true);

  const res1 = claimDailyReward(prog, day1);
  assert.equal(res1.claimed, true);
  assert.equal(res1.reward.day, 1);
  assert.equal(res1.progression.dailyLogin.streakDays, 1);
  assert.equal(canClaimDailyReward(res1.progression, day1), false);

  // Consecutive Day 2
  const res2 = claimDailyReward(res1.progression, day2);
  assert.equal(res2.claimed, true);
  assert.equal(res2.reward.day, 2);
  assert.equal(res2.progression.dailyLogin.streakDays, 2);
  assert.ok(res2.progression.coins > res1.progression.coins);

  // Missed Day 3 -> Day 4 resets streak to 1
  const res4 = claimDailyReward(res2.progression, day4);
  assert.equal(res4.claimed, true);
  assert.equal(res4.reward.day, 1);
  assert.equal(res4.progression.dailyLogin.streakDays, 1);
});

test('recordMatchOutcome updates stats, streak, weekly points, and unlocks daily quest claims', () => {
  const now = new Date(2026, 10, 12, 15, 0, 0);
  let prog = createInitialProgression('user_2', now);

  const afterMatch = recordMatchOutcome(prog, {
    won: true,
    minigameType: 'xox',
    stats: {
      fastestAnswerSec: 2.3,
      totalCorrect: 5,
      totalWrongAttempts: 1,
      currentStreak: 3,
      maxStreak: 3,
      clutchAnswers: 1,
      trailedThenWon: false,
    },
    now,
  });

  prog = afterMatch.progression;
  assert.equal(prog.matchesPlayed, 1);
  assert.equal(prog.wins, 1);
  assert.equal(prog.winStreak, 1);
  assert.equal(prog.fastestAnswerSec, 2.3);
  assert.equal(prog.minigameMatchCounts.xox, 1);

  // Quests q_play_1, q_win_1, q_answers_5, q_minigame_1 should now be claimable!
  const qWin = prog.dailyQuests.find((q) => q.id === 'q_win_1')!;
  assert.equal(qWin.progress, 1);
  const claimRes = claimDailyQuest(prog, 'q_win_1');
  assert.equal(claimRes.claimed, true);
  assert.equal(claimRes.progression.coins, prog.coins + qWin.rewardCoins);

  // Claiming twice fails safely
  const claimAgain = claimDailyQuest(claimRes.progression, 'q_win_1');
  assert.equal(claimAgain.claimed, false);
});

test('weekly reset clears weeklyPoints on new Monday week while preserving totalPoints', () => {
  const sunday = new Date(2026, 10, 15, 22, 0, 0);
  const monday = new Date(2026, 10, 16, 8, 0, 0);

  let prog = createInitialProgression('user_3', sunday);
  prog.weeklyPoints = 950;
  prog.totalPoints = 3200;

  assert.notEqual(getMondayWeekKey(sunday), getMondayWeekKey(monday));
  const synced = syncProgressionForToday(prog, monday);
  assert.equal(synced.weeklyPoints, 0);
  assert.equal(synced.totalPoints, 3200);
  assert.equal(synced.questsDate, getLocalDateKey(monday));

  const countdown = getTimeUntilNextMondayReset(sunday);
  assert.equal(countdown.days, 0);
  assert.ok(countdown.hours >= 1);
});

test('buildLeagueStandings ranks user dynamically and Star PPs sit in 5k-10k coin band', () => {
  const prog = createInitialProgression('user_4');
  assert.equal(prog.friends.length, 0);
  prog.weeklyPoints = 3000;
  prog.totalPoints = 12000;
  const userProfile = { id: 'user_4', name: 'SampiyonArda', avatar: '🦁', score: 0 };

  const livePlayers = [
    { id: 'real_2', friendCode: 'FC9911', name: 'Caner10', avatar: '⚡', weeklyPoints: 1800, totalPoints: 4500 },
  ];

  const weekly = buildLeagueStandings(prog, userProfile, 'weekly', livePlayers);
  assert.equal(weekly.userRank, 1);
  assert.equal(weekly.entries.length, 2);
  assert.equal(weekly.entries[0].isUser, true);

  const friendsAdded = addFriendByCodeOrEntry(prog, 'FC9911', livePlayers);
  assert.equal(friendsAdded.ok, true);
  const friendsLeague = buildLeagueStandings(
    friendsAdded.progression,
    userProfile,
    'friends',
    livePlayers
  );
  assert.ok(friendsLeague.entries.some((e) => e.name === 'Caner10'));

  const shopRes = purchaseGift(prog, 'gift_title_maestro');
  assert.equal(shopRes.ok, false); // Starts at 200 coins, maestro costs 500
  prog.coins = 500;
  const bought = purchaseGift(prog, 'gift_title_maestro');
  assert.equal(bought.ok, true);
  assert.equal(bought.progression.coins, 0);
  assert.equal(bought.progression.equippedTitle, 'Orta Saha Maestrosu');

  // All Star PPs must be in the 5.000 - 10.000 coin band
  for (const pp of STAR_PP_AVATARS) {
    assert.ok(pp.costCoins >= 5000 && pp.costCoins <= 10000);
  }

  const fresh = createInitialProgression('user_5');
  const ardaBlocked = purchaseGift(fresh, 'gift_pp_arda_guler');
  assert.equal(ardaBlocked.ok, false);

  fresh.coins = 6000;
  const ardaBought = purchaseGift(fresh, 'gift_pp_arda_guler');
  assert.equal(ardaBought.ok, true);
  assert.equal(ardaBought.progression.coins, 1000);
  assert.equal(ardaBought.gift?.type, 'avatar');
  assert.equal(ardaBought.gift?.value, 'pp:arda_guler');
  assert.ok(ardaBought.progression.unlockedGiftIds.includes('gift_pp_arda_guler'));
});

test('store dual purchase (Coin & TRY), energy drinks, 2x multiplier, and social linking work end-to-end', () => {
  let prog = createInitialProgression('user_6');

  // 1. Coin pack via real money
  const coinBlocked = purchaseStoreItem(prog, 'pack_coin_6000', 'coins');
  assert.equal(coinBlocked.ok, false);
  const coinMoney = purchaseStoreItem(prog, 'pack_coin_6000', 'money');
  assert.equal(coinMoney.ok, true);
  assert.equal(coinMoney.progression.coins, 6200);
  prog = coinMoney.progression;

  // 2. Frame & Crest & Theme & Goal Effect & Badge purchase + equip
  const frameBuy = purchaseStoreItem(prog, 'frame_gold', 'coins');
  assert.equal(frameBuy.ok, true);
  assert.equal(frameBuy.progression.equippedFrame, 'gold');
  prog = frameBuy.progression;

  const crestBuy = purchaseStoreItem(prog, 'crest_neon_dragon', 'money');
  assert.equal(crestBuy.ok, true);
  assert.equal(crestBuy.progression.equippedCrest, 'crest_neon_dragon');
  prog = crestBuy.progression;

  const themeBuy = purchaseStoreItem(prog, 'pitch_ucl_night', 'money');
  assert.equal(themeBuy.ok, true);
  assert.equal(themeBuy.progression.equippedPitchTheme, 'ucl_night');
  prog = themeBuy.progression;

  const equipFrameRes = equipStoreItem(prog, 'frame_gold');
  assert.equal(equipFrameRes.ok, true);

  // 3. Ad removal VIP is real-money ONLY
  const adFreeCoinBlocked = purchaseStoreItem(prog, 'store_ad_free', 'coins');
  assert.equal(adFreeCoinBlocked.ok, false);
  const adFreeBuy = purchaseStoreItem(prog, 'store_ad_free', 'money');
  assert.equal(adFreeBuy.ok, true);
  assert.equal(adFreeBuy.progression.adFree, true);
  prog = adFreeBuy.progression;

  // 4. Energy drink purchase & consumption
  const energyBuy = purchaseStoreItem(prog, 'store_energy_3', 'coins');
  assert.equal(energyBuy.ok, true);
  assert.equal(energyBuy.progression.energyDrinks, 3);
  const used = consumeEnergyDrink(energyBuy.progression);
  assert.equal(used.ok, true);
  assert.equal(used.progression.energyDrinks, 2);
  prog = used.progression;

  // 5. 2x Multiplier doubles match rewards and decrements matches count
  const multBuy = purchaseStoreItem(prog, 'store_mult_2x_5', 'money');
  assert.equal(multBuy.ok, true);
  assert.equal(multBuy.progression.multiplier2xMatches, 5);
  const matchRes = recordMatchOutcome(multBuy.progression, {
    won: true,
    minigameType: 'two_clubs',
    stats: {
      fastestAnswerSec: 3,
      totalCorrect: 3,
      totalWrongAttempts: 0,
      currentStreak: 3,
      maxStreak: 3,
      clutchAnswers: 0,
      trailedThenWon: false,
    },
  });
  assert.equal(matchRes.multiplierApplied, true);
  assert.equal(matchRes.earnedCoins, (30 + 3 * 10 + 90) * 2);
  assert.equal(matchRes.progression.multiplier2xMatches, 4);

  // 6. Grant extra rewards (Rewarded Ad 2x)
  const doubled = grantExtraRewards(matchRes.progression, matchRes.earnedCoins, matchRes.earnedPoints);
  assert.equal(doubled.coins, matchRes.progression.coins + matchRes.earnedCoins);

  // 7. Social media linking & first-time bonus
  const link1 = linkSocialAccount(doubled, 'google', 'arda@example.com');
  assert.equal(link1.ok, true);
  assert.equal(link1.bonusCoinsAwarded, SOCIAL_LINK_BONUS_COINS);
  assert.equal(link1.progression.linkedAccounts?.length, 1);
  assert.equal(link1.progression.socialBonusClaimed, true);

  const link2 = linkSocialAccount(link1.progression, 'instagram', '@ardaguler10');
  assert.equal(link2.ok, true);
  assert.equal(link2.bonusCoinsAwarded, 0);
  assert.equal(link2.progression.linkedAccounts?.length, 2);

  const unlinked = unlinkSocialAccount(link2.progression, 'instagram');
  assert.equal(unlinked.linkedAccounts?.length, 1);
});

import {
  TOURNAMENT_OPEN_ENTRY_COINS,
  TOURNAMENT_OPEN_PRIZE_COINS,
  advanceTournamentAfterMatch,
  createTournamentBracket,
  getTournamentMatchForUser,
} from './tournamentEngine';
import {
  awardTournamentChampionPrize,
  enterTournamentWithCoins,
} from './retentionEngine';

test('8-player knockout tournament deducts 2000 coins, advances 3 matches (QF->SF->Final), and awards 6000 coins', () => {
  let prog = createInitialProgression('user_t1');
  assert.equal(enterTournamentWithCoins(prog, TOURNAMENT_OPEN_ENTRY_COINS).ok, false);

  prog.coins = 2500;
  const entry = enterTournamentWithCoins(prog, TOURNAMENT_OPEN_ENTRY_COINS);
  assert.equal(entry.ok, true);
  assert.equal(entry.progression.coins, 500);
  prog = entry.progression;

  let bracket = createTournamentBracket({
    userProfile: { id: 'user_t1', name: 'Sampiyon', avatar: '🦁', score: 0 },
    mode: 'open_cup',
    minigameType: 'two_clubs',
  });
  assert.equal(bracket.participants.length, 8);
  assert.equal(bracket.qf.length, 4);
  assert.equal(bracket.sf.length, 2);

  // Match 1: Çeyrek Final
  const qfInfo = getTournamentMatchForUser(bracket, 'user_t1');
  assert.equal(qfInfo.matchNumber, 1);
  assert.ok(qfInfo.opponent);

  bracket = advanceTournamentAfterMatch(bracket, 'user_t1', true);
  assert.equal(bracket.currentStage, 'sf');
  assert.equal(bracket.status, 'active');

  // Match 2: Yarı Final
  const sfInfo = getTournamentMatchForUser(bracket, 'user_t1');
  assert.equal(sfInfo.matchNumber, 2);
  assert.ok(sfInfo.opponent);

  bracket = advanceTournamentAfterMatch(bracket, 'user_t1', true);
  assert.equal(bracket.currentStage, 'final');
  assert.equal(bracket.status, 'active');

  // Match 3: Büyük Final
  const finalInfo = getTournamentMatchForUser(bracket, 'user_t1');
  assert.equal(finalInfo.matchNumber, 3);
  assert.ok(finalInfo.opponent);

  bracket = advanceTournamentAfterMatch(bracket, 'user_t1', true);
  assert.equal(bracket.currentStage, 'completed');
  assert.equal(bracket.status, 'won');
  assert.equal(bracket.championId, 'user_t1');

  const rewarded = awardTournamentChampionPrize(prog, TOURNAMENT_OPEN_PRIZE_COINS, 400);
  assert.equal(rewarded.coins, 6500);
  assert.equal(rewarded.tournamentWins, 1);

  // Loss in QF eliminates cleanly
  const lossBracket = advanceTournamentAfterMatch(
    createTournamentBracket({
      userProfile: { id: 'user_t2', name: 'Aday', avatar: '⚽', score: 0 },
      mode: 'open_cup',
      minigameType: 'xox',
    }),
    'user_t2',
    false
  );
  assert.equal(lossBracket.status, 'eliminated');
  assert.equal(lossBracket.currentStage, 'completed');
});


