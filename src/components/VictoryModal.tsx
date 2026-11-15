import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  Home,
  Award,
  Zap,
  Target,
  Flame,
  Share2,
  Check,
  Film,
  Sparkles,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { PlayerProfile, MatchPlayerStats } from '../game/types';
import { calculatePlayerBadges } from '../game/badges';
import { getAvatarDisplayLabel } from '../game/avatarCatalog';
import { getGoalEffectColors } from '../game/storeCatalog';
import { buildOpponentMiniSummary } from '../game/opponentSummary';
import { CLUBS } from '../game/database';
import { sounds } from '../utils/audio';
import { PlayerAvatar } from './PlayerAvatar';
import { ClubLogo } from './ClubLogo';

interface VictoryModalProps {
  player1: PlayerProfile;
  player2: PlayerProfile;
  player1Stats?: MatchPlayerStats;
  player2Stats?: MatchPlayerStats;
  isOnlineMatch?: boolean;
  rematchState?: 'idle' | 'waiting' | 'opponent_requested' | 'opponent_left';
  matchRewards?: {
    earnedPoints: number;
    earnedCoins: number;
    multiplierApplied?: boolean;
    doubledByAd?: boolean;
  } | null;
  player1Frame?: string;
  goalEffect?: string;
  onRequestDoubleMatchReward?: () => void;
  onRematch: () => void;
  onHome: () => void;
}

const DEFAULT_STATS: MatchPlayerStats = {
  fastestAnswerSec: null,
  totalCorrect: 0,
  totalWrongAttempts: 0,
  currentStreak: 0,
  maxStreak: 0,
  clutchAnswers: 0,
  trailedThenWon: false,
};

