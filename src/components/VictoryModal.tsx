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
  ChevronRight,
  Goal,
  UserSearch,
  X,
  Swords,
} from 'lucide-react';
import { PlayerProfile, MatchPlayerStats, MatchRoundHighlight } from '../game/types';
import { calculatePlayerBadges, getBadgeCategoryLabel } from '../game/badges';
import { getAvatarDisplayLabel } from '../game/avatarCatalog';
import { getGoalEffectColors } from '../game/storeCatalog';
import { buildOpponentMiniSummary } from '../game/opponentSummary';
import { buildMatchHighlightsSummary } from '../game/matchHighlights';
import { CLUBS, PLAYERS_LIST } from '../game/database';
import { buildFriendChallengeUrl } from '../game/challengeCodeEngine';
import { sanitizePublicDisplayName } from '../game/usernameFilter';
import { sounds } from '../utils/audio';
import { PlayerAvatar } from './PlayerAvatar';
import { ClubBadge } from './ClubBadge';
import { CoinIcon } from './CoinIcon';
import { MatchHighlightsPanel } from './MatchHighlightsPanel';
import {
  formatStoryMatchMetrics,
  pickFeaturedFootballer,
  shareOrDownloadStoryCard,
} from '../utils/storyCardGenerator';

interface VictoryModalProps {
  player1: PlayerProfile;
  player2: PlayerProfile;
  player1Stats?: MatchPlayerStats;
  player2Stats?: MatchPlayerStats;
  matchHighlights?: MatchRoundHighlight[];
  isOnlineMatch?: boolean;
  isBotMatch?: boolean;
  rematchState?: 'idle' | 'waiting' | 'opponent_requested' | 'opponent_left';
  matchRewards?: {
    earnedPoints: number;
    earnedCoins: number;
    multiplierApplied?: boolean;
    doubledByAd?: boolean;
    shieldProtected?: boolean;
    comboLevel?: number;
    comboBonusCoins?: number;
  } | null;
  player1Frame?: string;
  goalEffect?: string;
  energyDeltaLabel?: string | null;
  userLeagueName?: string;
  userLeagueIcon?: string;
  onRequestDoubleMatchReward?: () => void;
  doubleRewardAdLoading?: boolean;
  onRequestRematchAd?: () => void;
  onInspectOpponent?: (opponent: PlayerProfile) => void;
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
  matchHighlights = [],
  isOnlineMatch = false,
  isBotMatch = false,
  rematchState = 'idle',
  matchRewards = null,
  player1Frame,
  goalEffect,
  userLeagueName = 'Amatör Lig',
  userLeagueIcon = '🥉',
  onRequestDoubleMatchReward,
  doubleRewardAdLoading = false,
  onInspectOpponent,
  onRematch,
  onHome,
}) => {
  const isDraw = player1.score === player2.score;
  const userLost = player1.score < player2.score;
  const p1Name = sanitizePublicDisplayName(player1.name, player1.id);
  const p2Name = sanitizePublicDisplayName(player2.name, player2.id);
  const winner = player1.score > player2.score ? { ...player1, name: p1Name } : { ...player2, name: p2Name };
  const [activeView, setActiveView] = useState<'overview' | 'highlights'>('overview');
  const [selectedPlayerTab, setSelectedPlayerTab] = useState<'p1' | 'p2'>('p1');
  const [isCopied, setIsCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [storyStatus, setStoryStatus] = useState<'idle' | 'generating' | 'shared' | 'downloaded' | 'error'>('idle');
  const [showOpponentSummary, setShowOpponentSummary] = useState(false);

  const opponentSummary = buildOpponentMiniSummary(player2, player2Stats, {
    opponentScore: player2.score,
    userScore: player1.score,
  });
  const highlightsSummary = buildMatchHighlightsSummary({
    player1,
    player2,
    player1Stats,
    player2Stats,
    roundHighlights: matchHighlights,
  });
  const opponentClub = opponentSummary.favoriteClubId
    ? CLUBS[opponentSummary.favoriteClubId]
    : undefined;

  const handleShareStoryCard = async () => {
    if (storyStatus === 'generating') return;
    setStoryStatus('generating');
    try {
      const featuredFootballer = pickFeaturedFootballer(matchHighlights, player1.id);
      const { speedLabel, movesLabel } = formatStoryMatchMetrics(
        matchHighlights,
        player1.id,
        player1Stats,
        player1.score
      );
      const outcome = await shareOrDownloadStoryCard({
        playerName: player1.name,
        leagueName: userLeagueName,
        leagueIcon: userLeagueIcon,
        playerScore: player1.score,
        opponentScore: player2.score,
        opponentName: player2.name,
        speedLabel,
        movesLabel,
        featuredFootballer,
      });
      if (outcome === 'shared') {
        setStoryStatus('shared');
        setTimeout(() => setStoryStatus('idle'), 2800);
      } else if (outcome === 'downloaded') {
        setStoryStatus('downloaded');
        setTimeout(() => setStoryStatus('idle'), 2800);
      } else {
        setStoryStatus('idle');
      }
    } catch {
      setStoryStatus('error');
      setTimeout(() => setStoryStatus('idle'), 2500);
    }
  };

  const handleChallengeFriend = async () => {
    const matchedPlayerIds = matchHighlights
      .map((h) => {
        if (!h.acceptedAnswer) return null;
        const clean = h.acceptedAnswer.trim().toLowerCase();
        const found = PLAYERS_LIST.find(
          (pl) => pl.id === clean || pl.name.toLowerCase() === clean
        );
        return found?.id ?? null;
      })
      .filter((id): id is string => Boolean(id));

    const totalElapsedSec = matchHighlights.reduce(
      (sum, h) => sum + (typeof h.elapsedSec === 'number' ? h.elapsedSec : 5),
      0
    );

    const { url } = buildFriendChallengeUrl({
      challengerName: player1.name,
      challengerTimeSec: Math.max(5, totalElapsedSec || player1Stats.fastestAnswerSec || 22),
      playerIds: matchedPlayerIds,
    });

    const msg = `⚔️ ${player1.name} sana 3-2-1 Futbol Meydan Okuması gönderdi!\nAynı 5 futbolcuyu benim süremden hızlı bulabilir misin?\n${url}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: '3-2-1 Futbol Meydan Okuma',
          text: msg,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setChallengeCopied(true);
        setTimeout(() => setChallengeCopied(false), 3000);
      } catch {
        // ignore
      }
    }
  };

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
    sounds.playFullTimeWhistle();
    const fanfareTimer = setTimeout(() => {
      sounds.playVictory();
    }, 800);
    const effectColors = getGoalEffectColors(goalEffect);

    try {
      confetti({
        particleCount: 35,
        spread: 70,
        ticks: 120,
        disableForReducedMotion: true,
        origin: { y: 0.58 },
        colors: effectColors,
      });
    } catch {
      // In case canvas-confetti has issues
    }

    return () => {
      clearTimeout(fanfareTimer);
    };
  }, [goalEffect]);

  return (
    <div
      data-testid="victory-modal"
      className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-4 bg-[#092316]/88 flex justify-center items-start sm:items-center animate-screen-fade"
    >
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#134A2D] via-[#124029] to-[#0F273E] border-2 border-[#E5B94F]/55 rounded-3xl p-4 sm:p-6 shadow-2xl text-center overflow-hidden my-4 sm:my-auto animate-screen-slide-up">

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
        <div className="my-4 p-3 sm:p-4 rounded-2xl bg-[#14232C] border border-white/10 flex items-center justify-around">
          <div className="flex flex-col items-center">
            <PlayerAvatar
              avatar={player1.avatar}
              name={p1Name}
              size="sm"
              variant="circle"
              frame={player1Frame}
            />
            <span className="text-xs font-bold text-[#F8FAFC] truncate max-w-[95px] mt-1">
              {p1Name}
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black text-[#22C55E] mt-0.5">
              {player1.score}
            </span>
            <span className="text-[10px] text-[#94A3B8] font-bold">
              {player1Stats.totalCorrect} Doğru · 🔥 {player1Stats.maxStreak} Seri
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-[#94A3B8] px-2 py-0.5 rounded bg-[#080E14] border border-white/10">
              MAÇ SONU
            </span>
            <span className="text-lg font-bold text-[#94A3B8] mt-1">-</span>
          </div>

          <button
            type="button"
            data-testid="victory-opponent-profile-btn"
            onClick={() => setShowOpponentSummary((prev) => !prev)}
            aria-expanded={showOpponentSummary}
            aria-label={`${p2Name} profil ve performans özetini görüntüle`}
            className="group flex flex-col items-center px-2.5 py-1.5 rounded-2xl border border-transparent hover:border-white/15 transition cursor-pointer active:scale-95"
          >
            <PlayerAvatar
              avatar={isBotMatch ? '🤖' : player2.avatar}
              name={p2Name}
              size="sm"
              variant="circle"
            />
            <div className="flex items-center gap-1 mt-1">
              {isBotMatch && (
                <span className="text-[8px] font-black px-1 py-0.2 rounded bg-[#080E14] border border-white/15 text-[#94A3B8]">
                  BOT
                </span>
              )}
              <span className="text-xs font-bold text-[#F8FAFC] truncate max-w-[90px]">
                {p2Name}
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-mono font-black text-[#22C55E] mt-0.5">
              {player2.score}
            </span>
            <span className="text-[10px] text-[#94A3B8] font-bold">
              {player2Stats.totalCorrect} Doğru · 🔥 {player2Stats.maxStreak} Seri
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
                      <ClubBadge club={opponentClub} size="xs" />
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

            {onInspectOpponent && (
              <button
                type="button"
                data-testid="victory-open-full-opponent-profile"
                onClick={() => onInspectOpponent(player2)}
                className="mt-2.5 w-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.99] cursor-pointer"
              >
                <UserSearch className="w-3.5 h-3.5" />
                <span>Tam Profil &amp; İstatistikleri Gör</span>
              </button>
            )}
          </div>
        )}

        {/* Segmented Switcher: Genel Sonuç | Maç Özeti (Highlights) */}
        <div
          role="tablist"
          aria-label="Maç Sonu Görünümleri"
          className="mb-4 p-1 rounded-2xl bg-slate-950/90 border border-slate-800 grid grid-cols-2 gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'overview'}
            data-testid="victory-tab-overview"
            onClick={() => setActiveView('overview')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeView === 'overview'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 shrink-0" />
            <span>Genel Sonuç</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'highlights'}
            data-testid="victory-tab-highlights"
            onClick={() => setActiveView('highlights')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeView === 'highlights'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Goal className="w-3.5 h-3.5 shrink-0" />
            <span>Maç Özeti</span>
          </button>
        </div>

        {activeView === 'highlights' ? (
          <div className="mb-4">
            <MatchHighlightsPanel
              player1={player1}
              player2={player2}
              player1Stats={player1Stats}
              player2Stats={player2Stats}
              matchHighlights={matchHighlights}
            />
          </div>
        ) : (
          <>
            {/* Compact Maç Özeti Preview Trigger */}
            <button
              type="button"
              data-testid="victory-open-highlights-btn"
              onClick={() => setActiveView('highlights')}
              className="w-full mb-4 p-3 rounded-2xl bg-slate-950/85 hover:bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition text-left flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] min-h-[52px]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <Goal className="w-4 h-4 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white truncate">
                    Maç Özeti (Highlights)
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-300 whitespace-nowrap">
                    {highlightsSummary.totalGoals} Gol
                    <span aria-hidden="true"> · </span>
                    En Hızlı{' '}
                    {highlightsSummary.matchFastestAnswer
                      ? `${highlightsSummary.matchFastestAnswer.elapsedSec.toFixed(1)}s`
                      : '-'}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-black text-amber-300 shrink-0 whitespace-nowrap">
                <span>İncele</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

        {/* Earned League Points & Coins Pill */}
        {matchRewards && (
          <div
            data-testid="victory-rewards-pill"
            className="mb-4 p-3 rounded-2xl bg-[#14232C] border border-white/10 flex flex-col items-center gap-2 text-xs font-black"
          >
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {isBotMatch ? (
                <span className="text-[#94A3B8]">
                  🤖 Bot Maçı • 0 Lig Puanı (Lig puanını etkilemez)
                </span>
              ) : (
                <span
                  className={`flex items-center gap-1 ${
                    matchRewards.earnedPoints < 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'
                  }`}
                >
                  {matchRewards.earnedPoints < 0
                    ? `📉 ${matchRewards.earnedPoints} Lig Puanı`
                    : `🏆 +${matchRewards.earnedPoints} Lig Puanı`}
                </span>
              )}
              <span className="text-white/20">•</span>
              <span className="text-[#FBBF24] flex items-center gap-1">
                <CoinIcon size="xs" />
                <span>+{matchRewards.earnedCoins} Coin Kazanıldı</span>
              </span>
            </div>

            {onRequestDoubleMatchReward &&
              !isDraw &&
              !userLost &&
              (matchRewards.earnedCoins > 0 || matchRewards.doubledByAd) && (
              <button
                type="button"
                data-testid="victory-double-ad-btn"
                disabled={Boolean(matchRewards.doubledByAd) || doubleRewardAdLoading}
                aria-disabled={Boolean(matchRewards.doubledByAd) || doubleRewardAdLoading}
                onClick={() => {
                  if (matchRewards.doubledByAd || doubleRewardAdLoading) return;
                  onRequestDoubleMatchReward();
                }}
                className={`relative overflow-hidden w-full py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
                  matchRewards.doubledByAd
                    ? 'bg-[#123D2B] border border-[#22C55E]/50 text-[#22C55E] cursor-default'
                    : doubleRewardAdLoading
                    ? 'bg-[#FBBF24]/70 text-[#080E14] cursor-wait animate-pulse'
                    : 'bg-[#FBBF24] hover:bg-amber-300 text-[#080E14] active:scale-95 cursor-pointer'
                }`}
              >
                {matchRewards.doubledByAd ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>✓ 2x Ödül Alındı</span>
                  </>
                ) : doubleRewardAdLoading ? (
                  <>
                    <Film className="w-4 h-4" />
                    <span>Reklam oynatılıyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      🎬 Reklam İzle ve Ödülü 2x Katla (+{matchRewards.earnedCoins} Coin)
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Badges & Unvanlar Section */}
        <div className="my-3 text-left" data-testid="victory-badges-section">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider text-white truncate">
                Maç Rozetleri
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400 font-semibold shrink-0">
                · {activeBadges.length} Rozet
              </span>
            </div>

            {/* Switch Player Tab */}
            <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto bg-slate-950 rounded-lg p-0.5 border border-slate-800">
              <button
                type="button"
                data-testid="victory-badges-tab-p1"
                onClick={() => setSelectedPlayerTab('p1')}
                className={`min-h-[34px] px-2.5 py-1 rounded-md text-[10px] font-bold transition inline-flex items-center justify-center gap-1 min-w-0 cursor-pointer ${
                  selectedPlayerTab === 'p1'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="truncate max-w-[125px]">{player1.name}</span>
                <span className="font-mono tabular-nums shrink-0 opacity-85">({p1Badges.length})</span>
              </button>
              <button
                type="button"
                data-testid="victory-badges-tab-p2"
                onClick={() => setSelectedPlayerTab('p2')}
                className={`min-h-[34px] px-2.5 py-1 rounded-md text-[10px] font-bold transition inline-flex items-center justify-center gap-1 min-w-0 cursor-pointer ${
                  selectedPlayerTab === 'p2'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="truncate max-w-[125px]">{player2.name}</span>
                <span className="font-mono tabular-nums shrink-0 opacity-85">({p2Badges.length})</span>
              </button>
            </div>
          </div>

          {/* Badges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {activeBadges.length > 0 ? (
              activeBadges.map((badge) => (
                <div
                  key={badge.id}
                  data-testid={`victory-badge-${badge.id}`}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${badge.bgColor} ${badge.borderColor} transition shadow-sm`}
                >
                  <span className="text-xl sm:text-2xl shrink-0 p-1 rounded-lg bg-black/25">
                    {badge.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                      {getBadgeCategoryLabel(badge.badgeType)}
                    </span>
                    <span className={`block font-black text-xs leading-snug mt-0.5 ${badge.textColor}`}>
                      {badge.title}
                    </span>
                    <span className="block text-[11px] text-slate-300 leading-snug mt-0.5">
                      {badge.subtitle}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="sm:col-span-2 text-center py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                Bu maçta özel bir rozet kazanılmadı.
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
          </>
        )}

        {/* Share Score, Instagram Story Card & Friend Challenge Buttons */}
        <div className="mt-4 space-y-2.5 mb-2.5">
          {!isDraw && !userLost && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="victory-story-share-btn"
                disabled={storyStatus === 'generating'}
                onClick={handleShareStoryCard}
                className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-amber-400 hover:from-fuchsia-500 hover:via-pink-400 hover:to-amber-300 disabled:opacity-65 text-white font-black text-xs sm:text-sm transition transform active:scale-95 shadow-lg shadow-fuchsia-500/25 border border-pink-300/40 cursor-pointer"
                aria-label="Instagram Hikayede Paylaş"
              >
                <span>
                  {storyStatus === 'generating'
                    ? '⏳ Hazırlanıyor...'
                    : storyStatus === 'shared'
                    ? '✓ Paylaşım Açıldı!'
                    : storyStatus === 'downloaded'
                    ? '✓ Story İndirildi!'
                    : storyStatus === 'error'
                    ? '⚠️ Tekrar Dene'
                    : '📸 Hikayede Paylaş'}
                </span>
              </button>

              <button
                type="button"
                data-testid="victory-friend-challenge-btn"
                onClick={handleChallengeFriend}
                className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-black text-xs sm:text-sm transition transform active:scale-95 shadow-lg shadow-cyan-500/25 border border-cyan-300/40 cursor-pointer"
                aria-label="Arkadaşına Meydan Oku"
              >
                <Swords className="w-4 h-4 shrink-0" />
                <span>
                  {challengeCopied ? '✓ Link Kopyalandı!' : '⚔️ Arkadaşına Meydan Oku'}
                </span>
              </button>
            </div>
          )}

          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm transition transform active:scale-95 shadow-lg shadow-amber-400/20 cursor-pointer"
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
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed text-[#080E14] font-black text-sm transition transform active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {isOnlineMatch && rematchState === 'waiting'
                ? 'Onay Bekleniyor...'
                : isOnlineMatch && rematchState === 'opponent_requested'
                ? 'Rövanşı Kabul Et'
                : 'Tekrar Oyna'}
            </span>
          </button>

          <button
            onClick={onHome}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#14232C] hover:bg-[#080E14] text-[#F8FAFC] font-bold text-sm transition active:scale-95 border border-white/10 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Ana Menüye Dön</span>
          </button>
        </div>
      </div>
    </div>
  );
};
