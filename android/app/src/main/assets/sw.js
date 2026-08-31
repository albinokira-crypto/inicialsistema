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

  // Ignora requisições não-GET
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. Version.json e chamadas de API
  if (url.pathname.endsWith('version.json') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => {
        return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
          return (
            cached ||
            new Response(
              JSON.stringify({ offline: true, version: "2.08" }),
              { headers: { 'Content-Type': 'application/json' } }
            )
          );
        });
      })
    );
    return;
  }

  // 2. Demais páginas e arquivos estáticos (Cache com fallback seguro para Rede)
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        // Revalidação em segundo plano sem bloquear a resposta
        fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) {
              const resClone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
            }
          })
          .catch(() => {});
        return cached;
      }

      // Se não estava no cache, faz a requisição na rede normalmente
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Se a rede falhou (offline), tenta recuperar dashboard.html ou index.html
          if (event.request.mode === 'navigate' || event.request.destination === 'document') {
            return caches.match('/dashboard.html', { ignoreSearch: true }).then((dash) => {
              if (dash) return dash;
              return caches.match('/index.html', { ignoreSearch: true });
            });
          }
          return caches.match(event.request, { ignoreSearch: true });
        });
    })
  );
});
