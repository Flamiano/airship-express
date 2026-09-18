import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import { resolveAdminIdentity } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/adminIdentity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function isActiveNow(periodStart: string, periodEnd: string) {
  const today = new Date().toISOString().split("T")[0];
  return today >= periodStart && today <= periodEnd;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");

    // Build the query with joins to get employee names
    let query = supabaseAdmin
      .from("hr4_employee_incentives")
      .select(
        `
        id,
        employee_id,
        payroll_run_id,
        amount,
        description,
        admin_id,
        admin_name,
        admin_email,
        created_at,
        hr4_payroll_runs (
          period_start,
          period_end,
          pay_schedule,
          status
        ),
        hr1_employees!employee_id (
          first_name,
          last_name,
          employee_id_number
        )
      `
      )
      .order("created_at", { ascending: false });

    // If employee_id is provided, filter by it
    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching incentives:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((row: any) => {
      const run = row.hr4_payroll_runs || {};
      const employee = row.hr1_employees || {};

      return {
        id: row.id,
        employee_id: row.employee_id,
        employee_name:
          employee.first_name && employee.last_name
            ? `${employee.first_name} ${employee.last_name}`
            : "Unknown Employee",
        employee_id_number: employee.employee_id_number || null,
        payroll_run_id: row.payroll_run_id,
        amount: Number(row.amount),
        description: row.description,
        admin_name: row.admin_name,
        admin_email: row.admin_email,
        created_at: row.created_at,
        period_start: run.period_start || null,
        period_end: run.period_end || null,
        pay_schedule: run.pay_schedule || null,
        run_status: run.status || null,
        is_active_now:
          run.period_start && run.period_end
            ? isActiveNow(run.period_start, run.period_end) &&
              run.status !== "voided"
            : false,
      };
    });

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /incentives error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const admin = await resolveAdminIdentity(authResult);

    const body = await request.json();
    const { employee_id, payroll_run_id, amount, description } = body;

    if (!employee_id || !payroll_run_id) {
      return NextResponse.json(
        { error: "employee_id and payroll_run_id are required." },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json(
        { error: "amount must be greater than 0." },
        { status: 400 }
      );
    }

    const { data: run, error: runError } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("id, period_start, period_end, status")
      .eq("id", payroll_run_id)
      .single();

    if (runError || !run) {
      return NextResponse.json(
        { error: "Payroll run not found." },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_employee_incentives")
      .insert({
        employee_id,
        payroll_run_id,
        amount: numericAmount,
        description: description || null,
        admin_id: admin.id,
        admin_name: admin.name,
        admin_email: admin.email,
      })
      .select()
      .single();

    if (error) {
      console.error("Error granting incentive:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ...data,
        period_start: run.period_start,
        period_end: run.period_end,
        is_active_now:
          isActiveNow(run.period_start, run.period_end) &&
          run.status !== "voided",
      },
      { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("POST /incentives error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
