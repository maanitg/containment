/**
 * Offline write queue.
 *
 * Queues non-GET requests when offline and replays them on reconnect.
 * Stores in IndexedDB for persistence across refreshes.
 * Each queued request gets a client-generated requestId for idempotency.
 */

const DB_NAME = 'wildfire-write-queue';
const STORE_NAME = 'pending';
const DB_VERSION = 1;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

let dbPromise = null;
const replayListeners = new Set();

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'requestId' });
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

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Enqueue a request for later replay */
export async function enqueue(url, options = {}) {
  const requestId = generateId();
  const entry = {
    requestId,
    url,
    method: options.method || 'POST',
    headers: options.headers || {},
    body: options.body || null,
    queuedAt: Date.now(),
    retries: 0,
  };
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(entry);
    req.onsuccess = () => resolve({ requestId, queued: true });
    req.onerror = () => reject(req.error);
  });
}

/** Get all pending entries */
export async function getPending() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a completed entry */
async function remove(requestId) {
  const store = await tx('readwrite');
  return new Promise((resolve) => {
    const req = store.delete(requestId);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve(); // don't fail on cleanup
  });
}

/** Subscribe to replay results */
export function onReplayResult(cb) {
  replayListeners.add(cb);
  return () => replayListeners.delete(cb);
}

function notifyReplay(result) {
  for (const cb of replayListeners) {
    try { cb(result); } catch (_) {}
  }
}

/** Replay all pending requests in order. Call on reconnect. */
export async function replayAll() {
  const pending = await getPending();
  if (pending.length === 0) return [];

  // Sort by queuedAt to maintain order
  pending.sort((a, b) => a.queuedAt - b.queuedAt);
  const results = [];

  for (const entry of pending) {
    let success = false;
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * 2 ** (attempt - 1)));
      }
      try {
        const res = await fetch(entry.url, {
          method: entry.method,
          headers: {
            ...entry.headers,
            'X-Request-Id': entry.requestId,
          },
          body: entry.body,
        });
        if (res.ok) {
          success = true;
          await remove(entry.requestId);
          break;
        }
        lastError = `HTTP ${res.status}`;
      } catch (err) {
        lastError = err.message;
      }
    }

    const result = { requestId: entry.requestId, url: entry.url, success, error: lastError };
    results.push(result);
    notifyReplay(result);
  }

  return results;
}
