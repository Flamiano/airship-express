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

    const { data: bankTypes, error } = await supabaseAdmin
      .from("hr4_bank_types")
      .select("*")
      .eq("is_active", true)
      .order("bank_name", { ascending: true });

    if (error) {
      console.error("Error fetching bank types:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(bankTypes || []);
  } catch (error) {
    console.error("GET /bank/types error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
