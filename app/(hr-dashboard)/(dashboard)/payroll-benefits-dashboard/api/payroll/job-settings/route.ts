import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "../../../lib/auth/requireAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { data: settings, error } = await supabaseAdmin
      .from("hr4_job_position_settings")
      .select(
        `
        *,
        hr1_job_positions (
          id,
          title,
          department,
          is_active
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching job settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: history } = await supabaseAdmin
      .from("hr4_rate_change_log")
      .select("job_position_id, admin_name, created_at")
      .eq("scope", "position")
      .order("created_at", { ascending: false });

    const editedByMap = new Map<string, string>();
    (history || []).forEach((row: any) => {
      if (row.job_position_id && !editedByMap.has(row.job_position_id)) {
        editedByMap.set(row.job_position_id, row.admin_name || "Unknown");
      }
    });

    const rows = (settings || []).map((row: any) => ({
      id: row.id,
      job_position_id: row.job_position_id,
      title: row.hr1_job_positions?.title || "Unknown Position",
      department: row.hr1_job_positions?.department || "—",
      daily_rate: Number(row.daily_rate) || 0,
      basic_salary: (Number(row.daily_rate) || 0) * 24,
      hours_per_day: Number(row.hours_per_day) || 8,
      break_hours: Number(row.break_hours) || 1,
      overtime_rate: Number(row.overtime_rate) || 1.25,
      is_active: row.hr1_job_positions?.is_active ?? true,
      last_modified_by: row.last_modified_by || null,
      last_modified_by_name: row.last_modified_by_name || null,
      last_modified_by_email: row.last_modified_by_email || null,
      edited_by: editedByMap.get(row.job_position_id) || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /job-settings error:", error);
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
      job_position_id,
      daily_rate,
      hours_per_day,
      break_hours,
      overtime_rate,
    } = body;

    if (!job_position_id || !UUID_RE.test(job_position_id)) {
      return NextResponse.json(
        { error: "A valid job position is required." },
        { status: 400 }
      );
    }

    if (!daily_rate || Number(daily_rate) <= 0) {
      return NextResponse.json(
        { error: "Daily rate must be greater than 0." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_job_position_settings")
      .insert({
        job_position_id,
        daily_rate: Number(daily_rate),
        hours_per_day: Number(hours_per_day) || 8,
        break_hours: Number(break_hours) || 1,
        overtime_rate: Number(overtime_rate) || 1.25,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating job setting:", error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "23505" ? 409 : 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /job-settings error:", error);
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "A valid id is required." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("hr4_job_position_settings")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting job setting:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /job-settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
