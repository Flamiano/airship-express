import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function birthdatePassword(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${String(
    d.getFullYear()
  ).slice(-2)}`;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payslipId = Number(id);
    if (!payslipId || isNaN(payslipId)) {
      return NextResponse.json(
        { error: "Invalid payslip ID" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const password = String(body.password || "").trim();

    if (!/^\d{6}$/.test(password)) {
      return NextResponse.json(
        { error: "Password must be 6 digits (MMDDYY)." },
        { status: 400 }
      );
    }

    const { data: slip, error: slipErr } = await supabaseAdmin
      .from("hr4_payslips")
      .select(
        `*,
        hr1_employees ( id, first_name, last_name, employee_id_number, birthdate, email, department, hr1_job_positions ( title, department ) ),
        hr4_payroll_runs ( id, period_start, period_end, pay_schedule, approval_status, distributed_at )`
      )
      .eq("id", payslipId)
      .single();

    if (slipErr || !slip) {
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
    }

    const emp = Array.isArray(slip.hr1_employees)
      ? slip.hr1_employees[0]
      : slip.hr1_employees;
    if (!emp) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }
    if (!emp.birthdate) {
      return NextResponse.json(
        { error: "Birthdate not set. Contact HR." },
        { status: 400 }
      );
    }

    const expected = birthdatePassword(emp.birthdate);
    if (password !== expected) {
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 }
      );
    }

    const run = Array.isArray(slip.hr4_payroll_runs)
      ? slip.hr4_payroll_runs[0]
      : slip.hr4_payroll_runs;
    const job = Array.isArray(emp.hr1_job_positions)
      ? emp.hr1_job_positions[0]
      : emp.hr1_job_positions;

    await supabaseAdmin
      .from("hr4_payslip_distributions")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("payslip_id", payslipId);

    const basicPay = num(slip.basic_pay);
    const daysWorked = num(slip.days_worked);
    const dailyRate = num(slip.daily_rate);
    const overtime = num(slip.overtime_hours) * (dailyRate / 8) * 1.25;
    const regularHoliday = num(slip.holiday_pay);
    const specialHoliday = 0;
    const incentives = num(slip.incentive_pay);
    const load = 0;
    const transpo = num(slip.allowances_pay);
    const miscellaneous = num(slip.bonus_pay);
    const gas = 0;
    const adjustment = 0;

    const totalPay = basicPay + overtime;
    const grossTotal = num(slip.gross_pay);

    const sssLoan = 0;
    const pagibigLoan = 0;
    const cashAdvanceBalance = 0;
    const tardiness = 0;
    const penalty = 0;
    const employeeSavings = 0;
    const excess = 0;

    const totalDeduction = num(slip.total_deductions);

    return NextResponse.json({
      payslip: {
        id: slip.id,
        payroll_run_id: slip.payroll_run_id,

        employee_name: `${emp.first_name} ${emp.last_name}`,
        employee_id_number: emp.employee_id_number,
        email: emp.email,
        position: job?.title || null,
        department: job?.department || emp.department || null,

        period_start: run?.period_start || null,
        period_end: run?.period_end || null,
        pay_schedule: run?.pay_schedule || null,

        daily_rate: dailyRate,

        earnings: {
          totalPay,
          daysWorked,
          overtime,
          regularHoliday,
          specialHoliday,
          incentives,
          load,
          transpo,
          miscellaneous,
          gas,
          adjustment,
        },

        deductions: {
          sss: num(slip.sss_employee_share),
          pagibig: num(slip.pagibig_employee_share),
          philhealth: num(slip.philhealth_employee_share),
          sssLoan,
          pagibigLoan,
          cashAdvanceBalance,
          tardiness,
          penalty,
          employeeSavings,
          excess,
        },

        employer: {
          sss: num(slip.sss_employer_share),
          philhealth: num(slip.philhealth_employer_share),
          pagibig: num(slip.pagibig_employer_share),
        },

        grossTotal,
        totalDeduction,
        netPay: num(slip.net_pay),
      },
    });
  } catch (error: any) {
    console.error("POST /employee-portal/payslip error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
