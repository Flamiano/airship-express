import { NextResponse } from "next/server";
import { internalError, handle } from "../lib/validate";
import { getAuthenticatedHrUser } from "../lib/auth";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const result = await getAuthenticatedHrUser();
  if (!result.ok) return result.response;

  const { data, error } = await supabaseAdmin
    .from("hr1_employees")
    .select(
      "id, employee_id_number, first_name, last_name, email, department, job_position:hr1_job_positions(title), status"
    )
    .order("last_name")
    .order("first_name");

  if (error) {
    // #region agent log
    fetch("http://127.0.0.1:7412/ingest/0eaccd84-c262-43ee-a949-541d824d3d38", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "994ee8",
      },
      body: JSON.stringify({
        sessionId: "994ee8",
        runId: "pre-fix",
        hypothesisId: "F",
        location: "api/employees/route.ts:GET-error",
        message: "employees directory query failed",
        data: {
          pgCode: error.code,
          pgMessage: error.message,
          pgDetails: error.details,
          pgHint: error.hint,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return internalError(error);
  }

  const employees = (data ?? []).map((raw) => {
    const row = raw as {
      id: string;
      employee_id_number: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      department: string | null;
      status: string | null;
      job_position:
        | { title: string | null }
        | { title: string | null }[]
        | null;
    };
    const fullName =
      [row.first_name, row.last_name]
        .filter((part): part is string => Boolean(part))
        .join(" ")
        .trim() || null;
    return {
      id: row.id,
      employee_id_number: row.employee_id_number,
      full_name: fullName,
      email: row.email,
      department: row.department,
      job_title: Array.isArray(row.job_position)
        ? row.job_position[0]?.title ?? null
        : row.job_position?.title ?? null,
      status: row.status,
    };
  });

  // #region agent log
  fetch("http://127.0.0.1:7412/ingest/0eaccd84-c262-43ee-a949-541d824d3d38", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "994ee8",
    },
    body: JSON.stringify({
      sessionId: "994ee8",
      runId: "pre-fix",
      hypothesisId: "F",
      location: "api/employees/route.ts:GET",
      message: "directory job title sourced from hr1_job_positions join",
      data: {
        employeeCount: employees.length,
        withJobTitle: employees.filter((e) => Boolean(e.job_title)).length,
        firstJoinShape: (data ?? [])[0]
          ? {
              hasJobPositionKey: Object.prototype.hasOwnProperty.call(
                (data ?? [])[0] as object,
                "job_position"
              ),
              jobPositionIsArray: Array.isArray(
                ((data ?? [])[0] as { job_position?: unknown }).job_position
              ),
            }
          : null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({ employees });
});
