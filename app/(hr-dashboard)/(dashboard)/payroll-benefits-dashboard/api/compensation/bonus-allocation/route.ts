import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function autoPromotePaidBonuses() {
  const today = new Date().toISOString().split("T")[0];

  const { data: approvedBonuses, error: approvedError } = await supabaseAdmin
    .from("hr4_compen_bonus_allocations")
    .select("id, payroll_run_id")
    .eq("status", "approved")
    .not("payroll_run_id", "is", null);

  if (approvedError) {
    console.error("[bonus-autopromote] fetch approved:", approvedError);
    return;
  }
  if (!approvedBonuses || approvedBonuses.length === 0) return;

  const runIds = Array.from(
    new Set(approvedBonuses.map((b) => b.payroll_run_id))
  );

  const { data: endedRuns, error: runError } = await supabaseAdmin
    .from("hr4_payroll_runs")
    .select("id, period_end")
    .in("id", runIds)
    .lt("period_end", today);

  if (runError) {
    console.error("[bonus-autopromote] fetch runs:", runError);
    return;
  }
  if (!endedRuns || endedRuns.length === 0) return;

  const endedRunIds = endedRuns.map((r) => r.id);
  const bonusIdsToPromote = approvedBonuses
    .filter((b) => endedRunIds.includes(b.payroll_run_id))
    .map((b) => b.id);

  if (bonusIdsToPromote.length === 0) return;

  const { error: updateError } = await supabaseAdmin
    .from("hr4_compen_bonus_allocations")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", bonusIdsToPromote);

  if (updateError) {
    console.error("[bonus-autopromote] update:", updateError);
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    await autoPromotePaidBonuses();

    const url = new URL(request.url);
    const fiscalYear = url.searchParams.get("fiscal_year");

    let query = supabaseAdmin.from("hr4_compen_bonus_allocations").select("*");

    if (fiscalYear) {
      query = query.eq("fiscal_year", parseInt(fiscalYear));
    }

    const { data: bonuses, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching bonus allocations:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(bonuses || []);
  } catch (error) {
    console.error("GET /compensation/bonus-allocation error:", error);
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

    const admin = authResult as {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };

    const body = await request.json();

    const { data: bonus, error } = await supabaseAdmin
      .from("hr4_compen_bonus_allocations")
      .insert({
        employee_id: body.employee_id,
        fiscal_year: body.fiscal_year,
        payroll_run_id: body.payroll_run_id || null,
        bonus_type: body.bonus_type,
        amount: body.amount,
        bonus_percentage: body.bonus_percentage || null,
        performance_rating: body.performance_rating || null,
        notes: body.notes || null,
        status: body.status || "draft",
        created_by: admin.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating bonus allocation:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(bonus, { status: 201 });
  } catch (error) {
    console.error("POST /compensation/bonus-allocation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
