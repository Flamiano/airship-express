import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { data: steps, error } = await supabaseAdmin
      .from("hr4_compen_pay_steps")
      .select("*")
      .eq("grade_id", params.id)
      .order("step_number", { ascending: true });

    if (error) {
      console.error("Error fetching steps:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(steps || []);
  } catch (error) {
    console.error(
      "GET /compensation/salary-structure/[id]/steps error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
