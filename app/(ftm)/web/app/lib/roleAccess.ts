export type AppRole = "fleet_manager" | "admin" | "dispatcher" | "driver" | "customer";

import { canAccessPath, hasPermission, type PermissionAction, type PermissionModule } from "./permissions";

const ROLE_ALIASES: Record<string, AppRole> = {
  fleet_manager: "fleet_manager",
  "fleet manager": "fleet_manager",
  "fleet-manager": "fleet_manager",
  manager: "fleet_manager",
  administrator: "admin",
  admin: "admin",
  super_admin: "admin",
  dispatcher: "dispatcher",
  driver: "driver",
  customer: "customer",
};

export function normalizeRole(value?: string | null): AppRole | null {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase().replace(/[^a-z_\-\s]/g, "");
  const mapped = ROLE_ALIASES[normalized] ?? ROLE_ALIASES[normalized.replace(/\s+/g, "_")];

  return mapped ?? null;
}

export function getCurrentRole(): AppRole | null {
  if (typeof window === "undefined") return null;

  const candidates = [
    window.localStorage.getItem("appRole"),
    window.localStorage.getItem("userRole"),
    window.localStorage.getItem("role"),
    window.sessionStorage.getItem("appRole"),
    window.sessionStorage.getItem("userRole"),
    window.sessionStorage.getItem("role"),
  ];

  for (const candidate of candidates) {
    const role = normalizeRole(candidate);
    if (role) return role;
  }

  return null;
}

export function getRoleForAuthUser(user: { user_metadata?: { role?: string | null }; role?: string | null } | null | undefined): AppRole | null {
  return normalizeRole(user?.user_metadata?.role ?? user?.role ?? null);
}

export function hasRoleAccess(allowedRoles: AppRole[], currentRole?: AppRole | null): boolean {
  const role = currentRole ?? getCurrentRole();
  if (!role) return false;
  return allowedRoles.includes(role);
}

export function hasAppPermission(role: AppRole | string | null | undefined, module: PermissionModule, action: PermissionAction = "view") {
  return hasPermission(normalizeRole(role), module, action);
}

export function hasPathAccess(role: AppRole | string | null | undefined, pathname: string) {
  return canAccessPath(normalizeRole(role), pathname);
}

export function getDashboardRouteForRole(role?: AppRole | string | null): string {
  const normalized = normalizeRole(role ?? "");

  switch (normalized) {
    case "fleet_manager":
      return "/fvm";
    case "admin":
      return "/dashboard";
    case "dispatcher":
      return "/vrds/dashboard";
    case "driver":
      return "/driver/overview";
    case "customer":
      return "/customer/dashboard";
    default:
      return "/ftmAuth";
  }
}
