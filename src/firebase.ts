import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  linkWithRedirect,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDatabase, ref as rtdbRef, remove as rtdbRemove } from 'firebase/database';
import { getAnalytics, isSupported, logEvent, Analytics } from 'firebase/analytics';
import {
  CustomProvider,
  getToken as getFirebaseAppCheckJwtToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';
import { Capacitor } from '@capacitor/core';
import {
  BackendRetryOptions,
  fetchWithVerifiedFirebaseAuth,
  resolveVerifiedFirebaseIdToken,
} from './services/backendClient';
import {
  USERNAME_TAKEN_ERROR,
  USERNAME_UNVERIFIED_ERROR,
  isLegacyFlaggedUsername,
  normalizeUsernameKey,
  sanitizePublicDisplayName,
  validateUsernameFormat,
} from './game/accountEngine';
import { sanitizeRtdbKey } from './game/realtimeSyncHelpers';
import { calibrateServerTimeOffset } from './game/serverTime';
import {
  FriendActivityEvent,
  FriendEntry,
  FriendNotificationType,
  MinigameType,
  PlayerProfile,
  PublicPlayerProfile,
  UserProgression,
  UserReportReason,
} from './game/types';

export const firebaseConfig = {
  apiKey: 'AIzaSyB_45IPtJ-o7mqi6mXNqyq625Ch0qHuR4Q',
  authDomain: 'futbol-9013e.firebaseapp.com',
  databaseURL: 'https://futbol-9013e-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'futbol-9013e',
  storageBucket: 'futbol-9013e.firebasestorage.app',
  messagingSenderId: '895309340693',
  appId: '1:895309340693:web:88fd344ace312fb56f2e1c',
  measurementId: 'G-H0C2LRZL6Q',
};

export const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

let appCheckInstance: AppCheck | null = null;

function readEnvFlag(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const raw = env?.[key];
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Gerçek Firebase App Check + Google Play Integrity token üreteci.
 * PlayIntegrity.getFirebaseAppCheckToken native FirebaseAppCheck + PlayIntegrityAppCheckProviderFactory
 * ile gerçek Firebase App Check JWT token'ı üretir; ham Play Integrity yanıtını token gibi geçmez.
 * ÖNEMLİ: Firebase Console'da App Check enforcement KAPALI tutulur; yapılandırma eksikse akışı kesmez.
 */
export function initializeFirebaseAppCheck(): {
  initialized: boolean;
  provider: 'firebase_appcheck_play_integrity' | 'recaptcha_v3' | 'not_configured';
  enforcementEnabled: false;
} {
  if (appCheckInstance) {
    return {
      initialized: true,
      provider: Capacitor.isNativePlatform() ? 'firebase_appcheck_play_integrity' : 'recaptcha_v3',
      enforcementEnabled: false,
    };
  }
  if (typeof window === 'undefined') {
    return { initialized: false, provider: 'not_configured', enforcementEnabled: false };
  }

  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      const appCheckEnabled = readEnvFlag('VITE_FIREBASE_APPCHECK_ENABLED') !== 'false';
      const androidAppId = readEnvFlag('VITE_FIREBASE_ANDROID_APP_ID');
      const win = window as unknown as {
        Capacitor?: {
          Plugins?: {
            PlayIntegrity?: {
              getFirebaseAppCheckToken: (opts: {
                forceRefresh?: boolean;
                projectId: string;
                apiKey: string;
                androidAppId?: string;
              }) => Promise<{
                ok: boolean;
                token?: string;
                expireTimeMillis?: number;
                status?: string;
                error?: string;
              }>;
            };
          };
        };
      };
      const plugin = win.Capacitor?.Plugins?.PlayIntegrity;
      if (appCheckEnabled && plugin?.getFirebaseAppCheckToken) {
        appCheckInstance = initializeAppCheck(app, {
          provider: new CustomProvider({
            getToken: async () => {
              const res = await plugin.getFirebaseAppCheckToken({
                forceRefresh: false,
                projectId: firebaseConfig.projectId,
                apiKey: firebaseConfig.apiKey,
                androidAppId,
              });
              if (!res.ok || !res.token) {
                throw new Error(res.error || res.status || 'Firebase App Check token unavailable');
              }
              return {
                token: res.token,
                expireTimeMillis:
                  typeof res.expireTimeMillis === 'number' && res.expireTimeMillis > Date.now()
                    ? res.expireTimeMillis
                    : Date.now() + 50 * 60 * 1000,
              };
            },
          }),
          isTokenAutoRefreshEnabled: true,
        });
        return {
          initialized: true,
          provider: 'firebase_appcheck_play_integrity',
          enforcementEnabled: false,
        };
      }
      return { initialized: false, provider: 'not_configured', enforcementEnabled: false };
    }

    const recaptchaKey = readEnvFlag('VITE_FIREBASE_APPCHECK_RECAPTCHA_KEY');
    if (recaptchaKey) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
      });
      return { initialized: true, provider: 'recaptcha_v3', enforcementEnabled: false };
    }
  } catch {
    // Enforcement kapalı olduğu için yapılandırma eksikliği akışı kesmez
  }

  return { initialized: false, provider: 'not_configured', enforcementEnabled: false };
}

