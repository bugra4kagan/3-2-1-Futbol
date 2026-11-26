import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BRAND_LOGO_ALT, BRAND_LOGO_SRC, BRAND_PUBLIC_LOGO_PATH } from './brandAssets';

const REPO = process.cwd();

test('official 3-2-1 Futbol brand logo assets use optimized WebP, clean PWA/favicon icons, and remove legacy logos', () => {
  assert.ok(BRAND_LOGO_ALT.includes('3-2-1 Futbol'));
  assert.ok(String(BRAND_LOGO_SRC).length > 0);
  assert.equal(BRAND_PUBLIC_LOGO_PATH, './icons/icon-512.webp');

  // Legacy oversized logo assets removed
  for (const legacyPath of [
    'src/assets/brand-logo.jpg',
    'public/logo.jpg',
    'public/logo.png',
    'public/logo.svg',
    'android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml',
  ]) {
    assert.equal(fs.existsSync(path.join(REPO, legacyPath)), false, `Legacy logo still exists: ${legacyPath}`);
  }

  // Optimized UI WebP asset exists and stays compact
  const uiWebp = path.join(REPO, 'public', 'icons', 'brand-logo.webp');
  assert.ok(fs.existsSync(uiWebp), 'Missing public/icons/brand-logo.webp');
  const uiWebpSize = fs.statSync(uiWebp).size;
  assert.ok(uiWebpSize > 10_000 && uiWebpSize < 120_000, `Unexpected WebP logo size: ${uiWebpSize}`);

  // High-resolution source & standalone 512x512 Google Play Store icon preserved outside public/dist
  const origMaster = path.join(REPO, 'branding', '321-futbol-logo-original.jpg');
  const playIcon512 = path.join(REPO, 'branding', 'google-play-icon-512x512.png');
  assert.ok(fs.existsSync(origMaster), 'Missing original master logo in branding/');
  assert.ok(fs.existsSync(playIcon512), 'Missing 512x512 Google Play icon in branding/');

  // Check PNG IHDR dimensions for 512x512 Play Store icon
  const playBuf = fs.readFileSync(playIcon512);
  assert.equal(playBuf.readUInt32BE(16), 512, 'Google Play icon width must be 512');
  assert.equal(playBuf.readUInt32BE(20), 512, 'Google Play icon height must be 512');

  // Web favicons & PWA icons
  for (const pubIcon of [
    'public/favicon-32x32.png',
    'public/favicon-48x48.png',
    'public/apple-touch-icon.png',
    'public/icons/icon-192.webp',
    'public/icons/icon-192.png',
    'public/icons/icon-512.webp',
    'public/icons/icon-512-maskable.png',
  ]) {
    assert.ok(fs.existsSync(path.join(REPO, pubIcon)), `Missing web/PWA icon: ${pubIcon}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'public', 'manifest.json'), 'utf8')) as {
    icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  };
  assert.ok(manifest.icons.some((i) => i.src === './icons/icon-192.webp' && i.type === 'image/webp'));
  assert.ok(manifest.icons.some((i) => i.src === './icons/icon-512-maskable.png' && i.purpose === 'maskable'));

  const indexHtml = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('./favicon-32x32.png'));
  assert.ok(indexHtml.includes('./apple-touch-icon.png'));
  assert.ok(indexHtml.includes('./icons/icon-192.webp'));
  assert.equal(indexHtml.includes('./logo.png'), false);
  assert.equal(indexHtml.includes('./logo.svg'), false);
});

test('Android adaptive background, launcher mipmaps, round icons, and splash drawables match exact specs', () => {
  const bgColorXml = fs.readFileSync(
    path.join(REPO, 'android/app/src/main/res/values/ic_launcher_background.xml'),
    'utf8'
  );
  assert.ok(bgColorXml.includes('#011837'), 'Adaptive icon background color should match official navy #011837');

  const expectedMipmaps: Array<[string, number, number]> = [
    ['mipmap-mdpi', 48, 108],
    ['mipmap-hdpi', 72, 162],
    ['mipmap-xhdpi', 96, 216],
    ['mipmap-xxhdpi', 144, 324],
    ['mipmap-xxxhdpi', 192, 432],
  ];
  for (const [folder, legacyPx, adaptivePx] of expectedMipmaps) {
    for (const file of ['ic_launcher.png', 'ic_launcher_round.png']) {
      const buf = fs.readFileSync(path.join(REPO, 'android/app/src/main/res', folder, file));
      assert.equal(buf.readUInt32BE(16), legacyPx, `${folder}/${file} width mismatch`);
      assert.equal(buf.readUInt32BE(20), legacyPx, `${folder}/${file} height mismatch`);
    }
    const fgBuf = fs.readFileSync(path.join(REPO, 'android/app/src/main/res', folder, 'ic_launcher_foreground.png'));
    assert.equal(fgBuf.readUInt32BE(16), adaptivePx, `${folder}/ic_launcher_foreground.png width mismatch`);
    assert.equal(fgBuf.readUInt32BE(20), adaptivePx, `${folder}/ic_launcher_foreground.png height mismatch`);
  }

  for (const splashFolder of [
    'drawable',
    'drawable-port-mdpi',
    'drawable-port-hdpi',
    'drawable-port-xhdpi',
    'drawable-port-xxhdpi',
    'drawable-port-xxxhdpi',
    'drawable-land-mdpi',
    'drawable-land-hdpi',
    'drawable-land-xhdpi',
    'drawable-land-xxhdpi',
    'drawable-land-xxxhdpi',
  ]) {
    const splashPath = path.join(REPO, 'android/app/src/main/res', splashFolder, 'splash.png');
    assert.ok(fs.existsSync(splashPath), `Missing splash drawable: ${splashFolder}/splash.png`);
    assert.ok(fs.statSync(splashPath).size > 2000);
  }
});
