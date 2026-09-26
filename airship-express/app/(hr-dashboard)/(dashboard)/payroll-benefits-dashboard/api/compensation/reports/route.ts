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
    const reportType = url.searchParams.get("type") || "salary_distribution";
    const year = url.searchParams.get("year") || new Date().getFullYear();

    let reportData: any = {};

    switch (reportType) {
      case "salary_distribution":
        reportData = await getSalaryDistribution(parseInt(year));
        break;
      case "payroll_forecast":
        reportData = await getPayrollForecast(parseInt(year));
        break;
      case "total_rewards":
        reportData = await getTotalRewards(parseInt(year));
        break;
      case "budget_variance":
        reportData = await getBudgetVariance(parseInt(year));
        break;
      case "merit_review":
        reportData = await getMeritReview(parseInt(year));
        break;
      case "compensation_ratio":
        reportData = await getCompensationRatio(parseInt(year));
        break;
      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 }
        );
    }

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("GET /compensation/reports error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getSalaryDistribution(year: number) {
  const { data: distribution, error } = await supabaseAdmin
    .from("hr4_compen_employee_summary")
    .select("grade_code, grade_name, effective_daily_rate")
    .eq("employee_status", "active");

  if (error) {
    console.error("Error getting salary distribution:", error);
    return { error: error.message };
  }

  const gradeMap: Record<
    string,
    { grade_code: string; grade_name: string; employees: any[] }
  > = {};
  (distribution || []).forEach((emp: any) => {
    const key = emp.grade_code || "No Grade";
    if (!gradeMap[key]) {
      gradeMap[key] = {
        grade_code: key,
        grade_name: emp.grade_name || key,
        employees: [],
      };
    }
    gradeMap[key].employees.push(emp);
  });

  const result = {
    total_employees: distribution?.length || 0,
    average_salary:
      distribution && distribution.length > 0
        ? distribution.reduce(
            (sum: number, e: any) => sum + (e.effective_daily_rate || 0) * 24,
            0
          ) / distribution.length
        : 0,
    min_salary:
      distribution && distribution.length > 0
        ? Math.min(
            ...distribution.map((e: any) => (e.effective_daily_rate || 0) * 24)
          )
        : 0,
    max_salary:
      distribution && distribution.length > 0
        ? Math.max(
            ...distribution.map((e: any) => (e.effective_daily_rate || 0) * 24)
          )
        : 0,
    distribution: Object.values(gradeMap).map((g: any) => ({
      grade_code: g.grade_code,
      grade_name: g.grade_name,
      employee_count: g.employees.length,
      avg_salary:
        g.employees.length > 0
          ? g.employees.reduce(
              (sum: number, e: any) => sum + (e.effective_daily_rate || 0) * 24,
              0
            ) / g.employees.length
          : 0,
      total_salary: g.employees.reduce(
        (sum: number, e: any) => sum + (e.effective_daily_rate || 0) * 24,
        0
      ),
    })),
    record_count: Object.keys(gradeMap).length,
  };

  return result;
}

async function getTotalRewards(year: number) {
  const { data: employees, error } = await supabaseAdmin
    .from("hr4_compen_employee_summary")
    .select("effective_daily_rate, monthly_allowances, other_benefits")
    .eq("employee_status", "active");

  if (error) {
    console.error("Error getting total rewards:", error);
    return { error: error.message };
  }

  const totalBaseSalary = (employees || []).reduce(
    (sum: number, e: any) => sum + (e.effective_daily_rate || 0) * 24,
    0
  );
  const totalAllowances = (employees || []).reduce(
    (sum: number, e: any) => sum + (e.monthly_allowances || 0),
    0
  );
  const totalOtherBenefits = (employees || []).reduce(
    (sum: number, e: any) => sum + (e.other_benefits || 0),
    0
  );

  const { data: bonuses, error: bonusError } = await supabaseAdmin
    .from("hr4_compen_bonus_allocations")
    .select("amount")
    .eq("fiscal_year", year)
    .in("status", ["approved", "paid"]);

  if (bonusError) {
    console.error("Error getting bonuses:", bonusError);
  }

  const totalBonuses = (bonuses || []).reduce(
    (sum: number, b: any) => sum + (b.amount || 0),
    0
  );

  return {
    total_base_salary: totalBaseSalary * 12,
    total_allowances: totalAllowances * 12,
    total_bonuses: totalBonuses,
    total_rewards:
      totalBaseSalary * 12 +
      totalAllowances * 12 +
      totalBonuses +
      totalOtherBenefits,
    employee_count: employees?.length || 0,
    record_count: 1,
  };
}

