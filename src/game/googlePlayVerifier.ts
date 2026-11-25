import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  findGooglePlaySkuByItemId,
  findGooglePlaySkuByProductId,
  findRestorableGooglePlaySkuByItemId,
  findRestorableGooglePlaySkuByProductId,
} from './billingCatalog.js';

export interface GooglePlayServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface GooglePlayProductReceipt {
  purchaseState?: number; // 0 = Purchased, 1 = Canceled, 2 = Pending
  consumptionState?: number;
  acknowledgementState?: number;
  orderId?: string;
  obfuscatedExternalAccountId?: string;
}

export interface VerifyGooglePlayResult {
  verified: boolean;
  statusCode: number;
  error?: string;
  orderId?: string;
  productId?: string;
  itemId?: string;
}

const DEFAULT_PACKAGE_NAME = 'com.futbol321.challenge';

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function parseGooglePlayServiceAccount(
  rawEnv: string | undefined = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
): GooglePlayServiceAccountCredentials | null {
  const trimmed = rawEnv?.trim();
  if (!trimmed) return null;

  let jsonText = trimmed;
  if (!trimmed.startsWith('{') && fs.existsSync(trimmed)) {
    try {
      jsonText = fs.readFileSync(trimmed, 'utf8');
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<GooglePlayServiceAccountCredentials>;
    if (
      typeof parsed.client_email === 'string' &&
      parsed.client_email.includes('@') &&
      typeof parsed.private_key === 'string' &&
      parsed.private_key.includes('BEGIN PRIVATE KEY')
    ) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, '\n'),
        token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifyGooglePlayProductReceipt(params: {
  itemId: string;
  productId: string;
  purchaseToken: string;
  packageName?: string;
  allowLegacyRestore?: boolean;
  serviceAccount?: GooglePlayServiceAccountCredentials | null;
  fetchImpl?: typeof fetch;
}): Promise<VerifyGooglePlayResult> {
  const cleanItemId = String(params.itemId || '').trim();
  const cleanProductId = String(params.productId || '').trim();
  const cleanToken = String(params.purchaseToken || '').trim();

  if (!cleanToken || cleanToken.length < 16 || !/^[a-zA-Z0-9._-]+$/.test(cleanToken)) {
    return {
      verified: false,
      statusCode: 400,
      error: 'Geçersiz veya eksik Google Play satın alma jetonu.',
    };
  }

  const byItem = params.allowLegacyRestore
    ? findRestorableGooglePlaySkuByItemId(cleanItemId)
    : findGooglePlaySkuByItemId(cleanItemId);
  const byProd = params.allowLegacyRestore
    ? findRestorableGooglePlaySkuByProductId(cleanProductId)
    : findGooglePlaySkuByProductId(cleanProductId);
  const sku = byItem && byProd && byItem.productId === byProd.productId ? byItem : null;
  if (!sku) {
    return {
      verified: false,
      statusCode: 400,
      error: 'Ürün aktif Play Store kataloğunda yer almıyor veya SKU eşleşmiyor.',
    };
  }

  const creds = params.serviceAccount !== undefined
    ? params.serviceAccount
    : parseGooglePlayServiceAccount();

  if (!creds) {
    return {
      verified: false,
      statusCode: 503,
      error:
        'Google Play sunucu doğrulaması yapılandırılmamış (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON eksik).',
    };
  }

  const fetcher = params.fetchImpl ?? fetch;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const tokenUri = creds.token_uri || 'https://oauth2.googleapis.com/token';
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64UrlEncode(
      JSON.stringify({
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: tokenUri,
        iat: nowSec,
        exp: nowSec + 3600,
      })
    );
    const unsignedJwt = `${header}.${claims}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedJwt);
    const signature = base64UrlEncode(signer.sign(creds.private_key));
    const assertion = `${unsignedJwt}.${signature}`;

    const tokenRes = await fetcher(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(
        assertion
      )}`,
    });
    if (!tokenRes.ok) {
      return {
        verified: false,
        statusCode: 502,
        error: 'Google Play OAuth2 erişim jetonu alınamadı.',
      };
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return {
        verified: false,
        statusCode: 502,
        error: 'Google Play OAuth2 yanıtı geçersiz.',
      };
    }

    const pkg = encodeURIComponent(params.packageName || DEFAULT_PACKAGE_NAME);
    const prod = encodeURIComponent(sku.productId);
    const tok = encodeURIComponent(cleanToken);
    const receiptRes = await fetcher(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/products/${prod}/tokens/${tok}`,
      {
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
        },
      }
    );

    if (!receiptRes.ok) {
      return {
        verified: false,
        statusCode: receiptRes.status === 404 || receiptRes.status === 400 ? 400 : 502,
        error: 'Google Play makbuzu doğrulanamadı veya iptal edilmiş.',
      };
    }

    const receipt = (await receiptRes.json()) as GooglePlayProductReceipt;
    if (receipt.purchaseState !== 0) {
      return {
        verified: false,
        statusCode: 402,
        error:
          receipt.purchaseState === 2
            ? 'Ödeme Google Play üzerinde henüz beklemede.'
            : 'Satın alma iptal edilmiş veya tamamlanmamış.',
      };
    }

    return {
      verified: true,
      statusCode: 200,
      orderId: receipt.orderId,
      productId: sku.productId,
      itemId: sku.itemId,
    };
  } catch {
    return {
      verified: false,
      statusCode: 502,
      error: 'Google Play doğrulama servisine bağlanılamadı.',
    };
  }
}
