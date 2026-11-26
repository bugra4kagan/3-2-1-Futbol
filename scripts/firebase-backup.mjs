#!/usr/bin/env node
/**
 * 3-2-1 Futbol — Ucretsiz Firebase Spark Plani Sifreli Yedekleme & Geri Yukleme Araci
 *
 * Google Cloud Storage (Blaze plani) gerektirmez; Firebase Admin SDK uzerinden:
 *   1) Firestore kalici koleksiyonlari (8 koleksiyon) + RTDB leaderboard verisini,
 *   2) Canli Firebase'de YAYINDA olan Firestore & RTDB guvenlik kurallarini (Git aday kurallariyla karistirmadan),
 *   3) Ayri dosya olarak Firebase Authentication kullanicilarini
 * AES-256-GCM + scrypt ile sifrelenmis ve SHA-256 dogrulamali olarak yerel `backups/` dizinine aktarir.
 *
 * GUVENLIK:
 * - Yedekler yalnizca gitignore icindeki yerel `backups/` dizinine yazilir (asla GitHub'a yuklenmez).
 * - Servis hesabi anahtarlari (FIREBASE_SERVICE_ACCOUNT_JSON) ve parola (BACKUP_PASSPHRASE) konsola/dosyaya asla yazilmaz.
 *
 * KULLANIM:
 *   $env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content -Raw "C:\guvenli\service-account.json"
 *   $env:BACKUP_PASSPHRASE = "en-az-12-karakter-guclu-parola"
 *
 *   node --import tsx scripts/firebase-backup.mjs --export [--out backups/custom.json.enc]
 *   node --import tsx scripts/firebase-backup.mjs --verify backups/firebase-data-backup-....json.enc
 *   node --import tsx scripts/firebase-backup.mjs --verify backups/firebase-auth-backup-....json.enc
 *   node --import tsx scripts/firebase-backup.mjs --restore backups/firebase-data-backup-....json.enc --dry-run
 *   node --import tsx scripts/firebase-backup.mjs --restore backups/firebase-data-backup-....json.enc --confirm [--restore-live-rules-dir backups/restored-live-rules]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getSecurityRules } from 'firebase-admin/security-rules';
import {
  MIN_BACKUP_PASSPHRASE_LENGTH,
  captureSecurityRulesSnapshot,
  decryptBackupPayload,
  encryptBackupPayload,
  exportFirebaseAuthUsersBackup,
  exportFirebaseSparkBackup,
  fetchLiveSecurityRulesBackup,
  isEncryptedBackupEnvelope,
  restoreFirebaseSparkBackup,
  restoreLiveSecurityRulesToDirectory,
  restoreSecurityRulesToDirectory,
  verifyFirebaseAuthBackup,
  verifyFirebaseSparkBackup,
} from '../src/game/firebaseBackup.ts';

const DEFAULT_RTDB_URL = 'https://futbol-9013e-default-rtdb.europe-west1.firebasedatabase.app';

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function requirePassphraseIfNeeded(allowPlaintext) {
  const pass = (process.env.BACKUP_PASSPHRASE || '').trim();
  if (pass.length >= MIN_BACKUP_PASSPHRASE_LENGTH) {
    return pass;
  }
  if (allowPlaintext) {
    return null;
  }
  throw new Error(
    `BACKUP_PASSPHRASE ortam degiskeni en az ${MIN_BACKUP_PASSPHRASE_LENGTH} karakter olmalidir ` +
      '(sifresiz izole emulator testi icin yalnizca --allow-plaintext bayragi kullanilabilir).'
  );
}

function readBackupObjectFromDisk(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!isEncryptedBackupEnvelope(raw)) {
    return { encrypted: false, data: raw };
  }
  const pass = (process.env.BACKUP_PASSPHRASE || '').trim();
  if (!pass) {
    throw new Error('Bu yedek AES-256-GCM ile sifrelidir; okumak icin BACKUP_PASSPHRASE ortam degiskenini ayarlayin.');
  }
  const decrypted = decryptBackupPayload(raw, pass);
  if (!decrypted.ok) {
    throw new Error(decrypted.error);
  }
  return { encrypted: true, data: decrypted.data };
}

function initAdminClients() {
  const rawServiceAccount = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_DATABASE_EMULATOR_HOST
  );
  const databaseURL = (process.env.FIREBASE_DATABASE_URL || DEFAULT_RTDB_URL).trim();

  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || null;

  if (getApps().length === 0) {
    if (rawServiceAccount) {
      let parsed;
      try {
        parsed = JSON.parse(rawServiceAccount);
      } catch {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON gecerli bir JSON degil.');
      }
      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON eksik alanlar iceriyor.');
      }
      projectId = parsed.project_id;
      initializeApp({
        credential: cert(parsed),
        projectId,
        databaseURL,
      });
    } else if (isEmulator) {
      projectId = projectId || 'demo-futbol321';
      initializeApp({
        projectId,
        databaseURL,
      });
    } else {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON ortam degiskeni tanimli degil (ve emulator aktif degil).'
      );
    }
  }

  const db = getFirestore();
  let rtdb = null;
  try {
    rtdb = getDatabase();
  } catch {
    rtdb = null;
  }
  let auth = null;
  try {
    auth = getAuth();
  } catch {
    auth = null;
  }
  let securityRulesApi = null;
  try {
    securityRulesApi = getSecurityRules();
  } catch {
    securityRulesApi = null;
  }
  return { db, rtdb, auth, securityRulesApi, projectId, isEmulator };
}

async function main() {
  const isExport = hasFlag('--export');
  const verifyPath = getArgValue('--verify');
  const restorePath = getArgValue('--restore');
  const allowPlaintext = hasFlag('--allow-plaintext');

  if (!isExport && !verifyPath && !restorePath) {
    console.error(
      'Kullanim:\n' +
        '  node --import tsx scripts/firebase-backup.mjs --export [--out backups/dosya.json.enc]\n' +
        '  node --import tsx scripts/firebase-backup.mjs --verify <yedek.json.enc>\n' +
        '  node --import tsx scripts/firebase-backup.mjs --restore <yedek.json.enc> --dry-run|--confirm [--restore-live-rules-dir <dizin>]'
    );
    process.exit(1);
  }

  if (verifyPath) {
    const resolved = path.resolve(process.cwd(), verifyPath);
    const { encrypted, data: parsed } = readBackupObjectFromDisk(resolved);
    const isAuthBackup = parsed && parsed.schemaVersion === '2026.11.26-auth-v1';
    const res = isAuthBackup ? verifyFirebaseAuthBackup(parsed) : verifyFirebaseSparkBackup(parsed);
    if (!res.ok) {
      console.error('[VERIFY FAIL]', res.error);
      process.exit(1);
    }
    console.log(
      JSON.stringify(
        isAuthBackup
          ? {
              ok: true,
              kind: 'firebase_auth',
              encrypted,
              file: path.basename(resolved),
              schemaVersion: parsed.schemaVersion,
              createdAtIso: parsed.createdAtIso,
              userCount: parsed.userCount,
              checksumSha256: parsed.checksumSha256,
            }
          : {
              ok: true,
              kind: 'firestore_rtdb_and_rules',
              encrypted,
              file: path.basename(resolved),
              schemaVersion: parsed.schemaVersion,
              rosterVersion: parsed.rosterVersion,
              createdAtIso: parsed.createdAtIso,
              checksumSha256: parsed.checksumSha256,
              hasLiveSecurityRules: Boolean(parsed.liveSecurityRules?.source === 'firebase_live'),
              liveFirestoreRuleset: parsed.liveSecurityRules?.firestoreRulesetName ?? null,
              hasGitCandidateRules: Boolean(parsed.securityRules),
              counts: parsed.counts,
            },
        null,
        2
      )
    );
    return;
  }

  if (isExport) {
    const passphrase = requirePassphraseIfNeeded(allowPlaintext);
    const { db, rtdb, auth, securityRulesApi, projectId, isEmulator } = initAdminClients();

    // 1. Canli Firebase'de yayinda olan kurallari Git aday kurallarindan ayri cek
    let liveSecurityRules = null;
    if (!isEmulator) {
      liveSecurityRules = await fetchLiveSecurityRulesBackup({
        securityRulesApi,
        rtdbRulesApi: rtdb,
      });
    }
    const candidateRepoRules = captureSecurityRulesSnapshot(process.cwd());

    // 2. Firestore kalici koleksiyonlar + RTDB leaderboard + canli kurallar
    const snapshot = await exportFirebaseSparkBackup({
      db,
      rtdb,
      projectId,
      securityRules: candidateRepoRules,
      liveSecurityRules,
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = passphrase ? '.json.enc' : '.json';
    const outArg = getArgValue('--out');
    const dataOutPath = path.resolve(
      process.cwd(),
      outArg || path.join('backups', `firebase-data-backup-${stamp}${ext}`)
    );
    fs.mkdirSync(path.dirname(dataOutPath), { recursive: true });
    const dataPayloadToWrite = passphrase ? encryptBackupPayload(snapshot, passphrase) : snapshot;
    fs.writeFileSync(dataOutPath, JSON.stringify(dataPayloadToWrite, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });

    // 3. Ayri Firebase Authentication kullanicilari yedegi
    let authSummary = null;
    if (auth && !hasFlag('--skip-auth')) {
      const authSnapshot = await exportFirebaseAuthUsersBackup({ auth, projectId });
      const authOutPath = path.resolve(
        process.cwd(),
        path.join('backups', `firebase-auth-backup-${stamp}${ext}`)
      );
      const authPayloadToWrite = passphrase
        ? encryptBackupPayload(authSnapshot, passphrase)
        : authSnapshot;
      fs.writeFileSync(authOutPath, JSON.stringify(authPayloadToWrite, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      authSummary = {
        outputFile: authOutPath,
        userCount: authSnapshot.userCount,
        checksumSha256: authSnapshot.checksumSha256,
        encrypted: Boolean(passphrase),
      };
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          encrypted: Boolean(passphrase),
          dataBackup: {
            outputFile: dataOutPath,
            schemaVersion: snapshot.schemaVersion,
            rosterVersion: snapshot.rosterVersion,
            checksumSha256: snapshot.checksumSha256,
            hasLiveSecurityRules: Boolean(liveSecurityRules?.source === 'firebase_live'),
            liveFirestoreRuleset: liveSecurityRules?.firestoreRulesetName ?? null,
            counts: snapshot.counts,
          },
          authBackup: authSummary,
        },
        null,
        2
      )
    );
    return;
  }

  if (restorePath) {
    const dryRun = hasFlag('--dry-run') || !hasFlag('--confirm');
    const resolved = path.resolve(process.cwd(), restorePath);
    const { encrypted, data: parsed } = readBackupObjectFromDisk(resolved);
    const liveRulesOutDir = getArgValue('--restore-live-rules-dir');
    const candidateRulesOutDir = getArgValue('--restore-rules-dir');
    const { db, rtdb } = initAdminClients();
    const report = await restoreFirebaseSparkBackup({
      db,
      rtdb,
      snapshot: parsed,
      options: {
        dryRun,
        includeLegacyUsersMirror: !hasFlag('--skip-legacy-users'),
        reconcileLegacyUsersWithAuthoritativeAccounts: true,
        timestampFactory: (iso) => Timestamp.fromDate(new Date(iso)),
      },
    });
    const liveRulesRestore = liveRulesOutDir
      ? restoreLiveSecurityRulesToDirectory({
          snapshot: parsed,
          targetDir: path.resolve(process.cwd(), liveRulesOutDir),
          dryRun,
        })
      : null;
    const candidateRulesRestore = candidateRulesOutDir
      ? restoreSecurityRulesToDirectory({
          snapshot: parsed,
          targetDir: path.resolve(process.cwd(), candidateRulesOutDir),
          dryRun,
        })
      : null;
    console.log(
      JSON.stringify(
        { encrypted, ...report, liveRulesRestore, candidateRulesRestore },
        null,
        2
      )
    );
    if (
      !report.ok ||
      (liveRulesRestore && !liveRulesRestore.ok) ||
      (candidateRulesRestore && !candidateRulesRestore.ok)
    ) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('[FIREBASE BACKUP ERROR]', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
