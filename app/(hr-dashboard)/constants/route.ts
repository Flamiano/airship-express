export const HR_ROUTES = {
  PAYROLL_BENEFITS: "/payroll-benefits-dashboard",
  PERFORMANCE_DEVELOPMENT: "/performance-development-dashboard",
  RECRUITMENT: "/recruitment-dashboard",
  WORKFORCE: "/workforce-dashboard",

  HR_AUTH: "/hrAuth",
  UNAUTHORIZED: "/unauthorized",

  API_AUTH_ROLE: "/api/auth/role",
  API_AUTH_HR: "/api/auth/hrAuth",
} as const;

export const PROTECTED_HR_ROUTES = [
  HR_ROUTES.PAYROLL_BENEFITS,
  HR_ROUTES.PERFORMANCE_DEVELOPMENT,
  HR_ROUTES.RECRUITMENT,
  HR_ROUTES.WORKFORCE,
] as const;

export const AUTH_ROUTES = [HR_ROUTES.HR_AUTH] as const;

export const DASHBOARD_NAMES: Record<string, string> = {
  [HR_ROUTES.PAYROLL_BENEFITS]: "Payroll & Benefits",
  [HR_ROUTES.PERFORMANCE_DEVELOPMENT]: "Performance Development",
  [HR_ROUTES.RECRUITMENT]: "Recruitment",
  [HR_ROUTES.WORKFORCE]: "Workforce",
} as const;
