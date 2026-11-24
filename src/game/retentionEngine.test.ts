import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addFriendByCodeOrEntry,
  buildLeagueStandings,
  buildWeeklyLeagueDivisionStandings,
  canClaimDailyReward,
  claimDailyQuest,
  claimDailyReward,
  acceptIncomingFriendRequest,
  awardTournamentChampionPrize,
  cancelOutgoingFriendRequest,
  completeOutgoingFriendRequest,
  consumeEnergyDrink,
  consumeExtraTimeCard,
  consumeMatchEntryEnergy,
  createInitialProgression,
  dismissLeagueSeasonNotice,
  enterTournamentWithCoins,
  equipStoreItem,
  getEffectiveDailyEnergy,
  getLeagueTierInfo,
  getLocalDateKey,
  getMondayWeekKey,
  getPendingIncomingRequestCount,
  getTimeUntilNextMondayReset,
  getTimeUntilSundaySeasonEnd,
  grantExtraRewards,
  grantFreeAdCoins,
  hasPendingOutgoingRequest,
  hasUnlimitedEnergy,
  linkSocialAccount,
  purchaseGift,
  purchaseStoreItem,
  receiveIncomingFriendRequest,
  recordDailyChallengeCompletion,
  recordMatchOutcome,
  refundMatchEnergy,
  rejectIncomingFriendRequest,
  resolveFriendTargetCandidate,
  selectDefaultPitchTheme,
  sendFriendRequest,
  SOCIAL_LINK_BONUS_COINS,
  spendCoinsForJoker,
  syncProgressionForToday,
  unlinkSocialAccount,
  useEnergyDrinkForMatchEnergy,
  WEEKLY_LEAGUE_TIERS,
} from './retentionEngine';
import { pickFeaturedFootballer, formatStoryMatchMetrics } from '../utils/storyCardGenerator';
import { STAR_PP_AVATARS } from './avatarCatalog';
import { STORE_ITEMS } from './storeCatalog';

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

  // All Star PPs sit in the balanced 7,500 - 10,000 Coin band
  for (const pp of STAR_PP_AVATARS) {
    assert.ok(pp.costCoins >= 7500 && pp.costCoins <= 10000);
  }
  assert.equal(STAR_PP_AVATARS.find((p) => p.giftId === 'gift_pp_lionel_messi')?.costCoins, 10000);
  assert.equal(STAR_PP_AVATARS.find((p) => p.giftId === 'gift_pp_cristiano_ronaldo')?.costCoins, 10000);
  assert.equal(STAR_PP_AVATARS.find((p) => p.giftId === 'gift_pp_kylian_mbappe')?.costCoins, 10000);
  assert.equal(STAR_PP_AVATARS.find((p) => p.giftId === 'gift_pp_jude_bellingham')?.costCoins, 8500);
  assert.equal(STAR_PP_AVATARS.find((p) => p.giftId === 'gift_pp_erling_haaland')?.costCoins, 9000);
  assert.equal(STAR_PP_AVATARS.find((p) => p.giftId === 'gift_pp_victor_osimhen')?.costCoins, 7500);
  assert.equal(STAR_PP_AVATARS.find((p) => p.giftId === 'gift_pp_mohamed_salah')?.costCoins, 7500);

  const fresh = createInitialProgression('user_5');
  const ardaBlocked = purchaseGift(fresh, 'gift_pp_arda_guler');
  assert.equal(ardaBlocked.ok, false);

  fresh.coins = 10000;
  const ardaBought = purchaseGift(fresh, 'gift_pp_arda_guler');
  assert.equal(ardaBought.ok, true);
  assert.equal(ardaBought.progression.coins, 2500);
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
  assert.equal(matchRes.earnedCoins, 100 * 2);
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
  MAX_DAILY_ENERGY,
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

