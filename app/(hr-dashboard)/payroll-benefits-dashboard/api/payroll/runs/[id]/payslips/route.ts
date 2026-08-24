import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

function extractIdFromUrl(url: string): string | null {
  const parts = url.split("/");
  return parts[parts.length - 2] || null;
}

export async function GET(request: NextRequest) {
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

    const { data, error } = await supabaseAdmin
      .from("hr4_payslips")
      .select(
        `id, payroll_run_id, employee_id, basic_pay, gross_pay, 
         sss_employee_share, sss_employer_share,
         philhealth_employee_share, philhealth_employer_share, 
         pagibig_employee_share, pagibig_employer_share,
         withholding_tax, other_deductions, total_deductions, 
         net_pay, daily_rate, days_worked, hours_worked, regular_hours, overtime_hours, created_at,
         hr1_employees ( first_name, last_name, employee_id_number )`
      )
      .eq("payroll_run_id", runId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((row: any) => ({
      ...row,
      employee_name: row.hr1_employees
        ? `${row.hr1_employees.first_name} ${row.hr1_employees.last_name}`
        : null,
      employee_id_number: row.hr1_employees?.employee_id_number ?? null,
      hr1_employees: undefined,
    }));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /payslips error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
