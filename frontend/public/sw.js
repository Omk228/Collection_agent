// Fund Lelo PWA Service Worker
const CACHE_NAME = 'fundlelo-pwa-v2';

// Static Shell Assets for offline startup (relative to scope)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './manifest.json',
  './favicon.png',
  './fundlelo-logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
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

  // 1. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Ignore non-HTTP/HTTPS (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. ZERO TOUCH FOR BACKEND API & CROSS-ORIGIN REQUESTS:
  // All backend API requests (e.g., https://ca.fundlelo.site/*, /api/*, port 5001)
  // must pass directly to network and NEVER touch cache.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api') ||
    url.port === '5001' ||
    url.searchParams.has('nocache')
  ) {
    return;
  }

  // 4. HTML Navigation (Single Page App routing)
  // Network-First strategy: Always fetch freshest page, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = (await caches.match(request)) ||
                         (await caches.match('./index.html')) ||
                         (await caches.match('index.html')) ||
                         (await caches.match('./'));
          if (cached) return cached;
          return new Response('Network unavailable. Please check your connection.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 5. Static Assets (CSS, JS, Fonts, Images)
  // Stale-While-Revalidate: Serve cache instantly, update in background
  if (
    url.origin === self.location.origin &&
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff|woff2|ttf|ico|json|webmanifest)$/)
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
});

// Support manual skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
