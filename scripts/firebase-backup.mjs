#!/usr/bin/env node
/**
 * 3-2-1 Futbol — Ucretsiz Firebase Spark Plani Yedekleme & Geri Yukleme Araci
 *
 * Google Cloud Storage (Blaze plani) gerektirmez; Firebase Admin SDK uzerinden
 * Firestore koleksiyonlarini ve Realtime Database liderlik tablosunu yerel JSON + SHA-256
 * dosyasina aktarir ve dogrular.
 *
 * GUVENLIK:
 * - Yedekler yalnizca gitignore icindeki yerel `backups/` dizinine yazilir (asla GitHub'a yuklenmez).
 * - Servis hesabi anahtarlari (FIREBASE_SERVICE_ACCOUNT_JSON) konsola veya yedek dosyasina asla yazilmaz.
 *
 * KULLANIM:
 *   node --import tsx scripts/firebase-backup.mjs --export [--out backups/custom.json]
 *   node --import tsx scripts/firebase-backup.mjs --verify backups/firebase-backup-....json
 *   node --import tsx scripts/firebase-backup.mjs --restore backups/firebase-backup-....json --dry-run
 *   node --import tsx scripts/firebase-backup.mjs --restore backups/firebase-backup-....json --confirm
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import {
  captureSecurityRulesSnapshot,
  exportFirebaseSparkBackup,
  restoreFirebaseSparkBackup,
  restoreSecurityRulesToDirectory,
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

function initAdminClients() {
  const rawServiceAccount = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const isEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_DATABASE_EMULATOR_HOST);
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
  return { db, rtdb, projectId };
}

async function main() {
  const isExport = hasFlag('--export');
  const verifyPath = getArgValue('--verify');
  const restorePath = getArgValue('--restore');

  if (!isExport && !verifyPath && !restorePath) {
    console.error(
      'Kullanim:\n' +
        '  node --import tsx scripts/firebase-backup.mjs --export [--out backups/dosya.json]\n' +
        '  node --import tsx scripts/firebase-backup.mjs --verify <yedek.json>\n' +
        '  node --import tsx scripts/firebase-backup.mjs --restore <yedek.json> --dry-run|--confirm'
    );
    process.exit(1);
  }

  if (verifyPath) {
    const resolved = path.resolve(process.cwd(), verifyPath);
    const raw = fs.readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(raw);
    const res = verifyFirebaseSparkBackup(parsed);
    if (!res.ok) {
      console.error('[VERIFY FAIL]', res.error);
      process.exit(1);
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          file: path.basename(resolved),
          schemaVersion: parsed.schemaVersion,
          rosterVersion: parsed.rosterVersion,
          createdAtIso: parsed.createdAtIso,
          checksumSha256: parsed.checksumSha256,
          counts: parsed.counts,
        },
        null,
        2
      )
    );
    return;
  }

  if (isExport) {
    const { db, rtdb, projectId } = initAdminClients();
    const securityRules = captureSecurityRulesSnapshot(process.cwd());
    const snapshot = await exportFirebaseSparkBackup({ db, rtdb, projectId, securityRules });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outArg = getArgValue('--out');
    const outPath = path.resolve(
      process.cwd(),
      outArg || path.join('backups', `firebase-backup-${stamp}.json`)
    );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), { encoding: 'utf8', mode: 0o600 });
    console.log(
      JSON.stringify(
        {
          ok: true,
          outputFile: outPath,
          schemaVersion: snapshot.schemaVersion,
          rosterVersion: snapshot.rosterVersion,
          checksumSha256: snapshot.checksumSha256,
          securityRulesBackedUp: Boolean(snapshot.securityRules),
          counts: snapshot.counts,
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
    const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    const rulesOutDir = getArgValue('--restore-rules-dir');
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
    const rulesRestore = rulesOutDir
      ? restoreSecurityRulesToDirectory({
          snapshot: parsed,
          targetDir: path.resolve(process.cwd(), rulesOutDir),
          dryRun,
        })
      : null;
    console.log(JSON.stringify({ ...report, rulesRestore }, null, 2));
    if (!report.ok || (rulesRestore && !rulesRestore.ok)) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('[FIREBASE BACKUP ERROR]', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
