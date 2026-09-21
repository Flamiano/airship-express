// app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/api/compensation/latest-ratings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { requireAdmin } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RatingRow = {
  employee_id: string;
  appraisal_id: string;
  performance_rating: number | null;
  final_score: number | null;
  letter_grade: string | null;
  cycle_name: string | null;
  cycle_year: number | null;
  reviewed_at: string | null;
  status: string | null;
  comments: string | null;
  strengths: string | null;
  improvements: string | null;
};

const toNumber = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? Number(yearParam) : null;

    // ---- 1. Appraisals ----
    const { data: appraisals, error: appraisalError } = await supabaseAdmin
      .from("hr3_performance_appraisals")
      .select(
        `
        id,
        employee_id,
        performance_rating,
        final_score,
        letter_grade,
        status,
        finalized_at,
        updated_at,
        created_at,
        cycle_id,
        comments,
        strengths,
        improvements
      `
      )
      .order("updated_at", { ascending: false });

    if (appraisalError) {
      console.error("[latest-ratings] appraisals error:", appraisalError);
      return NextResponse.json(
        { error: appraisalError.message },
        { status: 500 }
      );
    }

    const appraisalIds = (appraisals ?? []).map((a) => a.id);
    const cycleIds = Array.from(
      new Set((appraisals ?? []).map((a) => a.cycle_id).filter(Boolean))
    );

    // ---- 2. Cycles (for year inference + name) ----
    const cyclesMap = new Map<
      string,
      {
        id: string;
        name: string;
        period_start: string | null;
        period_end: string | null;
        status: string | null;
      }
    >();

    if (cycleIds.length > 0) {
      const { data: cycles, error: cycleError } = await supabaseAdmin
        .from("hr3_performance_cycles")
        .select("id, name, period_start, period_end, status")
        .in("id", cycleIds);

      if (cycleError) {
        console.error("[latest-ratings] cycles error:", cycleError);
      } else {
        (cycles ?? []).forEach((c) => cyclesMap.set(c.id, c));
      }
    }

    // ---- 3. Goal results ----
    const goalRatingsByAppraisal = new Map<string, number[]>();
    if (appraisalIds.length > 0) {
      const { data: goalRows, error: goalError } = await supabaseAdmin
        .from("hr3_performance_appraisal_goal_results")
        .select("appraisal_id, rating")
        .in("appraisal_id", appraisalIds);

      if (goalError) {
        console.error("[latest-ratings] goal results error:", goalError);
      } else {
        (goalRows ?? []).forEach((g) => {
          const r = toNumber(g.rating);
          if (r == null) return;
          const arr = goalRatingsByAppraisal.get(g.appraisal_id) ?? [];
          arr.push(r);
          goalRatingsByAppraisal.set(g.appraisal_id, arr);
        });
      }
    }

    // ---- 4. Competency results ----
    const compRatingsByAppraisal = new Map<string, number[]>();
    if (appraisalIds.length > 0) {
      const { data: compRows, error: compError } = await supabaseAdmin
        .from("hr3_performance_appraisal_competency_results")
        .select("appraisal_id, rating")
        .in("appraisal_id", appraisalIds);

      if (compError) {
        console.error("[latest-ratings] competency results error:", compError);
      } else {
        (compRows ?? []).forEach((c) => {
          const r = toNumber(c.rating);
          if (r == null) return;
          const arr = compRatingsByAppraisal.get(c.appraisal_id) ?? [];
          arr.push(r);
          compRatingsByAppraisal.set(c.appraisal_id, arr);
        });
      }
    }

    const pickYear = (
      row: {
        finalized_at: string | null;
        updated_at: string | null;
        created_at: string | null;
      },
      cycle: { period_start: string | null; period_end: string | null } | null
    ): number | null => {
      const cycleEndYear = cycle?.period_end
        ? new Date(cycle.period_end).getFullYear()
        : null;
      const cycleStartYear = cycle?.period_start
        ? new Date(cycle.period_start).getFullYear()
        : null;
      const finalizedYear = row.finalized_at
        ? new Date(row.finalized_at).getFullYear()
        : null;
      const updatedYear = row.updated_at
        ? new Date(row.updated_at).getFullYear()
        : null;
      const createdYear = row.created_at
        ? new Date(row.created_at).getFullYear()
        : null;

      return (
        cycleEndYear ??
        cycleStartYear ??
        finalizedYear ??
        updatedYear ??
        createdYear
      );
    };

    // ---- 5. Merge, aggregate, dedupe ----
    const byEmployee = new Map<string, RatingRow>();

    for (const row of appraisals ?? []) {
      const cycle = row.cycle_id ? cyclesMap.get(row.cycle_id) ?? null : null;
      const rowYear = pickYear(row, cycle);

      if (year != null && rowYear != null && rowYear !== year) continue;

      const manual = toNumber(row.performance_rating);
      const finalScore = toNumber(row.final_score);
      const goalAvg = average(goalRatingsByAppraisal.get(row.id) ?? []);
      const compAvg = average(compRatingsByAppraisal.get(row.id) ?? []);

      const normalizedRating =
        manual ?? finalScore ?? goalAvg ?? compAvg ?? null;

      if (normalizedRating == null) continue;

      const reviewedAt =
        row.finalized_at ?? row.updated_at ?? row.created_at ?? null;

      const existing = byEmployee.get(row.employee_id);
      if (existing) {
        const prev = existing.reviewed_at
          ? new Date(existing.reviewed_at).getTime()
          : 0;
        const next = reviewedAt ? new Date(reviewedAt).getTime() : 0;
        if (next <= prev) continue;
      }

      byEmployee.set(row.employee_id, {
        employee_id: row.employee_id,
        appraisal_id: row.id,
        performance_rating: normalizedRating,
        final_score: finalScore,
        letter_grade: row.letter_grade ?? null,
        cycle_name: cycle?.name ?? null,
        cycle_year: rowYear,
        reviewed_at: reviewedAt,
        status: row.status ?? null,
        comments: row.comments ?? null,
        strengths: row.strengths ?? null,
        improvements: row.improvements ?? null,
      });
    }

    return NextResponse.json(Array.from(byEmployee.values()));
  } catch (error) {
    console.error("GET /compensation/latest-ratings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
