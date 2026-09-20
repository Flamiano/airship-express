import {
  cachedPerDevAccountType,
  redirectToLogin,
} from "@/performance-development-dashboard/lib/auth/redirect";

type PerDevHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type PerDevFetchOptions = {
  method?: PerDevHttpMethod;
  body?: unknown;
  /**
   * When provided, a 401 response throws this session-expired message instead
   * of the generic server/status message. Omit to keep default error handling
   * (matches modules that intentionally do not special-case 401).
   */
  sessionExpiredMessage?: string;
};

/**
 * Typed error thrown by `perDevFetch` when a 401 is returned. Carries the
 * user-facing message (either the per-call `sessionExpiredMessage` override or
 * the default). Callers that catch errors can use `handlePerDevError` to
 * redirect to the account-appropriate sign-in page as a single top-level
 * handler.
 */
export class PerDevSessionExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerDevSessionExpiredError";
  }
}

/**
 * Typed error thrown by `perDevFetch` for non-401 HTTP failures. Preserves
 * the HTTP status code and the parsed response body so callers can inspect
 * structured error payloads (e.g. 409 readiness objects) without losing
 * information. Extends `Error` so existing `instanceof Error` checks and
 * `.message` access continue to work.
 */
export class PerDevHttpError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "PerDevHttpError";
    this.status = status;
    this.body = body;
  }
}

function isPerDevSessionExpiredError(
  err: unknown
): err is PerDevSessionExpiredError {
  return err instanceof PerDevSessionExpiredError;
}

/**
 * Single top-level handler for session-expiry errors. Call this from catch
 * blocks to redirect to the account-appropriate sign-in page whenever a
 * `PerDevSessionExpiredError` escapes. No-ops for any other error.
 */
export function handlePerDevError(err: unknown): void {
  if (!isPerDevSessionExpiredError(err)) return;
  redirectToLogin(cachedPerDevAccountType());
}

/**
 * Shared fetch wrapper for the PerDev API hooks.
 *
 * Centralizes what every hook does identically: JSON headers, `credentials`,
 * request-body stringification (never sent for GET/DELETE), JSON parsing with a
 * null fallback, generic `error` extraction, and 401 handling.
 *
 * A 401 always throws a `PerDevSessionExpiredError` and redirects the user to
 * the account-appropriate sign-in page (`/employeeAuth` for Manager/Employee
 * sessions, `/hrAuth` for HR Admin; guarded against redirect loops) so an
 * expired session forces re-authentication instead of a toast-only error.
 * `sessionExpiredMessage` overrides the thrown message text when provided.
 *
 * Non-401 HTTP failures throw a `PerDevHttpError` that preserves the HTTP
 * status code and the full parsed response body, allowing callers to inspect
 * structured error payloads (e.g. 409 readiness objects) without losing
 * information.
 *
 * No retries, caching, cancellation, or logging — deduplication only.
 */
export async function perDevFetch(
  path: string,
  options: PerDevFetchOptions = {}
): Promise<unknown> {
  const method = options.method ?? "GET";

  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:
      options.body === undefined || method === "GET" || method === "DELETE"
        ? undefined
        : JSON.stringify(options.body),
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      const message =
        options.sessionExpiredMessage ??
        "Your session has expired. Please sign in again.";
      redirectToLogin(cachedPerDevAccountType());
      throw new PerDevSessionExpiredError(message);
    }
    const errorValue =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : null;
    throw new PerDevHttpError(
      errorValue || `Request failed with status ${response.status}`,
      response.status,
      data
    );
  }

  return data;
}