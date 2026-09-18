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
    const fiscalYear = url.searchParams.get("fiscal_year");

    let query = supabaseAdmin.from("hr4_compen_bonus_allocations").select("*");

    if (fiscalYear) {
      query = query.eq("fiscal_year", parseInt(fiscalYear));
    }

    const { data: bonuses, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching bonus allocations:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(bonuses || []);
  } catch (error) {
    console.error("GET /compensation/bonus-allocation error:", error);
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
    const user = (request as any).user;

    const { data: bonus, error } = await supabaseAdmin
      .from("hr4_compen_bonus_allocations")
      .insert({
        employee_id: body.employee_id,
        fiscal_year: body.fiscal_year,
        bonus_type: body.bonus_type,
        amount: body.amount,
        bonus_percentage: body.bonus_percentage || null,
        performance_rating: body.performance_rating || null,
        notes: body.notes || null,
        status: body.status || "draft",
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating bonus allocation:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(bonus, { status: 201 });
  } catch (error) {
    console.error("POST /compensation/bonus-allocation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
