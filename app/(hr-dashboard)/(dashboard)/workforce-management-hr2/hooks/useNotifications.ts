import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';

export type NotificationType = 'timesheet' | 'leave' | 'attendance';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  detail: string;
  href: string;
  createdAt: string; // ISO timestamp used for sorting + relative time
}

interface UseNotificationsResult {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  isUnread: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refetch: () => Promise<void>;
}

/** localStorage key holding the ids the user has already seen. */
const READ_KEY = 'ax-notif-read';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (raw) return new Set<string>(JSON.parse(raw) as string[]);
  } catch {
    /* SSR / disabled storage — treat as none read */
  }
  return new Set<string>();
}

function persistReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

// Minimal row shapes returned by the joined API routes.
interface JoinedName {
  full_name: string | null;
}
interface TimesheetRow {
  id: string;
  status: string;
  overtime_hours: number | null;
  created_at: string;
  employee: JoinedName | null;
}
interface LeaveRow {
  id: string;
  status: string;
  leave_type: string;
  days_count: number;
  created_at: string;
  employee: JoinedName | null;
}
interface AttendanceRow {
  id: string;
  status: string;
  last_scan: string;
  terminal: string | null;
  employee: JoinedName | null;
}

const nameOf = (e: JoinedName | null) => e?.full_name ?? 'A team member';

/**
 * Builds the notification feed from actionable records across the workforce
 * tables: timesheets awaiting approval / flagged for overtime, leave requests
 * pending HR review, and attendance exceptions (tardy / absent). Read state is
 * remembered per-notification in localStorage so the unread badge is accurate
 * across reloads. Each source is fetched via its API route and fails soft — a
 * failing endpoint simply yields no items for that source.
 */
export function useNotifications(): UseNotificationsResult {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const next: AppNotification[] = [];

    const [ts, lv, att] = await Promise.all([
      apiFetch<TimesheetRow[]>('/api/timesheets').catch(() => [] as TimesheetRow[]),
      apiFetch<LeaveRow[]>('/api/leave').catch(() => [] as LeaveRow[]),
      apiFetch<AttendanceRow[]>('/api/attendance').catch(() => [] as AttendanceRow[]),
    ]);

    for (const row of ts) {
      const ot = row.overtime_hours && row.overtime_hours > 0 ? ` · ${row.overtime_hours}h OT` : '';
      next.push({
        id: `timesheet:${row.id}`,
        type: 'timesheet',
        title: row.status === 'Flagged Overtime' ? 'Overtime flagged' : 'Timesheet needs approval',
        detail: `${nameOf(row.employee)} · ${row.status}${ot}`,
        href: '/timesheets',
        createdAt: row.created_at,
      });
    }

    for (const row of lv) {
      next.push({
        id: `leave:${row.id}`,
        type: 'leave',
        title: 'Leave request pending',
        detail: `${nameOf(row.employee)} · ${row.leave_type} (${row.days_count}d)`,
        href: '/leave',
        createdAt: row.created_at,
      });
    }

    for (const row of att) {
      next.push({
        id: `attendance:${row.id}`,
        type: 'attendance',
        title: `Attendance: ${row.status}`,
        detail: `${nameOf(row.employee)}${row.terminal ? ` · ${row.terminal}` : ''}`,
        href: '/attendance',
        createdAt: row.last_scan,
      });
    }

    next.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    setItems(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const nextSet = new Set(prev).add(id);
      persistReadIds(nextSet);
      return nextSet;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const nextSet = new Set(prev);
      items.forEach((i) => nextSet.add(i.id));
      persistReadIds(nextSet);
      return nextSet;
    });
  }, [items]);

  const unreadCount = items.reduce((n, i) => (readIds.has(i.id) ? n : n + 1), 0);
  const isUnread = useCallback((id: string) => !readIds.has(id), [readIds]);

  return { items, unreadCount, loading, isUnread, markRead, markAllRead, refetch };
}
