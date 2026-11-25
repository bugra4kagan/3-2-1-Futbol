import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Crown,
  Search,
  Sparkles,
  Trophy,
  UserSearch,
  X,
} from 'lucide-react';
import {
  LeaguePlayerEntry,
  PlayerProfile,
  PublicPlayerProfile,
  UserProgression,
} from '../game/types';
import {
  WEEKLY_LEAGUE_TIERS,
  buildLeagueStandings,
  buildWeeklyLeagueDivisionStandings,
  formatPoints,
  getLeagueTierInfo,
  getTimeUntilSundaySeasonEnd,
} from '../game/retentionEngine';
import { sanitizePublicDisplayName } from '../game/usernameFilter';
import { PlayerAvatar } from './PlayerAvatar';

interface LeagueViewProps {
  playerProfile: PlayerProfile;
  progression: UserProgression;
  liveServerPlayers?: LeaguePlayerEntry[];
  onInspectPlayer?: (target: LeaguePlayerEntry | PublicPlayerProfile | string) => void;
  onDismissSeasonNotice?: () => void;
  onGoPlay: () => void;
}

type LeagueTab = 'weekly' | 'friends' | 'all_time';

export const LeagueView: React.FC<LeagueViewProps> = ({
  playerProfile,
  progression,
  liveServerPlayers = [],
  onInspectPlayer,
  onDismissSeasonNotice,
  onGoPlay,
}) => {
  const [activeTab, setActiveTab] = useState<LeagueTab>('weekly');
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<PublicPlayerProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [seasonCountdown, setSeasonCountdown] = useState(() =>
    getTimeUntilSundaySeasonEnd()
  );

  // Canlı Pazar 23:59 sezon geri sayımı
  useEffect(() => {
    const update = () => setSeasonCountdown(getTimeUntilSundaySeasonEnd());
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const weeklyDivision = useMemo(
    () =>
      buildWeeklyLeagueDivisionStandings(progression, playerProfile, liveServerPlayers),
    [progression, playerProfile, liveServerPlayers]
  );

  const nonWeeklyStandings = useMemo(
    () =>
      activeTab === 'weekly'
        ? { entries: weeklyDivision.entries, userRank: weeklyDivision.userRank }
        : buildLeagueStandings(progression, playerProfile, activeTab, liveServerPlayers),
    [activeTab, weeklyDivision, progression, playerProfile, liveServerPlayers]
  );

  const entries = nonWeeklyStandings.entries;
  const userRank = nonWeeklyStandings.userRank;
  const activeTier = weeklyDivision.tier;
  const nextTier = weeklyDivision.nextTier;
  const promotionCutoff = weeklyDivision.promotionCutoff;
  const relegationStartRank = weeklyDivision.relegationStartRank;

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setRemoteResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profiles?q=${encodeURIComponent(q)}&limit=8`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (Array.isArray(data?.profiles)) {
            setRemoteResults(data.profiles);
          }
        }
      } catch {
        // Fallback handled by local entries filter
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const combinedSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const byId = new Map<string, LeaguePlayerEntry | PublicPlayerProfile>();
    for (const r of remoteResults) {
      byId.set(r.id, r);
    }
    for (const e of entries) {
      if (
        e.name.toLowerCase().includes(q) ||
        (e.friendCode && e.friendCode.toLowerCase().includes(q))
      ) {
        if (!byId.has(e.id)) byId.set(e.id, e);
      }
    }
    return Array.from(byId.values()).slice(0, 6);
  }, [searchQuery, remoteResults, entries]);

  const seasonNotice = progression.lastSeasonResetNotice;
  const seasonNoticeNewTier = seasonNotice
    ? getLeagueTierInfo(seasonNotice.newTierId)
    : null;

  return (
    <div
      data-testid="league-view"
      className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col"
    >
      {/* Season Reset Reward / Promotion Banner */}
      {seasonNotice && seasonNoticeNewTier && (
        <div
          data-testid="league-season-reset-banner"
          className={`mb-3 p-3.5 rounded-2xl border shadow-xl flex items-start justify-between gap-2.5 ${
            seasonNotice.outcome === 'promoted'
              ? 'bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-amber-950/60 border-emerald-400/60'
              : seasonNotice.outcome === 'relegated'
              ? 'bg-rose-950/65 border-rose-500/45'
              : 'bg-slate-900/95 border-slate-700'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-2xl shrink-0">{seasonNoticeNewTier.icon}</span>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-black text-white leading-snug">
                {seasonNotice.outcome === 'promoted'
                  ? `Tebrikler! ${seasonNoticeNewTier.name} kademesine yükseldin!`
                  : seasonNotice.outcome === 'relegated'
                  ? `Yeni Sezon Başladı • ${seasonNoticeNewTier.name}`
                  : `Yeni Sezon Başladı • ${seasonNoticeNewTier.name} korundu`}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                Geçen haftayı #{seasonNotice.finalRank} sırada (
                {formatPoints(seasonNotice.previousWeeklyPoints)} puan) tamamladın.
                {seasonNotice.rewardCoins > 0 && (
                  <span className="text-amber-300 font-black">
                    {' '}
                    +{formatPoints(seasonNotice.rewardCoins)} Coin hesabına eklendi! 🪙
                  </span>
                )}
              </p>
            </div>
          </div>
          {onDismissSeasonNotice && (
            <button
              type="button"
              onClick={onDismissSeasonNotice}
              aria-label="Sezon bildirimini kapat"
              className="p-1 rounded-lg bg-black/25 hover:bg-black/45 text-slate-300 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* 5-Tier Weekly League Hero & Progression Ladder */}
      <div
        data-testid="weekly-league-tier-card"
        className="mb-3 p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 border border-amber-400/35 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-amber-400/50 flex items-center justify-center text-2xl shadow-lg shrink-0">
              {activeTier.icon}
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-widest text-amber-400">
                AKTİF HAFTALIK LİG
              </span>
              <h2
                data-testid="active-league-tier-name"
                className="text-base sm:text-lg font-black text-white leading-tight truncate"
              >
                {activeTier.name}
              </h2>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span
              data-testid="season-countdown-label"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400/15 border border-amber-400/45 text-amber-300 text-[11px] font-black"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{seasonCountdown.label}</span>
            </span>
            <span className="block text-[10px] text-slate-400 font-semibold mt-1">
              Pazar 23:59 sıfırlanır
            </span>
          </div>
        </div>

        {/* 5 Kademeli Lig İlerleme Çubuğu */}
        <div
          data-testid="league-tiers-ladder"
          className="grid grid-cols-5 gap-1.5"
        >
          {WEEKLY_LEAGUE_TIERS.map((tier) => {
            const isCurrent = tier.id === activeTier.id;
            const isPassed = tier.order < activeTier.order;
            return (
              <div
                key={tier.id}
                data-testid={`league-tier-pill-${tier.id}`}
                className={`px-1.5 py-2 rounded-xl border text-center transition ${
                  isCurrent
                    ? 'bg-amber-400/20 border-amber-400 text-white shadow-[0_0_12px_rgba(251,191,36,0.28)]'
                    : isPassed
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950/75 border-slate-800 text-slate-500'
                }`}
              >
                <span className="block text-base leading-none">{tier.icon}</span>
                <span className="block text-[9px] sm:text-[10px] font-black mt-1 truncate">
                  {tier.shortName}
                </span>
              </div>
            );
          })}
        </div>

        {/* Promotion & Relegation Info Strip */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            {nextTier ? (
              <span>
                İlk 3 → <strong>{nextTier.name}</strong> (+
                {formatPoints(activeTier.promotionRewardCoins)} Coin)
              </span>
            ) : (
              <span>
                İlk 3 → Zirve Ödülü (+
                {formatPoints(activeTier.promotionRewardCoins)} Coin)
              </span>
            )}
          </span>
          <span className="text-slate-400 font-bold">
            Sıran:{' '}
            <strong className="text-white font-mono">
              #{weeklyDivision.userRank}/{weeklyDivision.entries.length}
            </strong>
          </span>
        </div>
      </div>

      {/* Top 3-Tab Switcher */}
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

      {/* Player Search & Profile Inspect Bar */}
      <div className="mb-3 relative">
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 focus-within:border-emerald-400/60 rounded-2xl px-3 py-2 transition">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            data-testid="league-player-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Oyuncu Ara & Profil İncele (isim veya kod)..."
            maxLength={24}
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-semibold text-white placeholder:text-slate-500 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Aramayı temizle"
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {searchQuery.trim().length >= 2 && (
          <div
            data-testid="league-search-results"
            className="mt-2 p-2 rounded-2xl bg-slate-900 border border-emerald-500/35 shadow-xl space-y-1.5"
          >
            {isSearching && combinedSearchResults.length === 0 ? (
              <p className="text-xs text-slate-400 px-2 py-1.5">Oyuncular aranıyor...</p>
            ) : combinedSearchResults.length === 0 ? (
              <p className="text-xs text-slate-400 px-2 py-1.5">
                Eşleşen oyuncu bulunamadı.
              </p>
            ) : (
              combinedSearchResults.map((item) => {
                const safeItemName = sanitizePublicDisplayName(item.name, item.id);
                return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`league-search-result-${item.id}`}
                  onClick={() => {
                    onInspectPlayer?.(item);
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-400/40 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlayerAvatar
                      avatar={item.avatar}
                      name={safeItemName}
                      size="sm"
                      variant="circle"
                      className="bg-[#183022] border border-[#D9B76B]/40"
                    />
                    <div className="min-w-0">
                      <span className="block font-bold text-xs text-white truncate">
                        {safeItemName}
                      </span>
                      <span className="block text-[10px] text-slate-400 truncate">
                        {formatPoints(item.totalPoints)} toplam puan
                        {item.friendCode ? ` • ${item.friendCode}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[10px] font-black shrink-0">
                    <UserSearch className="w-3 h-3" />
                    <span>İncele</span>
                  </span>
                </button>
              );
              })
            )}
          </div>
        )}
      </div>

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

      {/* Leaderboard List with Promotion & Relegation Zone Dividers */}
      <div className="space-y-2">
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          const pts =
            activeTab === 'all_time' ? entry.totalPoints : entry.weeklyPoints;
          const isWeekly = activeTab === 'weekly';
          const isPromotionZone = isWeekly && rank <= promotionCutoff;
          const isRelegationZone =
            isWeekly && relegationStartRank !== null && rank >= relegationStartRank;

          const isTop1 = rank === 1;
          const isTop2 = rank === 2;
          const isTop3 = rank === 3;

          const cardBorder = entry.isUser
            ? 'border-emerald-400/85 bg-emerald-950/40 ring-1 ring-emerald-400/45'
            : isRelegationZone
            ? 'border-rose-500/35 bg-rose-950/20'
            : isTop1
            ? 'border-amber-400/70 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900'
            : isTop2
            ? 'border-slate-400/50 bg-slate-900/95'
            : isTop3
            ? 'border-orange-500/45 bg-slate-900/90'
            : 'border-slate-800/90 bg-slate-900/75';

          const rankColor = isRelegationZone
            ? 'text-rose-400'
            : isTop1
            ? 'text-amber-400'
            : isTop2
            ? 'text-slate-200'
            : isTop3
            ? 'text-orange-400'
            : 'text-slate-400';

          return (
            <React.Fragment key={entry.id}>
              {/* Zone Headers in Weekly Tab */}
              {isWeekly && rank === 1 && (
                <div
                  data-testid="league-promotion-zone-header"
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-black uppercase tracking-wider text-emerald-300"
                >
                  <span className="inline-flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5" />
                    {nextTier
                      ? `Küme Yükselme Hattı (İlk 3 → ${nextTier.name})`
                      : 'Şampiyonluk Podyumu (İlk 3)'}
                  </span>
                  <span className="text-amber-300">
                    +{formatPoints(activeTier.promotionRewardCoins)} 🪙
                  </span>
                </div>
              )}

              {isWeekly && rank === promotionCutoff + 1 && (
                <div className="flex items-center gap-2 py-1 px-1">
                  <div className="flex-1 h-px bg-emerald-500/35" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Ligde Kalma Bölgesi
                  </span>
                  <div className="flex-1 h-px bg-emerald-500/35" />
                </div>
              )}

              {isWeekly &&
                relegationStartRank !== null &&
                rank === relegationStartRank && (
                  <div
                    data-testid="league-relegation-zone-header"
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider text-rose-300"
                  >
                    <span className="inline-flex items-center gap-1">
                      <ArrowDown className="w-3.5 h-3.5" />
                      Küme Düşme Hattı
                    </span>
                    {weeklyDivision.prevTier && (
                      <span>→ {weeklyDivision.prevTier.name}</span>
                    )}
                  </div>
                )}

              <button
                type="button"
                data-testid={`league-row-${rank}`}
                onClick={() => onInspectPlayer?.(entry)}
                aria-label={`${entry.name} profilini ve istatistiklerini incele`}
                className={`w-full group flex items-center gap-3 px-3.5 py-3 rounded-2xl border transition shadow-md hover:border-emerald-400/60 active:scale-[0.99] cursor-pointer text-left ${cardBorder}`}
              >
                {/* Rank Number + Promotion/Relegation Arrow */}
                <div className="w-7 flex flex-col items-center justify-center shrink-0">
                  <span
                    className={`font-black text-base tabular-nums leading-none ${rankColor}`}
                  >
                    {rank}
                  </span>
                  {isPromotionZone && (
                    <ArrowUp className="w-3 h-3 text-emerald-400 mt-0.5" />
                  )}
                  {isRelegationZone && (
                    <ArrowDown className="w-3 h-3 text-rose-400 mt-0.5" />
                  )}
                </div>

                {/* Avatar Circle */}
                <PlayerAvatar
                  avatar={entry.avatar}
                  name={entry.name}
                  size="md"
                  variant="circle"
                  frame={entry.equippedFrame}
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
                    {entry.equippedBadge && (
                      <span className="text-sm leading-none shrink-0">
                        {entry.equippedBadge}
                      </span>
                    )}
                    {entry.hasCrown && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    {entry.isUser && (
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shrink-0">
                        sen
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.subtitle && (
                      <span className="text-[11px] text-slate-400 truncate">
                        {entry.subtitle}
                      </span>
                    )}
                    {typeof entry.matchesPlayed === 'number' &&
                      entry.matchesPlayed > 0 && (
                        <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                          {entry.wins ?? 0}G / {entry.matchesPlayed}M
                        </span>
                      )}
                  </div>
                </div>

                {/* Score + Inspect Cue */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="font-black text-base sm:text-lg text-amber-400 font-mono tabular-nums block leading-tight">
                      {formatPoints(pts)}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-300/80 group-hover:text-emerald-300">
                      <UserSearch className="w-2.5 h-2.5" />
                      <span>İncele</span>
                    </span>
                  </div>
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Empty notice for friends/all_time */}
      {activeTab !== 'weekly' && entries.length <= 1 && (
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
        <span>Maç Yap &amp; Ligde Yüksel!</span>
      </button>
    </div>
  );
};
