# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Offline-First Support

The app includes a complete offline-first system so it remains usable when network connectivity is lost.

### How It Works

- **Connectivity detection** (`src/offline/connectivity.js`): Combines `navigator.onLine`, browser events, and periodic pings to `/api/health` to detect real connectivity. Debounced to prevent flapping.
- **Offline banner + toasts** (`src/offline/OfflineBanner.jsx`): A fixed top banner appears within 250ms of going offline. Toast notifications fire on offline/online transitions. Web Notifications are sent if permission is granted.
- **IndexedDB cache** (`src/offline/idb-cache.js`): A `cachedFetch()` wrapper uses network-first strategy with 6s timeout. Successful responses are cached in IndexedDB. When offline or on failure, cached data is returned with `{ fromCache, stale, updatedAt }` metadata.
- **Write queue** (`src/offline/write-queue.js`): Non-GET requests made while offline are queued in IndexedDB with a client-generated `requestId`. On reconnect, they replay in order with exponential backoff.
- **Service worker** (`public/sw.js`): Caches the app shell for offline start and map tiles (cache-first for tiles, network-first for API, stale-while-revalidate for static assets).
- **Reconnect revalidation** (`src/offline/OfflineProvider.jsx`): When connectivity returns, queued writes are replayed and active queries are revalidated via a global event channel.

### Limitations

- Map tiles only display if previously cached (visited while online).
- The app currently uses static data; `cachedFetch` and `useCachedFetch` are ready for when API endpoints are added.
- PWA icons (`icon-192.png`, `icon-512.png`) should be added to `public/` for full installable PWA support.
- Write queue replay assumes endpoints are idempotent (uses `X-Request-Id` header).

### Testing Steps

1. Load the app online, navigate and zoom the map to cache tiles.
2. Open DevTools > Network > check "Offline".
3. Verify: offline banner appears at top, toast notification shows.
4. Navigate the map — previously visited tiles display, uncached tiles show placeholder.
5. Uncheck "Offline" — banner disappears, "Back online" toast shows.
6. For API testing: use `cachedFetch('/api/health')` in console — returns cached when offline.
7. Verify no infinite loops or UI crashes during rapid online/offline toggling.