export const VictoryModal: React.FC<VictoryModalProps> = ({
  player1,
  player2,
  player1Stats = DEFAULT_STATS,
  player2Stats = DEFAULT_STATS,
  isOnlineMatch = false,
  rematchState = 'idle',
  matchRewards = null,
  player1Frame,
  goalEffect,
  onRequestDoubleMatchReward,
  onRematch,
  onHome,
}) => {
  const isDraw = player1.score === player2.score;
  const winner = player1.score > player2.score ? player1 : player2;
  const [selectedPlayerTab, setSelectedPlayerTab] = useState<'p1' | 'p2'>('p1');
  const [isCopied, setIsCopied] = useState(false);
  const [showOpponentSummary, setShowOpponentSummary] = useState(false);

  const opponentSummary = buildOpponentMiniSummary(player2, player2Stats, {
    opponentScore: player2.score,
    userScore: player1.score,
  });
  const opponentClub = opponentSummary.favoriteClubId
    ? CLUBS[opponentSummary.favoriteClubId]
    : undefined;

  const handleShare = async () => {
    const badgesText = p1Badges.map((b) => `${b.icon} ${b.title}: ${b.subtitle}`).join('\n');
    const shareMessage = `⚽ 3-2-1 FOOTBALL CHALLENGE ⚽
🏆 ${isDraw ? 'Dostluk Kazandı!' : `${getAvatarDisplayLabel(winner.avatar)} ${winner.name} kazandı!`}
Skor: ${player1.name} (${player1.score}) - ${player2.name} (${player2.score})

🎖️ Kazandığım Unvanlar:
${badgesText || '🎖️ Usta Futbol Yarışmacısı'}

⏱️ En Hızlı Cevap: ${player1Stats.fastestAnswerSec ? `${player1Stats.fastestAnswerSec.toFixed(1)}s` : '-'}
🔥 En Uzun Seri: ${player1Stats.maxStreak} Tur

Ortak futbolcuları benden hızlı bulabilir misin? Meydan okuyorum! 🔥`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: '3-2-1 Football Challenge Maç Skorum',
          text: shareMessage,
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to clipboard if share was dismissed or unsupported
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareMessage);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      } catch {
        // Fallback handled
      }
    }
  };

  const p1Badges = calculatePlayerBadges(
    player1,
    player1Stats,
    player2Stats,
    player1.score > player2.score
  );
  const p2Badges = calculatePlayerBadges(
    player2,
    player2Stats,
    player1Stats,
    player2.score > player1.score
  );

  const activeBadges = selectedPlayerTab === 'p1' ? p1Badges : p2Badges;
  const activeStats = selectedPlayerTab === 'p1' ? player1Stats : player2Stats;
  const activePlayer = selectedPlayerTab === 'p1' ? player1 : player2;

  useEffect(() => {
    sounds.playVictory();
    const effectColors = getGoalEffectColors(goalEffect);

    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: effectColors,
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 130,
          spread: 100,
          origin: { y: 0.5 },
          colors: effectColors,
        });
      }, 500);

      return () => clearTimeout(timer);
    } catch {
      // In case canvas-confetti has issues
    }
  }, [goalEffect]);

  return (
    <div
      data-testid="victory-modal"
      className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md flex justify-center items-start sm:items-center animate-screen-fade"
    >
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950 border border-emerald-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl text-center overflow-hidden my-4 sm:my-auto animate-screen-slide-up">
        {/* Glow backdrop */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Big Trophy Badge & Confetti Sparkles */}
        <div className="relative mx-auto mb-3 w-28 h-20 flex items-center justify-center">
          <Sparkles
            aria-hidden="true"
            data-testid="victory-confetti-left"
            className="w-5 h-5 text-amber-300 absolute left-1 top-2 pointer-events-none animate-confetti-left"
          />
          <Sparkles
            aria-hidden="true"
            data-testid="victory-confetti-right"
            className="w-5 h-5 text-emerald-300 absolute right-1 top-1.5 pointer-events-none animate-confetti-right"
          />
          <div
            data-testid="victory-trophy-badge"
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/30 border-2 border-amber-200 animate-trophy-celebrate"
          >
            <Trophy
              data-testid="victory-trophy-icon"
              className="w-8 h-8 sm:w-10 sm:h-10 text-amber-950 animate-trophy-icon-pop"
            />
          </div>
        </div>

        {isDraw ? (
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
              DOSTLUK KAZANDI!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">Nefes kesen maç berabere bitti!</p>
          </div>
        ) : (
          <div>
            <span className="text-[11px] font-black tracking-widest text-amber-400 uppercase px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30">
              MAÇIN ŞAMPİYONU
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-tight flex items-center justify-center gap-2">
              <PlayerAvatar
                avatar={winner.avatar}
                name={winner.name}
                size="sm"
                variant="circle"
                frame={winner.id === player1.id ? player1Frame : undefined}
                className="bg-slate-800 border border-amber-400/50"
              />
              <span>{winner.name}</span>
            </h2>
            <p className="text-xs text-emerald-400 font-semibold mt-0.5">
              Muhteşem futbol bilgisiyle zaferi kutluyor! 🏆
            </p>
          </div>
        )}

        {/* Final Score Duel Box */}
        <div className="my-4 p-3 sm:p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-around">
          <div className="flex flex-col items-center">
            <PlayerAvatar
              avatar={player1.avatar}
              name={player1.name}
              size="sm"
              variant="circle"
              frame={player1Frame}
              className="bg-slate-800 border border-slate-700"
            />
            <span className="text-xs font-bold text-slate-300 truncate max-w-[90px] mt-1">
              {player1.name}
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 mt-0.5">
              {player1.score}
            </span>
            <span className="text-[9px] text-slate-400 uppercase font-bold">GALİBİYET</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              FİNAL
            </span>
            <span className="text-lg font-bold text-slate-600 mt-1">-</span>
          </div>

          <button
            type="button"
            data-testid="victory-opponent-profile-btn"
            onClick={() => setShowOpponentSummary((prev) => !prev)}
            aria-expanded={showOpponentSummary}
            aria-label={`${player2.name} profil ve performans özetini görüntüle`}
            className={`group flex flex-col items-center px-2.5 py-1.5 rounded-2xl border transition cursor-pointer active:scale-95 ${
              showOpponentSummary
                ? 'bg-emerald-500/15 border-emerald-400/60 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800 hover:border-emerald-400/50'
            }`}
          >
            <div className="relative">
              <PlayerAvatar
                avatar={player2.avatar}
                name={player2.name}
                size="sm"
                variant="circle"
                className="bg-slate-800 border border-slate-700 group-hover:border-emerald-400 transition"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border border-emerald-400/70 text-emerald-300 flex items-center justify-center shadow">
                <BarChart3 className="w-2.5 h-2.5" />
              </span>
            </div>
            <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate max-w-[90px] mt-1">
              {player2.name}
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 mt-0.5">
              {player2.score}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-300 uppercase font-black mt-0.5">
              <span>{showOpponentSummary ? 'Özeti Gizle' : 'Profil Özeti'}</span>
              {showOpponentSummary ? (
                <ChevronUp className="w-2.5 h-2.5" />
              ) : (
                <ChevronDown className="w-2.5 h-2.5" />
              )}
            </span>
          </button>
        </div>

        {/* Opponent Mini-Summary Panel (Revealed on Opponent Avatar/Profile Click) */}
        {showOpponentSummary && (
          <div
            data-testid="victory-opponent-summary-card"
            className="mb-4 p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/45 text-left shadow-xl animate-card-pop"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <PlayerAvatar
                  avatar={opponentSummary.avatar}
                  name={opponentSummary.name}
                  size="sm"
                  variant="circle"
                  className="bg-slate-800 border border-emerald-400/50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-white truncate">
                      {opponentSummary.name}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 shrink-0">
                      {opponentSummary.roleLabel}
                    </span>
                  </div>
                  {opponentClub ? (
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 font-semibold">
                      <ClubLogo club={opponentClub} size="xs" />
                      <span className="truncate">{opponentClub.name}</span>
                    </div>
                  ) : (
                    <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                      Son Maç Performansı &amp; Kazanma İstatistiği
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                data-testid="victory-opponent-summary-close"
                onClick={() => setShowOpponentSummary(false)}
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Rakip özetini kapat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Key Win Rate & Match Stats */}
            <div className="grid grid-cols-3 gap-2 my-2.5 text-center">
              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="block text-[9px] font-black uppercase text-slate-400">
                  Kazanma Oranı
                </span>
                <span
                  data-testid="opponent-win-rate"
                  className="block text-sm font-mono font-black text-emerald-400 mt-0.5"
                >
                  %{opponentSummary.winRatePct}
                </span>
                <span className="block text-[9px] text-slate-400 font-semibold">
                  {opponentSummary.totalWins}G / {opponentSummary.totalMatches} Maç
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="block text-[9px] font-black uppercase text-slate-400">
                  Maç Doğruluğu
                </span>
                <span
                  data-testid="opponent-match-accuracy"
                  className="block text-sm font-mono font-black text-amber-400 mt-0.5"
                >
                  {opponentSummary.accuracyPct !== null
                    ? `%${opponentSummary.accuracyPct}`
                    : '-%'}
                </span>
                <span className="block text-[9px] text-slate-400 font-semibold">
                  {opponentSummary.totalCorrect}D / {opponentSummary.totalWrongAttempts}Y
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="block text-[9px] font-black uppercase text-slate-400">
                  Hız &amp; Seri
                </span>
                <span className="block text-sm font-mono font-black text-sky-400 mt-0.5">
                  {opponentSummary.fastestAnswerSec
                    ? `${opponentSummary.fastestAnswerSec.toFixed(1)}s`
                    : '-'}
                </span>
                <span className="block text-[9px] text-slate-400 font-semibold">
                  Maks {opponentSummary.maxStreak} Seri
                </span>
              </div>
            </div>

            {/* Recent 5-Match Form Strip */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Son 5 Maç Formu
              </span>
              <div
                data-testid="opponent-recent-form"
                className="flex items-center gap-1"
              >
                {opponentSummary.recentForm.map((res, idx) => {
                  const isLatest = idx === opponentSummary.recentForm.length - 1;
                  const label = res === 'W' ? 'G' : res === 'L' ? 'M' : 'B';
                  const colorCls =
                    res === 'W'
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                      : res === 'L'
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : 'bg-amber-500/20 border-amber-400/50 text-amber-300';
                  return (
                    <span
                      key={idx}
                      title={isLatest ? 'Bu Maç' : `Önceki Maç ${idx + 1}`}
                      className={`w-6 h-6 rounded-lg border text-[10px] font-black flex items-center justify-center ${colorCls} ${
                        isLatest ? 'ring-1 ring-white/50' : 'opacity-85'
                      }`}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Earned League Points & Coins Pill + Watch Ad to Double Button */}
        {matchRewards && (
          <div
            data-testid="victory-rewards-pill"
            className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-amber-500/15 border border-amber-400/40 flex flex-col items-center gap-2 text-xs font-black"
          >
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {matchRewards.multiplierApplied && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 text-[10px] font-black">
                  ⚡ 2x AKTİF
                </span>
              )}
              <span className="text-emerald-300 flex items-center gap-1">
                🏆 +{matchRewards.earnedPoints} Lig Puanı
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-300 flex items-center gap-1">
                🪙 +{matchRewards.earnedCoins} Coin Kazanıldı
              </span>
            </div>

            {onRequestDoubleMatchReward && (
              <button
                type="button"
                data-testid="victory-double-ad-btn"
                disabled={Boolean(matchRewards.doubledByAd)}
                onClick={onRequestDoubleMatchReward}
                className={`w-full py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  matchRewards.doubledByAd
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 cursor-default'
                    : 'bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 shadow-md active:scale-95'
                }`}
              >
                {matchRewards.doubledByAd ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Ödül Reklam ile 2x Katlandı ✓</span>
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4" />
                    <span>🎬 Reklam İzle &amp; Ödülü 2x Katla!</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Badges & Unvanlar Section */}
        <div className="my-3 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Kazanılan Rozetler & Unvanlar
              </span>
            </div>

            {/* Switch Player Tab */}
            <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 max-w-full">
              <button
                onClick={() => setSelectedPlayerTab('p1')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition truncate max-w-[100px] ${
                  selectedPlayerTab === 'p1'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {player1.name}
              </button>
              <button
                onClick={() => setSelectedPlayerTab('p2')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition truncate max-w-[100px] ${
                  selectedPlayerTab === 'p2'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {player2.name}
              </button>
            </div>
          </div>

          {/* Badges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {activeBadges.length > 0 ? (
              activeBadges.map((badge) => (
                <div
                  key={badge.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${badge.bgColor} ${badge.borderColor} transition shadow-sm`}
                >
                  <span className="text-xl sm:text-2xl shrink-0 p-1 rounded-lg bg-black/20">
                    {badge.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`block font-black text-xs ${badge.textColor}`}>
                      {badge.title}
                    </span>
                    <span className="block text-[11px] text-slate-300 leading-tight mt-0.5">
                      {badge.subtitle}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="sm:col-span-2 text-center py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                Bu maçta özel bir unvan kazanılmadı.
              </div>
            )}
          </div>

          {/* Quick Performance Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
            <div>
              <span className="block text-[10px] text-slate-400 font-bold uppercase">
                En Hızlı Cevap
              </span>
              <span className="font-mono font-bold text-xs text-amber-400 flex items-center justify-center gap-1 mt-0.5">
                <Zap className="w-3 h-3 text-amber-400" />
                {activeStats.fastestAnswerSec ? `${activeStats.fastestAnswerSec.toFixed(1)}s` : '-'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] text-slate-400 font-bold uppercase">
                En Uzun Seri
              </span>
              <span className="font-mono font-bold text-xs text-rose-400 flex items-center justify-center gap-1 mt-0.5">
                <Flame className="w-3 h-3 text-rose-400" />
                {activeStats.maxStreak} Tur
              </span>
            </div>

            <div>
              <span className="block text-[10px] text-slate-400 font-bold uppercase">
                Hatasızlık
              </span>
              <span className="font-mono font-bold text-xs text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
                <Target className="w-3 h-3 text-emerald-400" />
                {activeStats.totalCorrect + activeStats.totalWrongAttempts > 0
                  ? `%${Math.round(
                      (activeStats.totalCorrect /
                        (activeStats.totalCorrect + activeStats.totalWrongAttempts)) *
                        100
                    )}`
                  : '-%'}
              </span>
            </div>
          </div>
        </div>

        {/* Share Score Button */}
        <div className="mt-4">
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm transition transform active:scale-95 shadow-lg shadow-amber-400/20 mb-2.5 cursor-pointer"
            aria-label="Skoru ve Başarıları Paylaş"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 text-emerald-950 stroke-[3]" />
                <span>Skor Panoya Kopyalandı! 📋</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-slate-950" />
                <span>Skoru ve Başarıları Paylaş</span>
              </>
            )}
          </button>
        </div>

        {/* Online Rematch Status Banner */}
        {isOnlineMatch && rematchState !== 'idle' && (
          <div
            className={`mb-2.5 px-3 py-2 rounded-xl border text-xs font-bold ${
              rematchState === 'opponent_left'
                ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                : rematchState === 'opponent_requested'
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 animate-pulse'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            }`}
          >
            {rematchState === 'waiting' && 'Rakibin rövanş onayı bekleniyor...'}
            {rematchState === 'opponent_requested' && `${player2.name} rövanş maçı istiyor!`}
            {rematchState === 'opponent_left' && `${player2.name} odadan ayrıldı.`}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={onRematch}
            disabled={isOnlineMatch && (rematchState === 'waiting' || rematchState === 'opponent_left')}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm transition transform active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {isOnlineMatch && rematchState === 'waiting'
                ? 'Onay Bekleniyor...'
                : isOnlineMatch && rematchState === 'opponent_requested'
                ? 'Rövanşı Kabul Et'
                : 'Rövanş Maçı Yap'}
            </span>
          </button>

          <button
            onClick={onHome}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition active:scale-95 border border-slate-700"
          >
            <Home className="w-4 h-4" />
            <span>Ana Menü</span>
          </button>
        </div>
      </div>
    </div>
  );
};
