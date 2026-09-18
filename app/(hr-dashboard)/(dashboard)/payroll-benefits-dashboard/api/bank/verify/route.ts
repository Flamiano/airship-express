import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";
import { resolveAdminIdentity } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/adminIdentity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const admin = await resolveAdminIdentity(authResult);
    const body = await request.json();

    const { employee_id, verify } = body;

    if (!employee_id) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const updateData: any = {
      verified_at: verify ? new Date().toISOString() : null,
      verified_by: verify ? admin.id : null,
      verified_by_name: verify ? admin.name : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("hr4_bank_accounts")
      .update(updateData)
      .eq("employee_id", employee_id)
      .select()
      .single();

    if (error) {
      console.error("Error verifying bank account:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from("hr4_bank_history").insert({
      employee_id,
      action: verify ? "verified" : "unverified",
      performed_by: admin.id,
      performed_by_name: admin.name,
      performed_by_email: admin.email,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("POST /bank/verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
