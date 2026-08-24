import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "../../../lib/auth/requireAdmin";

function extractIdFromUrl(url: string): string | null {
  const parts = url.split("/");
  return parts[parts.length - 1] || null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const id = extractIdFromUrl(request.url);

    // If ID is provided, get single record
    if (id) {
      const { data, error } = await supabaseAdmin
        .from("hr4_job_position_settings")
        .select(
          `
          *,
          hr1_job_positions (
            id,
            title,
            department
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json(
          { error: "Job setting not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(data);
    }

    // Otherwise, get all records
    const { data, error } = await supabaseAdmin
      .from("hr4_job_position_settings")
      .select(
        `
        *,
        hr1_job_positions (
          id,
          title,
          department
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
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

    if (!job_position_id) {
      return NextResponse.json(
        { error: "job_position_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_job_position_settings")
      .insert({
        job_position_id,
        daily_rate: daily_rate || 0,
        hours_per_day: hours_per_day || 8,
        break_hours: break_hours || 1,
        overtime_rate: overtime_rate || 1.25,
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

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const id = extractIdFromUrl(request.url);
    if (!id) {
      return NextResponse.json(
        { error: "Job setting ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const allowed = [
      "daily_rate",
      "hours_per_day",
      "break_hours",
      "overtime_rate",
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
      .from("hr4_job_position_settings")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating job setting:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Job setting not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /job-settings error:", error);
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
        { error: "Job setting ID is required" },
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
