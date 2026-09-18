import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

function extractIdFromUrl(url: string): string | null {
  const parts = url.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? null;
  if (!last) return null;
  if (!/^\d+$/.test(last)) return null;
  return last;
}

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
        employee_id_number,
        first_name,
        last_name,
        email,
        status,
        job_position_id,
        department,
        date_hired,
        hr1_job_positions (
          id,
          title,
          department
        ),
        hr4_employee_payroll_info (
          id,
          basic_salary,
          pay_schedule,
          is_active,
          custom_daily_rate,
          salary_adjustment_reason,
          incentives,
          incentive_description,
          last_modified_by_name,
          created_at,
          updated_at
        ),
        hr4_bank_accounts (
          id,
          account_number,
          account_name,
          is_primary,
          is_active,
          verified_at,
          bank_type_id,
          hr4_bank_types (
            id,
            bank_code,
            bank_name,
            bank_type
          )
        )
      `
      )
      .eq("status", "active")
      .order("first_name", { ascending: true });

    if (empError) {
      console.error("Error fetching employees:", empError);
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    const { data: jobSettings, error: settingsError } = await supabaseAdmin
      .from("hr4_job_position_settings")
      .select("*");

    if (settingsError) {
      console.error("Error fetching job settings:", settingsError);
    }

    const settingsMap = new Map();
    (jobSettings || []).forEach((setting: any) => {
      settingsMap.set(setting.job_position_id, setting);
    });

    const today = new Date().toISOString().split("T")[0];
    const { data: attendanceData } = await supabaseAdmin
      .from("hr2_attendance_logs")
      .select("employee_id, status")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    const attendanceMap = new Map();
    if (attendanceData) {
      attendanceData.forEach((log: any) => {
        const key = log.employee_id;
        if (!attendanceMap.has(key)) {
          attendanceMap.set(key, { status: log.status, count: 1 });
        } else {
          const existing = attendanceMap.get(key);
          existing.count += 1;
        }
      });
    }

    const rows = (employees || []).map((employee: any) => {
      const payrollInfo = Array.isArray(employee.hr4_employee_payroll_info)
        ? employee.hr4_employee_payroll_info[0]
        : employee.hr4_employee_payroll_info;

      const bankAccount = Array.isArray(employee.hr4_bank_accounts)
        ? employee.hr4_bank_accounts[0]
        : employee.hr4_bank_accounts;

      const bankType = bankAccount?.hr4_bank_types ?? null;
      const jobPosition = employee.hr1_job_positions || {};
      const settings = settingsMap.get(employee.job_position_id) || {};
      const attendance = attendanceMap.get(employee.id);

      const bankName = bankType?.bank_name ?? null;
      const bankAccountNo = bankAccount?.account_number ?? null;

      // Check if bank details are complete
      const hasCompleteBank = !!(
        bankAccount &&
        bankAccount.is_active !== false &&
        bankAccount.account_number &&
        bankAccount.account_name &&
        bankAccount.bank_type_id
      );

      const positionDailyRate = Number(settings.daily_rate) || 0;
      const customDailyRate = payrollInfo?.custom_daily_rate
        ? Number(payrollInfo.custom_daily_rate)
        : null;
      const effectiveDailyRate = customDailyRate ?? positionDailyRate;
      const hasCustomRate = customDailyRate !== null && customDailyRate > 0;

      if (payrollInfo) {
        return {
          id: payrollInfo.id,
          employee_id: employee.id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          employee_id_number: employee.employee_id_number,
          job_title: jobPosition.title || null,
          department: jobPosition.department || employee.department || null,
          position_daily_rate: positionDailyRate,
          effective_daily_rate: effectiveDailyRate,
          custom_daily_rate: customDailyRate,
          has_custom_rate: hasCustomRate,
          salary_adjustment_reason:
            payrollInfo.salary_adjustment_reason || null,
          daily_rate: positionDailyRate,
          hours_per_day: Number(settings.hours_per_day) || 8,
          break_hours: Number(settings.break_hours) || 1,
          overtime_rate: Number(settings.overtime_rate) || 1.25,
          basic_salary: Number(payrollInfo.basic_salary) || 0,
          pay_schedule: payrollInfo.pay_schedule || "semi_monthly",
          bank_name: bankName,
          bank_account_no: bankAccountNo,
          has_complete_bank: hasCompleteBank,
          is_active: payrollInfo.is_active ?? false,
          attendance_status: attendance?.status || "No record",
          attendance_count: attendance?.count || 0,
          date_hired: employee.date_hired || null,
          incentives: Number(payrollInfo.incentives) || 0,
          edited_by: payrollInfo.last_modified_by_name || null,
          created_at: payrollInfo.created_at,
          updated_at: payrollInfo.updated_at,
        };
      }

      return {
        id: null,
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        employee_id_number: employee.employee_id_number,
        job_title: jobPosition.title || null,
        department: jobPosition.department || employee.department || null,
        position_daily_rate: positionDailyRate,
        effective_daily_rate: positionDailyRate,
        custom_daily_rate: null,
        has_custom_rate: false,
        salary_adjustment_reason: null,
        daily_rate: positionDailyRate,
        hours_per_day: Number(settings.hours_per_day) || 8,
        break_hours: Number(settings.break_hours) || 1,
        overtime_rate: Number(settings.overtime_rate) || 1.25,
        basic_salary: null,
        pay_schedule: null,
        bank_name: bankName,
        bank_account_no: bankAccountNo,
        has_complete_bank: hasCompleteBank,
        is_active: false,
        attendance_status: attendance?.status || "No record",
        attendance_count: attendance?.count || 0,
        date_hired: employee.date_hired || null,
        incentives: 0,
        created_at: null,
        updated_at: null,
      };
    });

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /employee-info error:", error);
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

    const body = await request.json();
    const {
      employee_id,
      basic_salary,
      pay_schedule,
      is_active,
      custom_daily_rate,
      salary_adjustment_reason,
    } = body;

    if (!employee_id || basic_salary == null || !pay_schedule) {
      return NextResponse.json(
        { error: "employee_id, basic_salary, and pay_schedule are required." },
        { status: 400 }
      );
    }

    const { data: employee, error: empError } = await supabaseAdmin
      .from("hr1_employees")
      .select("id")
      .eq("id", employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("hr4_employee_payroll_info")
      .select("id")
      .eq("employee_id", employee_id)
      .maybeSingle();

    if (existing) {
      // Update existing record
      const updates: Record<string, unknown> = {
        basic_salary,
        pay_schedule,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString(),
      };

      if (custom_daily_rate !== undefined) {
        updates.custom_daily_rate = custom_daily_rate;
      }
      if (salary_adjustment_reason !== undefined) {
        updates.salary_adjustment_reason = salary_adjustment_reason;
      }

      const { data, error } = await supabaseAdmin
        .from("hr4_employee_payroll_info")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating payroll info:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_employee_payroll_info")
      .insert({
        employee_id,
        basic_salary,
        pay_schedule,
        is_active: is_active ?? true,
        custom_daily_rate: custom_daily_rate || null,
        salary_adjustment_reason: salary_adjustment_reason || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting payroll info:", error);
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /employee-info error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
