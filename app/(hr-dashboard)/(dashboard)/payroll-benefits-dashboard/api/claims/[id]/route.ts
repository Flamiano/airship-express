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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Claim ID is required" },
        { status: 400 }
      );
    }

    const { data: existingClaim, error: fetchError } = await supabaseAdmin
      .from("hr4_claims")
      .select("id, status, is_archived")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingClaim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, review_notes, payroll_run_id, is_archived } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (is_archived !== undefined) {
      updates.is_archived = is_archived;
      if (is_archived) {
        updates.archived_at = new Date().toISOString();
        updates.archived_by = authResult.id;
      } else {
        updates.archived_at = null;
        updates.archived_by = null;
      }
    }

    if (status) {
      const validTransitions: Record<string, string[]> = {
        pending: ["approved", "rejected", "cancelled"],
        approved: ["reimbursed", "rejected"],
        rejected: [],
        reimbursed: [],
        cancelled: [],
      };

      if (!validTransitions[existingClaim.status]?.includes(status)) {
        return NextResponse.json(
          {
            error: `Cannot change claim from '${existingClaim.status}' to '${status}'`,
          },
          { status: 400 }
        );
      }

      updates.status = status;

      if (status === "approved" || status === "rejected") {
        updates.reviewed_by = authResult.id;
        updates.reviewed_at = new Date().toISOString();
      }

      if (status === "reimbursed") {
        updates.reimbursed_at = new Date().toISOString();
        if (payroll_run_id) {
          updates.payroll_run_id = payroll_run_id;
        }
      }
    }

    if (review_notes !== undefined) {
      updates.review_notes = review_notes;
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_claims")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating claim:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /claims/[id] error:", error);
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
    if (!id) {
      return NextResponse.json(
        { error: "Claim ID is required" },
        { status: 400 }
      );
    }

    const { data: existingClaim, error: checkError } = await supabaseAdmin
      .from("hr4_claims")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (checkError || !existingClaim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("hr4_claims")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting claim:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Claim ${id} deleted successfully`,
    });
  } catch (error) {
    console.error("DELETE /claims/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}
