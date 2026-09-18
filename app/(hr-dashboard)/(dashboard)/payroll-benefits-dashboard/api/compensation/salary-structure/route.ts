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

    const { data: grades, error } = await supabaseAdmin
      .from("hr4_compen_salary_grades")
      .select("*")
      .order("grade_level", { ascending: true });

    if (error) {
      console.error("Error fetching salary grades:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const gradesWithSteps = await Promise.all(
      (grades || []).map(async (grade) => {
        const { data: steps, error: stepError } = await supabaseAdmin
          .from("hr4_compen_pay_steps")
          .select("*")
          .eq("grade_id", grade.id)
          .eq("is_active", true)
          .order("step_number", { ascending: true });

        if (stepError) {
          console.error("Error fetching steps for grade:", stepError);
          return { ...grade, steps: [] };
        }

        return { ...grade, steps: steps || [] };
      })
    );

    return NextResponse.json(gradesWithSteps);
  } catch (error) {
    console.error("GET /compensation/salary-structure error:", error);
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
    const { steps, ...gradeData } = body;

    const { data: grade, error: gradeError } = await supabaseAdmin
      .from("hr4_compen_salary_grades")
      .insert({
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
        created_by: user?.id || null,
        last_modified_by: user?.id || null,
        last_modified_by_name: user?.fullName || null,
        last_modified_by_email: user?.email || null,
      })
      .select()
      .single();

    if (gradeError) {
      console.error("Error creating salary grade:", gradeError);
      return NextResponse.json({ error: gradeError.message }, { status: 500 });
    }

    if (steps && steps.length > 0) {
      const stepsData = steps.map((step: any) => ({
        grade_id: grade.id,
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
        console.error("Error creating steps:", stepsError);
      }
    }

    return NextResponse.json(grade, { status: 201 });
  } catch (error) {
    console.error("POST /compensation/salary-structure error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
