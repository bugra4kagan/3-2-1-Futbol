import React, { useEffect, useState } from 'react';
import {
  Check,
  Coins,
  Copy,
  Crown,
  Play,
  RefreshCw,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  MinigameType,
  PlayerProfile,
  TournamentBracketState,
  TournamentMatchSlot,
  TournamentMode,
  TournamentParticipant,
  UserProgression,
} from '../game/types';
import { MINIGAME_OPTIONS, getMinigameMeta } from '../game/minigameEngine';
import {
  FRIEND_TOURNAMENT_STAKES,
  TOURNAMENT_OPEN_ENTRY_COINS,
  TOURNAMENT_OPEN_PRIZE_COINS,
  TOURNAMENT_OPEN_PRIZE_POINTS,
  getTournamentMatchForUser,
} from '../game/tournamentEngine';
import { formatPoints } from '../game/retentionEngine';
import { PlayerAvatar } from './PlayerAvatar';
import { sounds } from '../utils/audio';

export interface FriendTournamentLobbyState {
  code: string;
  title: string;
  hostId: string;
  minigameType: MinigameType;
  entryFeeCoins: number;
  prizeCoins: number;
  participants: { id: string; name: string; avatar: string }[];
  status: 'waiting' | 'started';
}

interface TournamentModalProps {
  isOpen: boolean;
  playerProfile: PlayerProfile;
  progression: UserProgression;
  activeBracket: TournamentBracketState | null;
  initialFriendCode?: string | null;
  onClose: () => void;
  onStartOpenTournament: (minigameType: MinigameType) => { ok: boolean; reason?: string };
  onStartFriendTournament: (params: {
    code: string;
    title: string;
    minigameType: MinigameType;
    entryFeeCoins: number;
    prizeCoins: number;
    realParticipants: TournamentParticipant[];
    alreadyPaid?: boolean;
  }) => { ok: boolean; reason?: string };
  onPayFriendTournamentEntry: (entryFeeCoins: number) => { ok: boolean; reason?: string };
  onPlayNextMatch: () => void;
  onResetBracket: () => void;
}

