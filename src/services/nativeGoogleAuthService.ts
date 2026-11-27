import { Capacitor } from '@capacitor/core';

/**
 * google-services.json (`client_type: 3`) içinde tanımlı Web OAuth Client ID.
 * Yerel Android Credential Manager `GetSignInWithGoogleOption` bu değeri
 * `R.string.default_web_client_id` üzerinden okur; JS yedek olarak aynı
 * genel Web Client ID'yi geçirir (gizli anahtar içermez).
 */
export const GOOGLE_WEB_CLIENT_ID =
  '895309340693-66pejel7tsshmdj40vuedkfm1066keis.apps.googleusercontent.com';

export interface NativeGoogleAuthResult {
  ok: boolean;
  idToken?: string;
  email?: string;
  displayName?: string;
  code?: string;
  message?: string;
}

export interface NativeGoogleAuthBridge {
  isAvailable?: () => Promise<{ available: boolean; provider?: string }>;
  signIn: (opts?: { serverClientId?: string }) => Promise<NativeGoogleAuthResult>;
  signOut?: () => Promise<{ ok: boolean; message?: string }>;
}

export interface NativeGoogleAuthEnv {
  isNativeAndroid?: () => boolean;
  getBridge?: () => NativeGoogleAuthBridge | null;
}

function defaultIsNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function defaultGetBridge(): NativeGoogleAuthBridge | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    Capacitor?: {
      Plugins?: {
        GoogleAuth?: NativeGoogleAuthBridge;
      };
    };
  };
  return win.Capacitor?.Plugins?.GoogleAuth ?? null;
}

export function isNativeAndroidGoogleAuthPlatform(env?: NativeGoogleAuthEnv): boolean {
  return env?.isNativeAndroid ? env.isNativeAndroid() : defaultIsNativeAndroid();
}

export async function signInWithNativeAndroidGoogle(
  env?: NativeGoogleAuthEnv
): Promise<{ idToken: string; email?: string; displayName?: string }> {
  if (!isNativeAndroidGoogleAuthPlatform(env)) {
    throw new Error('native-google-auth-android-only');
  }

  const bridge = env?.getBridge ? env.getBridge() : defaultGetBridge();
  if (!bridge || typeof bridge.signIn !== 'function') {
    throw new Error('native-google-plugin-unavailable');
  }

  const res = await bridge.signIn({ serverClientId: GOOGLE_WEB_CLIENT_ID });
  if (!res?.ok || !res.idToken) {
    const code = String(res?.code || '').trim();
    const msg = String(res?.message || '').trim();
    if (code === 'USER_CANCELED' || msg.toLowerCase().includes('popup-closed-by-user')) {
      throw new Error('popup-closed-by-user');
    }
    if (code === 'NO_CREDENTIAL' || msg.toLowerCase().includes('no-google-credential')) {
      throw new Error('native-google-no-credential');
    }
    throw new Error(msg || code || 'native-google-signin-failed');
  }

  return {
    idToken: res.idToken.trim(),
    email: res.email,
    displayName: res.displayName,
  };
}

export async function signOutNativeAndroidGoogle(env?: NativeGoogleAuthEnv): Promise<void> {
  if (!isNativeAndroidGoogleAuthPlatform(env)) return;
  const bridge = env?.getBridge ? env.getBridge() : defaultGetBridge();
  if (!bridge || typeof bridge.signOut !== 'function') return;
  try {
    await bridge.signOut();
  } catch {
    // Sessiz çıkış temizliği
  }
}

export interface FirebaseGoogleCredentialExchangeDeps<TCred, TUser> {
  authStateReady?: () => Promise<void>;
  getCurrentUser: () => (TUser & { isAnonymous?: boolean }) | null;
  buildGoogleCredential: (idToken: string) => TCred;
  linkWithCredential: (user: TUser, cred: TCred) => Promise<{ user: TUser }>;
  signInWithCredential: (cred: TCred) => Promise<{ user: TUser }>;
}

/**
 * Android Credential Manager'dan alınan Google ID Token'ını Firebase Auth oturumuna bağlar.
 * Anonim misafir varsa `linkWithCredential` dener; Google hesabı zaten kayıtlıysa
 * (`credential-already-in-use`) mevcut Google oturumuna geçiş yapar.
 */
export async function exchangeGoogleIdTokenWithFirebase<TCred, TUser>(
  idToken: string,
  deps: FirebaseGoogleCredentialExchangeDeps<TCred, TUser>
): Promise<TUser> {
  if (typeof deps.authStateReady === 'function') {
    await deps.authStateReady();
  }
  const cred = deps.buildGoogleCredential(idToken);
  const current = deps.getCurrentUser();
  if (current && current.isAnonymous) {
    try {
      const linked = await deps.linkWithCredential(current, cred);
      return linked.user;
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (
        code.includes('credential-already-in-use') ||
        code.includes('email-already-in-use')
      ) {
        const signedIn = await deps.signInWithCredential(cred);
        return signedIn.user;
      }
      throw err;
    }
  }
  const signedIn = await deps.signInWithCredential(cred);
  return signedIn.user;
}
