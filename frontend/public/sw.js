/* Newoon MIS service worker.
 * Caches only the application shell (HTML, hashed JS/CSS, brand images) so the installed app opens quickly and
 * shows an offline message instead of a browser error. It NEVER caches /api responses, uploads or any other
 * request that could contain client or KYC data.
 * Bump CACHE_VERSION to drop every cached file after a breaking change.
 */
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `newoon-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `newoon-assets-${CACHE_VERSION}`;
const MAX_ASSET_ENTRIES = 120;
const SHELL_URLS = ['/', '/brand/newoon-logo.png', '/brand/newoon-mark.png', '/favicon.ico', '/site.webmanifest'];

self.addEventListener('install', (event) => {
  // Pre-cache best effort: a single file that fails to load must not stop the worker from installing.
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(
          SHELL_URLS.map((url) =>
            fetch(url, { cache: 'no-cache' }).then((response) => (response.ok ? cache.put(url, response) : undefined))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('newoon-') && key !== SHELL_CACHE && key !== ASSET_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only same-origin application files. API calls and everything else go straight to the network.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  if (request.mode === 'navigate') {
    // Network first so deployments show immediately; the cached shell is only an offline fallback.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/', { cacheName: SHELL_CACHE }).then((cached) => cached || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // Vite file names contain a content hash, so a cached copy never goes stale.
    event.respondWith(
      caches.match(request, { cacheName: ASSET_CACHE }).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy).then(() => trimCache(cache)));
            }
            return response;
          })
      )
    );
    return;
  }

  if (/^\/(brand\/|favicon|icon-|apple-touch-icon|site\.webmanifest)/.test(url.pathname)) {
    // Brand files: serve the cached copy at once and refresh it in the background.
    event.respondWith(
      caches.open(SHELL_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});

async function trimCache(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSET_ENTRIES))) await cache.delete(key);
}
