import React from 'react';
import { Clock, Flame, Goal, Sparkles, Timer, Trophy, Zap } from 'lucide-react';
import { MatchPlayerStats, MatchRoundHighlight, PlayerProfile } from '../game/types';
import {
  buildMatchHighlightsSummary,
  getMinigameShortLabel,
  MatchKeyMoment,
} from '../game/matchHighlights';

interface MatchHighlightsPanelProps {
  player1: PlayerProfile;
  player2: PlayerProfile;
  player1Stats: MatchPlayerStats;
  player2Stats: MatchPlayerStats;
  matchHighlights?: MatchRoundHighlight[];
}

function getMomentIcon(kind: MatchKeyMoment['kind']) {
  switch (kind) {
    case 'opener':
      return <Goal className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'fastest':
      return <Zap className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'clutch':
      return <Timer className="w-4 h-4 text-rose-400 shrink-0" />;
    case 'comeback':
      return <Flame className="w-4 h-4 text-orange-400 shrink-0" />;
    case 'decider':
      return <Trophy className="w-4 h-4 text-yellow-300 shrink-0" />;
    case 'draw':
      return <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />;
  }
}

export const MatchHighlightsPanel: React.FC<MatchHighlightsPanelProps> = ({
  player1,
  player2,
  player1Stats,
  player2Stats,
  matchHighlights = [],
}) => {
  const summary = buildMatchHighlightsSummary({
    player1,
    player2,
    player1Stats,
    player2Stats,
    roundHighlights: matchHighlights,
  });

  return (
    <div
      data-testid="match-highlights-screen"
      className="space-y-3 text-left animate-card-pop"
    >
      {/* 1. Total Goals Statistical Summary */}
      <section
        data-testid="highlights-goals-section"
        className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Goal className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white truncate">
              Toplam Gol İstatistikleri
            </h3>
          </div>
          <span
            data-testid="highlights-total-goals"
            className="text-sm font-mono tabular-nums font-black text-emerald-400 shrink-0"
          >
            {summary.totalGoals} Gol
          </span>
        </div>

        {/* 4-Metric Statistical Row (single-line labels so figures align cleanly on 390px) */}
        <div className="grid grid-cols-4 divide-x divide-slate-800/80 rounded-xl bg-slate-900/75 py-2.5 text-center">
          <div className="px-1">
            <span className="block text-[10px] font-bold text-slate-400 whitespace-nowrap">
              Toplam Gol
            </span>
            <span className="block text-base sm:text-lg font-mono tabular-nums font-black text-white mt-0.5">
              {summary.totalGoals}
            </span>
          </div>
          <div className="px-1">
            <span className="block text-[10px] font-bold text-slate-400 whitespace-nowrap">
              Gol / Tur
            </span>
            <span
              data-testid="highlights-goals-per-round"
              className="block text-base sm:text-lg font-mono tabular-nums font-black text-emerald-400 mt-0.5"
            >
              {summary.avgGoalsPerRound.toFixed(2)}
            </span>
          </div>
          <div className="px-1">
            <span className="block text-[10px] font-bold text-slate-400 whitespace-nowrap">
              Tur Sayısı
            </span>
            <span className="block text-base sm:text-lg font-mono tabular-nums font-black text-slate-100 mt-0.5">
              {summary.totalRoundsPlayed}
            </span>
          </div>
          <div className="px-1">
            <span className="block text-[10px] font-bold text-slate-400 whitespace-nowrap">
              İsabet
            </span>
            <span className="block text-base sm:text-lg font-mono tabular-nums font-black text-amber-400 mt-0.5">
              {summary.accuracyRatePct !== null ? `%${summary.accuracyRatePct}` : '-%'}
            </span>
          </div>
        </div>

        {/* Dual-Player Goal Share Bar (numbers never truncated) */}
        <div className="pt-0.5 space-y-1.5">
          <div className="grid grid-cols-2 gap-3 text-[11px] font-bold">
            <div className="min-w-0">
              <div className="text-emerald-300 truncate">{player1.name}</div>
              <div className="font-mono tabular-nums text-white whitespace-nowrap">
                {summary.player1Goals} Gol · %{summary.player1GoalSharePct}
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-sky-300 truncate">{player2.name}</div>
              <div className="font-mono tabular-nums text-white whitespace-nowrap">
                {summary.player2Goals} Gol · %{summary.player2GoalSharePct}
              </div>
            </div>
          </div>

          <div
            role="img"
            aria-label={`${player1.name} %${summary.player1GoalSharePct}, ${player2.name} %${summary.player2GoalSharePct} gol dağılımı`}
            className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden flex"
          >
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${summary.player1GoalSharePct}%` }}
            />
            <div
              className="h-full bg-sky-400 transition-all duration-300"
              style={{ width: `${summary.player2GoalSharePct}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
            <span>Gol Çıkan Tur: {summary.decisiveGoalRounds}</span>
            <span aria-hidden="true">·</span>
            <span>Sonuçsuz: {summary.deadlockRounds}</span>
            <span aria-hidden="true">·</span>
            <span>Toplam Tahmin: {summary.totalAttempts}</span>
          </div>
        </div>
      </section>

      {/* 2. Fastest Answers Breakdown */}
      <section
        data-testid="highlights-fastest-section"
        className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white truncate">
              En Hızlı Verilen Cevaplar
            </h3>
          </div>
          {summary.matchFastestAnswer && (
            <span
              data-testid="highlights-fastest-record"
              className="text-xs font-mono tabular-nums font-black text-amber-300 shrink-0"
            >
              Rekor: {summary.matchFastestAnswer.elapsedSec.toFixed(1)}s
            </span>
          )}
        </div>

        {/* Speed Comparison Strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-800/80 rounded-xl bg-slate-900/75 py-2 text-center">
          <div className="px-1.5 min-w-0">
            <span className="block text-[10px] font-bold text-slate-400 truncate">
              {player1.name}
            </span>
            <span className="block text-sm font-mono tabular-nums font-black text-emerald-400 mt-0.5">
              {summary.player1FastestSec !== null
                ? `${summary.player1FastestSec.toFixed(1)}s`
                : '-'}
            </span>
          </div>
          <div className="px-1.5 min-w-0">
            <span className="block text-[10px] font-bold text-slate-400 truncate">
              {player2.name}
            </span>
            <span className="block text-sm font-mono tabular-nums font-black text-sky-400 mt-0.5">
              {summary.player2FastestSec !== null
                ? `${summary.player2FastestSec.toFixed(1)}s`
                : '-'}
            </span>
          </div>
          <div className="px-1.5 min-w-0">
            <span className="block text-[10px] font-bold text-slate-400 truncate">
              Ortalama
            </span>
            <span className="block text-sm font-mono tabular-nums font-black text-amber-300 mt-0.5">
              {summary.averageAnswerSec !== null
                ? `${summary.averageAnswerSec.toFixed(1)}s`
                : '-'}
            </span>
          </div>
        </div>

        {/* Ranked Fastest Answers List */}
        {summary.fastestAnswers.length > 0 ? (
          <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-900/60">
            {summary.fastestAnswers.slice(0, 5).map((entry) => (
              <div
                key={`${entry.rank}-${entry.playerId}-${entry.roundNumber ?? 'stat'}`}
                data-testid={`fastest-answer-row-${entry.rank}`}
                className="flex items-center justify-between gap-2.5 px-3 py-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-lg font-mono tabular-nums text-xs font-black flex items-center justify-center shrink-0 ${
                      entry.rank === 1
                        ? 'bg-amber-400/20 text-amber-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    #{entry.rank}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {entry.answerText ? entry.answerText : entry.playerName}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      <span
                        className={
                          entry.isUser
                            ? 'text-emerald-300 font-semibold'
                            : 'text-sky-300 font-semibold'
                        }
                      >
                        {entry.playerName}
                      </span>
                      {entry.roundNumber !== null && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>{entry.roundNumber}. Tur</span>
                        </>
                      )}
                      <span aria-hidden="true"> · </span>
                      <span>{entry.minigameLabel}</span>
                      {entry.wasClutch && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="text-rose-300 font-semibold">Son Saniye</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span className="font-mono tabular-nums text-xs font-black text-amber-300 shrink-0">
                  {entry.elapsedSec.toFixed(1)}s
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3 rounded-xl bg-slate-900/60 text-xs text-slate-400">
            Bu maçta süreli gol cevabı kaydedilmedi.
          </div>
        )}
      </section>

      {/* 3. Key Match Moments & Round Timeline */}
      <section
        data-testid="highlights-moments-section"
        className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-sky-400 shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white truncate">
              Maçın Önemli Anları
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-semibold shrink-0">
            {summary.keyMoments.length} Öne Çıkan An
          </span>
        </div>

        <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-900/60">
          {summary.keyMoments.map((moment) => (
            <div
              key={moment.id}
              data-testid={`highlight-moment-${moment.kind}`}
              className="flex items-start gap-2.5 px-3 py-2.5"
            >
              <div className="mt-0.5">{getMomentIcon(moment.kind)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-white truncate">
                    {moment.title}
                  </span>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                    {moment.roundNumber !== null && <span>{moment.roundNumber}. Tur</span>}
                    {moment.roundNumber !== null &&
                      (moment.elapsedSec !== null || moment.scoreLabel) && (
                        <span aria-hidden="true"> · </span>
                      )}
                    {moment.elapsedSec !== null && (
                      <span className="text-amber-300 font-bold">
                        {moment.elapsedSec.toFixed(1)}s
                      </span>
                    )}
                    {moment.elapsedSec !== null && moment.scoreLabel && (
                      <span aria-hidden="true"> · </span>
                    )}
                    {moment.scoreLabel && (
                      <span className="text-emerald-300 font-bold">{moment.scoreLabel}</span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                  {moment.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Chronological Round-by-Round Log */}
        {summary.roundTimeline.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Tur Tur Maç Akışı
            </div>
            <div className="space-y-1">
              {summary.roundTimeline.map((item) => {
                const isGoal = item.reason === 'scored' && Boolean(item.winnerPlayerId);
                const isUserWin = item.winnerPlayerId === player1.id;
                return (
                  <div
                    key={item.roundNumber}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/50 text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono tabular-nums font-bold text-slate-400 shrink-0">
                        T{item.roundNumber}
                      </span>
                      <span className="text-slate-600 shrink-0">·</span>
                      {isGoal ? (
                        <span className="truncate text-slate-200">
                          <span
                            className={
                              isUserWin
                                ? 'text-emerald-300 font-bold'
                                : 'text-sky-300 font-bold'
                            }
                          >
                            {item.winnerName || (isUserWin ? player1.name : player2.name)}
                          </span>
                          {item.acceptedAnswer && (
                            <span className="text-slate-300"> — {item.acceptedAnswer}</span>
                          )}
                        </span>
                      ) : (
                        <span className="truncate text-slate-400">
                          {item.reason === 'timeout'
                            ? `Süre doldu (${getMinigameShortLabel(item.minigameType)})`
                            : item.reason === 'attempts_exhausted'
                            ? 'Deneme hakları doldu'
                            : 'Tur berabere'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                      {item.elapsedSec !== null && (
                        <span className="text-amber-300 font-bold">
                          {item.elapsedSec.toFixed(1)}s
                        </span>
                      )}
                      <span className="text-slate-300 font-bold">
                        {item.scoreAfter.p1}-{item.scoreAfter.p2}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
