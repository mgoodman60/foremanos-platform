// Service Worker for ForemanOS - FULLY DISABLED
// This service worker does nothing to prevent any interference

// Immediately skip waiting and claim clients
self.addEventListener('install', (event) => {
  console.log('Service Worker: Disabled - skipping immediately');
  self.skipWaiting();
});

// Do NOT intercept fetch requests at all - let browser handle everything
self.addEventListener('fetch', (event) => {
  // Don't do anything - browser will handle the request naturally
  return;
});

// Clear all caches on activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Clearing all caches');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});
