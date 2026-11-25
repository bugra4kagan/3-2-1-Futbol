import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  Clock,
  Lightbulb,
  Send,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { CLUBS, PLAYERS } from '../game/database';
import { getPlayerAsset } from '../game/playerAssets';
import {
  checkXoxBoardWinner,
  getRoundValidPlayerIds,
  validateMinigameAnswer,
} from '../game/minigameEngine';
import {
  MAX_SILHOUETTE_ATTEMPTS,
  compareSilhouetteGuess,
  resolveGuessedPlayerFromInput,
  searchPlayersForAutocomplete,
  summarizeSilhouetteClues,
  SilhouetteGuessResult,
} from '../game/silhouetteEngine';
import {
  chooseBotXoxCell,
  computeHumanizedBotDelayMs,
  getBotRoundPlan,
  getBotXoxTurnConfig,
  pickBotValidPlayer,
  pickBotWrongPlayer,
} from '../game/botEngine';
import {
  BotDifficulty,
  MinigameRoundPayload,
  Player,
  PlayerProfile,
  XoxCondition,
  XoxRuntimeState,
} from '../game/types';
import { sounds } from '../utils/audio';
import { haptics } from '../utils/haptics';
import { ClubBadge } from './ClubBadge';
import { CountryFlag } from './CountryFlag';
import { JokerControlPanel } from './JokerControlPanel';
import { PlayerAvatar } from './PlayerAvatar';
import { SilhouetteSvg } from './SilhouetteSvg';

interface MinigameArenaViewProps {
  round: MinigameRoundPayload;
  roundKey: string;
  player1: PlayerProfile;
  player2: PlayerProfile;
  isBotMatch?: boolean;
  isOnlineMatch?: boolean;
  botDifficulty?: BotDifficulty;
  timeRemaining: number;
  disabled?: boolean;
  energyDrinks?: number;
  extraTimeCards?: number;
  userCoins?: number;
  freeJokerTickets?: number;
  roundSeed?: string;
  onSpendCoinsForJoker?: (costCoins: number) => { ok: boolean; reason?: string };
  onUseEnergyDrinkHint?: () => boolean;
  onUseEnergyDrinkPass?: () => void;
  onUseExtraTimeCard?: () => boolean;
  onOpenStore?: () => void;
  // Standard answer submission
  onAnswerWinner: (winnerPlayerId: string, answer: string, playerName: string) => void;
  onBotWrongAttempt?: (guessedName: string) => void;
  onBotStatusChange?: (status: 'idle' | 'thinking' | 'answered') => void;
  onSubmitOnlineAnswer?: (answer: string, cellPos?: { row: number; col: number }) => void;
  serverWrongFeedback?: { attempt: string; seq: number } | null;
  opponentMissedPulse?: number;
  onWrongAttempt?: () => void;
  onSilhouetteExhausted?: () => void;
  onlineSilhouetteExhausted?: boolean;
  // XOX state & solo callbacks
  xoxState?: XoxRuntimeState | null;
  xoxNotice?: string | null;
  onSoloXoxMove?: (
    nextState: XoxRuntimeState,
    winnerId: string | null,
    roundEnded: boolean,
    playerName: string,
    wasCorrect: boolean
  ) => void;
}

const PlayerFaceThumb: React.FC<{
  playerId?: string;
  playerName: string;
  sizeClass?: string;
}> = ({ playerId, playerName, sizeClass = 'w-7 h-7' }) => {
  const resolvedPlayer = useMemo(() => {
    if (playerId && PLAYERS[playerId]) return PLAYERS[playerId];
    const norm = playerName.trim().toLowerCase();
    return (
      Object.values(PLAYERS).find(
        (p) => p.name.toLowerCase() === norm || p.commonName?.toLowerCase() === norm
      ) || null
    );
  }, [playerId, playerName]);

  return (
    <PlayerAvatar
      player={resolvedPlayer}
      name={playerName}
      size="sm"
      variant="circle"
      className={`${sizeClass} border border-white/25`}
    />
  );
};

const TeammatePortrait: React.FC<{ playerId: string; label: string }> = ({ playerId, label }) => {
  const player = PLAYERS[playerId] || null;
  return (
    <PlayerAvatar
      player={player}
      name={label}
      size="sm"
      variant="circle"
      className="!w-7 !h-7 sm:!w-9 sm:!h-9 border border-amber-400/60 shadow"
    />
  );
};

