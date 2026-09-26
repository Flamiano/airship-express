import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const body = await request.json();

    const { data: budget, error } = await supabaseAdmin
      .from("hr4_compen_budget_plans")
      .update({
        fiscal_year: body.fiscal_year,
        department: body.department || null,
        total_budget: body.total_budget,
        salary_budget: body.salary_budget,
        bonus_budget: body.bonus_budget || 0,
        allowance_budget: body.allowance_budget || 0,
        training_budget: body.training_budget || null,
        other_budget: body.other_budget || null,
        status: body.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating budget plan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(budget);
  } catch (error) {
    console.error("PUT /compensation/budget/[id] error:", error);
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

    const { error } = await supabaseAdmin
      .from("hr4_compen_budget_plans")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting budget plan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /compensation/budget/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
