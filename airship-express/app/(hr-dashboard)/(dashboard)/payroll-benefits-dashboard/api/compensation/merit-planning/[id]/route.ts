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

    // requireAdmin returns the admin object on success
    const admin = authResult as {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };

    const body = await request.json();

    const updateData: any = {
      performance_appraisal_id: body.performance_appraisal_id || null,
      performance_rating: body.performance_rating,
      current_salary: body.current_salary,
      recommended_increase_percent: body.recommended_increase_percent,
      recommended_new_salary: body.recommended_new_salary,
      proposed_effective_date: body.proposed_effective_date,
      status: body.status,
      approver_notes: body.approver_notes || null,
      updated_at: new Date().toISOString(),
    };

    if (body.status === "approved" || body.status === "implemented") {
      updateData.approved_by = admin.id;
      updateData.approved_by_name = admin.fullName;
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
