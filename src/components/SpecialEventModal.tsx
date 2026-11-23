import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Coins, Film, Search, Sparkles, Swords, Timer, Trophy, X } from 'lucide-react';
import { Player } from '../game/types';
import { PLAYERS_LIST } from '../game/database';
import { FriendChallengePayload } from '../game/challengeCodeEngine';
import {
  SPECIAL_EVENT_COIN_COST,
  SPECIAL_EVENT_JACKPOT_COINS,
  SpecialEventState,
  canUseFreeSpecialEventEntry,
} from '../game/specialEventEngine';
import { normalizeText } from '../game/validator';
import { showRewardedAd } from '../services/adService';
import { soundManager } from '../utils/soundManager';
import { haptics } from '../utils/haptics';
import { PlayerAvatar } from './PlayerAvatar';
import { CountryFlag } from './CountryFlag';

interface SpecialEventModalProps {
  isOpen: boolean;
  mode: 'weekend_cup' | 'friend_challenge';
  lineup: Player[];
  eventState: SpecialEventState;
  userCoins: number;
  adFree?: boolean;
  friendChallenge?: FriendChallengePayload | null;
  onStartEntry: (entryType: 'free' | 'ad' | 'coin') => boolean;
  onCompleteEvent: (result: {
    mode: 'weekend_cup' | 'friend_challenge';
    correctCount: number;
    totalStars: number;
    elapsedSec: number;
    wonJackpot: boolean;
  }) => void;
  onClose: () => void;
}

