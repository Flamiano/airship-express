/**
 * PerDev is shared by three account types: HR Admin, Manager, and Employee.
 * The sign-in page an expired/unsigned session returns to therefore depends on
 * the authenticated account — mirroring the account-aware behaviour of the
 * shared middleware (`/performance-development-dashboard` is also registered in
 * `EMPLOYEE_ACCESS_ROUTES`, which sends unauthenticated visitors to
 * `/employeeAuth`).
 *
 * `cachePerDevAccountType` lets session-expiry handlers that lack account
 * context (e.g. the generic inactivity auto-logout or generic PerDev fetch
 * wrapper) still resolve the correct destination, keyed on the account type
 * last resolved server-side by `usePerDevSession`. Nothing here authorizes:
 * it only picks which sign-in page to show.
 */

const LOGIN_ROUTES = {
  HR: "/hrAuth",
  EMPLOYEE: "/employeeAuth",
} as const;

export type PerDevAccountType = "hr_admin" | "manager" | "employee";

let cachedAccountType: PerDevAccountType | null = null;

export function cachePerDevAccountType(
  accountType: PerDevAccountType | null | undefined
): void {
  if (accountType) cachedAccountType = accountType;
}

export function cachedPerDevAccountType(): PerDevAccountType | null {
  return cachedAccountType;
}

/**
 * Resolves which sign-in page to use for a given account type.
 *
 * Manager/Employee accounts return to `/employeeAuth`; HR Admin accounts
 * return to `/hrAuth`. When no account type is known it falls back to the
 * cached account type from `usePerDevSession`, and finally to `/hrAuth` to
 * preserve the existing behaviour for HR-only contexts.
 */
export function loginRouteForAccountType(
  accountType?: PerDevAccountType | null
): string {
  const type = accountType ?? cachedAccountType;
  return type === "manager" || type === "employee"
    ? LOGIN_ROUTES.EMPLOYEE
    : LOGIN_ROUTES.HR;
}

/**
 * Shared redirect helper for the sign-in pages. Directs Manager/Employee
 * sessions to `/employeeAuth` and HR Admin contexts to `/hrAuth`. Guards
 * against redirect loops when already on the destination and no-ops on the
 * server.
 */
export function redirectToLogin(
  accountType?: PerDevAccountType | null
): void {
  if (typeof window === "undefined") return;
  const destination = loginRouteForAccountType(accountType);
  if (window.location.pathname === destination) return;
  window.location.href = destination;
}
