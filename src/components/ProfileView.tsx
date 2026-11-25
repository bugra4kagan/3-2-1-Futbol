import React, { useState } from 'react';
import {
  Settings,
  Edit3,
  Trash2,
  ShieldCheck,
  CloudCheck,
  Mail,
  ShoppingBag,
  AlertTriangle,
  LogOut,
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
import { getCrestBadgeInfo } from '../game/storeCatalog';
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
  ) => { ok: boolean; reason?: string; gift?: ShopGiftItem };
  onOpenStore?: (category?: StoreCategory) => void;
  onEquipItem?: (itemId: string) => { ok: boolean; reason?: string };
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
  onDeleteAccount,
  onExitApp,
}) => {
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isGoogleLinking, setIsGoogleLinking] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [accountLinkFeedback, setAccountLinkFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
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

  return (
    <div
      data-testid="profile-view"
      className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-3 pb-24 flex flex-col gap-3.5 text-left text-[#F2ECD9]"
    >
      {/* Rename warning when legacy name violates current filter */}
      {needsUsernameRename && (
        <div
          data-testid="profile-rename-required-banner"
          className="p-3.5 rounded-2xl bg-red-950/75 border border-[#EF4444]/60 flex items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-black text-[#F2ECD9]">
                Yeni kullanıcı adı seçmen gerekiyor
              </p>
              <p className="text-[11px] text-[#A8B6A5]">
                Mevcut kullanıcı adın kurallarımıza uygun olmadığı için gizlendi. Puan ve coinlerin güvende!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenAuth('profile')}
            className="px-3 py-1.5 rounded-xl bg-[#3C8052] hover:bg-[#499863] text-[#F2ECD9] font-black text-xs shrink-0 cursor-pointer"
          >
            Ad Seç
          </button>
        </div>
      )}

      {/* Main Profile Identity Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#244632] border border-[#D9B76B]/35 space-y-4 shadow-lg">
        <div className="flex items-center justify-between gap-3">
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
                <h2 className="font-display font-extrabold text-xl sm:text-2xl text-[#F2ECD9] truncate leading-none">
                  {safeDisplayName}
                </h2>
                {progression.equippedBadge && (
                  <span className="text-base shrink-0" title="Profil Rozeti">
                    {progression.equippedBadge}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span
                  data-testid="profile-friend-code"
                  className="text-xs text-[#A8B6A5]"
                >
                  Kod:{' '}
                  <strong className="font-mono text-[#F2ECD9]">
                    {progression.friendCode}
                  </strong>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#183022] border border-[#3C8052]/60 text-[#A8B6A5]">
                  {getProfileIconLabel(activeAvatarId)}
                </span>
                {progression.equippedTitle && (
                  <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#183022] border border-[#D9B76B]/45 text-[#D9B76B]">
                    {progression.equippedTitle}
                  </span>
                )}
              </div>

              {userClub && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-[#D9B76B]">
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
            className="px-3.5 py-2 rounded-xl bg-[#183022] hover:bg-[#3C8052]/40 border border-[#D9B76B]/50 text-xs font-black text-[#F2ECD9] flex items-center gap-1.5 shrink-0 cursor-pointer transition active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#D9B76B]" />
            <span>Profil Düzenle</span>
          </button>
        </div>

        {/* Account Security & Cloud Linking */}
        {connectedEmail ? (
          <div
            data-testid="profile-linked-account-card"
            className="pt-3 border-t border-[#F2ECD9]/12 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <span
                data-testid="profile-safe-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#183022] border border-[#3C8052] text-[11px] font-black text-[#F2ECD9] whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#D9B76B] shrink-0" />
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
                className="block mt-1 text-[11px] font-semibold text-[#A8B6A5] truncate"
              >
                {connectedEmail}
              </span>
            </div>
          </div>
        ) : (
          <div
            data-testid="profile-guest-link-card"
            className="pt-3 border-t border-[#F2ECD9]/12 space-y-2"
          >
            <p className="text-[11px] text-[#A8B6A5] font-semibold">
              Hesabını bağlayarak coin ve lig puanlarını bulutta koru:
            </p>
            {accountLinkFeedback && (
              <p
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                  accountLinkFeedback.type === 'ok'
                    ? 'bg-[#183022] border-[#3C8052] text-[#F2ECD9]'
                    : 'bg-red-950/70 border-[#EF4444]/50 text-[#FCA5A5]'
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
                  className="py-2.5 px-3 rounded-xl bg-[#F2ECD9] hover:bg-white text-[#101C16] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-60"
                >
                  <CloudCheck className="w-4 h-4 text-[#3C8052] shrink-0" />
                  <span>{isGoogleLinking ? 'Bağlanıyor...' : 'Google ile Bağla'}</span>
                </button>
              )}
              <button
                type="button"
                data-testid="profile-email-link-btn"
                onClick={() => onOpenAuth('email')}
                className="py-2.5 px-3 rounded-xl bg-[#183022] hover:bg-[#101C16] border border-[#F2ECD9]/20 text-[#F2ECD9] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
              >
                <Mail className="w-4 h-4 text-[#D9B76B] shrink-0" />
                <span>E-posta ile Giriş / Kayıt</span>
              </button>
            </div>
          </div>
        )}

        {/* Essential Balance & Weekly League Points Strip */}
        <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[#F2ECD9]/12 text-center">
          <div className="p-3 rounded-2xl bg-[#183022] border border-[#D9B76B]/30">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#A8B6A5] block">
              Coin Bakiyesi
            </span>
            <span
              data-testid="profile-coins"
              className="mt-1 font-mono font-black text-base text-[#D9B76B] flex items-center justify-center gap-1"
            >
              <CoinIcon size="sm" />
              {formatPoints(progression.coins)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#183022] border border-[#3C8052]/50">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#A8B6A5] block">
              Haftalık Lig Puanı
            </span>
            <span
              data-testid="profile-weekly-points"
              className="mt-1 font-mono font-black text-base text-[#F2ECD9] flex items-center justify-center gap-1"
            >
              <span>{leagueTier.icon}</span>
              <span>{formatPoints(progression.weeklyPoints)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Full-Width Featured Store Card (Only Store Entry Point in App) */}
      {onOpenStore && (
        <button
          type="button"
          data-testid="profile-open-store-btn"
          onClick={() => onOpenStore('featured')}
          className="w-full p-4 rounded-3xl bg-[#244632] hover:bg-[#2a523b] border-2 border-[#D9B76B]/65 text-left flex items-center justify-between gap-3 cursor-pointer transition active:scale-[0.99] shadow-lg group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#D9B76B] text-[#101C16] flex items-center justify-center shrink-0 shadow">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-xl text-[#F2ECD9] leading-none">
                  Mağazaya Git
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-[#183022] border border-[#D9B76B]/50 text-[#D9B76B]">
                  MAĞAZA
                </span>
              </div>
              <span className="block text-xs text-[#A8B6A5] mt-1 truncate">
                Arma, çerçeve, rozet ve ünvanları coinlerinle keşfet.
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#D9B76B] shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Settings & Sign Out Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {onOpenSettings && (
          <button
            type="button"
            data-testid="profile-settings-btn"
            onClick={onOpenSettings}
            className="py-3 px-4 rounded-2xl bg-[#244632] hover:bg-[#2a523b] border border-[#3C8052]/60 text-[#F2ECD9] font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Settings className="w-4 h-4 text-[#D9B76B]" />
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
            className="py-3 px-4 rounded-2xl bg-[#244632] hover:bg-[#183022] border border-[#F2ECD9]/20 text-[#F2ECD9] font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-60"
          >
            <LogOut className="w-4 h-4 text-[#A8B6A5]" />
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

      {/* Account Deletion */}
      {onDeleteAccount && (
        <div className="p-3.5 rounded-2xl bg-[#183022] border border-[#EF4444]/30 space-y-2.5">
          {!confirmDeleteAccount ? (
            <button
              type="button"
              data-testid="profile-delete-account-btn"
              onClick={() => setConfirmDeleteAccount(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-red-950/50 hover:bg-red-950/80 border border-[#EF4444]/45 text-[#FCA5A5] font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hesabımı ve Verilerimi Sil</span>
            </button>
          ) : (
            <div data-testid="profile-delete-confirm-box" className="space-y-2.5 text-center">
              <p className="text-xs font-bold text-[#F2ECD9]">
                Bu işlem geri alınamaz! Bulut yedeğin, coinlerin ve yerel ilerlemen silinecek.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAccount(false)}
                  disabled={isDeletingAccount}
                  className="flex-1 py-2 rounded-xl bg-[#244632] hover:bg-[#101C16] text-[#A8B6A5] font-bold text-xs cursor-pointer"
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
                  className="flex-1 py-2 rounded-xl bg-[#EF4444] hover:bg-red-500 text-white font-black text-xs cursor-pointer disabled:opacity-60"
                >
                  {isDeletingAccount ? 'Siliniyor...' : 'Kalıcı Olarak Sil'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
