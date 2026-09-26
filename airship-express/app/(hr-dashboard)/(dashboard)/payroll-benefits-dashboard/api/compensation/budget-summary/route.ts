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

    const url = new URL(request.url);
    const fiscalYear = url.searchParams.get("fiscal_year");

    let query = supabaseAdmin.from("hr4_compen_budget_summary").select("*");

    if (fiscalYear) {
      query = query.eq("fiscal_year", parseInt(fiscalYear));
    }

    const { data: summary, error } = await query;

    if (error) {
      console.error("Error fetching budget summary:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(summary || []);
  } catch (error) {
    console.error("GET /compensation/budget-summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
