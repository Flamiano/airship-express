import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

function extractIdFromUrl(url: string): string | null {
  const parts = url.split("/");
  return parts[parts.length - 1] || null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    // Fetch employees with their job positions and settings
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
        hr1_job_positions (
          id,
          title,
          department
        ),
        hr4_employee_payroll_info (
          id,
          basic_salary,
          pay_schedule,
          bank_name,
          bank_account_no,
          is_active,
          created_at,
          updated_at
        )
      `
      )
      .eq("status", "active")
      .order("first_name", { ascending: true });

    if (empError) {
      console.error("Error fetching employees:", empError);
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    // Fetch job position settings separately
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

    // Get today's attendance
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
      const payrollInfo = employee.hr4_employee_payroll_info || [];
      const jobPosition = employee.hr1_job_positions || {};
      const settings = settingsMap.get(employee.job_position_id) || {};
      const attendance = attendanceMap.get(employee.id);

      if (payrollInfo.length > 0) {
        const info = payrollInfo[0];
        return {
          id: info.id,
          employee_id: employee.id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          employee_id_number: employee.employee_id_number,
          job_title: jobPosition.title || null,
          department: jobPosition.department || employee.department || null,
          daily_rate: Number(settings.daily_rate) || 0,
          hours_per_day: Number(settings.hours_per_day) || 8,
          break_hours: Number(settings.break_hours) || 1,
          overtime_rate: Number(settings.overtime_rate) || 1.25,
          basic_salary: Number(info.basic_salary) || 0,
          pay_schedule: info.pay_schedule || "semi_monthly",
          bank_name: info.bank_name,
          bank_account_no: info.bank_account_no,
          is_active: info.is_active ?? false,
          attendance_status: attendance?.status || "No record",
          attendance_count: attendance?.count || 0,
          created_at: info.created_at,
          updated_at: info.updated_at,
        };
      }

      return {
        id: null,
        employee_id: employee.id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        employee_id_number: employee.employee_id_number,
        job_title: jobPosition.title || null,
        department: jobPosition.department || employee.department || null,
        daily_rate: Number(settings.daily_rate) || 0,
        hours_per_day: Number(settings.hours_per_day) || 8,
        break_hours: Number(settings.break_hours) || 1,
        overtime_rate: Number(settings.overtime_rate) || 1.25,
        basic_salary: null,
        pay_schedule: null,
        bank_name: null,
        bank_account_no: null,
        is_active: false,
        attendance_status: attendance?.status || "No record",
        attendance_count: attendance?.count || 0,
        created_at: null,
        updated_at: null,
      };
    });

    return NextResponse.json(rows);
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
      bank_name,
      bank_account_no,
      is_active,
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

    const { data: existing, error: checkError } = await supabaseAdmin
      .from("hr4_employee_payroll_info")
      .select("id")
      .eq("employee_id", employee_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Payroll info already exists for this employee" },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_employee_payroll_info")
      .insert({
        employee_id,
        basic_salary,
        pay_schedule,
        bank_name: bank_name || null,
        bank_account_no: bank_account_no || null,
        is_active: is_active ?? true,
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

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const id = extractIdFromUrl(request.url);
    if (!id) {
      return NextResponse.json(
        { error: "Employee payroll info ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const allowed = [
      "basic_salary",
      "pay_schedule",
      "bank_name",
      "bank_account_no",
      "is_active",
    ];

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_employee_payroll_info")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating payroll info:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Employee payroll info not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /employee-info error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const id = extractIdFromUrl(request.url);
    if (!id) {
      return NextResponse.json(
        { error: "Employee payroll info ID is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_employee_payroll_info")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error deactivating payroll info:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Employee payroll info not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("DELETE /employee-info error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
