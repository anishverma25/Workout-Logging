/* Overload service worker. Generated at build time from build/sw-template.js. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `overload-shell-${VERSION}`;
const PRECACHED = new Set(PRECACHE);
/** Remembers which cache the version before this one used, so its files outlive the update. */
const META = 'overload-meta';

// Only the app's own static files are cached. Requests to Supabase (accounts and training
// data) and any other origin go straight to the network and are never stored here: private
// data lives only in the per-account IndexedDB database.

self.addEventListener('install', (event) => {
  // A new version takes over as soon as it is downloaded: waiting for every window to close
  // left installed apps on an old version for days (Android keeps them open in the background).
  // Pages that are already open keep working, because the previous version's files stay cached.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

async function previousCache() {
  const meta = await caches.open(META);
  const res = await meta.match('/current');
  return res ? res.text() : null;
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const previous = await previousCache();
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.startsWith('overload-shell-') && key !== CACHE && key !== previous) {
          await caches.delete(key);
        }
      }
      if (previous !== CACHE) {
        await (await caches.open(META)).put('/current', new Response(CACHE));
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data !== 'skip-waiting') return;
  // A page asks to switch to this version. Waiting: switch, and the page reloads itself when
  // it sees the switch. Already switched (versions now switch by themselves, and pages from
  // before October 28 only reload on a switch they see happen): reload that page from here,
  // or its Reload button would do nothing.
  const me = self.serviceWorker;
  const active = me ? me.state === 'activated' : !self.registration.waiting;
  if (!active) {
    self.skipWaiting();
    return;
  }
  const page = event.source;
  if (page && 'navigate' in page) {
    event.waitUntil(page.navigate(page.url).catch(() => null));
  }
});

/** This version's copy first, then the previous version's (for pages opened before the update). */
async function cached(path) {
  return (await caches.match(path, { cacheName: CACHE })) || (await caches.match(path));
}

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
        .then((hit) => hit || fetch(request))
        .catch(() => fetch(request)),
    );
    return;
  }

  if (PRECACHED.has(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      cached(url.pathname)
        .then((hit) => hit || fetch(request))
        .catch(() => fetch(request)),
    );
  }
});
