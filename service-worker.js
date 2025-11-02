const CACHE_NAME = 'verbmatrix-cache-v3'; // Önbellek sürümü v3'e yükseltildi
const CACHE_URLS = [
  '/', 
  '/index.html',
  '/manifest.json'
  // Yalnızca kesin var olan dosyalar listelendi.
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing cache V3...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(CACHE_URLS).then(() => {
          console.log('Service Worker: Required resources successfully cached.');
        }).catch(error => {
          // Bu hata artık oluşmamalı, ama oluşursa bile SW'nin kurulumu devam edebilir.
          console.error('Service Worker: Failed to cache resources. Check file paths!', error);
        });
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating V3 and clearing old caches...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Önbellekte eşleşen kaynak varsa onu döndür, yoksa ağdan almaya çalış.
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});