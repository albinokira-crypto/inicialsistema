const CACHE_NAME = 'projeto-planilha-mobile-v199';
const ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/styles.css',
  '/app.js',
  '/login.js',
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
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NUNCA armazenar em cache version.json, chamadas de API ou requisições que não sejam GET
  if (
    event.request.method !== 'GET' ||
    url.pathname.endsWith('version.json') ||
    url.pathname.includes('/api/') ||
    url.searchParams.has('t') ||
    url.searchParams.has('_t')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Para os assets estáticos normais, busca na rede e atualiza cache em segundo plano
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