export async function verifyAppCheckTokenGeneration(
  forceRefresh = false
): Promise<{ ok: boolean; hasToken: boolean; error?: string }> {
  if (!appCheckInstance) {
    initializeFirebaseAppCheck();
  }
  if (!appCheckInstance) {
    return { ok: false, hasToken: false, error: 'App Check yapılandırılmamış.' };
  }
  try {
    const res = await getFirebaseAppCheckJwtToken(appCheckInstance, forceRefresh);
    return { ok: Boolean(res?.token), hasToken: Boolean(res?.token) };
  } catch (err) {
    return {
      ok: false,
      hasToken: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

let analyticsInstance: Analytics | null = null;

void isSupported()
  .then((supported) => {
    if (supported) {
      analyticsInstance = getAnalytics(app);
    }
  })
  .catch(() => {});

export function trackScreenView(screenName: string): void {
  if (!analyticsInstance) return;
  try {
    logEvent(analyticsInstance, 'screen_view', {
      firebase_screen: screenName,
      firebase_screen_class: screenName,
    });
  } catch {
    // ignore analytics errors
  }
}

export function trackGameEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!analyticsInstance) return;
  try {
    logEvent(analyticsInstance, eventName, params);
  } catch {
    // ignore analytics errors
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export interface UserBackupRecord {
  userId: string;
  displayName: string;
  usernameKey?: string;
  email: string;
  avatar: string;
  favoriteClubId?: string;
  progression: UserProgression;
}

export async function ensureAnonymousFirebaseSession(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch {
    return null;
  }
}

export async function getVerifiedFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  return resolveVerifiedFirebaseIdToken(auth, forceRefresh);
}

export async function refreshCurrentFirebaseUser(): Promise<User | null> {
  try {
    await auth.authStateReady();
    const current = auth.currentUser;
    if (!current || current.isAnonymous) {
      return current;
    }
    await current.reload();
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      await auth.currentUser.getIdToken(true).catch(() => null);
    }
    return auth.currentUser;
  } catch {
    return auth.currentUser;
  }
}

export async function fetchAccountApiWithFirebaseAuth(params: {
  path: string;
  method?: string;
  baseHeaders: Record<string, string>;
  body?: unknown;
  retryOptions?: BackendRetryOptions;
}): Promise<Response> {
  return fetchWithVerifiedFirebaseAuth({
    ...params,
    auth,
  });
}

export async function processAuthRedirectResult(): Promise<{
  user: User | null;
  error?: string;
}> {
  try {
    await auth.authStateReady();
    const res = await getRedirectResult(auth);
    return { user: res?.user ?? null };
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : '';
    if (code.includes('credential-already-in-use') || code.includes('email-already-in-use')) {
      const pendingCred = GoogleAuthProvider.credentialFromError(err as never);
      if (pendingCred) {
        try {
          const signedIn = await signInWithCredential(auth, pendingCred);
          return { user: signedIn.user };
        } catch (credErr) {
          return { user: null, error: mapFirebaseAuthErrorToTurkish(credErr) };
        }
      }
    }
    return { user: null, error: mapFirebaseAuthErrorToTurkish(err) };
  }
}

export async function signInWithGooglePopup(): Promise<User> {
  const current = auth.currentUser;
  const isNative = Capacitor.isNativePlatform();
  if (current && current.isAnonymous) {
    try {
      const linked = await linkWithPopup(current, googleProvider);
      return linked.user;
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code.includes('credential-already-in-use') || code.includes('email-already-in-use')) {
        const pendingCred = GoogleAuthProvider.credentialFromError(err as never);
        if (pendingCred) {
          const signedIn = await signInWithCredential(auth, pendingCred);
          return signedIn.user;
        }
        const credential = await signInWithPopup(auth, googleProvider);
        return credential.user;
      }
      if (
        !isNative &&
        (code.includes('popup-blocked') ||
          code.includes('operation-not-supported-in-this-environment'))
      ) {
        await linkWithRedirect(current, googleProvider);
        throw new Error('redirect-in-progress');
      }
      throw err;
    }
  }

  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return credential.user;
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (
      !isNative &&
      (code.includes('popup-blocked') ||
        code.includes('operation-not-supported-in-this-environment'))
    ) {
      await signInWithRedirect(auth, googleProvider);
      throw new Error('redirect-in-progress');
    }
    throw err;
  }
}

