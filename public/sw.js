/**
 * Service Worker — offline app shell + tile caching.
 *
 * Strategies:
 *  - App shell (HTML/JS/CSS): cache-first after install
 *  - Map tiles: cache-first with network fallback (stale-while-revalidate)
 *  - API calls: network-first, fallback to cache
 *  - /api/health: network-only (never cache)
 */

const SHELL_CACHE = 'wildfire-shell-v2';
const TILE_CACHE = 'wildfire-tiles-v2';
const API_CACHE = 'wildfire-api-v2';

const MAX_TILE_ENTRIES = 500;

// Assets to pre-cache on install
const SHELL_ASSETS = [
  '/',
  '/index.html',
];

// ─── Install: pre-cache shell ────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, TILE_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Helpers ─────────────────────────────────────────────

function isTileRequest(url) {
  return url.hostname.includes('tile.opentopomap.org')
    || url.hostname.includes('tile.openstreetmap.org');
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') && url.pathname !== '/api/health';
}

function isHealthRequest(url) {
  return url.pathname === '/api/health';
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxItems) return;
  // Remove oldest entries (first in = first out)
  const toDelete = keys.slice(0, keys.length - maxItems);
  await Promise.all(toDelete.map((k) => cache.delete(k)));
}

// ─── Fetch handler ───────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-http(s) requests (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Health check — network only
  if (isHealthRequest(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Map tiles — cache-first, then network
  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.ok) {
            cache.put(event.request, res.clone());
            trimCache(TILE_CACHE, MAX_TILE_ENTRIES);
          }
          return res;
        } catch {
          // Return a transparent 1x1 PNG as fallback for missing tiles
          return new Response(
            Uint8Array.from(atob(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualJAAAAABJRU5ErkJggg=='
            ), (c) => c.charCodeAt(0)),
            { headers: { 'Content-Type': 'image/png' } }
          );
        }
      })
    );
    return;
  }

  // API requests — network-first, fallback to cache
  if (isApiRequest(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const res = await fetch(event.request);
          if (res.ok) {
            cache.put(event.request, res.clone());
          }
          return res;
        } catch {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })
    );
    return;
  }

  // Navigation / app shell — cache-first for known assets, network-first otherwise
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        if (cached) return cached;
        return fetch(event.request).catch(() =>
          new Response('<h1>Offline</h1><p>Please reconnect.</p>', {
            headers: { 'Content-Type': 'text/html' },
          })
        );
      })
    );
    return;
  }

  // All other static assets — stale-while-revalidate
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
