const CACHE_NAME = 'projeto-planilha-mobile-v200';
const ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/styles.css?v=200',
  '/app.js?v=200',
  '/login.js?v=200',
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

  // 1. NUNCA armazenar em cache version.json, chamadas de API ou requisições dinâmicas
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

  // 2. Busca na rede primeiro (Network First) para garantir que sempre pega os arquivos novos
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
