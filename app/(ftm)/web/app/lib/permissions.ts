export type PermissionAction = "view" | "create" | "update" | "delete";
export type PermissionModule =
  | "operations"
  | "alerts"
  | "costAnalysis"
  | "driverPerformance"
  | "fuelManagement"
  | "gallery"
  | "fvm"
  | "vrds"
  | "userManagement"
  | "roleManagement"
  | "systemSettings";

export type PermissionMap = Record<PermissionModule, PermissionAction[]>;

const noAccess: PermissionAction[] = [];
const viewOnly: PermissionAction[] = ["view"];
const adminAccess: PermissionAction[] = ["view", "create", "update", "delete"];

export const PERMISSIONS: Record<string, PermissionMap> = {
  admin: {
    operations: adminAccess,
    alerts: adminAccess,
    costAnalysis: adminAccess,
    driverPerformance: adminAccess,
    fuelManagement: adminAccess,
    gallery: adminAccess,
    fvm: adminAccess,
    vrds: adminAccess,
    userManagement: adminAccess,
    roleManagement: adminAccess,
    systemSettings: adminAccess,
  },
  dispatcher: {
    operations: ["view", "create", "update"],
    alerts: ["view", "update"],
    costAnalysis: noAccess,
    driverPerformance: viewOnly,
    fuelManagement: noAccess,
    gallery: viewOnly,
    fvm: viewOnly,
    vrds: ["view", "create", "update"],
    userManagement: noAccess,
    roleManagement: noAccess,
    systemSettings: noAccess,
  },
  fleet_manager: {
    operations: ["view", "create", "update"],
    alerts: ["view", "update"],
    costAnalysis: adminAccess,
    driverPerformance: viewOnly,
    fuelManagement: adminAccess,
    gallery: ["view", "create", "update"],
    fvm: adminAccess,
    vrds: ["view", "create", "update"],
    userManagement: noAccess,
    roleManagement: noAccess,
    systemSettings: noAccess,
  },
  driver: {
    operations: viewOnly,
    alerts: viewOnly,
    costAnalysis: noAccess,
    driverPerformance: viewOnly,
    fuelManagement: viewOnly,
    gallery: viewOnly,
    fvm: noAccess,
    vrds: noAccess,
    userManagement: noAccess,
    roleManagement: noAccess,
    systemSettings: noAccess,
  },
  customer: {
    operations: noAccess,
    alerts: noAccess,
    costAnalysis: noAccess,
    driverPerformance: noAccess,
    fuelManagement: noAccess,
    gallery: noAccess,
    fvm: noAccess,
    vrds: noAccess,
    userManagement: noAccess,
    roleManagement: noAccess,
    systemSettings: noAccess,
  },
};

const PATH_MODULES: Array<{ prefix: string; module: PermissionModule }> = [
  { prefix: "/dashboard", module: "operations" },
  { prefix: "/alerts", module: "alerts" },
  { prefix: "/cost", module: "costAnalysis" },
  { prefix: "/driver", module: "driverPerformance" },
  { prefix: "/fuel/receipts", module: "gallery" },
  { prefix: "/fuel/photo-log", module: "gallery" },
  { prefix: "/fuel/proof-pickup", module: "gallery" },
  { prefix: "/fuel/destination-gallery", module: "gallery" },
  { prefix: "/fuel/parcel-history", module: "gallery" },
  { prefix: "/fuel", module: "fuelManagement" },
  { prefix: "/fvm", module: "fvm" },
  { prefix: "/vrds", module: "vrds" },
  { prefix: "/users", module: "userManagement" },
  { prefix: "/account/settings", module: "systemSettings" },
];

export function getPermissionMap(role?: string | null): PermissionMap | null {
  return role ? PERMISSIONS[role] ?? null : null;
}

export function hasPermission(role: string | null | undefined, module: PermissionModule, action: PermissionAction = "view") {
  return Boolean(getPermissionMap(role)?.[module]?.includes(action));
}

export function getModuleForPath(pathname: string): PermissionModule | null {
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return PATH_MODULES.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`))?.module ?? null;
}

export function canAccessPath(role: string | null | undefined, pathname: string) {
  const module = getModuleForPath(pathname);
  const normalizedRole = role ? String(role).trim().toLowerCase() : null;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return normalizedRole === "admin" || normalizedRole === "fleet_manager";
  }
  if (module) return hasPermission(role, module, "view");
  const path = pathname.split("?")[0];
  return path === "/" || path === "/ftmAuth" || path === "/unauthorized" || path === "/account" || path.startsWith("/account/profile");
}

export function getAllowedNavPaths(role?: string | null) {
  const paths = [
    "/dashboard", "/alerts", "/cost", "/driver/overview", "/driver/performance", "/driver/safety", "/driver/leaderboard",
    "/fuel", "/fuel/consumption", "/fuel/efficiency", "/fuel/refueling-log", "/fuel/receipts", "/fuel/photo-log", "/fuel/proof-pickup", "/fuel/destination-gallery", "/fuel/parcel-history",
    "/fvm", "/fvm/inventory", "/fvm/analytics", "/fvm/maintenance", "/vrds/dashboard", "/vrds/parcels", "/vrds/bookings", "/vrds/missions", "/vrds/route-planning", "/vrds/history", "/users",
  ];
  return paths.filter((path) => canAccessPath(role, path));
}

export function getProfileActions(role?: string | null) {
  return {
    profile: true,
    userManagement: hasPermission(role, "userManagement", "view"),
    roleManagement: hasPermission(role, "roleManagement", "update"),
    settings: hasPermission(role, "systemSettings", "view"),
    fleetSettings: hasPermission(role, "fvm", "update"),
  };
}
