// lib/rbac.ts
// Single source of truth for roles and permissions.
// Safe to import from both client components (sidebar) and server code (pages, API routes).

export const ROLES = ["admin", "employee"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard:view",
  "providers:view",
  "providers:create", // admin-only: add new service providers (the "Add Provider" button)
  "providers:approve", // admin-only: approve/decline employee edits, and archive providers
  "routes:view",
  "rates:view",
  "rates:create",
  "rates:approve", // admin-only: approve/decline employee edits, and archive rates
  "sops:view",
  "sops:create", // admin-only: create new SOPs (the "Add SOP" button)
  "sops:approve", // admin-only: approve/decline SOPs
  "schedules:view",
  "audit-logs:view",
  "employees:view", // admin-only: the Employees section (Employee Activity + Audit Logs)
  "users:create", // admin-only: create accounts and assign roles
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Employees do NOT get: providers:create, providers:approve, audit-logs:view, employees:view, users:create
const EMPLOYEE_PERMISSIONS: Permission[] = [
  "dashboard:view",
  "providers:view",
  "routes:view",
  "rates:view",
  "sops:view",
  "schedules:view",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS, // admin gets everything, including the Employees section, audit logs, adding and approving providers
  employee: EMPLOYEE_PERMISSIONS,
};

/** Tolerates casing/whitespace differences ("Admin", " admin ") from the session or DB. */
export function toRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return (ROLES as readonly string[]).includes(v) ? (v as Role) : null;
}

/** Unknown or missing roles get no permissions (deny by default). */
export function can(role: unknown, permission: Permission): boolean {
  const r = toRole(role);
  if (!r) return false;
  return ROLE_PERMISSIONS[r].includes(permission);
}