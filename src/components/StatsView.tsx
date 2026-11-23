import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Trophy, UserSearch, X } from 'lucide-react';
import {
  LeaguePlayerEntry,
  PlayerProfile,
  PublicPlayerProfile,
  UserProgression,
} from '../game/types';
import { buildLeagueStandings, formatPoints } from '../game/retentionEngine';
import { MINIGAME_OPTIONS } from '../game/minigameEngine';
import { PlayerAvatar } from './PlayerAvatar';

interface StatsViewProps {
  playerProfile: PlayerProfile;
  progression: UserProgression;
  liveServerPlayers?: LeaguePlayerEntry[];
  onInspectPlayer?: (target: LeaguePlayerEntry | PublicPlayerProfile | string) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({
  playerProfile,
  progression,
  liveServerPlayers = [],
  onInspectPlayer,
}) => {
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<PublicPlayerProfile[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const weeklyRank = useMemo(
    () => buildLeagueStandings(progression, playerProfile, 'weekly', liveServerPlayers).userRank,
    [progression, playerProfile, liveServerPlayers]
  );

  const allTimeRank = useMemo(
    () => buildLeagueStandings(progression, playerProfile, 'all_time', liveServerPlayers).userRank,
    [progression, playerProfile, liveServerPlayers]
  );

  useEffect(() => {
    const q = lookupQuery.trim();
    if (q.length < 2) {
      setLookupResults([]);
      setIsLookingUp(false);
      return;
    }

    let cancelled = false;
    setIsLookingUp(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profiles?q=${encodeURIComponent(q)}&limit=6`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (Array.isArray(data?.profiles)) {
            setLookupResults(data.profiles);
          }
        }
      } catch {
        // Fallback handled below
      } finally {
        if (!cancelled) setIsLookingUp(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lookupQuery]);

  const quickPlayers = useMemo(() => {
    return liveServerPlayers
      .filter((p) => p.id !== playerProfile.id)
      .slice(0, 5);
  }, [liveServerPlayers, playerProfile.id]);

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
      {/* Inspect Another Player Stats Card */}
      {onInspectPlayer && (
        <div
          data-testid="stats-inspect-card"
          className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/35 shadow-lg space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <UserSearch className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Başka Oyuncu İstatistiklerini İncele</span>
            </h3>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-700 focus-within:border-emerald-400">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              data-testid="stats-player-search-input"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Oyuncu adı veya arkadaş kodu yaz..."
              maxLength={24}
              className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-semibold text-white placeholder:text-slate-500 outline-none"
            />
            {lookupQuery && (
              <button
                type="button"
                onClick={() => setLookupQuery('')}
                aria-label="Aramayı temizle"
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {lookupQuery.trim().length >= 2 && (
            <div data-testid="stats-search-results" className="space-y-1.5">
              {isLookingUp && lookupResults.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-slate-300 px-1 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Oyuncular aranıyor...</span>
                </div>
              ) : lookupResults.length === 0 ? (
                <p className="text-xs text-slate-400 px-1 py-1.5">Aramanla eşleşen oyuncu bulunamadı.</p>
              ) : (
                lookupResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`stats-search-result-${p.id}`}
                    onClick={() => {
                      onInspectPlayer(p);
                      setLookupQuery('');
                    }}
                    className="w-full flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-400/50 transition text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PlayerAvatar
                        avatar={p.avatar}
                        name={p.name}
                        size="sm"
                        variant="circle"
                        frame={p.equippedFrame}
                        className="bg-slate-800"
                      />
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-white truncate">
                          {p.name}
                        </span>
                        <span className="block text-[10px] text-slate-400 truncate">
                          {formatPoints(p.totalPoints)} puan • {p.wins}G / {p.matchesPlayed}M
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-black text-emerald-300 shrink-0">
                      İncele →
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {quickPlayers.length > 0 && lookupQuery.trim().length < 2 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {quickPlayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`stats-quick-inspect-${p.id}`}
                  onClick={() => onInspectPlayer(p)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-400/50 text-xs font-bold text-slate-200 transition cursor-pointer"
                >
                  <PlayerAvatar
                    avatar={p.avatar}
                    name={p.name}
                    size="xs"
                    variant="circle"
                    className="bg-slate-800"
                  />
                  <span className="truncate max-w-[110px]">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty Match History Banner for Brand-New Players */}
      {progression.matchesPlayed === 0 && (
        <div
          data-testid="stats-empty-history-state"
          className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-center space-y-1.5"
        >
          <Trophy className="w-6 h-6 text-amber-400 mx-auto" />
          <p className="text-xs font-black text-white">Henüz Maç Geçmişin Yok</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            İlk 1v1 düellona veya Bot Antrenmanı maçına çıkarak puan, seri ve isabet oranı
            istatistiklerini burada oluşturabilirsin!
          </p>
        </div>
      )}

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
