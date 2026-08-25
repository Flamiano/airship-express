export const ADMIN_ROLES = ["super_admin", "hr_payroll_admin"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type HrRole = AdminRole | (string & {});

export function isAdminRole(role: string): boolean {
  return role === "super_admin" || role === "hr_payroll_admin";
}

export type AuthenticatedHrUser = {
  authUserId: string;
  role: HrRole;
  employeeId: string | null;
  employeeNumber: string | null;
  fullName: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
};

export type EmployeeDirectoryEntry = {
  id: string;
  employee_id_number: string | null;
  full_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  status: string | null;
};

export type DirectoryUser = {
  id: string;
  name: string;
  jobTitle: string;
};