export function mapFirebaseAuthErrorToTurkish(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : '';
  const msg = err instanceof Error ? err.message : String(err);
  const combined = `${code} ${msg}`.toLowerCase();

  if (combined.includes('disallowed_useragent')) {
    return 'Uygulama içi tarayıcıda Google giriş penceresi desteklenmiyor. E-posta/şifre ile giriş yapabilir veya web sürümünden hesabını bağlayabilirsin.';
  }
  if (combined.includes('unauthorized-domain')) {
    return 'Bu alan adı Firebase yetkilendirilmiş alanlar listesinde tanımlı değil.';
  }
  if (combined.includes('account-exists-with-different-credential')) {
    return 'Bu e-posta adresi farklı bir giriş yöntemiyle kayıtlı. E-posta/şifre ile giriş yapmayı dene.';
  }
  if (combined.includes('popup-closed-by-user') || combined.includes('cancelled-popup-request')) {
    return 'Google giriş penceresi kapatıldı.';
  }
  if (combined.includes('popup-blocked')) {
    return 'Tarayıcı açılır pencereyi engelledi. İzin verip tekrar dene.';
  }
  if (combined.includes('operation-not-supported-in-this-environment')) {
    return 'Bu cihaz/tarayıcı ortamında açılır Google penceresi desteklenmiyor. E-posta ile giriş yapmayı deneyebilirsin.';
  }
  if (combined.includes('email-already-in-use')) {
    return 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı dene!';
  }
  if (combined.includes('invalid-email')) {
    return 'Lütfen geçerli bir e-posta adresi gir.';
  }
  if (combined.includes('weak-password')) {
    return 'Şifren en az 6 karakter uzunluğunda olmalıdır.';
  }
  if (
    combined.includes('wrong-password') ||
    combined.includes('invalid-credential') ||
    combined.includes('user-not-found')
  ) {
    return 'E-posta veya şifre hatalı.';
  }
  if (combined.includes('too-many-requests')) {
    return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar dene.';
  }
  if (combined.includes('requires-recent-login')) {
    return 'Güvenlik nedeniyle hesabını silmeden önce yakın zamanda tekrar giriş yapman gerekebilir.';
  }
  if (combined.includes('network-request-failed')) {
    return 'İnternet bağlantısı sağlanamadı. Bağlantını kontrol et.';
  }
  return 'İşlem tamamlanamadı. Lütfen bilgilerini kontrol edip tekrar dene.';
}

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ user: User; verificationSent: boolean }> {
  const cleanEmail = params.email.trim();
  const current = auth.currentUser;
  let user: User;

  if (current && current.isAnonymous) {
    const emailCred = EmailAuthProvider.credential(cleanEmail, params.password);
    const linked = await linkWithCredential(current, emailCred);
    user = linked.user;
  } else {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
    user = credential.user;
  }

  if (params.displayName && params.displayName.trim().length > 0) {
    await updateProfile(user, {
      displayName: params.displayName.trim().slice(0, 24),
    }).catch(() => {});
  }
  let verificationSent = false;
  try {
    await sendEmailVerification(user);
    verificationSent = true;
  } catch {
    verificationSent = false;
  }
  return { user, verificationSent };
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function sendVerificationEmailToCurrentUser(): Promise<{
  ok: boolean;
  message: string;
}> {
  const current = auth.currentUser;
  if (!current) {
    return {
      ok: false,
      message: 'Doğrulama göndermek için önce e-posta hesabınla giriş yapmalısın.',
    };
  }
  if (current.emailVerified) {
    return {
      ok: true,
      message: 'E-posta adresin zaten doğrulanmış ✓',
    };
  }
  try {
    await sendEmailVerification(current);
    return {
      ok: true,
      message: `${current.email || 'E-posta'} adresine doğrulama bağlantısı gönderildi!`,
    };
  } catch (err) {
    return {
      ok: false,
      message: mapFirebaseAuthErrorToTurkish(err),
    };
  }
}

export async function sendPasswordResetForEmail(email: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes('@')) {
    return { ok: false, message: 'Şifre sıfırlama için geçerli bir e-posta adresi yaz.' };
  }
  try {
    await sendPasswordResetEmail(auth, trimmed);
    return {
      ok: true,
      message: `Şifre sıfırlama bağlantısı ${trimmed} adresine gönderildi!`,
    };
  } catch (err) {
    return {
      ok: false,
      message: mapFirebaseAuthErrorToTurkish(err),
    };
  }
}

