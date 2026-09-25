import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { assertHrAdminScope } from "@/performance-development-dashboard/lib/auth/access";
import { requireValidUuid } from "@/performance-development-dashboard/lib/performance/validation";

/**
 * PerDev-owned authoritative finalized-appraisal feed for downstream
 * integrations (Phase 5 Part 3B).
 *
 * OWNERSHIP: PerDev owns the performance result. This module exposes ONLY
 * persisted finalized appraisal facts sourced from PerDev-owned appraisal
 * and cycle data. It creates no tables, snapshots, or sync jobs, performs
 * no writes of any kind, and modifies no Compensation/HR2/HR1 behavior.
 * External Compensation code is never imported.
 *
 * AUTHORITY RULE: only appraisals with status "finalized" or
 * "acknowledged" are eligible. Pre-finalization rows are excluded
 * server-side. No synthetic fallback is ever constructed — goal averages,
 * competency averages, partial ratings, and other substitutes are not
 * authoritative and are not computed here.
 *
 * SEMANTICS: finalScore is the persisted numeric result (1–5, 60% Goals +
 * 40% Competencies, written once by finalizeAppraisal);
 * performanceRating is the persisted band rank (integer 1–5). They share a
 * scale but are distinct fields and must stay distinct downstream.
 *
 * AUTHORIZATION: restricted to the existing PerDev HR-admin scope
 * (strongest existing server authorization; no new roles, accounts, or
 * secrets are invented). CROSS-MODULE LIMITATION: an external Compensation
 * caller therefore needs a PerDev HR-admin session today. A narrower
 * downstream integration read permission is a future design dependency and
 * must remain narrower than PerDev admin — payroll roles gain nothing here.
 *
 * SELECTION: every eligible record in scope is returned; when several
 * qualify, no silent "latest/highest" choice is made. Rows are ordered
 * deterministically (finalized_at ascending, then id) for stability only —
 * ordering is not an authority mechanism. Downstream selection is the
 * consumer's responsibility.
 */

export type FinalizedAppraisalCompensationReference = {
  appraisalId: string;
  employeeId: string;
  cycleId: string | null;
  cycleName: string | null;
  finalScore: number;
  performanceRating: number;
  finalizedAt: string | null;
  status: "finalized" | "acknowledged";
};

export type ListFinalizedAppraisalsInput = {
  employeeId?: string | null;
  appraisalId?: string | null;
  cycleId?: string | null;
};

const ELIGIBLE_STATUSES = ["finalized", "acknowledged"] as const;

function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidFinalScore(value: number | null): value is number {
  return value != null && value >= 1 && value <= 5;
}

function isValidBandRank(value: number | null): value is number {
  return (
    value != null && Number.isInteger(value) && value >= 1 && value <= 5
  );
}

/**
 * Returns authoritative finalized appraisal references in scope.
 * Authentication/authorization via the existing PerDev HR-admin scope;
 * 401/403 propagate unchanged. Filters only narrow server-side PerDev
 * data — result facts are never accepted from the caller.
 *
 * SELECT-only on hr3_performance_appraisals (+ cycle names). Narratives,
 * Attendance, Leave, and all other PerDev data are never selected.
 */
export async function listFinalizedAppraisalsForCompensation(
  input: ListFinalizedAppraisalsInput
): Promise<{ appraisals: FinalizedAppraisalCompensationReference[] } | NextResponse> {
  const scope = await assertHrAdminScope();
  if (scope instanceof NextResponse) return scope;

  let employeeId: string | null = null;
  let appraisalId: string | null = null;
  let cycleId: string | null = null;

  if (input?.employeeId !== undefined && input?.employeeId !== null && input.employeeId !== "") {
    const parsed = requireValidUuid(input.employeeId, "employeeId");
    if (parsed instanceof NextResponse) return parsed;
    employeeId = parsed;
  }
  if (input?.appraisalId !== undefined && input?.appraisalId !== null && input.appraisalId !== "") {
    const parsed = requireValidUuid(input.appraisalId, "appraisalId");
    if (parsed instanceof NextResponse) return parsed;
    appraisalId = parsed;
  }
  if (input?.cycleId !== undefined && input?.cycleId !== null && input.cycleId !== "") {
    const parsed = requireValidUuid(input.cycleId, "cycleId");
    if (parsed instanceof NextResponse) return parsed;
    cycleId = parsed;
  }

  let query = supabaseAdmin
    .from("hr3_performance_appraisals")
    .select(
      "id, employee_id, cycle_id, final_score, performance_rating, finalized_at, status"
    )
    .in("status", [...ELIGIBLE_STATUSES]);

  if (employeeId) query = query.eq("employee_id", employeeId);
  if (appraisalId) query = query.eq("id", appraisalId);
  if (cycleId) query = query.eq("cycle_id", cycleId);

  const { data, error } = await query
    .order("finalized_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) {
    console.error(
      "listFinalizedAppraisalsForCompensation: appraisal query error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to load finalized appraisals" },
      { status: 500 }
    );
  }

  const cycleIds = Array.from(
    new Set(
      ((data ?? []) as { cycle_id: string | null }[])
        .map((row) => row.cycle_id)
        .filter((id): id is string => typeof id === "string" && id !== "")
    )
  );

  const cycleNames = new Map<string, string>();
  if (cycleIds.length > 0) {
    const { data: cycles, error: cycleError } = await supabaseAdmin
      .from("hr3_performance_cycles")
      .select("id, name")
      .in("id", cycleIds);
    if (cycleError) {
      console.error(
        "listFinalizedAppraisalsForCompensation: cycle query error:",
        cycleError
      );
    } else {
      for (const cycle of cycles ?? []) {
        if (typeof cycle.id === "string" && typeof cycle.name === "string") {
          cycleNames.set(cycle.id, cycle.name);
        }
      }
    }
  }

  const appraisals: FinalizedAppraisalCompensationReference[] = [];
  let excluded = 0;

  for (const row of (data ?? []) as {
    id: unknown;
    employee_id: unknown;
    cycle_id: unknown;
    final_score: unknown;
    performance_rating: unknown;
    finalized_at: unknown;
    status: unknown;
  }[]) {
    const finalScore = toFiniteNumber(row.final_score);
    const bandRank = toFiniteNumber(row.performance_rating);

    if (
      typeof row.id !== "string" ||
      row.id === "" ||
      typeof row.employee_id !== "string" ||
      row.employee_id === "" ||
      (row.status !== "finalized" && row.status !== "acknowledged") ||
      !isValidFinalScore(finalScore) ||
      !isValidBandRank(bandRank)
    ) {
      // Never synthesize or repair: invalid finalized rows simply do not
      // become authoritative downstream records. No PII in logs.
      excluded += 1;
      continue;
    }

    const rowCycleId =
      typeof row.cycle_id === "string" && row.cycle_id !== ""
        ? row.cycle_id
        : null;

    appraisals.push({
      appraisalId: row.id,
      employeeId: row.employee_id,
      cycleId: rowCycleId,
      cycleName: rowCycleId ? (cycleNames.get(rowCycleId) ?? null) : null,
      finalScore: finalScore,
      performanceRating: bandRank,
      finalizedAt: typeof row.finalized_at === "string" ? row.finalized_at : null,
      status: row.status,
    });
  }

  if (excluded > 0) {
    console.error(
      "listFinalizedAppraisalsForCompensation: excluded non-authoritative rows:",
      excluded
    );
  }

  return { appraisals };
}
