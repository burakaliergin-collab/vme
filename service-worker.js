const CACHE_NAME = 'verbmatrix-cache-v5'; // Önbellek sürümü v5'e yükseltildi
const CACHE_URLS = [
  './', 
  'index.html',
  'manifest.json',
  'logo.png',     // YENİ: Logo eklendi
  'favicon.ico'   // YENİ: Favicon eklendi
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing cache V5...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(CACHE_URLS).then(() => {
          console.log('Service Worker: Required resources successfully cached.');
        }).catch(error => {
          console.error('Service Worker: Failed to cache resources. Check file paths!', error);
        });
      })
      .then(() => self.skipWaiting()) // Beklemeyi atla
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating V5 and clearing old caches...');
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
    }).then(() => self.clients.claim()) // Yönetimi devral
  );
});

self.addEventListener('fetch', event => {
  // YENİ: Müzik yayını gibi dış kaynak isteklerini cache'lemeyi deneme
  if (event.request.url.includes('publicdomainradio.org')) {
    return fetch(event.request);
  }

  // Önbellekte eşleşen kaynak varsa onu döndür, yoksa ağdan almaya çalış.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache'te varsa döndür
        if (response) {
          return response;
        }
        
        // Cache'te yoksa network'ten al
        return fetch(event.request).then(
          (response) => {
            // Yanıtı kontrol et
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Yanıtı klonla. Bir klonu cache'e, diğeri tarayıcıya
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});