test('3-stage approved friend request workflow tracks pending outgoing, incoming badges, accept and reject cleanly', () => {
  let senderProg = createInitialProgression('sender_1');
  let receiverProg = createInitialProgression('receiver_1');
  const livePlayers = [
    {
      id: 'receiver_1',
      friendCode: receiverProg.friendCode,
      name: 'KralMert',
      avatar: '🦅',
      weeklyPoints: 950,
      totalPoints: 2400,
    },
  ];

  // Self code rejected
  const selfAttempt = resolveFriendTargetCandidate(senderProg, senderProg.friendCode, livePlayers, 'sender_1');
  assert.equal(selfAttempt.ok, false);

  // Stage 1: Resolve target candidate cleanly before confirmation modal
  const resolved = resolveFriendTargetCandidate(senderProg, 'KralMert', livePlayers, 'sender_1');
  assert.equal(resolved.ok, true);
  assert.equal(resolved.target?.id, 'receiver_1');
  assert.equal(senderProg.friends.length, 0);

  // Stage 2: Sending request sets Pending Outgoing ("İstek Gönderildi"), does NOT add to friends yet
  const sent = sendFriendRequest(
    senderProg,
    { id: 'sender_1', name: 'ArdaPro', avatar: '🦁' },
    resolved.target!,
    1700000000000
  );
  assert.equal(sent.ok, true);
  senderProg = sent.progression;
  assert.equal(senderProg.friends.length, 0);
  assert.equal(hasPendingOutgoingRequest(senderProg, 'receiver_1'), true);
  assert.equal(hasPendingOutgoingRequest(senderProg, 'KralMert'), true);

  // Duplicate request blocked while pending
  const dupAttempt = resolveFriendTargetCandidate(senderProg, 'KralMert', livePlayers, 'sender_1');
  assert.equal(dupAttempt.ok, false);

  // Stage 3: Receiver gets incoming request -> badge count increases
  receiverProg = receiveIncomingFriendRequest(receiverProg, sent.request!);
  assert.equal(getPendingIncomingRequestCount(receiverProg), 1);
  // Deduplicate identical incoming request
  receiverProg = receiveIncomingFriendRequest(receiverProg, sent.request!);
  assert.equal(getPendingIncomingRequestCount(receiverProg), 1);

  // Reject incoming request removes without adding friend
  const rejRes = rejectIncomingFriendRequest(receiverProg, sent.request!.id);
  assert.equal(rejRes.ok, true);
  assert.equal(getPendingIncomingRequestCount(rejRes.progression), 0);
  assert.equal(rejRes.progression.friends.length, 0);

  // Accept incoming request removes request and adds friend to receiver
  const accRes = acceptIncomingFriendRequest(receiverProg, sent.request!.id);
  assert.equal(accRes.ok, true);
  assert.equal(getPendingIncomingRequestCount(accRes.progression), 0);
  assert.equal(accRes.progression.friends.length, 1);
  assert.equal(accRes.progression.friends[0].name, 'ArdaPro');

  // Sender completes outgoing request when receiver accepts -> moves from pending to friends
  senderProg = completeOutgoingFriendRequest(senderProg, sent.request!, 'accepted');
  assert.equal(hasPendingOutgoingRequest(senderProg, 'receiver_1'), false);
  assert.equal(senderProg.friends.length, 1);
  assert.equal(senderProg.friends[0].name, 'KralMert');

  // Cancelling a pending outgoing request clears it cleanly
  const sent2 = sendFriendRequest(
    senderProg,
    { id: 'sender_1', name: 'ArdaPro', avatar: '🦁' },
    {
      id: 'other_2',
      friendCode: 'FC4455',
      name: 'Batu99',
      avatar: '⚽',
      weeklyPoints: 100,
      totalPoints: 200,
      subtitle: 'Oyuncu',
      isOnline: true,
    }
  );
  assert.equal(sent2.ok, true);
  assert.equal(hasPendingOutgoingRequest(sent2.progression, 'other_2'), true);
  const cancelled = cancelOutgoingFriendRequest(sent2.progression, sent2.request!.id);
  assert.equal(hasPendingOutgoingRequest(cancelled, 'other_2'), false);
});

