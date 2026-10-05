/* Overload service worker. Generated at build time from build/sw-template.js. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `overload-shell-${VERSION}`;
const PRECACHED = new Set(PRECACHE);

// Only the app's own static files are cached. Requests to Supabase (accounts and training
// data) and any other origin go straight to the network and are never stored here: private
// data lives only in the per-account IndexedDB database.

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('overload-') && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Every in-app address is the same single-page shell, so the app opens offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches
        .match('/', { cacheName: CACHE })
        .then((cached) => cached || fetch(request))
        .catch(() => fetch(request)),
    );
    return;
  }

  if (PRECACHED.has(url.pathname)) {
    event.respondWith(
      caches.match(url.pathname, { cacheName: CACHE }).then((cached) => cached || fetch(request)),
    );
  }
});
