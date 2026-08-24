import { useCallback, useEffect, useState } from 'react';

// Shared hook contract for all event-owned resources. Mutation work stays in
// the service; a manager gets one consistent loading/error/reload lifecycle.
export function useEventResource(eventId, fetchRows) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(Boolean(eventId)); const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!eventId) { setRows([]); setLoading(false); return; }
    setLoading(true); try { setRows(await fetchRows(eventId)); setError(null); } catch (err) { setError(err); } finally { setLoading(false); }
  }, [eventId, fetchRows]);
  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, error, reload };
}
