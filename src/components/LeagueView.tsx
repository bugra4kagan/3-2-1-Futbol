import React, { useMemo, useState } from 'react';
import { Crown, Trophy, Clock } from 'lucide-react';
import { LeaguePlayerEntry, PlayerProfile, UserProgression } from '../game/types';
import {
  buildLeagueStandings,
  formatPoints,
  getTimeUntilNextMondayReset,
} from '../game/retentionEngine';
import { PlayerAvatar } from './PlayerAvatar';

interface LeagueViewProps {
  playerProfile: PlayerProfile;
  progression: UserProgression;
  liveServerPlayers?: LeaguePlayerEntry[];
  onGoPlay: () => void;
}

type LeagueTab = 'weekly' | 'friends' | 'all_time';

export const LeagueView: React.FC<LeagueViewProps> = ({
  playerProfile,
  progression,
  liveServerPlayers = [],
  onGoPlay,
}) => {
  const [activeTab, setActiveTab] = useState<LeagueTab>('weekly');

  const resetTimer = useMemo(() => getTimeUntilNextMondayReset(), []);
  const { entries, userRank } = useMemo(
    () => buildLeagueStandings(progression, playerProfile, activeTab, liveServerPlayers),
    [progression, playerProfile, activeTab, liveServerPlayers]
  );

  return (
    <div
      data-testid="league-view"
      className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col"
    >
      {/* Top 3-Tab Switcher matching screenshot layout */}
      <div className="grid grid-cols-3 bg-slate-900 border border-slate-800 rounded-2xl p-1 shadow-xl mb-3">
        {(
          [
            { id: 'weekly', label: 'BU HAFTA' },
            { id: 'friends', label: 'ARKADAŞLAR' },
            { id: 'all_time', label: 'TÜM ZAMANLAR' },
          ] as { id: LeagueTab; label: string }[]
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`league-subtab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-black tracking-wide transition cursor-pointer ${
                active
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Weekly Countdown & Prizes Info Banner */}
      {activeTab === 'weekly' && (
        <div className="mb-3.5 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            Haftalık tablo{' '}
            <strong className="text-white">
              {resetTimer.days} gün {resetTimer.hours} saat
            </strong>{' '}
            sonra sıfırlanacak (Pazartesi 00:00). Hafta sonunda ilk üç ödül alır:{' '}
            <span className="text-amber-300 font-bold">
              🥇 1000 • 🥈 500 • 🥉 250 coin
            </span>{' '}
            ve bir hafta boyunca taç.
          </p>
        </div>
      )}

      {activeTab === 'friends' && (
        <div className="mb-3.5 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-2">
          <span>Arkadaş listendeki rakiplerle haftalık puan yarışı!</span>
          <span className="font-black text-emerald-400 whitespace-nowrap">
            Sıran: #{userRank}
          </span>
        </div>
      )}

      {activeTab === 'all_time' && (
        <div className="mb-3.5 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-2">
          <span>Tüm zamanların en yüksek puanlı futbol dahileri 🏆</span>
          <span className="font-black text-amber-400 whitespace-nowrap">
            Genel: #{userRank}
          </span>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="space-y-2">
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          const pts =
            activeTab === 'all_time' ? entry.totalPoints : entry.weeklyPoints;
          const isTop1 = rank === 1;
          const isTop2 = rank === 2;
          const isTop3 = rank === 3;

          const cardBorder = entry.isUser
            ? 'border-emerald-400/80 bg-emerald-950/35 ring-1 ring-emerald-400/40'
            : isTop1
            ? 'border-amber-400/70 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900'
            : isTop2
            ? 'border-slate-400/50 bg-slate-900/95'
            : isTop3
            ? 'border-orange-500/45 bg-slate-900/90'
            : 'border-slate-800/90 bg-slate-900/75';

          const rankColor = isTop1
            ? 'text-amber-400'
            : isTop2
            ? 'text-slate-200'
            : isTop3
            ? 'text-orange-400'
            : 'text-slate-400';

          return (
            <div
              key={entry.id}
              data-testid={`league-row-${rank}`}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl border transition shadow-md ${cardBorder}`}
            >
              {/* Rank Number */}
              <div className={`w-6 text-center font-black text-base tabular-nums shrink-0 ${rankColor}`}>
                {rank}
              </div>

              {/* Avatar Circle */}
              <PlayerAvatar
                avatar={entry.avatar}
                name={entry.name}
                size="md"
                variant="circle"
                className={
                  isTop1
                    ? 'bg-rose-900/70 border border-amber-400'
                    : entry.isUser
                    ? 'bg-emerald-600/30 border border-emerald-400'
                    : 'bg-slate-800 border border-slate-700'
                }
              />

              {/* Name & Subtitle */}
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm sm:text-base text-white truncate">
                    {entry.name}
                  </span>
                  {entry.hasCrown && (
                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  {entry.isUser && (
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shrink-0">
                      sen
                    </span>
                  )}
                </div>
                {entry.subtitle && (
                  <span className="block text-[11px] text-slate-400 truncate mt-0.5">
                    {entry.subtitle}
                  </span>
                )}
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                <span className="font-black text-base sm:text-lg text-amber-400 font-mono tabular-nums">
                  {formatPoints(pts)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty multiplayer notice when no other real players yet */}
      {entries.length <= 1 && (
        <div
          data-testid="league-empty-notice"
          className="mt-3 p-4 rounded-2xl bg-slate-900/65 border border-slate-800 text-center text-xs text-slate-400 leading-relaxed"
        >
          {activeTab === 'friends'
            ? 'Henüz arkadaş eklemedin. Arkadaşlar sekmesinden arkadaş ekledikçe burada yarışabilirsiniz.'
            : 'Henüz başka oyuncu katılmadı. Gerçek oyuncular oyuna girip maç yaptıkça sıralama burada canlı olarak dolacak!'}
        </div>
      )}

      {/* Call to action */}
      <button
        type="button"
        onClick={onGoPlay}
        className="mt-4 w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-emerald-500/20 cursor-pointer"
      >
        <Trophy className="w-4 h-4" />
        <span>Maç Yap & Ligde Yüksel!</span>
      </button>
    </div>
  );
};
