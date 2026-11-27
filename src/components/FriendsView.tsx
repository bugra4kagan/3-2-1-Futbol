import React, { useEffect, useState } from 'react';
import {
  UserPlus,
  Users,
  Copy,
  Check,
  Clock,
  Swords,
  Trash2,
  Sparkles,
  Search,
  UserSearch,
  X,
  Bell,
  Loader2,
} from 'lucide-react';
import {
  LeaguePlayerEntry,
  MinigameType,
  PublicPlayerProfile,
  UserProgression,
} from '../game/types';
import {
  formatPoints,
  hasPendingOutgoingRequest,
  isBotFriendRecord,
} from '../game/retentionEngine';
import { sanitizePublicDisplayName } from '../game/usernameFilter';
import { PlayerAvatar } from './PlayerAvatar';
import { fetchBackendWithWakeupRetry } from '../services/backendClient';

type InspectTarget = {
  id: string;
  name: string;
  avatar: string;
  friendCode?: string;
  weeklyPoints?: number;
  totalPoints?: number;
  subtitle?: string;
};

interface FriendsViewProps {
  progression: UserProgression;
  selfPlayerId?: string;
  liveServerPlayers?: LeaguePlayerEntry[];
  onInspectPlayer?: (target: InspectTarget | PublicPlayerProfile | string) => void;
  onAddFriend: (
    targetOrCode: string | InspectTarget | PublicPlayerProfile | LeaguePlayerEntry
  ) => { ok: boolean; pendingConfirmation?: boolean; error?: string };
  onAcceptFriendRequest?: (requestId: string) => void;
  onRejectFriendRequest?: (requestId: string) => void;
  onCancelOutgoingRequest?: (requestId: string) => void;
  onRemoveFriend: (friendId: string) => void;
  onChallengeFriend: (minigameType: MinigameType) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  progression,
  selfPlayerId,
  liveServerPlayers = [],
  onInspectPlayer,
  onAddFriend,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onCancelOutgoingRequest,
  onRemoveFriend,
  onChallengeFriend,
}) => {
  const [friendInput, setFriendInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedMyCode, setCopiedMyCode] = useState(false);

  const [profileQuery, setProfileQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicPlayerProfile[]>([]);
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false);

  useEffect(() => {
    const q = profileQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearchingProfiles(false);
      return;
    }

    let cancelled = false;
    setIsSearchingProfiles(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchBackendWithWakeupRetry(
          `/api/profiles?q=${encodeURIComponent(q)}&limit=8`,
          {},
          { timeoutMs: 12000, retries: 1 }
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (Array.isArray(data?.profiles)) {
            setSearchResults(data.profiles);
          }
        }
      } catch {
        // Fallback handled below
      } finally {
        if (!cancelled) setIsSearchingProfiles(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profileQuery]);

  const handleCopyMyCode = () => {
    navigator.clipboard?.writeText(progression.friendCode);
    setCopiedMyCode(true);
    setTimeout(() => setCopiedMyCode(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendInput.trim()) return;
    const res = onAddFriend(friendInput.trim());
    if (res.ok) {
      if (!res.pendingConfirmation) {
        setFeedback({ type: 'ok', text: 'Arkadaşlık isteği gönderildi!' });
      }
      setFriendInput('');
    } else {
      setFeedback({ type: 'err', text: res.error || 'İstek gönderilemedi.' });
    }
    if (!res.ok || !res.pendingConfirmation) {
      setTimeout(() => setFeedback(null), 2600);
    }
  };

  const handleAddTarget = (
    target: InspectTarget | PublicPlayerProfile | LeaguePlayerEntry
  ) => {
    const res = onAddFriend(target);
    if (!res.ok) {
      setFeedback({ type: 'err', text: res.error || 'İstek gönderilemedi.' });
      setTimeout(() => setFeedback(null), 2600);
    }
  };

  const blockedIds = new Set(progression.blockedPlayerIds || []);
  const realFriends = progression.friends.filter((f) => !isBotFriendRecord(f));
  const addedIds = new Set(realFriends.map((f) => f.id));
  const incomingRequests = (progression.incomingFriendRequests ?? []).filter(
    (r) => r.status === 'pending' && !blockedIds.has(r.fromPlayerId) && !isBotFriendRecord(r)
  );
  const outgoingRequests = (progression.outgoingFriendRequests ?? []).filter(
    (r) => r.status === 'pending' && !isBotFriendRecord(r)
  );

  const realOnlinePlayers = liveServerPlayers
    .filter(
      (p) =>
        p.id !== selfPlayerId &&
        !addedIds.has(p.id) &&
        !blockedIds.has(p.id) &&
        !isBotFriendRecord(p)
    )
    .slice(0, 6);

  return (
    <div
      data-testid="friends-view"
      className="w-full max-w-[560px] mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col gap-4 text-left"
    >
      {/* My Friend Code Card */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shadow-xl">
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
            SENİN ARKADAŞ KODUN
          </span>
          <span className="block font-mono font-black text-2xl text-white tracking-wider mt-0.5">
            {progression.friendCode}
          </span>
          <span className="block text-[11px] text-slate-400">
            Kodunu paylaş veya aşağıdaki alandan arkadaşlık isteği gönder
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopyMyCode}
          className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer"
        >
          {copiedMyCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copiedMyCode ? 'Kopyalandı' : 'Kopyala'}</span>
        </button>
      </div>

      {/* Incoming Friend Requests Section */}
      {incomingRequests.length > 0 && (
        <section
          data-testid="incoming-friend-requests-section"
          aria-label="Gelen Arkadaşlık İstekleri"
          className="p-3.5 rounded-2xl bg-gradient-to-b from-rose-950/35 via-slate-900/95 to-slate-900 border border-rose-500/45 shadow-lg space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-200 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-rose-400" />
              <span>GELEN İSTEKLER</span>
            </h3>
            <span
              data-testid="friends-incoming-count-badge"
              className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-black shadow-[0_0_10px_rgba(244,63,94,0.7)] tabular-nums"
            >
              {incomingRequests.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {incomingRequests.map((req) => {
              const safeFromName = sanitizePublicDisplayName(req.fromName, req.fromPlayerId);
              return (
                <div
                  key={req.id}
                  data-testid={`incoming-request-row-${req.id}`}
                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-slate-950/90 border border-rose-500/30"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onInspectPlayer?.({
                        id: req.fromPlayerId,
                        name: safeFromName,
                        avatar: req.fromAvatar,
                        friendCode: req.fromFriendCode,
                        weeklyPoints: req.weeklyPoints,
                        totalPoints: req.totalPoints,
                        subtitle: req.subtitle,
                      })
                    }
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <PlayerAvatar
                      avatar={req.fromAvatar}
                      name={safeFromName}
                      size="sm"
                      variant="circle"
                      className="bg-slate-800 border border-rose-400/40 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="block font-black text-xs sm:text-sm text-white truncate">
                        {safeFromName}
                      </span>
                      <span className="block text-[10px] text-rose-200/80 truncate">
                        Sana arkadaşlık isteği gönderdi • #{req.fromFriendCode}
                      </span>
                    </div>
                  </button>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    data-testid={`reject-friend-request-${req.id}`}
                    onClick={() => onRejectFriendRequest?.(req.id)}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/60 text-slate-300 hover:text-rose-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reddet</span>
                  </button>
                  <button
                    type="button"
                    data-testid={`accept-friend-request-${req.id}`}
                    onClick={() => onAcceptFriendRequest?.(req.id)}
                    className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center gap-1 transition active:scale-95 shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Kabul Et</span>
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Add Friend Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5"
      >
        <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
          Arkadaş Ekle (Kod veya Kullanıcı Adı)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={friendInput}
            onChange={(e) => setFriendInput(e.target.value)}
            placeholder="Örn: FC1234 veya oyuncu ismi..."
            maxLength={20}
            className="flex-1 min-w-0 bg-slate-950 text-white font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-400 outline-none text-sm"
          />
          <button
            type="submit"
            data-testid="add-friend-btn"
            disabled={!friendInput.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Arkadaş Ekle</span>
          </button>
        </div>
        {feedback && (
          <p
            className={`text-xs font-bold ${
              feedback.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {feedback.text}
          </p>
        )}
      </form>

      {/* Outgoing Pending Requests Section */}
      {outgoingRequests.length > 0 && (
        <section
          data-testid="outgoing-friend-requests-section"
          aria-label="Bekleyen Arkadaşlık İstekleri"
          className="p-3.5 rounded-2xl bg-slate-900/85 border border-amber-500/35 space-y-2"
        >
          <h3 className="text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>GÖNDERİLEN İSTEKLER ({outgoingRequests.length})</span>
          </h3>
          <div className="space-y-1.5">
            {outgoingRequests.map((req) => {
              const safeToName = sanitizePublicDisplayName(req.toName, req.toPlayerId || req.id);
              return (
                <div
                  key={req.id}
                  data-testid={`outgoing-request-row-${req.toPlayerId || req.id}`}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar
                      avatar={req.toAvatar || '⚽'}
                      name={safeToName}
                      size="sm"
                      variant="circle"
                      className="bg-slate-800 border border-amber-400/40 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="block font-bold text-xs text-white truncate">
                        {safeToName}
                      </span>
                      <span className="block text-[10px] text-amber-300/90 font-semibold">
                        Onay bekleniyor {req.toFriendCode ? `• #${req.toFriendCode}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      data-testid="outgoing-request-pending-label"
                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/45 text-amber-300 font-black text-[11px] inline-flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3" />
                      <span>İstek Gönderildi</span>
                    </span>
                    {onCancelOutgoingRequest && (
                      <button
                        type="button"
                        onClick={() => onCancelOutgoingRequest(req.id)}
                        aria-label={`${safeToName} isteğini iptal et`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search & Inspect Any Player Profile */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="friends-profile-search"
            className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
          >
            <UserSearch className="w-3.5 h-3.5 text-emerald-400" />
            <span>Oyuncu Profili Ara &amp; İncele</span>
          </label>
          <span className="text-[10px] text-slate-400 font-semibold">Tüm istatistikler</span>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-700 focus-within:border-emerald-400">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            id="friends-profile-search"
            type="text"
            data-testid="friends-profile-search-input"
            value={profileQuery}
            onChange={(e) => setProfileQuery(e.target.value)}
            placeholder="İsim veya arkadaş kodu ile incele..."
            maxLength={24}
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-semibold text-white placeholder:text-slate-500 outline-none"
          />
          {profileQuery && (
            <button
              type="button"
              onClick={() => setProfileQuery('')}
              aria-label="Aramayı temizle"
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {profileQuery.trim().length >= 2 && (
          <div
            data-testid="friends-profile-search-results"
            className="space-y-1.5 pt-1"
          >
            {isSearchingProfiles && searchResults.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-slate-300 px-1 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Oyuncular aranıyor...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">Eşleşen oyuncu bulunamadı.</p>
            ) : (
              searchResults
                .filter((p) => !blockedIds.has(p.id) && !isBotFriendRecord(p))
                .map((p) => {
                const safeName = sanitizePublicDisplayName(p.name, p.id);
                const alreadyFriend = addedIds.has(p.id);
                const isSelfRow = p.id === selfPlayerId;
                const isPending = hasPendingOutgoingRequest(progression, p);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/90 border border-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() => onInspectPlayer?.(p)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <PlayerAvatar
                        avatar={p.avatar}
                        name={safeName}
                        size="sm"
                        variant="circle"
                        frame={p.equippedFrame}
                        className="bg-slate-800"
                      />
                      <div className="min-w-0">
                        <span className="block font-bold text-xs text-white truncate">
                          {safeName}
                        </span>
                        <span className="block text-[10px] text-slate-400 truncate">
                          {formatPoints(p.totalPoints)} puan • {p.wins}G/{p.matchesPlayed}M
                        </span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid={`friends-search-inspect-${p.id}`}
                        onClick={() => onInspectPlayer?.(p)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-300 font-black text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <UserSearch className="w-3 h-3" />
                        <span>İncele</span>
                      </button>
                      {!isSelfRow && !alreadyFriend && (
                        <button
                          type="button"
                          data-testid={`friends-search-add-${p.id}`}
                          disabled={isPending}
                          onClick={() => handleAddTarget(p)}
                          className={`px-2.5 py-1.5 rounded-lg font-black text-[11px] inline-flex items-center gap-1 ${
                            isPending
                              ? 'bg-amber-500/15 border border-amber-400/45 text-amber-300 cursor-default'
                              : 'bg-slate-800 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 cursor-pointer'
                          }`}
                        >
                          {isPending ? (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>İstek Gönderildi</span>
                            </>
                          ) : (
                            <span>+ Arkadaş Ekle</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Friends List */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>ARKADAŞLARIN ({realFriends.length})</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-semibold">
            Lig → Arkadaşlar sekmesinde yarışırlar
          </span>
        </div>

        {realFriends.length === 0 ? (
          <div
            data-testid="friends-empty-state"
            className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400 leading-relaxed"
          >
            Henüz arkadaş eklemedin. Arkadaş kodunu paylaşabilir veya yukarıdan arkadaşlık isteği gönderebilirsin!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {realFriends.map((friend) => {
              const safeFriendName = sanitizePublicDisplayName(friend.name, friend.id);
              return (
                <div
                  key={friend.id}
                  data-testid={`friend-row-${friend.id}`}
                  className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow"
                >
                  <button
                    type="button"
                    data-testid={`inspect-friend-${friend.id}`}
                    onClick={() => onInspectPlayer?.(friend)}
                    aria-label={`${safeFriendName} profilini ve istatistiklerini incele`}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
                  >
                    <div className="relative shrink-0">
                      <PlayerAvatar
                        avatar={friend.avatar}
                        name={safeFriendName}
                        size="md"
                        variant="circle"
                        className="bg-slate-800 border border-slate-700 group-hover:border-emerald-400 transition"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          friend.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-white group-hover:text-emerald-300 truncate transition">
                          {safeFriendName}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-300/80 inline-flex items-center gap-0.5 shrink-0">
                          <UserSearch className="w-3 h-3" />
                          <span>İncele</span>
                        </span>
                      </div>
                      <span className="block text-[11px] text-slate-400 truncate">
                        Haftalık: <strong className="text-amber-400">{formatPoints(friend.weeklyPoints)}</strong> • {friend.friendCode}
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onChallengeFriend('two_clubs')}
                      className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-[11px] flex items-center gap-1 transition active:scale-95 cursor-pointer"
                      title="Özel 1v1 Oda Aç"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Meydan Oku</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFriend(friend.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                      aria-label={`${safeFriendName} arkadaşlıktan çıkar`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Online Players (only shown when real other players are synced) */}
      {realOnlinePlayers.length > 0 && (
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 px-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AKTİF OYUNCULAR</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {realOnlinePlayers.map((item) => {
              const isPending = hasPendingOutgoingRequest(progression, item);
              const safeItemName = sanitizePublicDisplayName(item.name, item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-900/70 border border-slate-800"
                >
                  <button
                    type="button"
                    data-testid={`inspect-active-player-${item.id}`}
                    onClick={() => onInspectPlayer?.(item)}
                    aria-label={`${safeItemName} profilini incele`}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                  >
                    <PlayerAvatar
                      avatar={item.avatar}
                      name={safeItemName}
                      size="sm"
                      variant="circle"
                      frame={item.equippedFrame}
                      className="bg-slate-800 group-hover:border-emerald-400"
                    />
                    <div className="min-w-0">
                      <span className="block font-bold text-xs text-white group-hover:text-emerald-300 truncate transition">
                        {safeItemName}
                      </span>
                      <span className="block text-[10px] text-amber-400 font-semibold">
                        {formatPoints(item.weeklyPoints)} puan • İncele
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    data-testid={`active-player-add-${item.id}`}
                    disabled={isPending}
                    onClick={() => handleAddTarget(item)}
                    className={`px-2.5 py-1.5 rounded-xl font-black text-[11px] transition shrink-0 inline-flex items-center gap-1 ${
                      isPending
                        ? 'bg-amber-500/15 border border-amber-400/45 text-amber-300 cursor-default'
                        : 'bg-slate-800 hover:bg-emerald-600 text-emerald-300 hover:text-slate-950 cursor-pointer'
                    }`}
                  >
                    {isPending ? (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>İstek Gönderildi</span>
                      </>
                    ) : (
                      <span>+ Ekle</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
