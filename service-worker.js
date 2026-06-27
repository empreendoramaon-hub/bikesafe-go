// service-worker.js - BikeSafe Go PWA
const CACHE = 'bikesafe-go-v10';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './data-layer.js',
  './firebase-service.js',
  './firebase-config.js',
  './bikesafe-logo.svg',
  './install-app.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isAppShell = url.origin === location.origin && (
    req.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/data-layer.js') ||
    url.pathname.endsWith('/firebase-service.js') ||
    url.pathname.endsWith('/firebase-config.js')
  );

  // Network-first para HTML e JS do app, assim a Vercel publica correcao sem ficar presa no cache.
  if (isAppShell) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first para imagens, manifest e demais recursos estaticos.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
