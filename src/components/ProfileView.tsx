import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import {
  Coins,
  Flame,
  Gift,
  CheckCircle2,
  Target,
  ShoppingBag,
  Edit3,
  Crown,
  Zap,
  Sparkles,
  CloudCheck,
  Mail,
  ShieldCheck,
  X,
  BarChart3,
  Clock,
  Trophy,
  Lock,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  PlayerProfile,
  ShopGiftItem,
  StoreCategory,
  UserProgression,
} from '../game/types';
import { CLUBS } from '../game/database';
import {
  canClaimDailyReward,
  DAILY_REWARD_SCHEDULE,
  formatPoints,
  getActiveDailyRewardTier,
  SHOP_GIFTS,
} from '../game/retentionEngine';
import {
  getCrestBadgeInfo,
  getPitchThemeStyle,
  STORE_ITEMS,
} from '../game/storeCatalog';
import {
  FREE_AVATARS,
  STAR_PP_AVATARS,
  isPhotoAvatar,
} from '../game/avatarCatalog';
import {
  CAREER_RANK_TIERS,
  CareerStatsData,
  getCareerRankProgress,
  getWinRatePct,
  mergeCareerStatsWithProgression,
} from '../game/careerStatsEngine';
import {
  CAREER_ACHIEVEMENTS,
  CareerAchievementsState,
  getAchievementProgress,
} from '../game/achievementsEngine';
import { ClubBadge } from './ClubBadge';
import { PlayerAvatar } from './PlayerAvatar';
import { sounds } from '../utils/audio';

export interface ProfileCloudUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  isAnonymous?: boolean;
  isGoogleLinked?: boolean;
}

