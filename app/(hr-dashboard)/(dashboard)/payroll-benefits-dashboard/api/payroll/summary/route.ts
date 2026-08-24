import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "../../../lib/auth/requireAdmin";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { count: activeEmployees, error: empError } = await supabaseAdmin
      .from("hr1_employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (empError) {
      console.error("Error fetching active employees:", empError);
    }

    const today = new Date().toISOString().split("T")[0];
    const { count: todayAttendance, error: attError } = await supabaseAdmin
      .from("hr2_attendance_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "On-Shift")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    if (attError) {
      console.error("Error fetching attendance:", attError);
    }

    // Get open (draft) payroll runs
    const { count: openRuns, error: runsError } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft");

    if (runsError) {
      console.error("Error fetching open runs:", runsError);
    }

    const { data: lastRun, error: lastRunError } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("*")
      .eq("status", "completed")
      .order("run_date", { ascending: false })
      .limit(1)
      .single();

    let lastRunNetPay = 0;
    if (lastRun && !lastRunError) {
      const { data: payslips, error: payslipError } = await supabaseAdmin
        .from("hr4_payslips")
        .select("net_pay")
        .eq("payroll_run_id", lastRun.id);

      if (!payslipError && payslips) {
        lastRunNetPay = payslips.reduce((sum, p) => sum + Number(p.net_pay), 0);
      }
    }

    // Get YTD net pay (current year)
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;

    const { data: ytdRuns, error: ytdError } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("id")
      .eq("status", "completed")
      .gte("period_start", yearStart)
      .lte("period_end", yearEnd);

    let ytdNetPay = 0;
    if (!ytdError && ytdRuns && ytdRuns.length > 0) {
      const runIds = ytdRuns.map((r) => r.id);
      const { data: ytdPayslips, error: ytdPayslipError } = await supabaseAdmin
        .from("hr4_payslips")
        .select("net_pay")
        .in("payroll_run_id", runIds);

      if (!ytdPayslipError && ytdPayslips) {
        ytdNetPay = ytdPayslips.reduce((sum, p) => sum + Number(p.net_pay), 0);
      }
    }

    return NextResponse.json({
      active_employees: activeEmployees || 0,
      today_attendance: todayAttendance || 0,
      open_runs: openRuns || 0,
      last_run_net_pay: lastRunNetPay,
      ytd_net_pay: ytdNetPay,
    });
  } catch (error) {
    console.error("GET /summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
