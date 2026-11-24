import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCheck,
  Sparkles,
  Check,
  Lock,
  Search,
  Shield,
  Dices,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  CloudCheck,
  Mail,
  MailCheck,
  LogIn,
} from 'lucide-react';
import { CLUBS } from '../game/database';
import { PlayerProfile, UserProgression } from '../game/types';
import {
  DEFAULT_STARTER_AVATAR,
  FREE_ICON_AVATARS,
  FREE_STARTER_PLAYER_AVATARS,
  STAR_PP_AVATARS,
  isPhotoAvatar,
} from '../game/avatarCatalog';
import { isAnimeAvatar } from '../game/animeAvatarCatalog';
import { useLanguage } from '../game/LanguageContext';
import { AnimeAvatarBuilder } from './AnimeAvatarBuilder';
import { CoinIcon } from './CoinIcon';
import { formatPoints } from '../game/retentionEngine';
import {
  generateRandomUniqueStarterName,
  validateUsernameFormat,
} from '../game/accountEngine';
import {
  auth,
  checkUsernameAvailabilityInFirestore,
  claimUsernameInFirestore,
  mapFirebaseAuthErrorToTurkish,
  sendPasswordResetForEmail,
  sendVerificationEmailToCurrentUser,
  signInWithEmail,
  signUpWithEmail,
} from '../firebase';
import { sounds } from '../utils/audio';
import { PlayerAvatar } from './PlayerAvatar';
import { ClubBadge } from './ClubBadge';

interface AuthModalProps {
  currentProfile: PlayerProfile;
  progression?: UserProgression;
  googleUid?: string | null;
  initialTab?: 'profile' | 'email';
  onSaveProfile: (profile: PlayerProfile) => void;
  onGoogleSignIn?: () => Promise<{
    ok: boolean;
    bonusCoinsAwarded?: number;
    email?: string;
    error?: string;
  }>;
  onPurchaseGift?: (giftId: string) => { ok: boolean; reason?: string };
  onClose?: () => void;
  isInitialRequired?: boolean;
}

const ALL_CLUBS = Object.values(CLUBS).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

