import { NextResponse } from "next/server";
import { handle, errorResponse } from "../../lib/validate";
import { getAuthenticatedHrUser } from "../../lib/auth";
import { ERROR_CODES } from "../../lib/errors";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const result = await getAuthenticatedHrUser();
  if (!result.ok) return result.response;

  const authUser = result.user;

  let employeeId = authUser.employeeId;
  let employeeNumber = authUser.employeeNumber;
  let email = authUser.email;
  let fullName: string | null = null;
  let department: string | null = null;
  let jobTitle: string | null = null;

  if (employeeId) {
    const { data: employee, error } = await supabaseAdmin
      .from("hr1_employees")
      .select(
        "first_name, last_name, email, department, job_position:hr1_job_positions(title)"
      )
      .eq("id", employeeId)
      .maybeSingle();

    if (error) {
      const requestId = crypto.randomUUID();
      console.error(
        `[performance-development] request ${requestId} failed:`,
        error
      );
      return errorResponse(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        "Employee profile data is temporarily unavailable. Please try again.",
        undefined,
        requestId
      );
    }

    if (!employee) {
      employeeId = null;
      employeeNumber = null;
    } else {
      const row = employee as {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        department: string | null;
        job_position:
          | { title: string | null }
          | { title: string | null }[]
          | null;
      };
      fullName =
        [row.first_name, row.last_name]
          .filter((part): part is string => Boolean(part))
          .join(" ")
          .trim() || null;
      email = row.email ?? email;
      department = row.department ?? null;
      jobTitle = Array.isArray(row.job_position)
        ? row.job_position[0]?.title ?? null
        : row.job_position?.title ?? null;
    }
  }

  if (!employeeId) {
    employeeNumber = null;
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      authUserId: authUser.userId,
      role: authUser.role,
      employeeId,
      employeeNumber,
      fullName,
      email,
      department,
      jobTitle,
    },
  });
});