test('in-match joker spending, +250 ad coins, VIP ad-free+frame bundle, and daily challenge record work cleanly', () => {
  let prog = createInitialProgression('user_joker'); // starts with 200 coins

  // Spend 100 coins for Nationality+Position Joker
  const joker1 = spendCoinsForJoker(prog, 100);
  assert.equal(joker1.ok, true);
  assert.equal(joker1.progression.coins, 100);
  prog = joker1.progression;

  // Trying 150 coin Joker with 100 balance fails with clear insufficient warning
  const jokerFail = spendCoinsForJoker(prog, 150);
  assert.equal(jokerFail.ok, false);
  assert.ok(jokerFail.reason?.includes('Yetersiz Coin'));

  // Grant +250 Free Ad Coins -> 350 coins
  prog = grantFreeAdCoins(prog, 250);
  assert.equal(prog.coins, 350);

  // Now 150 coin Initials Joker succeeds -> 200 coins
  const joker2 = spendCoinsForJoker(prog, 150);
  assert.equal(joker2.ok, true);
  assert.equal(joker2.progression.coins, 200);
  prog = joker2.progression;

  // VIP bundle unlocks adFree AND equips 'vip' frame
  const vipBundle = purchaseStoreItem(prog, 'bundle_vip_adfree_frame', 'money');
  assert.equal(vipBundle.ok, true);
  assert.equal(vipBundle.progression.adFree, true);
  assert.equal(vipBundle.progression.equippedFrame, 'vip');
  assert.ok(vipBundle.progression.unlockedGiftIds.includes('store_ad_free'));
  prog = vipBundle.progression;

  // Daily challenge completion awards coins/points only once per date
  const dc1 = recordDailyChallengeCompletion(prog, {
    dateKey: '2026-02-11',
    puzzleNumber: 42,
    correctCount: 3,
    totalRounds: 3,
    elapsedSec: 18.4,
    rewardCoins: 500,
    rewardPoints: 390,
    completedAt: Date.now(),
  });
  assert.equal(dc1.firstCompletionToday, true);
  assert.equal(dc1.awardedCoins, 500);
  assert.equal(dc1.progression.coins, 700);

  const dc2 = recordDailyChallengeCompletion(dc1.progression, {
    dateKey: '2026-02-11',
    puzzleNumber: 42,
    correctCount: 3,
    totalRounds: 3,
    elapsedSec: 12.1,
    rewardCoins: 500,
    rewardPoints: 390,
    completedAt: Date.now(),
  });
  assert.equal(dc2.firstCompletionToday, false);
  assert.equal(dc2.awardedCoins, 0);
  assert.equal(dc2.progression.coins, 700);
});

