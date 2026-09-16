import type { ApiResponse } from '../types/api';

/**
 * Thin wrapper around fetch for our JSON API. Throws on non-2xx or {error}.
 * Returns the unwrapped `data` payload.
 */
const WF_API_BASE = '/workforce-management-dashboard';

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
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
