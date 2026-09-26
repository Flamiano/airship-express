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
    const fiscalYear = url.searchParams.get("fiscal_year");
    const year = fiscalYear ? parseInt(fiscalYear) : new Date().getFullYear();

    const { data: plans, error: planErr } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .select("*")
      .eq("fiscal_year", year)
      .order("month", { ascending: true });

    if (planErr) {
      return NextResponse.json({ error: planErr.message }, { status: 500 });
    }

    const { data: actuals, error: actualErr } = await supabaseAdmin
      .from("hr4_compen_labor_actual_monthly")
      .select("*")
      .eq("fiscal_year", year);

    if (actualErr) {
      console.error("labor actuals error:", actualErr);
    }

    const actualMap = new Map<number, number>();
    (actuals || []).forEach((a: any) => {
      actualMap.set(a.month, Number(a.actual_amount) || 0);
    });

    const planMap = new Map<number, any>();
    (plans || []).forEach((p: any) => {
      planMap.set(p.month, p);
    });

    const rows = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const plan = planMap.get(month) || null;
      const actual = actualMap.get(month) || 0;
      const planned = plan?.planned_amount ?? 0;
      const variance = actual - planned;
      const variancePct = planned > 0 ? (variance / planned) * 100 : 0;
      return {
        month,
        planned_amount: planned,
        actual_amount: actual,
        variance,
        variance_pct: variancePct,
        is_over_budget: planned > 0 && actual > planned,
        status: plan?.status || null,
        plan_id: plan?.id || null,
        notes: plan?.notes || null,
        created_by_name: plan?.created_by_name || null,
        last_modified_by_name: plan?.last_modified_by_name || null,
      };
    });

    const totalPlanned = rows.reduce((s, r) => s + r.planned_amount, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual_amount, 0);
    const monthsOver = rows.filter((r) => r.is_over_budget).length;
    const monthsPlanned = rows.filter((r) => r.planned_amount > 0).length;

    return NextResponse.json({
      fiscal_year: year,
      rows,
      totals: {
        total_planned: totalPlanned,
        total_actual: totalActual,
        variance: totalActual - totalPlanned,
        variance_pct:
          totalPlanned > 0
            ? ((totalActual - totalPlanned) / totalPlanned) * 100
            : 0,
        months_over: monthsOver,
        months_planned: monthsPlanned,
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

    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .select("id")
      .eq("fiscal_year", fiscalYear)
      .eq("month", month)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("hr4_compen_labor_budget_monthly")
        .update({
          planned_amount: plannedAmount,
          notes: body.notes?.trim() || null,
          status: body.status || "draft",
          last_modified_by: admin.id,
          last_modified_by_name: admin.fullName,
          last_modified_at: now,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data);
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .insert({
        fiscal_year: fiscalYear,
        month,
        planned_amount: plannedAmount,
        notes: body.notes?.trim() || null,
        status: body.status || "draft",
        created_by: admin.id,
        created_by_name: admin.fullName,
        last_modified_by: admin.id,
        last_modified_by_name: admin.fullName,
        last_modified_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("POST /compensation/labor-budget error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
