import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MatchPairing, Player, PlayerProfile, BotDifficulty } from '../game/types';
import { ClubBadge } from './ClubBadge';
import { CountryFlag } from './CountryFlag';
import { PlayerAvatar } from './PlayerAvatar';
import { JokerControlPanel } from './JokerControlPanel';
import { getClubsForPairing, validateAnswerForPairing, getPlayersForPairing } from '../game/validator';
import { searchPlayersForAutocomplete } from '../game/silhouetteEngine';
import { getPlayerAsset } from '../game/playerAssets';
import {
  computeHumanizedBotDelayMs,
  getBotRoundPlan,
  pickBotValidPlayer,
  pickBotWrongPlayer,
} from '../game/botEngine';
import { sounds } from '../utils/audio';
import { haptics } from '../utils/haptics';
import { Send, AlertCircle, Sparkles } from 'lucide-react';

interface SinglePlayerViewProps {
  pairing: MatchPairing;
  player1: PlayerProfile;
  player2: PlayerProfile;
  isBotMatch?: boolean;
  isOnlineMatch?: boolean;
  botDifficulty?: BotDifficulty;
  timeRemaining?: number;
  energyDrinks?: number;
  extraTimeCards?: number;
  userCoins?: number;
  freeJokerTickets?: number;
  roundSeed?: string;
  isKeyboardOpen?: boolean;
  isCompactViewport?: boolean;
  onSpendCoinsForJoker?: (costCoins: number) => { ok: boolean; reason?: string };
  onUseEnergyDrinkHint?: () => boolean;
  onUseEnergyDrinkPass?: () => void;
  onUseExtraTimeCard?: () => boolean;
  onOpenStore?: () => void;
  onAnswerWinner: (winnerPlayerId: string, answer: string, playerName: string) => void;
  onBotWrongAttempt?: (guessedName: string) => void;
  onBotStatusChange?: (status: 'idle' | 'thinking' | 'answered') => void;
  onSubmitOnlineAnswer?: (answer: string) => void;
  serverWrongFeedback?: { attempt: string; seq: number } | null;
  opponentMissedPulse?: number;
  onWrongAttempt?: () => void;
  onTimeExpired: () => void;
  disabled?: boolean;
}

