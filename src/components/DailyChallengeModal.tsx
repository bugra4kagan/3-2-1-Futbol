import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowDown,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Flame,
  Send,
  SkipForward,
  Trophy,
  X,
} from 'lucide-react';
import {
  DailyChallengeRecord,
  MinigameRoundPayload,
  Player,
  UserProgression,
} from '../game/types';
import { CLUBS, PLAYERS } from '../game/database';
import { getPlayerAsset } from '../game/playerAssets';
import { getRoundValidPlayerIds, validateMinigameAnswer } from '../game/minigameEngine';
import { getClubsForPairing } from '../game/validator';
import { searchPlayersForAutocomplete } from '../game/silhouetteEngine';
import { getLocalDateKey } from '../game/retentionEngine';
import {
  DAILY_CHALLENGE_COOLDOWN_MS,
  DAILY_CHALLENGE_ROUND_COUNT,
  calculateDailyChallengeReward,
  formatCountdownHMS,
  formatDailyShareSummary,
  generateDailyChallengeRounds,
  getDailyPuzzleNumber,
  getRemainingDailyChallengeCooldownMs,
  markDailyChallengePlayedToday,
  writeDailyChallengeCooldownEndMs,
} from '../game/dailyChallengeEngine';
import { getAuthoritativeServerNowMs } from '../game/serverTime';
import { ClubBadge } from './ClubBadge';
import { CountryFlag } from './CountryFlag';
import { PlayerAvatar } from './PlayerAvatar';
import { sounds } from '../utils/audio';
import { haptics } from '../utils/haptics';

interface DailyChallengeModalProps {
  isOpen: boolean;
  progression: UserProgression;
  onClose: () => void;
  onCompleteDailyChallenge: (record: DailyChallengeRecord) => {
    firstCompletionToday: boolean;
    awardedCoins: number;
    awardedPoints: number;
  };
}

interface RoundOutcome {
  correct: boolean;
  answerText: string;
}

