import React, { useMemo } from 'react';
import { LeaguePlayerEntry, PlayerProfile, UserProgression } from '../game/types';
import { buildLeagueStandings, formatPoints } from '../game/retentionEngine';
import { MINIGAME_OPTIONS } from '../game/minigameEngine';

interface StatsViewProps {
  playerProfile: PlayerProfile;
  progression: UserProgression;
  liveServerPlayers?: LeaguePlayerEntry[];
}

export const StatsView: React.FC<StatsViewProps> = ({
  playerProfile,
  progression,
  liveServerPlayers = [],
}) => {
  const weeklyRank = useMemo(
    () => buildLeagueStandings(progression, playerProfile, 'weekly', liveServerPlayers).userRank,
    [progression, playerProfile, liveServerPlayers]
  );

  const allTimeRank = useMemo(
    () => buildLeagueStandings(progression, playerProfile, 'all_time', liveServerPlayers).userRank,
    [progression, playerProfile, liveServerPlayers]
  );

  const winRate =
    progression.matchesPlayed > 0
      ? Math.round((progression.wins / progression.matchesPlayed) * 100)
      : 0;

  const totalAttempts = progression.totalCorrectAnswers + progression.totalWrongAttempts;
  const accuracyRate =
    totalAttempts > 0
      ? Math.round((progression.totalCorrectAnswers / totalAttempts) * 100)
      : 0;

  return (
    <div
      data-testid="stats-view"
      className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col gap-5 text-left"
    >
      {/* Top 2x2 Summary KPI Grid matching screenshot */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-950/35 to-slate-900 border border-amber-400/55 shadow-lg">
          <span className="block text-xs font-semibold text-slate-300">
            Toplam puan
          </span>
          <span
            data-testid="stats-total-points"
            className="block mt-1.5 text-2xl sm:text-3xl font-black text-amber-400 font-mono tabular-nums"
          >
            {formatPoints(progression.totalPoints)}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
          <span className="block text-xs font-semibold text-slate-300">
            Bu hafta
          </span>
          <span
            data-testid="stats-weekly-points"
            className="block mt-1.5 text-2xl sm:text-3xl font-black text-white font-mono tabular-nums"
          >
            {formatPoints(progression.weeklyPoints)}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
          <span className="block text-xs font-semibold text-slate-300">
            Haftalık sıra
          </span>
          <span className="block mt-1.5 text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">
            #{weeklyRank}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
          <span className="block text-xs font-semibold text-slate-300">
            Genel sıra
          </span>
          <span className="block mt-1.5 text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">
            #{allTimeRank}
          </span>
        </div>
      </div>

      {/* MAÇLAR Section (2x3 Grid) */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2.5 px-1">
          MAÇLAR
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-800 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
              {progression.matchesPlayed}
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
              Maç
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-800 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
              {progression.wins}
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
              Galibiyet
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-800 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
              {progression.losses}
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
              Mağlubiyet
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-800 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
              {winRate}%
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
              Kazanma
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-800 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
              {progression.winStreak}
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
              Seri
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-800 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
              {progression.bestWinStreak}
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
              En iyi seri
            </span>
          </div>
        </div>
      </div>

      {/* TUR & CEVAP PERFORMANSI Section (with horizontal ratio bars like screenshot) */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2.5 px-1">
          FUTBOL PERFORMANSI
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-3">
          <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-800 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
              {progression.totalCorrectAnswers}
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
              Doğru Cevap
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-800 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
              {progression.fastestAnswerSec !== null
                ? `${progression.fastestAnswerSec.toFixed(1)}s`
                : '-'}
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
              En Hızlı
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-800 text-center">
            <span className="block text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
              {progression.clutchAnswers}
            </span>
            <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">
              Son Saniye
            </span>
          </div>
        </div>

        {/* Accuracy & Win Rate Bars */}
        <div className="p-3.5 rounded-2xl bg-slate-900/85 border border-slate-800 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-300">Tahmin isabeti</span>
              <span className="text-white font-mono tabular-nums">{accuracyRate}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                style={{ width: `${Math.min(100, accuracyRate)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-300">Kazanma oranı</span>
              <span className="text-white font-mono tabular-nums">{winRate}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${Math.min(100, winRate)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Minigames Breakdown */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
          MİNİ OYUN MAÇ SAYILARI
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MINIGAME_OPTIONS.map((mg) => (
            <div
              key={mg.id}
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs"
            >
              <span className="font-bold text-slate-300 truncate">{mg.shortTitle}</span>
              <span className="font-mono font-black text-emerald-400 ml-2">
                {progression.minigameMatchCounts[mg.id] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
