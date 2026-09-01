// Service Worker - Versão 2.10 Limpa e Segura (Pass-Through Instantâneo)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pass-through direto para garantir que o navegador e o WebView nunca recebam ERR_FAILED
  return;
});
