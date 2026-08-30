import { AppRole } from "../(dashboard)/payroll-benefits-dashboard/types";

export const HR_ROLES = {
  SUPER_ADMIN: "super_admin",
  HR_PAYROLL_ADMIN: "hr_payroll_admin",
  HR_PERFORMANCE_ADMIN: "hr_performance_admin",
  HR_RECRUITMENT_ADMIN: "hr_recruitment_admin",
  HR_WORKFORCE_ADMIN: "hr_workforce_admin",
} as const;

export const ROLE_DASHBOARD_MAP = {
  [HR_ROLES.SUPER_ADMIN]: "/payroll-benefits-dashboard",
  [HR_ROLES.HR_PAYROLL_ADMIN]: "/payroll-benefits-dashboard",
  [HR_ROLES.HR_PERFORMANCE_ADMIN]: "/performance-development-dashboard",
  [HR_ROLES.HR_RECRUITMENT_ADMIN]: "/recruitment-dashboard",
  [HR_ROLES.HR_WORKFORCE_ADMIN]: "/workforce-dashboard",
} as const;

export const DASHBOARD_ACCESS: Record<string, string[]> = {
  "/payroll-benefits-dashboard": [
    HR_ROLES.SUPER_ADMIN,
    HR_ROLES.HR_PAYROLL_ADMIN,
  ],
  "/performance-development-dashboard": [
    HR_ROLES.SUPER_ADMIN,
    HR_ROLES.HR_PERFORMANCE_ADMIN,
  ],
  "/recruitment-dashboard": [
    HR_ROLES.SUPER_ADMIN,
    HR_ROLES.HR_RECRUITMENT_ADMIN,
  ],
  "/workforce-dashboard": [HR_ROLES.SUPER_ADMIN, HR_ROLES.HR_WORKFORCE_ADMIN],
};

export function getAllowedRolesForPath(pathname: string): string[] {
  for (const [route, roles] of Object.entries(DASHBOARD_ACCESS)) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return roles;
    }
  }
  return [];
}

export async function validateHRRole(
  role: string,
  pathname: string
): Promise<{
  isValid: boolean;
  redirectTo?: string;
}> {
  const allowedRoles = getAllowedRolesForPath(pathname);

  if (allowedRoles.length === 0) {
    return { isValid: true };
  }

  if (allowedRoles.includes(role)) {
    return { isValid: true };
  }

  const userDashboard =
    ROLE_DASHBOARD_MAP[role as keyof typeof ROLE_DASHBOARD_MAP];

  return {
    isValid: false,
    redirectTo: userDashboard || "/hrAuth",
  };
}

export function isValidHRRole(role: string): boolean {
  return Object.values(HR_ROLES).includes(role as any);
}

export function getAllHRRoles(): string[] {
  return Object.values(HR_ROLES);
}
