import "server-only";

import { cache } from "react";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  requireHrEmployee,
  requireHrAdmin,
  type AuthenticatedHrEmployee,
  type AuthenticatedHrUser,
} from "@/performance-development-dashboard/lib/auth/hrIdentity";

/**
 * Any PerDev record owned by an employee is expected to expose the owning
 * employee's UUID through `employee_id`, pointing at `hr1_employees.id`.
 *
 * The owning UUID is always resolved server-side by `hrIdentity` from the
 * authenticated Supabase session. A client-supplied employee UUID is never
 * used as the authorization source.
 */
export type PerDevEmployeeScopedRecord = {
  employee_id: string | null;
};

/**
 * 403: authenticated but not authorized. Messages stay generic so
 * authorization failures never leak which employee's record was attempted or
 * who owns it. No-session 401s are produced by the identity layer above.
 */
const FORBIDDEN_RECORD_RESPONSE = () =>
  NextResponse.json(
    { error: "Forbidden - You do not have access to this record" },
    { status: 403 }
  );

/**
 * Employee self-scope.
 *
 * Requires an authenticated account with an employee identity and that the
 * requested record belongs to that employee:
 *
 *   authenticated user
 *   → hrIdentity.requireHrEmployee()
 *   → employeeUuid
 *   → record.employee_id === employeeUuid
 *
 * Returns the authenticated identity on success, otherwise the appropriate
 * NextResponse (401 / 403). The caller passes back any `NextResponse`
 * unchanged.
 */
export async function assertEmployeeOwnsRecord(
  record: PerDevEmployeeScopedRecord
): Promise<AuthenticatedHrEmployee | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  if (!record.employee_id || record.employee_id !== identity.employeeUuid) {
    console.error(
      "assertEmployeeOwnsRecord: record is not owned by the requesting employee"
    );
    return FORBIDDEN_RECORD_RESPONSE();
  }

  return identity;
}

/**
 * HR admin scope.
 *
 * Grants scope over PerDev records to the existing module-level HR admin
 * roles: `super_admin` and `hr_performance_admin` (see `DASHBOARD_ACCESS` in
 * the shared role validation). Returns the authenticated HR identity on
 * success, otherwise the appropriate NextResponse (401 / 403).
 *
 * HR records are not employee-scoped, so no record argument is required here.
 */
export async function assertHrAdminScope(): Promise<
  AuthenticatedHrUser | NextResponse
> {
  return requireHrAdmin();
}

/**
 * Resolves the direct-report employee UUIDs for a manager, server-side.
 *
 * Uses the ONLY authoritative manager relationship: an active `hr1_employees`
 * row whose `manager_id` equals the manager's employee id. Manager capability
 * must never be inferred from job title, department, name, or email.
 */
export const resolveManagerDirectReportUuids = cache(
  async (managerEmployeeUuid: string): Promise<string[]> => {
    const { data, error } = await supabaseAdmin
      .from("hr1_employees")
      .select("id")
      .eq("manager_id", managerEmployeeUuid)
      .eq("status", "active");

    if (error) {
      console.error(
        "resolveManagerDirectReportUuids: direct-report lookup error:",
        error
      );
      return [];
    }

    return (data ?? []).map((row) => row.id);
  }
);

/**
 * Manager scope.
 *
 * Requires an authenticated Manager account and that the requested record
 * belongs to one of the manager's active direct reports, resolved server-side
 * through `manager_id`:
 *
 *   authenticated user
 *   → hrIdentity.requireHrEmployee()  (manager accounts are authenticated
 *                                      employees)
 *   → resolveManagerDirectReportUuids(employeeUuid)
 *   → record.employee_id ∈ direct reports
 *
 * An authenticated Employee (non-manager) or HR Admin never passes this
 * scope. Returns the authenticated identity on success, otherwise the
 * appropriate NextResponse.
 */
export async function assertManagerRecordScope(
  record: PerDevEmployeeScopedRecord
): Promise<AuthenticatedHrEmployee | NextResponse> {
  const identity = await requireHrEmployee();
  if (identity instanceof NextResponse) return identity;

  if (identity.accountType !== "manager") {
    console.error(
      "assertManagerRecordScope: account is not a manager:",
      identity.accountType
    );
    return FORBIDDEN_RECORD_RESPONSE();
  }

  if (!record.employee_id) {
    console.error("assertManagerRecordScope: record has no owning employee");
    return FORBIDDEN_RECORD_RESPONSE();
  }

  const directReports = await resolveManagerDirectReportUuids(identity.employeeUuid);

  if (!directReports.includes(record.employee_id)) {
    console.error(
      "assertManagerRecordScope: record is not owned by a direct report:",
      record.employee_id
    );
    return FORBIDDEN_RECORD_RESPONSE();
  }

  return identity;
}