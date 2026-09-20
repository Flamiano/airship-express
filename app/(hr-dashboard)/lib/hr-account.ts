import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export type AccountType = "hr_admin" | "manager" | "employee";

export const ACCOUNT_TYPE = {
  HR_ADMIN: "hr_admin",
  MANAGER: "manager",
  EMPLOYEE: "employee",
} as const;

export type ResolvedHrAccount = {
  accountType: AccountType;
  hrAdminId: string | null;
  employeeUuid: string | null;
  employeeIdNumber: string | null;
  fullName: string;
  email: string | null;
  role: string;
};

/**
 * Resolves the account identity for an authenticated Supabase session user.
 *
 * Resolution order:
 *  1. hr_admin table (HR Admin accounts)
 *  2. hr1_employees.auth_user_id (Manager / Employee accounts)
 *
 * Manager capability is derived from active direct-report relationships:
 *   hr1_employees.manager_id = candidate.id AND status = 'active'
 */
export async function resolveHrAccountForSession(
  sessionUserId: string
): Promise<ResolvedHrAccount | null> {
  // --- HR Admin ---
  const { data: hrAdmin } = await supabaseAdmin
    .from("hr_admin")
    .select("id, employee_id, role, full_name, email")
    .eq("id", sessionUserId)
    .maybeSingle();

  if (hrAdmin) {
    return {
      accountType: "hr_admin",
      hrAdminId: hrAdmin.id,
      employeeUuid: null,
      employeeIdNumber: hrAdmin.employee_id ?? null,
      fullName: hrAdmin.full_name ?? hrAdmin.email ?? "HR Admin",
      email: hrAdmin.email ?? null,
      role: hrAdmin.role ?? "super_admin",
    };
  }

  // --- Manager / Employee ---
  const { data: employee, error: employeeError } = await supabaseAdmin
    .from("hr1_employees")
    .select("id, employee_id_number, first_name, last_name, email, status")
    .eq("auth_user_id", sessionUserId)
    .maybeSingle();

  if (employeeError || !employee) return null;

  if (employee.status !== "active") {
    console.error(
      "resolveHrAccountForSession: employee is not active:",
      employee.id
    );
    return null;
  }

  const fullName =
    [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim() ||
    employee.email ||
    "Employee";

  // Determine Manager vs Employee from active direct-report relationships.
  const { count } = await supabaseAdmin
    .from("hr1_employees")
    .select("id", { count: "exact", head: true })
    .eq("manager_id", employee.id)
    .eq("status", "active");

  const accountType: AccountType = (count ?? 0) > 0 ? "manager" : "employee";

  return {
    accountType,
    hrAdminId: null,
    employeeUuid: employee.id,
    employeeIdNumber: employee.employee_id_number ?? null,
    fullName,
    email: employee.email ?? null,
    role: accountType,
  };
}
