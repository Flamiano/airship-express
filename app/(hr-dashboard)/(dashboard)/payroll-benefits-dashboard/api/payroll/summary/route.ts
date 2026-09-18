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

    const { count: activeEmployees } = await supabaseAdmin
      .from("hr1_employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    const today = new Date().toISOString().split("T")[0];

    const { count: todayAttendance } = await supabaseAdmin
      .from("hr2_attendance_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "On-Shift")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    const { count: openRuns } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft");

    const { data: lastRun } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("id")
      .eq("status", "completed")
      .order("run_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastRunNetPay = 0;
    if (lastRun) {
      const { data: payslips } = await supabaseAdmin
        .from("hr4_payslips")
        .select("net_pay")
        .eq("payroll_run_id", lastRun.id);
      if (payslips) {
        lastRunNetPay = payslips.reduce(
          (sum, p) => sum + Number(p.net_pay || 0),
          0
        );
      }
    }

    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const { data: ytdRuns } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("id")
      .eq("status", "completed")
      .gte("period_start", yearStart)
      .lte("period_end", yearEnd);

    let ytdNetPay = 0;
    let ytdGrossPay = 0;
    if (ytdRuns && ytdRuns.length > 0) {
      const runIds = ytdRuns.map((r) => r.id);
      const { data: ytdPayslips } = await supabaseAdmin
        .from("hr4_payslips")
        .select("net_pay, gross_pay")
        .in("payroll_run_id", runIds);

      if (ytdPayslips) {
        ytdNetPay = ytdPayslips.reduce(
          (sum, p) => sum + Number(p.net_pay || 0),
          0
        );
        ytdGrossPay = ytdPayslips.reduce(
          (sum, p) => sum + Number(p.gross_pay || 0),
          0
        );
      }
    }

    const { count: totalJobs } = await supabaseAdmin
      .from("hr1_job_positions")
      .select("*", { count: "exact", head: true });

    const { count: openForHiring } = await supabaseAdmin
      .from("hr1_job_positions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    const { count: closedForHiring } = await supabaseAdmin
      .from("hr1_job_positions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false);

    const active = activeEmployees ?? 0;
    const present = todayAttendance ?? 0;
    const attendanceRate =
      active > 0 ? Math.round((present / active) * 100) : 0;

    const { data: recentHires } = await supabaseAdmin
      .from("hr1_employees")
      .select(
        `
        id,
        first_name,
        last_name,
        date_hired,
        hr1_job_positions (
          title
        )
      `
      )
      .eq("status", "active")
      .order("date_hired", { ascending: false })
      .limit(3);

    const recentHiresFormatted = (recentHires || []).map((emp: any) => ({
      id: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
      position: emp.hr1_job_positions?.title || "No Position",
      date_hired: emp.date_hired,
    }));

    const { data: positions } = await supabaseAdmin
      .from("hr1_job_positions")
      .select("department")
      .eq("is_active", true);

    const deptCounts: Record<string, number> = {};
    (positions || []).forEach((p: any) => {
      const d = p.department || "Unassigned";
      deptCounts[d] = (deptCounts[d] || 0) + 1;
    });

    return NextResponse.json(
      {
        active_employees: active,
        today_attendance: present,
        attendance_rate: attendanceRate,
        open_runs: openRuns ?? 0,
        last_run_net_pay: lastRunNetPay,
        ytd_net_pay: ytdNetPay,
        ytd_gross_pay: ytdGrossPay,
        total_jobs: totalJobs ?? 0,
        open_for_hiring: openForHiring ?? 0,
        closed_for_hiring: closedForHiring ?? 0,
        recent_hires: recentHiresFormatted,
        position_distribution: deptCounts,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("GET /summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
