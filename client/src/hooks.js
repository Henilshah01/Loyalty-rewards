import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** GET `path` on mount / when path changes. Returns { data, error, loading, reload }. */
export function useLoad(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setData(await api(path));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => { setLoading(true); reload(); }, [reload]);
  return { data, error, loading, reload };
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
