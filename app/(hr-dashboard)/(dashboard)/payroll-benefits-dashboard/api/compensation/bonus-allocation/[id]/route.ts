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

    const admin = authResult as {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };

    const { id } = await params;
    const body = await request.json();

    const updateData: any = {
      payroll_run_id: body.payroll_run_id || null,
      bonus_type: body.bonus_type,
      amount: body.amount,
      bonus_percentage: body.bonus_percentage || null,
      performance_rating: body.performance_rating || null,
      notes: body.notes || null,
      status: body.status,
      updated_at: new Date().toISOString(),
    };

    if (body.status === "approved") {
      updateData.approved_by = admin.id;
      updateData.approved_by_name = admin.fullName;
      updateData.approved_at = new Date().toISOString();
    }

    if (body.status === "paid") {
      updateData.paid_at = new Date().toISOString();
    }

    const { data: bonus, error } = await supabaseAdmin
      .from("hr4_compen_bonus_allocations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating bonus allocation:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(bonus);
  } catch (error) {
    console.error("PUT /compensation/bonus-allocation/[id] error:", error);
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
      .from("hr4_compen_bonus_allocations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting bonus allocation:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /compensation/bonus-allocation/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
