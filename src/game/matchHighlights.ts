import { MatchPlayerStats, MatchRoundHighlight, MinigameType, PlayerProfile } from './types';

export interface FastestAnswerEntry {
  rank: number;
  roundNumber: number | null;
  playerId: string;
  playerName: string;
  isUser: boolean;
  answerText: string | null;
  elapsedSec: number;
  wasClutch: boolean;
  minigameLabel: string;
}

export interface MatchKeyMoment {
  id: string;
  kind: 'opener' | 'fastest' | 'clutch' | 'comeback' | 'decider' | 'draw';
  title: string;
  description: string;
  roundNumber: number | null;
  playerName: string | null;
  isUser: boolean | null;
  elapsedSec: number | null;
  scoreLabel: string | null;
}

export interface MatchHighlightsSummary {
  totalGoals: number;
  player1Goals: number;
  player2Goals: number;
  player1GoalSharePct: number;
  player2GoalSharePct: number;
  totalRoundsPlayed: number;
  decisiveGoalRounds: number;
  deadlockRounds: number;
  avgGoalsPerRound: number;
  totalAttempts: number;
  accuracyRatePct: number | null;
  fastestAnswers: FastestAnswerEntry[];
  matchFastestAnswer: FastestAnswerEntry | null;
  player1FastestSec: number | null;
  player2FastestSec: number | null;
  averageAnswerSec: number | null;
  keyMoments: MatchKeyMoment[];
  roundTimeline: MatchRoundHighlight[];
}

export function getMinigameShortLabel(type: MinigameType): string {
  switch (type) {
    case 'two_clubs':
      return 'İki Kulüp';
    case 'silhouette':
      return 'Siluet';
    case 'xox':
      return 'Futbol XOX';
    case 'career':
      return 'Kariyer';
    case 'country_club':
      return 'Ülke + Kulüp';
  }
}

