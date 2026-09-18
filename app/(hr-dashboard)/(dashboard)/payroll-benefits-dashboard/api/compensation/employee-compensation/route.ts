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

    let query = supabaseAdmin
      .from("hr1_employees")
      .select(
        `
        id,
        employee_id_number,
        first_name,
        last_name,
        job_position_id,
        date_hired,
        status,
        hr1_job_positions (
          id,
          title,
          department
        )
      `
      )
      .eq("status", "active");

    if (employeeId) {
      query = query.eq("id", employeeId);
    }

    const { data: employees, error: empError } = await query;

    if (empError) {
      console.error("Error fetching employees:", empError);
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    const { data: jobSettings, error: settingsError } = await supabaseAdmin
      .from("hr4_job_position_settings")
      .select("*");

    if (settingsError) {
      console.error("Error fetching job settings:", settingsError);
      return NextResponse.json(
        { error: settingsError.message },
        { status: 500 }
      );
    }

    const settingsMap = new Map();
    (jobSettings || []).forEach((setting: any) => {
      settingsMap.set(setting.job_position_id, setting);
    });

    const { data: payrollInfo, error: payrollError } = await supabaseAdmin
      .from("hr4_employee_payroll_info")
      .select("*");

    if (payrollError) {
      console.error("Error fetching payroll info:", payrollError);
      return NextResponse.json(
        { error: payrollError.message },
        { status: 500 }
      );
    }

    const payrollMap = new Map();
    (payrollInfo || []).forEach((info: any) => {
      payrollMap.set(info.employee_id, info);
    });

    const { data: benefits, error: benefitsError } = await supabaseAdmin
      .from("hr4_compen_employee_benefits")
      .select("*")
      .eq("is_active", true);

    if (benefitsError) {
      console.error("Error fetching benefits:", benefitsError);
      return NextResponse.json(
        { error: benefitsError.message },
        { status: 500 }
      );
    }

    const benefitsMap = new Map();
    (benefits || []).forEach((b: any) => {
      if (!benefitsMap.has(b.employee_id)) {
        benefitsMap.set(b.employee_id, []);
      }
      benefitsMap.get(b.employee_id).push(b);
    });

    const { data: rateHistory, error: historyError } = await supabaseAdmin
      .from("hr4_rate_change_log")
      .select("*")
      .eq("scope", "employee")
      .order("created_at", { ascending: false });

    if (historyError) {
      console.error("Error fetching rate history:", historyError);
    }

    const historyMap = new Map();
    (rateHistory || []).forEach((h: any) => {
      if (!historyMap.has(h.employee_id)) {
        historyMap.set(h.employee_id, []);
      }
      historyMap.get(h.employee_id).push(h);
    });

    const { data: incentives, error: incentivesError } = await supabaseAdmin
      .from("hr4_employee_incentives")
      .select("*")
      .order("created_at", { ascending: false });

    if (incentivesError) {
      console.error("Error fetching incentives:", incentivesError);
    }

    const incentivesMap = new Map();
    (incentives || []).forEach((inc: any) => {
      if (!incentivesMap.has(inc.employee_id)) {
        incentivesMap.set(inc.employee_id, []);
      }
      incentivesMap.get(inc.employee_id).push(inc);
    });

    const { data: incentivesHistory, error: incentivesHistoryError } =
      await supabaseAdmin
        .from("hr4_incentives_history")
        .select("*")
        .order("created_at", { ascending: false });

    if (incentivesHistoryError) {
      console.error(
        "Error fetching incentives history:",
        incentivesHistoryError
      );
    }

    const incentivesHistoryMap = new Map();
    (incentivesHistory || []).forEach((h: any) => {
      if (!incentivesHistoryMap.has(h.employee_id)) {
        incentivesHistoryMap.set(h.employee_id, []);
      }
      incentivesHistoryMap.get(h.employee_id).push(h);
    });

    const formattedEmployees = (employees || []).map((emp: any) => {
      const employeeId = emp.id;
      const jobPos = emp.hr1_job_positions || {};
      const settings = settingsMap.get(emp.job_position_id) || {};
      const payroll = payrollMap.get(employeeId) || {};
      const employeeBenefits = benefitsMap.get(employeeId) || [];
      const employeeHistory = historyMap.get(employeeId) || [];
      const employeeIncentives = incentivesMap.get(employeeId) || [];
      const employeeIncentivesHistory =
        incentivesHistoryMap.get(employeeId) || [];

      const positionDefaultDailyRate = Number(settings.daily_rate) || 0;
      const customDailyRate = payroll.custom_daily_rate || null;
      const effectiveDailyRate =
        customDailyRate && customDailyRate > 0
          ? customDailyRate
          : positionDefaultDailyRate;
      const monthlySalary = effectiveDailyRate * 24;
      const baseSalary = payroll.basic_salary || monthlySalary;
      const dailyRate = payroll.daily_rate || effectiveDailyRate;

      const monthlyAllowances = employeeBenefits
        .filter((b: any) => b.frequency === "monthly")
        .reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

      const otherBenefits = employeeBenefits
        .filter((b: any) => b.frequency !== "monthly")
        .reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

      const taxableBenefits = employeeBenefits
        .filter((b: any) => b.is_taxable)
        .reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

      const nonTaxableBenefits = employeeBenefits
        .filter((b: any) => !b.is_taxable)
        .reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

      const activeIncentives = employeeIncentives.filter(
        (inc: any) => inc.is_active_now === true
      );
      const totalActiveIncentives = activeIncentives.reduce(
        (sum: number, inc: any) => sum + (inc.amount || 0),
        0
      );

      const totalMonthlyCompensation =
        monthlySalary + monthlyAllowances + totalActiveIncentives;
      const totalAnnualCompensation =
        monthlySalary * 12 +
        monthlyAllowances * 12 +
        otherBenefits +
        totalActiveIncentives * 12;

      return {
        employee_id: employeeId,
        employee_id_number: emp.employee_id_number,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        job_position_id: emp.job_position_id,
        job_title: jobPos.title || null,
        department: jobPos.department || null,
        date_hired: emp.date_hired,
        employee_status: emp.status,
        position_default_daily_rate: positionDefaultDailyRate,
        custom_daily_rate: customDailyRate,
        effective_daily_rate: effectiveDailyRate,
        is_custom_rate:
          customDailyRate !== null &&
          customDailyRate > 0 &&
          customDailyRate !== positionDefaultDailyRate,
        basic_salary: baseSalary,
        monthly_salary: monthlySalary,
        daily_rate: dailyRate,
        incentives: payroll.incentives || 0,
        incentive_description: payroll.incentive_description || null,
        salary_adjustment_reason: payroll.salary_adjustment_reason || null,
        is_active: payroll.is_active !== false,
        monthly_allowances: monthlyAllowances,
        other_benefits: otherBenefits,
        taxable_benefits: taxableBenefits,
        non_taxable_benefits: nonTaxableBenefits,
        total_monthly_compensation: totalMonthlyCompensation,
        total_annual_compensation: totalAnnualCompensation,
        hours_per_day: settings.hours_per_day || 8,
        break_hours: settings.break_hours || 1,
        overtime_rate: settings.overtime_rate || 1.25,
        grade_code: null,
        grade_name: null,
        grade_level: null,
        step_number: null,
        step_amount: null,
        total_active_incentives: totalActiveIncentives,
        rate_history: employeeHistory.map((h: any) => ({
          id: h.id,
          previous_daily_rate: h.previous_daily_rate,
          new_daily_rate: h.new_daily_rate,
          reason: h.reason,
          admin_name: h.admin_name,
          created_at: h.created_at,
        })),
        incentives_history: employeeIncentivesHistory.map((h: any) => ({
          id: h.id,
          incentive_id: h.incentive_id,
          previous_amount: h.previous_amount,
          new_amount: h.new_amount,
          previous_description: h.previous_description,
          new_description: h.new_description,
          previous_period_start: h.previous_period_start,
          new_period_start: h.new_period_start,
          previous_period_end: h.previous_period_end,
          new_period_end: h.new_period_end,
          action: h.action,
          admin_name: h.admin_name,
          created_at: h.created_at,
        })),
        active_incentives: activeIncentives.map((inc: any) => ({
          id: inc.id,
          amount: inc.amount,
          description: inc.description,
          period_start: inc.period_start,
          period_end: inc.period_end,
        })),
        benefits_history: employeeBenefits.map((b: any) => ({
          id: b.id,
          benefit_name: b.benefit_name,
          amount: b.amount,
          frequency: b.frequency,
          is_taxable: b.is_taxable,
          effective_date: b.effective_date,
          expiry_date: b.expiry_date,
          last_modified_by_name: b.last_modified_by_name,
          updated_at: b.updated_at,
        })),
      };
    });

    if (employeeId && formattedEmployees.length === 0) {
      return NextResponse.json(null);
    }

    return NextResponse.json(
      employeeId ? formattedEmployees[0] || null : formattedEmployees
    );
  } catch (error) {
    console.error("GET /compensation/employee-compensation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
