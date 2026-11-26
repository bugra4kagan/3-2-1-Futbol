import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyReviewRound, filterReviewHighlights } from '../components/MatchReviewModal';
import { generateMinigameRounds } from './minigameEngine';
import { createEmptyXoxBoard } from './minigameEngine';
import { MatchRoundHighlight } from './types';

test('MatchReviewModal helpers classify and filter correct, wrong, and unanswered rounds across all 4 modes', () => {
  const twoClubs = generateMinigameRounds('two_clubs', 1)[0];
  const xox = generateMinigameRounds('xox', 1)[0];
  const career = generateMinigameRounds('career', 1)[0];
  const cc = generateMinigameRounds('country_club', 1)[0];

  const xoxBoard = createEmptyXoxBoard();
  xoxBoard[1][1] = { ownerId: 'p1', symbol: 'X', playerName: 'Test Player' };

  const highlights: MatchRoundHighlight[] = [
    {
      roundNumber: 1,
      minigameType: 'two_clubs',
      winnerPlayerId: 'p1',
      winnerName: 'Sen',
      acceptedAnswer: 'Cristiano Ronaldo',
      elapsedSec: 3.4,
      reason: 'scored',
      scoreAfter: { p1: 1, p2: 0 },
      roundPayload: twoClubs,
      userSubmittedAnswers: ['Cristiano Ronaldo'],
      didUserWin: true,
    },
    {
      roundNumber: 2,
      minigameType: 'career',
      winnerPlayerId: 'p2',
      winnerName: 'Rakip',
      acceptedAnswer: 'Lionel Messi',
      elapsedSec: 5.1,
      reason: 'scored',
      scoreAfter: { p1: 1, p2: 1 },
      roundPayload: career,
      userSubmittedAnswers: ['Neymar Jr'],
      didUserWin: false,
    },
    {
      roundNumber: 3,
      minigameType: 'country_club',
      winnerPlayerId: null,
      elapsedSec: null,
      reason: 'timeout',
      scoreAfter: { p1: 1, p2: 1 },
      roundPayload: cc,
      userSubmittedAnswers: [],
      didUserWin: false,
    },
    {
      roundNumber: 4,
      minigameType: 'xox',
      winnerPlayerId: 'p1',
      winnerName: 'Sen',
      acceptedAnswer: 'XOX 3-in-a-row',
      elapsedSec: 7.2,
      reason: 'scored',
      scoreAfter: { p1: 2, p2: 1 },
      roundPayload: xox,
      userSubmittedAnswers: ['Test Player'],
      didUserWin: true,
      xoxBoardSnapshot: xoxBoard,
    },
  ];

  assert.equal(classifyReviewRound(highlights[0]), 'correct');
  assert.equal(classifyReviewRound(highlights[1]), 'wrong');
  assert.equal(classifyReviewRound(highlights[2]), 'unanswered');
  assert.equal(classifyReviewRound(highlights[3]), 'correct');

  assert.equal(filterReviewHighlights(highlights, 'all').length, 4);
  assert.equal(filterReviewHighlights(highlights, 'correct').length, 2);
  assert.equal(filterReviewHighlights(highlights, 'wrong').length, 1);
  assert.equal(filterReviewHighlights(highlights, 'unanswered').length, 1);
});
