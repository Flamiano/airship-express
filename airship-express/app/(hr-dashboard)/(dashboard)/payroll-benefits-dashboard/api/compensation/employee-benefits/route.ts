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

    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employee_id");

    let query = supabaseAdmin.from("hr4_compen_employee_benefits").select("*");
    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data, error } = await query.order("effective_date", {
      ascending: false,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /compensation/employee-benefits error:", error);
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

    const { data, error } = await supabaseAdmin
      .from("hr4_compen_employee_benefits")
      .insert({
        employee_id: body.employee_id,
        benefit_type: body.benefit_type,
        benefit_name: body.benefit_name,
        amount: Number(body.amount) || 0,
        frequency: body.frequency,
        is_taxable: body.is_taxable ?? true,
        deduct_from_payroll: body.deduct_from_payroll ?? true,
        is_mandatory: body.is_mandatory ?? false,
        is_active: body.is_active ?? true,
        effective_date: body.effective_date,
        expiry_date: body.expiry_date || null,
        description: body.description || null,
        night_diff_enabled: body.night_diff_enabled ?? false,
        night_diff_start: body.night_diff_start || null,
        night_diff_end: body.night_diff_end || null,
        night_diff_rate: Number(body.night_diff_rate) || 1.1,
        holiday_multiplier: Number(body.holiday_multiplier) || 2.0,
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /compensation/employee-benefits error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
