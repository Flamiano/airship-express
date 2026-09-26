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

    const { data, error } = await supabaseAdmin
      .from("hr4_night_diff_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        {
          id: null,
          night_diff_start: "22:00",
          night_diff_end: "04:00",
          night_diff_rate: 1.1,
          deduct_from_payroll: true,
          is_active: true,
          last_modified_by_name: null,
          updated_at: null,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("GET /compensation/night-diff error:", error);
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

    const admin = await resolveAdminIdentity(authResult);
    const body = await request.json();

    const { data: existing } = await supabaseAdmin
      .from("hr4_night_diff_settings")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const payload = {
      night_diff_start: body.night_diff_start || "22:00",
      night_diff_end: body.night_diff_end || "04:00",
      night_diff_rate: Number(body.night_diff_rate) || 1.1,
      deduct_from_payroll: body.deduct_from_payroll ?? true,
      is_active: body.is_active ?? true,
      last_modified_by: admin.id,
      last_modified_by_name: admin.name,
      last_modified_by_email: admin.email,
      updated_at: new Date().toISOString(),
    };

    let data: any = null;
    let error: any = null;

    if (existing) {
      const result = await supabaseAdmin
        .from("hr4_night_diff_settings")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabaseAdmin
        .from("hr4_night_diff_settings")
        .insert(payload)
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /compensation/night-diff error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
