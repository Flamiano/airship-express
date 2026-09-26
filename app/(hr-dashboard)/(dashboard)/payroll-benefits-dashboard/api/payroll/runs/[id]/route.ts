import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

function extractIdFromUrl(url: string): string | null {
  const parts = url.split("/");
  const idIndex = parts.indexOf("runs") + 1;
  return parts[idIndex] || null;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function PATCH(
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
    if (!id)
      return NextResponse.json(
        { error: "Payroll run ID required" },
        { status: 400 }
      );

    const body = await request.json();
    const action = body.action as string;

    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json(
        { error: "Payroll run not found" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const update: Record<string, any> = { updated_at: now };

    switch (action) {
      case "submit":
        if (!["draft", "rejected"].includes(current.approval_status)) {
          return NextResponse.json(
            {
              error: `Cannot submit run with status "${current.approval_status}".`,
            },
            { status: 400 }
          );
        }
        update.approval_status = "pending_approval";
        update.submitted_for_approval_at = now;
        update.rejection_reason = null;
        update.rejected_by = null;
        update.rejected_by_name = null;
        update.rejected_at = null;
        break;

      case "approve":
        if (current.approval_status !== "pending_approval") {
          return NextResponse.json(
            {
              error: `Only pending runs can be approved. Current: "${current.approval_status}".`,
            },
            { status: 400 }
          );
        }
        update.approval_status = "approved";
        update.approved_by = admin.id;
        update.approved_by_name = admin.fullName;
        update.approved_at = now;
        break;

      case "reject": {
        if (current.approval_status !== "pending_approval") {
          return NextResponse.json(
            {
              error: `Only pending runs can be rejected. Current: "${current.approval_status}".`,
            },
            { status: 400 }
          );
        }
        const reason = String(body.reason || "").trim();
        if (!reason)
          return NextResponse.json(
            { error: "Rejection reason is required." },
            { status: 400 }
          );
        update.approval_status = "rejected";
        update.rejected_by = admin.id;
        update.rejected_by_name = admin.fullName;
        update.rejected_at = now;
        update.rejection_reason = reason;
        break;
      }

      case "mark_distributed":
        if (current.approval_status !== "approved") {
          return NextResponse.json(
            { error: "Only approved runs can be marked distributed." },
            { status: 400 }
          );
        }
        update.approval_status = "distributed";
        update.distributed_at = now;
        update.distributed_by = admin.id;
        update.distributed_by_name = admin.fullName;
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PATCH /runs/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    if (!id)
      return NextResponse.json(
        { error: "Payroll run ID required" },
        { status: 400 }
      );

    const body = await request.json();
    const allowed = ["period_start", "period_end", "pay_schedule", "status"];
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const key of allowed) if (key in body) updates[key] = body[key];

    if (body.status === "voided") {
      await supabaseAdmin
        .from("hr4_payslips")
        .delete()
        .eq("payroll_run_id", id);
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PUT /runs/[id] error:", error);
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
    if (!id)
      return NextResponse.json(
        { error: "Payroll run ID required" },
        { status: 400 }
      );

    const { data: existing } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .select("id, status")
      .eq("id", id)
      .single();

    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.status !== "draft") {
      await supabaseAdmin
        .from("hr4_payroll_runs")
        .update({ status: "voided", updated_at: new Date().toISOString() })
        .eq("id", id);
    }

    await supabaseAdmin.from("hr4_payslips").delete().eq("payroll_run_id", id);
    await supabaseAdmin
      .from("hr4_payslip_distributions")
      .delete()
      .eq("payroll_run_id", id);

    const { error } = await supabaseAdmin
      .from("hr4_payroll_runs")
      .delete()
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /runs/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
