import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { assertHrAdminScope } from "@/performance-development-dashboard/lib/auth/access";
import { requireValidUuid } from "@/performance-development-dashboard/lib/performance/validation";

/**
 * PerDev-owned appraisal analytics provider for downstream HR Analytics
 * (Phase 6 Part 3). APPRAISAL AGGREGATES ONLY.
 *
 * OWNERSHIP: PerDev owns the performance result. This module aggregates
 * ONLY persisted finalized appraisal facts sourced from PerDev-owned
 * appraisal and cycle data. It creates no tables, snapshots, or sync jobs,
 * performs no writes of any kind, and modifies no external-module behavior.
 *
 * AUTHORITY RULE: only appraisals with status "finalized" or
 * "acknowledged" contribute. Pre-finalization rows are excluded
 * server-side. No synthetic fallback is ever constructed — goal averages,
 * competency averages, partial ratings, and other substitutes are not
 * authoritative and are not computed here. Persisted final_score is read,
 * never recalculated (60% Goals + 40% Competencies stays in scoring.ts).
 *
 * COUNT SEMANTICS: every metric counts eligible APPRAISAL RECORDS, never
 * employees. Multiple finalized appraisals for one employee/cycle are
 * preserved (no dedup): each is one observation in counts, average, and
 * distribution. No completion rate is produced (no authoritative
 * denominator exists) and no ranking is produced.
 *
 * VALIDITY SPLIT: status/lifecycle counts include every eligible record;
 * score/rating metrics include only rows with a valid value for that
 * field. invalidResultCount increments ONCE per eligible appraisal when
 * either required result field is invalid (never double-counted).
 *
 * AUTHORIZATION: restricted to the existing PerDev HR-admin scope
 * (strongest existing server authorization; no new roles, accounts, or
 * secrets are invented). CROSS-MODULE LIMITATION: an external analytics
 * consumer therefore needs a PerDev HR-admin session today. A narrower
 * downstream read permission is a future design dependency and must remain
 * narrower than PerDev admin.
 */

export type AnalyticsRatingDistribution = {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
};

export type AppraisalAnalyticsIntegrationResponse = {
  scope: {
    type: "organization";
  };
  cycle: {
    id: string;
    name: string;
    periodStart: string;
    periodEnd: string;
  };
  appraisals: {
    awaitingAcknowledgmentCount: number;
    acknowledgedCount: number;
    completedAppraisalCount: number;
    invalidResultCount: number;
    averageFinalScore: number | null;
    ratingDistribution: AnalyticsRatingDistribution;
  };
};

const ELIGIBLE_STATUSES = ["finalized", "acknowledged"] as const;

const CYCLE_NOT_FOUND_RESPONSE = () =>
  NextResponse.json({ error: "Performance cycle not found" }, { status: 404 });

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

function emptyDistribution(): AnalyticsRatingDistribution {
  return { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
}

/**
 * Returns cycle-bounded finalized appraisal aggregates. cycleId is
 * REQUIRED: no current-cycle default, no date/year inference, no
 * all-history mode. Authentication/authorization via the existing PerDev
 * HR-admin scope; 401/403 propagate unchanged.
 *
 * SELECT-only on hr3_performance_appraisals (+ one cycle row). Narratives,
 * PII, Attendance, Leave, Compensation, Goals, Competencies, and all other
 * PerDev domains are never selected.
 */
export async function getAppraisalAnalyticsForIntegration(
  cycleId: string | null | undefined
): Promise<AppraisalAnalyticsIntegrationResponse | NextResponse> {
  const scope = await assertHrAdminScope();
  if (scope instanceof NextResponse) return scope;

  if (typeof cycleId !== "string" || cycleId.trim() === "") {
    return NextResponse.json(
      { error: "cycleId is required." },
      { status: 400 }
    );
  }

  const id = requireValidUuid(cycleId, "cycleId");
  if (id instanceof NextResponse) return id;

  const { data: cycle, error: cycleError } = await supabaseAdmin
    .from("hr3_performance_cycles")
    .select("id, name, period_start, period_end")
    .eq("id", id)
    .maybeSingle();

  if (cycleError) {
    console.error(
      "getAppraisalAnalyticsForIntegration: cycle query error:",
      cycleError
    );
    return NextResponse.json(
      { error: "Failed to load performance cycle" },
      { status: 500 }
    );
  }

  if (!cycle) return CYCLE_NOT_FOUND_RESPONSE();

  const { data, error } = await supabaseAdmin
    .from("hr3_performance_appraisals")
    .select("id, status, final_score, performance_rating")
    .eq("cycle_id", id)
    .in("status", [...ELIGIBLE_STATUSES]);

  if (error) {
    console.error(
      "getAppraisalAnalyticsForIntegration: appraisal query error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to load appraisal analytics" },
      { status: 500 }
    );
  }

  let awaitingAcknowledgmentCount = 0;
  let acknowledgedCount = 0;
  let invalidResultCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  const ratingDistribution = emptyDistribution();

  for (const row of (data ?? []) as {
    id: unknown;
    status: unknown;
    final_score: unknown;
    performance_rating: unknown;
  }[]) {
    if (row.status !== "finalized" && row.status !== "acknowledged") {
      continue;
    }

    if (row.status === "finalized") {
      awaitingAcknowledgmentCount += 1;
    } else {
      acknowledgedCount += 1;
    }

    const finalScore = toFiniteNumber(row.final_score);
    const bandRank = toFiniteNumber(row.performance_rating);

    const scoreValid = isValidFinalScore(finalScore);
    const rankValid = isValidBandRank(bandRank);

    // Each metric validates its own field: a row with a valid score but an
    // invalid rating still contributes to the average (and vice versa).
    if (scoreValid) {
      scoreSum += finalScore;
      scoreCount += 1;
    }
    if (rankValid) {
      ratingDistribution[String(bandRank) as "1" | "2" | "3" | "4" | "5"] += 1;
    }
    if (!scoreValid || !rankValid) {
      invalidResultCount += 1;
    }
  }

  return {
    scope: { type: "organization" },
    cycle: {
      id: cycle.id,
      name: cycle.name,
      periodStart: cycle.period_start,
      periodEnd: cycle.period_end,
    },
    appraisals: {
      awaitingAcknowledgmentCount,
      acknowledgedCount,
      completedAppraisalCount:
        awaitingAcknowledgmentCount + acknowledgedCount,
      invalidResultCount,
      averageFinalScore:
        scoreCount > 0
          ? Math.round((scoreSum / scoreCount) * 100) / 100
          : null,
      ratingDistribution,
    },
  };
}
