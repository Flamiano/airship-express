import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");
    const jobPositionId = searchParams.get("job_position_id");

    if (!employeeId && !jobPositionId) {
      return NextResponse.json(
        { error: "employee_id or job_position_id is required." },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("hr4_rate_change_log")
      .select("*")
      .order("created_at", { ascending: false });

    if (employeeId) {
      query = query.eq("scope", "employee").eq("employee_id", employeeId);
    } else if (jobPositionId) {
      query = query
        .eq("scope", "position")
        .eq("job_position_id", jobPositionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching rate history:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((row: any) => ({
      id: row.id,
      scope: row.scope,
      admin_name: row.admin_name || null,
      admin_email: row.admin_email || null,
      action: row.action,
      previous_daily_rate:
        row.previous_daily_rate != null
          ? Number(row.previous_daily_rate)
          : null,
      new_daily_rate:
        row.new_daily_rate != null ? Number(row.new_daily_rate) : null,
      previous_incentives:
        row.previous_incentives != null
          ? Number(row.previous_incentives)
          : null,
      new_incentives:
        row.new_incentives != null ? Number(row.new_incentives) : null,
      reason: row.reason || null,
      created_at: row.created_at,
    }));

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /rate-history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
