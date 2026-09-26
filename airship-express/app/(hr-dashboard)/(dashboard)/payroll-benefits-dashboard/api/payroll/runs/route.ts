import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

function extractIdFromUrl(url: string): string | null {
  const parts = url.split("/");
  return parts[parts.length - 1] || null;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { data: runs, error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select(
        "id, period_start, period_end, pay_schedule, status, run_date, created_by, created_at, updated_at"
      )
      .order("period_start", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: slipTotals } = await supabaseAdmin
      .from("hr4_payslips")
      .select("payroll_run_id, net_pay");

    const totalsByRun = new Map<number, { count: number; net: number }>();
    for (const slip of slipTotals || []) {
      const entry = totalsByRun.get(slip.payroll_run_id) || {
        count: 0,
        net: 0,
      };
      entry.count += 1;
      entry.net += Number(slip.net_pay);
      totalsByRun.set(slip.payroll_run_id, entry);
    }

    const rows = (runs || []).map((run) => ({
      ...run,
      payslip_count: totalsByRun.get(run.id)?.count ?? 0,
      total_net_pay: totalsByRun.get(run.id)?.net ?? 0,
    }));

    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /runs error:", error);
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
    console.log("Creating payroll run with body:", body);

    const { period_start, period_end, pay_schedule } = body;

    if (!period_start || !period_end || !pay_schedule) {
      return NextResponse.json(
        { error: "period_start, period_end, and pay_schedule are required." },
        { status: 400 }
      );
    }

    if (new Date(period_start) > new Date(period_end)) {
      return NextResponse.json(
        { error: "Period start must be before period end" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .insert({
        period_start,
        period_end,
        pay_schedule,
        status: "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating payroll run:", error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "23505" ? 409 : 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /runs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
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

    // If voiding, also delete any payslips
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
    console.error("PUT /runs error:", error);
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

    // Extract ID from URL
    const id = extractIdFromUrl(request.url);

    console.log("DELETE request for run ID:", id);
    console.log("URL:", request.url);

    if (!id) {
      return NextResponse.json(
        { error: "Payroll run ID is required" },
        { status: 400 }
      );
    }

    // Check if run exists
    const { data: existingRun, error: checkError } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("id, status, period_start, period_end")
      .eq("id", id)
      .single();

    if (checkError || !existingRun) {
      console.error("Run not found:", checkError);
      return NextResponse.json(
        { error: "Payroll run not found" },
        { status: 404 }
      );
    }

    console.log("Found run with status:", existingRun.status);

    // If the run is not draft, first void it
    if (existingRun.status !== "draft") {
      console.log("Voiding run before deletion...");
      const { error: voidError } = await supabaseAdmin
        .from("hr4_payroll_runs")
        .update({
          status: "voided",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (voidError) {
        console.error("Error voiding run before delete:", voidError);
        // Continue with deletion anyway
      }
    }

    // Delete associated payslips
    console.log("Deleting payslips for run:", id);
    const { error: payslipError } = await supabaseAdmin
      .from("hr4_payslips")
      .delete()
      .eq("payroll_run_id", id);

    if (payslipError) {
      console.error("Error deleting payslips:", payslipError);
      // Continue with run deletion
    }

    // Delete the payroll run
    console.log("Deleting payroll run:", id);
    const { error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting payroll run:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("Payroll run deleted successfully");
    return NextResponse.json({
      success: true,
      message: `Payroll run ${id} deleted successfully`,
    });
  } catch (error) {
    console.error("DELETE /runs error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}
