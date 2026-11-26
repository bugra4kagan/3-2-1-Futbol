import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCheck,
  Sparkles,
  Check,
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
import { CoinIcon } from './CoinIcon';
import { formatPoints } from '../game/retentionEngine';
import {
  USERNAME_AVAILABLE_MESSAGE,
  USERNAME_TAKEN_ERROR,
  USERNAME_UNVERIFIED_ERROR,
  generateRandomUniqueStarterName,
  normalizeUsernameKey,
  validateUsernameFormat,
} from '../game/accountEngine';
import { isLegacyFlaggedUsername } from '../game/usernameFilter';
import { fetchBackendWithWakeupRetry } from '../services/backendClient';
import {
  auth,
  checkUsernameAvailabilityInFirestore,
  claimUsernameInFirestore,
  fetchAccountApiWithFirebaseAuth,
  mapFirebaseAuthErrorToTurkish,
  refreshCurrentFirebaseUser,
  sendPasswordResetForEmail,
  sendVerificationEmailToCurrentUser,
  signInWithEmail,
  signUpWithEmail,
} from '../firebase';
import { sounds } from '../utils/audio';
import { PlayerAvatar } from './PlayerAvatar';
import { ClubBadge } from './ClubBadge';
import {
  PROFILE_ICONS,
  getProfileIconLabel,
  normalizeProfileIconId,
} from '../game/profileIcons';
import { ProfileIconSvg } from './ProfileIconSvg';

