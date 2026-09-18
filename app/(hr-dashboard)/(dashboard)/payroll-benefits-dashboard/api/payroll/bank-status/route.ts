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
      .select(
        `
        id,
        first_name,
        last_name,
        employee_id_number,
        status,
        hr4_bank_accounts (
          id,
          bank_type_id,
          account_number,
          account_name,
          is_active
        )
      `
      )
      .eq("status", "active")
      .order("first_name", { ascending: true });

    if (empError) {
      console.error("Error fetching employees:", empError);
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    const affected: {
      employee_id: string;
      employee_name: string;
      employee_id_number: string;
      reason: string;
      category: "no_account" | "inactive" | "incomplete";
    }[] = [];

    let withBank = 0;
    let noAccount = 0;
    let inactive = 0;
    let incomplete = 0;

    for (const emp of employees || []) {
      const bank = Array.isArray(emp.hr4_bank_accounts)
        ? emp.hr4_bank_accounts[0]
        : emp.hr4_bank_accounts;

      const employeeName = `${emp.first_name} ${emp.last_name}`;

      if (!bank) {
        noAccount++;
        affected.push({
          employee_id: emp.id,
          employee_name: employeeName,
          employee_id_number: emp.employee_id_number,
          reason: "No Bank Account",
          category: "no_account",
        });
        continue;
      }

      if (bank.is_active === false) {
        inactive++;
        affected.push({
          employee_id: emp.id,
          employee_name: employeeName,
          employee_id_number: emp.employee_id_number,
          reason: "Inactive Account",
          category: "inactive",
        });
        continue;
      }

      const missing: string[] = [];
      if (!bank.account_number) missing.push("account number");
      if (!bank.account_name) missing.push("account name");
      if (!bank.bank_type_id) missing.push("bank type");

      if (missing.length > 0) {
        incomplete++;
        affected.push({
          employee_id: emp.id,
          employee_name: employeeName,
          employee_id_number: emp.employee_id_number,
          reason: "Incomplete Details",
          category: "incomplete",
        });
        continue;
      }

      withBank++;
    }

    const totalActive = (employees || []).length;
    const totalAffected = affected.length;

    return NextResponse.json(
      {
        total_active: totalActive,
        with_bank: withBank,
        no_account: noAccount,
        inactive: inactive,
        incomplete: incomplete,
        total_affected: totalAffected,
        affected_employees: affected,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("GET /payroll/bank-status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
