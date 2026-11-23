import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildToastFromFriendEvent,
  detectHighScoreMilestone,
  dismissToast,
  enqueueToast,
  isEventFromFriend,
} from './toastEngine';
import { FriendActivityEvent, FriendEntry, ToastItem } from './types';

const sampleFriends: FriendEntry[] = [
  {
    id: 'u_kerem',
    friendCode: 'FC9988',
    name: 'KeremGolcu',
    avatar: '⚽',
    weeklyPoints: 900,
    totalPoints: 3200,
    statusText: 'Çevrim içi',
    isOnline: true,
  },
  {
    id: 'friend_local_1',
    friendCode: 'AYL42',
    name: 'AylinYildiz',
    avatar: '🔥',
    weeklyPoints: 400,
    totalPoints: 1200,
    statusText: 'Arkadaş',
    isOnline: false,
  },
];

test('isEventFromFriend matches by ID, friendCode, or normalized name and rejects self/strangers', () => {
  const byId: FriendActivityEvent = {
    id: 'ev_1',
    type: 'tournament_started',
    actorId: 'u_kerem',
    actorName: 'KeremGolcu',
    actorAvatar: '⚽',
    title: '',
    message: '',
    createdAt: 1000,
  };
  assert.equal(isEventFromFriend(byId, 'u_self', 'FC1111', sampleFriends), true);

  const byCodeOnly: FriendActivityEvent = {
    id: 'ev_2',
    type: 'high_score',
    actorId: 'new_socket_id',
    actorFriendCode: 'ayl42',
    actorName: 'Aylin',
    actorAvatar: '🔥',
    title: '',
    message: '',
    createdAt: 1000,
  };
  assert.equal(isEventFromFriend(byCodeOnly, 'u_self', 'FC1111', sampleFriends), true);

  const byNormalizedName: FriendActivityEvent = {
    id: 'ev_3',
    type: 'high_score',
    actorId: 'another_id',
    actorName: 'keremgolcu',
    actorAvatar: '⚽',
    title: '',
    message: '',
    createdAt: 1000,
  };
  assert.equal(isEventFromFriend(byNormalizedName, 'u_self', 'FC1111', sampleFriends), true);

  const selfEvent: FriendActivityEvent = {
    id: 'ev_4',
    type: 'tournament_started',
    actorId: 'u_self',
    actorFriendCode: 'FC1111',
    actorName: 'KeremGolcu',
    actorAvatar: '⚽',
    title: '',
    message: '',
    createdAt: 1000,
  };
  assert.equal(isEventFromFriend(selfEvent, 'u_self', 'FC1111', sampleFriends), false);

  const strangerEvent: FriendActivityEvent = {
    id: 'ev_5',
    type: 'high_score',
    actorId: 'u_stranger',
    actorFriendCode: 'STR99',
    actorName: 'YabanciOyuncu',
    actorAvatar: '⚡',
    title: '',
    message: '',
    createdAt: 1000,
  };
  assert.equal(isEventFromFriend(strangerEvent, 'u_self', 'FC1111', sampleFriends), false);
});

test('detectHighScoreMilestone triggers on 500-point weekly tiers, big match scores, and tournament wins', () => {
  const tierCross = detectHighScoreMilestone({
    prevTotalPoints: 420,
    prevWeeklyPoints: 420,
    nextTotalPoints: 580,
    nextWeeklyPoints: 580,
    matchScoreEarned: 160,
    won: true,
  });
  assert.equal(tierCross.isHighScore, true);
  assert.equal(tierCross.scoreValue, 580);

  const bigWin = detectHighScoreMilestone({
    prevTotalPoints: 510,
    prevWeeklyPoints: 510,
    nextTotalPoints: 790,
    nextWeeklyPoints: 790,
    matchScoreEarned: 280,
    won: true,
  });
  assert.equal(bigWin.isHighScore, true);

  const smallLoss = detectHighScoreMilestone({
    prevTotalPoints: 200,
    prevWeeklyPoints: 200,
    nextTotalPoints: 265,
    nextWeeklyPoints: 265,
    matchScoreEarned: 65,
    won: false,
  });
  assert.equal(smallLoss.isHighScore, false);
});

test('buildToastFromFriendEvent formats tournament_started and high_score toasts properly', () => {
  const tourneyToast = buildToastFromFriendEvent({
    id: 'ev_t1',
    type: 'tournament_started',
    actorId: 'u_kerem',
    actorName: 'KeremGolcu',
    actorAvatar: '⚽',
    title: '',
    message: '',
    tournamentCode: 'T7K2P',
    tournamentTitle: 'Süper Lig Kupası',
    minigameType: 'two_clubs',
    createdAt: 12345,
  });
  assert.equal(tourneyToast.badgeLabel, 'TURNUVA');
  assert.equal(tourneyToast.tournamentCode, 'T7K2P');
  assert.match(tourneyToast.title, /KeremGolcu/);
  assert.match(tourneyToast.message, /T7K2P/);

  const scoreToast = buildToastFromFriendEvent({
    id: 'ev_h1',
    type: 'high_score',
    actorId: 'u_kerem',
    actorName: 'KeremGolcu',
    actorAvatar: '⚽',
    title: '',
    message: '',
    scoreValue: 1550,
    createdAt: 12346,
  });
  assert.equal(scoreToast.badgeLabel, 'YÜKSEK SKOR');
  assert.match(scoreToast.title, /KeremGolcu/);
  assert.match(scoreToast.message, /1\.550|1,550/);
});

test('enqueueToast deduplicates by eventId, enforces maxVisible cap, and dismissToast removes by id', () => {
  const seen = new Set<string>();
  let queue: ToastItem[] = [];

  for (let i = 1; i <= 6; i++) {
    const t = buildToastFromFriendEvent({
      id: `ev_${i}`,
      type: 'high_score',
      actorId: 'u_kerem',
      actorName: 'KeremGolcu',
      actorAvatar: '⚽',
      title: `Başlık ${i}`,
      message: `Mesaj ${i}`,
      scoreValue: i * 500,
      createdAt: i,
    });
    const res = enqueueToast(queue, t, 4, seen);
    queue = res.queue;
    assert.equal(res.added, true);
  }
  assert.equal(queue.length, 4);
  assert.equal(queue[0].eventId, 'ev_6');

  // Duplicate eventId should be ignored idempotently
  const dup = buildToastFromFriendEvent({
    id: 'ev_6',
    type: 'high_score',
    actorId: 'u_kerem',
    actorName: 'KeremGolcu',
    actorAvatar: '⚽',
    title: 'Başlık 6',
    message: 'Mesaj 6',
    scoreValue: 3000,
    createdAt: 6,
  });
  const dupRes = enqueueToast(queue, dup, 4, seen);
  assert.equal(dupRes.added, false);
  assert.equal(dupRes.queue.length, 4);

  queue = dismissToast(queue, 'toast_ev_6');
  assert.equal(queue.length, 3);
  assert.equal(queue.some((item) => item.eventId === 'ev_6'), false);
});