test('daily energy starts 5/5, deducts on match start, refunds on win/draw only, resets on new day, refills +2 on ad/drink, and is infinite for VIP', () => {
  const day1 = new Date('2026-04-10T10:00:00');
  const day2 = new Date('2026-04-11T09:00:00');

  let prog = createInitialProgression('user_energy', day1);
  assert.equal(getEffectiveDailyEnergy(prog, day1), MAX_DAILY_ENERGY);
  assert.equal(hasUnlimitedEnergy(prog), false);

  // Match 1 start: 5 -> 4
  const entry1 = consumeMatchEntryEnergy(prog, day1);
  assert.equal(entry1.ok, true);
  assert.equal(getEffectiveDailyEnergy(entry1.progression, day1), 4);
  prog = entry1.progression;

  // Win match 1 -> refunds +1 (4 -> 5)
  const winOutcome = recordMatchOutcome(prog, {
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
    now: day1,
  });
  prog = winOutcome.progression;
  assert.equal(getEffectiveDailyEnergy(prog, day1), 5);

  // Match 2 start: 5 -> 4, Draw refunds +1 (4 -> 5)
  prog = consumeMatchEntryEnergy(prog, day1).progression;
  assert.equal(getEffectiveDailyEnergy(prog, day1), 4);
  prog = recordMatchOutcome(prog, {
    won: false,
    isDraw: true,
    minigameType: 'career',
    stats: {
      fastestAnswerSec: 5,
      totalCorrect: 1,
      totalWrongAttempts: 0,
      currentStreak: 1,
      maxStreak: 1,
      clutchAnswers: 0,
      trailedThenWon: false,
    },
    now: day1,
  }).progression;
  assert.equal(getEffectiveDailyEnergy(prog, day1), 5);

  // Lose 5 matches in a row -> energy drains down to 0
  for (let i = 0; i < 5; i++) {
    const e = consumeMatchEntryEnergy(prog, day1);
    assert.equal(e.ok, true);
    prog = recordMatchOutcome(e.progression, {
      won: false,
      isDraw: false,
      minigameType: 'two_clubs',
      stats: {
        fastestAnswerSec: null,
        totalCorrect: 0,
        totalWrongAttempts: 1,
        currentStreak: 0,
        maxStreak: 0,
        clutchAnswers: 0,
        trailedThenWon: false,
      },
      now: day1,
    }).progression;
  }
  assert.equal(getEffectiveDailyEnergy(prog, day1), 0);

  // At 0/5 energy, entering another match is blocked
  const blocked = consumeMatchEntryEnergy(prog, day1);
  assert.equal(blocked.ok, false);

  // Watching Rewarded Ad grants +2 energy (0 -> 2)
  prog = refundMatchEnergy(prog, 2, day1);
  assert.equal(getEffectiveDailyEnergy(prog, day1), 2);

  // Using an Energy Drink grants +2 energy (2 -> 4)
  prog = { ...prog, energyDrinks: 1 };
  const drinkUse = useEnergyDrinkForMatchEnergy(prog, day1);
  assert.equal(drinkUse.ok, true);
  assert.equal(getEffectiveDailyEnergy(drinkUse.progression, day1), 4);
  assert.equal(drinkUse.progression.energyDrinks, 0);
  prog = drinkUse.progression;

  // Date rollover automatically resets daily energy to 5/5
  const nextDaySynced = syncProgressionForToday(prog, day2);
  assert.equal(getEffectiveDailyEnergy(nextDaySynced, day2), 5);

  // VIP bundle gives unlimited energy and never deducts
  const vipProg = purchaseStoreItem(nextDaySynced, 'bundle_vip_adfree_frame', 'money').progression;
  assert.equal(hasUnlimitedEnergy(vipProg), true);
  const vipEntry = consumeMatchEntryEnergy({ ...vipProg, dailyEnergy: 0 }, day2);
  assert.equal(vipEntry.ok, true);
});

