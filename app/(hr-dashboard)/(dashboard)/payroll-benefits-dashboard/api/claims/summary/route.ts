import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { data: claims, error } = await supabaseAdmin
      .from("hr4_claims")
      .select("id, amount, status, reimbursed_at, submitted_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = claims || [];

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const pending = rows.filter((c) => c.status === "pending");
    const approved = rows.filter((c) => c.status === "approved");
    const reimbursed = rows.filter((c) => c.status === "reimbursed");

    const totalClaims = rows.length;
    const totalAmount = rows.reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const reimbursedThisMonth = reimbursed
      .filter(
        (c) => c.reimbursed_at && new Date(c.reimbursed_at) >= startOfMonth
      )
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const reimbursedYtd = reimbursed
      .filter(
        (c) => c.reimbursed_at && new Date(c.reimbursed_at) >= startOfYear
      )
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const summary = {
      total_claims: totalClaims,
      total_amount: totalAmount,
      pending_count: pending.length,
      pending_amount: pending.reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      ),
      approved_count: approved.length,
      approved_amount: approved.reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      ),
      total_reimbursed: reimbursed.reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      ),
      reimbursed_this_month: reimbursedThisMonth,
      reimbursed_ytd: reimbursedYtd,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /claims/summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