export const TournamentModal: React.FC<TournamentModalProps> = ({
  isOpen,
  playerProfile,
  progression,
  activeBracket,
  initialFriendCode = null,
  onClose,
  onStartOpenTournament,
  onStartFriendTournament,
  onPayFriendTournamentEntry,
  onPlayNextMatch,
  onResetBracket,
}) => {
  const [hubTab, setHubTab] = useState<'open_cup' | 'friends_cup'>(
    initialFriendCode ? 'friends_cup' : 'open_cup'
  );
  const [selectedMinigame, setSelectedMinigame] = useState<MinigameType>('two_clubs');
  const [friendSubMode, setFriendSubMode] = useState<'create' | 'join'>(
    initialFriendCode ? 'join' : 'create'
  );
  const [friendStakeIndex, setFriendStakeIndex] = useState<number>(2); // Default 2000 -> 6000
  const [joinCodeInput, setJoinCodeInput] = useState<string>(initialFriendCode || '');
  const [friendLobby, setFriendLobby] = useState<FriendTournamentLobbyState | null>(null);
  const [paidFriendCodes, setPaidFriendCodes] = useState<Set<string>>(() => new Set());
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialFriendCode) {
      setHubTab('friends_cup');
      setFriendSubMode('join');
      setJoinCodeInput(initialFriendCode.toUpperCase());
    }
  }, [initialFriendCode]);

  // Poll server friend tournament lobby while waiting
  useEffect(() => {
    if (!isOpen || !friendLobby || friendLobby.status === 'started') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tournaments/${friendLobby.code}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.tournament) {
            setFriendLobby(data.tournament);
          }
        }
      } catch {
        // ignore transient network errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen, friendLobby]);

  if (!isOpen) return null;

  const showError = (msg: string) => {
    sounds.playWrong();
    setErrorMsg(msg);
  };

  const handleEnterOpenCup = () => {
    setErrorMsg(null);
    const res = onStartOpenTournament(selectedMinigame);
    if (!res.ok) {
      showError(res.reason || 'Turnuva başlatılamadı.');
    } else {
      sounds.playVictory();
    }
  };

  const handleCreateFriendLobby = async () => {
    setErrorMsg(null);
    const stake = FRIEND_TOURNAMENT_STAKES[friendStakeIndex] || FRIEND_TOURNAMENT_STAKES[2];
    if (progression.coins < stake.entryCoins) {
      showError(
        `Turnuva kurmak için ${formatPoints(stake.entryCoins - progression.coins)} Coin daha gerekiyor!`
      );
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: playerProfile.id,
          hostName: playerProfile.name,
          hostAvatar: playerProfile.avatar,
          minigameType: selectedMinigame,
          entryFeeCoins: stake.entryCoins,
          title: `${playerProfile.name} Turnuvası`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.tournament) {
        showError(data?.error || 'Turnuva odası oluşturulamadı.');
        return;
      }
      const payRes = onPayFriendTournamentEntry(stake.entryCoins);
      if (!payRes.ok) {
        showError(payRes.reason || 'Coin bakiyesi yetersiz.');
        return;
      }
      setPaidFriendCodes((prev) => new Set(prev).add(data.tournament.code));
      setFriendLobby(data.tournament);
      sounds.playCorrect();
    } catch {
      showError('Sunucuya bağlanılamadı. Tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinFriendLobby = async () => {
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (cleanCode.length < 3) {
      showError('Lütfen geçerli bir turnuva kodu gir.');
      return;
    }
    setErrorMsg(null);
    setBusy(true);
    try {
      const infoRes = await fetch(`/api/tournaments/${cleanCode}`);
      const infoData = await infoRes.json();
      if (!infoRes.ok || !infoData?.tournament) {
        showError(infoData?.error || 'Turnuva kodu bulunamadı.');
        return;
      }

      const fee = Number(infoData.tournament.entryFeeCoins) || 2000;
      const alreadyMember = (infoData.tournament.participants || []).some(
        (p: { id: string }) => p.id === playerProfile.id
      );

      if (!alreadyMember && !paidFriendCodes.has(cleanCode)) {
        if (progression.coins < fee) {
          showError(
            `Bu turnuvaya giriş için ${formatPoints(fee - progression.coins)} Coin daha gerekiyor!`
          );
          return;
        }
      }

      const joinRes = await fetch(`/api/tournaments/${cleanCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: playerProfile.id,
          name: playerProfile.name,
          avatar: playerProfile.avatar,
        }),
      });
      const joinData = await joinRes.json();
      if (!joinRes.ok || !joinData?.tournament) {
        showError(joinData?.error || 'Turnuvaya katılınamadı.');
        return;
      }

      if (!alreadyMember && !paidFriendCodes.has(cleanCode)) {
        const payRes = onPayFriendTournamentEntry(fee);
        if (payRes.ok) {
          setPaidFriendCodes((prev) => new Set(prev).add(cleanCode));
        }
      }

      setFriendLobby(joinData.tournament);
      sounds.playCorrect();
    } catch {
      showError('Sunucu bağlantısı sağlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const handleLaunchFriendBracket = async () => {
    if (!friendLobby) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      await fetch(`/api/tournaments/${friendLobby.code}/start`, { method: 'POST' });
    } catch {
      // Proceed locally even if status update fails
    } finally {
      setBusy(false);
    }

    const mappedParticipants: TournamentParticipant[] = friendLobby.participants.map(
      (p, idx) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isUser: p.id === playerProfile.id,
        isBot: false,
        seed: idx + 1,
      })
    );

    const res = onStartFriendTournament({
      code: friendLobby.code,
      title: friendLobby.title,
      minigameType: friendLobby.minigameType,
      entryFeeCoins: friendLobby.entryFeeCoins,
      prizeCoins: friendLobby.prizeCoins,
      realParticipants: mappedParticipants,
      alreadyPaid: paidFriendCodes.has(friendLobby.code),
    });
    if (!res.ok) {
      showError(res.reason || 'Turnuva eşleşmesi başlatılamadı.');
    } else {
      setFriendLobby(null);
      sounds.playVictory();
    }
  };

  const handleCopyInviteLink = async (code: string) => {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?tournament=${code}`
        : code;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  const renderSlotCard = (slot: TournamentMatchSlot) => {
    const isUserInSlot =
      slot.p1?.id === playerProfile.id || slot.p2?.id === playerProfile.id;
    const renderRow = (p: TournamentParticipant | null) => {
      const isWinner = Boolean(p && slot.winnerId === p.id);
      const isElim = Boolean(p && slot.status === 'completed' && slot.winnerId && slot.winnerId !== p.id);
      return (
        <div
          className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-[11px] ${
            isWinner
              ? 'bg-emerald-500/20 text-emerald-200 font-black'
              : isElim
              ? 'text-slate-500 line-through opacity-75'
              : p?.isUser
              ? 'bg-amber-400/15 text-amber-200 font-black'
              : 'text-slate-200 font-bold'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {p ? (
              <PlayerAvatar avatar={p.avatar} name={p.name} size="xs" />
            ) : (
              <span className="w-5 h-5 rounded-md bg-slate-800 inline-block shrink-0" />
            )}
            <span className="truncate">{p ? p.name : 'Bekleniyor...'}</span>
          </div>
          {isWinner && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        </div>
      );
    };

    return (
      <div
        key={slot.id}
        className={`p-2 rounded-xl border space-y-1 ${
          isUserInSlot && slot.status !== 'completed'
            ? 'bg-slate-900 border-amber-400/70 shadow-md shadow-amber-500/10'
            : 'bg-slate-950/90 border-slate-800'
        }`}
      >
        {renderRow(slot.p1)}
        <div className="h-px bg-slate-800/80" />
        {renderRow(slot.p2)}
      </div>
    );
  };

  const matchInfo = activeBracket
    ? getTournamentMatchForUser(activeBracket, playerProfile.id)
    : null;
  const championParticipant = activeBracket?.championId
    ? activeBracket.participants.find((p) => p.id === activeBracket.championId)
    : null;

  return (
    <div
      data-testid="tournament-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto animate-screen-fade"
    >
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-amber-400/45 rounded-3xl p-4 sm:p-6 shadow-2xl text-left my-auto max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
              <Trophy className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-white leading-tight truncate">
                {activeBracket ? activeBracket.title : '8 Kişilik Eleme Turnuvası'}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {activeBracket
                  ? `${getMinigameMeta(activeBracket.minigameType).shortTitle} • 3 Maç Eleme Usulü`
                  : 'Çeyrek Final → Yarı Final → Büyük Final (3 Maç)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="tournament-close-btn"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Turnuvayı Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Strip */}
        <div className="flex items-center justify-between gap-2 py-2.5 px-3 mt-3 rounded-2xl bg-slate-950/90 border border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 font-mono">
            <Coins className="w-4 h-4 shrink-0" />
            <span data-testid="tournament-coins-balance">
              {formatPoints(progression.coins)} Coin
            </span>
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            Şampiyonluklar: <span className="text-emerald-400 font-black">{progression.tournamentWins ?? 0} 🏆</span>
          </div>
        </div>

        {errorMsg && (
          <div
            data-testid="tournament-error"
            className="mt-2.5 px-3 py-2 rounded-xl bg-rose-950/85 border border-rose-500/60 text-rose-200 text-xs font-bold shrink-0"
          >
            {errorMsg}
          </div>
        )}

        {/* Active Bracket View */}
        {activeBracket ? (
          <div className="flex-1 overflow-y-auto pt-3 space-y-3 pr-0.5">
            {/* Stakes & Status Card */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-emerald-500/15 border border-amber-400/40 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                  Turnuva Büyük Ödülü
                </span>
                <span className="text-base sm:text-lg font-black text-white font-mono">
                  🪙 {formatPoints(activeBracket.prizeCoins)} Coin
                  {activeBracket.mode === 'open_cup' && (
                    <span className="text-xs text-emerald-300 font-sans ml-1.5">
                      (+{TOURNAMENT_OPEN_PRIZE_POINTS} Lig Puanı)
                    </span>
                  )}
                </span>
              </div>
              {activeBracket.code && (
                <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-purple-400/40 font-mono text-xs font-black text-purple-300">
                  Kod: {activeBracket.code}
                </span>
              )}
            </div>

            {/* Champion / Eliminated / Next Match Action Card */}
            {activeBracket.status === 'won' ? (
              <div
                data-testid="tournament-champion-banner"
                className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-400/70 text-center space-y-2"
              >
                <div className="text-3xl">🏆</div>
                <h3 className="text-lg font-black text-amber-300">
                  TURNUVA ŞAMPİYONU!
                </h3>
                <p className="text-xs text-slate-200 font-medium">
                  3’te 3 yaparak tüm rakiplerini eledin!{' '}
                  <strong className="text-amber-300">
                    +{formatPoints(activeBracket.prizeCoins)} Coin
                  </strong>{' '}
                  bakiyene eklendi.
                </p>
                <button
                  type="button"
                  data-testid="tournament-new-btn"
                  onClick={onResetBracket}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Yeni Turnuva Aç
                </button>
              </div>
            ) : activeBracket.status === 'eliminated' ? (
              <div
                data-testid="tournament-eliminated-banner"
                className="p-4 rounded-2xl bg-slate-950/90 border border-rose-500/40 text-center space-y-2"
              >
                <h3 className="text-base font-black text-rose-300">
                  Turnuvaya Veda • {activeBracket.userPlacementLabel}
                </h3>
                {championParticipant && (
                  <p className="text-xs text-slate-300">
                    Turnuva Şampiyonu:{' '}
                    <strong className="text-amber-300">{championParticipant.name}</strong>
                  </p>
                )}
                <button
                  type="button"
                  data-testid="tournament-new-btn"
                  onClick={onResetBracket}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Yeni Turnuvaya Katıl
                </button>
              </div>
            ) : (
              matchInfo &&
              matchInfo.opponent && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/35 border border-emerald-400/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                      <Swords className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 block">
                        Sıradaki Maç • {matchInfo.stageLabel}
                      </span>
                      <div className="flex items-center gap-1.5 text-sm font-black text-white truncate">
                        <span>Rakip:</span>
                        <PlayerAvatar
                          avatar={matchInfo.opponent.avatar}
                          name={matchInfo.opponent.name}
                          size="xs"
                        />
                        <span className="truncate">{matchInfo.opponent.name}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="tournament-play-match-btn"
                    onClick={onPlayNextMatch}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Maça Başla!</span>
                  </button>
                </div>
              )
            )}

            {/* 8-Player Knockout Bracket Columns (Responsive 1-col mobile / 3-col desktop) */}
            <div
              data-testid="tournament-bracket-grid"
              className="grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              {/* Round 1: Çeyrek Final */}
              <div className="space-y-2">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  1. Tur • Çeyrek Final (4 Maç)
                </span>
                {activeBracket.qf.map(renderSlotCard)}
              </div>

              {/* Round 2: Yarı Final */}
              <div className="space-y-2">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  2. Tur • Yarı Final (2 Maç)
                </span>
                <div className="space-y-2 md:mt-6">
                  {activeBracket.sf.map(renderSlotCard)}
                </div>
              </div>

              {/* Round 3: Büyük Final */}
              <div className="space-y-2">
                <span className="block text-[10px] font-black uppercase tracking-wider text-amber-400">
                  3. Tur • Büyük Final 🏆
                </span>
                <div className="md:mt-16">{renderSlotCard(activeBracket.finalMatch)}</div>
              </div>
            </div>
          </div>
        ) : (
          /* Hub View: Open Cup OR Friends Tournament */
          <div className="flex-1 overflow-y-auto pt-3 space-y-3 pr-0.5">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                data-testid="tournament-tab-open"
                onClick={() => {
                  setHubTab('open_cup');
                  setErrorMsg(null);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  hubTab === 'open_cup'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                <span>Büyük Ödüllü</span>
              </button>
              <button
                type="button"
                data-testid="tournament-tab-friends"
                onClick={() => {
                  setHubTab('friends_cup');
                  setErrorMsg(null);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  hubTab === 'friends_cup'
                    ? 'bg-purple-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Arkadaşlar Arası</span>
              </button>
            </div>

            {hubTab === 'open_cup' ? (
              <div className="space-y-3">
                {/* 2000 -> 6000 Hero Offer */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-slate-950 to-emerald-500/15 border border-amber-400/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                      8 KİŞİLİK ELEME USULÜ
                    </span>
                    <span className="text-xs font-black text-emerald-300">
                      3 Maç • Kazanan Üst Tura!
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">
                        Katılım Ücreti
                      </span>
                      <span className="text-lg font-black text-white font-mono">
                        🪙 {formatPoints(TOURNAMENT_OPEN_ENTRY_COINS)} Coin
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-amber-300 font-bold uppercase">
                        Şampiyonluk Ödülü
                      </span>
                      <span className="text-xl font-black text-amber-400 font-mono">
                        🏆 {formatPoints(TOURNAMENT_OPEN_PRIZE_COINS)} Coin
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Çeyrek Final, Yarı Final ve Büyük Final’den oluşan 3 maçı üst üste kazanarak{' '}
                    <strong className="text-amber-300">6.000 Coin</strong> ve{' '}
                    <strong className="text-emerald-300">+400 Lig Puanı</strong> ödülünün sahibi ol!
                  </p>
                </div>

                {/* Minigame Choice */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Turnuva Mini Oyununu Seç
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {MINIGAME_OPTIONS.map((mg) => {
                      const active = selectedMinigame === mg.id;
                      return (
                        <button
                          key={mg.id}
                          type="button"
                          onClick={() => setSelectedMinigame(mg.id)}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                            active
                              ? 'bg-amber-400/15 border-amber-400 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-xs font-black truncate">{mg.title}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{mg.badgeText}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="tournament-enter-open-btn"
                  onClick={handleEnterOpenCup}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
                >
                  <Trophy className="w-4 h-4 shrink-0" />
                  <span>2.000 Coin ile Turnuvaya Katıl (Ödül: 6.000 🪙)</span>
                </button>
              </div>
            ) : friendLobby ? (
              /* Waiting Lobby for Created/Joined Friend Tournament */
              <div
                data-testid="friend-tournament-lobby"
                className="space-y-3 p-3.5 rounded-2xl bg-slate-950/90 border border-purple-500/45"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 block">
                      Arkadaşlar Arası Lobi • {getMinigameMeta(friendLobby.minigameType).shortTitle}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        data-testid="friend-tournament-code"
                        className="text-xl font-black font-mono text-white tracking-widest"
                      >
                        {friendLobby.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyInviteLink(friendLobby.code)}
                        className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-purple-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-300" />
                            <span>Kopyalandı</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Davet Linki</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block">Ödül Havuzu</span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      🏆 {formatPoints(friendLobby.prizeCoins)} Coin
                    </span>
                  </div>
                </div>

                {/* 8 Slots Grid */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                    <span>Katılan Oyuncular ({friendLobby.participants.length}/8)</span>
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Canlı
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Array.from({ length: 8 }).map((_, idx) => {
                      const p = friendLobby.participants[idx];
                      return (
                        <div
                          key={idx}
                          className={`px-2.5 py-2 rounded-xl border text-xs flex items-center gap-1.5 ${
                            p
                              ? 'bg-slate-900 border-purple-400/40 text-white font-bold'
                              : 'bg-slate-950/60 border-slate-800/80 text-slate-500 border-dashed'
                          }`}
                        >
                          {p ? (
                            <>
                              <PlayerAvatar avatar={p.avatar} name={p.name} size="xs" />
                              <span className="truncate">{p.name}</span>
                            </>
                          ) : (
                            <span className="text-[10px]">Boş Koltuk #{idx + 1}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    data-testid="friend-tournament-start-btn"
                    onClick={handleLaunchFriendBracket}
                    disabled={busy}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs cursor-pointer shadow-lg"
                  >
                    {friendLobby.participants.length >= 8
                      ? '8/8 Hazır — Turnuvayı Başlat!'
                      : 'Eksik Yerleri Botla Doldur & Başlat!'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFriendLobby(null)}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Geri
                  </button>
                </div>
              </div>
            ) : (
              /* Create OR Join Friend Tournament Form */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                  <button
                    type="button"
                    data-testid="friend-mode-create-tab"
                    onClick={() => setFriendSubMode('create')}
                    className={`py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                      friendSubMode === 'create'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Turnuva Kur
                  </button>
                  <button
                    type="button"
                    data-testid="friend-mode-join-tab"
                    onClick={() => setFriendSubMode('join')}
                    className={`py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                      friendSubMode === 'join'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Koda Katıl
                  </button>
                </div>

                {friendSubMode === 'create' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        Coin Giriş &amp; Şampiyonluk Ödülü
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {FRIEND_TOURNAMENT_STAKES.map((s, idx) => (
                          <button
                            key={s.entryCoins}
                            type="button"
                            onClick={() => setFriendStakeIndex(idx)}
                            className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                              friendStakeIndex === idx
                                ? 'bg-purple-600/25 border-purple-400 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span className="block text-[11px] font-black text-amber-300">
                              🪙 {formatPoints(s.entryCoins)}
                            </span>
                            <span className="block text-[10px] text-emerald-300 font-bold mt-0.5">
                              Ödül: {formatPoints(s.prizeCoins)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        Oyun Türünü Seç
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {MINIGAME_OPTIONS.map((mg) => (
                          <button
                            key={mg.id}
                            type="button"
                            onClick={() => setSelectedMinigame(mg.id)}
                            className={`p-2 rounded-xl border text-left text-xs font-bold cursor-pointer flex items-center justify-between ${
                              selectedMinigame === mg.id
                                ? 'bg-purple-600/25 border-purple-400 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span className="truncate">{mg.shortTitle}</span>
                            <span className="text-[10px] text-slate-400">{mg.badgeText}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="tournament-create-friend-btn"
                      disabled={busy}
                      onClick={handleCreateFriendLobby}
                      className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-purple-600/25"
                    >
                      {busy
                        ? 'Turnuva Oluşturuluyor...'
                        : `Coin ile Arkadaş Turnuvası Kur (${formatPoints(
                            (FRIEND_TOURNAMENT_STAKES[friendStakeIndex] || FRIEND_TOURNAMENT_STAKES[2])
                              .entryCoins
                          )} 🪙)`}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                    <label className="block text-xs font-bold text-slate-300">
                      Arkadaşının Turnuva Kodunu Gir
                    </label>
                    <input
                      type="text"
                      data-testid="friend-tournament-join-input"
                      value={joinCodeInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const match = raw.match(/[?&]tournament=([A-Za-z0-9]+)/i);
                        const clean = match
                          ? match[1]
                          : raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
                        setJoinCodeInput(clean.toUpperCase());
                      }}
                      placeholder="ÖRN: T4K9M"
                      className="w-full bg-slate-900 text-white font-mono font-black text-center text-lg tracking-widest px-3 py-3 rounded-xl border border-purple-500/50 outline-none uppercase"
                    />
                    <button
                      type="button"
                      data-testid="friend-tournament-join-btn"
                      disabled={busy || joinCodeInput.length < 3}
                      onClick={handleJoinFriendLobby}
                      className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs cursor-pointer"
                    >
                      {busy ? 'Katılınıyor...' : 'Turnuvaya Katıl'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
