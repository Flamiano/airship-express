export type AppRole = "fleet_manager" | "admin" | "dispatcher" | "driver" | "customer";

const ROLE_ALIASES: Record<string, AppRole> = {
  fleet_manager: "fleet_manager",
  "fleet manager": "fleet_manager",
  "fleet-manager": "fleet_manager",
  "operations manager": "fleet_manager",
  "ops manager": "fleet_manager",
  "dispatch manager": "fleet_manager",
  "pickup manager": "fleet_manager",
  manager: "fleet_manager",
  administrator: "admin",
  admin: "admin",
  super_admin: "admin",
  "super-admin": "admin",
  dispatcher: "dispatcher",
  dispatch: "dispatcher",
  "dispatch officer": "dispatcher",
  operations: "dispatcher",
  ops: "dispatcher",
  "pickup coordinator": "dispatcher",
  driver: "driver",
  customer: "customer",
};

export function normalizeRole(value?: string | null): AppRole | null {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase().replace(/[^a-z_\-\s]/g, "");
  const mapped = ROLE_ALIASES[normalized] ?? ROLE_ALIASES[normalized.replace(/\s+/g, "_")];
  if (mapped) return mapped;

  if (/(fleet|operations|dispatch|pickup|route).*(manager|supervisor|lead)/.test(normalized)) {
    return "fleet_manager";
  }
  if (/(dispatch|operations|pickup|route)/.test(normalized)) {
    return "dispatcher";
  }
  if (/(driver|delivery)/.test(normalized)) {
    return "driver";
  }
  if (/(customer|client)/.test(normalized)) {
    return "customer";
  }

  return null;
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

export function hasRoleAccess(allowedRoles: AppRole[], currentRole?: AppRole | null): boolean {
  const role = currentRole ?? getCurrentRole();
  if (!role) return false;
  return allowedRoles.includes(role);
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
      return "/dashboard";
    default:
      return "/auth";
  }
}
