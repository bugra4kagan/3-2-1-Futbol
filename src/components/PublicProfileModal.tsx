import React, { useEffect, useState } from 'react';
import {
  Award,
  Check,
  Clock,
  Crown,
  Flame,
  Gamepad2,
  Loader2,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import { CLUBS } from '../game/database';
import { MINIGAME_OPTIONS } from '../game/minigameEngine';
import { formatPoints } from '../game/retentionEngine';
import { getCrestBadgeInfo } from '../game/storeCatalog';
import { MinigameType, PublicPlayerProfile } from '../game/types';
import { sanitizePublicDisplayName } from '../game/usernameFilter';
import { ClubBadge } from './ClubBadge';
import { PlayerAvatar } from './PlayerAvatar';

interface PublicProfileModalProps {
  isOpen: boolean;
  profile: PublicPlayerProfile | null;
  isLoading?: boolean;
  isSelf?: boolean;
  isFriend?: boolean;
  isPendingFriend?: boolean;
  currentUserStats?: {
    matchesPlayed: number;
    wins: number;
    winRate: number;
    totalPoints: number;
    fastestAnswerSec: number | null;
  };
  onAddFriend?: (
    targetOrCode: string | PublicPlayerProfile
  ) => { ok: boolean; pendingConfirmation?: boolean; error?: string };
  onChallengePlayer?: (minigameType: MinigameType) => void;
  onClose: () => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  isOpen,
  profile,
  isLoading = false,
  isSelf = false,
  isFriend = false,
  isPendingFriend = false,
  currentUserStats,
  onAddFriend,
  onChallengePlayer,
  onClose,
}) => {
  const [friendToast, setFriendToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setFriendToast(null);
  }, [profile?.id, isOpen]);

  if (!isOpen || !profile) return null;

  const safeProfileName = sanitizePublicDisplayName(profile.name, profile.id);
  const favoriteClub = profile.favoriteClubId ? CLUBS[profile.favoriteClubId] : undefined;
  const crestInfo = getCrestBadgeInfo(profile.equippedCrest);

  const winRate =
    profile.matchesPlayed > 0
      ? Math.round((profile.wins / profile.matchesPlayed) * 100)
      : 0;
  const totalAttempts = profile.totalCorrectAnswers + profile.totalWrongAttempts;
  const accuracyRate =
    totalAttempts > 0
      ? Math.round((profile.totalCorrectAnswers / totalAttempts) * 100)
      : 0;

  const handleAddFriendClick = () => {
    if (!onAddFriend || isFriend || isPendingFriend || isSelf || profile.isBot) return;
    const res = onAddFriend(profile);
    if (!res.ok) {
      setFriendToast({ type: 'err', text: res.error || 'İstek gönderilemedi.' });
      setTimeout(() => setFriendToast(null), 2600);
    } else if (!res.pendingConfirmation) {
      setFriendToast({ type: 'ok', text: 'Arkadaşlık isteği gönderildi!' });
      setTimeout(() => setFriendToast(null), 2600);
    }
  };

  return (
    <div
      data-testid="public-profile-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.name} profil ve istatistik incelemesi`}
      className="fixed inset-0 z-[70] overflow-y-auto p-3 sm:p-4 bg-slate-950/94 flex justify-center items-start sm:items-center animate-screen-fade"
    >
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl text-left my-4 sm:my-auto animate-screen-slide-up">
        {/* Top Bar: Label & Close */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/35 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>Oyuncu Profili &amp; İstatistikler</span>
          </div>

          <div className="flex items-center gap-2">
            {isLoading && (
              <Loader2
                data-testid="public-profile-loading"
                className="w-4 h-4 text-emerald-400 animate-spin"
              />
            )}
            <button
              type="button"
              data-testid="public-profile-close-btn"
              onClick={onClose}
              aria-label="Kapat"
              className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hero Identity Card */}
        <div className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-3.5 shadow-inner">
          <div className="relative shrink-0">
            <PlayerAvatar
              avatar={profile.isBot ? '🤖' : '⚽'}
              name={safeProfileName}
              size="lg"
              variant="circle"
              frame={profile.equippedFrame}
            />
            {profile.isOnline && (
              <span
                title="Çevrim içi"
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#22C55E] border-2 border-[#080E14]"
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2
                data-testid="public-profile-name"
                className="text-lg sm:text-xl font-black text-[#F8FAFC] truncate"
              >
                {safeProfileName}
              </h2>
              {profile.equippedBadge && (
                <span className="text-base leading-none" title="Profil Rozeti">
                  {profile.equippedBadge}
                </span>
              )}
              {profile.hasCrown && (
                <span title="Efsane Tacı" className="shrink-0 inline-flex items-center">
                  <Crown className="w-4 h-4 text-amber-400" />
                </span>
              )}
              {isSelf && (
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  Sen
                </span>
              )}
              {profile.isBot && (
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300">
                  Bot Rakip
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {profile.subtitle && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 text-[10px] font-black">
                  <Award className="w-3 h-3 shrink-0" />
                  <span>{profile.subtitle}</span>
                </span>
              )}

              {crestInfo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-400/35 text-purple-200 text-[10px] font-bold">
                  <span>{crestInfo.icon}</span>
                  <span>{crestInfo.label}</span>
                </span>
              )}

              {profile.friendCode && !profile.isBot && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold">
                  #{profile.friendCode}
                </span>
              )}
            </div>

            {favoriteClub && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-300 font-semibold">
                <ClubBadge club={favoriteClub} size="xs" />
                <span className="truncate">{favoriteClub.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Strip with Current User */}
        {!isSelf && currentUserStats && (
          <div
            data-testid="public-profile-comparison"
            className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-slate-950 via-emerald-950/25 to-slate-950 border border-emerald-500/25"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-2">
              <Swords className="w-3.5 h-3.5" />
              <span>Seninle Karşılaştırma</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="block text-[9px] font-bold uppercase text-slate-400">
                  Toplam Puan
                </span>
                <span className="block text-xs font-black font-mono text-amber-300 mt-0.5">
                  {formatPoints(profile.totalPoints)}
                </span>
                <span className="block text-[9px] text-slate-400 mt-0.5">
                  Sen: <strong className="text-slate-200">{formatPoints(currentUserStats.totalPoints)}</strong>
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="block text-[9px] font-bold uppercase text-slate-400">
                  Kazanma %
                </span>
                <span className="block text-xs font-black font-mono text-emerald-400 mt-0.5">
                  %{winRate}
                </span>
                <span className="block text-[9px] text-slate-400 mt-0.5">
                  Sen: <strong className="text-slate-200">%{currentUserStats.winRate}</strong>
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="block text-[9px] font-bold uppercase text-slate-400">
                  En Hızlı
                </span>
                <span className="block text-xs font-black font-mono text-sky-400 mt-0.5">
                  {profile.fastestAnswerSec !== null
                    ? `${profile.fastestAnswerSec.toFixed(1)}s`
                    : '-'}
                </span>
                <span className="block text-[9px] text-slate-400 mt-0.5">
                  Sen:{' '}
                  <strong className="text-slate-200">
                    {currentUserStats.fastestAnswerSec !== null
                      ? `${currentUserStats.fastestAnswerSec.toFixed(1)}s`
                      : '-'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 2x2 KPI Summary */}
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-950/35 to-slate-900 border border-amber-400/45">
            <span className="block text-[11px] font-semibold text-slate-300">Toplam Puan</span>
            <span
              data-testid="public-profile-total-points"
              className="block mt-1 text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums"
            >
              {formatPoints(profile.totalPoints)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="block text-[11px] font-semibold text-slate-300">Bu Hafta</span>
            <span className="block mt-1 text-xl sm:text-2xl font-black text-white font-mono tabular-nums">
              {formatPoints(profile.weeklyPoints)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-semibold text-slate-400">Turnuva Zaferi</span>
              <span className="block mt-0.5 text-lg font-black text-emerald-400 font-mono tabular-nums">
                {profile.tournamentWins}
                <span className="text-xs font-semibold text-slate-500 ml-1">
                  / {profile.tournamentsPlayed}
                </span>
              </span>
            </div>
            <Trophy className="w-5 h-5 text-amber-400/80 shrink-0" />
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-semibold text-slate-400">Günlük Seri</span>
              <span className="block mt-0.5 text-lg font-black text-orange-400 font-mono tabular-nums">
                {profile.dailyStreakDays} gün
              </span>
            </div>
            <Flame className="w-5 h-5 text-orange-400/80 shrink-0" />
          </div>
        </div>

        {/* 3x2 Match Stats Grid */}
        <div className="mt-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 px-0.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Maç İstatistikleri</span>
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <span className="block text-lg font-black text-amber-400 font-mono tabular-nums">
                {profile.matchesPlayed}
              </span>
              <span className="block text-[10px] font-semibold text-slate-400">Maç</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <span className="block text-lg font-black text-emerald-400 font-mono tabular-nums">
                {profile.wins}
              </span>
              <span className="block text-[10px] font-semibold text-slate-400">Galibiyet</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <span className="block text-lg font-black text-rose-400 font-mono tabular-nums">
                {profile.losses}
              </span>
              <span className="block text-[10px] font-semibold text-slate-400">Mağlubiyet</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <span className="block text-lg font-black text-white font-mono tabular-nums">
                %{winRate}
              </span>
              <span className="block text-[10px] font-semibold text-slate-400">Kazanma %</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <span className="block text-lg font-black text-amber-300 font-mono tabular-nums">
                {profile.winStreak}
              </span>
              <span className="block text-[10px] font-semibold text-slate-400">Seri</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <span className="block text-lg font-black text-amber-300 font-mono tabular-nums">
                {profile.bestWinStreak}
              </span>
              <span className="block text-[10px] font-semibold text-slate-400">En İyi Seri</span>
            </div>
          </div>
        </div>

        {/* Futbol Performansı */}
        <div className="mt-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 px-0.5 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Futbol Performansı</span>
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-2.5">
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <span className="block text-lg font-black text-amber-400 font-mono tabular-nums">
                {profile.totalCorrectAnswers}
              </span>
              <span className="block text-[10px] font-semibold text-slate-400">Doğru Cevap</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <span className="block text-lg font-black text-sky-400 font-mono tabular-nums">
                {profile.fastestAnswerSec !== null
                  ? `${profile.fastestAnswerSec.toFixed(1)}s`
                  : '-'}
              </span>
              <span className="block text-[10px] font-semibold text-slate-400">En Hızlı</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <span className="block text-lg font-black text-purple-300 font-mono tabular-nums">
                {profile.clutchAnswers}
              </span>
              <span className="block text-[10px] font-semibold text-slate-400">Son Saniye</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-300 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tahmin İsabeti</span>
                </span>
                <span className="text-white font-mono tabular-nums">%{accuracyRate}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, accuracyRate)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="text-slate-300 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kazanma Oranı</span>
                </span>
                <span className="text-white font-mono tabular-nums">%{winRate}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, winRate)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mini Oyun Dağılımı */}
        <div className="mt-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 px-0.5 flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Mini Oyun Dağılımı</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {MINIGAME_OPTIONS.map((mg) => (
              <div
                key={mg.id}
                className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-900/85 border border-slate-800 text-xs"
              >
                <span className="font-bold text-slate-300 truncate">{mg.shortTitle}</span>
                <span className="font-mono font-black text-emerald-400 ml-2 shrink-0">
                  {profile.minigameMatchCounts?.[mg.id] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Friend & 1v1 Action Bar */}
        {!isSelf && !profile.isBot && (onAddFriend || onChallengePlayer) && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
            {friendToast && (
              <p
                className={`text-xs font-bold text-center ${
                  friendToast.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {friendToast.text}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {onAddFriend && (
                <button
                  type="button"
                  data-testid="public-profile-add-friend-btn"
                  disabled={isFriend || isPendingFriend}
                  onClick={handleAddFriendClick}
                  className={`flex-1 min-h-[42px] px-3.5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition ${
                    isFriend
                      ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 cursor-default'
                      : isPendingFriend
                      ? 'bg-amber-500/15 border border-amber-400/45 text-amber-300 cursor-default'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 cursor-pointer'
                  }`}
                >
                  {isFriend ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Arkadaş ✓</span>
                    </>
                  ) : isPendingFriend ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>İstek Gönderildi</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>+ Arkadaş Ekle</span>
                    </>
                  )}
                </button>
              )}

              {onChallengePlayer && (
                <button
                  type="button"
                  data-testid="public-profile-challenge-btn"
                  onClick={() => {
                    onClose();
                    onChallengePlayer('two_clubs');
                  }}
                  className="flex-1 min-h-[42px] px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Swords className="w-4 h-4" />
                  <span>1v1 Meydan Oku</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
