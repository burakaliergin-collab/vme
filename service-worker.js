const CACHE_NAME = 'verb-matrix-v1';
const urlsToCache = [
    '/',
    'index.html',
    'style.css',
    'script.js',
    'verbmatrix_data.json',
    'logo.png',
    'favicon.ico'
];

// Kurulum: Gerekli dosyaları önbelleğe al
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch: Önbellekten sun, yoksa ağdan al ve önbelleğe ekle
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Önbellekte varsa, onu döndür
                if (response) {
                    return response;
                }
                // Yoksa, ağdan al
                return fetch(event.request).then(
                    response => {
                        // Yanıt geçerliyse, önbelleğe al ve döndür
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
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

// Activate: Eski önbellekleri temizle
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});