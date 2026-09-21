import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function overlapMinutes(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number {
  let a1 = startA;
  let a2 = endA;
  let b1 = startB;
  let b2 = endB;

  if (a2 <= a1) a2 += 1440;
  if (b2 <= b1) b2 += 1440;

  const start = Math.max(a1, b1);
  const end = Math.min(a2, b2);
  return Math.max(0, end - start);
}

function minutesBetween(start: string, end: string): number {
  const s = timeToMinutes(start);
  let e = timeToMinutes(end);
  if (e <= s) e += 1440;
  return e - s;
}

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

    const { data: employeesWithPayroll, error: empError } = await supabaseAdmin
      .from("hr4_employee_payroll_info")
      .select(
        `
        employee_id,
        hr1_employees (
          id,
          first_name,
          last_name,
          employee_id_number,
          status
        )
      `
      )
      .eq("is_active", true);

    if (empError) {
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    const activeEmployees = (employeesWithPayroll || []).filter(
      (info: any) => info.hr1_employees?.status === "active"
    );

    if (activeEmployees.length === 0) {
      return NextResponse.json(
        { error: "No active employees with payroll info found." },
        { status: 400 }
      );
    }

    const employeeIds = activeEmployees.map((e: any) => e.employee_id);

    const { data: bankAccounts, error: bankError } = await supabaseAdmin
      .from("hr4_bank_accounts")
      .select(
        "employee_id, account_number, account_name, bank_type_id, is_active"
      )
      .in("employee_id", employeeIds);

    if (bankError) {
      console.error("Error fetching bank accounts:", bankError);
      return NextResponse.json({ error: bankError.message }, { status: 500 });
    }

    const bankMap = new Map();
    (bankAccounts || []).forEach((account: any) => {
      bankMap.set(account.employee_id, account);
    });

    const employeesWithIncompleteBank: {
      employee_id: string;
      employee_name: string;
      employee_id_number: string;
      missing: string[];
    }[] = [];

    for (const info of activeEmployees) {
      const emp = info.hr1_employees;
      const bank = bankMap.get(info.employee_id);

      const missing: string[] = [];

      if (!bank) {
        missing.push("No bank account on file");
      } else {
        if (bank.is_active === false) missing.push("Bank account is inactive");
        if (!bank.account_number) missing.push("Account number missing");
        if (!bank.account_name) missing.push("Account name missing");
        if (!bank.bank_type_id) missing.push("Bank type missing");
      }

      if (missing.length > 0) {
        employeesWithIncompleteBank.push({
          employee_id: info.employee_id,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          employee_id_number: emp.employee_id_number,
          missing,
        });
      }
    }

    if (employeesWithIncompleteBank.length > 0) {
      const count = employeesWithIncompleteBank.length;
      const names = employeesWithIncompleteBank
        .slice(0, 5)
        .map((e) => e.employee_name)
        .join(", ");
      const more = count > 5 ? ` and ${count - 5} more` : "";

      return NextResponse.json(
        {
          error: `Cannot process payroll: ${count} employee${
            count === 1 ? "" : "s"
          } have incomplete bank details.`,
          details: `Please complete bank details for: ${names}${more}.`,
          employees_with_incomplete_bank: employeesWithIncompleteBank,
        },
        { status: 400 }
      );
    }

    const asOfDate = run.period_end;

    const [
      { data: payrollInfos, error: infoError },
      { data: sssBrackets },
      { data: philhealthRates },
      { data: pagibigTiers },
      { data: jobSettings },
      { data: jobPositions },
      { data: benefits },
      { data: phHolidays },
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
      supabaseAdmin
        .from("hr4_compen_employee_benefits")
        .select("*")
        .eq("is_active", true),
      supabaseAdmin
        .from("hr4_ph_holidays")
        .select("holiday_date, type, is_active")
        .eq("is_active", true),
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

    const settingsMap = new Map();
    (jobSettings || []).forEach((setting: any) => {
      settingsMap.set(setting.job_position_id, setting);
    });

    const positionMap = new Map();
    (jobPositions || []).forEach((pos: any) => {
      positionMap.set(pos.id, pos);
    });

    const benefitsByEmployee = new Map<string, any[]>();
    (benefits || []).forEach((b: any) => {
      if (!benefitsByEmployee.has(b.employee_id)) {
        benefitsByEmployee.set(b.employee_id, []);
      }
      benefitsByEmployee.get(b.employee_id)!.push(b);
    });

    const holidayMap = new Map<string, string>();
    (phHolidays || []).forEach((h: any) => {
      holidayMap.set(h.holiday_date, h.type);
    });

    const { data: attendanceLogs } = await supabaseAdmin
      .from("hr2_attendance_logs")
      .select(
        "employee_id, status, shift_start, shift_end, time_in, time_out, created_at"
      )
      .gte("created_at", `${run.period_start}T00:00:00`)
      .lte("created_at", `${run.period_end}T23:59:59`);

    const attendanceByEmployee = new Map<string, any[]>();
    (attendanceLogs || []).forEach((log: any) => {
      if (!attendanceByEmployee.has(log.employee_id)) {
        attendanceByEmployee.set(log.employee_id, []);
      }
      attendanceByEmployee.get(log.employee_id)!.push(log);
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
      const settings = settingsMap.get(employee.job_position_id) || {};
      const employeeAttendance =
        attendanceByEmployee.get(info.employee_id) || [];

      const customDailyRate = info.custom_daily_rate
        ? Number(info.custom_daily_rate)
        : null;
      const positionDailyRate = Number(settings.daily_rate) || salary / 30;
      const dailyRate =
        customDailyRate && customDailyRate > 0
          ? customDailyRate
          : positionDailyRate;
      const hoursPerDay = Number(settings.hours_per_day) || 8;
      const breakHours = Number(settings.break_hours) || 1;
      const overtimeRate = Number(settings.overtime_rate) || 1.25;

      const hourlyRate = dailyRate / hoursPerDay;

      const daysWorked = employeeAttendance.filter(
        (log: any) => log.status === "On-Shift"
      ).length;

      const employeeBenefits = (
        benefitsByEmployee.get(info.employee_id) || []
      ).filter((b: any) => isEffective(b));

      const ndConfig = employeeBenefits.find(
        (b: any) =>
          b.night_diff_enabled === true &&
          b.night_diff_start &&
          b.night_diff_end &&
          b.deduct_from_payroll === true
      );

      let totalHours = 0;
      let regularHours = 0;
      let overtimeHours = 0;
      let nightDiffHours = 0;
      let holidayHours = 0;
      let regularHolidayHours = 0;
      let specialHolidayHours = 0;

      employeeAttendance.forEach((log: any) => {
        if (log.status !== "On-Shift") return;

        const shiftMinutes = minutesBetween(log.shift_start, log.shift_end);
        const hours = shiftMinutes / 60;
        totalHours += hours;

        const dailyRegularCap = hoursPerDay - breakHours;
        const dayRegular = Math.min(hours, dailyRegularCap);
        const dayOt = Math.max(0, hours - dailyRegularCap);
        regularHours += dayRegular;
        overtimeHours += dayOt;

        if (ndConfig) {
          const shiftStartMin = timeToMinutes(log.shift_start);
          const shiftEndMin = timeToMinutes(log.shift_end);
          const ndStartMin = timeToMinutes(ndConfig.night_diff_start);
          const ndEndMin = timeToMinutes(ndConfig.night_diff_end);

          const overlap = overlapMinutes(
            shiftStartMin,
            shiftEndMin,
            ndStartMin,
            ndEndMin
          );
          nightDiffHours += overlap / 60;
        }

        const logDate = String(log.created_at || "").slice(0, 10);
        const holidayType = holidayMap.get(logDate);
        if (holidayType) {
          holidayHours += hours;
          if (holidayType === "regular") regularHolidayHours += hours;
          else if (holidayType === "special_non_working")
            specialHolidayHours += hours;
        }
      });

      const regularPay = regularHours * hourlyRate;
      const overtimePay = overtimeHours * hourlyRate * overtimeRate;

      let nightDiffPay = 0;
      if (ndConfig && nightDiffHours > 0) {
        const ndRate = Number(ndConfig.night_diff_rate) || 1.1;
        nightDiffPay = nightDiffHours * hourlyRate * (ndRate - 1);
      }

      let holidayPay = 0;
      const holidayBenefit = employeeBenefits.find(
        (b: any) =>
          b.benefit_type === "holiday_pay" && b.deduct_from_payroll === true
      );
      if (holidayBenefit) {
        const regMultiplier = Number(holidayBenefit.holiday_multiplier) || 2.0;
        holidayPay += regularHolidayHours * hourlyRate * (regMultiplier - 1);
        holidayPay += specialHolidayHours * hourlyRate * 0.3;
      }

      let allowancesPay = 0;
      let bonusPay = 0;
      let incentivePay = 0;

      employeeBenefits.forEach((b: any) => {
        if (b.deduct_from_payroll !== true) return;

        const monthly = Number(b.amount) || 0;
        let perPeriod = 0;
        if (b.frequency === "monthly") perPeriod = monthly / periodsPerMonth;
        else if (b.frequency === "quarterly")
          perPeriod = monthly / (periodsPerMonth * 3);
        else if (b.frequency === "semi_annual")
          perPeriod = monthly / (periodsPerMonth * 6);
        else if (b.frequency === "annual")
          perPeriod = monthly / (periodsPerMonth * 12);
        else perPeriod = monthly;

        if (b.benefit_type === "allowance") allowancesPay += perPeriod;
        else if (b.benefit_type === "bonus") bonusPay += perPeriod;
        else if (b.benefit_type === "incentive") incentivePay += perPeriod;
      });

      const basicPay = round2(regularPay + overtimePay);
      const grossPay = round2(
        basicPay +
          nightDiffPay +
          holidayPay +
          allowancesPay +
          bonusPay +
          incentivePay
      );

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

      const daysInMonth = 30;
      const prorationFactor = Math.min(1, daysWorked / daysInMonth);

      const sssEmployeeShare = round2(
        (sssEmployeeMonthly / periodsPerMonth) * prorationFactor
      );
      const philEmployeeShare = round2(
        (philEmployeeMonthly / periodsPerMonth) * prorationFactor
      );
      const pagibigEmployeeShare = round2(
        (pagibigEmployeeMonthly / periodsPerMonth) * prorationFactor
      );

      const sssEmployerShare = round2(
        (sssEmployerMonthly / periodsPerMonth) * prorationFactor
      );
      const philEmployerShare = round2(
        (philEmployerMonthly / periodsPerMonth) * prorationFactor
      );
      const pagibigEmployerShare = round2(
        (pagibigEmployerMonthly / periodsPerMonth) * prorationFactor
      );

      const withholdingTax = 0;
      const otherDeductions = 0;

      const totalDeductions = round2(
        sssEmployeeShare +
          philEmployeeShare +
          pagibigEmployeeShare +
          withholdingTax +
          otherDeductions
      );

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
        night_diff_hours: round2(nightDiffHours),
        night_diff_pay: round2(nightDiffPay),
        holiday_hours: round2(holidayHours),
        holiday_pay: round2(holidayPay),
        allowances_pay: round2(allowancesPay),
        bonus_pay: round2(bonusPay),
        incentive_pay: round2(incentivePay),
      };
    });

    const { error: clearError } = await supabaseAdmin
      .from("hr4_payslips")
      .delete()
      .eq("payroll_run_id", runId);

    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }

    const { error: insertError } = await supabaseAdmin
      .from("hr4_payslips")
      .insert(payslips);

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

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
