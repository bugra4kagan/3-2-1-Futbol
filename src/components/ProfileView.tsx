import React, { useState } from 'react';
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
  Link2,
  ShieldCheck,
  Zap,
  Sparkles,
} from 'lucide-react';
import {
  PlayerProfile,
  ShopGiftItem,
  SocialProvider,
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
  SOCIAL_LINK_BONUS_COINS,
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
import { ClubLogo } from './ClubLogo';
import { PlayerAvatar } from './PlayerAvatar';
import { sounds } from '../utils/audio';

interface ProfileViewProps {
  playerProfile: PlayerProfile;
  progression: UserProgression;
  onOpenAuth: () => void;
  onSelectAvatar?: (avatar: string) => void;
  onClaimDailyReward: () => void;
  onClaimDailyQuest: (questId: string) => void;
  onPurchaseGift: (giftId: string) => { ok: boolean; reason?: string };
  onOpenStore?: (category?: StoreCategory) => void;
  onEquipItem?: (itemId: string) => { ok: boolean; reason?: string };
  onLinkSocial?: (
    provider: SocialProvider,
    handle: string
  ) => { ok: boolean; error?: string; bonusCoinsAwarded?: number };
  onUnlinkSocial?: (provider: SocialProvider) => void;
}

const SOCIAL_PROVIDERS: {
  id: SocialProvider;
  label: string;
  icon: string;
  placeholder: string;
}[] = [
  { id: 'google', label: 'Google', icon: '🔵', placeholder: 'ornek@gmail.com' },
  { id: 'apple', label: 'Apple ID', icon: '⚫', placeholder: 'icloud@icloud.com' },
  { id: 'instagram', label: 'Instagram', icon: '🟣', placeholder: '@kullanici_adi' },
  { id: 'x', label: 'X (Twitter)', icon: '✖️', placeholder: '@kullanici_adi' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  playerProfile,
  progression,
  onOpenAuth,
  onSelectAvatar,
  onClaimDailyReward,
  onClaimDailyQuest,
  onPurchaseGift,
  onOpenStore,
  onEquipItem,
  onLinkSocial,
  onUnlinkSocial,
}) => {
  const [shopFeedback, setShopFeedback] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<SocialProvider | null>(null);
  const [socialHandle, setSocialHandle] = useState('');
  const [socialFeedback, setSocialFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const userClub = playerProfile.favoriteClubId ? CLUBS[playerProfile.favoriteClubId] : null;
  const dailyClaimable = canClaimDailyReward(progression);
  const activeTier = getActiveDailyRewardTier(progression);
  const crestInfo = getCrestBadgeInfo(progression.equippedCrest);
  const pitchInfo = getPitchThemeStyle(progression.equippedPitchTheme);
  const linkedAccounts = progression.linkedAccounts ?? [];

  const unlockedAvatarValues = [
    ...SHOP_GIFTS.filter(
      (g) => g.type === 'avatar' && progression.unlockedGiftIds.includes(g.id)
    ).map((g) => g.value),
    ...FREE_AVATARS,
  ];

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

  const handleSocialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingProvider || !onLinkSocial) return;
    const res = onLinkSocial(linkingProvider, socialHandle);
    if (res.ok) {
      sounds.playVictory();
      setSocialFeedback({
        type: 'ok',
        text:
          res.bonusCoinsAwarded && res.bonusCoinsAwarded > 0
            ? `Hesap bağlandı! +${res.bonusCoinsAwarded} Coin yedekleme ödülü eklendi!`
            : 'Hesap başarıyla bağlandı & yedeklendi!',
      });
      setLinkingProvider(null);
      setSocialHandle('');
    } else {
      sounds.playWrong();
      setSocialFeedback({
        type: 'err',
        text: res.error || 'Hesap bağlanamadı.',
      });
    }
    setTimeout(() => setSocialFeedback(null), 3000);
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
                  <ClubLogo club={userClub} size="xs" />
                  <span className="truncate">{userClub.name}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Düzenle</span>
          </button>
        </div>

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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-950/85 border border-cyan-500/30">
            <span className="text-[10px] font-bold text-slate-400 block">🥤 Enerji İçeceği</span>
            <span className="text-sm font-black text-cyan-300 font-mono mt-0.5 block">
              {progression.energyDrinks ?? 0} Adet
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/85 border border-emerald-500/30">
            <span className="text-[10px] font-bold text-slate-400 block">⚡ 2x Katlayıcı</span>
            <span className="text-xs font-black text-emerald-300 mt-1 block">
              {progression.permanentMultiplier2x
                ? 'Kalıcı Aktif'
                : (progression.multiplier2xMatches ?? 0) > 0
                ? `${progression.multiplier2xMatches} Maç`
                : 'Yok'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/85 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block">🏟️ Saha Teması</span>
            <span className="text-[11px] font-black text-white mt-1 block truncate">
              {pitchInfo.label}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/85 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block">🛡️ Reklam Durumu</span>
            <span className="text-[11px] font-black text-purple-300 mt-1 block">
              {progression.adFree ? 'VIP Reklamsız' : 'Standart'}
            </span>
          </div>
        </div>
      </div>

      {/* Social Media Account Linking & Backup Card */}
      <div
        data-testid="social-link-card"
        className="p-4 rounded-3xl bg-slate-900/90 border border-sky-500/35 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-black text-white">Hesabı Güvene Al (Sosyal Medya)</h3>
          </div>
          {linkedAccounts.length > 0 ? (
            <span
              data-testid="social-backup-badge"
              className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-black flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3" />
              Hesap Güvende ✓
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black">
              +{SOCIAL_LINK_BONUS_COINS} Coin Hediye
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          Puanlarını, yıldız PP’lerini ve mağaza ürünlerini kaybetmemek için sosyal medya hesabını bağla!
        </p>

        {socialFeedback && (
          <div
            data-testid="social-link-feedback"
            className={`mb-3 px-3 py-2 rounded-xl border text-xs font-bold ${
              socialFeedback.type === 'ok'
                ? 'bg-emerald-950/80 border-emerald-400/50 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
            }`}
          >
            {socialFeedback.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SOCIAL_PROVIDERS.map((sp) => {
            const linked = linkedAccounts.find((a) => a.provider === sp.id);
            return (
              <div
                key={sp.id}
                className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 ${
                  linked
                    ? 'bg-emerald-950/35 border-emerald-400/50'
                    : 'bg-slate-950/85 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{sp.icon}</span>
                  <div className="min-w-0">
                    <span className="block text-xs font-black text-white truncate">
                      {sp.label}
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {linked ? linked.handle : 'Bağlı değil'}
                    </span>
                  </div>
                </div>

                {linked ? (
                  <button
                    type="button"
                    data-testid={`unlink-social-${sp.id}`}
                    onClick={() => onUnlinkSocial?.(sp.id)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/70 text-[10px] font-bold text-slate-300 hover:text-rose-300 shrink-0 cursor-pointer"
                  >
                    Kaldır
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid={`link-social-${sp.id}`}
                    onClick={() => {
                      setLinkingProvider(sp.id);
                      setSocialHandle('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-[10px] font-black text-sky-200 shrink-0 cursor-pointer"
                  >
                    Bağla
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {linkingProvider && (
          <form
            onSubmit={handleSocialSubmit}
            data-testid="social-link-form"
            className="mt-3 p-3 rounded-2xl bg-slate-950 border border-sky-400/40 flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              data-testid="social-handle-input"
              required
              maxLength={40}
              value={socialHandle}
              onChange={(e) => setSocialHandle(e.target.value)}
              placeholder={
                SOCIAL_PROVIDERS.find((p) => p.id === linkingProvider)?.placeholder ||
                'Kullanıcı adı veya e-posta'
              }
              className="flex-1 bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 focus:border-sky-400 outline-none"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                data-testid="social-handle-submit"
                className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Onayla &amp; Bağla
              </button>
              <button
                type="button"
                onClick={() => setLinkingProvider(null)}
                className="px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
              >
                İptal
              </button>
            </div>
          </form>
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
                    if (owned && onEquipItem && gift.type === 'title') {
                      const res = onEquipItem(gift.id);
                      if (res.ok) {
                        sounds.playCorrect();
                        setShopFeedback(`${gift.title} kullanılıyor!`);
                        setTimeout(() => setShopFeedback(null), 2000);
                        return;
                      }
                    }
                    handleGiftAction(gift.id);
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
    </div>
  );
};
