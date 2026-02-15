/**
 * Connectivity detection module.
 *
 * Uses navigator.onLine + browser events + periodic health-ping
 * to determine real connectivity. Debounces transitions to avoid
 * flapping when the network is unstable.
 */

const HEALTH_URL = '/api/health';
const PING_INTERVAL_MS = 30_000; // 30s while online
const DEBOUNCE_MS = 800;
const PING_TIMEOUT_MS = 5_000;

let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
let confirmed = false; // true once a health ping succeeds
const subscribers = new Set();
let pingTimer = null;
let debounceTimer = null;

function notify(status) {
  for (const cb of subscribers) {
    try { cb(status); } catch (_) { /* subscriber errors are swallowed */ }
  }
}

function setOnline(next) {
  if (next === online) return;
  // Debounce to avoid rapid flapping
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (next === online) return;
    online = next;
    notify(online);
    // When coming back online, start pinging again
    if (online) schedulePing();
  }, DEBOUNCE_MS);
}

async function ping() {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
    const res = await fetch(HEALTH_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (res.ok) {
      confirmed = true;
      setOnline(true);
    } else {
      setOnline(false);
    }
  } catch {
    setOnline(false);
  }
}

function schedulePing() {
  clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (online) ping();
  }, PING_INTERVAL_MS);
}

/** Returns current online status */
export function isOnline() {
  return online;
}

/** Subscribe to connectivity changes. Returns unsubscribe fn. */
export function subscribe(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/** Start listening. Call once at app boot. */
export function startMonitoring() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));

  // Initial ping to confirm real connectivity
  ping();
  schedulePing();
}

/** Stop monitoring (cleanup). */
export function stopMonitoring() {
  clearInterval(pingTimer);
  clearTimeout(debounceTimer);
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', () => setOnline(true));
    window.removeEventListener('offline', () => setOnline(false));
  }
}