export const SinglePlayerView: React.FC<SinglePlayerViewProps> = ({
  pairing,
  player1,
  player2,
  isBotMatch = false,
  isOnlineMatch = false,
  botDifficulty = 'medium',
  timeRemaining = 15,
  userCoins = 0,
  freeJokerTickets = 0,
  roundSeed,
  isKeyboardOpen = false,
  isCompactViewport = false,
  onSpendCoinsForJoker,
  onAnswerWinner,
  onBotWrongAttempt,
  onBotStatusChange,
  onSubmitOnlineAnswer,
  serverWrongFeedback = null,
  opponentMissedPulse = 0,
  onWrongAttempt,
  disabled = false,
}) => {
  const { club1, club2 } = getClubsForPairing(pairing);
  const [answerInput, setAnswerInput] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [isShake, setIsShake] = useState(false);
  const [showOpponentMissed, setShowOpponentMissed] = useState(false);
  const [botFeedbackToast, setBotFeedbackToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const botAttemptedRoundRef = useRef<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmitRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const pairingRef = useRef(pairing);
  const player2Ref = useRef(player2);
  const timeRemainingRef = useRef(timeRemaining);
  const disabledRef = useRef(disabled);
  const onAnswerWinnerRef = useRef(onAnswerWinner);
  const onBotWrongAttemptRef = useRef(onBotWrongAttempt);
  const onBotStatusChangeRef = useRef(onBotStatusChange);

  pairingRef.current = pairing;
  player2Ref.current = player2;
  timeRemainingRef.current = timeRemaining;
  disabledRef.current = disabled;
  onAnswerWinnerRef.current = onAnswerWinner;
  onBotWrongAttemptRef.current = onBotWrongAttempt;
  onBotStatusChangeRef.current = onBotStatusChange;

  // Clear round-scoped errors and focus input whenever new round starts
  useEffect(() => {
    setErrorToast(null);
    setBotFeedbackToast(null);
    setAnswerInput('');
    setShowAutocomplete(false);
    lastSubmitRef.current = { value: '', at: 0 };
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    if (!disabled) {
      focusTimerRef.current = setTimeout(() => {
        focusTimerRef.current = null;
        try {
          inputRef.current?.focus({ preventScroll: true });
        } catch {
          inputRef.current?.focus();
        }
      }, 90);
    }
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [pairing.id, disabled]);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (botFeedbackTimerRef.current) clearTimeout(botFeedbackTimerRef.current);
    };
  }, []);

  // Apply server-sent wrong answer feedback in 1v1 online mode
  useEffect(() => {
    if (!isOnlineMatch || !serverWrongFeedback) return;
    sounds.playWrong();
    haptics.wrong();
    setIsShake(true);
    setErrorToast(`"${serverWrongFeedback.attempt}" bu iki kulüpte de oynamadı!`);
    const t = setTimeout(() => setIsShake(false), 500);
    return () => clearTimeout(t);
  }, [isOnlineMatch, serverWrongFeedback]);

  // Briefly pulse when online opponent submits a wrong guess
  useEffect(() => {
    if (!isOnlineMatch || opponentMissedPulse <= 0) return;
    setShowOpponentMissed(true);
    const t = setTimeout(() => setShowOpponentMissed(false), 2000);
    return () => clearTimeout(t);
  }, [isOnlineMatch, opponentMissedPulse]);

  // Bot logic (only in offline bot mode): active every round, 1 attempt per round, stable timer across 1s ticks
  useEffect(() => {
    const activePairing = pairingRef.current;
    if (!isBotMatch || isOnlineMatch || disabled) {
      onBotStatusChangeRef.current?.('idle');
      return;
    }

    const validPlayers = getPlayersForPairing(activePairing);
    if (validPlayers.length === 0) {
      onBotStatusChangeRef.current?.('idle');
      return;
    }

    if (botAttemptedRoundRef.current === activePairing.id) {
      onBotStatusChangeRef.current?.('answered');
      return;
    }

    onBotStatusChangeRef.current?.('thinking');
    const plan = getBotRoundPlan(botDifficulty, 'two_clubs', validPlayers.length);
    const maxRemainingMs = Math.max(900, timeRemainingRef.current * 1000);
    const delay = computeHumanizedBotDelayMs(plan, Math.random, maxRemainingMs);

    const botTimer = setTimeout(() => {
      const latestPairing = pairingRef.current;
      const latestBot = player2Ref.current;
      if (disabledRef.current || botAttemptedRoundRef.current === latestPairing.id) return;
      botAttemptedRoundRef.current = latestPairing.id;
      onBotStatusChangeRef.current?.('answered');

      const willKnow = Math.random() < plan.accuracy;
      if (willKnow) {
        const chosen = pickBotValidPlayer(validPlayers);
        if (chosen) {
          onAnswerWinnerRef.current(latestBot.id, chosen.name, chosen.name);
        }
      } else {
        const wrongPlayer = pickBotWrongPlayer(latestPairing.validPlayerIds);
        const wrongName = wrongPlayer?.name || 'Yanlış Tahmin';
        onBotWrongAttemptRef.current?.(wrongName);
        setBotFeedbackToast(`${latestBot.name} yanlış tahmin yaptı!`);
        if (botFeedbackTimerRef.current) clearTimeout(botFeedbackTimerRef.current);
        botFeedbackTimerRef.current = setTimeout(() => {
          botFeedbackTimerRef.current = null;
          setBotFeedbackToast(null);
        }, 2200);
      }
    }, delay);

    return () => clearTimeout(botTimer);
  }, [pairing.id, disabled, isBotMatch, isOnlineMatch, botDifficulty]);

  const autocompletePlayers = useMemo(() => {
    if (disabled) return [];
    return searchPlayersForAutocomplete(answerInput, [], 6);
  }, [disabled, answerInput]);

  const submitAnswerValue = (rawVal: string) => {
    if (disabled || !rawVal.trim()) return;
    const val = rawVal.trim();
    const now = Date.now();
    if (lastSubmitRef.current.value === val && now - lastSubmitRef.current.at < 280) {
      return;
    }
    lastSubmitRef.current = { value: val, at: now };

    if (isOnlineMatch && onSubmitOnlineAnswer) {
      onSubmitOnlineAnswer(val);
      setAnswerInput('');
      setShowAutocomplete(false);
      setErrorToast(null);
      return;
    }

    const result = validateAnswerForPairing(val, pairing);

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
      setErrorToast(`Yanlış Tahmin! -3 sn • "${val}" bu iki kulüpte de oynamadı!`);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = setTimeout(() => {
        shakeTimerRef.current = null;
        setIsShake(false);
      }, 500);
      setAnswerInput('');
      setShowAutocomplete(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    submitAnswerValue(answerInput);
  };

  const compactLayout = isKeyboardOpen || isCompactViewport;

  return (
    <div
      data-testid="single-player-view"
      className={`w-full flex flex-col items-center justify-between flex-1 min-h-0 overflow-hidden px-2.5 sm:px-4 ${
        isKeyboardOpen ? 'pt-1 pb-1' : 'py-1.5 sm:py-3'
      }`}
    >
      {/* Club Match Display — shrinks smoothly when keyboard opens so clubs + scores remain visible */}
      <div className="w-full max-w-xl md:max-w-2xl flex-1 min-h-0 overflow-y-auto overscroll-contain flex items-center justify-center py-0.5">
        <div
          key={pairing.id}
          className={`w-full flex items-stretch justify-center animate-card-pop ${
            compactLayout ? 'gap-1.5 sm:gap-4' : 'gap-2 sm:gap-6'
          }`}
        >
          {/* Club 1 */}
          <div
            className={`flex-1 min-w-0 flex flex-col items-center justify-center text-center rounded-2xl bg-[#124029]/95 border border-[#E5B94F]/35 shadow-xl ${
              compactLayout ? 'p-1.5 sm:p-3' : 'p-2 sm:p-4'
            }`}
          >
            <ClubBadge
              club={club1}
              size={compactLayout ? 'md' : 'lg'}
              className={compactLayout ? '!w-12 !h-12 sm:!w-16 sm:!h-16' : ''}
            />
            <h3
              className={`font-display font-black text-[#F5F3EB] text-center line-clamp-2 leading-tight w-full break-words uppercase tracking-wide ${
                compactLayout ? 'mt-1 text-[11px] sm:text-sm' : 'mt-1.5 sm:mt-2.5 text-xs sm:text-base'
              }`}
            >
              {club1.name}
            </h3>
            {!isKeyboardOpen && (
              <span className="text-[10px] sm:text-[11px] text-[#C4D6CA] font-medium truncate max-w-full mt-0.5">
                {club1.country} • {club1.stadium}
              </span>
            )}
          </div>

          {/* Link / Plus Badge */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div
              className={`rounded-full bg-[#168A52] text-white font-black flex items-center justify-center shadow-lg border border-[#E5B94F]/65 tracking-tighter ${
                compactLayout ? 'w-8 h-8 text-[9px]' : 'w-9 h-9 sm:w-11 sm:h-11 text-[10px] sm:text-xs'
              }`}
            >
              ORTAK
            </div>
            <span className="text-[9px] sm:text-[10px] text-[#E5B94F] font-bold uppercase mt-0.5">
              OYUNCU
            </span>
          </div>

          {/* Club 2 */}
          <div
            className={`flex-1 min-w-0 flex flex-col items-center justify-center text-center rounded-2xl bg-[#124029]/95 border border-[#E5B94F]/35 shadow-xl ${
              compactLayout ? 'p-1.5 sm:p-3' : 'p-2 sm:p-4'
            }`}
          >
            <ClubBadge
              club={club2}
              size={compactLayout ? 'md' : 'lg'}
              className={compactLayout ? '!w-12 !h-12 sm:!w-16 sm:!h-16' : ''}
            />
            <h3
              className={`font-display font-black text-[#F5F3EB] text-center line-clamp-2 leading-tight w-full break-words uppercase tracking-wide ${
                compactLayout ? 'mt-1 text-[11px] sm:text-sm' : 'mt-1.5 sm:mt-2.5 text-xs sm:text-base'
              }`}
            >
              {club2.name}
            </h3>
            {!isKeyboardOpen && (
              <span className="text-[10px] sm:text-[11px] text-[#C4D6CA] font-medium truncate max-w-full mt-0.5">
                {club2.country} • {club2.stadium}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Answer Input Section — Input anchored flush at bottom right above soft keyboard */}
      <div
        data-testid="match-answer-dock"
        className={`w-full max-w-md md:max-w-xl mt-auto shrink-0 ${isKeyboardOpen ? 'mb-0 pt-1' : 'mb-1 pt-1'}`}
      >
        {showOpponentMissed && (
          <div className="mb-1.5 px-3 py-1 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
            <span>⚡ {player2.name} yanlış tahmin yaptı! Sıra sende!</span>
          </div>
        )}

        {botFeedbackToast && (
          <div
            data-testid="bot-wrong-toast"
            className="mb-1.5 px-3 py-1 rounded-xl bg-[#101B24] border border-amber-400/40 text-amber-300 text-xs font-bold text-center"
          >
            {botFeedbackToast}
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

        {/* Coin Jokers sit cleanly ABOVE input so ZERO vertical gap exists below answer field when keyboard opens */}
        <JokerControlPanel
          validPlayerIds={pairing.validPlayerIds}
          roundSeed={roundSeed || pairing.id}
          userCoins={userCoins}
          freeJokerTickets={freeJokerTickets}
          compact={compactLayout}
          onSpendCoinsForJoker={onSpendCoinsForJoker}
          disabled={disabled}
        />

        {!isKeyboardOpen && (
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1 text-slate-400">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Türkçe/İngilizce karakterler otomatik eşleşir</span>
            </span>
            <span className="font-semibold text-emerald-400 whitespace-nowrap">Doğru Cevap: +1 Galibiyet</span>
          </div>
        )}

        <div className="relative">
          {showAutocomplete && !disabled && autocompletePlayers.length > 0 && (
            <div
              data-testid="single-autocomplete"
              className={`absolute left-0 right-0 bottom-full mb-1.5 z-30 rounded-2xl bg-slate-900 border border-emerald-500/45 shadow-2xl overflow-hidden overflow-y-auto divide-y divide-slate-800/80 ${
                isKeyboardOpen ? 'max-h-40' : 'max-h-56'
              }`}
            >
              {autocompletePlayers.map((p: Player) => {
                const pAsset = getPlayerAsset(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`autocomplete-option-${p.id}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      submitAnswerValue(p.name);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/90 transition cursor-pointer"
                  >
                    <PlayerAvatar
                      player={p}
                      name={p.name}
                      size="sm"
                      variant="circle"
                      className="w-7 h-7 border border-white/25 shrink-0"
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

          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-testid="match-answer-input"
              value={answerInput}
              onFocus={() => setShowAutocomplete(true)}
              onBlur={() => setTimeout(() => setShowAutocomplete(false), 180)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.nativeEvent.isComposing) {
                  e.preventDefault();
                }
              }}
              onChange={(e) => {
                setAnswerInput(e.target.value);
                setShowAutocomplete(true);
              }}
              disabled={disabled}
              placeholder={disabled ? 'Tur bekleniyor...' : 'Ortak futbolcuyu yaz (en az 2 harf)...'}
              className={`w-full bg-slate-900/95 text-white font-bold pl-3.5 sm:pl-4 pr-14 rounded-2xl border-2 text-sm sm:text-base outline-none transition shadow-xl ${
                isKeyboardOpen ? 'py-2.5 sm:py-3' : 'py-3.5 sm:py-4'
              } ${
                isShake
                  ? 'border-red-500 bg-red-950/40 shadow-[0_0_22px_rgba(239,68,68,0.65)] animate-wrong-shake'
                  : 'border-emerald-500/70 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <button
              type="submit"
              disabled={disabled || !answerInput.trim()}
              className="absolute right-2 min-w-[42px] min-h-[38px] sm:min-h-[40px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center justify-center transition active:scale-95 shadow-md shadow-emerald-500/20"
              aria-label="Cevabı Gönder"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
