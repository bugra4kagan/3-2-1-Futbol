import React, { useState } from 'react';
import {
  UserPlus,
  Users,
  Copy,
  Check,
  Swords,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { LeaguePlayerEntry, MinigameType, UserProgression } from '../game/types';
import { formatPoints } from '../game/retentionEngine';
import { PlayerAvatar } from './PlayerAvatar';

interface FriendsViewProps {
  progression: UserProgression;
  selfPlayerId?: string;
  liveServerPlayers?: LeaguePlayerEntry[];
  onAddFriend: (codeOrName: string) => { ok: boolean; error?: string };
  onRemoveFriend: (friendId: string) => void;
  onChallengeFriend: (minigameType: MinigameType) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  progression,
  selfPlayerId,
  liveServerPlayers = [],
  onAddFriend,
  onRemoveFriend,
  onChallengeFriend,
}) => {
  const [friendInput, setFriendInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedMyCode, setCopiedMyCode] = useState(false);

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
      setFeedback({ type: 'ok', text: 'Arkadaş listene eklendi!' });
      setFriendInput('');
    } else {
      setFeedback({ type: 'err', text: res.error || 'Eklenemedi.' });
    }
    setTimeout(() => setFeedback(null), 2600);
  };

  const addedIds = new Set(progression.friends.map((f) => f.id));
  const realOnlinePlayers = liveServerPlayers
    .filter((p) => p.id !== selfPlayerId && !addedIds.has(p.id))
    .slice(0, 6);

  return (
    <div
      data-testid="friends-view"
      className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col gap-4 text-left"
    >
      {/* My Friend Code Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/40 flex items-center justify-between gap-3 shadow-xl">
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
            SENİN ARKADAŞ KODUN
          </span>
          <span className="block font-mono font-black text-2xl text-white tracking-wider mt-0.5">
            {progression.friendCode}
          </span>
          <span className="block text-[11px] text-slate-400">
            Kodunu paylaş veya aşağıdaki alandan rakip ekle
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
            <span>Ekle</span>
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

      {/* Friends List */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>ARKADAŞLARIN ({progression.friends.length})</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-semibold">
            Lig → Arkadaşlar sekmesinde yarışırlar
          </span>
        </div>

        {progression.friends.length === 0 ? (
          <div
            data-testid="friends-empty-state"
            className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400 leading-relaxed"
          >
            Henüz arkadaş eklemedin. Arkadaş kodunu paylaşabilir veya arkadaşının kodunu yukarıya yazarak ekleyebilirsin!
          </div>
        ) : (
          <div className="space-y-2">
            {progression.friends.map((friend) => (
              <div
                key={friend.id}
                data-testid={`friend-row-${friend.id}`}
                className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <PlayerAvatar
                      avatar={friend.avatar}
                      name={friend.name}
                      size="md"
                      variant="circle"
                      className="bg-slate-800 border border-slate-700"
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                        friend.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-bold text-sm text-white truncate">
                      {friend.name}
                    </span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      Haftalık: <strong className="text-amber-400">{formatPoints(friend.weeklyPoints)}</strong> • {friend.friendCode}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onChallengeFriend('two_clubs')}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-[11px] flex items-center gap-1 transition active:scale-95 cursor-pointer"
                    title="Özel 1v1 Oda Aç"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Meydan Oku</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveFriend(friend.id)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                    aria-label={`${friend.name} arkadaşlıktan çıkar`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
            {realOnlinePlayers.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-900/70 border border-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerAvatar
                    avatar={item.avatar}
                    name={item.name}
                    size="sm"
                    variant="circle"
                    className="bg-slate-800"
                  />
                  <div className="min-w-0">
                    <span className="block font-bold text-xs text-white truncate">
                      {item.name}
                    </span>
                    <span className="block text-[10px] text-amber-400 font-semibold">
                      {formatPoints(item.weeklyPoints)} puan
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAddFriend(item.friendCode || item.name)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-emerald-300 hover:text-slate-950 font-black text-[11px] transition shrink-0 cursor-pointer"
                >
                  + Ekle
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
