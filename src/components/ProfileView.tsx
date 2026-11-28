import React, { useEffect, useState } from 'react';
import {
  Settings,
  Edit3,
  Trash2,
  ShieldCheck,
  CloudCheck,
  Mail,
  AlertTriangle,
  LogOut,
  Check,
  Crown,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  ChevronRight,
} from 'lucide-react';
import {
  PlayerProfile,
  ShopGiftItem,
  StoreCategory,
  UserProgression,
} from '../game/types';
import { formatPoints, getLeagueTierInfo } from '../game/retentionEngine';
import { CLUBS } from '../game/database';
import {
  formatTry,
  getCrestBadgeInfo,
  getFrameClasses,
  getProfileStoreFrames,
  getProfileStoreTitles,
  STORE_ITEMS,
} from '../game/storeCatalog';
import { CareerStatsData } from '../game/careerStatsEngine';
import { CareerAchievementsState } from '../game/achievementsEngine';
import { getProfileIconLabel, normalizeProfileIconId } from '../game/profileIcons';
import {
  isLegacyFlaggedUsername,
  sanitizePublicDisplayName,
} from '../game/usernameFilter';
import { ClubBadge } from './ClubBadge';
import { CoinIcon } from './CoinIcon';
import { PlayerAvatar } from './PlayerAvatar';
import { isRealMoneyIapEnabled } from '../game/monetizationFlags';
import { sounds } from '../utils/audio';
import {
  fetchGooglePlayPrices,
  PlayStoreProductPriceInfo,
} from '../services/playBillingService';

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
  onSignOut?: () => Promise<void>;
  onOpenAuth: (initialTab?: 'profile' | 'email') => void;
  onOpenSettings?: () => void;
  onSelectAvatar?: (avatar: string) => void;
  onClaimDailyReward?: () => void;
  onClaimDailyQuest?: (questId: string) => void;
  onClaimAchievementReward?: (achievementId: string) => void;
  onPurchaseGift?: (giftId: string) => { ok: boolean; reason?: string };
  onPurchaseStoreItem?: (
    itemId: string,
    method: 'coins' | 'money'
  ) =>
    | Promise<{ ok: boolean; reason?: string; gift?: ShopGiftItem }>
    | { ok: boolean; reason?: string; gift?: ShopGiftItem };
  onOpenStore?: (category?: StoreCategory) => void;
  onEquipItem?: (itemId: string) => { ok: boolean; reason?: string };
  onRestorePurchases?: () => Promise<{ ok: boolean; message: string }>;
  onSelectDefaultPitchTheme?: () => void;
  onDeleteAccount?: () => Promise<{ ok: boolean; warning?: string }>;
  onExitApp?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  playerProfile,
  progression,
  cloudUser = null,
  onGoogleSignIn,
  onSignOut,
  onOpenAuth,
  onOpenSettings,
  onOpenStore,
  onPurchaseStoreItem,
  onEquipItem,
  onRestorePurchases,
  onDeleteAccount,
  onExitApp,
}) => {
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isGoogleLinking, setIsGoogleLinking] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [isPurchasingItem, setIsPurchasingItem] = useState(false);
  const [playPrices, setPlayPrices] = useState<Record<string, PlayStoreProductPriceInfo>>({});

  useEffect(() => {
    let active = true;
    void fetchGooglePlayPrices().then((prices) => {
      if (active && prices && Object.keys(prices).length > 0) {
        setPlayPrices(prices);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const [accountLinkFeedback, setAccountLinkFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [storeFeedback, setStoreFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [pendingConfirmItem, setPendingConfirmItem] = useState<{
    item: ShopGiftItem;
    method: 'coins' | 'money';
  } | null>(null);

  const userClub = playerProfile.favoriteClubId ? CLUBS[playerProfile.favoriteClubId] : null;
  const crestInfo = getCrestBadgeInfo(progression.equippedCrest);
  const leagueTier = getLeagueTierInfo(progression.leagueTierId);
  const activeAvatarId = normalizeProfileIconId(playerProfile.avatar);

  const safeDisplayName = sanitizePublicDisplayName(playerProfile.name, playerProfile.id);
  const needsUsernameRename = isLegacyFlaggedUsername(playerProfile.name);

  const linkedGoogle = (progression.linkedAccounts ?? []).find((a) => a.provider === 'google');
  const connectedEmail =
    (cloudUser && !cloudUser.isAnonymous ? cloudUser.email : null) ||
    linkedGoogle?.handle ||
    null;
  const isGoogleConnected = Boolean(cloudUser?.isGoogleLinked || linkedGoogle);

  const profileFrames = getProfileStoreFrames();
  const profileTitles = getProfileStoreTitles();
  const adFreeItem = STORE_ITEMS.find((i) => i.id === 'store_ad_free');
  const isAdFreeOwned = Boolean(
    progression.adFree || progression.unlockedGiftIds.includes('store_ad_free')
  );

  const showStoreFeedback = (type: 'ok' | 'err', text: string) => {
    setStoreFeedback({ type, text });
    setTimeout(() => setStoreFeedback(null), 3200);
  };

  const handleBuyOrEquip = (item: ShopGiftItem) => {
    const owned = progression.unlockedGiftIds.includes(item.id);
    if (owned) {
      if (!onEquipItem) return;
      const res = onEquipItem(item.id);
      if (res.ok) {
        sounds.playCorrect();
        showStoreFeedback('ok', `${item.title} etkinleştirildi!`);
      } else {
        sounds.playWrong();
        showStoreFeedback('err', res.reason || 'Etkinleştirilemedi.');
      }
      return;
    }

    if (progression.coins < item.costCoins) {
      sounds.playWrong();
      showStoreFeedback(
        'err',
        `Yetersiz Coin! ${item.title} için ${formatPoints(item.costCoins - progression.coins)} Coin daha gerekiyor.`
      );
      return;
    }

    setPendingConfirmItem({ item, method: 'coins' });
  };

  const executeConfirmedPurchase = async () => {
    if (isPurchasingItem || !pendingConfirmItem || !onPurchaseStoreItem) {
      if (!isPurchasingItem) setPendingConfirmItem(null);
      return;
    }
    const { item, method } = pendingConfirmItem;
    setIsPurchasingItem(true);
    try {
      const res = await Promise.resolve(onPurchaseStoreItem(item.id, method));
      if (res.ok) {
        sounds.playVictory();
        showStoreFeedback('ok', `${item.title} satın alındı ve kullanılıyor!`);
      } else {
        sounds.playWrong();
        showStoreFeedback('err', res.reason || 'Satın alma tamamlanamadı.');
      }
    } finally {
      setIsPurchasingItem(false);
      setPendingConfirmItem(null);
    }
  };

  return (
    <div
      data-testid="profile-view"
      className="w-full max-w-[560px] mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col gap-3.5 text-left text-[#F5F3EB]"
    >
      {/* Rename warning when legacy name violates current filter */}
      {needsUsernameRename && (
        <div
          data-testid="profile-rename-required-banner"
          className="p-3.5 rounded-2xl bg-[#DC2626]/15 border border-[#DC2626]/65 flex items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-black text-[#FFFFFF]">
                Yeni kullanıcı adı seçmen gerekiyor
              </p>
              <p className="text-[11px] text-[#A8B3C2]">
                Mevcut kullanıcı adın kurallarımıza uygun olmadığı için gizlendi. Puan ve coinlerin güvende!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenAuth('profile')}
            className="px-3 py-1.5 rounded-xl bg-[#168A52] hover:bg-[#22C55E] text-[#FFFFFF] font-black text-xs shrink-0 cursor-pointer"
          >
            Ad Seç
          </button>
        </div>
      )}

      {/* 1 & 2 & 3 & 4: User Info, Icon + Edit Profile, Cloud Linking, Balance & League Points */}
      <div className="p-3.5 sm:p-5 rounded-3xl bg-[#124029] border border-[#E5B94F]/30 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar
              avatar={activeAvatarId}
              name={safeDisplayName}
              size="xl"
              frame={progression.equippedFrame}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {crestInfo && (
                  <span title={crestInfo.label} className="text-base shrink-0">
                    {crestInfo.icon}
                  </span>
                )}
                <h2 className="font-display font-extrabold text-2xl text-[#FFFFFF] truncate leading-none">
                  {safeDisplayName}
                </h2>
                {progression.equippedBadge && (
                  <span className="text-base shrink-0" title="Profil Rozeti">
                    {progression.equippedBadge}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span
                  data-testid="profile-friend-code"
                  className="text-xs text-[#A8B3C2]"
                >
                  Kod:{' '}
                  <strong className="font-mono text-[#FFFFFF]">
                    {progression.friendCode}
                  </strong>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#0B1220] border border-[#A8B3C2]/25 text-[#F5F3EB]">
                  {getProfileIconLabel(activeAvatarId)}
                </span>
                {progression.equippedTitle && (
                  <span
                    data-testid="profile-equipped-title"
                    className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#E5B94F]/15 border border-[#E5B94F]/50 text-[#E5B94F]"
                  >
                    {progression.equippedTitle}
                  </span>
                )}
              </div>

              {userClub && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-[#22C55E]">
                  <ClubBadge club={userClub} size="xs" />
                  <span className="truncate">{userClub.name}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            data-testid="profile-edit-btn"
            onClick={() => onOpenAuth('profile')}
            className="px-3.5 py-2 rounded-xl bg-[#0F273E] hover:bg-[#173857] border border-[#E5B94F]/60 text-xs font-black text-[#FFFFFF] flex items-center gap-1.5 shrink-0 cursor-pointer transition active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#E5B94F]" />
            <span>Profil Düzenle</span>
          </button>
        </div>

        {/* 3. Google / Email Account Linking */}
        {connectedEmail ? (
          <div
            data-testid="profile-linked-account-card"
            className="pt-3 border-t border-[#A8B3C2]/15 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <span
                data-testid="profile-safe-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#183D2B] border border-[#22C55E]/50 text-[11px] font-black text-[#22C55E] whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isGoogleConnected
                    ? 'Google Hesabı Bağlı'
                    : cloudUser?.emailVerified
                    ? 'E-posta Hesabı Bağlı'
                    : 'E-posta Doğrulama Bekleniyor'}
                </span>
              </span>
              <span
                data-testid="profile-connected-email"
                className="block mt-1 text-[11px] font-semibold text-[#A8B3C2] truncate"
              >
                {connectedEmail}
              </span>
            </div>
          </div>
        ) : (
          <div
            data-testid="profile-guest-link-card"
            className="pt-3 border-t border-[#A8B3C2]/15 space-y-2"
          >
            <p className="text-[11px] text-[#A8B3C2] font-semibold">
              Hesabını bağlayarak coin ve lig puanlarını bulutta koru:
            </p>
            {accountLinkFeedback && (
              <p
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                  accountLinkFeedback.type === 'ok'
                    ? 'bg-[#183D2B] border-[#22C55E]/50 text-[#22C55E]'
                    : 'bg-[#DC2626]/15 border-[#DC2626]/60 text-[#FFFFFF]'
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
                          text: `${res.email || 'Google'} hesabı bağlandı!`,
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
                  className="py-2.5 px-3 rounded-xl bg-[#FFFFFF] hover:bg-[#F5F3EB] text-[#0B1220] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-60"
                >
                  <CloudCheck className="w-4 h-4 text-[#168A52] shrink-0" />
                  <span>{isGoogleLinking ? 'Bağlanıyor...' : 'Google ile Bağla'}</span>
                </button>
              )}
              <button
                type="button"
                data-testid="profile-email-link-btn"
                onClick={() => onOpenAuth('email')}
                className="py-2.5 px-3 rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-[#3B82F6]/45 text-[#FFFFFF] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
              >
                <Mail className="w-4 h-4 text-[#3B82F6] shrink-0" />
                <span>E-posta ile Giriş / Kayıt</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Coin Balance & Weekly League Points */}
        <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#A8B3C2]/15 text-center">
          <div className="p-3 rounded-2xl bg-[#0B1220] border border-[#E5B94F]/40">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#A8B3C2] block">
              Coin Bakiyesi
            </span>
            <span
              data-testid="profile-coins"
              className="mt-1 font-score font-extrabold text-xl text-[#E5B94F] flex items-center justify-center gap-1"
            >
              <CoinIcon size="sm" />
              {formatPoints(progression.coins)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#0B1220] border border-[#168A52]/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#A8B3C2] block">
              Haftalık Lig Puanı
            </span>
            <span
              data-testid="profile-weekly-points"
              className="mt-1 font-score font-extrabold text-xl text-[#22C55E] flex items-center justify-center gap-1"
            >
              <span>{leagueTier.icon}</span>
              <span>{formatPoints(progression.weeklyPoints)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Mağazaya Git Card (Quick access to full StoreModal + below direct items) */}
      {onOpenStore && (
        <button
          type="button"
          data-testid="profile-go-to-store-btn"
          onClick={() => onOpenStore('featured')}
          className="w-full p-4 rounded-3xl bg-gradient-to-r from-[#1A6B40] to-[#12462B] hover:from-[#1F7C4B] hover:to-[#155233] border-2 border-[#E5B94F]/65 flex items-center justify-between gap-3 text-left shadow-lg transition active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#0F273E] border border-[#E5B94F]/65 flex items-center justify-center text-[#E5B94F] shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-extrabold text-xl text-[#FFFFFF] uppercase leading-none">
                  Mağazaya Git
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#E5B94F] text-[#0D3822]">
                  TÜM ÖĞELER
                </span>
              </div>
              <span className="block text-[11px] text-[#F5F3EB]/85 mt-1 truncate">
                Kulüp armaları, çerçeveler, rozetler ve ünvanlar (Coin ile)
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#E5B94F] shrink-0" />
        </button>
      )}

      {/* Inline Store Status Banner */}
      {storeFeedback && (
        <div
          data-testid="profile-store-feedback"
          className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            storeFeedback.type === 'ok'
              ? 'bg-[#144D2F] border-[#4ADE80]/60 text-[#4ADE80]'
              : 'bg-[#C93B32]/20 border-[#C93B32]/70 text-[#FFFFFF]'
          }`}
        >
          {storeFeedback.type === 'err' && (
            <AlertTriangle className="w-4 h-4 text-[#F87171] shrink-0" />
          )}
          <span>{storeFeedback.text}</span>
        </div>
      )}

      {/* 5. Profil Çerçeveleri (Embedded Direct Store Section) */}
      <section
        data-testid="profile-frames-section"
        className="p-4 rounded-3xl bg-[#124029] border border-[#E5B94F]/30 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-extrabold text-xl text-[#FFFFFF] uppercase leading-none">
              Profil Çerçeveleri
            </h3>
            <p className="text-[11px] text-[#A8B3C2] mt-0.5">
              Kozmetik çerçeveler • Sahip olduklarını dilediğin zaman ücretsiz değiştir
            </p>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#0B1220] border border-[#E5B94F]/40 text-[#E5B94F] shrink-0">
            6 ÇERÇEVE
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {profileFrames.map((frameItem) => {
            const owned = progression.unlockedGiftIds.includes(frameItem.id);
            const selected = owned && progression.equippedFrame === frameItem.value;
            return (
              <div
                key={frameItem.id}
                data-testid={`profile-frame-card-${frameItem.id}`}
                className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 transition ${
                  selected
                    ? 'bg-[#183D2B]/70 border-[#22C55E]'
                    : owned
                    ? 'bg-[#0B1220] border-[#E5B94F]/40'
                    : 'bg-[#0B1220] border-[#A8B3C2]/15'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    avatar={activeAvatarId}
                    name={safeDisplayName}
                    size="sm"
                    variant="circle"
                    frame={frameItem.value}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block font-bold text-xs text-[#FFFFFF] truncate">
                      {frameItem.title.replace(' Çerçeve', '')}
                    </span>
                    <span className="block text-[10px] font-bold text-[#A8B3C2] mt-0.5">
                      {owned ? 'Sahip Olundu' : `${formatPoints(frameItem.costCoins)} Coin`}
                    </span>
                  </div>
                </div>

                {owned ? (
                  <button
                    type="button"
                    data-testid={`profile-frame-action-${frameItem.id}`}
                    disabled={selected}
                    onClick={() => handleBuyOrEquip(frameItem)}
                    className={`w-full py-2 px-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 transition ${
                      selected
                        ? 'bg-[#22C55E] text-[#0B1220] cursor-default'
                        : 'bg-[#16212E] hover:bg-[#1E293B] border border-[#E5B94F]/50 text-[#FFFFFF] cursor-pointer'
                    }`}
                  >
                    {selected ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Seçili</span>
                      </>
                    ) : (
                      <span>Kullan</span>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid={`profile-frame-action-${frameItem.id}`}
                    onClick={() => handleBuyOrEquip(frameItem)}
                    className="w-full py-2 px-2 rounded-xl bg-[#E5B94F] hover:bg-[#f0ca6b] text-[#0B1220] font-black text-[11px] flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                  >
                    <CoinIcon size="xs" />
                    <span>Satın Al • {formatPoints(frameItem.costCoins)}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Futbol Unvanları (Embedded Direct Cosmetic Titles) */}
      <section
        data-testid="profile-titles-section"
        className="p-4 rounded-3xl bg-[#124029] border border-[#E5B94F]/30 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-extrabold text-xl text-[#FFFFFF] uppercase leading-none flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-[#E5B94F]" />
              <span>Futbol Unvanları</span>
            </h3>
            <p className="text-[11px] text-[#A8B3C2] mt-0.5">
              Tamamen kozmetiktir • Lig rütbesi veya oyun içi yetki sağlamaz
            </p>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#0B1220] border border-[#E5B94F]/40 text-[#E5B94F] shrink-0">
            4 UNVAN
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {profileTitles.map((titleItem) => {
            const owned = progression.unlockedGiftIds.includes(titleItem.id);
            const selected = owned && progression.equippedTitle === titleItem.value;
            return (
              <div
                key={titleItem.id}
                data-testid={`profile-title-card-${titleItem.id}`}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  selected
                    ? 'bg-[#183D2B]/70 border-[#22C55E]'
                    : owned
                    ? 'bg-[#0B1220] border-[#E5B94F]/40'
                    : 'bg-[#0B1220] border-[#A8B3C2]/15'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm text-[#FFFFFF] truncate">
                      {titleItem.title}
                    </span>
                    {owned && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#16212E] text-[#22C55E] shrink-0">
                        Sahip Olundu
                      </span>
                    )}
                  </div>
                  <span className="block text-[10px] text-[#A8B3C2] mt-0.5 truncate">
                    {titleItem.description}
                  </span>
                </div>

                {owned ? (
                  <button
                    type="button"
                    data-testid={`profile-title-action-${titleItem.id}`}
                    disabled={selected}
                    onClick={() => handleBuyOrEquip(titleItem)}
                    className={`px-3 py-2 rounded-xl font-black text-[11px] shrink-0 transition ${
                      selected
                        ? 'bg-[#22C55E] text-[#0B1220] cursor-default'
                        : 'bg-[#16212E] hover:bg-[#1E293B] border border-[#E5B94F]/50 text-[#FFFFFF] cursor-pointer'
                    }`}
                  >
                    {selected ? 'Seçili ✓' : 'Kullan'}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid={`profile-title-action-${titleItem.id}`}
                    onClick={() => handleBuyOrEquip(titleItem)}
                    className="px-3 py-2 rounded-xl bg-[#E5B94F] hover:bg-[#f0ca6b] text-[#0B1220] font-black text-[11px] flex items-center gap-1 shrink-0 transition active:scale-95 cursor-pointer"
                  >
                    <CoinIcon size="xs" />
                    <span>Satın Al • {formatPoints(titleItem.costCoins)}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Reklamları Kaldır (Kapalı testte gerçek para satışı gizli; mevcut doğrulanmış VIP hakkı korunur) */}
      {adFreeItem && (isAdFreeOwned || isRealMoneyIapEnabled()) && (
        <section
          data-testid="profile-remove-ads-section"
          className="p-4 rounded-3xl bg-[#0F273E] border-2 border-[#E5B94F]/60 space-y-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#E5B94F]/15 border border-[#E5B94F]/60 text-[#E5B94F] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-display font-extrabold text-xl text-[#FFFFFF] uppercase leading-none">
                    Reklamları Kaldır
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#E5B94F] text-[#0B1220]">
                    VIP
                  </span>
                </div>
                <p className="text-[11px] text-[#A8B3C2] mt-1 leading-snug">
                  Zorunlu geçiş reklamlarını kalıcı olarak kaldırır; isteğe bağlı Reklam İzle &amp; 2x Katla ödüllerini beklemeden verir.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {isAdFreeOwned ? (
              <div
                data-testid="profile-ad-free-owned-badge"
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#183D2B] border border-[#22C55E] text-[#22C55E] font-black text-xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Sahip Olundu — Reklamlar Kalıcı Olarak Kaldırıldı</span>
              </div>
            ) : (
              <button
                type="button"
                data-testid="profile-ad-free-buy-btn"
                disabled={isPurchasingItem}
                onClick={() => setPendingConfirmItem({ item: adFreeItem, method: 'money' })}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#E5B94F] hover:bg-[#f0ca6b] text-[#0B1220] font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  Reklamları Kaldır •{' '}
                  {playPrices[adFreeItem.id]?.formattedPrice || formatTry(adFreeItem.priceTry)}
                </span>
              </button>
            )}

            {isRealMoneyIapEnabled() && onRestorePurchases && (
              <button
                type="button"
                data-testid="profile-restore-purchases-btn"
                disabled={isRestoringPurchases}
                onClick={async () => {
                  setIsRestoringPurchases(true);
                  try {
                    const res = await onRestorePurchases();
                    showStoreFeedback(res.ok ? 'ok' : 'err', res.message);
                  } finally {
                    setIsRestoringPurchases(false);
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-[#3B82F6]/45 text-[#FFFFFF] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#3B82F6] ${
                    isRestoringPurchases ? 'animate-spin' : ''
                  }`}
                />
                <span>Satın Alımları Geri Yükle</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* 8 & 9: Ayarlar & Çıkış Yap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {onOpenSettings && (
          <button
            type="button"
            data-testid="profile-settings-btn"
            onClick={onOpenSettings}
            className="py-3 px-4 rounded-2xl bg-[#124029] hover:bg-[#175034] border border-[#E5B94F]/35 text-[#FFFFFF] font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Settings className="w-4 h-4 text-[#E5B94F]" />
            <span>Ayarlar</span>
          </button>
        )}

        {(onSignOut || onExitApp) && (
          <button
            type="button"
            data-testid="profile-logout-btn"
            disabled={isSigningOut}
            onClick={async () => {
              if (onSignOut && connectedEmail) {
                setIsSigningOut(true);
                try {
                  await onSignOut();
                  setAccountLinkFeedback({
                    type: 'ok',
                    text: 'Bulut oturumu kapatıldı.',
                  });
                } finally {
                  setIsSigningOut(false);
                }
              } else {
                onExitApp?.();
              }
            }}
            className="py-3 px-4 rounded-2xl bg-[#0F273E] hover:bg-[#163654] border border-white/20 text-[#F5F3EB] font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-60"
          >
            <LogOut className="w-4 h-4 text-[#C4D6CA]" />
            <span>
              {isSigningOut
                ? 'Çıkış yapılıyor...'
                : onSignOut && connectedEmail
                ? 'Hesaptan Çıkış Yap'
                : 'Çıkış Yap'}
            </span>
          </button>
        )}
      </div>

      {/* 10. Hesabımı ve Verilerimi Sil */}
      {onDeleteAccount && (
        <div className="p-3.5 rounded-2xl bg-[#0F273E] border border-[#C93B32]/55 space-y-2.5">
          {!confirmDeleteAccount ? (
            <button
              type="button"
              data-testid="profile-delete-account-btn"
              onClick={() => setConfirmDeleteAccount(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#C93B32]/18 hover:bg-[#C93B32]/30 border border-[#C93B32]/65 text-[#FFFFFF] font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Trash2 className="w-4 h-4 text-[#F87171]" />
              <span>Hesabımı ve Verilerimi Sil</span>
            </button>
          ) : (
            <div data-testid="profile-delete-confirm-box" className="space-y-2.5 text-center">
              <p className="text-xs font-bold text-[#FFFFFF]">
                Bu işlem geri alınamaz! Bulut yedeğin, coinlerin ve yerel ilerlemen silinecek.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAccount(false)}
                  disabled={isDeletingAccount}
                  className="flex-1 py-2.5 rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-[#A8B3C2]/25 text-[#A8B3C2] font-bold text-xs cursor-pointer"
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
                  className="flex-1 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#b91c1c] text-[#FFFFFF] font-black text-xs cursor-pointer disabled:opacity-60"
                >
                  {isDeletingAccount ? 'Siliniyor...' : 'Kalıcı Olarak Sil'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Popup for Store Purchases in Profile */}
      {pendingConfirmItem && (
        <div
          data-testid="profile-purchase-confirm-modal"
          className="fixed inset-0 z-[70] bg-[#0B1220]/90 flex items-center justify-center p-4 animate-screen-fade"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#16212E] border border-[#E5B94F]/55 p-5 shadow-2xl text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#E5B94F]">
              SATIN ALMA ONAYI
            </span>
            <h4 className="font-display font-extrabold text-2xl text-[#FFFFFF] mt-1 uppercase">
              {pendingConfirmItem.item.title}
            </h4>
            <p className="text-xs sm:text-sm text-[#A8B3C2] mt-2 leading-relaxed">
              {pendingConfirmItem.method === 'coins' ? (
                <>
                  <strong className="text-[#FFFFFF]">{pendingConfirmItem.item.title}</strong>{' '}
                  ürününü{' '}
                  <strong className="text-[#E5B94F]">
                    {formatPoints(pendingConfirmItem.item.costCoins)} Coin
                  </strong>{' '}
                  karşılığında açmak istiyor musun?
                </>
              ) : (
                <>
                  <strong className="text-[#FFFFFF]">{pendingConfirmItem.item.title}</strong>{' '}
                  (
                  {playPrices[pendingConfirmItem.item.id]?.formattedPrice ||
                    formatTry(pendingConfirmItem.item.priceTry)}
                  ) Google Play üzerinden açılsın mı?
                </>
              )}
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                data-testid="profile-purchase-cancel-btn"
                disabled={isPurchasingItem}
                onClick={() => setPendingConfirmItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#0B1220] hover:bg-[#1E293B] border border-[#A8B3C2]/25 text-[#F5F3EB] font-bold text-xs cursor-pointer disabled:opacity-60"
              >
                Vazgeç
              </button>
              <button
                type="button"
                data-testid="profile-purchase-confirm-btn"
                disabled={isPurchasingItem}
                onClick={() => {
                  void executeConfirmedPurchase();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#168A52] hover:bg-[#22C55E] text-[#FFFFFF] font-black text-xs cursor-pointer disabled:opacity-60"
              >
                {isPurchasingItem ? 'İşleniyor...' : 'Satın Al'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
