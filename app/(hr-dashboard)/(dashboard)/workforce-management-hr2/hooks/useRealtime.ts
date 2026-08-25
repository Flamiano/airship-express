import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import type { AttendanceLog } from '@/types/workforce';

const POLL_MS = 10000;

interface UseRealtimeAttendanceResult {
  attendance: AttendanceLog[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  refetch: () => Promise<void>;
}

/**
 * Loads the attendance feed through the /api/attendance route and polls it so
 * the UI stays fresh without requiring a signed-in Supabase session (RLS would
 * otherwise block the anonymous browser client). `connected` becomes true once
 * the first poll succeeds.
 */
export function useRealtimeAttendance(): UseRealtimeAttendanceResult {
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const fetchAttendance = useCallback(async () => {
    try {
      const data = await apiFetch<AttendanceLog[]>('/api/attendance');
      setAttendance(data);
      setError(null);
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchAttendance]);

  return { attendance, loading, error, connected, refetch: fetchAttendance };
}
