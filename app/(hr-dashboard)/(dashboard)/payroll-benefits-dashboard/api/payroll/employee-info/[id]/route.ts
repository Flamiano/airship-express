import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function getPositionDailyRateForEmployee(employeeId: string) {
  const { data: employee } = await supabaseAdmin
    .from("hr1_employees")
    .select("job_position_id")
    .eq("id", employeeId)
    .single();

  if (!employee?.job_position_id) return 0;

  const { data: settings } = await supabaseAdmin
    .from("hr4_job_position_settings")
    .select("daily_rate")
    .eq("job_position_id", employee.job_position_id)
    .maybeSingle();

  return Number(settings?.daily_rate) || 0;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Employee payroll info ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const { data: currentRow, error: currentRowError } = await supabaseAdmin
      .from("hr4_employee_payroll_info")
      .select("employee_id")
      .eq("id", id)
      .single();

    if (currentRowError || !currentRow) {
      return NextResponse.json(
        { error: "Employee payroll info not found" },
        { status: 404 }
      );
    }

    if (body.reset === true) {
      const positionDailyRate = await getPositionDailyRateForEmployee(
        currentRow.employee_id
      );

      const { data, error } = await supabaseAdmin
        .from("hr4_employee_payroll_info")
        .update({
          custom_daily_rate: null,
          salary_adjustment_reason: null,
          basic_salary: positionDailyRate > 0 ? positionDailyRate * 24 : 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) {
        return NextResponse.json(
          { error: "Employee payroll info not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(data, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    const allowed = [
      "pay_schedule",
      "is_active",
      "custom_daily_rate",
      "salary_adjustment_reason",
      "incentives",
      "incentive_description",
    ];

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const key of allowed) {
      if (key in body && body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if ("custom_daily_rate" in updates) {
      const rate = Number(updates.custom_daily_rate);
      if (rate > 0) {
        if (!String(updates.salary_adjustment_reason || "").trim()) {
          return NextResponse.json(
            {
              error:
                "A reason is required when changing the custom daily rate.",
            },
            { status: 400 }
          );
        }
      } else {
        updates.custom_daily_rate = null;
        updates.salary_adjustment_reason = null;
      }

      const positionDailyRate = await getPositionDailyRateForEmployee(
        currentRow.employee_id
      );
      const effectiveRate =
        updates.custom_daily_rate != null
          ? Number(updates.custom_daily_rate)
          : positionDailyRate;
      updates.basic_salary = effectiveRate > 0 ? effectiveRate * 24 : 0;
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

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("PUT /employee-info/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
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

    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("DELETE /employee-info/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
