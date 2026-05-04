const CACHE_NAME = 'restaurant-operation-v1';
const urlsToCache = [
  '/',
  '/operation',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json'
];

// 설치 및 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 오프라인 지원
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// 푸시 알림
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.message,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
