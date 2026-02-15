import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';

export function useFireData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const allData = await dataService.fetchAllData();
        setData(allData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch fire data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}
