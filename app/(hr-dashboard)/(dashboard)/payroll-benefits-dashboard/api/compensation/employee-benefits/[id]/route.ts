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

    const { data: benefit, error } = await supabaseAdmin
      .from("hr4_compen_employee_benefits")
      .update({
        benefit_type: body.benefit_type,
        benefit_name: body.benefit_name,
        amount: body.amount,
        frequency: body.frequency,
        is_taxable: body.is_taxable !== undefined ? body.is_taxable : true,
        is_mandatory: body.is_mandatory || false,
        is_active: body.is_active !== undefined ? body.is_active : true,
        effective_date: body.effective_date,
        expiry_date: body.expiry_date || null,
        description: body.description || null,
        updated_at: new Date().toISOString(),
        last_modified_by: user?.id || null,
        last_modified_by_name: user?.fullName || null,
        last_modified_by_email: user?.email || null,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating employee benefit:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(benefit);
  } catch (error) {
    console.error("PUT /compensation/employee-benefits/[id] error:", error);
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
      .from("hr4_compen_employee_benefits")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error("Error deleting employee benefit:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /compensation/employee-benefits/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
