import "server-only";
import type { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { createServerSupabaseClient } from "@/app/(hr-dashboard)/supabase/server";
import { ERROR_CODES } from "./errors";
import { errorResponse } from "./validate";

export const ADMIN_ROLES = [
  "super_admin",
  "hr_payroll_admin",
  "hr_performance_admin",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type HrRole = AdminRole | (string & {});

export function isAdminRole(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export type AuthenticatedHrUser = {
  userId: string;
  email: string | null;
  fullName: string;
  role: HrRole;
  isAdmin: boolean;
  employeeId: string | null;
  employeeNumber: string | null;
};

export type AuthResult =
  | { ok: true; user: AuthenticatedHrUser }
  | { ok: false; response: NextResponse };

async function resolveAuthenticatedHrUser(): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return {
      ok: false,
      response: errorResponse(
        ERROR_CODES.UNAUTHENTICATED,
        "Sign in to continue."
      ),
    };
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("hr_admin")
    .select("id, email, full_name, role, employee_id")
    .eq("id", session.user.id)
    .maybeSingle();

  if (adminError) {
    console.error("[performance-development] hr_admin lookup failed:", adminError);
  }

  if (!admin) {
    return {
      ok: false,
      response: errorResponse(
        ERROR_CODES.FORBIDDEN,
        "No HR profile is linked to this account."
      ),
    };
  }

  let employeeId: string | null = null;
  const employeeNumber = admin.employee_id ?? null;

  if (employeeNumber) {
    const { data: employee } = await supabaseAdmin
      .from("hr1_employees")
      .select("id")
      .eq("employee_id_number", employeeNumber)
      .maybeSingle();
    employeeId = employee?.id ?? null;
  }

  return {
    ok: true,
    user: {
      userId: admin.id,
      email: admin.email ?? null,
      fullName: admin.full_name ?? "",
      role: admin.role as HrRole,
      isAdmin: isAdminRole(admin.role),
      employeeId,
      employeeNumber,
    },
  };
}

export async function getAuthenticatedHrUser(): Promise<AuthResult> {
  return resolveAuthenticatedHrUser();
}

export async function requireHrAdmin(): Promise<AuthResult> {
  const result = await getAuthenticatedHrUser();
  if (!result.ok) return result;
  if (!result.user.isAdmin) {
    return {
      ok: false,
      response: errorResponse(
        ERROR_CODES.FORBIDDEN,
        "Administrator access is required for this action."
      ),
    };
  }
  return result;
}

export async function requireHrEmployee(): Promise<AuthResult> {
  const result = await getAuthenticatedHrUser();
  if (!result.ok) return result;
  if (!result.user.employeeId) {
    return {
      ok: false,
      response: errorResponse(
        ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED,
        "Your account is not linked to an employee profile yet. Contact HR."
      ),
    };
  }
  return result;
}

export async function requireEmployeeIdentity(): Promise<AuthResult> {
  return requireHrEmployee();
}