export const DailyChallengeModal: React.FC<DailyChallengeModalProps> = ({
  isOpen,
  progression,
  onClose,
  onCompleteDailyChallenge,
}) => {
  const dateKey = useMemo(() => getLocalDateKey(), [isOpen]);
  const puzzleNumber = useMemo(() => getDailyPuzzleNumber(dateKey), [dateKey]);
  const rounds = useMemo(() => generateDailyChallengeRounds(dateKey), [dateKey]);
  const existingRecord = progression.dailyChallengeHistory?.[dateKey] ?? null;
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(() =>
    getRemainingDailyChallengeCooldownMs(progression)
  );
  const isLockedToday = cooldownRemainingMs > 0;

  const [roundIdx, setRoundIdx] = useState(0);
  const [outcomes, setOutcomes] = useState<RoundOutcome[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isShake, setIsShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roundSolvedBanner, setRoundSolvedBanner] = useState<string | null>(null);
  const [completedRecord, setCompletedRecord] = useState<DailyChallengeRecord | null>(null);
  const [rewardInfo, setRewardInfo] = useState<{
    firstCompletionToday: boolean;
    awardedCoins: number;
    awardedPoints: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRoundIdx(0);
    setOutcomes([]);
    setElapsedSec(0);
    setInputVal('');
    setShowAutocomplete(false);
    setIsShake(false);
    setErrorMsg(null);
    setRoundSolvedBanner(null);
    setCompletedRecord(null);
    setRewardInfo(null);
    setCopied(false);
    setCooldownRemainingMs(getRemainingDailyChallengeCooldownMs(progression));
    startTimeRef.current = Date.now();
  }, [isOpen, dateKey, progression]);

  const isPlayingActive = isOpen && !completedRecord && !isLockedToday;

  useEffect(() => {
    if (!isOpen || isPlayingActive) return;
    const tick = () => setCooldownRemainingMs(getRemainingDailyChallengeCooldownMs(progression));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isPlayingActive, progression]);

  const midnightCountdown = formatCountdownHMS(cooldownRemainingMs);

  useEffect(() => {
    if (!isPlayingActive || roundSolvedBanner) return;
    const interval = setInterval(() => {
      setElapsedSec(Math.max(0.1, (Date.now() - startTimeRef.current) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [isPlayingActive, roundSolvedBanner]);

  const suggestions = useMemo(() => {
    if (!isPlayingActive || inputVal.trim().length < 2) return [];
    return searchPlayersForAutocomplete(inputVal, [], 6);
  }, [isPlayingActive, inputVal]);

  if (!isOpen || typeof document === 'undefined') return null;

  const currentRound: MinigameRoundPayload | undefined = rounds[roundIdx];
  const displayRecord =
    completedRecord ||
    existingRecord ||
    (isLockedToday
      ? {
          dateKey,
          puzzleNumber,
          correctCount: 0,
          totalRounds: DAILY_CHALLENGE_ROUND_COUNT,
          elapsedSec: 0,
          rewardCoins: 0,
          rewardPoints: 0,
          completedAt: Date.now(),
        }
      : null);

  const finalizeDailyChallenge = (finalOutcomes: RoundOutcome[]) => {
    const finalElapsed = Math.max(0.1, Number(((Date.now() - startTimeRef.current) / 1000).toFixed(1)));
    const correctCount = finalOutcomes.filter((o) => o.correct).length;
    const reward = calculateDailyChallengeReward(correctCount);
    const completedAtMs = getAuthoritativeServerNowMs();
    const record: DailyChallengeRecord = {
      dateKey,
      puzzleNumber,
      correctCount,
      totalRounds: DAILY_CHALLENGE_ROUND_COUNT,
      elapsedSec: finalElapsed,
      rewardCoins: reward.coins,
      rewardPoints: reward.points,
      completedAt: completedAtMs,
    };
    // 24 saatlik bekleme süresini localStorage üzerinden kilitle
    markDailyChallengePlayedToday(dateKey);
    writeDailyChallengeCooldownEndMs(record.completedAt + DAILY_CHALLENGE_COOLDOWN_MS);
    setCooldownRemainingMs(DAILY_CHALLENGE_COOLDOWN_MS);
    const res = onCompleteDailyChallenge(record);
    setElapsedSec(finalElapsed);
    setCompletedRecord(record);
    setRewardInfo(res);
    sounds.playVictory();
  };

  const advanceOrFinish = (nextOutcomes: RoundOutcome[]) => {
    if (roundIdx + 1 >= rounds.length) {
      finalizeDailyChallenge(nextOutcomes);
    } else {
      setRoundIdx((prev) => prev + 1);
      setInputVal('');
      setErrorMsg(null);
      setRoundSolvedBanner(null);
      setShowAutocomplete(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  const submitAnswer = (rawValue: string) => {
    if (!currentRound || !rawValue.trim() || roundSolvedBanner) return;
    const val = rawValue.trim();
    const result = validateMinigameAnswer(currentRound, val);

    if (result.isValid && result.player) {
      sounds.playGoal();
      haptics.correct();
      const matchedName = result.player.name;
      const nextOutcomes = [...outcomes, { correct: true, answerText: matchedName }];
      setOutcomes(nextOutcomes);
      setErrorMsg(null);
      setInputVal('');
      setShowAutocomplete(false);
      setRoundSolvedBanner(`Doğru! ${matchedName}`);
      setTimeout(() => {
        advanceOrFinish(nextOutcomes);
      }, 650);
    } else {
      sounds.playWrong();
      haptics.wrong();
      setIsShake(true);
      setErrorMsg(`Yanlış Tahmin! "${val}" bu tur için uygun değil.`);
      setTimeout(() => setIsShake(false), 450);
      setInputVal('');
      setShowAutocomplete(false);
    }
  };

  const handlePassRound = () => {
    if (!currentRound || roundSolvedBanner) return;
    const validIds = getRoundValidPlayerIds(currentRound);
    const exampleId = validIds[0];
    const examplePlayer = exampleId ? PLAYERS[exampleId] : null;
    const nextOutcomes = [
      ...outcomes,
      { correct: false, answerText: examplePlayer ? `Pas (${examplePlayer.name})` : 'Pas' },
    ];
    setOutcomes(nextOutcomes);
    advanceOrFinish(nextOutcomes);
  };

  const shareText = displayRecord
    ? formatDailyShareSummary({
        puzzleNumber: displayRecord.puzzleNumber,
        correctCount: displayRecord.correctCount,
        totalRounds: displayRecord.totalRounds,
        elapsedSec: displayRecord.elapsedSec,
      })
    : '';

  const handleCopyShare = async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // Clipboard API fallback ignored cleanly in restricted environments
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  const renderRoundPrompt = (round: MinigameRoundPayload) => {
    if (round.minigameType === 'two_clubs' && round.pairing) {
      const { club1, club2 } = getClubsForPairing(round.pairing);
      return (
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
            TUR 1/3 • İKİ KULÜP ORTAK FUTBOLCU
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col items-center text-center min-w-0">
              <ClubBadge club={club1} size="md" />
              <span className="mt-2 w-full text-center font-black text-xs sm:text-sm text-white leading-tight line-clamp-2 break-words">
                {club1.name}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">
              +
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col items-center text-center min-w-0">
              <ClubBadge club={club2} size="md" />
              <span className="mt-2 w-full text-center font-black text-xs sm:text-sm text-white leading-tight line-clamp-2 break-words">
                {club2.name}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (round.minigameType === 'career' && round.career) {
      return (
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[10px] font-black uppercase tracking-wider">
            TUR 2/3 • KARİYER YOLU
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 max-h-48 overflow-y-auto space-y-1">
            {round.career.steps.map((step, i) => {
              const club = step.clubId ? CLUBS[step.clubId] : null;
              return (
                <React.Fragment key={`${step.clubName}-${i}`}>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <ClubBadge
                        club={club}
                        clubId={step.clubId}
                        clubName={step.clubName}
                        size="xs"
                      />
                      <span className="text-xs font-extrabold text-white leading-tight line-clamp-2 break-words">
                        {step.clubName}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-black text-sky-400 shrink-0">
                      {step.years}
                    </span>
                  </div>
                  {i < round.career!.steps.length - 1 && (
                    <div className="flex justify-center text-sky-400/70">
                      <ArrowDown className="w-3 h-3" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      );
    }

    if (round.minigameType === 'country_club' && round.countryClub) {
      const club = CLUBS[round.countryClub.clubId];
      return (
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-400/40 text-rose-300 text-[10px] font-black uppercase tracking-wider">
            TUR 3/3 • ÜLKE + KULÜP
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col items-center text-center">
              <CountryFlag
                country={round.countryClub.country}
                flag={round.countryClub.countryFlag}
                size="lg"
                variant="circle"
              />
              <span className="mt-2 font-black text-xs sm:text-sm text-white">
                {round.countryClub.country}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-rose-500 text-white font-black text-sm flex items-center justify-center">
              +
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col items-center text-center">
              {club && <ClubBadge club={club} size="md" />}
              <span className="mt-2 font-black text-xs sm:text-sm text-white leading-tight line-clamp-2">
                {club?.name || round.countryClub.clubId}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return createPortal(
    <div
      data-testid="daily-challenge-modal"
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-950/94 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-400/45 p-4 sm:p-5 shadow-2xl max-h-[92dvh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          aria-label="Günlük Meydan Okumayı Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3 pr-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                GÜNLÜK MEYDAN OKUMA
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[10px] font-black font-mono">
                #{puzzleNumber}
              </span>
              <span
                data-testid="daily-unlimited-energy-badge"
                className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-[10px] font-black font-mono"
              >
                ⚡ ∞ Sınırsız Enerji
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Herkese aynı 3 bulmaca • En hızlı skorunu paylaş!
            </p>
          </div>
        </div>

        {/* Completed / Share Screen */}
        {displayRecord ? (
          <div data-testid="daily-challenge-summary" className="space-y-3 text-center pt-1">
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/40 shadow-inner">
              <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-1.5" />
              <div className="text-xl font-black text-white">
                {displayRecord.correctCount}/{displayRecord.totalRounds} Doğru
              </div>
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-300">
                <Clock className="w-3.5 h-3.5" />
                <span>Süre: {displayRecord.elapsedSec.toFixed(1)} sn</span>
              </div>

              {rewardInfo && rewardInfo.firstCompletionToday ? (
                <div className="mt-2.5 flex items-center justify-center gap-2 text-xs font-black text-amber-300">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>
                    +{rewardInfo.awardedCoins} Coin &amp; +{rewardInfo.awardedPoints} Lig Puanı Kazanıldı!
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-[11px] font-semibold text-slate-400">
                  Bugünkü günlük ödülün hesabına işlendi.
                </div>
              )}
            </div>

            <div
              data-testid="daily-share-preview"
              className="p-3 rounded-2xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-emerald-300 select-all break-words"
            >
              {shareText}
            </div>

            <button
              type="button"
              data-testid="daily-share-copy-btn"
              onClick={handleCopyShare}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Sonuç Panoya Kopyalandı!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Skorunu Tek Tıkla Paylaş</span>
                </>
              )}
            </button>

            <div
              data-testid="daily-modal-countdown"
              className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/35 text-xs font-mono font-black text-amber-300 text-center"
            >
              ✓ Bugün Oynandı • Yeni Meydan Okuma: {midnightCountdown}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs cursor-pointer"
            >
              Kapat
            </button>
          </div>
        ) : (
          currentRound && (
            <div className="space-y-3">
              {/* Top Stats Bar */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-black">
                <span className="text-emerald-300 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  Tur {roundIdx + 1}/{rounds.length}
                </span>
                <span
                  data-testid="daily-timer"
                  className="font-mono text-amber-300 tabular-nums flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {elapsedSec.toFixed(1)} sn
                </span>
              </div>

              {/* Prompt Card */}
              <div className="text-center">{renderRoundPrompt(currentRound)}</div>

              {roundSolvedBanner && (
                <div className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-xs font-black flex items-center justify-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>{roundSolvedBanner}</span>
                </div>
              )}

              {errorMsg && (
                <div className="px-3 py-2 rounded-xl bg-rose-950/85 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">{errorMsg}</span>
                </div>
              )}

              {/* Search & Autocomplete */}
              <div className="relative">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitAnswer(inputVal);
                  }}
                  className="relative flex items-center"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    data-testid="daily-challenge-input"
                    value={inputVal}
                    onFocus={() => setShowAutocomplete(true)}
                    onBlur={() => setTimeout(() => setShowAutocomplete(false), 180)}
                    onChange={(e) => {
                      setInputVal(e.target.value);
                      setShowAutocomplete(true);
                    }}
                    placeholder="Futbolcu adını yaz (en az 2 harf)..."
                    className={`w-full bg-slate-900 text-white font-bold pl-3.5 pr-12 py-3 rounded-2xl border-2 text-sm outline-none transition ${
                      isShake
                        ? 'border-red-500 bg-red-950/40 shadow-[0_0_20px_rgba(239,68,68,0.65)] animate-wrong-shake'
                        : 'border-amber-400/60 focus:border-amber-300'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!inputVal.trim() || Boolean(roundSolvedBanner)}
                    className="absolute right-2 min-w-[38px] min-h-[36px] px-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 disabled:opacity-40 text-slate-950 font-black flex items-center justify-center cursor-pointer"
                    aria-label="Tahmini Gönder"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                {showAutocomplete && suggestions.length > 0 && !roundSolvedBanner && (
                  <div
                    data-testid="daily-autocomplete-list"
                    className="absolute left-0 right-0 bottom-full mb-1.5 z-40 rounded-2xl bg-slate-900 border border-amber-400/50 shadow-2xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-slate-800/80"
                  >
                    {suggestions.map((p: Player) => {
                      const asset = getPlayerAsset(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            submitAnswer(p.name);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800 transition cursor-pointer"
                        >
                          <PlayerAvatar
                            player={p}
                            name={p.name}
                            size="sm"
                            variant="circle"
                            className="w-7 h-7 border border-white/20 shrink-0"
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
                          <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[90px]">
                            {asset.clubName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-slate-400 font-medium">
                  Türkçe/İngilizce karakterler otomatik eşleşir
                </span>
                <button
                  type="button"
                  data-testid="daily-pass-btn"
                  onClick={handlePassRound}
                  disabled={Boolean(roundSolvedBanner)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Pas Geç</span>
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>,
    document.body
  );
};