async function getBudgetVariance(year: number) {
  const { data: budgets, error } = await supabaseAdmin
    .from("hr4_compen_budget_plans")
    .select("*")
    .eq("fiscal_year", year);

  if (error) {
    console.error("Error getting budget variance:", error);
    return { error: error.message };
  }

  const totalBudget = (budgets || []).reduce(
    (sum: number, b: any) => sum + (b.total_budget || 0),
    0
  );
  const actualSpent = (budgets || []).reduce(
    (sum: number, b: any) => sum + (b.actual_spent || 0),
    0
  );
  const variance = totalBudget - actualSpent;
  const utilization =
    totalBudget > 0 ? Math.round((actualSpent / totalBudget) * 100) : 0;

  return {
    total_budget: totalBudget,
    actual_spent: actualSpent,
    variance: variance,
    utilization: utilization,
    plans: budgets || [],
    record_count: budgets?.length || 0,
  };
}

async function getMeritReview(year: number) {
  const { data: merits, error } = await supabaseAdmin
    .from("hr4_compen_merit_planning")
    .select("*")
    .eq("fiscal_year", year);

  if (error) {
    console.error("Error getting merit review:", error);
    return { error: error.message };
  }

  const approved = (merits || []).filter(
    (m: any) => m.status === "approved" || m.status === "implemented"
  );
  const pending = (merits || []).filter(
    (m: any) => m.status === "draft" || m.status === "pending_review"
  );
  const rejected = (merits || []).filter((m: any) => m.status === "rejected");

  const totalIncrease = approved.reduce(
    (sum: number, m: any) =>
      sum + (m.recommended_new_salary - m.current_salary),
    0
  );
  const avgIncrease =
    approved.length > 0
      ? approved.reduce(
          (sum: number, m: any) => sum + (m.recommended_increase_percent || 0),
          0
        ) / approved.length
      : 0;

  return {
    total_merit_plans: merits?.length || 0,
    approved_count: approved.length,
    pending_count: pending.length,
    rejected_count: rejected.length,
    total_increase_amount: totalIncrease,
    average_increase_percent: avgIncrease,
    merits: merits || [],
    record_count: merits?.length || 0,
  };
}

async function getCompensationRatio(year: number) {
  const { data: employees, error } = await supabaseAdmin
    .from("hr4_compen_employee_summary")
    .select(
      "employee_id, grade_code, grade_name, effective_daily_rate, monthly_allowances, total_monthly_compensation"
    )
    .eq("employee_status", "active");

  if (error) {
    console.error("Error getting compensation ratio:", error);
    return { error: error.message };
  }

  const { data: grades, error: gradeError } = await supabaseAdmin
    .from("hr4_compen_salary_grades")
    .select("*")
    .eq("is_active", true);

  if (gradeError) {
    console.error("Error getting grade ranges:", gradeError);
  }

  const employeesWithRatio = (employees || []).map((emp: any) => {
    const grade = (grades || []).find(
      (g: any) => g.grade_code === emp.grade_code
    );
    const midSalary = grade?.mid_salary || 0;
    const monthlySalary = (emp.effective_daily_rate || 0) * 24;
    const compaRatio = midSalary > 0 ? (monthlySalary / midSalary) * 100 : 0;
    return {
      ...emp,
      monthly_salary: monthlySalary,
      compa_ratio: compaRatio,
      mid_salary: midSalary,
      grade_min: grade?.min_salary || 0,
      grade_max: grade?.max_salary || 0,
    };
  });

  const totalEmployees = employeesWithRatio.length;
  const averageRatio =
    totalEmployees > 0
      ? employeesWithRatio.reduce(
          (sum: number, e: any) => sum + (e.compa_ratio || 0),
          0
        ) / totalEmployees
      : 0;

  return {
    total_employees: totalEmployees,
    average_compa_ratio: averageRatio,
    employees: employeesWithRatio,
    salary_grades: grades || [],
    record_count: totalEmployees,
  };
}
