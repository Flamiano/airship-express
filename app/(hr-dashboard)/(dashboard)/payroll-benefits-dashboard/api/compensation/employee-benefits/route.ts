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

    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    const { data: benefits, error } = await query.order("effective_date", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching employee benefits:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(benefits || []);
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
    const user = (request as any).user;

    const { data: benefit, error } = await supabaseAdmin
      .from("hr4_compen_employee_benefits")
      .insert({
        employee_id: body.employee_id,
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
        approved_by: user?.id || null,
        approved_by_name: user?.fullName || null,
        approved_at: new Date().toISOString(),
        last_modified_by: user?.id || null,
        last_modified_by_name: user?.fullName || null,
        last_modified_by_email: user?.email || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating employee benefit:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(benefit, { status: 201 });
  } catch (error) {
    console.error("POST /compensation/employee-benefits error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
