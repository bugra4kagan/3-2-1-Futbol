#!/usr/bin/env node
/**
 * 3-2-1 Futbol — Canli Firebase Uygunsuz Kullanici Adi Yedekleme & Migrasyon Araci
 *
 * Kullanim:
 *   $env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content -Raw "C:\guvenli\service-account.json"
 *   $env:BACKUP_PASSPHRASE = "en-az-12-karakter-guclu-parola"   # Opsiyonel ama onerilir
 *
 *   # 1) Salt-okunur onizleme (hicbir veri degistirmez):
 *   node --import tsx scripts/migrate-live-usernames.mjs --dry-run
 *
 *   # 2) Yedek alarak canli migrasyonu uygula:
 *   node --import tsx scripts/migrate-live-usernames.mjs --confirm
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import {
  generateRandomUniqueStarterName,
  isLegacyFlaggedUsername,
  normalizeUsernameKey,
} from '../src/game/accountEngine.ts';
import {
  MIN_BACKUP_PASSPHRASE_LENGTH,
  encryptBackupPayload,
  exportFirebaseSparkBackup,
} from '../src/game/firebaseBackup.ts';

const DEFAULT_RTDB_URL = 'https://futbol-9013e-default-rtdb.europe-west1.firebasedatabase.app';

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON ortam degiskeni tanimli degil.');
  }
  return JSON.parse(raw);
}

async function main() {
  const isConfirm = hasFlag('--confirm');
  const isDryRun = !isConfirm || hasFlag('--dry-run');

  const sa = getServiceAccount();
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(sa),
      databaseURL: (process.env.FIREBASE_DATABASE_URL || DEFAULT_RTDB_URL).trim(),
    });
  }

  const db = getFirestore();
  const rtdb = getDatabase();

  // 1. Pre-migration backup when --confirm is active
  if (!isDryRun) {
    const backupsDir = path.resolve(process.cwd(), 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshot = await exportFirebaseSparkBackup({
      db,
      rtdb,
      projectId: sa.project_id || null,
    });
    const pass = (process.env.BACKUP_PASSPHRASE || '').trim();
    if (pass.length >= MIN_BACKUP_PASSPHRASE_LENGTH) {
      const encPath = path.join(backupsDir, `pre-username-migration-${stamp}.json.enc`);
      fs.writeFileSync(encPath, JSON.stringify(encryptBackupPayload(snapshot, pass), null, 2));
      console.log(`[BACKUP] Sifreli yedek olusturuldu: ${encPath}`);
    } else {
      const rawPath = path.join(backupsDir, `pre-username-migration-${stamp}.json`);
      fs.writeFileSync(rawPath, JSON.stringify(snapshot, null, 2));
      console.log(`[BACKUP] Yedek olusturuldu: ${rawPath}`);
    }
  }

  // 2. Load existing accounts, users, usernames, publicProfiles, and RTDB leaderboard
  const [accountsSnap, usersSnap, usernamesSnap, publicProfilesSnap, rtdbLbSnap] =
    await Promise.all([
      db.collection('backend_accounts').get(),
      db.collection('users').get(),
      db.collection('usernames').get(),
      db.collection('publicProfiles').get(),
      rtdb.ref('leaderboard').once('value'),
    ]);

  const takenKeys = new Set();
  for (const doc of accountsSnap.docs) {
    const k = normalizeUsernameKey(doc.data()?.username || doc.data()?.profile?.name || '');
    if (k) takenKeys.add(k);
  }
  for (const doc of usernamesSnap.docs) {
    takenKeys.add(doc.id);
  }

  const renamedByAccountId = new Map();
  const renamedByUid = new Map();
  const accountUpdates = [];

  // 3. Scan backend_accounts
  for (const doc of accountsSnap.docs) {
    const data = doc.data() || {};
    const currentName = String(data.profile?.name || data.username || '').trim();
    if (!isLegacyFlaggedUsername(currentName)) continue;

    const newName = generateRandomUniqueStarterName(takenKeys);
    const newKey = normalizeUsernameKey(newName);
    takenKeys.add(newKey);

    const oldKey = String(data.usernameKey || normalizeUsernameKey(currentName) || '').trim();
    renamedByAccountId.set(doc.id, { oldName: currentName, newName, oldKey, newKey });
    if (data.googleUid) {
      renamedByUid.set(data.googleUid, { oldName: currentName, newName, oldKey, newKey });
    }
    accountUpdates.push({ ref: doc.ref, data, newName, newKey });
  }

  // 4. Scan users/{uid} not covered by backend_accounts
  const userUpdates = [];
  for (const doc of usersSnap.docs) {
    const data = doc.data() || {};
    const mapped = renamedByUid.get(doc.id);
    const currentName = String(data.displayName || '').trim();
    if (!mapped && !isLegacyFlaggedUsername(currentName)) continue;

    const chosen =
      mapped ||
      (() => {
        const newName = generateRandomUniqueStarterName(takenKeys);
        const newKey = normalizeUsernameKey(newName);
        takenKeys.add(newKey);
        const oldKey = String(data.usernameKey || normalizeUsernameKey(currentName) || '').trim();
        const entry = { oldName: currentName, newName, oldKey, newKey };
        renamedByUid.set(doc.id, entry);
        return entry;
      })();

    userUpdates.push({ ref: doc.ref, data, ...chosen });
  }

  // 5. Scan RTDB leaderboard
  const rtdbLb = rtdbLbSnap.val() || {};
  const rtdbUpdates = {};
  for (const [id, entry] of Object.entries(rtdbLb)) {
    if (!entry || typeof entry !== 'object') continue;
    const mapped = renamedByAccountId.get(id);
    const currentName = String(entry.name || '').trim();
    if (!mapped && !isLegacyFlaggedUsername(currentName)) continue;

    const newName = mapped ? mapped.newName : generateRandomUniqueStarterName(takenKeys);
    const newKey = mapped ? mapped.newKey : normalizeUsernameKey(newName);
    if (!mapped) {
      takenKeys.add(newKey);
      renamedByAccountId.set(id, {
        oldName: currentName,
        newName,
        oldKey: normalizeUsernameKey(currentName),
        newKey,
      });
    }
    rtdbUpdates[`${id}/name`] = newName;
    rtdbUpdates[`${id}/usernameKey`] = newKey;
  }

  console.log(
    JSON.stringify({
      mode: isDryRun ? 'dry-run' : 'confirm',
      scannedAccounts: accountsSnap.size,
      scannedUsers: usersSnap.size,
      scannedLeaderboard: Object.keys(rtdbLb).length,
      totalFlaggedAccounts: accountUpdates.length,
      totalFlaggedUsers: userUpdates.length,
      totalFlaggedLeaderboard: Object.keys(rtdbUpdates).length / 2,
    })
  );

  if (isDryRun) {
    console.log('[DRY-RUN] Hicbir canli kayit degistirilmedi. Uygulamak icin --confirm kullanin.');
    try { rtdb.goOffline(); } catch {}
    process.exit(0);
  }

  // 6. Apply Firestore updates preserving coins, weeklyPoints, totalPoints, purchases, and progress
  for (const u of accountUpdates) {
    const nextFriends = Array.isArray(u.data.progression?.friends)
      ? u.data.progression.friends.map((f) => {
          const r = f?.id ? renamedByAccountId.get(f.id) : null;
          return r ? { ...f, name: r.newName } : f;
        })
      : u.data.progression?.friends;

    await u.ref.set(
      {
        username: u.newName,
        usernameKey: u.newKey,
        profile: { ...(u.data.profile || {}), name: u.newName },
        ...(nextFriends ? { progression: { ...u.data.progression, friends: nextFriends } } : {}),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  }

  for (const u of userUpdates) {
    let nextProgJson = u.data.progressionJson;
    if (typeof nextProgJson === 'string' && nextProgJson.startsWith('{')) {
      try {
        const parsed = JSON.parse(nextProgJson);
        if (Array.isArray(parsed.friends)) {
          parsed.friends = parsed.friends.map((f) => {
            const r = f?.id ? renamedByAccountId.get(f.id) : null;
            return r ? { ...f, name: r.newName } : f;
          });
        }
        nextProgJson = JSON.stringify(parsed);
      } catch {
        // leave original JSON untouched
      }
    }

    await u.ref.set(
      {
        displayName: u.newName,
        usernameKey: u.newKey,
        ...(typeof nextProgJson === 'string' ? { progressionJson: nextProgJson } : {}),
      },
      { merge: true }
    );

    if (u.oldKey && u.oldKey !== u.newKey) {
      await db.collection('usernames').doc(u.oldKey).delete().catch(() => {});
      const oldPub = await db.collection('publicProfiles').doc(u.oldKey).get();
      if (oldPub.exists) {
        const pubData = oldPub.data() || {};
        await db.collection('publicProfiles').doc(u.newKey).set({
          ...pubData,
          displayName: u.newName,
          usernameKey: u.newKey,
        });
        await oldPub.ref.delete().catch(() => {});
      }
    }
    await db
      .collection('usernames')
      .doc(u.newKey)
      .set({ ownerUid: u.ref.id, displayName: u.newName }, { merge: true });
  }

  if (Object.keys(rtdbUpdates).length > 0) {
    await rtdb.ref('leaderboard').update(rtdbUpdates);
  }

  console.log(
    `[MIGRATION COMPLETE] Replaced ${renamedByAccountId.size} account(s) and ${userUpdates.length} user doc(s) with zero coin/LP loss.`
  );
  try { rtdb.goOffline(); } catch {}
  process.exit(0);
}

main().catch((err) => {
  console.error('[MIGRATION ERROR]', err?.message || err);
  process.exit(1);
});
