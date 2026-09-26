import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

type Action = "submit" | "approve" | "reject" | "activate" | "close";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const body = await request.json();
    const action = body.action as Action;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const auditBase = {
      last_modified_by: admin.id,
      last_modified_by_name: admin.fullName,
      last_modified_at: now,
      updated_at: now,
    };

    const update: Record<string, any> = { ...auditBase };

    switch (action) {
      case "submit": {
        if (!["draft", "rejected"].includes(current.status)) {
          return NextResponse.json(
            {
              error: `Cannot submit a budget with status "${current.status}".`,
            },
            { status: 400 }
          );
        }
        update.status = "pending_approval";
        update.submitted_for_approval_at = now;
        update.rejection_reason = null;
        update.rejected_by = null;
        update.rejected_by_name = null;
        update.rejected_at = null;
        break;
      }

      case "approve": {
        if (current.status !== "pending_approval") {
          return NextResponse.json(
            {
              error: `Only pending_approval budgets can be approved. Current status: "${current.status}".`,
            },
            { status: 400 }
          );
        }
        update.status = "approved";
        update.approved_by = admin.id;
        update.approved_by_name = admin.fullName;
        update.approved_at = now;
        break;
      }

      case "reject": {
        if (current.status !== "pending_approval") {
          return NextResponse.json(
            {
              error: `Only pending_approval budgets can be rejected. Current status: "${current.status}".`,
            },
            { status: 400 }
          );
        }
        const reason = String(body.reason || "").trim();
        if (!reason) {
          return NextResponse.json(
            { error: "Rejection reason is required." },
            { status: 400 }
          );
        }
        update.status = "rejected";
        update.rejected_by = admin.id;
        update.rejected_by_name = admin.fullName;
        update.rejected_at = now;
        update.rejection_reason = reason;
        break;
      }

      case "activate": {
        if (current.status !== "approved") {
          return NextResponse.json(
            {
              error: `Only approved budgets can be activated. Current status: "${current.status}".`,
            },
            { status: 400 }
          );
        }
        update.status = "active";
        break;
      }

      case "close": {
        if (current.status !== "active") {
          return NextResponse.json(
            {
              error: `Only active budgets can be closed. Current status: "${current.status}".`,
            },
            { status: 400 }
          );
        }
        update.status = "closed";
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .update(update)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("PATCH labor-budget error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PATCH /compensation/labor-budget/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
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

    const { data: current } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .select("status")
      .eq("id", params.id)
      .single();

    if (current && !["draft", "rejected"].includes(current.status)) {
      return NextResponse.json(
        {
          error: `Cannot delete a budget with status "${current.status}". Only drafts or rejected budgets can be deleted.`,
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("hr4_compen_labor_budget_monthly")
      .delete()
      .eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /compensation/labor-budget/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
