import type { Request } from 'express';
import { AccountStore, PersistentAccountRecord } from './accountStore.js';
import { isLegacyFlaggedUsername } from './accountEngine.js';
import { SlidingRateLimiter } from './serverSecurity.js';
import { PlayerProfile, PublicPlayerProfile, UserProgression } from './types.js';

export interface VerifiedFirebaseCaller {
  uid: string;
  email?: string;
  email_verified?: boolean;
  firebase?: {
    sign_in_provider?: string;
  };
}

export interface CloudStateSyncPayload {
  uid: string;
  accountId: string;
  profile: PlayerProfile;
  progression: UserProgression;
  email?: string;
}

export interface AccountHttpDeps {
  accountStore: AccountStore;
  verifyFirebaseBearerToken: (token?: string) => Promise<VerifiedFirebaseCaller | null>;
  syncAuthoritativeUserStateAdmin: (
    payload: CloudStateSyncPayload
  ) => Promise<{ syncedFirestore: boolean; syncedRtdb: boolean }>;
  buildPublicProfileFromRecord: (record: PersistentAccountRecord) => PublicPlayerProfile;
  liveLeaderboard: Map<string, PublicPlayerProfile>;
  rateLimiter?: SlidingRateLimiter;
  clientRateKey?: string;
}

export interface AccountHttpResponse {
  status: number;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
}

