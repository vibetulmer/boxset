// Boxset service worker: app shell offline, TVmaze API network-first, posters cache-first.
const VERSION = 'v12';
const SHELL = `shell-${VERSION}`;
const API = 'api-v1';
const IMG = 'img-v1';

const SHELL_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/api.js', 'js/store.js', 'js/model.js', 'js/ui.js', 'js/color.js', 'js/actions.js',
  'js/views/shelf.js', 'js/views/search.js', 'js/views/show.js', 'js/views/ranking.js', 'js/views/stats.js', 'js/views/data.js', 'js/views/watchlist.js', 'js/views/swipe.js', 'data/popular.json',
  'fonts/sofia-sans-latin.woff2', 'fonts/sofia-sans-latin-ext.woff2', 'fonts/sofia-xc-latin.woff2', 'fonts/sofia-xc-latin-ext.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
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
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(API).then((c) => c.put(request, copy)); }
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
        if (res.ok || res.type === 'opaque') c.put(request, res.clone());
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
