import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAppraisal } from "@/performance-development-dashboard/lib/performance/appraisals";
import { requireValidUuid } from "@/performance-development-dashboard/lib/performance/validation";

/**
 * Read-only Leave activity context for PerDev (Phase 4).
 *
 * OWNERSHIP: HR2 (Workforce Management) owns Leave data. This module is a
 * SELECT-only consumer of `public.hr2_leave_requests` keyed by
 * `hr1_employees.id` — the same employee identity PerDev uses everywhere.
 * It creates no tables, snapshots, caches, or sync jobs, and it performs no
 * HR2 writes of any kind. The existing HR2 Leave API (including its separate
 * authentication weakness) is never called, imported, or reused.
 *
 * AUTHORIZATION: the appraisal-centered entry point loads the appraisal
 * through the EXISTING scoped appraisal authorization (`getAppraisal`), so
 * NO APPRAISAL ACCESS = NO LEAVE CONTEXT. The employee and period used in
 * the HR2 query are derived exclusively from that authorized appraisal and
 * its performance cycle — never from client-supplied values.
 *
 * SEMANTICS: HR2 "Approved" means only "currently flagged Approved" (single
 * HR-role action, no approver identity/timestamp/audit, silently reversible;
 * overlapping requests unprevented; no leave reconciliation with
 * attendance). Everything returned here is therefore labeled
 * `current_status_unverified` and MUST be presented as neutral supplemental
 * context. It must never feed appraisal scoring, goal progress, or any
 * performance judgment: Leave contribution to scoring is 0%.
 *
 * DATE SEMANTICS: Leave uses DATE columns (no timestamps), so no timezone
 * conversion is performed. Overlapping date ranges are listed whole — never
 * prorated, summed, or deduplicated — because HR2 has no workday model.
 */

export type LeaveVerificationState = "current_status_unverified";

export type LeaveContextAvailability = "available" | "empty" | "unavailable";

export type LeaveContextRequest = {
  startDate: string;
  endDate: string;
};

export type LeaveContext = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  /** Number of valid currently-Approved overlapping request ranges. */
  approvedRequestCount: number;
  /** Original request ranges (whole, untrimmed, undeduplicated). No day sums. */
  approvedRequests: LeaveContextRequest[];
  source: "hr2_leave_requests";
  verificationState: LeaveVerificationState;
  availability: LeaveContextAvailability;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type LeaveRow = {
  start_date: string | null;
  end_date: string | null;
};

function isValidLeaveRange(
  row: LeaveRow
): row is { start_date: string; end_date: string } {
  return (
    typeof row.start_date === "string" &&
    typeof row.end_date === "string" &&
    DATE_PATTERN.test(row.start_date) &&
    DATE_PATTERN.test(row.end_date) &&
    row.start_date <= row.end_date
  );
}

function toUnavailable(
  employeeId: string,
  periodStart: string,
  periodEnd: string
): LeaveContext {
  return {
    employeeId,
    periodStart,
    periodEnd,
    approvedRequestCount: 0,
    approvedRequests: [],
    source: "hr2_leave_requests",
    verificationState: "current_status_unverified",
    availability: "unavailable",
  };
}

/**
 * Returns currently-Approved Leave request ranges overlapping the subject
 * and cycle period of an authorized appraisal. Authentication and appraisal
 * scope are enforced by `getAppraisal`; its 401/403/404 responses propagate
 * unchanged (security failures NEVER degrade into an "unavailable"
 * context). Only HR2 source/data failures degrade into
 * `availability: "unavailable"`.
 *
 * SELECT-only: one bounded query on `hr2_leave_requests` restricted to
 * (start_date, end_date) for currently Approved overlapping rows. Reasons,
 * leave types, balances, counts-as-days, IDs, and employee PII are never
 * selected and never returned.
 */
export async function getAppraisalLeaveContext(
  appraisalId: string
): Promise<LeaveContext | NextResponse> {
  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  // Existing scoped authorization: HR reviewer, manager scope (self + active
  // direct reports + assigned evaluator), or employee (own + assigned
  // evaluator). Denied here means denied Leave context.
  const appraisal = await getAppraisal(id);
  if (appraisal instanceof NextResponse) return appraisal;

  const employeeId = appraisal.employee_id;
  const cycleId = appraisal.cycle_id;

  // A machine-readable bounded period is mandatory. Free-text review_period
  // is never parsed as a date source.
  if (!cycleId) {
    return toUnavailable(employeeId, "", "");
  }

  const { data: cycle, error: cycleError } = await supabaseAdmin
    .from("hr3_performance_cycles")
    .select("period_start, period_end")
    .eq("id", cycleId)
    .maybeSingle();

  if (cycleError) {
    console.error("getAppraisalLeaveContext: cycle query error:", cycleError);
    return toUnavailable(employeeId, "", "");
  }

  const periodStart = cycle?.period_start;
  const periodEnd = cycle?.period_end;

  if (
    typeof periodStart !== "string" ||
    typeof periodEnd !== "string" ||
    !DATE_PATTERN.test(periodStart) ||
    !DATE_PATTERN.test(periodEnd) ||
    periodStart > periodEnd
  ) {
    return toUnavailable(employeeId, "", "");
  }

  // Currently Approved requests overlapping the cycle window (fully
  // contained, starting before, ending after, or spanning it). DATE columns
  // compare lexicographically as plain dates — no timezone conversion.
  let rows: LeaveRow[] | null = null;
  try {
    const { data, error } = await supabaseAdmin
      .from("hr2_leave_requests")
      .select("start_date, end_date")
      .eq("employee_id", employeeId)
      .eq("status", "Approved")
      .lte("start_date", periodEnd)
      .gte("end_date", periodStart)
      .order("start_date", { ascending: true })
      .order("end_date", { ascending: true });

    if (error) {
      console.error("getAppraisalLeaveContext: HR2 query error:", error);
      return toUnavailable(employeeId, periodStart, periodEnd);
    }
    rows = (data ?? []) as LeaveRow[];
  } catch (error) {
    console.error("getAppraisalLeaveContext: HR2 query threw:", error);
    return toUnavailable(employeeId, periodStart, periodEnd);
  }

  // Malformed rows (start > end, unparseable) are excluded, never repaired
  // or exposed. Overlapping ranges stay separate — never merged or summed.
  const valid: LeaveContextRequest[] = [];
  let malformed = 0;
  for (const row of rows) {
    if (isValidLeaveRange(row)) {
      valid.push({ startDate: row.start_date, endDate: row.end_date });
    } else {
      malformed += 1;
    }
  }
  if (malformed > 0) {
    console.error(
      "getAppraisalLeaveContext: excluded malformed leave ranges:",
      malformed
    );
  }

  if (valid.length === 0) {
    // Zero valid rows proves nothing about absence — it is an empty result
    // for currently Approved overlapping requests only.
    return {
      employeeId,
      periodStart,
      periodEnd,
      approvedRequestCount: 0,
      approvedRequests: [],
      source: "hr2_leave_requests",
      verificationState: "current_status_unverified",
      availability: "empty",
    };
  }

  return {
    employeeId,
    periodStart,
    periodEnd,
    approvedRequestCount: valid.length,
    approvedRequests: valid,
    source: "hr2_leave_requests",
    verificationState: "current_status_unverified",
    availability: "available",
  };
}