export async function deleteCloudAccountData(params: {
  user: User | null;
  displayName?: string;
  sessionPlayerId?: string;
  authAlreadyDeletedOnServer?: boolean;
}): Promise<{ ok: boolean; warning?: string }> {
  const { user, displayName, sessionPlayerId, authAlreadyDeletedOnServer } = params;
  if (!user) return { ok: true };

  const key = displayName ? normalizeUsernameKey(displayName) : '';
  try {
    if (sessionPlayerId) {
      await rtdbRemove(rtdbRef(rtdb, `leaderboard/${sanitizeRtdbKey(sessionPlayerId)}`)).catch(
        () => {}
      );
    }
    await rtdbRemove(rtdbRef(rtdb, `leaderboard/${sanitizeRtdbKey(user.uid)}`)).catch(() => {});
    await deleteDoc(doc(db, 'users', user.uid)).catch(() => {});
    if (key.length >= 3 && key.length <= 32) {
      const pubRef = doc(db, 'publicProfiles', key);
      const pubSnap = await getDoc(pubRef).catch(() => null);
      if (pubSnap?.exists() && pubSnap.data()?.ownerUid === user.uid) {
        await deleteDoc(pubRef).catch(() => {});
      }
      const userRef = doc(db, 'usernames', key);
      const userSnap = await getDoc(userRef).catch(() => null);
      if (userSnap?.exists() && userSnap.data()?.ownerUid === user.uid) {
        await deleteDoc(userRef).catch(() => {});
      }
    }
    if (authAlreadyDeletedOnServer) {
      await signOut(auth).catch(() => {});
      return { ok: true };
    }
    try {
      await deleteUser(user);
    } catch (err) {
      await signOut(auth).catch(() => {});
      return {
        ok: false,
        warning:
          'Yerel ve profil verilerin temizlendi; güvenlik gereği oturum kaydını silmek için yeniden giriş yapıp tekrar deneyebilir veya 321futboloyunu@gmail.com adresine yazabilirsin. (' +
          mapFirebaseAuthErrorToTurkish(err) +
          ')',
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      warning: mapFirebaseAuthErrorToTurkish(err),
    };
  }
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function checkUsernameAvailabilityInFirestore(
  rawName: string,
  currentUid?: string
): Promise<{
  available: boolean;
  verified?: boolean;
  usernameKey: string;
  ownerUid?: string;
  reason?: string;
  errorCode?: string;
}> {
  const fmt = validateUsernameFormat(rawName);
  const usernameKey = fmt.key || normalizeUsernameKey(rawName);
  if (!fmt.ok) {
    return {
      available: false,
      verified: true,
      usernameKey,
      reason: fmt.reason,
      errorCode: fmt.errorCode,
    };
  }
  if (usernameKey.length < 3 || usernameKey.length > 32) {
    return { available: false, verified: true, usernameKey };
  }
  const path = `usernames/${usernameKey}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', usernameKey));
    if (!snap.exists()) {
      return { available: true, verified: true, usernameKey };
    }
    const data = snap.data() as Record<string, unknown>;
    const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : undefined;
    if (currentUid && ownerUid === currentUid) {
      return { available: true, verified: true, usernameKey, ownerUid };
    }
    return {
      available: false,
      verified: true,
      usernameKey,
      ownerUid,
      reason: USERNAME_TAKEN_ERROR,
      errorCode: 'taken',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return {
      available: false,
      verified: false,
      usernameKey,
      errorCode: 'unverified',
      reason: USERNAME_UNVERIFIED_ERROR,
    };
  }
}

export async function claimUsernameInFirestore(params: {
  user: User;
  displayName: string;
  previousDisplayName?: string;
}): Promise<{ ok: boolean; usernameKey: string; reason?: string }> {
  const { user, displayName, previousDisplayName } = params;
  const fmt = validateUsernameFormat(displayName);
  const usernameKey = fmt.key || normalizeUsernameKey(displayName);
  if (!fmt.ok) {
    return { ok: false, usernameKey, reason: fmt.reason };
  }
  if (!user.emailVerified || usernameKey.length < 3) {
    return { ok: false, usernameKey };
  }

  const prevKey = previousDisplayName ? normalizeUsernameKey(previousDisplayName) : '';
  const path = `usernames/${usernameKey}`;

  try {
    const result = await runTransaction(db, async (tx) => {
      const targetRef = doc(db, 'usernames', usernameKey);
      const targetSnap = await tx.get(targetRef);

      if (targetSnap.exists()) {
        const existingOwner = targetSnap.data()?.ownerUid;
        if (existingOwner && existingOwner !== user.uid) {
          return {
            ok: false,
            usernameKey,
            reason: USERNAME_TAKEN_ERROR,
          };
        }
      }

      if (prevKey && prevKey !== usernameKey && prevKey.length >= 3) {
        const prevRef = doc(db, 'usernames', prevKey);
        const prevSnap = await tx.get(prevRef);
        if (prevSnap.exists() && prevSnap.data()?.ownerUid === user.uid) {
          tx.delete(prevRef);
        }
      }

      tx.set(
        targetRef,
        {
          usernameKey,
          displayName: displayName.trim().slice(0, 18),
          ownerUid: user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );

      return { ok: true, usernameKey };
    });

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    return { ok: false, usernameKey, reason: 'Kullanıcı adı rezervasyonu tamamlanamadı.' };
  }
}

function firestoreTimestampToMs(val: unknown): number | undefined {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function') {
    const ms = (val as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : undefined;
  }
  return undefined;
}

function parseAuthoritativeUserBackup(
  userId: string,
  raw: Record<string, unknown>
): UserBackupRecord | null {
  const progressionRaw =
    typeof raw.progressionJson === 'string' ? JSON.parse(raw.progressionJson) : null;
  if (!progressionRaw || typeof progressionRaw !== 'object') return null;

  const baseProg = progressionRaw as UserProgression;
  const serverWheelMs = firestoreTimestampToMs(raw.wheelLastSpinServerAt);
  const serverDailyMs = firestoreTimestampToMs(raw.dailyChallengeLastServerAt);
  const serverPingMs =
    firestoreTimestampToMs(raw.serverClockPingAt) ?? firestoreTimestampToMs(raw.updatedAt);
  if (serverPingMs) {
    calibrateServerTimeOffset(serverPingMs);
  }

  const authoritativeCoins =
    typeof raw.coins === 'number' && Number.isFinite(raw.coins)
      ? Math.max(0, Math.round(raw.coins))
      : Math.max(0, Math.round(baseProg.coins ?? 0));
  const authoritativeWeeklyPoints =
    typeof raw.weeklyPoints === 'number' && Number.isFinite(raw.weeklyPoints)
      ? Math.max(0, Math.round(raw.weeklyPoints))
      : Math.max(0, Math.round(baseProg.weeklyPoints ?? 0));
  const authoritativeTotalPoints =
    typeof raw.totalPoints === 'number' && Number.isFinite(raw.totalPoints)
      ? Math.max(0, Math.round(raw.totalPoints))
      : Math.max(0, Math.round(baseProg.totalPoints ?? 0));
  const authoritativeUnlocked = Array.isArray(raw.unlockedGiftIds)
    ? raw.unlockedGiftIds.filter((id): id is string => typeof id === 'string')
    : Array.isArray(baseProg.unlockedGiftIds)
    ? baseProg.unlockedGiftIds
    : [];

  const authoritativeProgression: UserProgression = {
    ...baseProg,
    coins: authoritativeCoins,
    weeklyPoints: authoritativeWeeklyPoints,
    totalPoints: authoritativeTotalPoints,
    unlockedGiftIds: Array.from(new Set(authoritativeUnlocked)),
    adFree: typeof raw.adFree === 'boolean' ? raw.adFree : Boolean(baseProg.adFree),
    permanentMultiplier2x:
      typeof raw.permanentMultiplier2x === 'boolean'
        ? raw.permanentMultiplier2x
        : Boolean(baseProg.permanentMultiplier2x),
    wheelLastFreeSpinAt: serverWheelMs ?? baseProg.wheelLastFreeSpinAt,
    dailyChallengeLastPlayedAt: serverDailyMs ?? baseProg.dailyChallengeLastPlayedAt,
  };

  return {
    userId: String(raw.userId || userId),
    displayName: String(raw.displayName || 'Oyuncu'),
    usernameKey: typeof raw.usernameKey === 'string' ? raw.usernameKey : undefined,
    email: String(raw.email || ''),
    avatar: String(raw.avatar || '⚽'),
    favoriteClubId:
      typeof raw.favoriteClubId === 'string' && raw.favoriteClubId
        ? raw.favoriteClubId
        : undefined,
    progression: authoritativeProgression,
  };
}

export async function loadUserBackupFromFirestore(
  userId: string
): Promise<UserBackupRecord | null> {
  const path = `users/${userId}`;
  try {
    let snap;
    try {
      snap = await getDocFromServer(doc(db, 'users', userId));
    } catch {
      snap = await getDoc(doc(db, 'users', userId));
    }
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    return parseAuthoritativeUserBackup(userId, raw);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function syncServerClockWithFirestore(user: User | null): Promise<number | null> {
  if (!user) return null;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const beforeLocal = Date.now();
    await updateDoc(userDocRef, {
      serverClockPingAt: serverTimestamp(),
    }).catch(() => {});
    const snap = await getDocFromServer(userDocRef);
    const afterLocal = Date.now();
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;
    const serverMs =
      firestoreTimestampToMs(raw.serverClockPingAt) ?? firestoreTimestampToMs(raw.updatedAt);
    if (serverMs) {
      const midLocal = Math.round((beforeLocal + afterLocal) / 2);
      calibrateServerTimeOffset(serverMs, midLocal);
      return serverMs;
    }
    return null;
  } catch {
    return null;
  }
}

export function subscribeUserAuthoritativeBackup(params: {
  userId: string;
  onBackup: (backup: UserBackupRecord) => void;
}): () => void {
  const { userId, onBackup } = params;
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      const parsed = parseAuthoritativeUserBackup(
        userId,
        snap.data() as Record<string, unknown>
      );
      if (parsed) {
        onBackup(parsed);
      }
    },
    () => {
      // Ignore transient listener errors gracefully
    }
  );
}

export async function saveUserBackupToFirestore(params: {
  user: User;
  profile: PlayerProfile;
  progression: UserProgression;
  favoriteClubId?: string;
  recordWheelSpin?: boolean;
  recordDailyChallenge?: boolean;
}): Promise<void> {
  const {
    user,
    profile,
    progression,
    favoriteClubId,
    recordWheelSpin = false,
    recordDailyChallenge = false,
  } = params;
  if (user.email && !user.emailVerified) return;

  const displayName = (profile.name || user.displayName || 'Oyuncu').trim().slice(0, 64);
  const usernameKey = normalizeUsernameKey(displayName);

  const safeCoins = Math.max(0, Math.round(progression.coins ?? 0));
  const safeWeeklyPoints = Math.max(0, Math.round(progression.weeklyPoints ?? 0));
  const safeTotalPoints = Math.max(0, Math.round(progression.totalPoints ?? 0));
  const safeUnlockedIds = Array.from(
    new Set((progression.unlockedGiftIds || []).filter((id): id is string => typeof id === 'string'))
  ).slice(0, 500);

  const path = `users/${user.uid}`;
  const payload: Record<string, unknown> = {
    userId: user.uid,
    displayName,
    email: (user.email || '').slice(0, 254),
    avatar: (profile.avatar || '⚽').slice(0, 64),
    coins: safeCoins,
    weeklyPoints: safeWeeklyPoints,
    totalPoints: safeTotalPoints,
    unlockedGiftIds: safeUnlockedIds,
    adFree: Boolean(progression.adFree),
    permanentMultiplier2x: Boolean(progression.permanentMultiplier2x),
    progressionJson: JSON.stringify(progression).slice(0, 99000),
    updatedAt: serverTimestamp(),
  };

  if (recordWheelSpin) {
    payload.wheelLastSpinServerAt = serverTimestamp();
  }
  if (recordDailyChallenge) {
    payload.dailyChallengeLastServerAt = serverTimestamp();
  }

  if (usernameKey.length >= 3 && usernameKey.length <= 32) {
    payload.usernameKey = usernameKey;
  }

  if (favoriteClubId && favoriteClubId.trim().length > 0) {
    payload.favoriteClubId = favoriteClubId.slice(0, 64);
  }

  try {
    await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
    if (recordWheelSpin || recordDailyChallenge) {
      void syncServerClockWithFirestore(user);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface PublicActivityPayload {
  id: string;
  type: FriendNotificationType;
  title: string;
  code?: string;
  score?: number;
}

export async function savePublicProfileToFirestore(params: {
  user: User;
  profile: PlayerProfile;
  progression: UserProgression;
  activity?: PublicActivityPayload;
}): Promise<void> {
  const { user, profile, progression, activity } = params;
  if (!user.emailVerified) return;

  const rawDisplayName = (profile.name || user.displayName || '').trim().slice(0, 32);
  if (rawDisplayName.length < 3) return;
  const fmt = validateUsernameFormat(rawDisplayName);
  if (!fmt.ok && !isLegacyFlaggedUsername(rawDisplayName)) return;
  const displayName = sanitizePublicDisplayName(rawDisplayName, user.uid);
  const usernameKey = normalizeUsernameKey(rawDisplayName);
  if (usernameKey.length < 3 || usernameKey.length > 32) return;

  const statsSnapshot = {
    matchesPlayed: Math.max(0, Math.round(progression.matchesPlayed || 0)),
    wins: Math.max(0, Math.round(progression.wins || 0)),
    losses: Math.max(0, Math.round(progression.losses || 0)),
    winStreak: Math.max(0, Math.round(progression.winStreak || 0)),
    bestWinStreak: Math.max(0, Math.round(progression.bestWinStreak || 0)),
    totalCorrectAnswers: Math.max(0, Math.round(progression.totalCorrectAnswers || 0)),
    totalWrongAttempts: Math.max(0, Math.round(progression.totalWrongAttempts || 0)),
    fastestAnswerSec:
      typeof progression.fastestAnswerSec === 'number' && Number.isFinite(progression.fastestAnswerSec)
        ? Number(progression.fastestAnswerSec.toFixed(2))
        : null,
    clutchAnswers: Math.max(0, Math.round(progression.clutchAnswers || 0)),
    minigameMatchCounts: {
      two_clubs: Math.max(0, Math.round(progression.minigameMatchCounts?.two_clubs || 0)),
      silhouette: Math.max(0, Math.round(progression.minigameMatchCounts?.silhouette || 0)),
      xox: Math.max(0, Math.round(progression.minigameMatchCounts?.xox || 0)),
      career: Math.max(0, Math.round(progression.minigameMatchCounts?.career || 0)),
      country_club: Math.max(0, Math.round(progression.minigameMatchCounts?.country_club || 0)),
    },
    dailyStreakDays: Math.max(0, Math.round(progression.dailyLogin?.streakDays || 0)),
    tournamentWins: Math.max(0, Math.round(progression.tournamentWins || 0)),
    tournamentsPlayed: Math.max(0, Math.round(progression.tournamentsPlayed || 0)),
  };

  const payload: Record<string, unknown> = {
    usernameKey,
    ownerUid: user.uid,
    displayName,
    avatar: (profile.avatar || '⚽').slice(0, 64),
    hasCrown: Boolean(progression.unlockedGiftIds?.includes('gift_title_legend')),
    weeklyPoints: Math.max(0, Math.round(progression.weeklyPoints || 0)),
    totalPoints: Math.max(0, Math.round(progression.totalPoints || 0)),
    statsJson: JSON.stringify(statsSnapshot).slice(0, 16000),
    updatedAt: serverTimestamp(),
  };

  if (progression.friendCode && progression.friendCode.trim().length > 0) {
    payload.friendCode = progression.friendCode.trim().slice(0, 12);
  }
  if (profile.favoriteClubId && profile.favoriteClubId.trim().length > 0) {
    payload.favoriteClubId = profile.favoriteClubId.trim().slice(0, 64);
  }
  if (progression.equippedTitle && progression.equippedTitle.trim().length > 0) {
    payload.equippedTitle = progression.equippedTitle.trim().slice(0, 48);
  }
  if (progression.equippedCrest && progression.equippedCrest.trim().length > 0) {
    payload.equippedCrest = progression.equippedCrest.trim().slice(0, 64);
  }
  if (progression.equippedFrame && progression.equippedFrame.trim().length > 0) {
    payload.equippedFrame = progression.equippedFrame.trim().slice(0, 64);
  }
  if (progression.equippedBadge && progression.equippedBadge.trim().length > 0) {
    payload.equippedBadge = progression.equippedBadge.trim().slice(0, 16);
  }
  if (activity && activity.id.trim().length > 0) {
    payload.lastActivityId = activity.id.trim().slice(0, 64);
    payload.lastActivityType = activity.type;
    payload.lastActivityTitle = activity.title.trim().slice(0, 120);
    if (activity.code && activity.code.trim().length > 0) {
      payload.lastActivityCode = activity.code.trim().slice(0, 16);
    }
    if (typeof activity.score === 'number' && Number.isFinite(activity.score)) {
      payload.lastActivityScore = Math.max(0, Math.round(activity.score));
    }
  }

  const path = `publicProfiles/${usernameKey}`;
  try {
    await setDoc(doc(db, 'publicProfiles', usernameKey), payload, { merge: false });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function publishActivityToFirestore(params: {
  user: User | null;
  profile: PlayerProfile;
  progression: UserProgression;
  activity: PublicActivityPayload;
}): Promise<void> {
  const { user, profile, progression, activity } = params;
  if (!user || !user.emailVerified) return;
  await savePublicProfileToFirestore({ user, profile, progression, activity });
}

export function subscribeFriendProfilesInFirestore(params: {
  user: User | null;
  friends: FriendEntry[];
  onFriendActivity: (event: FriendActivityEvent) => void;
}): () => void {
  const { user, friends, onFriendActivity } = params;
  if (!user || !user.emailVerified || friends.length === 0) {
    return () => {};
  }

  const keyToFriend = new Map<string, FriendEntry>();
  for (const friend of friends) {
    const key = normalizeUsernameKey(friend.name || '');
    if (key.length >= 3 && key.length <= 32 && !keyToFriend.has(key)) {
      keyToFriend.set(key, friend);
    }
    if (keyToFriend.size >= 15) break;
  }

  const unsubscribers: Array<() => void> = [];
  const lastSeenIdByKey = new Map<string, string | null>();

  for (const [usernameKey, friend] of keyToFriend.entries()) {
    const path = `publicProfiles/${usernameKey}`;
    const docRef = doc(db, 'publicProfiles', usernameKey);

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          if (!lastSeenIdByKey.has(usernameKey)) {
            lastSeenIdByKey.set(usernameKey, null);
          }
          return;
        }
        const raw = snap.data() as Record<string, unknown>;
        const actId = typeof raw.lastActivityId === 'string' ? raw.lastActivityId : null;

        // First snapshot initializes baseline without firing stale notifications
        if (!lastSeenIdByKey.has(usernameKey)) {
          lastSeenIdByKey.set(usernameKey, actId);
          return;
        }

        const prevId = lastSeenIdByKey.get(usernameKey);
        if (!actId || actId === prevId) return;
        lastSeenIdByKey.set(usernameKey, actId);

        const rawType = raw.lastActivityType;
        if (rawType !== 'tournament_started' && rawType !== 'high_score') return;

        const actorName =
          typeof raw.displayName === 'string' && raw.displayName.trim()
            ? raw.displayName.trim()
            : friend.name;
        const actorAvatar =
          typeof raw.avatar === 'string' && raw.avatar.trim()
            ? raw.avatar.trim()
            : friend.avatar || '⚽';
        const titleText =
          typeof raw.lastActivityTitle === 'string' ? raw.lastActivityTitle : '';
        const tournamentCode =
          typeof raw.lastActivityCode === 'string' ? raw.lastActivityCode : undefined;
        const scoreValue =
          typeof raw.lastActivityScore === 'number' && Number.isFinite(raw.lastActivityScore)
            ? raw.lastActivityScore
            : undefined;

        onFriendActivity({
          id: actId,
          type: rawType,
          actorId:
            typeof raw.ownerUid === 'string' && raw.ownerUid ? raw.ownerUid : friend.id,
          actorFriendCode:
            typeof raw.friendCode === 'string' ? raw.friendCode : friend.friendCode,
          actorName,
          actorAvatar,
          title:
            rawType === 'tournament_started'
              ? `${actorName} yeni turnuva başlattı!`
              : `${actorName} yüksek skor yaptı!`,
          message: titleText,
          tournamentCode,
          tournamentTitle: rawType === 'tournament_started' ? titleText : undefined,
          scoreValue,
          createdAt: Date.now(),
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (err) {
          console.warn('Firestore friend listener error:', err);
        }
      }
    );

    unsubscribers.push(unsub);
  }

  return () => {
    for (const unsub of unsubscribers) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
  };
}

export async function fetchPublicProfileFromFirestore(
  rawNameOrKey: string
): Promise<PublicPlayerProfile | null> {
  const usernameKey = normalizeUsernameKey(rawNameOrKey);
  if (usernameKey.length < 3 || usernameKey.length > 32) return null;

  const path = `publicProfiles/${usernameKey}`;
  try {
    const snap = await getDoc(doc(db, 'publicProfiles', usernameKey));
    if (!snap.exists()) return null;
    const raw = snap.data() as Record<string, unknown>;

    let parsedStats: Record<string, unknown> = {};
    if (typeof raw.statsJson === 'string') {
      try {
        const obj = JSON.parse(raw.statsJson);
        if (obj && typeof obj === 'object') {
          parsedStats = obj as Record<string, unknown>;
        }
      } catch {
        // ignore invalid stats JSON
      }
    }

    const rawCounts =
      parsedStats.minigameMatchCounts && typeof parsedStats.minigameMatchCounts === 'object'
        ? (parsedStats.minigameMatchCounts as Record<string, unknown>)
        : {};
    const minigameMatchCounts: Record<MinigameType, number> = {
      two_clubs: Math.max(0, Number(rawCounts.two_clubs) || 0),
      silhouette: Math.max(0, Number(rawCounts.silhouette) || 0),
      xox: Math.max(0, Number(rawCounts.xox) || 0),
      career: Math.max(0, Number(rawCounts.career) || 0),
      country_club: Math.max(0, Number(rawCounts.country_club) || 0),
    };

    return {
      id: String(raw.ownerUid || usernameKey),
      usernameKey,
      friendCode: typeof raw.friendCode === 'string' ? raw.friendCode : undefined,
      name: String(raw.displayName || rawNameOrKey),
      avatar: String(raw.avatar || '⚽'),
      favoriteClubId: typeof raw.favoriteClubId === 'string' ? raw.favoriteClubId : undefined,
      subtitle: typeof raw.equippedTitle === 'string' ? raw.equippedTitle : undefined,
      equippedCrest: typeof raw.equippedCrest === 'string' ? raw.equippedCrest : undefined,
      equippedFrame: typeof raw.equippedFrame === 'string' ? raw.equippedFrame : undefined,
      equippedBadge: typeof raw.equippedBadge === 'string' ? raw.equippedBadge : undefined,
      hasCrown: Boolean(raw.hasCrown),
      weeklyPoints: Math.max(0, Number(raw.weeklyPoints) || 0),
      totalPoints: Math.max(0, Number(raw.totalPoints) || 0),
      matchesPlayed: Math.max(0, Number(parsedStats.matchesPlayed) || 0),
      wins: Math.max(0, Number(parsedStats.wins) || 0),
      losses: Math.max(0, Number(parsedStats.losses) || 0),
      winStreak: Math.max(0, Number(parsedStats.winStreak) || 0),
      bestWinStreak: Math.max(0, Number(parsedStats.bestWinStreak) || 0),
      totalCorrectAnswers: Math.max(0, Number(parsedStats.totalCorrectAnswers) || 0),
      totalWrongAttempts: Math.max(0, Number(parsedStats.totalWrongAttempts) || 0),
      fastestAnswerSec:
        typeof parsedStats.fastestAnswerSec === 'number' && Number.isFinite(parsedStats.fastestAnswerSec)
          ? parsedStats.fastestAnswerSec
          : null,
      clutchAnswers: Math.max(0, Number(parsedStats.clutchAnswers) || 0),
      minigameMatchCounts,
      dailyStreakDays: Math.max(0, Number(parsedStats.dailyStreakDays) || 0),
      tournamentWins: Math.max(0, Number(parsedStats.tournamentWins) || 0),
      tournamentsPlayed: Math.max(0, Number(parsedStats.tournamentsPlayed) || 0),
      updatedAt: Date.now(),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return null;
  }
}

export async function submitUserReportToFirestore(params: {
  reporterUid: string;
  targetId: string;
  targetName: string;
  reason: UserReportReason;
  details?: string;
}): Promise<{ ok: boolean }> {
  try {
    const cleanTargetId = String(params.targetId || '').trim().slice(0, 128);
    const cleanTargetName = String(params.targetName || 'Oyuncu').trim().slice(0, 64);
    const reportId = `rep_${params.reporterUid.slice(0, 16)}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    await setDoc(doc(db, 'userReports', reportId), {
      reporterUid: params.reporterUid,
      targetId: cleanTargetId,
      targetName: cleanTargetName,
      reason: params.reason,
      details: String(params.details || '').trim().slice(0, 300),
      createdAt: serverTimestamp(),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}