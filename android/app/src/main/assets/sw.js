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
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map((url) =>
          fetch(url, { cache: 'reload' })
            .then((res) => {
              if (res.ok) return cache.put(url, res);
            })
            .catch((err) => console.warn('Falha ao pré-carregar cache:', url, err))
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Apenas requisições de version.json e APIs tentam rede primeiro (para OTA)
  if (url.pathname.endsWith('version.json') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() =>
          caches.match(event.request, { ignoreSearch: true }).then(
            (cached) =>
              cached ||
              new Response(
                JSON.stringify({ offline: true, version: "2.08" }),
                { headers: { 'Content-Type': 'application/json' } }
              )
          )
        )
    );
    return;
  }

  // 2. Estratégia Stale-While-Revalidate / Cache-First para páginas e assets:
  // Responde INSTANTANEAMENTE do cache para o Android WebView nunca dar erro nem cair para file:///
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      // Faz revalidação em segundo plano se houver conexão
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        return cachedResponse;
      }

      // Se não estava no cache exato, tenta fallback para dashboard.html ou index.html para navegação
      if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        return caches.match('/dashboard.html', { ignoreSearch: true })
          .then((dashCached) => dashCached || caches.match('/index.html', { ignoreSearch: true }))
          .then((navCached) => navCached || fetchPromise);
      }

      return fetchPromise.then((netRes) => netRes || cachedResponse);
    })
  );
});
