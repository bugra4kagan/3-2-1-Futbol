/* eslint-disable no-restricted-globals */
/**
 * 3-2-1 Futbol — iOS Safari & Mobil PWA Service Worker
 *
 * - Her üretim derlemesinde `__SW_VERSION__` build commit + zaman damgası ile güncellenir.
 * - HTML navigasyon isteklerinde Network-First (`cache: 'no-store'`) kullanarak kullanıcıların
 *   uygulamayı silip tekrar yüklemeden yeni sürüme geçmesini sağlar.
 * - Aktif maç ortasında otomatik sayfa yenilemesi YAPMAZ; kullanıcı "Güncelle" dediğinde
 *   `SKIP_WAITING` mesajı ile temiz geçiş yapar.
 * - Yalnızca Cache Storage'daki eski sürüm önbelleklerini temizler; localStorage, IndexedDB,
 *   Firebase Auth oturumu, coin, lig puanı ve kullanıcı tercihlerine ASLA dokunmaz.
 */

const SW_VERSION = '__SW_VERSION__';
const CACHE_PREFIX = '321futbol-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}${SW_VERSION}`;
const SHELL_URLS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Sadece aynı origin (GitHub Pages / web barındırma) isteklerini önbellekle;
  // Render API, Firebase, WebSocket veya harici istekleri doğrudan ağa bırak.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/sw.js')) return;

  // Navigasyon / index.html: her zaman önce ağdan en güncel sürümü çek (iOS PWA için kritik)
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  // Hash'li JS/CSS paketleri ve görseller: mevcut sürüm önbelleğinden hızlı sun + arka planda tazele
  const isStaticAsset =
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/icons/') ||
    url.pathname.includes('/players/') ||
    url.pathname.includes('/data/') ||
    /\.(?:js|css|webp|png|svg|json|woff2?)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const networkPromise = fetch(req)
          .then((response) => {
            if (response && response.ok && response.type === 'basic') {
              cache.put(req, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    )
  );
});
