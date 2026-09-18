import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const user = (request as any).user;

    const updateData: any = {
      performance_rating: body.performance_rating,
      recommended_increase_percent: body.recommended_increase_percent,
      recommended_new_salary: body.recommended_new_salary,
      proposed_effective_date: body.proposed_effective_date,
      status: body.status,
      manager_notes: body.manager_notes || null,
      hr_notes: body.hr_notes || null,
      updated_at: new Date().toISOString(),
    };

    if (body.status === "approved" || body.status === "implemented") {
      updateData.approved_by = user?.id || null;
      updateData.approved_by_name = user?.fullName || null;
      updateData.approved_at = new Date().toISOString();
    }

    const { data: meritPlan, error } = await supabaseAdmin
      .from("hr4_compen_merit_planning")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating merit plan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(meritPlan);
  } catch (error) {
    console.error("PUT /compensation/merit-planning/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { error } = await supabaseAdmin
      .from("hr4_compen_merit_planning")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error("Error deleting merit plan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /compensation/merit-planning/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
