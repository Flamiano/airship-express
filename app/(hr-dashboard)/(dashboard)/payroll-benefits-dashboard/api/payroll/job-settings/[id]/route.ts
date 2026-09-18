import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import { resolveAdminIdentity } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/adminIdentity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const admin = await resolveAdminIdentity(authResult);

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Job Position ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const finalDailyRate = Number(body.daily_rate) || 0;
    const finalBasicSalary = finalDailyRate > 0 ? finalDailyRate * 24 : 0;

    if (!finalDailyRate || finalDailyRate <= 0) {
      return NextResponse.json(
        { error: "daily_rate is required and must be greater than 0." },
        { status: 400 }
      );
    }

    // Select the existing row's daily_rate too (not just id) so we can log
    // what it changed from.
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("hr4_job_position_settings")
      .select("id, daily_rate")
      .eq("job_position_id", id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    const payload = {
      job_position_id: id,
      daily_rate: finalDailyRate,
      hours_per_day: Number(body.hours_per_day) || 8,
      break_hours: Number(body.break_hours) || 1,
      overtime_rate: Number(body.overtime_rate) || 1.25,
      last_modified_by: admin.id,
      last_modified_by_name: admin.name,
      last_modified_by_email: admin.email,
      updated_at: new Date().toISOString(),
    };

    let data;
    let error;

    if (existing) {
      const result = await supabaseAdmin
        .from("hr4_job_position_settings")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabaseAdmin
        .from("hr4_job_position_settings")
        .insert(payload)
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error saving settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the change so the "Edit History" clock icon on the Position tab
    // has something to show — this was previously missing entirely, which
    // is why history always came back empty even after a successful save.
    await supabaseAdmin.from("hr4_rate_change_log").insert({
      scope: "position",
      job_position_id: id,
      admin_id: admin.id,
      admin_name: admin.name,
      admin_email: admin.email,
      action: existing ? "rate_updated" : "rate_created",
      previous_daily_rate: existing?.daily_rate ?? null,
      new_daily_rate: finalDailyRate,
      reason: null,
    });

    return NextResponse.json({
      ...data,
      basic_salary: finalBasicSalary,
      edited_by: admin.name,
    });
  } catch (error) {
    console.error("PUT /job-settings/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
