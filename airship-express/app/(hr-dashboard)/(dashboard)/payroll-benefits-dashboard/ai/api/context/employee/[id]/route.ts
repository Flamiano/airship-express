import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import type {
  HR1Employee,
  HR4EmployeePayrollInfo,
} from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Employee ID required" },
      { status: 400 }
    );
  }

  try {
    const [{ data: employee }, { data: payrollInfo }, { data: bankAccount }] =
      await Promise.all([
        supabaseAdmin
          .from("hr1_employees")
          .select("*, hr1_job_positions (id, title, department)")
          .eq("id", id)
          .single(),
        supabaseAdmin
          .from("hr4_employee_payroll_info")
          .select("*")
          .eq("employee_id", id)
          .maybeSingle(),
        supabaseAdmin
          .from("hr4_bank_accounts")
          .select(
            `
                account_number, account_name, is_primary, is_active, verified_at,
                hr4_bank_types (bank_name, bank_type)
            `
          )
          .eq("employee_id", id)
          .maybeSingle(),
      ]);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        employee: employee as HR1Employee,
        payroll_info: payrollInfo as HR4EmployeePayrollInfo | null,
        bank_account: bankAccount
          ? {
              account_number: bankAccount.account_number,
              account_name: bankAccount.account_name,
              bank_name: (bankAccount as any).hr4_bank_types?.bank_name || null,
              bank_type: (bankAccount as any).hr4_bank_types?.bank_type || null,
              is_primary: bankAccount.is_primary,
              is_active: bankAccount.is_active,
              verified_at: bankAccount.verified_at,
            }
          : null,
        fetched_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error(`GET ai/api/context/employee/${id} error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
