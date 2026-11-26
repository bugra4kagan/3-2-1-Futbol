import React, { useState } from 'react';
import {
  BookOpen,
  CloudCheck,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  LogOut,
  MailCheck,
  Palette,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { SocialProvider, UserProgression } from '../game/types';
import { SOCIAL_LINK_BONUS_COINS } from '../game/retentionEngine';
import { LANGUAGE_OPTIONS } from '../game/i18n';
import { UiTheme } from '../game/themeEngine';
import { useLanguage } from '../game/LanguageContext';
import { sounds } from '../utils/audio';
import { haptics, isHapticsEnabled, setHapticsEnabled } from '../utils/haptics';
import { GameLogoAppIconPreview } from './GameLogo';

export interface CloudUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  isMuted: boolean;
  uiTheme?: UiTheme;
  progression: UserProgression;
  cloudUser?: CloudUserSummary | null;
  isSyncingCloud?: boolean;
  onToggleMute: () => void;
  onToggleTheme?: () => void;
  onGoogleSignIn?: () => Promise<{
    ok: boolean;
    error?: string;
    bonusCoinsAwarded?: number;
    email?: string;
  }>;
  onGoogleSignOut?: () => Promise<void>;
  onSyncCloudNow?: () => Promise<boolean>;
  onSendVerificationEmail?: () => Promise<{ ok: boolean; message: string }>;
  onRestorePurchases?: () => Promise<{ ok: boolean; message: string }>;
  onDeleteAccount?: () => Promise<{ ok: boolean; warning?: string }>;
  onUnlinkSocial: (provider: SocialProvider) => void;
  onOpenTutorial?: () => void;
  onExitApp?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  isMuted,
  uiTheme = 'modern',
  progression,
  cloudUser = null,
  isSyncingCloud = false,
  onToggleMute,
  onToggleTheme,
  onGoogleSignIn,
  onGoogleSignOut,
  onSyncCloudNow,
  onSendVerificationEmail,
  onRestorePurchases,
  onDeleteAccount,
  onUnlinkSocial,
  onOpenTutorial,
  onExitApp,
  onClose,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [busyProvider, setBusyProvider] = useState<'google' | null>(null);
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => isHapticsEnabled());
  const [restoreFeedback, setRestoreFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSendingVerify, setIsSendingVerify] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [socialFeedback, setSocialFeedback] = useState<{
    type: 'ok' | 'err' | 'info';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const linkedAccounts = progression.linkedAccounts ?? [];
  const linkedGoogle = linkedAccounts.find((a) => a.provider === 'google');

  const handleSoundToggle = () => {
    const wasMuted = isMuted;
    onToggleMute();
    if (wasMuted) {
      setTimeout(() => sounds.playCorrect(), 40);
    }
  };

  const handleGoogleConnect = async () => {
    if (!onGoogleSignIn) return;
    setBusyProvider('google');
    setSocialFeedback(null);
    try {
      const res = await onGoogleSignIn();
      if (res.ok) {
        sounds.playVictory();
        setSocialFeedback({
          type: 'ok',
          text:
            res.bonusCoinsAwarded && res.bonusCoinsAwarded > 0
              ? `Google Play hesabın (${res.email || 'Doğrulandı'}) bağlandı ve buluta yedeklendi! +${res.bonusCoinsAwarded} Coin eklendi.`
              : `Google Play bulut yedeklemesi aktif (${res.email || 'Doğrulandı'})!`,
        });
      } else {
        sounds.playWrong();
        setSocialFeedback({
          type: 'err',
          text: res.error || 'Google Play ile giriş tamamlanamadı.',
        });
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const handleGoogleDisconnect = async () => {
    setBusyProvider('google');
    try {
      if (onGoogleSignOut) {
        await onGoogleSignOut();
      } else {
        onUnlinkSocial('google');
      }
      setSocialFeedback({
        type: 'info',
        text: 'Google Play bulut oturumu kapatıldı.',
      });
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div
      data-testid="settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#092316]/88 overflow-y-auto animate-screen-fade"
    >
      <div className="relative w-full max-w-lg bg-[#124029] border-2 border-[#E5B94F]/45 rounded-3xl p-4 sm:p-6 shadow-2xl text-left my-auto max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/15 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#168A52] border border-[#4ADE80]/50 text-white flex items-center justify-center shadow-lg shrink-0">
              <Settings className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-black text-[#F5F3EB] leading-tight truncate uppercase">
                {t('settings')}
              </h2>
              <p className="text-[11px] text-[#C4D6CA] font-medium truncate">
                {t('settingsSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="settings-close-btn"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-[#0F273E] hover:bg-[#173857] border border-white/15 text-[#C4D6CA] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-4 pr-0.5">
          {/* App Brand & Store Icon Preview */}
          <section
            data-testid="settings-brand-preview"
            className="p-3.5 rounded-2xl bg-[#0F273E] border border-[#E5B94F]/35 flex items-center justify-between gap-3"
          >
            <GameLogoAppIconPreview />
          </section>

          {/* 1. Sound On/Off */}
          <section className="p-3.5 rounded-2xl bg-[#0E3120] border border-white/15 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  isMuted
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                }`}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-black text-white">
                  {t('soundSectionTitle')}
                </span>
                <span className="block text-[11px] text-slate-400 leading-snug">
                  {isMuted ? t('soundOffDesc') : t('soundOnDesc')}
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="settings-sound-toggle"
              aria-pressed={!isMuted}
              onClick={handleSoundToggle}
              className={`px-3.5 py-2 rounded-xl border text-xs font-black transition cursor-pointer shrink-0 active:scale-95 ${
                isMuted
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/50 text-rose-200'
                  : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 text-slate-950 shadow-md shadow-emerald-500/20'
              }`}
            >
              {isMuted ? t('soundOffLabel') : t('soundOnLabel')}
            </button>
          </section>

          {/* 1.6 Haptic Vibration Toggle */}
          <section className="p-3.5 rounded-2xl bg-slate-950/85 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  hapticsOn
                    ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-black text-white">
                  Titreşim
                </span>
                <span className="block text-[11px] text-slate-400 leading-snug">
                  {hapticsOn
                    ? 'Doğru/yanlış cevap, geri sayım ve galibiyette titreşim açık.'
                    : 'Dokunsal titreşim geri bildirimi kapalı.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="settings-haptics-toggle"
              aria-pressed={hapticsOn}
              onClick={() => {
                const next = !hapticsOn;
                setHapticsEnabled(next);
                setHapticsOn(next);
                if (next) {
                  haptics.tap();
                }
              }}
              className={`px-3.5 py-2 rounded-xl border text-xs font-black transition cursor-pointer shrink-0 active:scale-95 ${
                hapticsOn
                  ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {hapticsOn ? 'Açık' : 'Kapalı'}
            </button>
          </section>

          {/* 1.75 Interactive Onboarding Tutorial Re-open Button */}
          {onOpenTutorial && (
            <section className="p-3.5 rounded-2xl bg-slate-950/85 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-400 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-black text-white">
                    {t('tutorialHowToPlayBtn')}
                  </span>
                  <span className="block text-[11px] text-slate-400 leading-snug">
                    {t('tutorialStep1Title')} · {t('tutorialStep2Title')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                data-testid="settings-open-tutorial-btn"
                onClick={() => {
                  sounds.playCorrect();
                  onOpenTutorial();
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 text-xs font-black transition cursor-pointer shrink-0 active:scale-95"
              >
                {t('tutorialStart')}
              </button>
            </section>
          )}

          {/* 2. Language Selector */}
          <section className="p-3.5 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-black text-white leading-tight">
                  {t('languageSectionTitle')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {t('languageSectionDesc')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LANGUAGE_OPTIONS.map((opt) => {
                const active = language === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`settings-lang-${opt.id}`}
                    aria-pressed={active}
                    onClick={() => {
                      sounds.playCorrect();
                      setLanguage(opt.id);
                    }}
                    className={`px-2.5 py-2 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span className="text-sm leading-none">{opt.flag}</span>
                    <span>{opt.nativeName}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Official Social Auth & Cloud Backup */}
          <section
            data-testid="settings-social-section"
            className="p-3.5 rounded-2xl bg-slate-950/85 border border-sky-500/35 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-4 h-4 text-sky-400 shrink-0" />
                <h3 className="text-sm font-black text-white truncate">
                  {t('socialSectionTitle')}
                </h3>
              </div>
              {cloudUser || linkedAccounts.length > 0 ? (
                <span
                  data-testid="settings-social-safe-badge"
                  className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-black flex items-center gap-1 shrink-0"
                >
                  <ShieldCheck className="w-3 h-3" />
                  {t('socialSafeBadge')}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black shrink-0">
                  +{SOCIAL_LINK_BONUS_COINS} Coin
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
              {t('socialSectionDesc')}
            </p>

            {socialFeedback && (
              <div
                data-testid="settings-social-feedback"
                className={`px-3 py-2.5 rounded-xl border text-xs font-bold ${
                  socialFeedback.type === 'ok'
                    ? 'bg-emerald-950/80 border-emerald-400/50 text-emerald-300'
                    : socialFeedback.type === 'info'
                    ? 'bg-sky-950/80 border-sky-400/40 text-sky-200'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                }`}
              >
                <p>{socialFeedback.text}</p>
              </div>
            )}

            {/* Official Google Play / Google Account Sign-In & Firestore Cloud Backup Card */}
            <div
              data-testid="settings-google-auth-card"
              className={`p-3 rounded-2xl border space-y-2 ${
                cloudUser || linkedGoogle
                  ? 'bg-emerald-950/35 border-emerald-400/50'
                  : 'bg-slate-900/95 border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-400 to-sky-500 text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow">
                    ▶
                  </span>
                  <div className="min-w-0">
                    <span className="block text-xs font-black text-white">
                      Google Play / Google Hesabı &amp; Bulut Yedekleme
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {cloudUser?.email || linkedGoogle?.handle || t('socialNotLinked')}
                    </span>
                  </div>
                </div>

                {cloudUser ? (
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {!cloudUser.emailVerified && onSendVerificationEmail && (
                      <button
                        type="button"
                        data-testid="settings-send-verify-email-btn"
                        disabled={isSendingVerify}
                        onClick={async () => {
                          setIsSendingVerify(true);
                          try {
                            const res = await onSendVerificationEmail();
                            setSocialFeedback({
                              type: res.ok ? 'ok' : 'err',
                              text: res.message,
                            });
                          } finally {
                            setIsSendingVerify(false);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-[10px] font-black text-amber-200 flex items-center gap-1 cursor-pointer disabled:opacity-60"
                      >
                        <MailCheck className="w-3 h-3" />
                        <span>{isSendingVerify ? 'Gönderiliyor...' : 'E-posta Doğrulama Gönder'}</span>
                      </button>
                    )}
                    {onSyncCloudNow && (
                      <button
                        type="button"
                        data-testid="settings-cloud-sync-btn"
                        disabled={isSyncingCloud}
                        onClick={async () => {
                          const ok = await onSyncCloudNow();
                          setSocialFeedback({
                            type: ok ? 'ok' : 'err',
                            text: ok
                              ? 'Tüm coin, puan ve eşyaların buluta senkronize edildi!'
                              : 'Bulut senkronizasyonu tamamlanamadı.',
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-[10px] font-black text-emerald-200 flex items-center gap-1 cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                        <span>Yedekle</span>
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="settings-unlink-social-google"
                      disabled={busyProvider === 'google'}
                      onClick={handleGoogleDisconnect}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/70 text-[10px] font-bold text-slate-300 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Çıkış</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="settings-link-social-google"
                    disabled={busyProvider === 'google'}
                    onClick={handleGoogleConnect}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-black text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow transition active:scale-95 disabled:opacity-60"
                  >
                    {busyProvider === 'google' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>Google ile Giriş Yap / Hesabı Bağla</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 5. Restore Purchases & Privacy Links */}
          <section className="p-3.5 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-2.5">
            {onRestorePurchases && (
              <button
                type="button"
                data-testid="settings-restore-purchases-btn"
                disabled={isRestoring}
                onClick={async () => {
                  setIsRestoring(true);
                  setRestoreFeedback(null);
                  try {
                    const res = await onRestorePurchases();
                    setRestoreFeedback({
                      type: res.ok ? 'ok' : 'err',
                      text: res.message,
                    });
                  } finally {
                    setIsRestoring(false);
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/40 text-amber-200 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60"
              >
                {isRestoring ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Satın Alımları Geri Yükle</span>
              </button>
            )}

            {restoreFeedback && (
              <p
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                  restoreFeedback.type === 'ok'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                {restoreFeedback.text}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <a
                href="./gizlilik.html"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="settings-privacy-link"
                className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-emerald-300 flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Gizlilik Politikası</span>
                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
              </a>
              <a
                href="./hesap-sil.html"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="settings-web-delete-link"
                className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-rose-300 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Web Veri Silme</span>
                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
              </a>
            </div>
            <p className="text-[11px] text-slate-400 text-center pt-0.5">
              Destek &amp; İletişim:{' '}
              <a
                href="mailto:321futboloyunu@gmail.com"
                className="text-emerald-300 hover:underline font-bold"
              >
                321futboloyunu@gmail.com
              </a>
            </p>
          </section>

          {/* 6. Permanent Account & Data Deletion (Google Play Data Safety) */}
          {onDeleteAccount && (
            <section className="p-3.5 rounded-2xl bg-[#0F273E] border border-[#C93B32]/55 space-y-2.5">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  data-testid="settings-delete-account-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#C93B32]/20 hover:bg-[#C93B32]/35 border border-[#C93B32]/65 text-[#F5F3EB] font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <Trash2 className="w-4 h-4 text-[#F87171]" />
                  <span>Hesabımı ve Verilerimi Sil</span>
                </button>
              ) : (
                <div data-testid="settings-delete-confirm-box" className="space-y-2.5 text-center">
                  <p className="text-xs font-black text-[#F5F3EB]">
                    Tüm bulut verilerin, coinlerin, istatistiklerin ve yerel ilerlemen kalıcı olarak silinecek!
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeletingAccount}
                      className="flex-1 py-2 rounded-xl bg-[#0E3120] hover:bg-[#14472D] border border-white/15 text-[#F5F3EB] font-bold text-xs cursor-pointer"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      data-testid="settings-confirm-delete-account-btn"
                      disabled={isDeletingAccount}
                      onClick={async () => {
                        setIsDeletingAccount(true);
                        try {
                          await onDeleteAccount();
                          onClose();
                        } finally {
                          setIsDeletingAccount(false);
                          setShowDeleteConfirm(false);
                        }
                      }}
                      className="flex-1 py-2 rounded-xl bg-[#C93B32] hover:bg-[#B22F27] text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {isDeletingAccount ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Kalıcı Olarak Sil</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {onExitApp && (
            <button
              type="button"
              data-testid="settings-exit-app-btn"
              onClick={() => {
                onClose();
                onExitApp();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-[#C93B32]/18 hover:bg-[#C93B32]/30 border border-[#C93B32]/60 text-[#F5F3EB] font-black text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer touch-manipulation"
            >
              <LogOut className="w-4 h-4 text-[#F87171]" />
              <span>Ana Giriş Ekranına Dön (Çıkış)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
