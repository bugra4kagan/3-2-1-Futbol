import React, { useState, useEffect, useRef } from 'react';
import { MatchPairing, PlayerProfile, BotDifficulty } from '../game/types';
import { ClubLogo } from './ClubLogo';
import { getClubsForPairing, validateAnswerForPairing, getPlayersForPairing } from '../game/validator';
import { sounds } from '../utils/audio';
import { Send, AlertCircle, Sparkles, Lightbulb, SkipForward } from 'lucide-react';

interface SinglePlayerViewProps {
  pairing: MatchPairing;
  player1: PlayerProfile;
  player2: PlayerProfile;
  isBotMatch?: boolean;
  isOnlineMatch?: boolean;
  botDifficulty?: BotDifficulty;
  energyDrinks?: number;
  onUseEnergyDrinkHint?: () => boolean;
  onUseEnergyDrinkPass?: () => void;
  onOpenStore?: () => void;
  onAnswerWinner: (winnerPlayerId: string, answer: string, playerName: string) => void;
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
  energyDrinks = 0,
  onUseEnergyDrinkHint,
  onUseEnergyDrinkPass,
  onOpenStore,
  onAnswerWinner,
  onSubmitOnlineAnswer,
  serverWrongFeedback = null,
  opponentMissedPulse = 0,
  onWrongAttempt,
  onTimeExpired,
  disabled = false,
}) => {
  const { club1, club2 } = getClubsForPairing(pairing);
  const [answerInput, setAnswerInput] = useState('');
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [isShake, setIsShake] = useState(false);
  const [showOpponentMissed, setShowOpponentMissed] = useState(false);
  const [energyHintText, setEnergyHintText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear round-scoped errors and focus input whenever new round starts
  useEffect(() => {
    setErrorToast(null);
    setAnswerInput('');
    setEnergyHintText(null);
    if (!disabled) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [pairing.id, disabled]);

  const handleUseHint = () => {
    if (disabled || energyHintText) return;
    if (!onUseEnergyDrinkHint || !onUseEnergyDrinkHint()) {
      onOpenStore?.();
      return;
    }
    const candidates = getPlayersForPairing(pairing);
    if (candidates.length > 0) {
      const target = candidates[0];
      const initials = target.name
        .split(' ')
        .map((part) => `${part.charAt(0)}***`)
        .join(' ');
      setEnergyHintText(
        `${target.flag} ${target.nationality} • ${target.position} • İsim: ${initials}`
      );
      sounds.playCorrect();
    }
  };

  // Apply server-sent wrong answer feedback in 1v1 online mode
  useEffect(() => {
    if (!isOnlineMatch || !serverWrongFeedback) return;
    sounds.playWrong();
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

  // Bot logic (only in offline bot mode)
  useEffect(() => {
    if (!isBotMatch || isOnlineMatch || disabled) return;

    const validPlayers = getPlayersForPairing(pairing);
    if (validPlayers.length === 0) return;

    // Determine bot speed & accuracy
    let minDelay = 6000;
    let maxDelay = 10000;
    let accuracy = 0.8;

    if (botDifficulty === 'easy') {
      minDelay = 9000;
      maxDelay = 13500;
      accuracy = 0.6;
    } else if (botDifficulty === 'hard') {
      minDelay = 3500;
      maxDelay = 6000;
      accuracy = 0.95;
    }

    const delay = Math.random() * (maxDelay - minDelay) + minDelay;

    const botTimer = setTimeout(() => {
      if (disabled) return;
      const willKnow = Math.random() < accuracy;
      if (willKnow) {
        const chosen = validPlayers[Math.floor(Math.random() * validPlayers.length)];
        sounds.playWrong();
        onAnswerWinner(player2.id, chosen.name, chosen.name);
      }
    }, delay);

    return () => clearTimeout(botTimer);
  }, [pairing.id, disabled, isBotMatch, isOnlineMatch, botDifficulty, player2.id, onAnswerWinner]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (disabled || !answerInput.trim()) return;

    const val = answerInput.trim();

    if (isOnlineMatch && onSubmitOnlineAnswer) {
      onSubmitOnlineAnswer(val);
      setAnswerInput('');
      setErrorToast(null);
      return;
    }

    const result = validateAnswerForPairing(val, pairing);

    if (result.isValid && result.player) {
      sounds.playCorrect();
      onAnswerWinner(player1.id, val, result.player.name);
      setAnswerInput('');
      setErrorToast(null);
    } else {
      sounds.playWrong();
      onWrongAttempt?.();
      setIsShake(true);
      setErrorToast(`"${val}" bu iki kulüpte de oynamadı!`);
      setTimeout(() => setIsShake(false), 500);
      setAnswerInput('');
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-between flex-1 py-2 sm:py-4 px-2.5 sm:px-4">
      {/* Club Match Display */}
      <div
        key={pairing.id}
        className="w-full max-w-xl flex items-stretch justify-center gap-2 sm:gap-6 my-auto animate-card-pop"
      >
        {/* Club 1 */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center p-2.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <ClubLogo club={club1} size="lg" />
          <h3 className="mt-2 sm:mt-2.5 font-black text-xs sm:text-base text-white line-clamp-2 leading-tight max-w-full">
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
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center p-2.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <ClubLogo club={club2} size="lg" />
          <h3 className="mt-2 sm:mt-2.5 font-black text-xs sm:text-base text-white line-clamp-2 leading-tight max-w-full">
            {club2.name}
          </h3>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate max-w-full mt-0.5">
            {club2.country} • {club2.stadium}
          </span>
        </div>
      </div>

      {/* Answer Input Section */}
      <div className="w-full max-w-md mt-auto mb-2">
        {showOpponentMissed && (
          <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
            <span>⚡ {player2.name} yanlış tahmin yaptı! Sıra sende!</span>
          </div>
        )}

        {errorToast && (
          <div className="mb-2 p-2 rounded-xl bg-red-950/80 border border-red-500/60 text-red-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{errorToast}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            disabled={disabled}
            placeholder={disabled ? 'Tur bekleniyor...' : 'Ortak futbolcuyu yaz (örn: Ronaldo)...'}
            className={`w-full bg-slate-900/95 text-white font-bold pl-3.5 sm:pl-4 pr-14 py-3.5 sm:py-4 rounded-2xl border-2 text-sm sm:text-base outline-none transition shadow-xl ${
              isShake
                ? 'border-red-500 bg-red-950/30 animate-bounce'
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

        <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Yazım farkları tolere edilir</span>
          </span>
          <span className="font-semibold text-emerald-400 whitespace-nowrap">Doğru Cevap: +1 Galibiyet</span>
        </div>

        {/* Energy Drink Power-Ups (İpucu & Pas Geç) */}
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
                disabled={disabled || Boolean(energyHintText)}
                onClick={handleUseHint}
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
    </div>
  );
};
