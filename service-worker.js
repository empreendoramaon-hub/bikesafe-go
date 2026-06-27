// service-worker.js - BikeSafe Go PWA
const CACHE = 'bikesafe-go-v12';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
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
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isAppCode = url.origin === location.origin && (
    req.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/data-layer.js') ||
    url.pathname.endsWith('/firebase-service.js') ||
    url.pathname.endsWith('/firebase-config.js') ||
    url.pathname.endsWith('/service-worker.js')
  );

  // Codigo do app sempre tenta rede primeiro. Isso evita o app ficar preso em JS antigo.
  if (isAppCode) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
