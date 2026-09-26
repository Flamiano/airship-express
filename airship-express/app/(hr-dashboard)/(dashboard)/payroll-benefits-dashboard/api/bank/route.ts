import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import { resolveAdminIdentity } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/adminIdentity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");

    let query = supabaseAdmin
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
        verified_by,
        verified_by_name,
        last_modified_by,
        last_modified_by_name,
        last_modified_by_email,
        created_at,
        updated_at,
        hr4_bank_types (
          id,
          bank_code,
          bank_name,
          bank_type
        )
      `
      )
      .order("created_at", { ascending: false });

    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    const { data: accounts, error } = await query;

    if (error) {
      console.error("Error fetching bank accounts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = Array.isArray(accounts) ? accounts : [];

    const employeeIds = Array.from(
      new Set(list.map((a: any) => a.employee_id).filter(Boolean))
    );

    const employeeMap = new Map<
      string,
      { name: string; id_number: string | null }
    >();
    if (employeeIds.length > 0) {
      const { data: employees, error: empError } = await supabaseAdmin
        .from("hr1_employees")
        .select("id, employee_id_number, first_name, last_name")
        .in("id", employeeIds);

      if (empError) {
        console.error("Error fetching employees for bank:", empError);
      } else {
        (employees || []).forEach((e: any) => {
          employeeMap.set(e.id, {
            name: `${e.first_name} ${e.last_name}`,
            id_number: e.employee_id_number ?? null,
          });
        });
      }
    }

    const formatted = list.map((account: any) => {
      const employee = employeeMap.get(account.employee_id);
      const bankType = Array.isArray(account.hr4_bank_types)
        ? account.hr4_bank_types[0]
        : account.hr4_bank_types;

      return {
        id: account.id,
        employee_id: account.employee_id,
        employee_name: employee?.name || "Unknown Employee",
        employee_id_number: employee?.id_number || null,
        bank_type_id: account.bank_type_id,
        bank_type_name: bankType?.bank_name || null,
        bank_type_code: bankType?.bank_code || null,
        bank_type_category: bankType?.bank_type || null,
        account_number: account.account_number,
        account_name: account.account_name,
        is_primary: account.is_primary ?? false,
        is_active: account.is_active ?? true,
        verified_at: account.verified_at,
        verified_by: account.verified_by,
        verified_by_name: account.verified_by_name,
        last_modified_by: account.last_modified_by,
        last_modified_by_name: account.last_modified_by_name,
        last_modified_by_email: account.last_modified_by_email,
        created_at: account.created_at,
        updated_at: account.updated_at,
      };
    });

    return NextResponse.json(formatted, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /bank error:", error);
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

    const {
      employee_id,
      bank_type_id,
      account_number,
      account_name,
      is_primary,
    } = body;

    if (!employee_id || !bank_type_id || !account_number || !account_name) {
      return NextResponse.json(
        {
          error:
            "Employee, bank type, account number, and account name are required.",
        },
        { status: 400 }
      );
    }

    const { data: bankType, error: typeError } = await supabaseAdmin
      .from("hr4_bank_types")
      .select("bank_type")
      .eq("id", bank_type_id)
      .single();

    if (typeError || !bankType) {
      return NextResponse.json(
        { error: "Invalid bank type." },
        { status: 400 }
      );
    }

    const cleanAccountNumber = account_number.trim().replace(/\s/g, "");
    let validationError = null;

    if (bankType.bank_type === "e_wallet") {
      if (!/^09\d{9}$/.test(cleanAccountNumber)) {
        validationError =
          "E-wallet number must be 11 digits starting with 09 (e.g., 09123456789).";
      }
    } else {
      if (!/^\d{9,16}$/.test(cleanAccountNumber)) {
        validationError = "Bank account number must be 9-16 digits.";
      }
    }

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const { data: existingAccount, error: checkError } = await supabaseAdmin
      .from("hr4_bank_accounts")
      .select("id, employee_id, account_number")
      .eq("account_number", cleanAccountNumber)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing account number:", checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existingAccount && existingAccount.employee_id !== employee_id) {
      return NextResponse.json(
        { error: "Account number already exists in the system." },
        { status: 400 }
      );
    }

    const { data: existingEmployee, error: employeeCheckError } =
      await supabaseAdmin
        .from("hr4_bank_accounts")
        .select("id, bank_type_id, account_number, account_name")
        .eq("employee_id", employee_id)
        .maybeSingle();

    if (employeeCheckError && employeeCheckError.code !== "PGRST116") {
      console.error(
        "Error checking existing employee account:",
        employeeCheckError
      );
      return NextResponse.json(
        { error: employeeCheckError.message },
        { status: 500 }
      );
    }

    let result;
    let action = "created";

    if (existingEmployee) {
      const { data, error } = await supabaseAdmin
        .from("hr4_bank_accounts")
        .update({
          bank_type_id,
          account_number: cleanAccountNumber,
          account_name: account_name.trim(),
          is_primary: is_primary || false,
          updated_at: new Date().toISOString(),
          last_modified_by: admin.id,
          last_modified_by_name: admin.name,
          last_modified_by_email: admin.email,
        })
        .eq("id", existingEmployee.id)
        .select()
        .single();

      result = data;
      action = "updated";

      if (error) {
        console.error("Error updating bank account:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await supabaseAdmin.from("hr4_bank_history").insert({
        employee_id,
        previous_bank_type_id: existingEmployee.bank_type_id || null,
        new_bank_type_id: bank_type_id,
        previous_account_number: existingEmployee.account_number || null,
        new_account_number: cleanAccountNumber,
        previous_account_name: existingEmployee.account_name || null,
        new_account_name: account_name.trim(),
        action,
        performed_by: admin.id,
        performed_by_name: admin.name,
        performed_by_email: admin.email,
      });
    } else {
      const { data, error } = await supabaseAdmin
        .from("hr4_bank_accounts")
        .insert({
          employee_id,
          bank_type_id,
          account_number: cleanAccountNumber,
          account_name: account_name.trim(),
          is_primary: is_primary || false,
          is_active: true,
          last_modified_by: admin.id,
          last_modified_by_name: admin.name,
          last_modified_by_email: admin.email,
        })
        .select()
        .single();

      result = data;
      action = "created";

      if (error) {
        console.error("Error creating bank account:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await supabaseAdmin.from("hr4_bank_history").insert({
        employee_id,
        new_bank_type_id: bank_type_id,
        new_account_number: cleanAccountNumber,
        new_account_name: account_name.trim(),
        action,
        performed_by: admin.id,
        performed_by_name: admin.name,
        performed_by_email: admin.email,
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /bank error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
