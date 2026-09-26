import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const MISSING_TABLE_RE =
  /schema cache|could not find the table|does not exist|relation .* does not exist/i;

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { count: totalEmployees, error: empError } = await supabaseAdmin
      .from("hr1_employees")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (empError) {
      console.error("Error fetching employee count:", empError);
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    const { count: gradeCount, error: gradeError } = await supabaseAdmin
      .from("hr4_compen_salary_grades")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (gradeError) {
      console.error("Error fetching grade count:", gradeError);
      return NextResponse.json({ error: gradeError.message }, { status: 500 });
    }

    const { data: employees, error: viewError } = await supabaseAdmin
      .from("hr4_compen_employee_summary")
      .select("*");

    let employeeRows: any[] = [];

    if (viewError) {
      if (MISSING_TABLE_RE.test(viewError.message)) {
        console.warn(
          "[compensation/summary] hr4_compen_employee_summary missing — using hr1_employees fallback."
        );
        const { data: fallback, error: fallbackErr } = await supabaseAdmin
          .from("hr1_employees")
          .select("id, first_name, last_name, status")
          .eq("status", "active");
        if (fallbackErr) {
          console.error("[compensation/summary] fallback failed:", fallbackErr);
        }
        employeeRows = (fallback ?? []).map((e: any) => ({
          employee_id: e.id,
          employee_status: e.status,
          effective_daily_rate: 0,
          is_custom_rate: false,
        }));
      } else {
        console.error("Error fetching employee summary:", viewError);
        return NextResponse.json({ error: viewError.message }, { status: 500 });
      }
    } else {
      employeeRows = employees ?? [];
    }

    const totalMonthlyPayroll = employeeRows.reduce(
      (sum, e) => sum + (e.effective_daily_rate || 0) * 24,
      0
    );
    const averageSalary =
      employeeRows.length > 0 ? totalMonthlyPayroll / employeeRows.length : 0;
    const customRateCount = employeeRows.filter((e) => e.is_custom_rate).length;

    const { data: allowances, error: allowError } = await supabaseAdmin
      .from("hr4_compen_employee_benefits")
      .select("amount")
      .eq("is_active", true)
      .eq("frequency", "monthly");

    if (allowError) {
      console.error("Error fetching allowances:", allowError);
      return NextResponse.json({ error: allowError.message }, { status: 500 });
    }

    const totalAllowances = (allowances || []).reduce(
      (sum, a) => sum + (a.amount || 0),
      0
    );

    const { data: bonuses, error: bonusError } = await supabaseAdmin
      .from("hr4_compen_bonus_allocations")
      .select("amount")
      .in("status", ["approved", "paid"]);

    if (bonusError) {
      console.error("Error fetching bonuses:", bonusError);
      return NextResponse.json({ error: bonusError.message }, { status: 500 });
    }

    const totalBonuses = (bonuses || []).reduce(
      (sum, b) => sum + (b.amount || 0),
      0
    );

    const { data: budgets, error: budgetError } = await supabaseAdmin
      .from("hr4_compen_budget_plans")
      .select("total_budget, actual_spent")
      .eq("status", "active");

    if (budgetError) {
      console.error("Error fetching budgets:", budgetError);
      return NextResponse.json({ error: budgetError.message }, { status: 500 });
    }

    const totalBudget = (budgets || []).reduce(
      (sum, b) => sum + (b.total_budget || 0),
      0
    );
    const totalActualSpent = (budgets || []).reduce(
      (sum, b) => sum + (b.actual_spent || 0),
      0
    );
    const budgetUtilization =
      totalBudget > 0 ? Math.round((totalActualSpent / totalBudget) * 100) : 0;

    const { count: pendingMerit, error: meritError } = await supabaseAdmin
      .from("hr4_compen_merit_planning")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "pending_review"]);

    if (meritError) {
      console.error("Error fetching merit data:", meritError);
      return NextResponse.json({ error: meritError.message }, { status: 500 });
    }

    const summary = {
      total_employees: totalEmployees || 0,
      total_monthly_payroll: totalMonthlyPayroll,
      total_annual_payroll: totalMonthlyPayroll * 12,
      average_salary: averageSalary,
      salary_grade_count: gradeCount || 0,
      custom_rate_count: customRateCount,
      total_allowances: totalAllowances,
      total_bonus_allocated: totalBonuses,
      budget_utilization: budgetUtilization,
      pending_merit_reviews: pendingMerit || 0,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /compensation/summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
