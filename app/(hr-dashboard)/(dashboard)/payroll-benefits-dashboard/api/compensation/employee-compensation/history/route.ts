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
    const historyType = searchParams.get("type") || "all";

    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const result: any = {};

    if (historyType === "all" || historyType === "rate") {
      const { data: rateHistory, error: rateError } = await supabaseAdmin
        .from("hr4_rate_change_log")
        .select("*")
        .eq("scope", "employee")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (!rateError) {
        result.rate_history = rateHistory || [];
      }
    }

    if (historyType === "all" || historyType === "incentives") {
      const { data: incentives, error: incError } = await supabaseAdmin
        .from("hr4_employee_incentives")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (!incError) {
        result.incentives_history = incentives || [];
      }
    }

    if (historyType === "all" || historyType === "benefits") {
      const { data: benefits, error: benError } = await supabaseAdmin
        .from("hr4_compen_employee_benefits")
        .select("*")
        .eq("employee_id", employeeId)
        .order("updated_at", { ascending: false });

      if (!benError) {
        result.benefits_history = benefits || [];
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "GET /compensation/employee-compensation/history error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