export const MinigameArenaView: React.FC<MinigameArenaViewProps> = ({
  round,
  roundKey,
  player1,
  player2,
  isBotMatch = false,
  isOnlineMatch = false,
  botDifficulty = 'medium',
  timeRemaining = 15,
  disabled = false,
  userCoins = 0,
  freeJokerTickets = 0,
  roundSeed,
  onSpendCoinsForJoker,
  onAnswerWinner,
  onBotWrongAttempt,
  onBotStatusChange,
  onSubmitOnlineAnswer,
  serverWrongFeedback = null,
  opponentMissedPulse = 0,
  onWrongAttempt,
  onSilhouetteExhausted,
  onlineSilhouetteExhausted = false,
  xoxState = null,
  xoxNotice = null,
  onSoloXoxMove,
}) => {
  const [answerInput, setAnswerInput] = useState('');
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [isShake, setIsShake] = useState(false);
  const [showOpponentMissed, setShowOpponentMissed] = useState(false);
  const [botFeedbackToast, setBotFeedbackToast] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [silhouetteGuesses, setSilhouetteGuesses] = useState<SilhouetteGuessResult[]>([]);
  const [silhouetteRevealed, setSilhouetteRevealed] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const exhaustTimerRef = useRef<NodeJS.Timeout | null>(null);
  const botAttemptedRoundKeyRef = useRef<string | null>(null);

  const isXox = round.minigameType === 'xox';
  const isSilhouette = round.minigameType === 'silhouette';
  const isMyXoxTurn =
    isXox && xoxState ? xoxState.currentTurnPlayerId === player1.id : true;
  const attemptsUsed = silhouetteGuesses.length;
  const attemptsRemaining = Math.max(0, MAX_SILHOUETTE_ATTEMPTS - attemptsUsed);
  const isSilhouetteExhausted =
    isSilhouette && (attemptsUsed >= MAX_SILHOUETTE_ATTEMPTS || onlineSilhouetteExhausted);

  // Reset per-round state
  useEffect(() => {
    if (exhaustTimerRef.current) {
      clearTimeout(exhaustTimerRef.current);
      exhaustTimerRef.current = null;
    }
    setErrorToast(null);
    setBotFeedbackToast(null);
    setAnswerInput('');
    setSelectedCell(null);
    setSilhouetteGuesses([]);
    setSilhouetteRevealed(false);
    setShowAutocomplete(false);
  }, [roundKey]);

  useEffect(() => {
    return () => {
      if (exhaustTimerRef.current) clearTimeout(exhaustTimerRef.current);
    };
  }, []);

  // Focus input when active round begins
  useEffect(() => {
    if (!disabled && !isXox) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [roundKey, disabled, isXox]);

  // Clear selected cell if it gets claimed
  useEffect(() => {
    if (!isXox || !xoxState || !selectedCell) return;
    if (xoxState.board[selectedCell.row]?.[selectedCell.col] !== null) {
      setSelectedCell(null);
    }
  }, [isXox, xoxState, selectedCell]);

  // Server wrong feedback
  useEffect(() => {
    if (!isOnlineMatch || !serverWrongFeedback) return;
    sounds.playWrong();
    haptics.wrong();
    setIsShake(true);
    setErrorToast(
      isXox
        ? `"${serverWrongFeedback.attempt}" bu kare için geçersiz! Sıra rakibe geçti.`
        : isSilhouette
        ? `"${serverWrongFeedback.attempt}" doğru futbolcu değil — ipuçlarını incele!`
        : `"${serverWrongFeedback.attempt}" doğru değil, tekrar dene!`
    );
    const t = setTimeout(() => setIsShake(false), 500);
    return () => clearTimeout(t);
  }, [isOnlineMatch, serverWrongFeedback, isXox, isSilhouette]);

  // Opponent wrong guess pulse
  useEffect(() => {
    if (!isOnlineMatch || opponentMissedPulse <= 0) return;
    setShowOpponentMissed(true);
    const t = setTimeout(() => setShowOpponentMissed(false), 2200);
    return () => clearTimeout(t);
  }, [isOnlineMatch, opponentMissedPulse]);

  // Bot AI for silhouette / career / country_club (first-to-answer, max 1 attempt per round, stable across 1s ticks)
  const botRoundRef = useRef(round);
  const botXoxStateRef = useRef(xoxState);
  const botTimeRemainingRef = useRef(timeRemaining);
  const botDisabledRef = useRef(disabled);
  const botP1Ref = useRef(player1);
  const botP2Ref = useRef(player2);
  const botOnWinnerRef = useRef(onAnswerWinner);
  const botOnWrongRef = useRef(onBotWrongAttempt);
  const botOnStatusRef = useRef(onBotStatusChange);
  const botOnXoxMoveRef = useRef(onSoloXoxMove);

  botRoundRef.current = round;
  botXoxStateRef.current = xoxState;
  botTimeRemainingRef.current = timeRemaining;
  botDisabledRef.current = disabled;
  botP1Ref.current = player1;
  botP2Ref.current = player2;
  botOnWinnerRef.current = onAnswerWinner;
  botOnWrongRef.current = onBotWrongAttempt;
  botOnStatusRef.current = onBotStatusChange;
  botOnXoxMoveRef.current = onSoloXoxMove;

  useEffect(() => {
    const activeRound = botRoundRef.current;
    if (!isBotMatch || isOnlineMatch || disabled || isXox) {
      if (!isXox) botOnStatusRef.current?.('idle');
      return;
    }

    const validIds = getRoundValidPlayerIds(activeRound);
    const validPlayers = validIds.map((id) => PLAYERS[id]).filter(Boolean);
    if (validPlayers.length === 0) {
      botOnStatusRef.current?.('idle');
      return;
    }

    if (botAttemptedRoundKeyRef.current === roundKey) {
      botOnStatusRef.current?.('answered');
      return;
    }

    botOnStatusRef.current?.('thinking');
    const plan = getBotRoundPlan(botDifficulty, activeRound.minigameType, validPlayers.length);
    const maxRemainingMs = Math.max(900, botTimeRemainingRef.current * 1000);
    const delay = computeHumanizedBotDelayMs(plan, Math.random, maxRemainingMs);

    const botTimer = setTimeout(() => {
      const latestBot = botP2Ref.current;
      if (botDisabledRef.current || botAttemptedRoundKeyRef.current === roundKey) return;
      botAttemptedRoundKeyRef.current = roundKey;
      botOnStatusRef.current?.('answered');

      if (Math.random() < plan.accuracy) {
        const chosen = pickBotValidPlayer(validPlayers);
        if (chosen) {
          botOnWinnerRef.current(latestBot.id, chosen.name, chosen.name);
        }
      } else {
        const wrongPlayer = pickBotWrongPlayer(validIds);
        const wrongName = wrongPlayer?.name || 'Yanlış Tahmin';
        botOnWrongRef.current?.(wrongName);
        setBotFeedbackToast(`${latestBot.name} yanlış tahmin yaptı!`);
        setTimeout(() => setBotFeedbackToast(null), 2200);
      }
    }, delay);

    return () => clearTimeout(botTimer);
  }, [roundKey, disabled, isBotMatch, isOnlineMatch, isXox, botDifficulty]);

  // Bot AI for Solo XOX turn (Tactical win / block / center / corner, stable across 1s ticks)
  const xoxTurnOwner = xoxState?.currentTurnPlayerId ?? null;
  const xoxMoveCount = xoxState
    ? xoxState.board.flat().filter((cell) => cell !== null).length
    : 0;

  useEffect(() => {
    const activeRound = botRoundRef.current;
    const activeXoxState = botXoxStateRef.current;
    const latestP1 = botP1Ref.current;
    const latestP2 = botP2Ref.current;
    if (
      !isBotMatch ||
      isOnlineMatch ||
      disabled ||
      !isXox ||
      !activeXoxState ||
      !activeRound.xoxBoard ||
      !botOnXoxMoveRef.current
    ) {
      if (isXox) botOnStatusRef.current?.('idle');
      return;
    }
    if (activeXoxState.currentTurnPlayerId !== latestP2.id) {
      botOnStatusRef.current?.('idle');
      return;
    }

    botOnStatusRef.current?.('thinking');
    const { delayMs, missRate } = getBotXoxTurnConfig(botDifficulty);

    const t = setTimeout(() => {
      const curState = botXoxStateRef.current;
      const curRound = botRoundRef.current;
      const p1 = botP1Ref.current;
      const p2 = botP2Ref.current;
      const moveCb = botOnXoxMoveRef.current;
      if (botDisabledRef.current || !curState || !moveCb) return;
      if (curState.currentTurnPlayerId !== p2.id) return;
      botOnStatusRef.current?.('answered');

      const chosenCell = chooseBotXoxCell(
        curState.board,
        p2.id,
        p1.id,
        curRound,
        botDifficulty
      );
      if (!chosenCell) return;

      const validIds = getRoundValidPlayerIds(curRound, chosenCell);

      if (Math.random() < missRate) {
        const wrongPlayer = pickBotWrongPlayer(validIds);
        botOnWrongRef.current?.(wrongPlayer?.name || '');
        moveCb(
          {
            ...curState,
            currentTurnPlayerId: p1.id,
            turnTimeRemaining: 15,
          },
          null,
          false,
          wrongPlayer?.name || '',
          false
        );
        return;
      }

      const validPlayers = validIds.map((id) => PLAYERS[id]).filter(Boolean);
      const chosenPlayer = pickBotValidPlayer(validPlayers);
      const playerName = chosenPlayer?.name || PLAYERS[validIds[0]]?.name || 'Bilinmeyen';

      const nextBoard = curState.board.map((row) => [...row]);
      nextBoard[chosenCell.row][chosenCell.col] = {
        ownerId: p2.id,
        symbol: 'O',
        playerName,
      };

      const winCheck = checkXoxBoardWinner(nextBoard);
      const nextState: XoxRuntimeState = {
        board: nextBoard,
        currentTurnPlayerId: p1.id,
        turnTimeRemaining: 15,
        winningCells: winCheck.winningCells,
      };

      const isEnded = Boolean(winCheck.winnerId) || winCheck.isBoardFull;
      moveCb(nextState, winCheck.winnerId, isEnded, playerName, true);
    }, delayMs);

    return () => clearTimeout(t);
  }, [roundKey, isBotMatch, isOnlineMatch, disabled, isXox, xoxTurnOwner, xoxMoveCount, botDifficulty]);

  const guessedPlayerIds = useMemo(
    () => silhouetteGuesses.map((g) => g.guessedPlayer.id),
    [silhouetteGuesses]
  );

  const autocompletePlayers = useMemo(() => {
    if (disabled) return [];
    const exclude = isSilhouette ? guessedPlayerIds : [];
    return searchPlayersForAutocomplete(answerInput, exclude, 6);
  }, [isSilhouette, disabled, answerInput, guessedPlayerIds]);

  const submitSilhouettePlayer = (picked: Player | null, fallbackText: string) => {
    if (!round.silhouette || isSilhouetteExhausted) return;
    const targetId = round.silhouette.playerId;

    if (!picked) {
      sounds.playWrong();
      haptics.wrong();
      onWrongAttempt?.();
      setIsShake(true);
      setErrorToast(
        isOnlineMatch
          ? `"${fallbackText}" listede bulunamadı, önerilerden seç!`
          : `Yanlış Tahmin! -3 sn • "${fallbackText}" listede bulunamadı!`
      );
      setTimeout(() => setIsShake(false), 450);
      setShowAutocomplete(false);
      return;
    }

    if (picked.id === targetId) {
      setShowAutocomplete(false);
      setAnswerInput('');
      setErrorToast(null);
      setSilhouetteRevealed(true);
      if (isOnlineMatch && onSubmitOnlineAnswer) {
        onSubmitOnlineAnswer(picked.name);
        return;
      }
      haptics.correct();
      onAnswerWinner(player1.id, picked.name, picked.name);
      return;
    }

    if (guessedPlayerIds.includes(picked.id)) {
      setErrorToast(`${picked.name} zaten tahmin edildi!`);
      setAnswerInput('');
      setShowAutocomplete(false);
      return;
    }

    const nextCount = silhouetteGuesses.length + 1;
    const comparison = compareSilhouetteGuess(picked.id, targetId);
    if (comparison) {
      setSilhouetteGuesses((prev) => [comparison, ...prev]);
    }
    setAnswerInput('');
    setShowAutocomplete(false);

    if (isOnlineMatch && onSubmitOnlineAnswer) {
      setErrorToast(null);
      onSubmitOnlineAnswer(picked.name);
      return;
    }

    sounds.playWrong();
    haptics.wrong();
    onWrongAttempt?.();
    setIsShake(true);
    setTimeout(() => setIsShake(false), 450);

    if (nextCount >= MAX_SILHOUETTE_ATTEMPTS && onSilhouetteExhausted) {
      setErrorToast('Yanlış Tahmin! -3 sn • 8/8 deneme hakkın doldu — 0 Puan!');
      exhaustTimerRef.current = setTimeout(() => {
        exhaustTimerRef.current = null;
        onSilhouetteExhausted();
      }, 450);
    } else {
      setErrorToast(`Yanlış Tahmin! -3 sn • "${picked.name}" değil, ipuçlarına bak!`);
    }
  };

  const submitAnswerValue = (rawVal: string) => {
    if (disabled || !rawVal.trim()) return;
    const val = rawVal.trim();

    if (isSilhouette && round.silhouette) {
      const resolved = resolveGuessedPlayerFromInput(val, round.silhouette.playerId);
      submitSilhouettePlayer(resolved, val);
      return;
    }

    if (isXox) {
      if (!isMyXoxTurn) {
        setErrorToast('Şu an sıra rakipte!');
        return;
      }
      if (!selectedCell) {
        setIsShake(true);
        setErrorToast('Önce yukarıdan boş bir kare seç!');
        setTimeout(() => setIsShake(false), 450);
        return;
      }
      if (isOnlineMatch && onSubmitOnlineAnswer) {
        onSubmitOnlineAnswer(val, selectedCell);
        setAnswerInput('');
        setShowAutocomplete(false);
        setErrorToast(null);
        return;
      }

      if (!xoxState || !onSoloXoxMove) return;
      const result = validateMinigameAnswer(round, val, selectedCell);
      if (result.isValid && result.player) {
        sounds.playCorrect();
        haptics.correct();
        const nextBoard = xoxState.board.map((row) => [...row]);
        nextBoard[selectedCell.row][selectedCell.col] = {
          ownerId: player1.id,
          symbol: 'X',
          playerName: result.player.name,
        };
        const winCheck = checkXoxBoardWinner(nextBoard);
        const nextState: XoxRuntimeState = {
          board: nextBoard,
          currentTurnPlayerId: player2.id,
          turnTimeRemaining: 15,
          winningCells: winCheck.winningCells,
        };
        const isEnded = Boolean(winCheck.winnerId) || winCheck.isBoardFull;
        setAnswerInput('');
        setShowAutocomplete(false);
        setErrorToast(null);
        setSelectedCell(null);
        onSoloXoxMove(nextState, winCheck.winnerId, isEnded, result.player.name, true);
      } else {
        sounds.playWrong();
        haptics.wrong();
        onWrongAttempt?.();
        setIsShake(true);
        setErrorToast(`Yanlış Tahmin! -3 sn • "${val}" bu kare için geçersiz!`);
        setTimeout(() => setIsShake(false), 450);
        setAnswerInput('');
        setShowAutocomplete(false);
        setSelectedCell(null);
        onSoloXoxMove(
          {
            ...xoxState,
            currentTurnPlayerId: player2.id,
            turnTimeRemaining: 15,
          },
          null,
          false,
          '',
          false
        );
      }
      return;
    }

    // Standard first-to-answer (career, country_club)
    if (isOnlineMatch && onSubmitOnlineAnswer) {
      onSubmitOnlineAnswer(val);
      setAnswerInput('');
      setShowAutocomplete(false);
      setErrorToast(null);
      return;
    }

    const result = validateMinigameAnswer(round, val);
    if (result.isValid && result.player) {
      haptics.correct();
      onAnswerWinner(player1.id, val, result.player.name);
      setAnswerInput('');
      setShowAutocomplete(false);
      setErrorToast(null);
    } else {
      sounds.playWrong();
      haptics.wrong();
      onWrongAttempt?.();
      setIsShake(true);
      setErrorToast(`Yanlış Tahmin! -3 sn • "${val}" doğru cevap değil!`);
      setTimeout(() => setIsShake(false), 450);
      setAnswerInput('');
      setShowAutocomplete(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    submitAnswerValue(answerInput);
  };

  // Helper to render XOX row/col condition header
  const renderXoxAxisCell = (cond: XoxCondition, isRowHeader: boolean) => {
    if (cond.type === 'club' && CLUBS[cond.id]) {
      const club = CLUBS[cond.id];
      return (
        <div
          className={`flex flex-col items-center justify-center text-center p-1 sm:p-1.5 rounded-xl bg-slate-900/95 border border-slate-700/80 min-w-0 ${
            isRowHeader ? 'h-full min-h-[72px] sm:min-h-[82px]' : 'h-full min-h-[68px] sm:min-h-[76px]'
          }`}
        >
          <ClubBadge club={club} size="xs" className="!w-7 !h-7 sm:!w-9 sm:!h-9 shrink-0" />
          <span className="mt-1 w-full text-center text-[10px] sm:text-[11px] font-extrabold text-white leading-tight line-clamp-2 break-words">
            {club.name}
          </span>
        </div>
      );
    }

    if (cond.type === 'teammate') {
      return (
        <div
          className={`flex flex-col items-center justify-center text-center p-1 sm:p-1.5 rounded-xl bg-amber-950/50 border border-amber-500/40 min-w-0 ${
            isRowHeader ? 'h-full min-h-[72px] sm:min-h-[82px]' : 'h-full min-h-[68px] sm:min-h-[76px]'
          }`}
        >
          <TeammatePortrait playerId={cond.id} label={cond.label} />
          <span className="mt-1 w-full text-center text-[10px] sm:text-[11px] font-black text-amber-200 leading-tight line-clamp-2 break-words">
            {cond.label}
          </span>
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col items-center justify-center text-center p-1 sm:p-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 min-w-0 ${
          isRowHeader ? 'h-full min-h-[72px] sm:min-h-[82px]' : 'h-full min-h-[68px] sm:min-h-[76px]'
        }`}
      >
        <CountryFlag country={cond.id} flag={cond.flag} size="md" />
        <span className="mt-1 w-full text-center text-[10px] sm:text-[11px] font-black text-emerald-200 leading-tight line-clamp-2 break-words">
          {cond.label}
        </span>
      </div>
    );
  };

  const silhouetteTarget = round.silhouette ? PLAYERS[round.silhouette.playerId] : null;
  const silhouetteAsset = round.silhouette ? getPlayerAsset(round.silhouette.playerId) : null;
  const silhouetteClub = round.silhouette ? CLUBS[round.silhouette.hintClubId] : null;
  const silhouetteClueSummary = useMemo(() => {
    if (!isSilhouette || !round.silhouette) return null;
    return summarizeSilhouetteClues(silhouetteGuesses, round.silhouette.playerId);
  }, [isSilhouette, round.silhouette, silhouetteGuesses]);

  const selectedXoxPrompt = useMemo(() => {
    if (!isXox || !round.xoxBoard || !selectedCell) return null;
    const rCond = round.xoxBoard.rows[selectedCell.row];
    const cCond = round.xoxBoard.cols[selectedCell.col];
    const rName = rCond.type === 'club' && CLUBS[rCond.id] ? CLUBS[rCond.id].name : rCond.label;
    const cName = cCond.type === 'club' && CLUBS[cCond.id] ? CLUBS[cCond.id].name : cCond.label;
    return `${rName} × ${cName}`;
  }, [isXox, round.xoxBoard, selectedCell]);

  const inputDisabled = disabled || (isXox && !isMyXoxTurn) || isSilhouetteExhausted;

  return (
    <div
      data-testid={`minigame-arena-${round.minigameType}`}
      className={`w-full flex flex-col items-center flex-1 min-h-0 overflow-y-auto overscroll-contain py-1.5 sm:py-3 px-2.5 sm:px-4 ${
        isSilhouette ? 'justify-start gap-1 pb-6' : 'justify-between'
      }`}
    >
      {/* 1. FUTBOLCUYU TAHMİN ET (8-ATTEMPT BLURRED PORTRAIT & CLUES) */}
      {isSilhouette && round.silhouette && (
        <div
          key={roundKey}
          className="w-full max-w-lg flex flex-col items-center text-center animate-card-pop"
        >
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
              FUTBOLCUYU TAHMİN ET • 2 DK
            </span>
            <span
              data-testid="silhouette-attempts-badge"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] sm:text-[11px] font-black uppercase tracking-wider tabular-nums ${
                attemptsRemaining <= 2
                  ? 'bg-rose-950/90 border-rose-500/70 text-rose-300'
                  : 'bg-slate-900 border-emerald-500/40 text-emerald-300'
              }`}
            >
              Kalan Hak: {attemptsRemaining}/{MAX_SILHOUETTE_ATTEMPTS}
            </span>
          </div>

          <SilhouetteSvg
            pose={round.silhouette.pose}
            jerseyNumber={round.silhouette.jerseyNumber}
            player={silhouetteTarget}
            asset={silhouetteAsset}
            club={silhouetteClub}
            wrongGuessCount={silhouetteGuesses.length}
            revealed={silhouetteRevealed}
          />

          {/* 8-Attempt Pip Progress Indicator */}
          <div
            className="flex items-center justify-center gap-1.5 mt-2"
            aria-label={`Deneme hakkı ${attemptsUsed}/${MAX_SILHOUETTE_ATTEMPTS}`}
          >
            {Array.from({ length: MAX_SILHOUETTE_ATTEMPTS }).map((_, idx) => {
              const used = idx < attemptsUsed;
              return (
                <span
                  key={idx}
                  className={`h-1.5 w-5 sm:w-6 rounded-full transition-colors ${
                    used ? 'bg-rose-500' : 'bg-emerald-500/35 border border-emerald-400/40'
                  }`}
                />
              );
            })}
          </div>

          {/* Prominent 5-Column Clue Summary Board */}
          {silhouetteClueSummary && (
            <div
              data-testid="silhouette-clue-board"
              className="w-full mt-2.5 p-2.5 rounded-2xl bg-slate-900/95 border border-cyan-500/30 shadow-xl"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                  Açılan İpuçları
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  Her tahminde güncellenir
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 text-center">
                {/* 1. TAKIM */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full h-12 rounded-xl border px-1 flex flex-col items-center justify-center text-[10px] font-black leading-tight ${
                      silhouetteClueSummary.team.status === 'exact'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                        : silhouetteClueSummary.team.status === 'league'
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-slate-950/90 text-slate-400 border-slate-700'
                    }`}
                    title={silhouetteClueSummary.team.label}
                  >
                    {silhouetteClueSummary.team.status === 'exact' ? (
                      <ClubBadge
                        clubId={silhouetteClueSummary.team.clubId}
                        clubName={silhouetteClueSummary.team.clubName}
                        size="xs"
                        className="!w-7 !h-7"
                      />
                    ) : (
                      <span className="line-clamp-2">{silhouetteClueSummary.team.label}</span>
                    )}
                  </div>
                  <span className="mt-1 text-[9px] font-extrabold text-slate-300 uppercase tracking-wider">
                    TAKIM
                  </span>
                </div>

                {/* 2. ÜLKE */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full h-12 rounded-xl border px-1 flex items-center justify-center text-[11px] font-black ${
                      silhouetteClueSummary.nationality.status === 'exact'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                        : 'bg-slate-950/90 text-slate-400 border-slate-700'
                    }`}
                    title={silhouetteClueSummary.nationality.label}
                  >
                    {silhouetteClueSummary.nationality.status === 'exact' ? (
                      <CountryFlag
                        country={silhouetteClueSummary.nationality.country}
                        flag={silhouetteClueSummary.nationality.flag}
                        size="md"
                        variant="circle"
                      />
                    ) : (
                      <span>?</span>
                    )}
                  </div>
                  <span className="mt-1 text-[9px] font-extrabold text-slate-300 uppercase tracking-wider">
                    ÜLKE
                  </span>
                </div>

                {/* 3. MEVKİ */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full h-12 rounded-xl border px-1 flex items-center justify-center text-xs sm:text-sm font-black ${
                      silhouetteClueSummary.position.status === 'exact'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                        : 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                    }`}
                  >
                    {silhouetteClueSummary.position.label}
                  </div>
                  <span className="mt-1 text-[9px] font-extrabold text-slate-300 uppercase tracking-wider">
                    MEVKİ
                  </span>
                </div>

                {/* 4. YAŞ */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full h-12 rounded-xl border px-1 flex items-center justify-center text-xs sm:text-sm font-black tabular-nums ${
                      silhouetteClueSummary.age.status === 'exact'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                        : silhouetteClueSummary.age.status === 'range'
                        ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                        : 'bg-slate-950/90 text-slate-400 border-slate-700'
                    }`}
                  >
                    {silhouetteClueSummary.age.label}
                  </div>
                  <span className="mt-1 text-[9px] font-extrabold text-slate-300 uppercase tracking-wider">
                    YAŞ
                  </span>
                </div>

                {/* 5. FORMA */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-full h-12 rounded-xl border px-1 flex items-center justify-center text-xs sm:text-sm font-mono font-black tabular-nums ${
                      silhouetteClueSummary.shirtNumber.status === 'exact'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                        : silhouetteClueSummary.shirtNumber.status === 'range'
                        ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                        : 'bg-slate-950/90 text-slate-400 border-slate-700'
                    }`}
                  >
                    {silhouetteClueSummary.shirtNumber.label}
                  </div>
                  <span className="mt-1 text-[9px] font-extrabold text-slate-300 uppercase tracking-wider">
                    FORMA
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Color Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 text-[11px] font-semibold text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Doğru eşleşme
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              Aynı lig
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
              Daraltılan aralık
            </span>
          </div>
        </div>
      )}

      {/* 2. CAREER TIMELINE GAME (VERTICAL ALT ALTA LAYOUT) */}
      {round.minigameType === 'career' && round.career && (
        <div
          key={roundKey}
          className="w-full max-w-md my-auto flex flex-col items-center animate-card-pop"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[11px] font-black uppercase tracking-wider mb-3">
            KARİYER YOLUNDAN FUTBOLCUYU BUL
          </span>

          <div
            data-testid="career-vertical-timeline"
            className="w-full p-3 sm:p-4 rounded-3xl bg-slate-900/96 border border-slate-700/80 shadow-2xl max-h-[42dvh] sm:max-h-[52dvh] overflow-y-auto"
          >
            <div className="flex flex-col items-stretch gap-1.5">
              {round.career.steps.map((step, idx) => {
                const club = step.clubId ? CLUBS[step.clubId] : null;
                return (
                  <React.Fragment key={`${step.clubName}-${idx}`}>
                    <div
                      data-testid={`career-step-row-${idx}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ClubBadge
                          club={club}
                          clubId={step.clubId}
                          clubName={step.clubName}
                          size="sm"
                          className="!w-10 !h-10 sm:!w-11 sm:!h-11 shrink-0"
                        />
                        <div className="min-w-0 text-left">
                          <span className="block font-extrabold text-xs sm:text-sm text-white leading-tight line-clamp-2 break-words">
                            {step.clubName}
                          </span>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <CountryFlag flag={step.countryFlag} size="xs" />
                            <span className="text-[10px] font-bold text-slate-400">
                              {idx === round.career!.steps.length - 1 ? 'Son Durak' : `${idx + 1}. Kulüp`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-sky-500/30 text-[11px] font-mono font-black text-sky-400 shrink-0 tabular-nums">
                        {step.years}
                      </span>
                    </div>

                    {idx < round.career!.steps.length - 1 && (
                      <div className="flex items-center justify-center text-sky-400/70 py-0.5">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. COUNTRY + CLUB GAME */}
      {round.minigameType === 'country_club' && round.countryClub && (
        <div
          key={roundKey}
          className="w-full max-w-xl my-auto flex flex-col items-center animate-card-pop"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-400/40 text-rose-300 text-[11px] font-black uppercase tracking-wider mb-3">
            1 ÜLKE + 1 KULÜP ORTAK FUTBOLCU
          </span>

          <div className="w-full flex items-stretch justify-center gap-2 sm:gap-6">
            {/* Country Card */}
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center p-3 sm:p-5 rounded-2xl bg-slate-900/96 border border-slate-700/80 shadow-xl">
              <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-slate-950 border border-slate-700/80 flex items-center justify-center shadow-inner p-2">
                <CountryFlag
                  country={round.countryClub.country}
                  flag={round.countryClub.countryFlag}
                  size="xl"
                />
              </div>
              <h3 className="mt-2.5 font-black text-sm sm:text-lg text-white leading-tight">
                {round.countryClub.country}
              </h3>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-300 mt-0.5">
                MİLLİYET
              </span>
            </div>

            {/* Link Badge */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-rose-500 text-white font-black flex items-center justify-center shadow-lg shadow-rose-500/30 text-base sm:text-lg">
                +
              </div>
              <span className="text-[9px] sm:text-[10px] text-rose-300 font-bold uppercase mt-1">
                YILDIZ
              </span>
            </div>

            {/* Club Card */}
            {CLUBS[round.countryClub.clubId] && (
              <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center p-3 sm:p-5 rounded-2xl bg-slate-900/96 border border-slate-700/80 shadow-xl">
                <ClubBadge club={CLUBS[round.countryClub.clubId]} size="lg" />
                <h3 className="mt-2.5 w-full text-center font-black text-xs sm:text-base text-white line-clamp-2 leading-tight break-words">
                  {CLUBS[round.countryClub.clubId].name}
                </h3>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5">
                  {CLUBS[round.countryClub.clubId].country}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. FUTBOL XOX (3x3) */}
      {isXox && round.xoxBoard && xoxState && (
        <div
          key={roundKey}
          className="w-full max-w-lg my-auto flex flex-col items-center animate-card-pop"
        >
          <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-2">
            <div
              data-testid="xox-turn-banner"
              className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow ${
                isMyXoxTurn
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-400/50 text-amber-200 animate-pulse'
              }`}
            >
              <span>
                {isMyXoxTurn
                  ? '⚡ Sıra Sende! Kare seç ve yaz'
                  : `⏳ ${player2.name} düşünüyor...`}
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {round.xoxBoard.title}
            </span>
          </div>

          {xoxNotice && (
            <div className="w-full mb-2 px-3 py-1.5 rounded-xl bg-amber-950/75 border border-amber-500/40 text-amber-200 text-xs font-bold text-center">
              {xoxNotice}
            </div>
          )}

          <div className="w-full grid grid-cols-[84px_repeat(3,minmax(0,1fr))] sm:grid-cols-[120px_repeat(3,minmax(0,1fr))] gap-1.5 sm:gap-2">
            <div className="flex flex-col items-center justify-center rounded-xl bg-slate-950/90 border border-slate-800 p-1 text-center">
              <span className="text-xs sm:text-sm font-black text-purple-300">XOX</span>
              <span className="text-[9px] text-slate-500 font-bold">3'lü Yap!</span>
            </div>

            {round.xoxBoard.cols.map((colCond, cIdx) => (
              <div key={`col-${cIdx}`}>{renderXoxAxisCell(colCond, false)}</div>
            ))}

            {round.xoxBoard.rows.map((rowCond, rIdx) => (
              <React.Fragment key={`row-${rIdx}`}>
                <div>{renderXoxAxisCell(rowCond, true)}</div>

                {[0, 1, 2].map((cIdx) => {
                  const mark = xoxState.board[rIdx]?.[cIdx] || null;
                  const isCellSelected =
                    selectedCell?.row === rIdx && selectedCell?.col === cIdx;
                  const isWinningCell = Boolean(
                    xoxState.winningCells?.some(([wr, wc]) => wr === rIdx && wc === cIdx)
                  );
                  const isMine = mark?.ownerId === player1.id;

                  return (
                    <button
                      key={`cell-${rIdx}-${cIdx}`}
                      type="button"
                      data-testid={`xox-cell-${rIdx}-${cIdx}`}
                      disabled={disabled || Boolean(mark) || !isMyXoxTurn}
                      onClick={() => {
                        if (mark || disabled || !isMyXoxTurn) return;
                        setSelectedCell({ row: rIdx, col: cIdx });
                        setErrorToast(null);
                        setTimeout(() => inputRef.current?.focus(), 40);
                      }}
                      className={`min-h-[64px] sm:min-h-[76px] p-1 sm:p-1.5 rounded-xl border flex flex-col items-center justify-center text-center transition relative focus:outline-none ${
                        mark
                          ? isMine
                            ? `bg-emerald-950/75 ${
                                isWinningCell
                                  ? 'border-amber-400 ring-2 ring-amber-400/60'
                                  : 'border-emerald-500/60'
                              }`
                            : `bg-rose-950/70 ${
                                isWinningCell
                                  ? 'border-amber-400 ring-2 ring-amber-400/60'
                                  : 'border-rose-500/60'
                              }`
                          : isCellSelected
                          ? 'bg-purple-900/50 border-purple-400 ring-2 ring-purple-400/50 cursor-pointer'
                          : isMyXoxTurn && !disabled
                          ? 'bg-slate-900/85 hover:bg-slate-800 border-slate-700 hover:border-emerald-400/70 cursor-pointer active:scale-95'
                          : 'bg-slate-950/70 border-slate-800/80 opacity-75 cursor-not-allowed'
                      }`}
                    >
                      {mark ? (
                        <>
                          <div className="flex items-center gap-1">
                            <PlayerFaceThumb
                              playerName={mark.playerName}
                              sizeClass="w-5 h-5 sm:w-6 sm:h-6"
                            />
                            <span
                              className={`text-base sm:text-lg font-black leading-none ${
                                isMine ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {mark.symbol}
                            </span>
                          </div>
                          <span className="mt-0.5 text-[9px] sm:text-[10px] font-bold text-white leading-tight line-clamp-2">
                            {mark.playerName}
                          </span>
                        </>
                      ) : (
                        <span
                          className={`text-lg sm:text-xl font-black ${
                            isCellSelected ? 'text-purple-300' : 'text-slate-600'
                          }`}
                        >
                          {isCellSelected ? '✓' : '+'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Answer Input Section (placed cleanly above Who Are Ya guess rows in Silhouette mode) */}
      <div className={`w-full max-w-lg ${isSilhouette ? 'mt-3 mb-2' : 'max-w-md mt-auto mb-1.5 pt-2'}`}>
        {selectedXoxPrompt && (
          <div className="mb-1.5 px-3 py-1 rounded-xl bg-purple-950/80 border border-purple-400/50 text-purple-200 text-xs font-bold flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            <span className="truncate">Seçili Kare: {selectedXoxPrompt}</span>
          </div>
        )}

        {showOpponentMissed && (
          <div className="mb-1.5 px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
            <span>⚡ {player2.name} yanlış tahmin yaptı! Sıra sende!</span>
          </div>
        )}

        {errorToast && (
          <div
            data-testid="wrong-guess-alert"
            className="mb-1.5 p-2 rounded-xl bg-red-950/90 border border-red-500/75 text-red-200 text-xs font-bold flex items-center gap-2 shadow-[0_0_16px_rgba(239,68,68,0.35)] animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{errorToast}</span>
          </div>
        )}

        <div className="relative">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              data-testid="match-answer-input"
              value={answerInput}
              onFocus={() => setShowAutocomplete(true)}
              onBlur={() => {
                setTimeout(() => setShowAutocomplete(false), 180);
              }}
              onChange={(e) => {
                setAnswerInput(e.target.value);
                setShowAutocomplete(true);
              }}
              disabled={inputDisabled}
              placeholder={
                isSilhouetteExhausted
                  ? '8/8 deneme hakkın bitti!'
                  : disabled
                  ? 'Tur bekleniyor...'
                  : isXox
                  ? isMyXoxTurn
                    ? selectedCell
                      ? 'Bu kareye uygun futbolcuyu yaz (2+ harf)...'
                      : 'Önce yukarıdan boş bir kare seç...'
                    : `${player2.name} hamlesi bekleniyor...`
                  : isSilhouette
                  ? 'Futbolcu adı yaz veya listeden seç...'
                  : 'Futbolcunun adını yaz (en az 2 harf)...'
              }
              className={`w-full bg-slate-900/95 text-white font-bold pl-3.5 sm:pl-4 pr-14 py-3 sm:py-3.5 rounded-2xl border-2 text-sm sm:text-base outline-none transition shadow-xl ${
                isShake
                  ? 'border-red-500 bg-red-950/40 shadow-[0_0_22px_rgba(239,68,68,0.65)] animate-wrong-shake'
                  : 'border-emerald-500/70 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20'
              } ${inputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <button
              type="submit"
              disabled={inputDisabled || !answerInput.trim()}
              className="absolute right-2 min-w-[42px] min-h-[40px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center justify-center transition active:scale-95 shadow-md shadow-emerald-500/20"
              aria-label="Cevabı Gönder"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Live 2+ char Player Autocomplete Dropdown across all minigames */}
          {showAutocomplete && !inputDisabled && autocompletePlayers.length > 0 && (
            <div
              data-testid={isSilhouette ? 'silhouette-autocomplete' : 'arena-autocomplete'}
              className={`absolute left-0 right-0 z-30 rounded-2xl bg-slate-900 border border-emerald-500/45 shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-800/80 ${
                isSilhouette ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
              }`}
            >
              {autocompletePlayers.map((p) => {
                const pAsset = getPlayerAsset(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={isSilhouette ? `silhouette-option-${p.id}` : `autocomplete-option-${p.id}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (isSilhouette) {
                        submitSilhouettePlayer(p, p.name);
                      } else if (isXox && !selectedCell) {
                        setAnswerInput(p.name);
                        setShowAutocomplete(false);
                        setErrorToast('Şimdi yukarıdan boş bir kare seç!');
                      } else {
                        submitAnswerValue(p.name);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/90 transition cursor-pointer"
                  >
                    <PlayerFaceThumb
                      playerId={p.id}
                      playerName={p.name}
                      sizeClass="w-7 h-7"
                    />
                    <CountryFlag
                      country={p.nationality}
                      flag={p.flag}
                      size="xs"
                      variant="circle"
                    />
                    <span className="font-bold text-xs sm:text-sm text-white truncate flex-1">
                      {p.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-black text-cyan-300 shrink-0">
                      {p.position}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 truncate max-w-[100px]">
                      {pAsset.clubName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              {isSilhouette
                ? 'Her tahminde kulüp, ülke, mevki, yaş & forma ipucu açılır'
                : 'Türkçe/İngilizce karakterler otomatik eşleşir'}
            </span>
          </span>
          <span className="font-semibold text-emerald-400 whitespace-nowrap">
            {isXox ? "3'lü Sıra Kur: +1 Galibiyet" : 'Doğru Cevap: +1 Galibiyet'}
          </span>
        </div>

        {/* Coin Jokers (Uyruk & Mevki / Baş Harf Aç) */}
        <JokerControlPanel
          validPlayerIds={
            isXox
              ? getRoundValidPlayerIds(round, selectedCell || undefined)
              : getRoundValidPlayerIds(round)
          }
          roundSeed={`${roundSeed || roundKey}${
            isXox && selectedCell ? `-${selectedCell.row}-${selectedCell.col}` : ''
          }`}
          userCoins={userCoins}
          freeJokerTickets={freeJokerTickets}
          onSpendCoinsForJoker={onSpendCoinsForJoker}
          disabled={inputDisabled || (isXox && !selectedCell)}
        />

        {botFeedbackToast && (
          <div
            data-testid="bot-wrong-toast"
            className="mt-2 px-3 py-1.5 rounded-xl bg-[#101B24] border border-amber-400/40 text-amber-300 text-xs font-bold text-center"
          >
            {botFeedbackToast}
          </div>
        )}
      </div>

      {/* WHO ARE YA GUESS COMPARISON ROWS */}
      {isSilhouette && silhouetteGuesses.length > 0 && (
        <div
          data-testid="silhouette-guess-list"
          className="w-full max-w-lg space-y-2 max-h-[280px] sm:max-h-[320px] overflow-y-auto pr-0.5 pb-2"
        >
          {silhouetteGuesses.map((g) => {
            const guessedClubObj = g.guessedAsset.clubId ? CLUBS[g.guessedAsset.clubId] : null;
            const teamTileClass =
              g.clubMatch === 'exact'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : g.clubMatch === 'same_league'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-700/80 text-white border-slate-600/80';

            const natTileClass = g.nationalityMatch
              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
              : 'bg-slate-700/80 text-white border-slate-600/80';

            const posTileClass = g.positionMatch
              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
              : 'bg-slate-700/80 text-white border-slate-600/80';

            const ageTileClass =
              g.ageDirection === 'exact'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-700/80 text-white border-slate-600/80';

            const shirtTileClass =
              g.shirtDirection === 'exact'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-700/80 text-white border-slate-600/80';

            return (
              <div
                key={g.guessedPlayer.id}
                data-testid={`silhouette-guess-row-${g.guessedPlayer.id}`}
                className="w-full p-2.5 sm:p-3 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-lg text-left animate-in fade-in"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlayerFaceThumb
                      playerId={g.guessedPlayer.id}
                      playerName={g.guessedPlayer.name}
                      sizeClass="w-8 h-8"
                    />
                    <div className="min-w-0">
                      <span className="block font-black text-xs sm:text-sm text-white uppercase tracking-tight truncate">
                        {g.guessedPlayer.name}
                      </span>
                      <span className="block text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase truncate">
                        {g.guessedAsset.clubName}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 shrink-0">
                    {g.guessedAsset.league}
                  </span>
                </div>

                {/* 5 Who-Are-Ya Comparison Columns */}
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
                  {/* 1. TEAM */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-full h-11 sm:h-12 rounded-xl border flex items-center justify-center shadow-inner ${teamTileClass}`}
                      title={g.guessedAsset.clubName}
                    >
                      <ClubBadge
                        club={guessedClubObj}
                        clubId={g.guessedAsset.clubId}
                        clubName={g.guessedAsset.clubName}
                        size="sm"
                        className="!w-7 !h-8 sm:!w-8 sm:!h-9"
                      />
                    </div>
                    <span className="mt-1 text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      TAKIM
                    </span>
                  </div>

                  {/* 2. NAT */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-full h-11 sm:h-12 rounded-xl border flex items-center justify-center shadow-inner ${natTileClass}`}
                      title={g.guessedPlayer.nationality}
                    >
                      <CountryFlag
                        country={g.guessedPlayer.nationality}
                        flag={g.guessedPlayer.flag}
                        size="md"
                        variant="circle"
                      />
                    </div>
                    <span className="mt-1 text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      ÜLKE
                    </span>
                  </div>

                  {/* 3. POS */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-full h-11 sm:h-12 rounded-xl border flex items-center justify-center font-black text-xs sm:text-sm shadow-inner ${posTileClass}`}
                    >
                      {g.guessedPlayer.position}
                    </div>
                    <span className="mt-1 text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      MEVKİ
                    </span>
                  </div>

                  {/* 4. AGE */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-full h-11 sm:h-12 rounded-xl border flex items-center justify-center gap-0.5 font-black text-xs sm:text-sm tabular-nums shadow-inner ${ageTileClass}`}
                    >
                      <span>{g.age}</span>
                      {g.ageDirection === 'higher' && (
                        <ChevronsUp className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      )}
                      {g.ageDirection === 'lower' && (
                        <ChevronsDown className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      )}
                    </div>
                    <span className="mt-1 text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      YAŞ
                    </span>
                  </div>

                  {/* 5. SHIRT */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-full h-11 sm:h-12 rounded-xl border flex items-center justify-center gap-0.5 font-black text-xs sm:text-sm tabular-nums shadow-inner ${shirtTileClass}`}
                    >
                      <span className="font-mono">#{g.shirtNumber}</span>
                      {g.shirtDirection === 'higher' && (
                        <ChevronsUp className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      )}
                      {g.shirtDirection === 'lower' && (
                        <ChevronsDown className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      )}
                    </div>
                    <span className="mt-1 text-[9px] sm:text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      FORMA
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
