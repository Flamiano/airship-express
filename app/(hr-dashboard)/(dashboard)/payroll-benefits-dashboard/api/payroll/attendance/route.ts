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
    const date = searchParams.get("date");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("hr2_attendance_logs")
      .select(
        "id, employee_id, status, shift_start, shift_end, terminal, created_at"
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (date) {
      query = query
        .gte("created_at", `${date}T00:00:00`)
        .lte("created_at", `${date}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching attendance history:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || [], {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /attendance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
