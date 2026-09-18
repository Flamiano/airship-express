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

    let query = supabaseAdmin.from("hr4_compen_merit_planning").select("*");

    if (fiscalYear) {
      query = query.eq("fiscal_year", parseInt(fiscalYear));
    }

    const { data: meritPlans, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching merit plans:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(meritPlans || []);
  } catch (error) {
    console.error("GET /compensation/merit-planning error:", error);
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

    const { data: meritPlan, error } = await supabaseAdmin
      .from("hr4_compen_merit_planning")
      .insert({
        employee_id: body.employee_id,
        fiscal_year: body.fiscal_year,
        performance_rating: body.performance_rating,
        current_salary: body.current_salary,
        recommended_increase_percent: body.recommended_increase_percent,
        recommended_new_salary: body.recommended_new_salary,
        proposed_effective_date: body.proposed_effective_date,
        status: body.status || "draft",
        manager_notes: body.manager_notes || null,
        hr_notes: body.hr_notes || null,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating merit plan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(meritPlan, { status: 201 });
  } catch (error) {
    console.error("POST /compensation/merit-planning error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
