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

    const body = await request.json();
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
        `*, hr1_employees ( id, first_name, last_name, employee_id_number, birthdate, email, hr1_job_positions ( title, department ) ), hr4_payroll_runs ( period_start, period_end, pay_schedule, approval_status )`
      )
      .eq("id", payslipId)
      .single();

    if (slipErr || !slip)
      return NextResponse.json({ error: "Payslip not found" }, { status: 404 });

    const emp = Array.isArray(slip.hr1_employees)
      ? slip.hr1_employees[0]
      : slip.hr1_employees;
    if (!emp)
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    if (!emp.birthdate)
      return NextResponse.json(
        { error: "Birthdate not set. Contact HR." },
        { status: 400 }
      );

    const expected = birthdatePassword(emp.birthdate);
    if (password !== expected)
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 }
      );

    await supabaseAdmin
      .from("hr4_payslip_distributions")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("payslip_id", payslipId);

    const run = Array.isArray(slip.hr4_payroll_runs)
      ? slip.hr4_payroll_runs[0]
      : slip.hr4_payroll_runs;
    const job = Array.isArray(emp.hr1_job_positions)
      ? emp.hr1_job_positions[0]
      : emp.hr1_job_positions;

    return NextResponse.json({
      payslip: {
        id: slip.id,
        payroll_run_id: slip.payroll_run_id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        employee_id_number: emp.employee_id_number,
        email: emp.email,
        position: job?.title || null,
        department: job?.department || null,
        period_start: run?.period_start || null,
        period_end: run?.period_end || null,
        pay_schedule: run?.pay_schedule || null,
        basic_pay: Number(slip.basic_pay),
        gross_pay: Number(slip.gross_pay),
        net_pay: Number(slip.net_pay),
        daily_rate: Number(slip.daily_rate || 0),
        days_worked: Number(slip.days_worked || 0),
        hours_worked: Number(slip.hours_worked || 0),
        regular_hours: Number(slip.regular_hours || 0),
        overtime_hours: Number(slip.overtime_hours || 0),
        night_diff_hours: Number(slip.night_diff_hours || 0),
        night_diff_pay: Number(slip.night_diff_pay || 0),
        holiday_hours: Number(slip.holiday_hours || 0),
        holiday_pay: Number(slip.holiday_pay || 0),
        allowances_pay: Number(slip.allowances_pay || 0),
        bonus_pay: Number(slip.bonus_pay || 0),
        incentive_pay: Number(slip.incentive_pay || 0),
        sss_employee_share: Number(slip.sss_employee_share || 0),
        sss_employer_share: Number(slip.sss_employer_share || 0),
        philhealth_employee_share: Number(slip.philhealth_employee_share || 0),
        philhealth_employer_share: Number(slip.philhealth_employer_share || 0),
        pagibig_employee_share: Number(slip.pagibig_employee_share || 0),
        pagibig_employer_share: Number(slip.pagibig_employer_share || 0),
        withholding_tax: Number(slip.withholding_tax || 0),
        other_deductions: Number(slip.other_deductions || 0),
        total_deductions: Number(slip.total_deductions),
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
