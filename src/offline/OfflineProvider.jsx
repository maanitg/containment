import { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { isOnline, subscribe, startMonitoring, stopMonitoring } from './connectivity';
import { replayAll, onReplayResult } from './write-queue';

const OfflineContext = createContext({
  online: true,
  revalidate: () => {},
});

export function useOffline() {
  return useContext(OfflineContext);
}

// Global event target for revalidation signals
const revalidateChannel = new EventTarget();

export function onRevalidate(cb) {
  revalidateChannel.addEventListener('revalidate', cb);
  return () => revalidateChannel.removeEventListener('revalidate', cb);
}

export function triggerRevalidate() {
  revalidateChannel.dispatchEvent(new Event('revalidate'));
}

export default function OfflineProvider({ children }) {
  const [online, setOnline] = useState(isOnline());
  const wasOffline = useRef(false);

  const revalidate = useCallback(() => {
    triggerRevalidate();
  }, []);

  useEffect(() => {
    startMonitoring();

    const unsub = subscribe((status) => {
      setOnline(status);

      if (status && wasOffline.current) {
        // Came back online — replay queued writes, then revalidate
        replayAll()
          .then((results) => {
            const failed = results.filter((r) => !r.success);
            if (failed.length > 0) {
              console.warn('[offline] Some queued requests failed:', failed);
            }
          })
          .catch((err) => console.error('[offline] Replay error:', err))
          .finally(() => {
            // Trigger revalidation of active queries
            triggerRevalidate();
          });
      }

      wasOffline.current = !status;
    });

    return () => {
      unsub();
      stopMonitoring();
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ online, revalidate }}>
      {children}
    </OfflineContext.Provider>
  );
}
