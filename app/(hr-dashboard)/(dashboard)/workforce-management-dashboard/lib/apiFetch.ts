import type { ApiResponse } from '../types/api';
import { MOCK_DB } from './mockDatabase';

/**
 * Thin wrapper around fetch for our JSON API. Throws on non-2xx or {error}.
 * Returns the unwrapped `data` payload.
 */
const WF_API_BASE = '/workforce-management-dashboard';

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  // SIMULATION MODE INTERCEPTION
  if (typeof window !== 'undefined' && localStorage.getItem('simulation_mode') === 'true') {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (url.includes('/api/shifts')) resolve(MOCK_DB.shifts as any);
        else if (url.includes('/api/leave/balances')) resolve(MOCK_DB.leaveBalances as any);
        else if (url.includes('/api/leave/requests')) resolve(MOCK_DB.leaveRequests as any);
        else if (url.includes('/api/employee_analytics')) resolve(MOCK_DB.analytics as any);
        else if (url.includes('/api/analytics')) resolve(MOCK_DB.dashboardAnalytics as any);
        else if (url.includes('/api/timesheets')) resolve(MOCK_DB.timesheets as any);
        else if (url.includes('/api/attendance')) resolve(MOCK_DB.attendance as any);
        else if (url.includes('/api/drivers') || url.includes('/api/employees')) resolve(MOCK_DB.employees as any);
        else resolve([] as any);
      }, 400); // Simulate network delay
    });
  }

  // Prefix /api/... calls with the workforce module route so they hit the
  // App Router route handlers at workforce-management-dashboard/api/*/route.ts
  const resolvedUrl = url.startsWith('/api/') ? `${WF_API_BASE}${url}` : url;
  const res = await fetch(resolvedUrl, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await res.json()) as ApiResponse<T>;
  if (!res.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : `Request failed (${res.status})`);
  }
  return body.data;
}
