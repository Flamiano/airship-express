import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { data, error } = await supabaseAdmin
      .from("hr4_claim_types")
      .select(
        "id, name, description, max_amount, requires_receipt, is_active, created_at, updated_at"
      )
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /claims/types error:", error);
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
    const { name, description, max_amount, requires_receipt, is_active } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: "Claim type name is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("hr4_claim_types")
      .insert({
        name: String(name).trim(),
        description: description || null,
        max_amount: max_amount ?? null,
        requires_receipt: requires_receipt ?? true,
        is_active: is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating claim type:", error);
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "23505" ? 409 : 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /claims/types error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
