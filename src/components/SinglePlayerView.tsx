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

  // Clear round-scoped errors and focus input whenever new round starts
  useEffect(() => {
    setErrorToast(null);
    setBotFeedbackToast(null);
    setAnswerInput('');
    setShowAutocomplete(false);
    if (!disabled) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [pairing.id, disabled]);

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

  // Bot logic (only in offline bot mode): active every round, 1 attempt per round, thinking status
  useEffect(() => {
    if (!isBotMatch || isOnlineMatch || disabled) {
      onBotStatusChange?.('idle');
      return;
    }

    const validPlayers = getPlayersForPairing(pairing);
    if (validPlayers.length === 0) {
      onBotStatusChange?.('idle');
      return;
    }

    if (botAttemptedRoundRef.current === pairing.id) {
      onBotStatusChange?.('answered');
      return;
    }

    onBotStatusChange?.('thinking');
    const plan = getBotRoundPlan(botDifficulty, 'two_clubs');
    const maxRemainingMs = Math.max(900, timeRemaining * 1000);
    const delay = computeHumanizedBotDelayMs(plan, Math.random, maxRemainingMs);

    const botTimer = setTimeout(() => {
      if (disabled || botAttemptedRoundRef.current === pairing.id) return;
      botAttemptedRoundRef.current = pairing.id;
      onBotStatusChange?.('answered');

      const willKnow = Math.random() < plan.accuracy;
      if (willKnow) {
        const chosen = pickBotValidPlayer(validPlayers);
        if (chosen) {
          onAnswerWinner(player2.id, chosen.name, chosen.name);
        }
      } else {
        const wrongPlayer = pickBotWrongPlayer(pairing.validPlayerIds);
        const wrongName = wrongPlayer?.name || 'Yanlış Tahmin';
        onBotWrongAttempt?.(wrongName);
        setBotFeedbackToast(`${player2.name} yanlış tahmin yaptı!`);
        setTimeout(() => setBotFeedbackToast(null), 2200);
      }
    }, delay);

    return () => clearTimeout(botTimer);
  }, [
    pairing.id,
    disabled,
    isBotMatch,
    isOnlineMatch,
    botDifficulty,
    player2.id,
    player2.name,
    onAnswerWinner,
    onBotWrongAttempt,
    onBotStatusChange,
  ]);

  const autocompletePlayers = useMemo(() => {
    if (disabled) return [];
    return searchPlayersForAutocomplete(answerInput, [], 6);
  }, [disabled, answerInput]);

  const submitAnswerValue = (rawVal: string) => {
    if (disabled || !rawVal.trim()) return;
    const val = rawVal.trim();

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
      setTimeout(() => setIsShake(false), 500);
      setAnswerInput('');
      setShowAutocomplete(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    submitAnswerValue(answerInput);
  };

  return (
    <div className="w-full flex flex-col items-center justify-between flex-1 min-h-0 overflow-hidden py-1.5 sm:py-3 px-2.5 sm:px-4">
      {/* Club Match Display */}
      <div
        key={pairing.id}
        className="w-full max-w-xl flex items-stretch justify-center gap-2 sm:gap-6 my-auto shrink min-h-0 animate-card-pop"
      >
        {/* Club 1 */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center p-2 sm:p-4 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-xl">
          <ClubBadge club={club1} size="lg" />
          <h3 className="mt-1.5 sm:mt-2.5 font-black text-xs sm:text-base text-white text-center line-clamp-2 leading-tight w-full break-words">
            {club1.name}
          </h3>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate max-w-full mt-0.5">
            {club1.country} • {club1.stadium}
          </span>
        </div>

        {/* Link / Plus Badge */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-emerald-500/30 text-[10px] sm:text-xs tracking-tighter">
            ORTAK
          </div>
          <span className="text-[9px] sm:text-[10px] text-emerald-400 font-bold uppercase mt-1">OYUNCU</span>
        </div>

        {/* Club 2 */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center p-2 sm:p-4 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-xl">
          <ClubBadge club={club2} size="lg" />
          <h3 className="mt-1.5 sm:mt-2.5 font-black text-xs sm:text-base text-white text-center line-clamp-2 leading-tight w-full break-words">
            {club2.name}
          </h3>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate max-w-full mt-0.5">
            {club2.country} • {club2.stadium}
          </span>
        </div>
      </div>

      {/* Answer Input Section */}
      <div className="w-full max-w-md mt-auto mb-1 shrink-0">
        {showOpponentMissed && (
          <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
            <span>⚡ {player2.name} yanlış tahmin yaptı! Sıra sende!</span>
          </div>
        )}

        {errorToast && (
          <div
            data-testid="wrong-guess-alert"
            className="mb-2 p-2 rounded-xl bg-red-950/90 border border-red-500/75 text-red-200 text-xs font-bold flex items-center gap-2 shadow-[0_0_16px_rgba(239,68,68,0.35)] animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{errorToast}</span>
          </div>
        )}

        <div className="relative">
          {showAutocomplete && !disabled && autocompletePlayers.length > 0 && (
            <div
              data-testid="single-autocomplete"
              className="absolute left-0 right-0 bottom-full mb-1.5 z-30 rounded-2xl bg-slate-900 border border-emerald-500/45 shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-800/80"
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
              data-testid="match-answer-input"
              value={answerInput}
              onFocus={() => setShowAutocomplete(true)}
              onBlur={() => setTimeout(() => setShowAutocomplete(false), 180)}
              onChange={(e) => {
                setAnswerInput(e.target.value);
                setShowAutocomplete(true);
              }}
              disabled={disabled}
              placeholder={disabled ? 'Tur bekleniyor...' : 'Ortak futbolcuyu yaz (en az 2 harf)...'}
              className={`w-full bg-slate-900/95 text-white font-bold pl-3.5 sm:pl-4 pr-14 py-3.5 sm:py-4 rounded-2xl border-2 text-sm sm:text-base outline-none transition shadow-xl ${
                isShake
                  ? 'border-red-500 bg-red-950/40 shadow-[0_0_22px_rgba(239,68,68,0.65)] animate-wrong-shake'
                  : 'border-emerald-500/70 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <button
              type="submit"
              disabled={disabled || !answerInput.trim()}
              className="absolute right-2 min-w-[42px] min-h-[40px] px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center justify-center transition active:scale-95 shadow-md shadow-emerald-500/20"
              aria-label="Cevabı Gönder"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Türkçe/İngilizce karakterler otomatik eşleşir</span>
          </span>
          <span className="font-semibold text-emerald-400 whitespace-nowrap">Doğru Cevap: +1 Galibiyet</span>
        </div>

        {/* Coin Jokers (Uyruk & Mevki / Baş Harf Aç) */}
        <JokerControlPanel
          validPlayerIds={pairing.validPlayerIds}
          roundSeed={roundSeed || pairing.id}
          userCoins={userCoins}
          freeJokerTickets={freeJokerTickets}
          onSpendCoinsForJoker={onSpendCoinsForJoker}
          disabled={disabled}
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
    </div>
  );
};