test('coin economy rebalance: boosted quests, +100 match win, League Shield, Extra +10s Card, and new Pitch Themes work cleanly', () => {
  const today = new Date(2026, 10, 18, 14, 0, 0);
  let prog = createInitialProgression('user_econ', today);

  // 1. Boosted daily quest rewards (+40%)
  const questMap = Object.fromEntries(prog.dailyQuests.map((q) => [q.id, q.rewardCoins]));
  assert.equal(questMap.q_play_1, 180);
  assert.equal(questMap.q_win_1, 350);
  assert.equal(questMap.q_answers_5, 450);
  assert.equal(questMap.q_minigame_1, 320);
  assert.equal(questMap.q_win_3, 850);

  // 2. Standard match win awards +100 Coin
  const win1 = recordMatchOutcome(prog, {
    won: true,
    minigameType: 'two_clubs',
    stats: {
      fastestAnswerSec: 2.5,
      totalCorrect: 3,
      totalWrongAttempts: 0,
      currentStreak: 3,
      maxStreak: 3,
      clutchAnswers: 0,
      trailedThenWon: false,
    },
    now: today,
  });
  assert.equal(win1.earnedCoins, 100);
  assert.ok(win1.earnedPoints > 0);
  prog = win1.progression;

  // 3. Defeat without League Shield drops LP (30 LP)
  const lpBeforeLoss = prog.weeklyPoints;
  const lossNoShield = recordMatchOutcome(prog, {
    won: false,
    isDraw: false,
    minigameType: 'career',
    stats: {
      fastestAnswerSec: null,
      totalCorrect: 0,
      totalWrongAttempts: 1,
      currentStreak: 0,
      maxStreak: 0,
      clutchAnswers: 0,
      trailedThenWon: false,
    },
    now: today,
  });
  assert.equal(lossNoShield.shieldProtected, false);
  assert.equal(lossNoShield.earnedPoints, -30);
  assert.equal(lossNoShield.progression.weeklyPoints, lpBeforeLoss - 30);
  prog = lossNoShield.progression;

  // 4. Purchase League Shield (1.000 Coin) -> blocks LP loss on next defeat
  prog = { ...prog, coins: 6000 };
  const shieldItem = STORE_ITEMS.find((i) => i.id === 'store_league_shield');
  assert.equal(shieldItem?.costCoins, 1000);
  const buyShield = purchaseStoreItem(prog, 'store_league_shield', 'coins');
  assert.equal(buyShield.ok, true);
  assert.equal(buyShield.progression.coins, 5000);
  assert.equal(buyShield.progression.leagueShields, 1);
  prog = buyShield.progression;

  const lpProtectedBefore = prog.weeklyPoints;
  const lossWithShield = recordMatchOutcome(prog, {
    won: false,
    isDraw: false,
    minigameType: 'xox',
    stats: {
      fastestAnswerSec: null,
      totalCorrect: 0,
      totalWrongAttempts: 1,
      currentStreak: 0,
      maxStreak: 0,
      clutchAnswers: 0,
      trailedThenWon: false,
    },
    now: today,
  });
  assert.equal(lossWithShield.shieldProtected, true);
  assert.equal(lossWithShield.earnedPoints, 0);
  assert.equal(lossWithShield.progression.weeklyPoints, lpProtectedBefore);
  assert.equal(lossWithShield.progression.leagueShields, 0);
  prog = lossWithShield.progression;

  // 5. Purchase Extra +10s Card (500 Coin) & consume in match
  const extraCardItem = STORE_ITEMS.find((i) => i.id === 'store_extra_time_10');
  assert.equal(extraCardItem?.costCoins, 500);
  const buyExtra = purchaseStoreItem(prog, 'store_extra_time_10', 'coins');
  assert.equal(buyExtra.ok, true);
  assert.equal(buyExtra.progression.extraTimeCards, 1);
  const useExtra = consumeExtraTimeCard(buyExtra.progression);
  assert.equal(useExtra.ok, true);
  assert.equal(useExtra.progression.extraTimeCards, 0);
  assert.equal(consumeExtraTimeCard(useExtra.progression).ok, false);
  prog = useExtra.progression;

  // 6. Purchase Winter Snow (1.500 Coin) & Final Stadium (2.500 Coin) pitch themes & switch
  const winterBuy = purchaseStoreItem(prog, 'pitch_winter_snow', 'coins');
  assert.equal(winterBuy.ok, true);
  assert.equal(winterBuy.progression.equippedPitchTheme, 'winter_snow');
  const finalBuy = purchaseStoreItem(winterBuy.progression, 'pitch_final_stadium', 'coins');
  assert.equal(finalBuy.ok, true);
  assert.equal(finalBuy.progression.equippedPitchTheme, 'final_stadium');
  const reEquipWinter = equipStoreItem(finalBuy.progression, 'pitch_winter_snow');
  assert.equal(reEquipWinter.ok, true);
  assert.equal(reEquipWinter.progression.equippedPitchTheme, 'winter_snow');
  const backToClassic = selectDefaultPitchTheme(reEquipWinter.progression);
  assert.equal(backToClassic.equippedPitchTheme, undefined);
});

