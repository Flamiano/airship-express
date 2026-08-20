export type AppRole = "fleet_manager" | "admin" | "dispatcher" | "driver" | "customer";

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
      return "/ftmAuth";
  }
}
