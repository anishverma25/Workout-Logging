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

/**
 * The type a file must come back as. During a deploy, Cloudflare can briefly answer a new file
 * name with the old version's page (HTML, status 200) before the file reaches every data centre
 * (November 24, 2026: phones saved that page as the app's code and could not open). A file that
 * comes back as the wrong type is never stored or used.
 */
function looksRight(path, res) {
  if (!res || !res.ok || res.type === 'opaque' || res.redirected) return false;
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (path === '/' || path.endsWith('.html')) return type.includes('text/html');
  return !type.includes('text/html');
}

/** The app files a page links to, so the shell can be checked against this version's list. */
function linkedAssets(html) {
  return [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
}

/**
 * Downloads one file for this version, past the browser's own HTTP cache: `no-cache` checks
 * with the server, so a bad answer saved during a deploy is replaced, never reused. A wrong
 * answer is tried again fresh; still wrong, and the install fails, so the version people have
 * keeps working and the browser tries the update again later.
 */
async function download(path) {
  for (const mode of ['no-cache', 'reload', 'reload']) {
    let res;
    try {
      res = await fetch(path, { cache: mode, credentials: 'same-origin' });
    } catch {
      res = null;
    }
    if (looksRight(path, res)) {
      // Read in full now, so no download holds a connection open while the others wait.
      let body;
      try {
        body = await res.blob();
      } catch {
        body = null;
      }
      const whole = body && new Response(body, { status: res.status, headers: res.headers });
      // The page must be this version's page: every app file it links to is in this version.
      if (whole && (path !== '/' || linkedAssets(await body.text()).every((a) => PRECACHED.has(a))))
        return whole;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.warn(`Update postponed: ${path} is not ready on the server yet`);
  throw new Error(`Not ready yet: ${path}`);
}

self.addEventListener('install', (event) => {
  // A new version takes over as soon as it is downloaded: waiting for every window to close
  // left installed apps on an old version for days (Android keeps them open in the background).
  // Pages that are already open keep working, because the previous version's files stay cached.
  // Every file is downloaded and checked before anything is stored, a few at a time.
  event.waitUntil(
    (async () => {
      const got = new Map();
      const queue = [...PRECACHE];
      let failed = false;
      const worker = async () => {
        while (queue.length && !failed) {
          const path = queue.shift();
          try {
            got.set(path, await download(path));
          } catch (err) {
            failed = true;
            throw err;
          }
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      // Nothing is stored until every file has passed; a cache already there is never removed.
      const existed = await caches.has(CACHE);
      const cache = await caches.open(CACHE);
      try {
        for (const [path, res] of got) await cache.put(path, res);
      } catch (err) {
        if (!existed) await caches.delete(CACHE);
        throw err;
      }
      await self.skipWaiting();
    })(),
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
  const hit = (await caches.match(path, { cacheName: CACHE })) || (await caches.match(path));
  return hit && looksRight(path, hit) ? hit : null;
}

/** A file not in any cache: from the network, and only if it is really that file. */
async function network(request, path) {
  try {
    const res = await fetch(request);
    if (looksRight(path, res)) return res;
  } catch {
    // Tried fresh below.
  }
  try {
    const fresh = await fetch(path, { cache: 'reload', credentials: 'same-origin' });
    if (looksRight(path, fresh)) return fresh;
  } catch {
    // Offline: the page's own error handling takes over.
  }
  return new Response('', { status: 404, headers: { 'Cache-Control': 'no-store' } });
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
        .then((hit) => hit || network(request, url.pathname))
        .catch(() => network(request, url.pathname)),
    );
  }
});
