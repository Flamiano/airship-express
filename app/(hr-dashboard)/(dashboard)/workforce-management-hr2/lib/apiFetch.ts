import type { ApiResponse } from '@/types/api';

/**
 * Thin wrapper around fetch for our JSON API. Throws on non-2xx or {error}.
 * Returns the unwrapped `data` payload.
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await res.json()) as ApiResponse<T>;
  if (!res.ok || 'error' in body) {
    throw new Error('error' in body ? body.error : `Request failed (${res.status})`);
  }
  return body.data;
}
