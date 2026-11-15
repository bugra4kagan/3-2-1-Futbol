import React, { useState } from 'react';
import {
  Globe,
  Link2,
  Settings,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { SocialProvider, UserProgression } from '../game/types';
import { SOCIAL_LINK_BONUS_COINS } from '../game/retentionEngine';
import { LANGUAGE_OPTIONS } from '../game/i18n';
import { useLanguage } from '../game/LanguageContext';
import { sounds } from '../utils/audio';

interface SettingsModalProps {
  isOpen: boolean;
  isMuted: boolean;
  progression: UserProgression;
  onToggleMute: () => void;
  onLinkSocial: (
    provider: SocialProvider,
    handle: string
  ) => { ok: boolean; error?: string; bonusCoinsAwarded?: number };
  onUnlinkSocial: (provider: SocialProvider) => void;
  onClose: () => void;
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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  isMuted,
  progression,
  onToggleMute,
  onLinkSocial,
  onUnlinkSocial,
  onClose,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [linkingProvider, setLinkingProvider] = useState<SocialProvider | null>(null);
  const [socialHandle, setSocialHandle] = useState('');
  const [socialFeedback, setSocialFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const linkedAccounts = progression.linkedAccounts ?? [];

  const handleSoundToggle = () => {
    const wasMuted = isMuted;
    onToggleMute();
    if (wasMuted) {
      setTimeout(() => sounds.playCorrect(), 40);
    }
  };

  const handleSocialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingProvider) return;
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
    setTimeout(() => setSocialFeedback(null), 3200);
  };

  return (
    <div
      data-testid="settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto animate-screen-fade"
    >
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl text-left my-auto max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
              <Settings className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-white leading-tight truncate">
                {t('settings')}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {t('settingsSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="settings-close-btn"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-4 pr-0.5">
          {/* 1. Sound On/Off */}
          <section className="p-3.5 rounded-2xl bg-slate-950/85 border border-slate-800 flex items-center justify-between gap-3">
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

          {/* 3. Social Media Account Linking */}
          <section
            data-testid="settings-social-section"
            className="p-3.5 rounded-2xl bg-slate-950/85 border border-sky-500/35 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-4 h-4 text-sky-400 shrink-0" />
                <h3 className="text-sm font-black text-white truncate">
                  {t('socialSectionTitle')}
                </h3>
              </div>
              {linkedAccounts.length > 0 ? (
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
                className={`px-3 py-2 rounded-xl border text-xs font-bold ${
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
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{sp.icon}</span>
                      <div className="min-w-0">
                        <span className="block text-xs font-black text-white truncate">
                          {sp.label}
                        </span>
                        <span className="block text-[10px] text-slate-400 truncate">
                          {linked ? linked.handle : t('socialNotLinked')}
                        </span>
                      </div>
                    </div>

                    {linked ? (
                      <button
                        type="button"
                        data-testid={`settings-unlink-social-${sp.id}`}
                        onClick={() => onUnlinkSocial(sp.id)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/70 text-[10px] font-bold text-slate-300 hover:text-rose-300 shrink-0 cursor-pointer"
                      >
                        {t('socialUnlinkBtn')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-testid={`settings-link-social-${sp.id}`}
                        onClick={() => {
                          setLinkingProvider(sp.id);
                          setSocialHandle('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-[10px] font-black text-sky-200 shrink-0 cursor-pointer"
                      >
                        {t('socialLinkBtn')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {linkingProvider && (
              <form
                onSubmit={handleSocialSubmit}
                data-testid="settings-social-form"
                className="mt-2 p-3 rounded-2xl bg-slate-900 border border-sky-400/40 flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  data-testid="settings-social-handle-input"
                  required
                  maxLength={40}
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  placeholder={
                    SOCIAL_PROVIDERS.find((p) => p.id === linkingProvider)?.placeholder ||
                    'Kullanıcı adı veya e-posta'
                  }
                  className="flex-1 bg-slate-950 text-white text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 focus:border-sky-400 outline-none"
                />
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    data-testid="settings-social-handle-submit"
                    className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    {t('socialConfirmBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkingProvider(null)}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
