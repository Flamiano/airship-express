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

    const { data: employees, error: empError } = await supabaseAdmin
      .from("hr1_employees")
      .select("id, employee_id_number, first_name, last_name, status")
      .eq("status", "active")
      .order("first_name", { ascending: true });

    if (empError) {
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    const employeeIds = (employees || []).map((e) => e.id);

    if (employeeIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: bankAccounts, error: bankError } = await supabaseAdmin
      .from("hr4_bank_accounts")
      .select(
        `
        id,
        employee_id,
        bank_type_id,
        account_number,
        account_name,
        is_primary,
        is_active,
        verified_at,
        verified_by_name,
        hr4_bank_types (
          id,
          bank_code,
          bank_name,
          bank_type
        )
      `
      )
      .in("employee_id", employeeIds);

    if (bankError) {
      return NextResponse.json({ error: bankError.message }, { status: 500 });
    }

    const bankMap = new Map();
    (bankAccounts || []).forEach((account: any) => {
      bankMap.set(account.employee_id, {
        id: account.id,
        bank_type_id: account.bank_type_id,
        bank_code: account.hr4_bank_types?.bank_code || null,
        bank_name: account.hr4_bank_types?.bank_name || null,
        bank_type: account.hr4_bank_types?.bank_type || null,
        account_number: account.account_number,
        account_name: account.account_name,
        is_primary: account.is_primary,
        is_active: account.is_active,
        verified_at: account.verified_at,
        verified_by_name: account.verified_by_name,
      });
    });

    const result = (employees || []).map((emp) => {
      const bank = bankMap.get(emp.id);
      const hasCompleteBank = !!(
        bank &&
        bank.is_active &&
        bank.account_number &&
        bank.account_name &&
        bank.bank_type_id
      );

      return {
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        employee_id_number: emp.employee_id_number,
        bank_account: bank || null,
        has_complete_bank: hasCompleteBank,
      };
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /bank/employee-details error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
