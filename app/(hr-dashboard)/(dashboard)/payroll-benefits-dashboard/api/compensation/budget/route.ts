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
    const department = url.searchParams.get("department");

    let query = supabaseAdmin.from("hr4_compen_budget_plans").select("*");

    if (fiscalYear) {
      query = query.eq("fiscal_year", parseInt(fiscalYear));
    }

    if (department && department !== "") {
      query = query.eq("department", department);
    }

    const { data: budgets, error } = await query.order("fiscal_year", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching budgets:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(budgets || []);
  } catch (error) {
    console.error("GET /compensation/budget error:", error);
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

    const { data: budget, error } = await supabaseAdmin
      .from("hr4_compen_budget_plans")
      .insert({
        fiscal_year: body.fiscal_year,
        department: body.department || null,
        total_budget: body.total_budget,
        salary_budget: body.salary_budget,
        bonus_budget: body.bonus_budget || 0,
        allowance_budget: body.allowance_budget || 0,
        training_budget: body.training_budget || null,
        other_budget: body.other_budget || null,
        status: body.status || "draft",
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating budget plan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error("POST /compensation/budget error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
