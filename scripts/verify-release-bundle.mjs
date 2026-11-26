import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..');

/**
 * Otomatik Yayın Paketi Güvenlik Denetimi
 * Kişisel ekran görüntüsü, WhatsApp görseli, servis hesabı anahtarı, keystore,
 * parola veya Firebase yedek dosyalarının `public/` veya `dist/` içine sızmasını engeller.
 */
const FORBIDDEN_PATH_PATTERNS = [
  /(^|\/|\\)aistudio(\/|\\|$)/i,
  /(^|\/|\\)players(\/|\\|$)/i,
  /ekran_g/i,
  /whatsapp[_ -]?image/i,
  /screenshot[_ -]?\d/i,
  /(^|\/|\\)backups(\/|\\|$)/i,
  /\.enc(\.json)?$/i,
  /\.jks$/i,
  /\.keystore$/i,
  /\.pem$/i,
  /\.p12$/i,
  /firebase-adminsdk.*\.json$/i,
  /service[-_]?account.*\.json$/i,
  /(^|\/|\\)\.env(\..+)?$/i,
];

const SECRET_CONTENT_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /"private_key"\s*:\s*"-----BEGIN/,
  /FIREBASE_SERVICE_ACCOUNT_JSON\s*=/,
  /GOOGLE_PLAY_SERVICE_ACCOUNT_JSON\s*=/,
];

function walkFiles(dir, baseDir = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, baseDir));
    } else if (entry.isFile()) {
      results.push({
        full,
        rel: path.relative(baseDir, full).replace(/\\/g, '/'),
      });
    }
  }
  return results;
}

export function scanReleaseDirectory(targetDir) {
  const violations = [];
  const files = walkFiles(targetDir);
  for (const file of files) {
    for (const pat of FORBIDDEN_PATH_PATTERNS) {
      if (pat.test(file.rel)) {
        violations.push(`FORBIDDEN_FILE: ${file.rel} (matched ${pat})`);
        break;
      }
    }
    const ext = path.extname(file.rel).toLowerCase();
    if (['.js', '.mjs', '.cjs', '.json', '.html', '.txt', '.css', '.xml'].includes(ext)) {
      const stat = fs.statSync(file.full);
      if (stat.size <= 8 * 1024 * 1024) {
        const text = fs.readFileSync(file.full, 'utf8');
        for (const pat of SECRET_CONTENT_PATTERNS) {
          if (pat.test(text)) {
            violations.push(`SECRET_CONTENT: ${file.rel} (matched ${pat})`);
          }
        }
      }
    }
  }
  return { scannedCount: files.length, violations };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const targets = [path.join(REPO, 'public'), path.join(REPO, 'dist')];
  let totalFiles = 0;
  const allViolations = [];
  for (const dir of targets) {
    if (!fs.existsSync(dir)) continue;
    const { scannedCount, violations } = scanReleaseDirectory(dir);
    totalFiles += scannedCount;
    for (const v of violations) {
      allViolations.push(`${path.basename(dir)}/${v}`);
    }
  }
  if (allViolations.length > 0) {
    console.error('[BUNDLE SECURITY CHECK FAILED]');
    for (const v of allViolations) console.error('  -', v);
    process.exit(1);
  }
  console.log(`[BUNDLE SECURITY CHECK OK] Scanned ${totalFiles} files across public/ and dist/ — 0 violations.`);
}
