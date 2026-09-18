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

    const { data: grade, error } = await supabaseAdmin
      .from("hr4_compen_salary_grades")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      console.error("Error fetching salary grade:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: steps, error: stepError } = await supabaseAdmin
      .from("hr4_compen_pay_steps")
      .select("*")
      .eq("grade_id", params.id)
      .order("step_number", { ascending: true });

    if (stepError) {
      console.error("Error fetching steps:", stepError);
      return NextResponse.json({ ...grade, steps: [] });
    }

    return NextResponse.json({ ...grade, steps: steps || [] });
  } catch (error) {
    console.error("GET /compensation/salary-structure/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const user = (request as any).user;
    const { steps, ...gradeData } = body;

    const { data: grade, error: gradeError } = await supabaseAdmin
      .from("hr4_compen_salary_grades")
      .update({
        grade_code: gradeData.grade_code,
        grade_name: gradeData.grade_name,
        grade_level: gradeData.grade_level,
        min_salary: gradeData.min_salary,
        mid_salary: gradeData.mid_salary,
        max_salary: gradeData.max_salary,
        step_increment: gradeData.step_increment || 0,
        market_reference: gradeData.market_reference || null,
        description: gradeData.description || null,
        is_active:
          gradeData.is_active !== undefined ? gradeData.is_active : true,
        updated_at: new Date().toISOString(),
        last_modified_by: user?.id || null,
        last_modified_by_name: user?.fullName || null,
        last_modified_by_email: user?.email || null,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (gradeError) {
      console.error("Error updating salary grade:", gradeError);
      return NextResponse.json({ error: gradeError.message }, { status: 500 });
    }

    if (steps !== undefined) {
      await supabaseAdmin
        .from("hr4_compen_pay_steps")
        .delete()
        .eq("grade_id", params.id);

      if (steps.length > 0) {
        const stepsData = steps.map((step: any) => ({
          grade_id: params.id,
          step_number: step.step_number,
          step_amount: step.step_amount,
          effective_date:
            step.effective_date || new Date().toISOString().split("T")[0],
          expiry_date: step.expiry_date || null,
          is_active: true,
        }));

        const { error: stepsError } = await supabaseAdmin
          .from("hr4_compen_pay_steps")
          .insert(stepsData);

        if (stepsError) {
          console.error("Error updating steps:", stepsError);
        }
      }
    }

    return NextResponse.json(grade);
  } catch (error) {
    console.error("PUT /compensation/salary-structure/[id] error:", error);
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

    await supabaseAdmin
      .from("hr4_compen_pay_steps")
      .delete()
      .eq("grade_id", params.id);

    const { error } = await supabaseAdmin
      .from("hr4_compen_salary_grades")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error("Error deleting salary grade:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /compensation/salary-structure/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