test('5-tier weekly league standings, Sunday 23:59 countdown, automatic promotion coins, and story card metrics work cleanly', () => {
  assert.equal(WEEKLY_LEAGUE_TIERS.length, 5);
  assert.deepEqual(
    WEEKLY_LEAGUE_TIERS.map((t) => t.name),
    ['Amatör Lig', '2. Lig', '1. Lig', 'Süper Lig', 'Şampiyonlar Ligi']
  );

  // Sunday 23:59 countdown check (Wednesday 12:00 -> 4 days 11 hours remaining)
  const wed = new Date(2026, 10, 18, 12, 0, 0);
  const seasonEnd = getTimeUntilSundaySeasonEnd(wed);
  assert.equal(seasonEnd.days, 4);
  assert.equal(seasonEnd.hours, 11);
  assert.ok(seasonEnd.label.startsWith('Sezon Bitimine: 4 Gün 11 Saat'));

  // Dynamic Turkish bot rivals in local division standings
  const sunday = new Date(2026, 10, 15, 22, 0, 0);
  const monday = new Date(2026, 10, 16, 0, 5, 0);
  let prog = createInitialProgression('user_league', sunday);
  prog.weeklyPoints = 950;
  prog.coins = 500;
  const userProfile = { id: 'user_league', name: 'SampiyonBugra', avatar: '🦁', score: 0 };

  const div = buildWeeklyLeagueDivisionStandings(prog, userProfile, []);
  assert.equal(div.tier.id, 'amateur');
  assert.equal(div.entries.length, 10);
  assert.equal(div.promotionCutoff, 3);
  assert.equal(div.relegationStartRank, null); // No relegation from Amateur
  assert.ok(div.userRank <= 3);

  // Crossing Sunday 23:59 -> Monday promotes to 2. Lig and grants automatic Coin reward
  const promoted = syncProgressionForToday(prog, monday);
  assert.equal(promoted.leagueTierId, 'league_2');
  assert.equal(promoted.weeklyPoints, 0);
  assert.equal(promoted.coins, 500 + getLeagueTierInfo('amateur').promotionRewardCoins);
  assert.equal(promoted.lastSeasonResetNotice?.outcome, 'promoted');
  assert.equal(promoted.lastSeasonResetNotice?.newTierId, 'league_2');

  const div2 = buildWeeklyLeagueDivisionStandings(promoted, userProfile, []);
  assert.equal(div2.tier.id, 'league_2');
  assert.equal(div2.relegationStartRank, 8); // 8-9-10 relegation zone in 2. Lig

  const dismissed = dismissLeagueSeasonNotice(promoted);
  assert.equal(dismissed.lastSeasonResetNotice, null);

  // Story card helper selection
  const featured = pickFeaturedFootballer(
    [
      {
        roundNumber: 1,
        minigameType: 'two_clubs',
        winnerPlayerId: 'user_league',
        acceptedAnswer: 'Arda Güler',
        elapsedSec: 4.2,
        reason: 'scored',
        scoreAfter: { p1: 1, p2: 0 },
      },
      {
        roundNumber: 2,
        minigameType: 'silhouette',
        winnerPlayerId: 'user_league',
        acceptedAnswer: 'Kylian Mbappé',
        elapsedSec: 2.1,
        wasClutch: true,
        reason: 'scored',
        scoreAfter: { p1: 2, p2: 0 },
      },
    ],
    'user_league'
  );
  assert.equal(featured, 'Kylian Mbappé');
  const metrics = formatStoryMatchMetrics(
    [
      {
        roundNumber: 1,
        minigameType: 'two_clubs',
        winnerPlayerId: 'user_league',
        acceptedAnswer: 'Arda Güler',
        elapsedSec: 4.2,
        reason: 'scored',
        scoreAfter: { p1: 1, p2: 0 },
      },
    ],
    'user_league',
    {
      fastestAnswerSec: 4.2,
      totalCorrect: 5,
      totalWrongAttempts: 1,
      currentStreak: 3,
      maxStreak: 3,
      clutchAnswers: 1,
      trailedThenWon: false,
    },
    5
  );
  assert.equal(metrics.speedLabel, '4.2 sn');
  assert.equal(metrics.movesLabel, '6 Hamle');
});






