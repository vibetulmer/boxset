// Series Tracker service worker: app shell offline, TVmaze API network-first, posters cache-first.
const VERSION = 'v16';
const SHELL = `shell-${VERSION}`;
const API = 'api-v2';
const IMG = 'img-v2'; // v1 held opaque (no-cors) posters, which count megabytes each against the quota
const API_MAX = 80; // shows browsed but not in the library; library shows live in IndexedDB anyway
const IMG_MAX = 600;

/** Keep a cache to its newest `max` entries (keys() lists them oldest first). */
async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => c.delete(k)));
}
const trimLater = new Map();
function scheduleTrim(e, name, max) {
  // One trim per burst of writes, not one per poster.
  if (trimLater.has(name)) return;
  const p = new Promise((r) => setTimeout(r, 4000)).then(() => trim(name, max)).finally(() => trimLater.delete(name));
  trimLater.set(name, p);
  e.waitUntil(p);
}

const SHELL_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/api.js', 'js/store.js', 'js/model.js', 'js/ui.js', 'js/color.js', 'js/actions.js',
  'js/views/shelf.js', 'js/views/search.js', 'js/views/show.js', 'js/views/ranking.js', 'js/views/stats.js', 'js/views/data.js', 'js/views/watchlist.js', 'js/views/swipe.js', 'data/popular.json',
  'fonts/sofia-sans-latin.woff2', 'fonts/sofia-sans-latin-ext.woff2', 'fonts/sofia-xc-latin.woff2', 'fonts/sofia-xc-latin-ext.woff2',
  'icons/icon-192.png', 'icons/favicon-32.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, API, IMG].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'api.tvmaze.com') {
    // Searches are never worth keeping offline; show pages are, within a limit.
    if (url.pathname.startsWith('/search/')) return;
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            e.waitUntil(caches.open(API).then((c) => c.put(request, copy)));
            scheduleTrim(e, API, API_MAX);
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.error()))
    );
    return;
  }

  if (url.hostname === 'static.tvmaze.com') {
    e.respondWith(
      caches.open(IMG).then(async (c) => {
        const hit = await c.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        // Only real CORS responses: opaque ones are padded to megabytes in the storage quota.
        if (res.ok && res.type !== 'opaque') {
          e.waitUntil(c.put(request, res.clone()));
          scheduleTrim(e, IMG, IMG_MAX);
        }
        return res;
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // Stale-while-revalidate for the shell so updates land on the next start.
    e.respondWith(
      caches.open(SHELL).then(async (c) => {
        const hit = await c.match(request, { ignoreSearch: true });
        const net = fetch(request).then((res) => { if (res.ok) c.put(request, res.clone()); return res; }).catch(() => null);
        if (hit) { e.waitUntil(net); return hit; }
        return (await net) || (request.mode === 'navigate' ? c.match('index.html') : Response.error());
      })
    );
  }
});
