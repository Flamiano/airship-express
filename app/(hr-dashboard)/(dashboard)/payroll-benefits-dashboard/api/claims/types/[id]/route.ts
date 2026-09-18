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
        { error: "Claim type ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const allowed = [
      "name",
      "description",
      "max_amount",
      "requires_receipt",
      "is_active",
    ];
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const key of allowed) {
      if (key in body) {
        updates[key] = key === "name" ? String(body[key]).trim() : body[key];
      }
    }

    if ("name" in updates && !updates.name) {
      return NextResponse.json(
        { error: "Claim type name cannot be empty" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_claim_types")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating claim type:", error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "23505" ? 409 : 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Claim type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PUT /claims/types/[id] error:", error);
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
        { error: "Claim type ID is required" },
        { status: 400 }
      );
    }

    const { count, error: countError } = await supabaseAdmin
      .from("hr4_claims")
      .select("id", { count: "exact", head: true })
      .eq("claim_type_id", id);

    if (countError) {
      console.error("Error checking claim type usage:", countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if (count && count > 0) {
      const { data, error } = await supabaseAdmin
        .from("hr4_claim_types")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error deactivating claim type:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        deactivated: true,
        message: `This claim type is used by ${count} claim(s), so it was deactivated instead of deleted.`,
        data,
      });
    }

    const { error } = await supabaseAdmin
      .from("hr4_claim_types")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting claim type:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deactivated: false,
      message: `Claim type ${id} deleted successfully`,
    });
  } catch (error) {
    console.error("DELETE /claims/types/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error as Error).message },
      { status: 500 }
    );
  }
}
