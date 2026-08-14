const CACHE_NAME = 'tkst-alunos-v19';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './assets/css/main.css',
  './assets/css/components.css',
  './assets/js/auth.js',
  './assets/js/data-curriculum.js',
  './assets/js/data-katas.js',
  './assets/js/data-kumite.js',
  './assets/js/data-glossary.js',
  './assets/js/data-quiz.js',
  './assets/js/app.js',
  './assets/images/logo-tkst.png',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './assets/images/icon-maskable.png',
  './assets/images/apple-touch-icon.png',
  './assets/images/tigre.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Bypass cache for Cloud Sync API and non-GET requests
  if (event.request.method !== 'GET' || event.request.url.includes('api.restful-api.dev') || event.request.url.includes('youtube.com') || event.request.url.includes('vimeo.com')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});
