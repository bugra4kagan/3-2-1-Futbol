import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  ChevronsDown,
  ChevronsUp,
  Handshake,
  Lightbulb,
  Send,
  Shirt,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { CLUBS, PLAYERS } from '../game/database';
import { getClubCrestUrl } from '../game/clubLogos';
import { PLAYER_ASSETS, getPlayerAsset } from '../game/playerAssets';
import {
  checkXoxBoardWinner,
  getRoundValidPlayerIds,
  validateMinigameAnswer,
} from '../game/minigameEngine';
import {
  MAX_SILHOUETTE_ATTEMPTS,
  compareSilhouetteGuess,
  resolveGuessedPlayerFromInput,
  searchSilhouettePlayers,
  SilhouetteGuessResult,
} from '../game/silhouetteEngine';
import {
  BotDifficulty,
  MinigameRoundPayload,
  Player,
  PlayerProfile,
  XoxCondition,
  XoxRuntimeState,
} from '../game/types';
import { sounds } from '../utils/audio';
import { ClubLogo } from './ClubLogo';
import { CountryFlag } from './CountryFlag';
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
  onUseEnergyDrinkHint?: () => boolean;
  onUseEnergyDrinkPass?: () => void;
  onOpenStore?: () => void;
  // Standard answer submission
  onAnswerWinner: (winnerPlayerId: string, answer: string, playerName: string) => void;
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

const MiniCrestImage: React.FC<{ url?: string; clubName: string }> = ({ url, clubName }) => {
  const [err, setErr] = useState(false);

  useEffect(() => {
    setErr(false);
  }, [url]);

  if (!url || err) {
    return <Shirt className="w-6 h-6 text-white drop-shadow" />;
  }

  return (
    <img
      src={url}
      alt={clubName}
      referrerPolicy="no-referrer"
      onError={() => setErr(true)}
      className="w-7 h-7 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
    />
  );
};

const TeammatePortrait: React.FC<{ playerId: string; label: string }> = ({ playerId, label }) => {
  const photoUrl = PLAYER_ASSETS[playerId]?.photoUrl;
  const [err, setErr] = useState(false);

  useEffect(() => {
    setErr(false);
  }, [photoUrl, playerId]);

  if (!photoUrl || err) {
    return <Handshake className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />;
  }

  return (
    <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-amber-400/60 bg-white shrink-0 shadow">
      <img
        src={photoUrl}
        alt={label}
        referrerPolicy="no-referrer"
        onError={() => setErr(true)}
        className="w-full h-full object-cover object-top"
      />
    </div>
  );
};

