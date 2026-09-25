import "server-only";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import { getAppraisal } from "@/performance-development-dashboard/lib/performance/appraisals";
import { requireValidUuid } from "@/performance-development-dashboard/lib/performance/validation";

/**
 * Read-only Time & Attendance activity context for PerDev (Phase 3).
 *
 * OWNERSHIP: HR2 (Workforce Management) owns attendance data. This module is
 * a SELECT-only consumer of `public.hr2_attendance_logs` keyed by
 * `hr1_employees.id` — the same employee identity PerDev uses everywhere.
 * It creates no tables, snapshots, caches, or sync jobs, and it performs no
 * HR2 writes of any kind.
 *
 * AUTHORIZATION: the appraisal-centered entry point loads the appraisal
 * through the EXISTING scoped appraisal authorization (`getAppraisal`), so
 * NO APPRAISAL ACCESS = NO ATTENDANCE CONTEXT. The employee and period used
 * in the HR2 query are derived exclusively from that authorized appraisal
 * and its performance cycle — never from client-supplied values.
 *
 * SEMANTICS: HR2 rows are raw scanner/event records (no per-day model, no
 * finalization, no auditable Tardy/Absent calculation, no leave
 * reconciliation). Everything returned here is therefore labeled
 * `raw_unverified` and MUST be presented as neutral activity context. It
 * must never feed appraisal scoring, goal progress, or any performance
 * judgment: attendance contribution to scoring is 0%.
 *
 * TIME BOUNDARY ASSUMPTION: there is no established organization timezone,
 * so cycle dates are interpreted as UTC day boundaries on `created_at`
 * (matching the payroll precedent of date-slicing `created_at`). No workday
 * grouping is performed and no per-day claim is made.
 */

export type AttendanceVerificationState = "raw_unverified";

export type AttendanceContextAvailability = "available" | "empty" | "unavailable";

export type AttendanceContext = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  /** Number of HR2 attendance rows in the bounded query. NOT days worked. */
  recordCount: number;
  /** MIN(valid non-null time_in). A recorded punch, NOT an official time-in. */
  firstRecordedTimeIn: string | null;
  /** MAX(valid non-null time_out). A recorded punch, NOT an official time-out. */
  lastRecordedTimeOut: string | null;
  /** Rows with time_out IS NULL. NOT "currently working". */
  openRecordCount: number;
  source: "hr2_attendance_logs";
  verificationState: AttendanceVerificationState;
  availability: AttendanceContextAvailability;
};

const CYCLE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AttendanceRow = {
  time_in: string | null;
  created_at: string | null;
  time_out: string | null;
};

function isUsableTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  return !Number.isNaN(new Date(value).getTime());
}

function toUnavailable(
  employeeId: string,
  periodStart: string,
  periodEnd: string
): AttendanceContext {
  return {
    employeeId,
    periodStart,
    periodEnd,
    recordCount: 0,
    firstRecordedTimeIn: null,
    lastRecordedTimeOut: null,
    openRecordCount: 0,
    source: "hr2_attendance_logs",
    verificationState: "raw_unverified",
    availability: "unavailable",
  };
}

/**
 * Returns raw attendance activity for the subject and cycle period of an
 * authorized appraisal. Authentication and appraisal scope are enforced by
 * `getAppraisal`; its 401/403/404 responses propagate unchanged (security
 * failures NEVER degrade into an "unavailable" context). Only HR2
 * source/data failures degrade into `availability: "unavailable"`.
 *
 * SELECT-only: one bounded query on `hr2_attendance_logs` restricted to
 * (time_in, time_out, created_at). Statuses, terminals, shifts, RFID, pay,
 * timesheets, and leave are never selected and never returned.
 */
export async function getAppraisalAttendanceContext(
  appraisalId: string
): Promise<AttendanceContext | NextResponse> {
  const id = requireValidUuid(appraisalId, "appraisal id");
  if (id instanceof NextResponse) return id;

  // Existing scoped authorization: HR reviewer, manager scope (self + active
  // direct reports + assigned evaluator), or employee (own + assigned
  // evaluator). Denied here means denied attendance context.
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
    console.error("getAppraisalAttendanceContext: cycle query error:", cycleError);
    return toUnavailable(employeeId, "", "");
  }

  const periodStart = cycle?.period_start;
  const periodEnd = cycle?.period_end;

  if (
    typeof periodStart !== "string" ||
    typeof periodEnd !== "string" ||
    !CYCLE_DATE_PATTERN.test(periodStart) ||
    !CYCLE_DATE_PATTERN.test(periodEnd) ||
    periodStart > periodEnd
  ) {
    return toUnavailable(employeeId, "", "");
  }

  // UTC day boundaries on created_at. No organization timezone is
  // established, so no workday grouping or per-day derivation is performed.
  const rangeStart = `${periodStart}T00:00:00Z`;
  const rangeEnd = `${periodEnd}T23:59:59.999Z`;

  let rows: AttendanceRow[] | null = null;
  try {
    const { data, error } = await supabaseAdmin
      .from("hr2_attendance_logs")
      .select("time_in, time_out, created_at")
      .eq("employee_id", employeeId)
      .gte("created_at", rangeStart)
      .lte("created_at", rangeEnd);

    if (error) {
      console.error("getAppraisalAttendanceContext: HR2 query error:", error);
      return toUnavailable(employeeId, periodStart, periodEnd);
    }
    rows = (data ?? []) as AttendanceRow[];
  } catch (error) {
    console.error("getAppraisalAttendanceContext: HR2 query threw:", error);
    return toUnavailable(employeeId, periodStart, periodEnd);
  }

  if (rows.length === 0) {
    // Zero rows is NOT an absence — it is an empty activity window.
    return {
      employeeId,
      periodStart,
      periodEnd,
      recordCount: 0,
      firstRecordedTimeIn: null,
      lastRecordedTimeOut: null,
      openRecordCount: 0,
      source: "hr2_attendance_logs",
      verificationState: "raw_unverified",
      availability: "empty",
    };
  }

  let firstRecordedTimeIn: string | null = null;
  let lastRecordedTimeOut: string | null = null;
  let openRecordCount = 0;

  for (const row of rows) {
    if (row.time_out == null) {
      openRecordCount += 1;
    } else if (isUsableTimestamp(row.time_out)) {
      if (
        lastRecordedTimeOut === null ||
        new Date(row.time_out).getTime() > new Date(lastRecordedTimeOut).getTime()
      ) {
        lastRecordedTimeOut = row.time_out;
      }
    }
    if (isUsableTimestamp(row.time_in)) {
      if (
        firstRecordedTimeIn === null ||
        new Date(row.time_in).getTime() < new Date(firstRecordedTimeIn).getTime()
      ) {
        firstRecordedTimeIn = row.time_in;
      }
    }
  }

  return {
    employeeId,
    periodStart,
    periodEnd,
    recordCount: rows.length,
    firstRecordedTimeIn,
    lastRecordedTimeOut,
    openRecordCount,
    source: "hr2_attendance_logs",
    verificationState: "raw_unverified",
    availability: "available",
  };
}
