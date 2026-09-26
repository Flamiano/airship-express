import "server-only";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import type { PayslipRenderData } from "./renderPayslip";

function monthLabel(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const monthName = start
    .toLocaleDateString("en-PH", { month: "long" })
    .toUpperCase();

  if (start.getMonth() === end.getMonth()) {
    return `${monthName} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${monthName} ${start.getDate()}, ${start.getFullYear()} – ${end.toLocaleDateString(
    "en-PH",
    { month: "long", day: "numeric", year: "numeric" }
  )}`;
}

export async function buildPayslipRenderData(
  payslipId: number
): Promise<PayslipRenderData | null> {
  const { data: slip, error } = await supabaseAdmin
    .from("hr4_payslips")
    .select(
      `*,
       hr1_employees (
         id, first_name, last_name, email, employee_id_number,
         hr1_job_positions ( title, department )
       ),
       hr4_payroll_runs ( period_start, period_end, pay_schedule )`
    )
    .eq("id", payslipId)
    .single();

  if (error || !slip) return null;

  const emp = Array.isArray(slip.hr1_employees)
    ? slip.hr1_employees[0]
    : slip.hr1_employees;
  const run = Array.isArray(slip.hr4_payroll_runs)
    ? slip.hr4_payroll_runs[0]
    : slip.hr4_payroll_runs;
  const job = Array.isArray(emp?.hr1_job_positions)
    ? emp.hr1_job_positions[0]
    : emp?.hr1_job_positions;

  if (!emp || !run) return null;

  const hourlyRate = Number(slip.daily_rate || 0) / 8;

  const overtimePay = Number(slip.overtime_hours || 0) * hourlyRate * 1.25;
  const regularHolidayPay = Number(slip.holiday_pay || 0) * 0.7;
  const specialHolidayPay = Number(slip.holiday_pay || 0) * 0.3;

  const totalPay =
    Number(slip.basic_pay) +
    overtimePay +
    regularHolidayPay +
    specialHolidayPay;

  return {
    companyName: "R.E.T AIRSHIP COURIER SERVICES",
    companyAddress: "352 Escolta St., Tomas Pinpin, Binondo, Manila.",
    logoPath: "images/logo-remove-bg.png",
    periodLabel: monthLabel(run.period_start, run.period_end),
    employee: {
      email: emp.email,
      name: `${emp.last_name}, ${emp.first_name}`.toUpperCase(),
      position: job?.title || "—",
      idNumber: emp.employee_id_number,
      cutOff: `PERIOD ${new Date(run.period_start)
        .toLocaleDateString("en-PH", { month: "long", day: "numeric" })
        .toUpperCase()} - ${new Date(run.period_end)
        .toLocaleDateString("en-PH", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase()}`,
      dailyRate: slip.daily_rate ? Number(slip.daily_rate) : null,
    },
    earnings: {
      totalPay,
      daysWorked: Number(slip.days_worked || 0),
      overtime: overtimePay,
      regularHoliday: regularHolidayPay,
      specialHoliday: specialHolidayPay,
      incentives: Number(slip.incentive_pay || 0) + Number(slip.bonus_pay || 0),
      load: Number(slip.allowances_pay || 0),
      transpo: 0,
      miscellaneous: 0,
      gas: 0,
      adjustment: Number(slip.night_diff_pay || 0),
    },
    deductions: {
      sss: Number(slip.sss_employee_share || 0),
      pagibig: Number(slip.pagibig_employee_share || 0),
      philhealth: Number(slip.philhealth_employee_share || 0),
      sssLoan: 0,
      pagibigLoan: 0,
      cashAdvanceBalance: 0,
      tardiness: 0,
      penalty: 0,
      employeeSavings: 0,
      excess: Number(slip.other_deductions || 0),
    },
    grossTotal: Number(slip.gross_pay),
    totalDeduction: Number(slip.total_deductions),
    netPay: Number(slip.net_pay),
  };
}
