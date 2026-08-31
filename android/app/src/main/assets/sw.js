const CACHE_NAME = 'projeto-planilha-mobile-v208';
const ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/styles.css?v=208',
  '/app.js?v=208',
  '/login.js?v=208',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Para version.json e APIs: sempre tenta rede primeiro, mas nunca quebra a tela se offline
  if (url.pathname.endsWith('version.json') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request, { ignoreSearch: true })
          .then(cached => cached || new Response(JSON.stringify({ offline: true, version: "2.07" }), { headers: { 'Content-Type': 'application/json' } }))
        )
    );
    return;
  }

  // 2. Para requisições de navegação HTML (ex: dashboard.html?t=..., index.html):
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request, { ignoreSearch: true })
            .then(cached => cached || (url.pathname.includes('dashboard') ? caches.match('/dashboard.html') : caches.match('/index.html')));
        })
    );
    return;
  }

  // 3. Demais recursos (JS, CSS, Imagens, Fontes): Network First com Cache Fallback (ignoreSearch)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
