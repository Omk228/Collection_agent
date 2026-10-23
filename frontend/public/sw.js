// Fund Lelo PWA Service Worker
const CACHE_NAME = 'fundlelo-pwa-v1';

// Static Shell Assets for offline startup
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

// Install: Cache essential shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[PWA-SW] Pre-caching non-fatal warning:', err);
      });
    })
  );
});

// Activate: Clean up old caches & take immediate control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[PWA-SW] Deleting legacy cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Smart caching with 100% bypass for API & dynamic mutations
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Only handle GET requests; all mutations pass directly to server
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Ignore non-HTTP/HTTPS (e.g., chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. ZERO TOUCH FOR API REQUESTS:
  // Any backend call (/api, backend port 5001, etc.) must go directly to network
  // and NEVER touch or corrupt cache/database logic.
  if (
    url.pathname.startsWith('/api') ||
    url.port === '5001' ||
    url.searchParams.has('nocache')
  ) {
    return;
  }

  // 4. HTML Navigation (Single Page App routing)
  // Use Network-First strategy: Always fetch freshest page, fallback to cache if offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) {
            return cachedIndex;
          }
          return caches.match('/');
        })
    );
    return;
  }

  // 5. Static Assets (CSS, JS, Fonts, Images)
  // Stale-While-Revalidate: Serve cache instantly for blazing mobile speed,
  // then update in background.
  if (
    url.origin === self.location.origin &&
    (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff|woff2|ttf|ico)$/) ||
     url.pathname.startsWith('/assets/'))
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Support manual skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
