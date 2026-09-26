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

    const { data: runs, error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("*")
      .order("period_start", { ascending: false });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: slipTotals } = await supabaseAdmin
      .from("hr4_payslips")
      .select("payroll_run_id, net_pay");

    const totalsByRun = new Map<number, { count: number; net: number }>();
    for (const slip of slipTotals || []) {
      const entry = totalsByRun.get(slip.payroll_run_id) || {
        count: 0,
        net: 0,
      };
      entry.count += 1;
      entry.net += Number(slip.net_pay);
      totalsByRun.set(slip.payroll_run_id, entry);
    }

    const rows = (runs || []).map((run) => ({
      ...run,
      payslip_count: totalsByRun.get(run.id)?.count ?? 0,
      total_net_pay: totalsByRun.get(run.id)?.net ?? 0,
    }));

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /runs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { period_start, period_end, pay_schedule } = body;

    if (!period_start || !period_end || !pay_schedule) {
      return NextResponse.json(
        { error: "period_start, period_end, and pay_schedule are required." },
        { status: 400 }
      );
    }
    if (new Date(period_start) > new Date(period_end)) {
      return NextResponse.json(
        { error: "Period start must be before period end" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .insert({
        period_start,
        period_end,
        pay_schedule,
        status: "draft",
        approval_status: "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /runs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
