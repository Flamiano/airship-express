import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

function extractIdFromUrl(url: string): string | null {
  const parts = url.split("/");
  return parts[parts.length - 2] || null;
}

const PERIODS_PER_MONTH: Record<string, number> = {
  monthly: 1,
  semi_monthly: 2,
  weekly: 4,
  bi_weekly: 2,
};

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const id = extractIdFromUrl(request.url);
    if (!id) {
      return NextResponse.json(
        { error: "Payroll run ID is required" },
        { status: 400 }
      );
    }

    const runId = Number(id);
    if (isNaN(runId)) {
      return NextResponse.json(
        { error: "Invalid payroll run ID" },
        { status: 400 }
      );
    }

    // Get the payroll run
    const { data: run, error: runError } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: runError?.message || "Payroll run not found." },
        { status: 404 }
      );
    }

    if (run.status === "completed") {
      return NextResponse.json(
        {
          error: "This run is already completed. Void it before reprocessing.",
        },
        { status: 409 }
      );
    }

    const asOfDate = run.period_end;

    // Fetch all required data in parallel
    const [
      { data: payrollInfos, error: infoError },
      { data: sssBrackets },
      { data: philhealthRates },
      { data: pagibigTiers },
      { data: jobSettings },
      { data: jobPositions },
    ] = await Promise.all([
      supabaseAdmin
        .from("hr4_employee_payroll_info")
        .select(
          `
          *,
          hr1_employees (
            id,
            job_position_id,
            first_name,
            last_name,
            employee_id_number,
            hr1_job_positions (
              id,
              title,
              department
            )
          )
        `
        )
        .eq("is_active", true),
      supabaseAdmin
        .from("hr4_sss_brackets")
        .select("*")
        .eq("is_active", true)
        .order("range_min", { ascending: true }),
      supabaseAdmin
        .from("hr4_philhealth_rates")
        .select("*")
        .eq("is_active", true)
        .order("base_min_salary", { ascending: true }),
      supabaseAdmin
        .from("hr4_pagibig_tiers")
        .select("*")
        .eq("is_active", true)
        .order("salary_min", { ascending: true }),
      supabaseAdmin.from("hr4_job_position_settings").select("*"),
      supabaseAdmin.from("hr1_job_positions").select("*").eq("is_active", true),
    ]);

    if (infoError) {
      return NextResponse.json({ error: infoError.message }, { status: 500 });
    }

    if (!payrollInfos || payrollInfos.length === 0) {
      return NextResponse.json(
        { error: "No active employees with payroll info found." },
        { status: 400 }
      );
    }

    // Create maps for quick lookup
    const settingsMap = new Map();
    (jobSettings || []).forEach((setting: any) => {
      settingsMap.set(setting.job_position_id, setting);
    });

    const positionMap = new Map();
    (jobPositions || []).forEach((pos: any) => {
      positionMap.set(pos.id, pos);
    });

    // Get attendance for the period
    const { data: attendanceLogs } = await supabaseAdmin
      .from("hr2_attendance_logs")
      .select("employee_id, status, shift_start, shift_end, created_at")
      .gte("created_at", `${run.period_start}T00:00:00`)
      .lte("created_at", `${run.period_end}T23:59:59`);

    // Group attendance by employee
    const attendanceByEmployee = new Map();
    (attendanceLogs || []).forEach((log: any) => {
      if (!attendanceByEmployee.has(log.employee_id)) {
        attendanceByEmployee.set(log.employee_id, []);
      }
      attendanceByEmployee.get(log.employee_id).push(log);
    });

    const periodsPerMonth = PERIODS_PER_MONTH[run.pay_schedule] ?? 1;

    const isEffective = (row: {
      effective_date: string;
      expiry_date: string | null;
    }) =>
      row.effective_date <= asOfDate &&
      (!row.expiry_date || row.expiry_date > asOfDate);

    const payslips = payrollInfos.map((info) => {
      const salary = Number(info.basic_salary);
      const employee = info.hr1_employees || {};
      const jobPosition = employee.hr1_job_positions || {};
      const settings = settingsMap.get(employee.job_position_id) || {};
      const position = positionMap.get(employee.job_position_id) || {};
      const employeeAttendance =
        attendanceByEmployee.get(info.employee_id) || [];

      // Calculate days worked from attendance
      const daysWorked = employeeAttendance.filter(
        (log: any) => log.status === "On-Shift"
      ).length;

      // Calculate hours worked
      const totalHours = employeeAttendance.reduce(
        (total: number, log: any) => {
          if (log.status === "On-Shift") {
            const start = new Date(`1970-01-01T${log.shift_start}`);
            const end = new Date(`1970-01-01T${log.shift_end}`);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            return total + hours;
          }
          return total;
        },
        0
      );

      // Calculate daily rate from job settings or from basic salary
      const dailyRate = Number(settings.daily_rate) || salary / 30;
      const hoursPerDay = Number(settings.hours_per_day) || 8;
      const breakHours = Number(settings.break_hours) || 1;
      const overtimeRate = Number(settings.overtime_rate) || 1.25;

      // Calculate hourly rate
      const hourlyRate = dailyRate / hoursPerDay;

      // Calculate regular hours (max hours per day, minus break)
      const regularHours = Math.min(
        totalHours,
        daysWorked * (hoursPerDay - breakHours)
      );
      const overtimeHours = Math.max(0, totalHours - regularHours);

      // Calculate pay
      const regularPay = regularHours * hourlyRate;
      const overtimePay = overtimeHours * hourlyRate * overtimeRate;
      const basicPay = round2(regularPay + overtimePay);

      // Find SSS bracket based on salary
      const sssBracket = (sssBrackets || []).find(
        (b) =>
          isEffective(b) &&
          salary >= Number(b.range_min) &&
          (b.range_max == null || salary <= Number(b.range_max))
      );

      const sssEmployeeMonthly = sssBracket
        ? Number(sssBracket.employee_share)
        : 0;
      const sssEmployerMonthly = sssBracket
        ? Number(sssBracket.employer_share) + Number(sssBracket.ec_share ?? 0)
        : 0;

      // Find PhilHealth rate
      const philhealthRate = (philhealthRates || []).find(
        (r) => isEffective(r) && salary >= Number(r.base_min_salary)
      );

      let philEmployeeMonthly = 0;
      let philEmployerMonthly = 0;
      if (philhealthRate) {
        const rawEmployee =
          (salary * Number(philhealthRate.employee_rate)) / 100;
        const rawEmployer =
          (salary * Number(philhealthRate.employer_rate)) / 100;
        const cap = Number(philhealthRate.premium_cap);
        const rawTotal = rawEmployee + rawEmployer;
        const scale = rawTotal > cap && rawTotal > 0 ? cap / rawTotal : 1;
        philEmployeeMonthly = rawEmployee * scale;
        philEmployerMonthly = rawEmployer * scale;
      }

      // Find Pag-IBIG tier
      const pagibigTier = (pagibigTiers || []).find(
        (t) =>
          isEffective(t) &&
          salary >= Number(t.salary_min) &&
          (t.salary_max == null || salary <= Number(t.salary_max))
      );

      let pagibigEmployeeMonthly = 0;
      let pagibigEmployerMonthly = 0;
      if (pagibigTier) {
        pagibigEmployeeMonthly =
          (salary * Number(pagibigTier.employee_rate)) / 100;
        pagibigEmployerMonthly =
          (salary * Number(pagibigTier.employer_rate)) / 100;
        if (pagibigTier.max_employee_share != null) {
          pagibigEmployeeMonthly = Math.min(
            pagibigEmployeeMonthly,
            Number(pagibigTier.max_employee_share)
          );
        }
        if (pagibigTier.max_employer_share != null) {
          pagibigEmployerMonthly = Math.min(
            pagibigEmployerMonthly,
            Number(pagibigTier.max_employer_share)
          );
        }
      }

      // Pro-rate deductions based on days worked
      const daysInMonth = 30; // Simplified
      const prorationFactor = Math.min(1, daysWorked / daysInMonth);

      // Compute employee shares (shown in payslip)
      const sssEmployeeShare = round2(
        (sssEmployeeMonthly / periodsPerMonth) * prorationFactor
      );
      const philEmployeeShare = round2(
        (philEmployeeMonthly / periodsPerMonth) * prorationFactor
      );
      const pagibigEmployeeShare = round2(
        (pagibigEmployeeMonthly / periodsPerMonth) * prorationFactor
      );

      // Compute employer shares (for admin reference, not shown in payslip)
      const sssEmployerShare = round2(
        (sssEmployerMonthly / periodsPerMonth) * prorationFactor
      );
      const philEmployerShare = round2(
        (philEmployerMonthly / periodsPerMonth) * prorationFactor
      );
      const pagibigEmployerShare = round2(
        (pagibigEmployerMonthly / periodsPerMonth) * prorationFactor
      );

      const withholdingTax = 0; // TODO: BIR withholding tax computation
      const otherDeductions = 0;

      const totalDeductions = round2(
        sssEmployeeShare +
          philEmployeeShare +
          pagibigEmployeeShare +
          withholdingTax +
          otherDeductions
      );
      const grossPay = basicPay;
      const netPay = round2(grossPay - totalDeductions);

      return {
        payroll_run_id: runId,
        employee_id: info.employee_id,
        basic_pay: basicPay,
        gross_pay: grossPay,
        sss_employee_share: sssEmployeeShare,
        sss_employer_share: sssEmployerShare,
        philhealth_employee_share: philEmployeeShare,
        philhealth_employer_share: philEmployerShare,
        pagibig_employee_share: pagibigEmployeeShare,
        pagibig_employer_share: pagibigEmployerShare,
        withholding_tax: withholdingTax,
        other_deductions: otherDeductions,
        total_deductions: totalDeductions,
        net_pay: netPay,
        daily_rate: dailyRate,
        days_worked: daysWorked,
        hours_worked: round2(totalHours),
        regular_hours: round2(regularHours),
        overtime_hours: round2(overtimeHours),
      };
    });

    // Clear existing payslips
    const { error: clearError } = await supabaseAdmin
      .from("hr4_payslips")
      .delete()
      .eq("payroll_run_id", runId);

    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }

    // Insert new payslips
    const { error: insertError } = await supabaseAdmin
      .from("hr4_payslips")
      .insert(payslips);

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update run status
    const { data: updatedRun, error: statusError } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .update({
        status: "completed",
        run_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .select()
      .single();

    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 500 });
    }

    return NextResponse.json({
      run: updatedRun,
      payslips_generated: payslips.length,
    });
  } catch (error) {
    console.error("POST /process error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
