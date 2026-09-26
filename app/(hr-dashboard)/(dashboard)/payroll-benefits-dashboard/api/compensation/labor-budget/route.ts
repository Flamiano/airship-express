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

    const url = new URL(request.url);
    const fiscalYearParam = url.searchParams.get("fiscal_year");
    const year = fiscalYearParam
      ? parseInt(fiscalYearParam)
      : new Date().getFullYear();

    const { data: plans, error: planErr } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .select("*")
      .eq("fiscal_year", year)
      .order("month", { ascending: true });

    if (planErr) {
      return NextResponse.json({ error: planErr.message }, { status: 500 });
    }

    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    const { data: payslips, error: psErr } = await supabaseAdmin
      .from("hr4_payslips")
      .select(
        "gross_pay, hr4_payroll_runs!inner(period_start, period_end, status)"
      )
      .gte("hr4_payroll_runs.period_end", startOfYear)
      .lte("hr4_payroll_runs.period_start", endOfYear)
      .in("hr4_payroll_runs.status", ["approved", "completed"]);

    if (psErr) {
      console.error("payslip actuals error:", psErr);
    }

    const actualMap = new Map<number, number>();
    (payslips || []).forEach((p: any) => {
      const run = Array.isArray(p.hr4_payroll_runs)
        ? p.hr4_payroll_runs[0]
        : p.hr4_payroll_runs;
      if (!run?.period_end) return;
      const month = new Date(run.period_end).getMonth() + 1;
      actualMap.set(
        month,
        (actualMap.get(month) || 0) + (Number(p.gross_pay) || 0)
      );
    });

    const planMap = new Map<number, any>();
    (plans || []).forEach((p: any) => planMap.set(p.month, p));

    const rows = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const plan = planMap.get(month) || null;
      const actual = actualMap.get(month) || 0;
      const planned = Number(plan?.planned_amount ?? 0);
      const remaining = planned - actual;
      const overspend = actual - planned;
      const usagePct = planned > 0 ? (actual / planned) * 100 : 0;

      return {
        id: plan?.id || null,
        plan_id: plan?.id || null,
        month,
        planned_amount: planned,
        actual_amount: actual,
        remaining,
        overspend,
        usage_pct: usagePct,
        is_over_budget: planned > 0 && actual > planned,
        status: plan?.status || null,
        notes: plan?.notes || null,
        rejection_reason: plan?.rejection_reason || null,
        created_by_name: plan?.created_by_name || null,
        approved_by_name: plan?.approved_by_name || null,
        approved_at: plan?.approved_at || null,
        rejected_by_name: plan?.rejected_by_name || null,
        rejected_at: plan?.rejected_at || null,
        submitted_for_approval_at: plan?.submitted_for_approval_at || null,
        last_modified_by_name: plan?.last_modified_by_name || null,
      };
    });

    const totalPlanned = rows.reduce((s, r) => s + r.planned_amount, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual_amount, 0);
    const totalRemaining = totalPlanned - totalActual;

    return NextResponse.json({
      fiscal_year: year,
      rows,
      totals: {
        total_planned: totalPlanned,
        total_actual: totalActual,
        total_remaining: totalRemaining,
        variance: totalActual - totalPlanned,
        variance_pct:
          totalPlanned > 0
            ? ((totalActual - totalPlanned) / totalPlanned) * 100
            : 0,
        months_over: rows.filter((r) => r.is_over_budget).length,
        months_planned: rows.filter((r) => r.planned_amount > 0).length,
        months_pending: rows.filter((r) => r.status === "pending_approval")
          .length,
        months_approved: rows.filter((r) => r.status === "approved").length,
        months_active: rows.filter((r) => r.status === "active").length,
        months_rejected: rows.filter((r) => r.status === "rejected").length,
      },
    });
  } catch (error: any) {
    console.error("GET /compensation/labor-budget error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const admin = authResult as {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };

    const body = await request.json();
    const fiscalYear = Number(body.fiscal_year);
    const month = Number(body.month);
    const plannedAmount = Number(body.planned_amount) || 0;

    if (!fiscalYear || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid year or month" },
        { status: 400 }
      );
    }

    if (plannedAmount <= 0) {
      return NextResponse.json(
        { error: "Planned amount must be greater than zero." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .select("id, status")
      .eq("fiscal_year", fiscalYear)
      .eq("month", month)
      .maybeSingle();

    if (existing?.id) {
      if (existing.status && !["draft", "rejected"].includes(existing.status)) {
        return NextResponse.json(
          {
            error: `Cannot edit a budget with status "${existing.status}". Only drafts or rejected budgets can be edited.`,
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("hr4_compen_labor_budget_monthly")
        .update({
          planned_amount: plannedAmount,
          notes: body.notes?.trim() || null,
          status: "draft",
          rejection_reason: null,
          rejected_by: null,
          rejected_by_name: null,
          rejected_at: null,
          last_modified_by: admin.id,
          last_modified_by_name: admin.fullName,
          last_modified_at: now,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .insert({
        fiscal_year: fiscalYear,
        month,
        planned_amount: plannedAmount,
        notes: body.notes?.trim() || null,
        status: "draft",
        created_by: admin.id,
        created_by_name: admin.fullName,
        last_modified_by: admin.id,
        last_modified_by_name: admin.fullName,
        last_modified_at: now,
      })
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("POST /compensation/labor-budget error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
