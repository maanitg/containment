/**
 * IndexedDB cache for API responses.
 *
 * Stores response body + metadata keyed by request signature.
 * Supports TTL, max entries, and stale markers.
 * Uses the raw IndexedDB API — no extra dependencies.
 */

const DB_NAME = 'wildfire-offline-cache';
const STORE_NAME = 'responses';
const DB_VERSION = 1;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 min
const MAX_ENTRIES = 200;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDB().then((db) => {
    const t = db.transaction(STORE_NAME, mode);
    return t.objectStore(STORE_NAME);
  });
}

/** Build a deterministic cache key from request params */
export function buildCacheKey(url, options = {}) {
  const u = new URL(url, window.location.origin);
  // Sort search params for determinism
  const params = [...u.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const method = (options.method || 'GET').toUpperCase();
  return `${method}:${u.pathname}?${params.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

/** Store a response in the cache */
export async function putCache(key, data) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ key, data, updatedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve a cached response. Returns { data, updatedAt } or null. */
export async function getCache(key) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => {
      const result = req.result;
      if (!result) return resolve(null);
      resolve({ data: result.data, updatedAt: result.updatedAt });
    };
    req.onerror = () => reject(req.error);
  });
}

/** Remove old entries beyond MAX_ENTRIES */
export async function evict() {
  const store = await tx('readwrite');
  const countReq = store.count();
  return new Promise((resolve) => {
    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count <= MAX_ENTRIES) return resolve();
      const toRemove = count - MAX_ENTRIES;
      const idx = store.index('updatedAt');
      const cursorReq = idx.openCursor();
      let removed = 0;
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || removed >= toRemove) return resolve();
        cursor.delete();
        removed++;
        cursor.continue();
      };
    };
  });
}

/**
 * cachedFetch — drop-in fetch wrapper with offline fallback.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {{ ttl?: number }} cacheOptions
 * @returns {Promise<{ data: any, meta: { fromCache: boolean, stale: boolean, updatedAt: number|null } }>}
 */
export async function cachedFetch(url, options = {}, cacheOptions = {}) {
  const key = buildCacheKey(url, options);
  const ttl = cacheOptions.ttl ?? DEFAULT_TTL_MS;
  const method = (options.method || 'GET').toUpperCase();

  // Only cache GET requests
  if (method !== 'GET') {
    const res = await fetch(url, options);
    const data = await res.json();
    return { data, meta: { fromCache: false, stale: false, updatedAt: Date.now() } };
  }

  // Network-first with timeout
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(tid);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    // Store in cache (fire-and-forget)
    putCache(key, data).then(() => evict()).catch(() => {});
    return { data, meta: { fromCache: false, stale: false, updatedAt: Date.now() } };
  } catch {
    // Fallback to cache
    const cached = await getCache(key).catch(() => null);
    if (cached) {
      const age = Date.now() - cached.updatedAt;
      return {
        data: cached.data,
        meta: { fromCache: true, stale: age > ttl, updatedAt: cached.updatedAt },
      };
    }
    // Nothing cached — rethrow so caller can handle
    throw new Error(`Fetch failed and no cache for ${url}`);
  }
}
