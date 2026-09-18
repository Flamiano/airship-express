import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const [
      { count: activeEmployees },
      { count: totalBankTypes },
      { count: totalClaimTypes },
      { count: totalJobPositions },
      { count: totalSalaryGrades },
      { count: openRuns },
    ] = await Promise.all([
      supabaseAdmin
        .from("hr1_employees")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabaseAdmin
        .from("hr4_bank_types")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabaseAdmin
        .from("hr4_claim_types")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabaseAdmin
        .from("hr1_job_positions")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabaseAdmin
        .from("hr4_compen_salary_grades")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabaseAdmin
        .from("hr4_payroll_runs")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft"),
    ]);

    return NextResponse.json(
      {
        active_employees: activeEmployees || 0,
        total_bank_types: totalBankTypes || 0,
        total_claim_types: totalClaimTypes || 0,
        total_job_positions: totalJobPositions || 0,
        total_salary_grades: totalSalaryGrades || 0,
        open_payroll_runs: openRuns || 0,
        fetched_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("GET ai/api/context/system-summary error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
