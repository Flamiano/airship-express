import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

function extractIdFromUrl(url: string): string | null {
  const parts = url.split("/");
  const idIndex = parts.indexOf("runs") + 1;
  return parts[idIndex] || null;
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const id = extractIdFromUrl(request.url);
    if (!id) {
      return NextResponse.json(
        { error: "Payroll run ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const allowed = ["period_start", "period_end", "pay_schedule", "status"];
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (body.status === "voided") {
      const { error: deleteError } = await supabaseAdmin
        .from("hr4_payslips")
        .delete()
        .eq("payroll_run_id", id);

      if (deleteError) {
        console.error("Error deleting payslips:", deleteError);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating payroll run:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Payroll run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /runs/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const id = extractIdFromUrl(request.url);

    if (!id) {
      return NextResponse.json(
        { error: "Payroll run ID is required" },
        { status: 400 }
      );
    }

    const { data: existingRun, error: checkError } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("id, status, period_start, period_end")
      .eq("id", id)
      .single();

    if (checkError || !existingRun) {
      return NextResponse.json(
        { error: "Payroll run not found" },
        { status: 404 }
      );
    }

    if (existingRun.status !== "draft") {
      const { error: voidError } = await supabaseAdmin
        .from("hr4_payroll_runs")
        .update({
          status: "voided",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (voidError) {
        console.error("Error voiding run before delete:", voidError);
      }
    }

    const { error: payslipError } = await supabaseAdmin
      .from("hr4_payslips")
      .delete()
      .eq("payroll_run_id", id);

    if (payslipError) {
      console.error("Error deleting payslips:", payslipError);
    }

    const { error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting payroll run:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Payroll run ${id} deleted successfully`,
    });
  } catch (error) {
    console.error("DELETE /runs/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}
