/**
 * MDC License Admin PWA • Service Worker v2.5 (Offline-First Resilient Engine)
 * Powered by MDC.Dev
 */

const CACHE_NAME = 'mdc-admin-pwa-v2.5';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/favicon.ico',
  'js/html5-qrcode.min.js'
];

// Install: Cache critical shell assets safely one-by-one (never fails completely)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn('[SW] Cache asset skipped:', asset, e);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

// Fetch: Offline-First Navigation + Graceful API Fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // 1. Google Apps Script API calls:
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            isOffline: true,
            isNetworkError: true,
            error: 'Perangkat sedang Offline (Tidak ada koneksi internet ke Google Sheets).'
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store'
            }
          }
        );
      })
    );
    return;
  }

  // 2. Navigation requests (PWA desktop shortcut / URL visit):
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => {
        // Fallback 100% offline saat tidak ada internet
        return caches.match('./index.html') || caches.match('index.html') || caches.match('./');
      })
    );
    return;
  }

  // 3. Static assets: Stale-While-Revalidate with offline fallback
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(req).catch(() => {
        if (url.endsWith('.png') || url.endsWith('.ico')) {
          return caches.match('icons/icon-192.png');
        }
      });
    })
  );
});