export const AuthModal: React.FC<AuthModalProps> = ({
  currentProfile,
  progression,
  googleUid = null,
  initialTab = 'profile',
  onSaveProfile,
  onGoogleSignIn,
  onPurchaseGift,
  onClose,
  isInitialRequired = false,
}) => {
  const initialIsGeneric =
    !currentProfile.name || currentProfile.name.trim() === 'Futbol Gurmesi';
  const [modalMode, setModalMode] = useState<'profile' | 'email'>(initialTab);
  const [emailAuthAction, setEmailAuthAction] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailAuthBusy, setEmailAuthBusy] = useState(false);
  const [emailAuthFeedback, setEmailAuthFeedback] = useState<{
    type: 'ok' | 'err' | 'info';
    text: string;
  } | null>(null);
  const [name, setName] = useState(
    isInitialRequired && initialIsGeneric ? '' : initialIsGeneric ? '' : currentProfile.name
  );
  const [avatar, setAvatar] = useState(
    currentProfile.avatar || DEFAULT_STARTER_AVATAR
  );
  const [favoriteClubId, setFavoriteClubId] = useState(
    currentProfile.favoriteClubId || 'galatasaray'
  );
  const [clubSearch, setClubSearch] = useState('');
  const [showClubPicker, setShowClubPicker] = useState(false);
  const { t } = useLanguage();
  const [avatarTab, setAvatarTab] = useState<'anime' | 'pp' | 'emoji'>(
    isAnimeAvatar(currentProfile.avatar)
      ? 'anime'
      : STAR_PP_AVATARS.some((s) => s.avatarValue === currentProfile.avatar)
      ? 'pp'
      : 'anime'
  );
  const [ppFeedback, setPpFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Username uniqueness state
  const [nameCheckState, setNameCheckState] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const unlockedSet = useMemo(
    () => new Set(progression?.unlockedGiftIds || []),
    [progression?.unlockedGiftIds]
  );
  const coins = progression?.coins ?? 0;

  const selectedClub = CLUBS[favoriteClubId] || CLUBS.galatasaray;

  const filteredClubs = useMemo(() => {
    const q = clubSearch.trim().toLocaleLowerCase('tr');
    if (!q) return ALL_CLUBS;
    return ALL_CLUBS.filter(
      (c) =>
        c.name.toLocaleLowerCase('tr').includes(q) ||
        c.shortName.toLocaleLowerCase('tr').includes(q) ||
        c.country.toLocaleLowerCase('tr').includes(q)
    );
  }, [clubSearch]);

  // Debounced live username uniqueness check (server + Firestore)
  useEffect(() => {
    if (modalMode !== 'profile') return;
    const raw = name.trim();
    if (!raw) {
      setNameCheckState('idle');
      setNameError(null);
      setNameSuggestions([]);
      return;
    }

    const fmt = validateUsernameFormat(raw);
    if (!fmt.ok) {
      setNameCheckState('invalid');
      setNameError(fmt.reason || 'Geçersiz kullanıcı adı.');
      setNameSuggestions([]);
      return;
    }

    let cancelled = false;
    setNameCheckState('checking');
    setNameError(null);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          name: fmt.cleanedDisplay,
          accountId: currentProfile.id,
        });
        if (googleUid) params.set('googleUid', googleUid);

        const [serverRes, cloudRes] = await Promise.all([
          fetch(`/api/accounts/check-username?${params.toString()}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          checkUsernameAvailabilityInFirestore(fmt.cleanedDisplay, googleUid || undefined).catch(
            () => ({ available: true })
          ),
        ]);

        if (cancelled) return;

        if (serverRes && !serverRes.available) {
          setNameCheckState('taken');
          setNameError(
            serverRes.reason || `"${fmt.cleanedDisplay}" kullanıcı adı zaten kullanılıyor!`
          );
          setNameSuggestions(Array.isArray(serverRes.suggestions) ? serverRes.suggestions : []);
          return;
        }

        if (cloudRes && !cloudRes.available) {
          setNameCheckState('taken');
          setNameError(`"${fmt.cleanedDisplay}" kullanıcı adı başka bir bulut hesabına kayıtlı!`);
          setNameSuggestions([]);
          return;
        }

        setNameCheckState('available');
        setNameError(null);
        setNameSuggestions([]);
      } catch {
        if (!cancelled) {
          setNameCheckState('available');
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, modalMode, currentProfile.id, googleUid]);

  const handleSuggestRandomName = async () => {
    sounds.playCountdown(1);
    try {
      const res = await fetch('/api/accounts/suggest-name');
      if (res.ok) {
        const data = await res.json();
        if (data?.name) {
          setName(String(data.name));
          return;
        }
      }
    } catch {
      // fallback
    }
    setName(generateRandomUniqueStarterName(new Set()));
  };

  const handleSelectOrBuyPp = (pp: (typeof STAR_PP_AVATARS)[number]) => {
    const isUnlocked = unlockedSet.has(pp.giftId);
    if (isUnlocked) {
      setAvatar(pp.avatarValue);
      setPpFeedback({ type: 'ok', text: `${pp.name} seçildi!` });
      setTimeout(() => setPpFeedback(null), 1800);
      return;
    }

    if (!onPurchaseGift) {
      setPpFeedback({ type: 'err', text: 'Coin ile PP açmak için profil mağazasını kullan.' });
      setTimeout(() => setPpFeedback(null), 2400);
      return;
    }

    const res = onPurchaseGift(pp.giftId);
    if (res.ok) {
      sounds.playVictory();
      setAvatar(pp.avatarValue);
      setPpFeedback({ type: 'ok', text: `${pp.name} açıldı ve seçildi!` });
    } else {
      sounds.playWrong();
      setPpFeedback({
        type: 'err',
        text: res.reason || 'Yetersiz Coin!',
      });
    }
    setTimeout(() => setPpFeedback(null), 2600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savedSuccess || isSubmitting) return;

    const fmt = validateUsernameFormat(name);
    if (!fmt.ok) {
      sounds.playWrong();
      setNameCheckState('invalid');
      setNameError(fmt.reason || 'Lütfen geçerli ve benzersiz bir ad gir.');
      return;
    }

    setIsSubmitting(true);
    setNameError(null);

    try {
      // 1. Verify against Firestore global username lock if available
      const cloudCheck = await checkUsernameAvailabilityInFirestore(
        fmt.cleanedDisplay,
        googleUid || undefined
      );
      if (!cloudCheck.available) {
        sounds.playWrong();
        setNameCheckState('taken');
        setNameError(`"${fmt.cleanedDisplay}" kullanıcı adı başka bir bulut hesabına kayıtlı!`);
        setIsSubmitting(false);
        return;
      }

      const updatedProfile: PlayerProfile = {
        ...currentProfile,
        name: fmt.cleanedDisplay,
        avatar,
        favoriteClubId,
        accountStats: currentProfile.accountStats || {
          totalMatches: 0,
          totalWins: 0,
          badgesEarned: [],
        },
      };

      // 2. Register/Update atomically on persistent backend store
      let persistedProfile = updatedProfile;

      try {
        const regRes = await fetch('/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: currentProfile.id,
            profile: updatedProfile,
            progression,
            googleUid: googleUid || undefined,
          }),
        });
        const regData = await regRes.json().catch(() => null);
        if (regRes.status === 409 || regRes.status === 400 || (regData && regData.ok === false)) {
          sounds.playWrong();
          setNameCheckState('taken');
          setNameError(regData?.error || 'Bu kullanıcı adı zaten alınmış!');
          setNameSuggestions(Array.isArray(regData?.suggestions) ? regData.suggestions : []);
          setIsSubmitting(false);
          return;
        }
        if (regRes.ok && regData?.ok && regData?.account) {
          persistedProfile = {
            ...updatedProfile,
            ...regData.account.profile,
          };
        }
      } catch {
        // Offline / local fallback continues smoothly
      }

      // 3. If signed into verified Google/Email Auth, claim handle atomically in Firestore
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.emailVerified) {
        const claim = await claimUsernameInFirestore({
          user: currentUser,
          displayName: persistedProfile.name,
          previousDisplayName:
            currentProfile.name && currentProfile.name !== 'Futbol Gurmesi'
              ? currentProfile.name
              : undefined,
        });
        if (!claim.ok) {
          sounds.playWrong();
          setNameCheckState('taken');
          setNameError(claim.reason || 'Bu kullanıcı adı başka bir bulut hesabına kayıtlı!');
          setIsSubmitting(false);
          return;
        }
      }

      try {
        localStorage.setItem('football_user_profile', JSON.stringify(persistedProfile));
      } catch {
        // ignore
      }

      sounds.playCorrect();
      setSavedSuccess(true);
      setTimeout(() => {
        onSaveProfile(persistedProfile);
        onClose?.();
      }, 300);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRestore = async () => {
    if (!onGoogleSignIn || isGoogleLoading) return;
    setIsGoogleLoading(true);
    setEmailAuthFeedback(null);
    try {
      const res = await onGoogleSignIn();
      if (res.ok) {
        sounds.playVictory();
        setEmailAuthFeedback({
          type: 'ok',
          text: `${res.email || 'Google'} hesabın bağlandı ve tüm verilerin korundu!`,
        });
        setTimeout(() => {
          onClose?.();
        }, 450);
      } else {
        sounds.playWrong();
        setEmailAuthFeedback({
          type: 'err',
          text: res.error || 'Google hesabı bağlanamadı.',
        });
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailAuthFeedback({ type: 'err', text: 'Lütfen geçerli bir e-posta adresi gir.' });
      return;
    }
    if (passwordInput.length < 6) {
      setEmailAuthFeedback({ type: 'err', text: 'Şifren en az 6 karakter uzunluğunda olmalıdır.' });
      return;
    }
    setEmailAuthBusy(true);
    setEmailAuthFeedback(null);
    try {
      if (emailAuthAction === 'register') {
        const res = await signUpWithEmail({
          email: cleanEmail,
          password: passwordInput,
          displayName: name.trim() || currentProfile.name,
        });
        sounds.playVictory();
        setEmailAuthFeedback({
          type: 'ok',
          text: res.verificationSent
            ? `Hesap oluşturuldu (${res.user.email})! Gelen kutuna doğrulama bağlantısı gönderildi.`
            : `Hesap oluşturuldu (${res.user.email})! Buradan veya Ayarlar'dan doğrulama e-postası gönderebilirsin.`,
        });
      } else {
        const user = await signInWithEmail(cleanEmail, passwordInput);
        sounds.playVictory();
        setEmailAuthFeedback({
          type: user.emailVerified ? 'ok' : 'info',
          text: user.emailVerified
            ? `Hoş geldin ${user.email}! Hesabın bulut ile senkronize edildi.`
            : `Giriş başarılı (${user.email}). Bulut yedekleme için lütfen e-postanı doğrula.`,
        });
      }
    } catch (err) {
      sounds.playWrong();
      setEmailAuthFeedback({ type: 'err', text: mapFirebaseAuthErrorToTurkish(err) });
    } finally {
      setEmailAuthBusy(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    setEmailAuthBusy(true);
    setEmailAuthFeedback(null);
    try {
      const res = await sendVerificationEmailToCurrentUser();
      setEmailAuthFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
    } finally {
      setEmailAuthBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setEmailAuthBusy(true);
    setEmailAuthFeedback(null);
    try {
      const res = await sendPasswordResetForEmail(emailInput);
      setEmailAuthFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
    } finally {
      setEmailAuthBusy(false);
    }
  };

  return (
    <div
      data-testid="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/92 overflow-y-auto animate-screen-fade"
    >
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-left my-auto max-h-[92dvh] overflow-y-auto animate-screen-slide-up">
        {/* Modal Header */}
        <div className="relative text-center mb-3.5">
          {progression && (
            <div
              data-testid="auth-coins-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-amber-400/40 text-amber-400 text-xs font-black font-mono mb-2"
            >
              <CoinIcon size="xs" />
              <span>{formatPoints(coins)} Coin</span>
            </div>
          )}

          <div className="mx-auto mb-2 flex items-center justify-center">
            {isPhotoAvatar(avatar) || isAnimeAvatar(avatar) ? (
              <PlayerAvatar
                avatar={avatar}
                name={name || 'Oyuncu'}
                size="xl"
                className="border-2 border-emerald-400 shadow-lg shadow-emerald-500/25"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/25 border border-emerald-300">
                <UserCheck className="w-7 h-7 stroke-[2.2]" />
              </div>
            )}
          </div>

          <span className="text-[11px] font-black tracking-widest text-emerald-400 uppercase px-3 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40">
            BENZERSİZ HESAP &amp; PROFİL
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight">
            {modalMode === 'profile'
              ? 'Oyuncu Hesabın'
              : 'Hesap Bağla & Giriş Yap'}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {modalMode === 'profile'
              ? 'Misafir olarak hemen oyna veya oyuncu adını ve avatarını kaydet.'
              : 'Google veya E-posta hesabını bağlayarak tüm coin, seri ve avatarlarını buluta yedekle.'}
          </p>
        </div>

        {/* Mode Switcher: Misafir/Profil vs Google & E-posta Auth */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950/90 border border-slate-800 mb-4">
          <button
            type="button"
            data-testid="auth-mode-profile"
            onClick={() => setModalMode('profile')}
            className={`py-2 px-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              modalMode === 'profile'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Misafir / Profil
          </button>
          <button
            type="button"
            data-testid="auth-mode-email"
            onClick={() => setModalMode('email')}
            className={`py-2 px-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              modalMode === 'email'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span>Google &amp; E-posta</span>
          </button>
        </div>

        {modalMode === 'email' ? (
          <div className="space-y-3.5">
            {onGoogleSignIn && (
              <div className="p-3.5 rounded-2xl bg-slate-950/85 border border-emerald-500/35 space-y-2">
                <p className="text-xs font-bold text-slate-200">
                  Google ile Giriş Yap / Hesabı Bağla
                </p>
                <p className="text-[11px] text-slate-400">
                  Mevcut coinlerin, günlük serin, haftalık puanın ve avatarların korunur; başka cihazda otomatik geri yüklenir.
                </p>
                <button
                  type="button"
                  data-testid="auth-google-restore-btn"
                  disabled={isGoogleLoading}
                  onClick={handleGoogleRestore}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-60"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CloudCheck className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>Google ile Giriş Yap / Hesabı Bağla</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                data-testid="auth-email-tab-login"
                onClick={() => {
                  setEmailAuthAction('login');
                  setEmailAuthFeedback(null);
                }}
                className={`py-2 rounded-lg text-xs font-black cursor-pointer transition ${
                  emailAuthAction === 'login'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                data-testid="auth-email-tab-register"
                onClick={() => {
                  setEmailAuthAction('register');
                  setEmailAuthFeedback(null);
                }}
                className={`py-2 rounded-lg text-xs font-black cursor-pointer transition ${
                  emailAuthAction === 'register'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Kayıt Ol
              </button>
            </div>

            {emailAuthFeedback && (
              <div
                data-testid="auth-email-feedback"
                className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                  emailAuthFeedback.type === 'ok'
                    ? 'bg-emerald-950/80 border-emerald-400/50 text-emerald-300'
                    : emailAuthFeedback.type === 'info'
                    ? 'bg-sky-950/80 border-sky-400/45 text-sky-200'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                }`}
              >
                {emailAuthFeedback.type === 'err' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{emailAuthFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleEmailAuthSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
                  E-posta Adresi
                </label>
                <input
                  type="email"
                  data-testid="auth-email-input"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="oyuncu@ornek.com"
                  required
                  className="w-full bg-slate-950 text-white font-semibold px-3.5 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-400 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
                  Şifre (En az 6 karakter)
                </label>
                <input
                  type="password"
                  data-testid="auth-password-input"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••"
                  required
                  className="w-full bg-slate-950 text-white font-semibold px-3.5 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-400 outline-none text-sm"
                />
              </div>

              <button
                type="submit"
                data-testid="auth-email-submit-btn"
                disabled={emailAuthBusy}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-60"
              >
                {emailAuthBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>{emailAuthAction === 'register' ? 'E-posta ile Kayıt Ol' : 'E-posta ile Giriş Yap'}</span>
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="auth-forgot-password-btn"
                disabled={emailAuthBusy}
                onClick={handleForgotPassword}
                className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-sky-300 font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Şifremi Unuttum</span>
              </button>
              <button
                type="button"
                data-testid="auth-send-verification-btn"
                disabled={emailAuthBusy}
                onClick={handleSendVerificationEmail}
                className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-400/45 text-amber-300 font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <MailCheck className="w-3.5 h-3.5" />
                <span>E-posta Doğrulama Gönder</span>
              </button>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Misafir Olarak Devam Et
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 relative">
            {/* Unique Username Input (Top Priority above the fold) */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
                  Benzersiz Kullanıcı Adın
                </label>
                <button
                  type="button"
                  data-testid="auth-suggest-name-btn"
                  onClick={handleSuggestRandomName}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 cursor-pointer transition"
                >
                  <Dices className="w-3 h-3" />
                  <span>İsim Öner</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-2.5 flex items-center justify-center pointer-events-none">
                  <PlayerAvatar
                    avatar={avatar}
                    name={name || 'Oyuncu'}
                    size="sm"
                    className="bg-emerald-500/15 border border-emerald-500/40"
                  />
                </div>
                <input
                  type="text"
                  data-testid="auth-name-input"
                  required
                  minLength={3}
                  maxLength={18}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sana özel bir kullanıcı adı yaz..."
                  className={`w-full bg-slate-950 text-white font-bold pl-13 pr-9 py-3 rounded-xl border outline-none text-base shadow-inner transition ${
                    nameCheckState === 'taken' || nameCheckState === 'invalid'
                      ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                      : nameCheckState === 'available'
                      ? 'border-emerald-400 focus:ring-2 focus:ring-emerald-400/20'
                      : 'border-slate-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20'
                  }`}
                />
                <div className="absolute right-3 flex items-center pointer-events-none">
                  {nameCheckState === 'checking' && (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  )}
                  {nameCheckState === 'available' && (
                    <CheckCircle2
                      data-testid="auth-name-status-ok"
                      className="w-4 h-4 text-emerald-400"
                    />
                  )}
                  {(nameCheckState === 'taken' || nameCheckState === 'invalid') && (
                    <AlertCircle
                      data-testid="auth-name-status-err"
                      className="w-4 h-4 text-rose-400"
                    />
                  )}
                </div>
              </div>

              {nameError && (
                <div
                  data-testid="auth-name-error"
                  className="mt-1.5 px-2.5 py-2 rounded-xl bg-rose-950/75 border border-rose-500/40 text-[11px] font-bold text-rose-200 space-y-1.5"
                >
                  <p>{nameError}</p>
                  {nameSuggestions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-300">Müsait öneriler:</span>
                      {nameSuggestions.map((sug, idx) => (
                        <button
                          key={sug}
                          type="button"
                          data-testid={`auth-name-suggestion-${idx}`}
                          onClick={() => setName(sug)}
                          className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-[11px] font-black cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {nameCheckState === 'available' && !nameError && (
                <p className="mt-1 text-[11px] font-bold text-emerald-400">
                  ✓ Bu kullanıcı adı müsait ve sadece sana ayrılacak.
                </p>
              )}
            </div>

            {/* Avatar Tab Switcher: Anime Karakter Oluştur & Giydir vs Hazır Yıldız PP'ler */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Avatar &amp; PP Seç
                </label>
                <div className="flex rounded-xl bg-slate-950 p-0.5 border border-slate-800 gap-0.5">
                  <button
                    type="button"
                    data-testid="auth-tab-anime"
                    onClick={() => setAvatarTab('anime')}
                    className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition cursor-pointer ${
                      avatarTab === 'anime'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('animeTabBuild')}
                  </button>
                  <button
                    type="button"
                    data-testid="auth-tab-pp"
                    onClick={() => setAvatarTab('pp')}
                    className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition cursor-pointer ${
                      avatarTab === 'pp'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('animeTabStars')}
                  </button>
                  <button
                    type="button"
                    data-testid="auth-tab-emoji"
                    onClick={() => setAvatarTab('emoji')}
                    className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition cursor-pointer ${
                      avatarTab === 'emoji'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Başlangıç
                  </button>
                </div>
              </div>

              {ppFeedback && (
                <div
                  data-testid="auth-pp-feedback"
                  className={`mb-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                    ppFeedback.type === 'ok'
                      ? 'bg-emerald-950/70 border-emerald-400/50 text-emerald-300'
                      : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                  }`}
                >
                  {ppFeedback.text}
                </div>
              )}

              {avatarTab === 'anime' ? (
                <AnimeAvatarBuilder
                  currentAvatar={avatar}
                  userCoins={coins}
                  unlockedGiftIds={progression?.unlockedGiftIds || []}
                  onEquipAvatar={(av) => setAvatar(av)}
                  onPurchaseGear={(giftId) =>
                    onPurchaseGift
                      ? onPurchaseGift(giftId)
                      : { ok: false, reason: 'Satın alma şu anda kullanılamıyor.' }
                  }
                />
              ) : avatarTab === 'pp' ? (
                <div className="grid grid-cols-4 gap-1.5 p-2 rounded-2xl bg-slate-950/80 border border-slate-800">
                  {STAR_PP_AVATARS.map((pp) => {
                    const unlocked = unlockedSet.has(pp.giftId);
                    const isSelected = avatar === pp.avatarValue;
                    const canAfford = coins >= pp.costCoins;

                    return (
                      <button
                        key={pp.giftId}
                        type="button"
                        data-testid={`auth-pp-${pp.playerId}`}
                        onClick={() => handleSelectOrBuyPp(pp)}
                        className={`relative flex flex-col items-center p-1.5 rounded-xl border transition active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400/60'
                            : unlocked
                            ? 'bg-slate-900 border-slate-700 hover:border-emerald-400/60'
                            : canAfford
                            ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400'
                            : 'bg-slate-900/60 border-slate-800 opacity-85 hover:opacity-100'
                        }`}
                      >
                        <div className="relative">
                          <PlayerAvatar
                            avatar={pp.avatarValue}
                            name={pp.name}
                            size="sm"
                            variant="circle"
                            className={!unlocked ? 'brightness-75' : ''}
                          />
                          {!unlocked && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-950 border border-amber-400 flex items-center justify-center">
                              <Lock className="w-2.5 h-2.5 text-amber-400" />
                            </span>
                          )}
                        </div>
                        <span className="mt-1 text-[9px] font-black text-white leading-tight truncate w-full text-center">
                          {pp.name.replace(' PP', '').split(' ').slice(-1)[0]}
                        </span>
                        <span
                          className={`mt-0.5 text-[9px] font-black px-1 py-0.5 rounded-md ${
                            isSelected
                              ? 'bg-emerald-400 text-slate-950'
                              : unlocked
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-400 text-slate-950'
                          }`}
                        >
                          {isSelected ? 'Seçili' : unlocked ? 'Seç' : `${formatPoints(pp.costCoins)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="grid grid-cols-4 gap-1.5">
                    {FREE_STARTER_PLAYER_AVATARS.map((sp) => {
                      const isSelected = avatar === sp.avatarValue;
                      return (
                        <button
                          key={sp.playerId}
                          type="button"
                          data-testid={`auth-starter-pp-${sp.playerId}`}
                          onClick={() => setAvatar(sp.avatarValue)}
                          className={`flex flex-col items-center p-1.5 rounded-xl border transition active:scale-95 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400/60'
                              : 'bg-slate-900 border-slate-800 hover:border-emerald-400/50'
                          }`}
                        >
                          <PlayerAvatar
                            avatar={sp.avatarValue}
                            name={sp.name}
                            size="sm"
                            variant="circle"
                          />
                          <span className="mt-1 text-[9px] font-black text-white leading-tight truncate w-full text-center">
                            {sp.shortName}
                          </span>
                          <span
                            className={`mt-0.5 text-[9px] font-black px-1 py-0.5 rounded-md ${
                              isSelected
                                ? 'bg-emerald-400 text-slate-950'
                                : 'bg-slate-800 text-emerald-300'
                            }`}
                          >
                            {isSelected ? 'Seçili' : 'Ücretsiz'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                      Futbol İkonları
                    </span>
                    <div className="grid grid-cols-6 gap-2">
                      {FREE_ICON_AVATARS.map((av) => {
                        const isSelected = avatar === av;
                        return (
                          <button
                            key={av}
                            type="button"
                            data-testid={`auth-emoji-${av}`}
                            onClick={() => setAvatar(av)}
                            className={`w-full aspect-square max-w-[44px] mx-auto rounded-xl flex items-center justify-center text-xl transition active:scale-95 cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-br from-emerald-500 to-teal-400 text-slate-950 scale-105 shadow-lg shadow-emerald-500/40 border-2 border-white'
                                : 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-800/80'
                            }`}
                          >
                            {av}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Favorite Club Picker */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                Favori Kulübün
              </label>
              <button
                type="button"
                data-testid="auth-club-toggle"
                onClick={() => setShowClubPicker((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-emerald-400/60 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {selectedClub ? (
                    <ClubBadge club={selectedClub} size="xs" />
                  ) : (
                    <Shield className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="font-bold text-sm text-white truncate">
                    {selectedClub ? selectedClub.name : 'Kulüp Seç'}
                  </span>
                </div>
                <span className="text-[11px] font-black text-emerald-400 shrink-0">
                  {showClubPicker ? 'Kapat' : 'Değiştir'}
                </span>
              </button>

              {showClubPicker && (
                <div className="mt-2 p-2.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={clubSearch}
                      onChange={(e) => setClubSearch(e.target.value)}
                      placeholder="Kulüp ara (Fenerbahçe, Real Madrid...)"
                      className="w-full bg-slate-900 text-white text-xs font-semibold pl-8 pr-3 py-2 rounded-xl border border-slate-700 focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto grid grid-cols-1 gap-1 pr-0.5">
                    {filteredClubs.map((club) => {
                      const active = club.id === favoriteClubId;
                      return (
                        <button
                          key={club.id}
                          type="button"
                          data-testid={`auth-club-${club.id}`}
                          onClick={() => {
                            setFavoriteClubId(club.id);
                            setShowClubPicker(false);
                          }}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-bold transition cursor-pointer ${
                            active
                              ? 'bg-emerald-500/20 border border-emerald-400 text-white'
                              : 'bg-slate-900/70 hover:bg-slate-800 text-slate-200 border border-transparent'
                          }`}
                        >
                          <ClubBadge club={club} size="xs" />
                          <span className="truncate flex-1">{club.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {club.country}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-1">
              <button
                type="submit"
                data-testid="auth-save-btn"
                disabled={isSubmitting || nameCheckState === 'taken' || nameCheckState === 'invalid'}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm tracking-wide uppercase transition active:scale-95 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Kaydedildi!</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Kontrol Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Kaydet &amp; Oyuna Başla</span>
                  </>
                )}
              </button>

              {!isInitialRequired && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full mt-2 text-xs text-slate-400 hover:text-white font-semibold py-1.5 cursor-pointer"
                >
                  Kapat
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
