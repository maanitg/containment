/**
 * React hook for fetching data with offline cache support.
 *
 * Usage:
 *   const { data, loading, meta } = useCachedFetch('/api/fires', {}, { ttl: 60000 });
 *
 * `meta` contains { fromCache, stale, updatedAt }.
 * Automatically revalidates on reconnect.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cachedFetch } from './idb-cache';
import { onRevalidate } from './OfflineProvider';

export default function useCachedFetch(url, options = {}, cacheOptions = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ fromCache: false, stale: false, updatedAt: null });
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const result = await cachedFetch(url, options, cacheOptions);
      if (mountedRef.current) {
        setData(result.data);
        setMeta(result.meta);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => { mountedRef.current = false; };
  }, [doFetch]);

  // Re-fetch on global revalidate event (reconnect)
  useEffect(() => {
    return onRevalidate(() => {
      doFetch();
    });
  }, [doFetch]);

  return { data, loading, error, meta, refetch: doFetch };
}
