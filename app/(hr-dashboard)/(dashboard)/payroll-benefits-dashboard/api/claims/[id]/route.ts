import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeId(raw: any): string {
  if (raw === null || raw === undefined) return "";
  let s = String(raw).trim();

  try {
    s = decodeURIComponent(s);
  } catch {
    // ignore
  }

  s = s.replace(/^["']+|["']+$/g, "");
  s = s.split("?")[0];
  s = s.split("#")[0];
  s = s.replace(/\/+$/g, "");
  s = s.replace(/^\/+/g, "");
  s = s.trim().toLowerCase();

  if (s === "undefined" || s === "null" || s === "nan") return "";
  return s;
}

function isValidUuid(id: string): boolean {
  return id.length > 0 && UUID_RE.test(id);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const rawParams = await Promise.resolve(context.params as any);
    const rawId = rawParams?.id;
    const id = normalizeId(rawId);

    console.log(
      "[claims PUT] rawId =",
      JSON.stringify(rawId),
      "normalized =",
      id
    );

    if (!isValidUuid(id)) {
      return NextResponse.json(
        {
          error:
            "Invalid claim ID. The record you tried to update has a malformed identifier. Refresh the list and try again.",
          received_id: rawId ?? null,
        },
        { status: 400 }
      );
    }

    const admin = authResult as {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const update: any = { updated_at: new Date().toISOString() };

    if (body.status) {
      update.status = body.status;

      if (body.status === "approved") {
        update.reviewed_by = admin.id;
        update.reviewed_at = new Date().toISOString();
      }

      if (body.status === "rejected") {
        update.reviewed_by = admin.id;
        update.reviewed_at = new Date().toISOString();
        update.review_notes = body.review_notes ?? null;
      }

      if (body.status === "reimbursed") {
        update.reimbursed_at = new Date().toISOString();
      }
    }

    if (body.review_notes !== undefined && !body.status) {
      update.review_notes = body.review_notes;
    }

    if (Object.keys(update).length === 1) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_claims")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[claims PUT] update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[claims PUT] unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update claim" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const rawParams = await Promise.resolve(context.params as any);
    const rawId = rawParams?.id;
    const id = normalizeId(rawId);

    console.log(
      "[claims DELETE] rawId =",
      JSON.stringify(rawId),
      "normalized =",
      id
    );

    if (!isValidUuid(id)) {
      return NextResponse.json(
        {
          error:
            "Invalid claim ID. The record you tried to delete has a malformed identifier. Refresh the list and try again.",
          received_id: rawId ?? null,
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("hr4_claims")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[claims DELETE] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[claims DELETE] unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete claim" },
      { status: 500 }
    );
  }
}