const CareerExtraCrest: React.FC<{ url?: string; clubName: string; flag?: string }> = ({
  url,
  clubName,
  flag,
}) => {
  const [err, setErr] = useState(false);

  useEffect(() => {
    setErr(false);
  }, [url, clubName]);

  if (url && !err) {
    return (
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1.5 shadow-md shrink-0">
        <img
          src={url}
          alt={clubName}
          referrerPolicy="no-referrer"
          onError={() => setErr(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
      <CountryFlag flag={flag} size="md" />
    </div>
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
  disabled = false,
  energyDrinks = 0,
  onUseEnergyDrinkHint,
  onUseEnergyDrinkPass,
  onOpenStore,
  onAnswerWinner,
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
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [silhouetteGuesses, setSilhouetteGuesses] = useState<SilhouetteGuessResult[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [energyHintText, setEnergyHintText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const exhaustTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    setAnswerInput('');
    setSelectedCell(null);
    setSilhouetteGuesses([]);
    setShowAutocomplete(false);
    setEnergyHintText(null);
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

  // Bot AI for silhouette / career / country_club (first-to-answer)
  useEffect(() => {
    if (!isBotMatch || isOnlineMatch || disabled || isXox) return;

    const validIds = getRoundValidPlayerIds(round);
    const validPlayers = validIds.map((id) => PLAYERS[id]).filter(Boolean);
    if (validPlayers.length === 0) return;

    // 2-minute silhouette mode uses detective pacing so player can use Who-Are-Ya clues
    let minDelay = isSilhouette ? 42000 : 6000;
    let maxDelay = isSilhouette ? 70000 : 10000;
    let accuracy = isSilhouette ? 0.85 : 0.8;

    if (botDifficulty === 'easy') {
      minDelay = isSilhouette ? 62000 : 9000;
      maxDelay = isSilhouette ? 95000 : 13500;
      accuracy = isSilhouette ? 0.65 : 0.6;
    } else if (botDifficulty === 'hard') {
      minDelay = isSilhouette ? 28000 : 3500;
      maxDelay = isSilhouette ? 48000 : 6000;
      accuracy = 0.95;
    }

    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    const botTimer = setTimeout(() => {
      if (disabled) return;
      if (Math.random() < accuracy) {
        const chosen = validPlayers[Math.floor(Math.random() * validPlayers.length)];
        sounds.playWrong();
        onAnswerWinner(player2.id, chosen.name, chosen.name);
      }
    }, delay);

    return () => clearTimeout(botTimer);
  }, [
    roundKey,
    round,
    disabled,
    isBotMatch,
    isOnlineMatch,
    isXox,
    isSilhouette,
    botDifficulty,
    player2.id,
    onAnswerWinner,
  ]);

  // Bot AI for Solo XOX turn
  useEffect(() => {
    if (
      !isBotMatch ||
      isOnlineMatch ||
      disabled ||
      !isXox ||
      !xoxState ||
      !round.xoxBoard ||
      !onSoloXoxMove
    ) {
      return;
    }
    if (xoxState.currentTurnPlayerId !== player2.id) return;

    const delay =
      botDifficulty === 'easy' ? 2800 : botDifficulty === 'hard' ? 1600 : 2200;

    const missRate =
      botDifficulty === 'easy' ? 0.32 : botDifficulty === 'hard' ? 0.06 : 0.16;

    const t = setTimeout(() => {
      if (disabled) return;

      const emptyCells: { row: number; col: number }[] = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (xoxState.board[r][c] === null) {
            emptyCells.push({ row: r, col: c });
          }
        }
      }
      if (emptyCells.length === 0) return;

      if (Math.random() < missRate) {
        onSoloXoxMove(
          {
            ...xoxState,
            currentTurnPlayerId: player1.id,
            turnTimeRemaining: 15,
          },
          null,
          false,
          '',
          false
        );
        return;
      }

      const center = emptyCells.find((e) => e.row === 1 && e.col === 1);
      const chosenCell =
        center && botDifficulty !== 'easy'
          ? center
          : emptyCells[Math.floor(Math.random() * emptyCells.length)];

      const validIds = getRoundValidPlayerIds(round, chosenCell);
      const chosenPid = validIds[Math.floor(Math.random() * validIds.length)];
      const chosenPlayer = PLAYERS[chosenPid];
      const playerName = chosenPlayer?.name || 'Bilinmeyen';

      const nextBoard = xoxState.board.map((row) => [...row]);
      nextBoard[chosenCell.row][chosenCell.col] = {
        ownerId: player2.id,
        symbol: 'O',
        playerName,
      };

      const winCheck = checkXoxBoardWinner(nextBoard);
      const nextState: XoxRuntimeState = {
        board: nextBoard,
        currentTurnPlayerId: player1.id,
        turnTimeRemaining: 15,
        winningCells: winCheck.winningCells,
      };

      const isEnded = Boolean(winCheck.winnerId) || winCheck.isBoardFull;
      onSoloXoxMove(nextState, winCheck.winnerId, isEnded, playerName, true);
    }, delay);

    return () => clearTimeout(t);
  }, [
    isBotMatch,
    isOnlineMatch,
    disabled,
    isXox,
    xoxState,
    round,
    botDifficulty,
    player1.id,
    player2.id,
    onSoloXoxMove,
  ]);

  const guessedPlayerIds = useMemo(
    () => silhouetteGuesses.map((g) => g.guessedPlayer.id),
    [silhouetteGuesses]
  );

  const autocompletePlayers = useMemo(() => {
    if (!isSilhouette || disabled) return [];
    return searchSilhouettePlayers(answerInput, guessedPlayerIds, 7);
  }, [isSilhouette, disabled, answerInput, guessedPlayerIds]);

  const submitSilhouettePlayer = (picked: Player | null, fallbackText: string) => {
    if (!round.silhouette || isSilhouetteExhausted) return;
    const targetId = round.silhouette.playerId;

    if (!picked) {
      sounds.playWrong();
      setIsShake(true);
      setErrorToast(`"${fallbackText}" listede bulunamadı, önerilerden bir oyuncu seç!`);
      setTimeout(() => setIsShake(false), 450);
      setShowAutocomplete(false);
      return;
    }

    if (picked.id === targetId) {
      setShowAutocomplete(false);
      setAnswerInput('');
      setErrorToast(null);
      if (isOnlineMatch && onSubmitOnlineAnswer) {
        onSubmitOnlineAnswer(picked.name);
        return;
      }
      sounds.playCorrect();
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
    setErrorToast(null);

    if (isOnlineMatch && onSubmitOnlineAnswer) {
      onSubmitOnlineAnswer(picked.name);
      return;
    }

    sounds.playWrong();
    onWrongAttempt?.();

    if (nextCount >= MAX_SILHOUETTE_ATTEMPTS && onSilhouetteExhausted) {
      setErrorToast('8/8 deneme hakkın doldu — 0 Puan!');
      exhaustTimerRef.current = setTimeout(() => {
        exhaustTimerRef.current = null;
        onSilhouetteExhausted();
      }, 450);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (disabled || !answerInput.trim()) return;

    const val = answerInput.trim();

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
        setErrorToast(null);
        return;
      }

      if (!xoxState || !onSoloXoxMove) return;
      const result = validateMinigameAnswer(round, val, selectedCell);
      if (result.isValid && result.player) {
        sounds.playCorrect();
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
        setErrorToast(null);
        setSelectedCell(null);
        onSoloXoxMove(nextState, winCheck.winnerId, isEnded, result.player.name, true);
      } else {
        sounds.playWrong();
        onWrongAttempt?.();
        setIsShake(true);
        setErrorToast(`"${val}" bu kare için geçersiz! Sıra bota geçti.`);
        setTimeout(() => setIsShake(false), 450);
        setAnswerInput('');
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
      setErrorToast(null);
      return;
    }

    const result = validateMinigameAnswer(round, val);
    if (result.isValid && result.player) {
      sounds.playCorrect();
      onAnswerWinner(player1.id, val, result.player.name);
      setAnswerInput('');
      setErrorToast(null);
    } else {
      sounds.playWrong();
      onWrongAttempt?.();
      setIsShake(true);
      setErrorToast(`"${val}" doğru cevap değil, tekrar dene!`);
      setTimeout(() => setIsShake(false), 450);
      setAnswerInput('');
    }
  };

  // Helper to render XOX row/col condition header
  const renderXoxAxisCell = (cond: XoxCondition, isRowHeader: boolean) => {
    if (cond.type === 'club' && CLUBS[cond.id]) {
      const club = CLUBS[cond.id];
      return (
        <div
          className={`flex flex-col items-center justify-center text-center p-1 sm:p-1.5 rounded-xl bg-slate-900/95 border border-slate-700/80 ${
            isRowHeader ? 'h-full min-h-[64px] sm:min-h-[76px]' : 'h-full min-h-[60px]'
          }`}
        >
          <ClubLogo club={club} size="sm" className="!w-7 !h-7 sm:!w-9 sm:!h-9 !p-1 !rounded-lg" />
          <span className="mt-1 text-[9px] sm:text-[11px] font-extrabold text-white leading-tight line-clamp-2">
            {club.shortName}
          </span>
        </div>
      );
    }

    if (cond.type === 'teammate') {
      return (
        <div
          className={`flex flex-col items-center justify-center text-center p-1 sm:p-1.5 rounded-xl bg-amber-950/50 border border-amber-500/40 ${
            isRowHeader ? 'h-full min-h-[64px] sm:min-h-[76px]' : 'h-full min-h-[60px]'
          }`}
        >
          <TeammatePortrait playerId={cond.id} label={cond.label} />
          <span className="mt-1 text-[9px] sm:text-[11px] font-black text-amber-200 leading-tight line-clamp-2">
            {cond.label}
          </span>
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col items-center justify-center text-center p-1 sm:p-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 ${
          isRowHeader ? 'h-full min-h-[64px] sm:min-h-[76px]' : 'h-full min-h-[60px]'
        }`}
      >
        <CountryFlag country={cond.id} flag={cond.flag} size="md" />
        <span className="mt-1 text-[9px] sm:text-[11px] font-black text-emerald-200 leading-tight line-clamp-2">
          {cond.label}
        </span>
      </div>
    );
  };

  const silhouetteTarget = round.silhouette ? PLAYERS[round.silhouette.playerId] : null;
  const silhouetteAsset = round.silhouette ? getPlayerAsset(round.silhouette.playerId) : null;
  const silhouetteClub = round.silhouette ? CLUBS[round.silhouette.hintClubId] : null;

  const selectedXoxPrompt = useMemo(() => {
    if (!isXox || !round.xoxBoard || !selectedCell) return null;
    const rCond = round.xoxBoard.rows[selectedCell.row];
    const cCond = round.xoxBoard.cols[selectedCell.col];
    return `${rCond.label} × ${cCond.label}`;
  }, [isXox, round.xoxBoard, selectedCell]);

  const inputDisabled = disabled || (isXox && !isMyXoxTurn) || isSilhouetteExhausted;

  return (
    <div
      data-testid={`minigame-arena-${round.minigameType}`}
      className={`w-full flex flex-col items-center flex-1 py-2 sm:py-3 px-2.5 sm:px-4 ${
        isSilhouette ? 'justify-start gap-1 pb-8' : 'justify-between'
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
            revealed={false}
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

          {/* Who Are Ya Color Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-2 text-[11px] font-semibold text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Doğru kulüp
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              Aynı lig, farklı kulüp
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" />
              Farklı lig
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
            className="w-full p-3 sm:p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl max-h-[48dvh] sm:max-h-[54dvh] overflow-y-auto"
          >
            <div className="flex flex-col items-stretch gap-1.5">
              {round.career.steps.map((step, idx) => {
                const club = step.clubId ? CLUBS[step.clubId] : null;
                const extraCrest = !club ? getClubCrestUrl(undefined, step.clubName) : null;
                return (
                  <React.Fragment key={`${step.clubName}-${idx}`}>
                    <div
                      data-testid={`career-step-row-${idx}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {club ? (
                          <ClubLogo
                            club={club}
                            size="sm"
                            className="!w-10 !h-10 sm:!w-11 sm:!h-11 shrink-0"
                          />
                        ) : (
                          <CareerExtraCrest
                            url={extraCrest || undefined}
                            clubName={step.clubName}
                            flag={step.countryFlag}
                          />
                        )}
                        <div className="min-w-0 text-left">
                          <span className="block font-extrabold text-xs sm:text-sm text-white leading-tight truncate">
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
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center p-3 sm:p-5 rounded-2xl bg-slate-900/85 border border-slate-800 shadow-xl">
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
              <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center p-3 sm:p-5 rounded-2xl bg-slate-900/85 border border-slate-800 shadow-xl">
                <ClubLogo club={CLUBS[round.countryClub.clubId]} size="lg" />
                <h3 className="mt-2.5 font-black text-xs sm:text-base text-white line-clamp-2 leading-tight">
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

          <div className="w-full grid grid-cols-[76px_repeat(3,minmax(0,1fr))] sm:grid-cols-[110px_repeat(3,minmax(0,1fr))] gap-1.5 sm:gap-2">
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
                          <span
                            className={`text-lg sm:text-xl font-black leading-none ${
                              isMine ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {mark.symbol}
                          </span>
                          <span className="mt-1 text-[9px] sm:text-[10px] font-bold text-white leading-tight line-clamp-2">
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
          <div className="mb-1.5 p-2 rounded-xl bg-red-950/80 border border-red-500/60 text-red-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{errorToast}</span>
          </div>
        )}

        <div className="relative">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={answerInput}
              onFocus={() => isSilhouette && setShowAutocomplete(true)}
              onBlur={() => {
                setTimeout(() => setShowAutocomplete(false), 180);
              }}
              onChange={(e) => {
                setAnswerInput(e.target.value);
                if (isSilhouette) setShowAutocomplete(true);
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
                      ? 'Bu kareye uygun futbolcuyu yaz...'
                      : 'Önce yukarıdan boş bir kare seç...'
                    : `${player2.name} hamlesi bekleniyor...`
                  : isSilhouette
                  ? 'Futbolcu adı yaz veya listeden seç...'
                  : 'Futbolcunun adını yaz...'
              }
              className={`w-full bg-slate-900/95 text-white font-bold pl-3.5 sm:pl-4 pr-14 py-3 sm:py-3.5 rounded-2xl border-2 text-sm sm:text-base outline-none transition shadow-xl ${
                isShake
                  ? 'border-red-500 bg-red-950/30 animate-bounce'
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

          {/* Who Are Ya Live Player Autocomplete Dropdown */}
          {isSilhouette &&
            showAutocomplete &&
            !inputDisabled &&
            autocompletePlayers.length > 0 && (
              <div
                data-testid="silhouette-autocomplete"
                className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-2xl bg-slate-900 border border-emerald-500/45 shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-800/80"
              >
                {autocompletePlayers.map((p) => {
                  const pAsset = getPlayerAsset(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`silhouette-option-${p.id}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        submitSilhouettePlayer(p, p.name);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-800/90 transition cursor-pointer"
                    >
                      <CountryFlag
                        country={p.nationality}
                        flag={p.flag}
                        size="xs"
                        variant="circle"
                      />
                      <span className="font-bold text-sm text-white truncate flex-1">
                        {p.name}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 truncate max-w-[125px]">
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
                : 'Yazım farkları tolere edilir'}
            </span>
          </span>
          <span className="font-semibold text-emerald-400 whitespace-nowrap">
            {isXox ? "3'lü Sıra Kur: +1 Galibiyet" : 'Doğru Cevap: +1 Galibiyet'}
          </span>
        </div>

        {/* Energy Drink Power-Up Controls */}
        {energyHintText && (
          <div
            data-testid="energy-hint-banner"
            className="mt-2 px-3 py-2 rounded-xl bg-cyan-950/80 border border-cyan-400/50 text-cyan-200 text-xs font-bold text-center animate-in fade-in"
          >
            🥤 Enerji İpucu: {energyHintText}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {energyDrinks > 0 ? (
            <>
              <button
                type="button"
                data-testid="energy-hint-btn"
                disabled={inputDisabled || Boolean(energyHintText) || (isXox && !selectedCell)}
                onClick={() => {
                  if (!onUseEnergyDrinkHint || !onUseEnergyDrinkHint()) {
                    onOpenStore?.();
                    return;
                  }
                  const ids = getRoundValidPlayerIds(round, selectedCell || undefined);
                  const target = ids.length > 0 ? PLAYERS[ids[0]] : null;
                  if (target) {
                    const asset = getPlayerAsset(target.id);
                    const initials = target.name
                      .split(' ')
                      .map((part) => `${part.charAt(0)}***`)
                      .join(' ');
                    setEnergyHintText(
                      `${target.flag} ${target.nationality} • ${target.position} • ${asset.clubName} • İsim: ${initials}`
                    );
                    sounds.playCorrect();
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 border border-cyan-400/50 text-cyan-200 font-black text-[11px] flex items-center gap-1 cursor-pointer transition"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                <span>İpucu (1 🥤 • {energyDrinks})</span>
              </button>
              {!isOnlineMatch && onUseEnergyDrinkPass && (
                <button
                  type="button"
                  data-testid="energy-pass-btn"
                  disabled={disabled}
                  onClick={() => onUseEnergyDrinkPass()}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 border border-amber-400/50 text-amber-200 font-black text-[11px] flex items-center gap-1 cursor-pointer transition"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Pas Geç (1 🥤)</span>
                </button>
              )}
            </>
          ) : (
            onOpenStore && (
              <button
                type="button"
                data-testid="energy-buy-cta"
                onClick={onOpenStore}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/35 text-cyan-300 font-bold text-[11px] cursor-pointer transition"
              >
                🥤 Zorlandın mı? Mağazadan Enerji İçeceği Al
              </button>
            )
          )}
        </div>
      </div>

      {/* WHO ARE YA GUESS COMPARISON ROWS */}
      {isSilhouette && silhouetteGuesses.length > 0 && (
        <div
          data-testid="silhouette-guess-list"
          className="w-full max-w-lg space-y-2 max-h-[280px] sm:max-h-[320px] overflow-y-auto pr-0.5 pb-2"
        >
          {silhouetteGuesses.map((g) => {
            const crestUrl = getClubCrestUrl(g.guessedAsset.clubId, g.guessedAsset.clubName);
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
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <span className="block font-black text-xs sm:text-sm text-white uppercase tracking-tight truncate">
                      {g.guessedPlayer.name}
                    </span>
                    <span className="block text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase truncate">
                      {g.guessedAsset.clubName}
                    </span>
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
                      <MiniCrestImage url={crestUrl} clubName={g.guessedAsset.clubName} />
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