export const SpecialEventModal: React.FC<SpecialEventModalProps> = ({
  isOpen,
  mode,
  lineup,
  eventState,
  userCoins,
  adFree = false,
  friendChallenge = null,
  onStartEntry,
  onCompleteEvent,
  onClose,
}) => {
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'summary'>(
    mode === 'friend_challenge' ? 'playing' : 'lobby'
  );
  const [starIndex, setStarIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongMsg, setWrongMsg] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [adLoading, setAdLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPhase(mode === 'friend_challenge' ? 'playing' : 'lobby');
      setStarIndex(0);
      setCorrectCount(0);
      setWrongMsg(null);
      setQuery('');
      setElapsedSec(0);
      setAdLoading(false);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen || phase !== 'playing') return;
    const t = setInterval(() => {
      setElapsedSec((prev) => Number((prev + 0.1).toFixed(1)));
    }, 100);
    return () => clearInterval(t);
  }, [isOpen, phase]);

  const suggestions = useMemo(() => {
    const clean = normalizeText(query);
    if (clean.length < 2) return [];
    return PLAYERS_LIST.filter((p) => {
      const nName = normalizeText(p.name);
      if (nName.includes(clean)) return true;
      return p.aliases.some((a) => normalizeText(a).includes(clean));
    }).slice(0, 6);
  }, [query]);

  if (!isOpen || typeof document === 'undefined') return null;

  const currentStar = lineup[starIndex];
  const freeReady = canUseFreeSpecialEventEntry(eventState);
  const canAffordCoin = userCoins >= SPECIAL_EVENT_COIN_COST;

  const handleLaunchRun = (entryType: 'free' | 'ad' | 'coin') => {
    const ok = onStartEntry(entryType);
    if (!ok) return;
    soundManager.playMatchStartWhistle();
    setStarIndex(0);
    setCorrectCount(0);
    setElapsedSec(0);
    setQuery('');
    setWrongMsg(null);
    setPhase('playing');
  };

  const handleAdEntry = async () => {
    if (adLoading) return;
    setAdLoading(true);
    try {
      const res = await showRewardedAd('weekend_cup_entry', { adFreeBypass: adFree });
      if (res.completed) {
        handleLaunchRun('ad');
      }
    } finally {
      setAdLoading(false);
    }
  };

  const advanceOrFinish = (nextCorrect: number) => {
    setQuery('');
    setWrongMsg(null);
    if (starIndex + 1 >= lineup.length) {
      const wonJackpot = nextCorrect >= lineup.length;
      if (wonJackpot) {
        soundManager.playVictoryFanfare();
      }
      setPhase('summary');
      onCompleteEvent({
        mode,
        correctCount: nextCorrect,
        totalStars: lineup.length,
        elapsedSec,
        wonJackpot,
      });
    } else {
      setStarIndex((i) => i + 1);
    }
  };

  const handleSelectSuggestion = (player: Player) => {
    if (!currentStar || phase !== 'playing') return;
    if (player.id === currentStar.id) {
      soundManager.playCorrectCheer();
      haptics.correct();
      const nextCorrect = correctCount + 1;
      setCorrectCount(nextCorrect);
      advanceOrFinish(nextCorrect);
    } else {
      soundManager.playWrongPost();
      haptics.wrong();
      setWrongMsg(`Yanlış tahmin (${player.name})! Tekrar dene veya pas geç.`);
    }
  };

  const handleSkipStar = () => {
    soundManager.playWrongPost();
    advanceOrFinish(correctCount);
  };

  return createPortal(
    <div
      data-testid="special-event-modal"
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-black/90 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-purple-950/35 to-slate-950 border border-fuchsia-400/50 rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Lobby Phase (Weekend Special Cup) */}
        {phase === 'lobby' && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-fuchsia-500 via-amber-400 to-emerald-400 flex items-center justify-center shadow-lg shadow-fuchsia-500/25">
              <Trophy className="w-8 h-8 text-slate-950" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-200 text-[10px] font-black uppercase tracking-wider mb-1.5">
              <Sparkles className="w-3 h-3" /> Hafta Sonu Özel Turnuvası
            </span>
            <h3 className="text-xl font-black text-white">
              🏟️ Derbi &amp; Efsaneler Kupası
            </h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Arka arkaya 5 yıldız futbolcuyu kariyer ve kulüp ipuçlarından bil! 5&apos;te 5 yapanlar dev ödülü kapar.
            </p>

            <div className="my-4 p-3.5 rounded-2xl bg-slate-950/90 border border-amber-400/40 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Büyük Ödül (5/5 Yıldız):</span>
              <span className="text-base font-black text-amber-300 font-mono">
                +{SPECIAL_EVENT_JACKPOT_COINS} 🪙
              </span>
            </div>

            {freeReady ? (
              <button
                type="button"
                data-testid="special-event-free-start-btn"
                onClick={() => handleLaunchRun('free')}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ücretsiz Günlük Girişi Başlat (1/1)</span>
              </button>
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  data-testid="special-event-ad-start-btn"
                  disabled={adLoading}
                  onClick={handleAdEntry}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-fuchsia-500 to-amber-400 hover:from-fuchsia-400 hover:to-amber-300 disabled:opacity-60 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition active:scale-95"
                >
                  <Film className="w-4 h-4" />
                  <span>
                    {adLoading ? 'Reklam Oynatılıyor...' : '🎬 Reklam İzle ve Ekstra Giriş Kazan'}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="special-event-coin-start-btn"
                  disabled={!canAffordCoin}
                  onClick={() => handleLaunchRun('coin')}
                  className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                >
                  <Coins className="w-4 h-4" />
                  <span>{SPECIAL_EVENT_COIN_COST} Coin ile Kupaya Katıl</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Playing Phase (5-Star Gauntlet) */}
        {phase === 'playing' && currentStar && (
          <div>
            <div className="flex items-center justify-between gap-2 pr-10 mb-3">
              <div className="flex items-center gap-2">
                {mode === 'friend_challenge' ? (
                  <Swords className="w-5 h-5 text-amber-400" />
                ) : (
                  <Trophy className="w-5 h-5 text-fuchsia-400" />
                )}
                <span className="text-sm font-black text-white">
                  {mode === 'friend_challenge'
                    ? `${friendChallenge?.challengerName || 'Arkadaş'} Meydan Okuması`
                    : 'Derbi & Efsaneler Kupası'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-cyan-500/40 text-xs font-mono font-black text-cyan-300">
                <Timer className="w-3.5 h-3.5" />
                {elapsedSec.toFixed(1)}s
              </span>
            </div>

            {mode === 'friend_challenge' && friendChallenge && (
              <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-[11px] font-bold text-amber-200 flex items-center justify-between">
                <span>🎯 Hedef Süre ({friendChallenge.challengerName}):</span>
                <span className="font-mono font-black">{friendChallenge.challengerTimeSec.toFixed(1)}s</span>
              </div>
            )}

            {/* Star Progress Pills */}
            <div className="flex items-center gap-1.5 mb-3">
              {lineup.map((st, idx) => (
                <div
                  key={st.id}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    idx < starIndex
                      ? 'bg-emerald-400'
                      : idx === starIndex
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-800'
                  }`}
                />
              ))}
              <span className="text-[11px] font-mono font-black text-slate-300 ml-1">
                {starIndex + 1}/{lineup.length}
              </span>
            </div>

            {/* Mystery Footballer Clue Card */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 text-center mb-3">
              <div className="flex justify-center mb-2">
                <div className="blur-[5px] opacity-90 select-none pointer-events-none">
                  <PlayerAvatar player={currentStar} name="Gizli Yıldız" size="lg" variant="circle" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap text-xs font-black text-white">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700">
                  <CountryFlag country={currentStar.nationality} flag={currentStar.flag} size="xs" />
                  <span>{currentStar.nationality}</span>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  {currentStar.position}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300">
                  #{currentStar.shirtNumber ?? 10} • {currentStar.league}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                {(currentStar.careerHistory || []).slice(-3).map((step, idx) => (
                  <span
                    key={`${step.club}-${idx}`}
                    className="text-[11px] px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-semibold"
                  >
                    {step.countryFlag} {step.club} ({step.years})
                  </span>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setWrongMsg(null);
                }}
                placeholder="Futbolcu adını yaz (örn: Icardi, Drogba)..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-400 outline-none text-sm text-white placeholder:text-slate-500"
              />
            </div>

            {wrongMsg && (
              <p className="mt-2 text-xs font-bold text-rose-300 text-center">{wrongMsg}</p>
            )}

            {suggestions.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 divide-y divide-slate-800">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-800/90 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="text-xs font-bold text-white truncate">
                      {s.flag} {s.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{s.clubName}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleSkipStar}
              className="mt-3 w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              Bu Yıldızı Pas Geç (Cevap: ???) →
            </button>
          </div>
        )}

        {/* Summary Phase */}
        {phase === 'summary' && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-emerald-500 to-amber-300 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-8 h-8 text-slate-950" />
            </div>
            <h3 className="text-xl font-black text-white">
              {correctCount === lineup.length ? '🏆 Mükemmel 5/5!' : `${correctCount}/${lineup.length} Yıldız Bulundu!`}
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Tamamlama Süren: <span className="font-mono font-black text-cyan-300">{elapsedSec.toFixed(1)} saniye</span>
            </p>

            {mode === 'weekend_cup' ? (
              <div className="my-4 p-3.5 rounded-2xl bg-slate-950/90 border border-amber-400/50">
                {correctCount === lineup.length ? (
                  <span className="text-sm font-black text-amber-300">
                    🎉 Büyük Ödül Kazanıldı: +{SPECIAL_EVENT_JACKPOT_COINS} Coin!
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-300">
                    Büyük ödül için 5/5 yapmalısın! Katılım ödülü olarak +{correctCount * 40} Coin hesabına eklendi.
                  </span>
                )}
              </div>
            ) : friendChallenge ? (
              <div className="my-4 p-3.5 rounded-2xl bg-slate-950/90 border border-amber-400/50">
                {correctCount === lineup.length && elapsedSec <= friendChallenge.challengerTimeSec ? (
                  <span className="text-sm font-black text-emerald-300">
                    ⚔️ {friendChallenge.challengerName} adlı arkadaşını geçtin! (+250 Bonus Coin)
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-200">
                    {friendChallenge.challengerName} ({friendChallenge.challengerTimeSec.toFixed(1)}s) bu turda önde kaldı — tekrar dene!
                  </span>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm cursor-pointer"
            >
              Harika! Ana Menüye Dön
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
