const CACHE_NAME = 'verbmatrix-cache-v8'; // Önbellek sürümü v8'e yükseltildi
const CACHE_URLS = [
  './', 
  'index.html',
  'manifest.json',
  'favicon.ico',
  'logo.png',          // Yeni eklenen logo
  'icon-192.png',      // PWA ikonu
  'icon-512.png',      // PWA ikonu
  './telifsiz-klasik.mp3' // Yeni eklenen müzik dosyası
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
      .then(() => self.skipWaiting()) // Beklemeyi atla
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
    }).then(() => self.clients.claim()) // Yönetimi devral
  );
});

self.addEventListener('fetch', event => {
  // Canlı yayın (stream) kontrolünü kaldırdık, çünkü artık yerel dosya kullanıyoruz.
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache'te varsa döndür (Önbellek öncelikli strateji)
        if (response) {
          return response;
        }
        
        // Cache'te yoksa network'ten al
        return fetch(event.request).then(
          (response) => {
            // Yanıtı kontrol et (Başarılı ve Temel kaynak mı?)
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Yanıtı klonla. Bir klonu cache'e, diğeri tarayıcıya
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Sadece GET isteklerini cache'le (POST, PUT vb. değil)
                if (event.request.method === 'GET') {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(error => {
            // Network hatası durumunda (çevrimdışı) bile cache'e bakmayı dener
            // Bu kısım genellikle PWA'nın çevrimdışı çalışmasını sağlar
            console.log('Network error, serving from cache if available:', error);
            return caches.match(event.request);
        });
      })
    );
});
