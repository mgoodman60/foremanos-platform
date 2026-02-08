const STATIC_CACHE = 'foremanos-static-v1';
const API_CACHE = 'foremanos-api-v1';

// Static assets to pre-cache
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: strategy varies by request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle http/https requests (skip chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Skip non-GET requests (POST/PATCH handled by sync queue)
  if (request.method !== 'GET') return;

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET API responses
          if (response.ok) {
            const cloned = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const cloned = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});

// Background sync: replay queued requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-daily-reports') {
    console.log('Service Worker: Syncing daily reports');
    event.waitUntil(replaySyncQueue());
  }
});

async function replaySyncQueue() {
  // Open IndexedDB directly (can't use idb library in SW)
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('foremanos-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  const tx = db.transaction('sync-queue', 'readwrite');
  const store = tx.objectStore('sync-queue');

  const items = await new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });

  const synced = [];
  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (response.ok) {
        synced.push(item.id);
      }
    } catch (err) {
      console.warn('Service Worker: Failed to sync item', item.id, err);
    }
  }

  // Remove synced items
  if (synced.length > 0) {
    const deleteTx = db.transaction('sync-queue', 'readwrite');
    const deleteStore = deleteTx.objectStore('sync-queue');
    for (const id of synced) {
      deleteStore.delete(id);
    }

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: 'sync-complete', synced: synced.length });
    });
  }
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