export function readAccountTokenFromHeaders(
  getHeader: (name: string) => string | undefined
): string | undefined {
  const direct = getHeader('x-account-token');
  if (direct && direct.trim()) return direct.trim();
  const authHeader = getHeader('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export function expressHeaderReader(req: Request): (name: string) => string | undefined {
  return (name: string) => req.header(name);
}

interface VerifiedCallerAuthResult {
  ok: true;
  cleanId: string;
  verifiedUser: VerifiedFirebaseCaller | null;
  verifiedGoogleUid: string | undefined;
  targetAccountId: string;
  existing: PersistentAccountRecord | undefined;
  accountToken: string | undefined;
}

type CallerAuthFailure = {
  ok: false;
  response: AccountHttpResponse;
};

async function authenticateAccountMutationCaller(params: {
  deps: AccountHttpDeps;
  cleanId: string;
  requestedGoogleUid: string;
  rawFirebaseToken?: string;
  accountToken?: string;
  allowAdoptExistingGoogleAccount: boolean;
  unauthorizedExistingMessage: string;
}): Promise<VerifiedCallerAuthResult | CallerAuthFailure> {
  const {
    deps,
    cleanId,
    requestedGoogleUid,
    rawFirebaseToken,
    accountToken,
    allowAdoptExistingGoogleAccount,
    unauthorizedExistingMessage,
  } = params;

  const verifiedTokenUser = rawFirebaseToken
    ? await deps.verifyFirebaseBearerToken(rawFirebaseToken)
    : null;
  const verifiedUser =
    verifiedTokenUser && verifiedTokenUser.firebase?.sign_in_provider !== 'anonymous'
      ? verifiedTokenUser
      : null;

  if (rawFirebaseToken && !verifiedUser) {
    return {
      ok: false,
      response: {
        status: 401,
        body: { ok: false, error: 'Geçersiz Firebase oturum tokenı.' },
      },
    };
  }
  if (verifiedUser && requestedGoogleUid && requestedGoogleUid !== verifiedUser.uid) {
    return {
      ok: false,
      response: {
        status: 403,
        body: { ok: false, error: 'Google kimlik eşleşmesi doğrulanamadı.' },
      },
    };
  }

  let existing = (await deps.accountStore.resolveByAccountIdAsync(cleanId)) ?? undefined;
  const directTokenOk = existing
    ? deps.accountStore.verifyAccountSession(cleanId, accountToken)
    : false;

  if (requestedGoogleUid && !verifiedUser) {
    // Eski istemci uyumluluğu: yalnızca geçerli oturum tokenına sahip ve aynı UID'ye zaten bağlı hesapta izin ver.
    if (!existing || !directTokenOk || existing.googleUid !== requestedGoogleUid) {
      return {
        ok: false,
        response: {
          status: 401,
          body: {
            ok: false,
            error: 'Google hesabı doğrulaması için geçerli Firebase kimlik tokenı gereklidir.',
          },
        },
      };
    }
  }

  const verifiedGoogleUid = verifiedUser?.uid;
  let targetAccountId = cleanId;
  if (verifiedGoogleUid) {
    const existingByGoogle = await deps.accountStore.getByGoogleUidAsync(verifiedGoogleUid);
    if (existingByGoogle && existingByGoogle.accountId !== cleanId) {
      if (allowAdoptExistingGoogleAccount && !existing) {
        targetAccountId = existingByGoogle.accountId;
        existing = existingByGoogle;
      } else {
        return {
          ok: false,
          response: {
            status: 409,
            body: {
              ok: false,
              errorCode: 'google_already_linked',
              error: 'Bu Google hesabı zaten başka bir oyuncu hesabına bağlıdır.',
            },
          },
        };
      }
    }
  }

  if (existing) {
    if (existing.googleUid && verifiedGoogleUid && existing.googleUid !== verifiedGoogleUid) {
      return {
        ok: false,
        response: {
          status: 403,
          body: {
            ok: false,
            error: 'Bu hesap başka bir Google hesabına bağlıdır.',
          },
        },
      };
    }
    const targetTokenOk = deps.accountStore.verifyAccountSession(targetAccountId, accountToken);
    const sameVerifiedGoogle = Boolean(
      verifiedGoogleUid && existing.googleUid && existing.googleUid === verifiedGoogleUid
    );
    if (!targetTokenOk && !sameVerifiedGoogle) {
      return {
        ok: false,
        response: {
          status: 401,
          body: { ok: false, error: unauthorizedExistingMessage },
        },
      };
    }
  }

  return {
    ok: true,
    cleanId,
    verifiedUser,
    verifiedGoogleUid,
    targetAccountId,
    existing,
    accountToken,
  };
}

function checkLimiter(deps: AccountHttpDeps): AccountHttpResponse | null {
  if (!deps.rateLimiter) return null;
  const check = deps.rateLimiter.consume(deps.clientRateKey || 'default');
  if (!check.allowed) {
    return {
      status: 429,
      headers: { 'Retry-After': String(check.retryAfterSec) },
      body: {
        ok: false,
        error: 'Çok fazla istek gönderildi. Lütfen kısa süre bekleyip tekrar dene.',
      },
    };
  }
  return null;
}

/**
 * `/api/accounts/register` isteğini doğrular, yeni hesaplarda sunucu sabit 200 Coin / 180 Puan
 * başlangıcını uygular ve doğrulanmış Google kullanıcıları için Firestore/RTDB durumunu yazar.
 */
export async function handleAccountRegisterRequest(params: {
  deps: AccountHttpDeps;
  body: Record<string, unknown> | undefined;
  getHeader: (name: string) => string | undefined;
}): Promise<AccountHttpResponse> {
  const limited = checkLimiter(params.deps);
  if (limited) return limited;

  const body = params.body || {};
  const accountId = body.accountId;
  const profile = body.profile as PlayerProfile | undefined;
  const progression = body.progression as UserProgression | undefined;
  const rawGoogleUid = body.googleUid;

  if (!accountId || !profile?.name || !progression) {
    return {
      status: 400,
      body: { ok: false, error: 'Hesap bilgileri eksik.' },
    };
  }

  const cleanId = String(accountId).trim().slice(0, 64);
  const requestedGoogleUid = typeof rawGoogleUid === 'string' ? rawGoogleUid.trim() : '';

  const authCheck = await authenticateAccountMutationCaller({
    deps: params.deps,
    cleanId,
    requestedGoogleUid,
    rawFirebaseToken: params.getHeader('x-firebase-id-token'),
    accountToken: readAccountTokenFromHeaders(params.getHeader),
    allowAdoptExistingGoogleAccount: true,
    unauthorizedExistingMessage: 'Hesap güncelleme yetkisi doğrulanamadı.',
  });
  if (!authCheck.ok) {
    return authCheck.response;
  }

  const { existing, targetAccountId, verifiedUser, verifiedGoogleUid } = authCheck;
  const effectiveProfile: PlayerProfile = existing
    ? {
        ...profile,
        id: targetAccountId,
        name: existing.username || profile.name,
      }
    : profile;

  const result = params.deps.accountStore.registerOrUpdate({
    accountId: targetAccountId,
    profile: effectiveProfile,
    progression,
    googleUid: verifiedGoogleUid,
    strictServerStarter: true,
  });

  if (!result.ok) {
    return {
      status: result.status,
      body: {
        ok: false,
        errorCode: result.errorCode,
        error: result.reason,
        suggestions: result.suggestions || [],
      },
    };
  }

  const acc = result.account;
  const sessionToken = params.deps.accountStore.issueSessionTokenForAccount(acc);
  params.deps.liveLeaderboard.set(acc.accountId, params.deps.buildPublicProfileFromRecord(acc));

  let cloudSync: { syncedFirestore: boolean; syncedRtdb: boolean } | undefined;
  if (verifiedUser && (!verifiedUser.email || verifiedUser.email_verified !== false)) {
    cloudSync = await params.deps.syncAuthoritativeUserStateAdmin({
      uid: verifiedUser.uid,
      accountId: acc.accountId,
      profile: acc.profile,
      progression: acc.progression,
      email: verifiedUser.email,
    });
  }

  return {
    status: 200,
    body: {
      ok: true,
      sessionToken,
      requiresUsernameRename: isLegacyFlaggedUsername(acc.profile?.name || acc.username),
      ...(cloudSync ? { cloudSync } : {}),
      account: {
        accountId: acc.accountId,
        recoveryCode: acc.recoveryCode,
        profile: acc.profile,
        progression: acc.progression,
      },
    },
  };
}

/**
 * `/api/accounts/sync` isteğini doğrular, sunucu oturumu / Firebase ID token kontrolü yapar
 * ve sıkı ilerleme doğrulaması ile günceller.
 */
export async function handleAccountSyncRequest(params: {
  deps: AccountHttpDeps;
  body: Record<string, unknown> | undefined;
  getHeader: (name: string) => string | undefined;
}): Promise<AccountHttpResponse> {
  const limited = checkLimiter(params.deps);
  if (limited) return limited;

  const body = params.body || {};
  const accountId = body.accountId;
  const profile = body.profile as PlayerProfile | undefined;
  const progression = body.progression as UserProgression | undefined;
  const rawGoogleUid = body.googleUid;

  if (!accountId || !progression) {
    return {
      status: 400,
      body: { ok: false, error: 'Senkronizasyon verisi eksik.' },
    };
  }

  const cleanId = String(accountId).trim().slice(0, 64);
  const requestedGoogleUid = typeof rawGoogleUid === 'string' ? rawGoogleUid.trim() : '';

  const authCheck = await authenticateAccountMutationCaller({
    deps: params.deps,
    cleanId,
    requestedGoogleUid,
    rawFirebaseToken: params.getHeader('x-firebase-id-token'),
    accountToken: readAccountTokenFromHeaders(params.getHeader),
    allowAdoptExistingGoogleAccount: false,
    unauthorizedExistingMessage: 'Senkronizasyon yetkisi doğrulanamadı.',
  });
  if (!authCheck.ok) {
    return authCheck.response;
  }

  const { verifiedUser, verifiedGoogleUid } = authCheck;
  const syncRes = params.deps.accountStore.syncProgression({
    accountId: cleanId,
    profile,
    progression,
    googleUid: verifiedGoogleUid,
    strictActionVerification: true,
    strictServerStarter: true,
  });
  if (!syncRes.ok || !syncRes.account) {
    return {
      status: 200,
      body: { ok: false },
    };
  }

  const sessionToken = params.deps.accountStore.issueSessionTokenForAccount(syncRes.account);
  params.deps.liveLeaderboard.set(
    syncRes.account.accountId,
    params.deps.buildPublicProfileFromRecord(syncRes.account)
  );

  if (verifiedUser && (!verifiedUser.email || verifiedUser.email_verified !== false)) {
    await params.deps.syncAuthoritativeUserStateAdmin({
      uid: verifiedUser.uid,
      accountId: syncRes.account.accountId,
      profile: syncRes.account.profile,
      progression: syncRes.account.progression,
      email: verifiedUser.email,
    });
  }

  return {
    status: 200,
    body: {
      ok: true,
      sessionToken,
      recoveryCode: syncRes.account.recoveryCode,
    },
  };
}