interface AuthModalProps {
  currentProfile: PlayerProfile;
  progression?: UserProgression;
  googleUid?: string | null;
  initialTab?: 'profile' | 'email';
  initialNotice?: string | null;
  onSaveProfile: (profile: PlayerProfile, authoritativeProgression?: UserProgression) => void;
  onGoogleSignIn?: () => Promise<{
    ok: boolean;
    bonusCoinsAwarded?: number;
    email?: string;
    error?: string;
    redirectInProgress?: boolean;
    needsUsername?: boolean;
  }>;
  onCheckEmailVerification?: () => Promise<{
    verified: boolean;
    email?: string;
    needsUsername?: boolean;
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
  initialNotice = null,
  onSaveProfile,
  onGoogleSignIn,
  onCheckEmailVerification,
  onClose,
  isInitialRequired = false,
}) => {
  const initialIsGeneric =
    !currentProfile.name ||
    currentProfile.name.trim() === 'Futbol Gurmesi' ||
    isLegacyFlaggedUsername(currentProfile.name);
  const isEditingExisting =
    !isInitialRequired &&
    !initialIsGeneric &&
    Boolean(currentProfile.name && currentProfile.name.trim().length >= 3);
  const currentOwnKey = isEditingExisting ? normalizeUsernameKey(currentProfile.name) : '';
  const [modalMode, setModalMode] = useState<'profile' | 'email'>(initialTab);
  const [emailAuthAction, setEmailAuthAction] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailAuthBusy, setEmailAuthBusy] = useState(false);
  const [emailAuthFeedback, setEmailAuthFeedback] = useState<{
    type: 'ok' | 'err' | 'info';
    text: string;
  } | null>(() => (initialNotice ? { type: 'err', text: initialNotice } : null));
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState<boolean>(() =>
    Boolean(auth.currentUser && !auth.currentUser.isAnonymous && !auth.currentUser.emailVerified)
  );
  const [name, setName] = useState(initialIsGeneric ? '' : currentProfile.name);
  const [selectedAvatar, setSelectedAvatar] = useState(() =>
    normalizeProfileIconId(currentProfile.avatar)
  );
  const [favoriteClubId, setFavoriteClubId] = useState(
    currentProfile.favoriteClubId || 'galatasaray'
  );
  const [clubSearch, setClubSearch] = useState('');
  const [showClubPicker, setShowClubPicker] = useState(false);

  // Username uniqueness state
  const [nameCheckState, setNameCheckState] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unverified'
  >('idle');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(() => {
    if (isEditingExisting) return true;
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('321_terms_accepted_v1') === 'true';
    } catch {
      return false;
    }
  });

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

    const isSameOwnValidHandle = Boolean(currentOwnKey && fmt.key === currentOwnKey);
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
          fetchBackendWithWakeupRetry(
            `/api/accounts/check-username?${params.toString()}`,
            {},
            { timeoutMs: 12000, retries: 1 }
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          checkUsernameAvailabilityInFirestore(fmt.cleanedDisplay, googleUid || undefined).catch(
            () => ({ available: false, verified: false, errorCode: 'unverified', reason: USERNAME_UNVERIFIED_ERROR })
          ),
        ]);

        if (cancelled) return;

        if (!serverRes) {
          if (isSameOwnValidHandle) {
            setNameCheckState('available');
            setNameError(null);
            setNameSuggestions([]);
            return;
          }
          setNameCheckState('unverified');
          setNameError(USERNAME_UNVERIFIED_ERROR);
          setNameSuggestions([]);
          return;
        }

        if (!serverRes.available) {
          setNameCheckState(serverRes.ok === false ? 'invalid' : 'taken');
          setNameError(serverRes.reason || USERNAME_TAKEN_ERROR);
          setNameSuggestions(Array.isArray(serverRes.suggestions) ? serverRes.suggestions : []);
          return;
        }

        if (cloudRes && !cloudRes.available) {
          if (cloudRes.errorCode === 'unverified') {
            if (isSameOwnValidHandle) {
              setNameCheckState('available');
              setNameError(null);
              return;
            }
            setNameCheckState('unverified');
            setNameError(cloudRes.reason || USERNAME_UNVERIFIED_ERROR);
            setNameSuggestions([]);
            return;
          }
          setNameCheckState('taken');
          setNameError(cloudRes.reason || USERNAME_TAKEN_ERROR);
          setNameSuggestions([]);
          return;
        }

        setNameCheckState('available');
        setNameError(null);
        setNameSuggestions([]);
      } catch {
        if (!cancelled) {
          if (isSameOwnValidHandle) {
            setNameCheckState('available');
            setNameError(null);
          } else {
            setNameCheckState('unverified');
            setNameError(USERNAME_UNVERIFIED_ERROR);
          }
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, modalMode, currentProfile.id, googleUid, currentOwnKey]);

  const handleSuggestRandomName = async () => {
    sounds.playCountdown(1);
    try {
      const res = await fetchBackendWithWakeupRetry(
        '/api/accounts/suggest-name',
        {},
        { timeoutMs: 12000, retries: 1 }
      );
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savedSuccess || isSubmitting) return;

    if (!termsAccepted) {
      sounds.playWrong();
      setNameError('Devam etmek için Kullanım Koşulları ve Gizlilik Politikasını onaylamalısın.');
      return;
    }
    try {
      window.localStorage.setItem('321_terms_accepted_v1', 'true');
    } catch {
      // ignore
    }

    const fmt = validateUsernameFormat(name);
    if (!fmt.ok) {
      sounds.playWrong();
      setNameCheckState('invalid');
      setNameError(fmt.reason || 'Lütfen geçerli ve benzersiz bir ad gir.');
      return;
    }

    const isUsernameChanged = !isEditingExisting || fmt.key !== currentOwnKey;

    setIsSubmitting(true);
    setNameError(null);

    try {
      // 1. Verify against Firestore global username lock when creating or renaming
      if (isUsernameChanged) {
        const cloudCheck = await checkUsernameAvailabilityInFirestore(
          fmt.cleanedDisplay,
          googleUid || undefined
        );
        if (!cloudCheck.available) {
          sounds.playWrong();
          setNameCheckState(cloudCheck.errorCode === 'unverified' ? 'unverified' : 'taken');
          setNameError(
            cloudCheck.reason ||
              (cloudCheck.errorCode === 'unverified'
                ? USERNAME_UNVERIFIED_ERROR
                : USERNAME_TAKEN_ERROR)
          );
          setIsSubmitting(false);
          return;
        }
      }

      const updatedProfile: PlayerProfile = {
        ...currentProfile,
        name: fmt.cleanedDisplay,
        avatar: normalizeProfileIconId(selectedAvatar),
        favoriteClubId,
        accountStats: currentProfile.accountStats || {
          totalMatches: 0,
          totalWins: 0,
          badgesEarned: [],
        },
      };

      // 2. Register/Update atomically on persistent backend store
      let persistedProfile = updatedProfile;
      let backendVerified = false;
      let authoritativeProgression: UserProgression | undefined;

      try {
        const storedToken =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(`321_server_session_token_${currentProfile.id}`)
            : null;
        const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (storedToken) baseHeaders['X-Account-Token'] = storedToken;
        const verifiedUid =
          googleUid ||
          (auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : null);

        const regRes = await fetchAccountApiWithFirebaseAuth({
          path: '/api/accounts/register',
          method: 'POST',
          baseHeaders,
          body: {
            accountId: currentProfile.id,
            profile: updatedProfile,
            progression,
            googleUid: verifiedUid || undefined,
          },
          retryOptions: { timeoutMs: 18000, retries: 2, retryDelayMs: 1800 },
        });
        const regData = await regRes.json().catch(() => null);
        const canonicalId = String(regData?.account?.accountId || currentProfile.id);
        if (regRes.ok && regData?.sessionToken && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(
              `321_server_session_token_${canonicalId}`,
              String(regData.sessionToken)
            );
          } catch {
            // ignore
          }
        }
        if (regRes.status === 409 || regRes.status === 403 || regRes.status === 401 || regRes.status === 400 || (regData && regData.ok === false)) {
          sounds.playWrong();
          setNameCheckState(regRes.status === 400 ? 'invalid' : 'taken');
          setNameError(regData?.error || USERNAME_TAKEN_ERROR);
          setNameSuggestions(Array.isArray(regData?.suggestions) ? regData.suggestions : []);
          setIsSubmitting(false);
          return;
        }
        if (regRes.ok && regData?.ok && regData?.account) {
          backendVerified = true;
          persistedProfile = {
            ...updatedProfile,
            ...regData.account.profile,
            id: canonicalId,
          };
          if (regData.account.progression) {
            authoritativeProgression = regData.account.progression as UserProgression;
          }
        }
      } catch {
        backendVerified = false;
      }

      if (isUsernameChanged && !backendVerified) {
        sounds.playWrong();
        setNameCheckState('unverified');
        setNameError(USERNAME_UNVERIFIED_ERROR);
        setIsSubmitting(false);
        return;
      }

      // 3. If signed into verified Google/Email Auth and creating/renaming, claim handle atomically in Firestore
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.emailVerified && isUsernameChanged) {
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
          setNameError(claim.reason || USERNAME_TAKEN_ERROR);
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
        onSaveProfile(persistedProfile, authoritativeProgression);
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
      if (res.redirectInProgress) {
        setEmailAuthFeedback({
          type: 'info',
          text: 'Google giriş sayfasına yönlendiriliyorsun...',
        });
        return;
      }
      if (res.ok) {
        sounds.playVictory();
        if (res.needsUsername) {
          setEmailAuthFeedback({
            type: 'ok',
            text: `${res.email || 'Google'} hesabın doğrulandı! Devam etmek için kullanıcı adını seç.`,
          });
          setTimeout(() => {
            setModalMode('profile');
          }, 350);
          return;
        }
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

  const handleCheckEmailVerificationClick = async () => {
    if (emailAuthBusy) return;
    setEmailAuthBusy(true);
    setEmailAuthFeedback(null);
    try {
      const checkRes: {
        verified: boolean;
        email?: string;
        needsUsername?: boolean;
        error?: string;
      } = onCheckEmailVerification
        ? await onCheckEmailVerification()
        : await refreshCurrentFirebaseUser().then((u) => ({
            verified: Boolean(u && !u.isAnonymous && u.emailVerified),
            email: u?.email || undefined,
            needsUsername: initialIsGeneric,
          }));
      if (checkRes.error) {
        sounds.playWrong();
        setEmailAuthFeedback({ type: 'err', text: checkRes.error });
        return;
      }
      if (!checkRes.verified) {
        setAwaitingEmailVerification(true);
        setEmailAuthFeedback({
          type: 'info',
          text: 'Doğrulama henüz görünmedi. E-posta gelen kutundaki (veya Spam klasöründeki) bağlantıya tıklayıp tekrar kontrol et.',
        });
        return;
      }
      setAwaitingEmailVerification(false);
      sounds.playVictory();
      if (checkRes.needsUsername) {
        setEmailAuthFeedback({
          type: 'ok',
          text: `${checkRes.email || 'E-posta'} doğrulandı! Şimdi kullanıcı adını seç ve oyuna başla.`,
        });
        setTimeout(() => {
          setModalMode('profile');
        }, 350);
      } else {
        setEmailAuthFeedback({
          type: 'ok',
          text: `${checkRes.email || 'E-posta'} doğrulandı ve hesabın bulutla senkronize edildi!`,
        });
        setTimeout(() => {
          onClose?.();
        }, 450);
      }
    } finally {
      setEmailAuthBusy(false);
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
        setAwaitingEmailVerification(!res.user.emailVerified);
        sounds.playVictory();
        setEmailAuthFeedback({
          type: 'ok',
          text: res.verificationSent
            ? `Hesap oluşturuldu (${res.user.email})! Gelen kutundaki doğrulama bağlantısına tıkladıktan sonra aşağıdaki "Doğrulamayı Kontrol Et" butonuna bas.`
            : `Hesap oluşturuldu (${res.user.email})! Aşağıdan doğrulama e-postası gönderip onayladıktan sonra girişi tamamla.`,
        });
      } else {
        const user = await signInWithEmail(cleanEmail, passwordInput);
        setAwaitingEmailVerification(!user.emailVerified);
        sounds.playVictory();
        if (user.emailVerified) {
          if (initialIsGeneric) {
            setEmailAuthFeedback({
              type: 'ok',
              text: `Hoş geldin ${user.email}! Devam etmek için kullanıcı adını seç.`,
            });
            setTimeout(() => {
              setModalMode('profile');
            }, 350);
          } else {
            setEmailAuthFeedback({
              type: 'ok',
              text: `Hoş geldin ${user.email}! Hesabın bulut ile senkronize edildi.`,
            });
            setTimeout(() => {
              onClose?.();
            }, 450);
          }
        } else {
          setEmailAuthFeedback({
            type: 'info',
            text: `Giriş başarılı (${user.email}). Bulut yedekleme için gelen kutundaki bağlantıyı onayla ve "Doğrulamayı Kontrol Et"e bas.`,
          });
        }
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#092316]/88 overflow-y-auto animate-screen-fade"
    >
      <div className="relative w-full max-w-md bg-[#124029] border-2 border-[#E5B94F]/45 rounded-3xl p-5 pb-6 sm:p-6 shadow-2xl text-left my-auto max-h-[92dvh] overflow-y-auto animate-screen-slide-up">
        {/* Modal Header */}
        <div className="relative text-center mb-3.5">
          {progression && (
            <div
              data-testid="auth-coins-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0B1220] border border-[#E5B94F]/45 text-[#E5B94F] text-xs font-black font-score mb-2"
            >
              <CoinIcon size="xs" />
              <span>{formatPoints(coins)} Coin</span>
            </div>
          )}

          <div className="mx-auto mb-2 flex items-center justify-center">
            <PlayerAvatar
              avatar={selectedAvatar}
              name={name || 'Oyuncu'}
              size="lg"
              variant="circle"
            />
          </div>

          <span className="text-[11px] font-black tracking-widest text-[#E5B94F] uppercase px-3 py-0.5 rounded-full bg-[#0F273E] border border-[#4ADE80]/55">
            {isEditingExisting ? 'PROFİLİ DÜZENLE' : 'YENİ OYUNCU PROFİLİ'}
          </span>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-[#FFFFFF] mt-1.5 tracking-wide uppercase">
            {modalMode === 'profile'
              ? isEditingExisting
                ? 'Profilini Güncelle'
                : 'Oyuncu Hesabı Oluştur'
              : 'Hesap Bağla & Giriş Yap'}
          </h2>
          <p className="text-xs text-[#A8B3C2] mt-0.5">
            {modalMode === 'profile'
              ? isEditingExisting
                ? 'Simgeyi veya kulübünü değiştirebilir ya da kullanıcı adını güncelleyebilirsin.'
                : 'Benzersiz kullanıcı adını, profil simgeni ve favori kulübünü seç.'
              : 'Google veya E-posta hesabını bağlayarak coin ve lig puanlarını koru.'}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#0B1220] border border-[#A8B3C2]/15 mb-4">
          <button
            type="button"
            data-testid="auth-mode-profile"
            onClick={() => setModalMode('profile')}
            className={`py-2 px-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              modalMode === 'profile'
                ? 'bg-[#168A52] text-[#FFFFFF] shadow'
                : 'text-[#A8B3C2] hover:text-[#FFFFFF]'
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
                ? 'bg-[#3B82F6] text-[#FFFFFF] shadow'
                : 'text-[#A8B3C2] hover:text-[#FFFFFF]'
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

            {awaitingEmailVerification && (
              <button
                type="button"
                data-testid="auth-check-verification-btn"
                disabled={emailAuthBusy}
                onClick={handleCheckEmailVerificationClick}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-60"
              >
                {emailAuthBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>Doğrulamayı Kontrol Et &amp; Girişi Tamamla</span>
              </button>
            )}

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
                    avatar={selectedAvatar}
                    name={name || 'Oyuncu'}
                    size="sm"
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
                  className={`w-full bg-[#183022] text-[#F2ECD9] font-bold pl-14 pr-9 py-3 rounded-xl border outline-none text-base shadow-inner transition ${
                    nameCheckState === 'taken' || nameCheckState === 'invalid' || nameCheckState === 'unverified'
                      ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                      : nameCheckState === 'available'
                      ? 'border-[#3C8052] focus:ring-2 focus:ring-[#3C8052]/25'
                      : 'border-[#F2ECD9]/20 focus:border-[#D9B76B]'
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
                  {(nameCheckState === 'taken' || nameCheckState === 'invalid' || nameCheckState === 'unverified') && (
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
                <p className="mt-1 text-[11px] font-bold text-[#22C55E]">
                  ✓{' '}
                  {currentOwnKey && normalizeUsernameKey(name) === currentOwnKey
                    ? 'Mevcut kullanıcı adın korunuyor.'
                    : USERNAME_AVAILABLE_MESSAGE}
                </p>
              )}
            </div>

            {/* 10 Free Colored Vector Profile Icons Picker (5x2 Grid) */}
            <div data-testid="auth-avatar-picker">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-[#F5F3EB]">
                  Profil Simgesi
                </label>
                <span className="text-[11px] font-bold text-[#E5B94F]">
                  {getProfileIconLabel(selectedAvatar)} • Ücretsiz
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 p-2 rounded-2xl bg-[#0B1220] border border-[#A8B3C2]/20">
                {PROFILE_ICONS.map((iconDef) => {
                  const isSelected = selectedAvatar === iconDef.id;
                  return (
                    <button
                      key={iconDef.id}
                      type="button"
                      data-testid={`avatar-option-${iconDef.id}`}
                      aria-pressed={isSelected}
                      aria-label={iconDef.label}
                      title={iconDef.label}
                      onClick={() => {
                        sounds.playCountdown(1);
                        setSelectedAvatar(iconDef.id);
                      }}
                      className={`relative flex flex-col items-center justify-center gap-1 min-h-[66px] sm:aspect-square py-2 px-0.5 rounded-xl border transition active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-[#183D2B] border-[#E5B94F] ring-2 ring-[#E5B94F]/45 shadow'
                          : 'bg-[#16212E] border-[#A8B3C2]/15 hover:border-[#3B82F6]/60'
                      }`}
                    >
                      <ProfileIconSvg iconId={iconDef.id} className="w-7 h-7" />
                      <span
                        className={`text-[8.5px] sm:text-[9px] tracking-tighter font-bold leading-none truncate max-w-full ${
                          isSelected ? 'text-[#E5B94F]' : 'text-[#A8B3C2]'
                        }`}
                      >
                        {iconDef.shortLabel}
                      </span>
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E5B94F] text-[#0B1220] flex items-center justify-center shadow"
                        >
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Favorite Club Picker */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-[#F5F3EB] mb-1.5">
                Favori Kulübün
              </label>
              <button
                type="button"
                data-testid="auth-club-toggle"
                onClick={() => setShowClubPicker((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#0B1220] border border-[#A8B3C2]/25 hover:border-[#E5B94F]/60 text-left transition cursor-pointer"
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

            {/* Submit Action & Explicit Terms Acceptance Gate (Google Play UGC) */}
            <div className="pt-1 space-y-2.5">
              <label
                data-testid="auth-legal-notice"
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-emerald-500/40 cursor-pointer text-[11px] leading-relaxed text-slate-300"
              >
                <input
                  type="checkbox"
                  data-testid="auth-terms-checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked && nameError?.includes('Kullanım Koşulları')) {
                      setNameError(null);
                    }
                  }}
                  className="mt-0.5 w-4 h-4 rounded accent-emerald-500 shrink-0 cursor-pointer"
                />
                <span>
                  13 yaşından büyük olduğumu,{' '}
                  <a
                    href="https://bugra4kagan.github.io/3-2-1-Futbol/kullanim-kosullari.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-300 hover:underline font-bold"
                  >
                    Kullanım Koşulları &amp; Topluluk Kurallarını
                  </a>{' '}
                  ve{' '}
                  <a
                    href="https://bugra4kagan.github.io/3-2-1-Futbol/gizlilik.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-300 hover:underline font-bold"
                  >
                    Gizlilik Politikasını
                  </a>{' '}
                  okuyup kabul ediyorum.
                </span>
              </label>
              <button
                type="submit"
                data-testid="auth-save-btn"
                disabled={
                  !termsAccepted ||
                  isSubmitting ||
                  nameCheckState === 'taken' ||
                  nameCheckState === 'invalid'
                }
                className="w-full py-3.5 px-4 rounded-xl bg-[#168A52] hover:bg-[#22C55E] disabled:opacity-50 disabled:cursor-not-allowed text-[#FFFFFF] font-display font-extrabold text-xl tracking-wider uppercase transition active:scale-95 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
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
