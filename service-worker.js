const CACHE_NAME = 'verbmatrix-cache-v9'; // Önbellek sürümü v9
const CACHE_URLS = [
  './', 
  'index.html',
  'manifest.json',
  'favicon.ico',
  'logo.png',
  'icon-192.png',
  'icon-512.png',
  './telifsiz-klasik.mp3' // Yerel müzik dosyası
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing cache V8...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(CACHE_URLS).then(() => {
          console.log('Service Worker: Required resources successfully cached.');
        }).catch(error => {
          console.error('Service Worker: Failed to cache resources. Check file paths!', error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating V8 and clearing old caches...');
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          (response) => {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                if (event.request.method === 'GET') {
                    cache.put(event.request, responseToCache);
                }
              });
            return response;
          }
        ).catch(error => {
            console.log('Network error, serving from cache if available:', error);
            return caches.match(event.request);
        });
      })
    );
});