export function buildMatchHighlightsSummary(input: {
  player1: PlayerProfile;
  player2: PlayerProfile;
  player1Stats: MatchPlayerStats;
  player2Stats: MatchPlayerStats;
  roundHighlights?: MatchRoundHighlight[];
}): MatchHighlightsSummary {
  const { player1, player2, player1Stats, player2Stats, roundHighlights = [] } = input;

  const player1Goals = Math.max(0, Math.round(player1.score));
  const player2Goals = Math.max(0, Math.round(player2.score));
  const totalGoals = player1Goals + player2Goals;

  const player1GoalSharePct =
    totalGoals > 0 ? Math.round((player1Goals / totalGoals) * 100) : 50;
  const player2GoalSharePct = totalGoals > 0 ? 100 - player1GoalSharePct : 50;

  const scoredRounds = roundHighlights.filter(
    (r) => r.reason === 'scored' && Boolean(r.winnerPlayerId)
  );
  const deadlockRoundsFromLog = roundHighlights.filter(
    (r) => r.reason !== 'scored' || !r.winnerPlayerId
  ).length;

  const totalRoundsPlayed =
    roundHighlights.length > 0 ? roundHighlights.length : Math.max(1, totalGoals);
  const decisiveGoalRounds =
    roundHighlights.length > 0 ? scoredRounds.length : totalGoals;
  const deadlockRounds = roundHighlights.length > 0 ? deadlockRoundsFromLog : 0;

  const avgGoalsPerRound =
    totalRoundsPlayed > 0
      ? Number((totalGoals / totalRoundsPlayed).toFixed(2))
      : 0;

  const totalCorrect = Math.max(0, player1Stats.totalCorrect + player2Stats.totalCorrect);
  const totalWrong = Math.max(
    0,
    player1Stats.totalWrongAttempts + player2Stats.totalWrongAttempts
  );
  const totalAttempts = totalCorrect + totalWrong;
  const accuracyRatePct =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;

  // Fastest answers list from timed scoring rounds, with fallback to match stats if no round log
  const timedScoredRounds = scoredRounds.filter(
    (r): r is MatchRoundHighlight & { elapsedSec: number; winnerPlayerId: string } =>
      typeof r.elapsedSec === 'number' && r.elapsedSec > 0 && Boolean(r.winnerPlayerId)
  );

  let fastestAnswers: FastestAnswerEntry[] = [];

  if (timedScoredRounds.length > 0) {
    const sorted = [...timedScoredRounds].sort((a, b) => a.elapsedSec - b.elapsedSec);
    fastestAnswers = sorted.map((item, idx) => {
      const isUser = item.winnerPlayerId === player1.id;
      return {
        rank: idx + 1,
        roundNumber: item.roundNumber,
        playerId: item.winnerPlayerId,
        playerName: item.winnerName || (isUser ? player1.name : player2.name),
        isUser,
        answerText: item.acceptedAnswer || null,
        elapsedSec: Number(item.elapsedSec.toFixed(1)),
        wasClutch: Boolean(item.wasClutch),
        minigameLabel: getMinigameShortLabel(item.minigameType),
      };
    });
  } else {
    const fallbackEntries: Omit<FastestAnswerEntry, 'rank'>[] = [];
    if (typeof player1Stats.fastestAnswerSec === 'number' && player1Stats.fastestAnswerSec > 0) {
      fallbackEntries.push({
        roundNumber: null,
        playerId: player1.id,
        playerName: player1.name,
        isUser: true,
        answerText: null,
        elapsedSec: Number(player1Stats.fastestAnswerSec.toFixed(1)),
        wasClutch: player1Stats.clutchAnswers > 0,
        minigameLabel: 'Maç Rekoru',
      });
    }
    if (typeof player2Stats.fastestAnswerSec === 'number' && player2Stats.fastestAnswerSec > 0) {
      fallbackEntries.push({
        roundNumber: null,
        playerId: player2.id,
        playerName: player2.name,
        isUser: false,
        answerText: null,
        elapsedSec: Number(player2Stats.fastestAnswerSec.toFixed(1)),
        wasClutch: player2Stats.clutchAnswers > 0,
        minigameLabel: 'Maç Rekoru',
      });
    }
    fastestAnswers = fallbackEntries
      .sort((a, b) => a.elapsedSec - b.elapsedSec)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }

  const matchFastestAnswer = fastestAnswers[0] ?? null;

  const p1Timed = timedScoredRounds.filter((r) => r.winnerPlayerId === player1.id);
  const p2Timed = timedScoredRounds.filter((r) => r.winnerPlayerId === player2.id);

  const player1FastestSec =
    player1Stats.fastestAnswerSec ??
    (p1Timed.length > 0 ? Math.min(...p1Timed.map((r) => r.elapsedSec)) : null);
  const player2FastestSec =
    player2Stats.fastestAnswerSec ??
    (p2Timed.length > 0 ? Math.min(...p2Timed.map((r) => r.elapsedSec)) : null);

  const averageAnswerSec =
    timedScoredRounds.length > 0
      ? Number(
          (
            timedScoredRounds.reduce((acc, r) => acc + r.elapsedSec, 0) /
            timedScoredRounds.length
          ).toFixed(1)
        )
      : fastestAnswers.length > 0
      ? Number(
          (
            fastestAnswers.reduce((acc, r) => acc + r.elapsedSec, 0) /
            fastestAnswers.length
          ).toFixed(1)
        )
      : null;

  // Build curated key match moments
  const keyMoments: MatchKeyMoment[] = [];

  if (scoredRounds.length > 0) {
    const opener = scoredRounds[0];
    const openerIsUser = opener.winnerPlayerId === player1.id;
    const openerName = opener.winnerName || (openerIsUser ? player1.name : player2.name);
    keyMoments.push({
      id: 'opener',
      kind: 'opener',
      title: 'Açılış Golü',
      description: opener.acceptedAnswer
        ? `${openerName}, ${opener.acceptedAnswer} cevabıyla skoru açtı.`
        : `${openerName} maçın ilk golünü kaydetti.`,
      roundNumber: opener.roundNumber,
      playerName: openerName,
      isUser: openerIsUser,
      elapsedSec: opener.elapsedSec,
      scoreLabel: `${opener.scoreAfter.p1}-${opener.scoreAfter.p2}`,
    });
  }

  if (matchFastestAnswer) {
    keyMoments.push({
      id: 'fastest',
      kind: 'fastest',
      title: 'En Hızlı Refleks',
      description: matchFastestAnswer.answerText
        ? `${matchFastestAnswer.playerName}, ${matchFastestAnswer.elapsedSec.toFixed(1)} saniyede "${matchFastestAnswer.answerText}" dedi.`
        : `${matchFastestAnswer.playerName}, ${matchFastestAnswer.elapsedSec.toFixed(1)} saniye ile maçın en hızlı golünü attı.`,
      roundNumber: matchFastestAnswer.roundNumber,
      playerName: matchFastestAnswer.playerName,
      isUser: matchFastestAnswer.isUser,
      elapsedSec: matchFastestAnswer.elapsedSec,
      scoreLabel: null,
    });
  }

  const clutchRound = scoredRounds.find((r) => r.wasClutch);
  if (clutchRound) {
    const clutchIsUser = clutchRound.winnerPlayerId === player1.id;
    const clutchName =
      clutchRound.winnerName || (clutchIsUser ? player1.name : player2.name);
    keyMoments.push({
      id: 'clutch',
      kind: 'clutch',
      title: 'Son Saniye Golü',
      description: clutchRound.acceptedAnswer
        ? `${clutchName}, süre bitmek üzereyken "${clutchRound.acceptedAnswer}" ile golü buldu.`
        : `${clutchName}, son saniyelerde kritik turu hanesine yazdırdı.`,
      roundNumber: clutchRound.roundNumber,
      playerName: clutchName,
      isUser: clutchIsUser,
      elapsedSec: clutchRound.elapsedSec,
      scoreLabel: `${clutchRound.scoreAfter.p1}-${clutchRound.scoreAfter.p2}`,
    });
  } else if (player1Stats.trailedThenWon || player2Stats.trailedThenWon) {
    const comebackUser = player1Stats.trailedThenWon && player1Goals >= player2Goals;
    const comebackName = comebackUser ? player1.name : player2.name;
    keyMoments.push({
      id: 'comeback',
      kind: 'comeback',
      title: 'Geri Dönüş',
      description: `${comebackName} geriye düştüğü maçta skoru lehine çevirdi.`,
      roundNumber: null,
      playerName: comebackName,
      isUser: comebackUser,
      elapsedSec: null,
      scoreLabel: `${player1Goals}-${player2Goals}`,
    });
  }

  if (scoredRounds.length > 1) {
    const lastGoal = scoredRounds[scoredRounds.length - 1];
    const lastIsUser = lastGoal.winnerPlayerId === player1.id;
    const lastName = lastGoal.winnerName || (lastIsUser ? player1.name : player2.name);
    const isFinalWinner = player1Goals !== player2Goals;
    keyMoments.push({
      id: 'decider',
      kind: isFinalWinner ? 'decider' : 'draw',
      title: isFinalWinner ? 'Maç Golü' : 'Son Eşitlik Golü',
      description: lastGoal.acceptedAnswer
        ? `${lastName}, "${lastGoal.acceptedAnswer}" cevabıyla maç skorunu ${lastGoal.scoreAfter.p1}-${lastGoal.scoreAfter.p2} yaptı.`
        : `${lastName}, maçın son golünü attı (${lastGoal.scoreAfter.p1}-${lastGoal.scoreAfter.p2}).`,
      roundNumber: lastGoal.roundNumber,
      playerName: lastName,
      isUser: lastIsUser,
      elapsedSec: lastGoal.elapsedSec,
      scoreLabel: `${lastGoal.scoreAfter.p1}-${lastGoal.scoreAfter.p2}`,
    });
  } else if (totalGoals === 0) {
    keyMoments.push({
      id: 'goalless',
      kind: 'draw',
      title: 'Golsüz Düello',
      description: 'İki taraf da savunmada kaldı ve fileler havalanmadı.',
      roundNumber: null,
      playerName: null,
      isUser: null,
      elapsedSec: null,
      scoreLabel: '0-0',
    });
  }

  return {
    totalGoals,
    player1Goals,
    player2Goals,
    player1GoalSharePct,
    player2GoalSharePct,
    totalRoundsPlayed,
    decisiveGoalRounds,
    deadlockRounds,
    avgGoalsPerRound,
    totalAttempts,
    accuracyRatePct,
    fastestAnswers,
    matchFastestAnswer,
    player1FastestSec,
    player2FastestSec,
    averageAnswerSec,
    keyMoments,
    roundTimeline: roundHighlights,
  };
}