interface ProfileViewProps {
  playerProfile: PlayerProfile;
  progression: UserProgression;
  careerStats?: CareerStatsData;
  achievementsState?: CareerAchievementsState;
  cloudUser?: ProfileCloudUserSummary | null;
  onGoogleSignIn?: () => Promise<{
    ok: boolean;
    error?: string;
    bonusCoinsAwarded?: number;
    email?: string;
  }>;
  onOpenAuth: (initialTab?: 'profile' | 'email') => void;
  onOpenSettings?: () => void;
  onSelectAvatar?: (avatar: string) => void;
  onClaimDailyReward: () => void;
  onClaimDailyQuest: (questId: string) => void;
  onClaimAchievementReward?: (achievementId: string) => void;
  onPurchaseGift: (giftId: string) => { ok: boolean; reason?: string };
  onPurchaseStoreItem?: (
    itemId: string,
    method: 'coins' | 'money'
  ) => { ok: boolean; reason?: string; gift?: ShopGiftItem };
  onOpenStore?: (category?: StoreCategory) => void;
  onEquipItem?: (itemId: string) => { ok: boolean; reason?: string };
  onSelectDefaultPitchTheme?: () => void;
  onDeleteAccount?: () => Promise<{ ok: boolean; warning?: string }>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  playerProfile,
  progression,
  careerStats,
  achievementsState,
  cloudUser = null,
  onGoogleSignIn,
  onOpenAuth,
  onOpenSettings,
  onSelectAvatar,
  onClaimDailyReward,
  onClaimDailyQuest,
  onClaimAchievementReward,
  onPurchaseGift,
  onPurchaseStoreItem,
  onOpenStore,
  onEquipItem,
  onSelectDefaultPitchTheme,
  onDeleteAccount,
}) => {
  const [shopFeedback, setShopFeedback] = useState<string | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isGoogleLinking, setIsGoogleLinking] = useState(false);
  const [accountLinkFeedback, setAccountLinkFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [gearFeedback, setGearFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [confirmGearItem, setConfirmGearItem] = useState<ShopGiftItem | null>(null);
  const [pendingPurchaseGift, setPendingPurchaseGift] = useState<ShopGiftItem | null>(null);
  const [insufficientFundsGift, setInsufficientFundsGift] = useState<ShopGiftItem | null>(null);

  const userClub = playerProfile.favoriteClubId ? CLUBS[playerProfile.favoriteClubId] : null;
  const dailyClaimable = canClaimDailyReward(progression);
  const activeTier = getActiveDailyRewardTier(progression);
  const crestInfo = getCrestBadgeInfo(progression.equippedCrest);
  const pitchInfo = getPitchThemeStyle(progression.equippedPitchTheme);
  const effectiveCareerStats = mergeCareerStatsWithProgression(progression, careerStats);
  const careerWinRatePct = getWinRatePct(effectiveCareerStats);
  const careerRankProgress = getCareerRankProgress(effectiveCareerStats.totalWins);

  const unlockedAvatarValues = Array.from(
    new Set([
      ...SHOP_GIFTS.filter(
        (g) => g.type === 'avatar' && progression.unlockedGiftIds.includes(g.id)
      ).map((g) => g.value),
      ...FREE_AVATARS,
    ])
  );

  const handleQuestClaim = (questId: string) => {
    sounds.playVictory();
    try {
      confetti({
        particleCount: 55,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#fbbf24'],
      });
    } catch {
      // ignore
    }
    onClaimDailyQuest(questId);
  };

  const handleGiftAction = (giftId: string) => {
    const res = onPurchaseGift(giftId);
    if (!res.ok && res.reason) {
      sounds.playWrong();
      setShopFeedback(res.reason);
      setTimeout(() => setShopFeedback(null), 2600);
    } else {
      sounds.playCorrect();
      setShopFeedback('Hediye etkinleştirildi!');
      setTimeout(() => setShopFeedback(null), 2200);
    }
  };

  const quickCosmeticItems: ShopGiftItem[] = STORE_ITEMS.filter(
    (g) => g.type === 'title' || g.type === 'avatar'
  );

  return (
    <div
      data-testid="profile-view"
      className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col gap-4 text-left"
    >
      {/* Profile Identity Header Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-emerald-500/40 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar
              avatar={playerProfile.avatar}
              name={playerProfile.name}
              size="xl"
              frame={progression.equippedFrame}
              className="bg-gradient-to-br from-emerald-500/25 to-amber-500/25 border-2 border-emerald-400/60"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {crestInfo && (
                  <span title={crestInfo.label} className="text-base shrink-0">
                    {crestInfo.icon}
                  </span>
                )}
                <h2 className="font-black text-lg text-white truncate">
                  {playerProfile.name}
                </h2>
                {progression.equippedBadge && (
                  <span className="text-base shrink-0" title="Profil Rozeti">
                    {progression.equippedBadge}
                  </span>
                )}
                {progression.unlockedGiftIds.includes('gift_title_legend') && (
                  <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <span
                  data-testid="profile-friend-code"
                  className="text-xs text-slate-400"
                >
                  Kod: <strong className="font-mono text-slate-200">{progression.friendCode}</strong>
                </span>
                {progression.equippedTitle && (
                  <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300">
                    {progression.equippedTitle}
                  </span>
                )}
                {progression.adFree && (
                  <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/40 text-purple-300">
                    VIP Reklamsız
                  </span>
                )}
              </div>
              {userClub && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-emerald-300">
                  <ClubBadge club={userClub} size="xs" />
                  <span className="truncate">{userClub.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('profile')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Düzenle</span>
            </button>
            {onOpenSettings && (
              <button
                type="button"
                data-testid="profile-settings-btn"
                onClick={onOpenSettings}
                aria-label="Ayarlar"
                title="Ayarlar"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Google / Email Account Linking & Security Card */}
        {(() => {
          const linkedGoogle = (progression.linkedAccounts ?? []).find(
            (a) => a.provider === 'google'
          );
          const connectedEmail =
            (cloudUser && !cloudUser.isAnonymous ? cloudUser.email : null) ||
            linkedGoogle?.handle ||
            null;
          const isGoogleConnected = Boolean(
            cloudUser?.isGoogleLinked || linkedGoogle
          );

          if (connectedEmail) {
            return (
              <div
                data-testid="profile-linked-account-card"
                className="mt-3 pt-2.5 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span
                    data-testid="profile-safe-badge"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/75 border border-emerald-400/50 text-[11px] font-black text-emerald-300 whitespace-nowrap"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {isGoogleConnected
                        ? 'Hesap Güvende (Google Bağlı)'
                        : cloudUser?.emailVerified
                        ? 'Hesap Güvende (E-posta Bağlı)'
                        : 'E-posta Doğrulama Bekleniyor'}
                    </span>
                  </span>
                  <span
                    data-testid="profile-connected-email"
                    className="block mt-1 text-[11px] font-semibold text-slate-300 truncate"
                  >
                    {connectedEmail}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div
              data-testid="profile-guest-link-card"
              className="mt-3 pt-3 border-t border-slate-800/70 space-y-2"
            >
              <p className="text-[11px] text-slate-300 font-semibold">
                Coinlerin, serin, puanların ve avatarların kaybolmasın — hesabını hemen bağla:
              </p>
              {accountLinkFeedback && (
                <p
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                    accountLinkFeedback.type === 'ok'
                      ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {accountLinkFeedback.text}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {onGoogleSignIn && (
                  <button
                    type="button"
                    data-testid="profile-google-link-btn"
                    disabled={isGoogleLinking}
                    onClick={async () => {
                      setIsGoogleLinking(true);
                      setAccountLinkFeedback(null);
                      try {
                        const res = await onGoogleSignIn();
                        if (res.ok) {
                          sounds.playVictory();
                          setAccountLinkFeedback({
                            type: 'ok',
                            text: `${res.email || 'Google'} hesabı bağlandı ve tüm verilerin korundu!`,
                          });
                        } else {
                          sounds.playWrong();
                          setAccountLinkFeedback({
                            type: 'err',
                            text: res.error || 'Google hesabı bağlanamadı.',
                          });
                        }
                      } finally {
                        setIsGoogleLinking(false);
                      }
                    }}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-60"
                  >
                    <CloudCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{isGoogleLinking ? 'Bağlanıyor...' : 'Google ile Giriş Yap / Hesabı Bağla'}</span>
                  </button>
                )}
                <button
                  type="button"
                  data-testid="profile-email-link-btn"
                  onClick={() => onOpenAuth('email')}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/45 text-amber-200 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>E-posta ile Giriş Yap / Kayıt Ol</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Coins, Daily Streak, Weekly Points Strip */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
          <div className="p-2 rounded-xl bg-slate-950/75 border border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-400 block">
              Coin Bakiyesi
            </span>
            <span
              data-testid="profile-coins"
              className="mt-0.5 font-mono font-black text-base text-amber-400 flex items-center justify-center gap-1"
            >
              <Coins className="w-4 h-4" />
              {formatPoints(progression.coins)}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-slate-950/75 border border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-400 block">
              Günlük Seri
            </span>
            <span
              data-testid="profile-daily-streak"
              className="mt-0.5 font-mono font-black text-base text-orange-400 flex items-center justify-center gap-1"
            >
              <Flame className="w-4 h-4" />
              {progression.dailyLogin.streakDays} Gün
            </span>
          </div>

          <div className="p-2 rounded-xl bg-slate-950/75 border border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-400 block">
              Haftalık Puan
            </span>
            <span className="mt-0.5 font-mono font-black text-base text-emerald-400">
              {formatPoints(progression.weeklyPoints)}
            </span>
          </div>
        </div>

        {/* Quick Unlocked Avatar / PP Switcher */}
        {onSelectAvatar && (
          <div className="mt-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Sahip Olduğun Avatar &amp; PP&apos;ler
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">
                {STAR_PP_AVATARS.filter((p) =>
                  progression.unlockedGiftIds.includes(p.giftId)
                ).length}
                /{STAR_PP_AVATARS.length} Yıldız PP Açık
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {unlockedAvatarValues.map((av) => {
                const isSelected = playerProfile.avatar === av;
                return (
                  <button
                    key={av}
                    type="button"
                    data-testid={`profile-quick-avatar-${av}`}
                    onClick={() => {
                      onSelectAvatar(av);
                    }}
                    className={`p-1 rounded-xl border transition shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400/50'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <PlayerAvatar avatar={av} name={playerProfile.name} size="sm" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Career Stats & Rank Progression Card */}
      <div
        data-testid="profile-career-stats-card"
        className="p-4 rounded-3xl bg-slate-900/90 border border-emerald-500/35 shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black text-white">📊 Kariyer İstatistikleri</h3>
          </div>
          <span
            data-testid="profile-career-rank-badge"
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-black flex items-center gap-1 ${careerRankProgress.currentRank.badgeColorClass}`}
          >
            <span>{careerRankProgress.currentRank.icon}</span>
            <span>{careerRankProgress.currentRank.title}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-400 block">
              Toplam Maç
            </span>
            <span
              data-testid="career-total-matches"
              className="mt-1 font-mono font-black text-base text-white flex items-center justify-center gap-1"
            >
              <Target className="w-3.5 h-3.5 text-sky-400" />
              {effectiveCareerStats.totalMatches}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-400 block">
              Galibiyet Oranı
            </span>
            <span
              data-testid="career-win-rate"
              className="mt-1 font-mono font-black text-base text-emerald-400 flex items-center justify-center gap-1"
            >
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              %{careerWinRatePct}
            </span>
            <span className="text-[9px] font-semibold text-slate-400 block">
              {effectiveCareerStats.totalWins} Galibiyet
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-400 block">
              En İyi Maç Süresi
            </span>
            <span
              data-testid="career-best-time"
              className="mt-1 font-mono font-black text-base text-amber-300 flex items-center justify-center gap-1"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              {effectiveCareerStats.bestMatchTimeSec !== null
                ? `${effectiveCareerStats.bestMatchTimeSec.toFixed(1)} sn`
                : '—'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-400 block">
              En Uzun Seri
            </span>
            <span
              data-testid="career-longest-streak"
              className="mt-1 font-mono font-black text-base text-orange-400 flex items-center justify-center gap-1"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              {effectiveCareerStats.longestWinStreak} Maç
            </span>
          </div>
        </div>

        {/* Career Rank Progress Bar */}
        <div className="mt-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-bold mb-1.5 gap-2">
            <span className="text-slate-300 flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Kariyer Rütbe İlerlemesi</span>
            </span>
            <span className="text-emerald-300 font-black text-right">
              {careerRankProgress.nextRank
                ? `${careerRankProgress.nextRank.icon} ${careerRankProgress.nextRank.title} (${careerRankProgress.winsToNext} galibiyet kaldı)`
                : 'Zirve Rütbeye Ulaşıldı!'}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div
              data-testid="career-rank-progress-bar"
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-500"
              style={{ width: `${careerRankProgress.progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
            {CAREER_RANK_TIERS.map((tier) => {
              const unlocked = effectiveCareerStats.totalWins >= tier.minWins;
              const isCurrent = careerRankProgress.currentRank.id === tier.id;
              return (
                <span
                  key={tier.id}
                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border ${
                    isCurrent
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : unlocked
                      ? 'bg-slate-800/90 border-slate-700 text-slate-300'
                      : 'bg-slate-950/70 border-slate-800/70 text-slate-500'
                  }`}
                >
                  {tier.icon} {tier.minWins}+ {tier.title.split(' ')[0]}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Consolidated Career Achievements (🏆 Başarımlar) Section */}
      {achievementsState && (
        <div
          data-testid="profile-achievements-section"
          className="p-4 rounded-3xl bg-slate-900/90 border border-amber-400/40 shadow-lg"
        >
          {(() => {
            const unlockedSet = new Set(achievementsState.unlockedIds);
            const claimedSet = new Set(achievementsState.claimedIds);
            const unlockedCount = achievementsState.unlockedIds.length;
            const claimableCount = CAREER_ACHIEVEMENTS.filter(
              (a) => unlockedSet.has(a.id) && !claimedSet.has(a.id)
            ).length;

            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-black text-white">🏆 Başarımlar</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {claimableCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow-sm">
                        +{claimableCount} Ödül Hazır
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-[10px] font-black text-emerald-300">
                      {unlockedCount}/{CAREER_ACHIEVEMENTS.length} Açıldı
                    </span>
                  </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                  {CAREER_ACHIEVEMENTS.map((ach) => {
                    const isUnlocked = unlockedSet.has(ach.id);
                    const isClaimed = claimedSet.has(ach.id);
                    const progress = getAchievementProgress(ach, achievementsState);
                    const pct = Math.min(100, Math.round((progress / ach.target) * 100));

                    return (
                      <div
                        key={ach.id}
                        data-testid={`profile-achievement-card-${ach.id}`}
                        className={`p-2.5 rounded-2xl border transition flex items-center justify-between gap-2.5 ${
                          isUnlocked && !isClaimed
                            ? 'bg-amber-500/15 border-amber-400/70 shadow-md shadow-amber-500/10'
                            : isClaimed
                            ? 'bg-emerald-950/45 border-emerald-500/35 opacity-90'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0 ${
                              isUnlocked
                                ? 'bg-amber-400/20 border-amber-400/50'
                                : 'bg-slate-900 border-slate-700 grayscale opacity-75'
                            }`}
                          >
                            {ach.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-xs sm:text-sm text-white truncate">
                                {ach.title}
                              </span>
                              {!isUnlocked && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                              {ach.description}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isUnlocked ? 'bg-emerald-400' : 'bg-cyan-400'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono font-bold text-slate-400 tabular-nums shrink-0">
                                {progress}/{ach.target}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isClaimed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black">
                              <CheckCircle2 className="w-3 h-3" />
                              Alındı
                            </span>
                          ) : isUnlocked && onClaimAchievementReward ? (
                            <button
                              type="button"
                              data-testid={`profile-claim-achievement-${ach.id}`}
                              onClick={() => {
                                sounds.playVictory();
                                try {
                                  confetti({
                                    particleCount: 55,
                                    spread: 60,
                                    origin: { y: 0.7 },
                                    colors: ['#10b981', '#fbbf24'],
                                  });
                                } catch {
                                  // ignore
                                }
                                onClaimAchievementReward(ach.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-[11px] font-black shadow-md cursor-pointer transition active:scale-95"
                            >
                              <Coins className="w-3 h-3" />
                              <span>+{ach.rewardCoins}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900 border border-slate-700 text-amber-300/80 text-[10px] font-black font-mono">
                              <Coins className="w-3 h-3" />
                              +{ach.rewardCoins}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Active Loadout, Boosters & Store Access Card */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-amber-400/35 shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-white">Donanım &amp; Güçlendiriciler</h3>
          </div>
          {onOpenStore && (
            <button
              type="button"
              data-testid="profile-open-store-btn"
              onClick={() => onOpenStore('featured')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Mağaza</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
          <button
            type="button"
            data-testid="profile-gear-energy"
            onClick={() => {
              const item = STORE_ITEMS.find((i) => i.id === 'store_energy_1') || null;
              setGearFeedback(null);
              setConfirmGearItem(item);
            }}
            className="p-2.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-cyan-500/35 hover:border-cyan-400 transition active:scale-[0.98] cursor-pointer text-center"
          >
            <span className="text-[10px] font-bold text-slate-400 block">🥤 Enerji İçeceği</span>
            <span className="text-sm font-black text-cyan-300 font-mono mt-0.5 block">
              {progression.energyDrinks ?? 0} Adet
            </span>
            <span className="text-[9px] font-bold text-cyan-400/90 mt-0.5 block">
              + Satın Al
            </span>
          </button>

          <button
            type="button"
            data-testid="profile-gear-shield"
            onClick={() => {
              const item = STORE_ITEMS.find((i) => i.id === 'store_league_shield') || null;
              setGearFeedback(null);
              setConfirmGearItem(item);
            }}
            className="p-2.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-indigo-500/35 hover:border-indigo-400 transition active:scale-[0.98] cursor-pointer text-center"
          >
            <span className="text-[10px] font-bold text-slate-400 block">🛡️ Lig Kalkanı</span>
            <span className="text-sm font-black text-indigo-300 font-mono mt-0.5 block">
              {progression.leagueShields ?? 0} Adet
            </span>
            <span className="text-[9px] font-bold text-indigo-300/90 mt-0.5 block">
              +1.000 Coin Al
            </span>
          </button>

          <button
            type="button"
            data-testid="profile-gear-extratime"
            onClick={() => {
              const item = STORE_ITEMS.find((i) => i.id === 'store_extra_time_10') || null;
              setGearFeedback(null);
              setConfirmGearItem(item);
            }}
            className="p-2.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-amber-500/35 hover:border-amber-400 transition active:scale-[0.98] cursor-pointer text-center"
          >
            <span className="text-[10px] font-bold text-slate-400 block">⏱️ +10 Sn Kartı</span>
            <span className="text-sm font-black text-amber-300 font-mono mt-0.5 block">
              {progression.extraTimeCards ?? 0} Adet
            </span>
            <span className="text-[9px] font-bold text-amber-300/90 mt-0.5 block">
              +500 Coin Al
            </span>
          </button>

          <button
            type="button"
            data-testid="profile-gear-multiplier"
            onClick={() => {
              const item = STORE_ITEMS.find((i) => i.id === 'store_mult_2x_5') || null;
              setGearFeedback(null);
              setConfirmGearItem(item);
            }}
            className="p-2.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-emerald-500/35 hover:border-emerald-400 transition active:scale-[0.98] cursor-pointer text-center"
          >
            <span className="text-[10px] font-bold text-slate-400 block">⚡ 2x Katlayıcı</span>
            <span className="text-xs font-black text-emerald-300 mt-1 block">
              {progression.permanentMultiplier2x
                ? 'Kalıcı Aktif'
                : (progression.multiplier2xMatches ?? 0) > 0
                ? `${progression.multiplier2xMatches} Maç`
                : 'Yok'}
            </span>
            <span className="text-[9px] font-bold text-emerald-400/90 mt-0.5 block">
              + Satın Al
            </span>
          </button>

          <button
            type="button"
            data-testid="profile-gear-theme"
            onClick={() => onOpenStore?.('themes_effects')}
            className="p-2.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-700 hover:border-amber-400/60 transition active:scale-[0.98] cursor-pointer text-center"
          >
            <span className="text-[10px] font-bold text-slate-400 block">🏟️ Saha Teması</span>
            <span className="text-[11px] font-black text-white mt-1 block truncate">
              {pitchInfo.label}
            </span>
            <span className="text-[9px] font-bold text-amber-300/90 mt-0.5 block">
              Mağazaya Git
            </span>
          </button>

          <button
            type="button"
            data-testid="profile-gear-adfree"
            onClick={() => {
              const item = STORE_ITEMS.find((i) => i.id === 'store_ad_free') || null;
              setGearFeedback(null);
              setConfirmGearItem(item);
            }}
            className="p-2.5 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-700 hover:border-purple-400/60 transition active:scale-[0.98] cursor-pointer text-center"
          >
            <span className="text-[10px] font-bold text-slate-400 block">💎 Reklam Durumu</span>
            <span className="text-[11px] font-black text-purple-300 mt-1 block">
              {progression.adFree ? 'VIP Reklamsız' : 'Standart'}
            </span>
            <span className="text-[9px] font-bold text-purple-300/90 mt-0.5 block">
              {progression.adFree ? 'Aktif ✓' : 'VIP Al'}
            </span>
          </button>
        </div>

        {/* Selectable Saha Teması Picker */}
        <div
          data-testid="profile-pitch-theme-section"
          className="mt-3 pt-3 border-t border-slate-800/80"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
              🏟️ Saha Teması Seçimi
            </span>
            <span className="text-[10px] font-bold text-emerald-400">
              Aktif: {pitchInfo.label}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              data-testid="profile-pitch-default"
              onClick={() => {
                onSelectDefaultPitchTheme?.();
                sounds.playCorrect();
                setGearFeedback({ type: 'ok', text: 'Klasik Çim Arena teması seçildi!' });
                setTimeout(() => setGearFeedback(null), 2200);
              }}
              className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                !progression.equippedPitchTheme
                  ? 'bg-emerald-500/20 border-emerald-400 text-white'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-600 text-slate-300'
              }`}
            >
              <span className="block text-xs font-black truncate">⚽ Klasik Çim</span>
              <span className="block text-[10px] text-emerald-300 font-bold mt-0.5">
                {!progression.equippedPitchTheme ? 'Seçili ✓' : 'Ücretsiz • Seç'}
              </span>
            </button>

            {STORE_ITEMS.filter((i) => i.type === 'pitch_theme').map((themeItem) => {
              const owned = progression.unlockedGiftIds.includes(themeItem.id);
              const active = progression.equippedPitchTheme === themeItem.value;
              return (
                <button
                  key={themeItem.id}
                  type="button"
                  data-testid={`profile-pitch-${themeItem.value}`}
                  onClick={() => {
                    if (owned) {
                      const res = onEquipItem?.(themeItem.id);
                      if (res?.ok) {
                        sounds.playCorrect();
                        setGearFeedback({
                          type: 'ok',
                          text: `${themeItem.title} aktif edildi!`,
                        });
                        setTimeout(() => setGearFeedback(null), 2200);
                      }
                    } else {
                      setGearFeedback(null);
                      if (themeItem.costCoins > 0 && progression.coins < themeItem.costCoins) {
                        sounds.playWrong();
                        setInsufficientFundsGift(themeItem);
                      } else {
                        setConfirmGearItem(themeItem);
                      }
                    }
                  }}
                  className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : owned
                      ? 'bg-slate-900 border-slate-700 hover:border-emerald-400/60 text-slate-200'
                      : 'bg-slate-950/80 border-slate-800 hover:border-amber-400/50 text-slate-300'
                  }`}
                >
                  <span className="block text-xs font-black truncate">
                    {themeItem.icon} {themeItem.title.replace(' Teması', '')}
                  </span>
                  <span
                    className={`block text-[10px] font-bold mt-0.5 ${
                      active ? 'text-emerald-300' : owned ? 'text-cyan-300' : 'text-amber-300'
                    }`}
                  >
                    {active
                      ? 'Seçili ✓'
                      : owned
                      ? 'Açık • Seç'
                      : `${formatPoints(themeItem.costCoins)} Coin`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {gearFeedback && (
          <div
            data-testid="profile-gear-feedback"
            className={`mt-2.5 px-3 py-2 rounded-xl border text-xs font-bold ${
              gearFeedback.type === 'ok'
                ? 'bg-emerald-950/80 border-emerald-400/50 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
            }`}
          >
            {gearFeedback.text}
          </div>
        )}
      </div>

      {/* 7-Day Daily Check-in Strip */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-amber-400/35 shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-white">Günlük Giriş Ödülü</h3>
          </div>
          <span className="text-[11px] font-black text-orange-400">
            🔥 {progression.dailyLogin.streakDays} Günlük Seri
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-3">
          {DAILY_REWARD_SCHEDULE.map((tier) => {
            const isClaimed =
              tier.day < activeTier.day || (!dailyClaimable && tier.day === activeTier.day);
            const isToday = dailyClaimable && tier.day === activeTier.day;

            return (
              <div
                key={tier.day}
                className={`py-2 px-1 rounded-xl border text-center flex flex-col items-center justify-center ${
                  isToday
                    ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/50'
                    : isClaimed
                    ? 'bg-emerald-950/60 border-emerald-500/40'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <span className="text-[9px] font-bold text-slate-400">G{tier.day}</span>
                <span className="text-[11px] font-black text-amber-300 mt-0.5">
                  {tier.coins}
                </span>
                {isClaimed && <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5" />}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          data-testid="profile-claim-daily-btn"
          disabled={!dailyClaimable}
          onClick={() => {
            sounds.playVictory();
            onClaimDailyReward();
          }}
          className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition cursor-pointer ${
            dailyClaimable
              ? 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-md active:scale-95'
              : 'bg-slate-800 text-emerald-400 cursor-default'
          }`}
        >
          {dailyClaimable
            ? `Bugünün Ödülünü Al (+${activeTier.coins} Coin & +${activeTier.points} Puan)`
            : 'Bugünkü Giriş Ödülü Alındı ✓'}
        </button>
      </div>

      {/* Daily Quests Section */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black text-white">Günlük Görevler</h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Her gün 00:00 yenilenir
          </span>
        </div>

        <div className="space-y-2.5">
          {progression.dailyQuests.map((quest) => {
            const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));
            const isComplete = quest.progress >= quest.target;

            return (
              <div
                key={quest.id}
                data-testid={`daily-quest-${quest.id}`}
                className={`p-3 rounded-2xl border transition ${
                  quest.claimed
                    ? 'bg-slate-950/50 border-slate-800/70 opacity-75'
                    : isComplete
                    ? 'bg-emerald-950/35 border-emerald-400/60'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg shrink-0">
                      {quest.icon}
                    </span>
                    <div className="min-w-0">
                      <span className="block font-black text-xs sm:text-sm text-white">
                        {quest.title}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {quest.description}
                      </span>
                      <span className="inline-block text-[10px] font-bold text-amber-300 mt-1">
                        🎁 +{quest.rewardCoins} Coin • +{quest.rewardPoints} Puan
                      </span>
                    </div>
                  </div>

                  {quest.claimed ? (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 font-black text-[10px] shrink-0">
                      Alındı ✓
                    </span>
                  ) : isComplete ? (
                    <button
                      type="button"
                      data-testid={`claim-quest-${quest.id}`}
                      onClick={() => handleQuestClaim(quest.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition active:scale-95 shrink-0 cursor-pointer shadow"
                    >
                      Ödülü Al! 🎁
                    </button>
                  ) : (
                    <span className="font-mono font-bold text-xs text-slate-300 shrink-0">
                      {quest.progress}/{quest.target}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden mt-2.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isComplete ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coin Gift / Reward Shop */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-4 h-4 text-purple-400 shrink-0" />
            <h3 className="text-sm font-black text-white truncate">Yıldız PP &amp; Unvan Dükkanı</h3>
          </div>
          {onOpenStore ? (
            <button
              type="button"
              onClick={() => onOpenStore('pp_badges')}
              className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 font-black text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Zap className="w-3 h-3" />
              <span>Tüm Mağaza</span>
            </button>
          ) : (
            <span className="text-xs font-black text-amber-400 font-mono">
              🪙 {formatPoints(progression.coins)}
            </span>
          )}
        </div>

        {shopFeedback && (
          <div className="mb-2.5 px-3 py-2 rounded-xl bg-slate-950 border border-amber-400/40 text-xs font-bold text-amber-300">
            {shopFeedback}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quickCosmeticItems.map((gift) => {
            const owned = progression.unlockedGiftIds.includes(gift.id);
            const equipped =
              (gift.type === 'title' && progression.equippedTitle === gift.value) ||
              (gift.type === 'avatar' && playerProfile.avatar === gift.value);

            return (
              <div
                key={gift.id}
                className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-2"
              >
                <div className="flex items-start gap-2.5">
                  {gift.type === 'avatar' && isPhotoAvatar(gift.value) ? (
                    <PlayerAvatar
                      avatar={gift.value}
                      name={gift.title}
                      size="sm"
                      className="border border-slate-700 bg-slate-900"
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg shrink-0">
                      {gift.icon}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="block font-black text-xs text-white truncate">
                      {gift.title}
                    </span>
                    <span className="block text-[10px] text-slate-400 leading-snug">
                      {gift.description}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid={`shop-gift-${gift.id}`}
                  onClick={() => {
                    if (owned) {
                      if (onEquipItem && gift.type === 'title') {
                        const res = onEquipItem(gift.id);
                        if (res.ok) {
                          sounds.playCorrect();
                          setShopFeedback(`${gift.title} kullanılıyor!`);
                          setTimeout(() => setShopFeedback(null), 2000);
                          return;
                        }
                      }
                      handleGiftAction(gift.id);
                      return;
                    }

                    setShopFeedback(null);
                    if (progression.coins >= gift.costCoins) {
                      setPendingPurchaseGift(gift);
                    } else {
                      sounds.playWrong();
                      setInsufficientFundsGift(gift);
                    }
                  }}
                  className={`w-full py-1.5 rounded-xl font-black text-[11px] transition cursor-pointer ${
                    equipped
                      ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                      : owned
                      ? 'bg-slate-800 hover:bg-slate-700 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  {equipped
                    ? 'Kullanılıyor ✓'
                    : owned
                    ? 'Kullan'
                    : `Aç (${formatPoints(gift.costCoins)} Coin)`}
                  </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hesabımı ve Verilerimi Sil (Profil İçi Veri Güvenliği Alanı) */}
      {onDeleteAccount && (
        <div className="mt-4 p-4 rounded-2xl bg-rose-950/20 border border-rose-500/35 space-y-2.5">
          {!confirmDeleteAccount ? (
            <button
              type="button"
              data-testid="profile-delete-account-btn"
              onClick={() => setConfirmDeleteAccount(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/45 text-rose-200 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hesabımı ve Verilerimi Sil</span>
            </button>
          ) : (
            <div data-testid="profile-delete-confirm-box" className="space-y-2.5 text-center">
              <p className="text-xs font-black text-rose-200">
                Bu işlem geri alınamaz! Bulut yedeğin, coinlerin ve yerel ilerlemen kalıcı olarak silinecek.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAccount(false)}
                  disabled={isDeletingAccount}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  data-testid="profile-confirm-delete-account-btn"
                  disabled={isDeletingAccount}
                  onClick={async () => {
                    setIsDeletingAccount(true);
                    try {
                      await onDeleteAccount();
                    } finally {
                      setIsDeletingAccount(false);
                      setConfirmDeleteAccount(false);
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer disabled:opacity-60"
                >
                  {isDeletingAccount ? 'Siliniyor...' : 'Kalıcı Olarak Sil'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Purchase Confirmation Modal for Donanım & Güçlendiriciler */}
      {confirmGearItem && typeof document !== 'undefined' && createPortal(
        <div
          data-testid="gear-confirm-modal"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-amber-400/50 p-5 shadow-2xl text-center">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setConfirmGearItem(null)}
                className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-3xl mx-auto mb-3">
              {confirmGearItem.icon}
            </div>

            <h3 className="text-lg font-black text-white leading-snug">
              {confirmGearItem.title} Almak İster Misin?
            </h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              {confirmGearItem.description}
            </p>

            <div className="my-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">Mevcut Bakiyen</span>
              <span className="font-mono font-black text-amber-400 tabular-nums">
                🪙 {formatPoints(progression.coins)} Coin
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {confirmGearItem.costCoins > 0 && (
                <button
                  type="button"
                  data-testid="gear-confirm-buy-btn"
                  onClick={() => {
                    const item = confirmGearItem;
                    if (item.costCoins > 0 && progression.coins < item.costCoins) {
                      sounds.playWrong();
                      setConfirmGearItem(null);
                      setInsufficientFundsGift(item);
                      return;
                    }
                    const res = onPurchaseStoreItem
                      ? onPurchaseStoreItem(item.id, 'coins')
                      : onPurchaseGift(item.id);
                    if (res.ok) {
                      sounds.playVictory();
                      setGearFeedback({
                        type: 'ok',
                        text: `${item.title} satın alındı ve hesabına eklendi!`,
                      });
                    } else {
                      sounds.playWrong();
                      setGearFeedback({
                        type: 'err',
                        text: res.reason || 'Satın alma tamamlanamadı.',
                      });
                    }
                    setConfirmGearItem(null);
                    setTimeout(() => setGearFeedback(null), 3000);
                  }}
                  className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm transition active:scale-95 cursor-pointer"
                >
                  Evet, Satın Al (🪙 {formatPoints(confirmGearItem.costCoins)} Coin)
                </button>
              )}

              {onOpenStore && (
                <button
                  type="button"
                  data-testid="gear-confirm-store-btn"
                  onClick={() => {
                    const cat = confirmGearItem.category;
                    setConfirmGearItem(null);
                    onOpenStore(cat);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mağazada Tüm Seçenekleri Gör</span>
                </button>
              )}

              <button
                type="button"
                data-testid="gear-confirm-cancel-btn"
                onClick={() => setConfirmGearItem(null)}
                className="w-full py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Avatar (PP) / Item Purchase Confirmation Modal */}
      {pendingPurchaseGift && typeof document !== 'undefined' && createPortal(
        <div
          data-testid="pp-confirm-modal"
          className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-emerald-400/60 p-5 shadow-2xl text-center">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPendingPurchaseGift(null)}
                className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-center mb-3">
              {pendingPurchaseGift.type === 'avatar' && isPhotoAvatar(pendingPurchaseGift.value) ? (
                <PlayerAvatar
                  avatar={pendingPurchaseGift.value}
                  name={pendingPurchaseGift.title}
                  size="lg"
                  variant="circle"
                  className="border-2 border-amber-400/70 bg-slate-950 shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/50 flex items-center justify-center text-3xl">
                  {pendingPurchaseGift.icon}
                </div>
              )}
            </div>

            <h3 className="text-lg font-black text-white leading-snug">
              {pendingPurchaseGift.title}
            </h3>
            <p className="text-sm font-bold text-slate-200 mt-2 leading-relaxed">
              {pendingPurchaseGift.type === 'avatar'
                ? `Bu avatarı ${formatPoints(pendingPurchaseGift.costCoins)} Coin karşılığında satın almak istiyor musun?`
                : `Bu ürünü ${formatPoints(pendingPurchaseGift.costCoins)} Coin karşılığında satın almak istiyor musun?`}
            </p>

            <div className="my-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Mevcut Bakiyen</span>
                <span className="font-mono font-black text-amber-400 tabular-nums">
                  🪙 {formatPoints(progression.coins)} Coin
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Satın Alma Sonrası</span>
                <span className="font-mono font-black text-emerald-400 tabular-nums">
                  🪙 {formatPoints(Math.max(0, progression.coins - pendingPurchaseGift.costCoins))} Coin
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                data-testid="pp-confirm-buy-btn"
                onClick={() => {
                  const target = pendingPurchaseGift;
                  setPendingPurchaseGift(null);
                  const res = onPurchaseGift(target.id);
                  if (res.ok) {
                    sounds.playVictory();
                    setShopFeedback(`${target.title} satın alındı ve aktif edildi!`);
                    setTimeout(() => setShopFeedback(null), 2600);
                  } else {
                    sounds.playWrong();
                    setInsufficientFundsGift(target);
                  }
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm transition active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/25"
              >
                ✅ Evet, Satın Al
              </button>

              <button
                type="button"
                data-testid="pp-confirm-cancel-btn"
                onClick={() => setPendingPurchaseGift(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Insufficient Funds Warning Modal (⚠️ PARAN YETERSİZ!) */}
      {insufficientFundsGift && typeof document !== 'undefined' && createPortal(
        <div
          data-testid="pp-insufficient-modal"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/88 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-rose-950/90 via-slate-900 to-slate-950 border-2 border-rose-500/80 p-5 sm:p-6 shadow-[0_0_40px_rgba(244,63,94,0.35)] text-center">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setInsufficientFundsGift(null)}
                className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-2.5 rounded-2xl bg-rose-500/20 border-2 border-rose-400 text-rose-200 font-black text-lg sm:text-xl tracking-wide shadow-lg mb-4">
              ⚠️ PARAN YETERSİZ!
            </div>

            <div className="flex justify-center mb-2.5">
              {insufficientFundsGift.type === 'avatar' && isPhotoAvatar(insufficientFundsGift.value) ? (
                <PlayerAvatar
                  avatar={insufficientFundsGift.value}
                  name={insufficientFundsGift.title}
                  size="md"
                  variant="circle"
                  className="border-2 border-rose-400/60 bg-slate-950 opacity-90"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-400/50 flex items-center justify-center text-2xl">
                  {insufficientFundsGift.icon}
                </div>
              )}
            </div>

            <h3 className="text-base font-black text-white">{insufficientFundsGift.title}</h3>
            <p className="text-xs sm:text-sm text-rose-200 font-bold mt-1.5">
              Bu {insufficientFundsGift.type === 'avatar' ? 'avatarı' : 'ürünü'} almak için{' '}
              <span className="text-amber-300 font-mono font-black">
                {formatPoints(Math.max(1, insufficientFundsGift.costCoins - progression.coins))} Coin
              </span>{' '}
              daha gerekiyor!
            </p>

            <div className="my-4 p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Gerekli Tutar</span>
                <span className="font-mono font-black text-amber-300 tabular-nums">
                  🪙 {formatPoints(insufficientFundsGift.costCoins)} Coin
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Mevcut Bakiyen</span>
                <span className="font-mono font-black text-slate-200 tabular-nums">
                  🪙 {formatPoints(progression.coins)} Coin
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-rose-300 font-black">Eksik Coin</span>
                <span className="font-mono font-black text-rose-400 tabular-nums">
                  -{formatPoints(Math.max(1, insufficientFundsGift.costCoins - progression.coins))} Coin
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {onOpenStore && (
                <button
                  type="button"
                  data-testid="pp-insufficient-goto-store-btn"
                  onClick={() => {
                    setInsufficientFundsGift(null);
                    onOpenStore('ads_coins');
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>🛒 Mağazaya Git</span>
                </button>
              )}

              <button
                type="button"
                data-testid="pp-insufficient-close-btn"
                onClick={() => setInsufficientFundsGift(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
