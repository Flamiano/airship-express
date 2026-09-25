"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/performance-development-dashboard/components/ui/Skeleton";
import {
  formatDateOnly,
  formatDateTime,
} from "@/performance-development-dashboard/lib/format/date";

/**
 * Read-only Time & Attendance activity context for an appraisal.
 *
 * Supplemental external context only: raw HR2 scanner activity for the
 * appraisal's cycle period. It is never a rating, score, or compliance
 * assessment, is visually separated from Goals (60%) / Competencies (40%)
 * scoring, and performs no writes. Field names mirror the Part 3 backend
 * contract (`getAppraisalAttendanceContext`); only the aggregate contract is
 * stored — never individual attendance rows.
 */
type AttendanceContextResponse = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  recordCount: number;
  firstRecordedTimeIn: string | null;
  lastRecordedTimeOut: string | null;
  openRecordCount: number;
  source: "hr2_attendance_logs";
  verificationState: "raw_unverified";
  availability: "available" | "empty" | "unavailable";
};

const ATTENDANCE_CONTEXT_API =
  "/performance-development-dashboard/api/performance/appraisals";

function isAttendanceContextResponse(
  value: unknown
): value is AttendanceContextResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.employeeId === "string" &&
    typeof record.periodStart === "string" &&
    typeof record.periodEnd === "string" &&
    typeof record.recordCount === "number" &&
    (record.firstRecordedTimeIn === null ||
      typeof record.firstRecordedTimeIn === "string") &&
    (record.lastRecordedTimeOut === null ||
      typeof record.lastRecordedTimeOut === "string") &&
    typeof record.openRecordCount === "number" &&
    record.source === "hr2_attendance_logs" &&
    record.verificationState === "raw_unverified" &&
    (record.availability === "available" ||
      record.availability === "empty" ||
      record.availability === "unavailable")
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

export function AttendanceContextSection({
  appraisalId,
  isFinalized,
}: {
  appraisalId: string;
  isFinalized: boolean;
}) {
  const [context, setContext] = useState<AttendanceContextResponse | null>(
    null
  );
  const [loading, setLoading] = useState(() => Boolean(appraisalId));
  const [failed, setFailed] = useState(() => !appraisalId);
  // Tracks the latest in-flight request so a slower earlier appraisal
  // response can never overwrite a newer one when appraisals are switched.
  const requestRef = useRef(0);

  /* Attendance fetch per appraisal. Synchronous resets are required so a
     previously viewed appraisal's context never renders for the new one;
     the request guard drops out-of-order responses. */
  /* eslint-disable react-hooks/set-state-in-effect -- appraisal-keyed async fetch with stale-response guard */
  useEffect(() => {
    // No valid appraisal: no fetch is ever issued (failed initial state).
    if (!appraisalId) return;
    // Request identity guards against out-of-order responses when the user
    // switches appraisals quickly: only the latest appraisal's result renders.
    let cancelled = false;
    requestRef.current += 1;
    const requestId = requestRef.current;
    setLoading(true);
    setFailed(false);
    setContext(null);

    const load = async () => {
      try {
        const res = await fetch(
          `${ATTENDANCE_CONTEXT_API}/${encodeURIComponent(appraisalId)}/attendance-context`,
          { credentials: "include" }
        );
        if (!res.ok) {
          // Authorization failures (401/403/404) belong to the parent
          // appraisal experience; this section only degrades, never retries
          // through another route.
          if (!cancelled && requestRef.current === requestId) setFailed(true);
          return;
        }
        const data: unknown = await res.json();
        if (!cancelled && requestRef.current === requestId) {
          if (isAttendanceContextResponse(data)) {
            setContext(data);
          } else {
            setFailed(true);
          }
        }
      } catch {
        if (!cancelled && requestRef.current === requestId) setFailed(true);
      } finally {
        if (!cancelled && requestRef.current === requestId) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [appraisalId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <section
      aria-labelledby="attendance-context-heading"
      className="mt-6 rounded-2xl border border-line bg-paper p-4"
    >
      <h3
        id="attendance-context-heading"
        className="text-[13px] font-medium text-ink"
      >
        Time &amp; Attendance Activity
      </h3>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
        Raw Time &amp; Attendance activity for this review period. Records may
        be subject to correction and are not used in performance scoring.
        {isFinalized &&
          " External attendance context — not part of the finalized appraisal record."}
      </p>

      {loading ? (
        <div
          className="mt-3 flex flex-col gap-2"
          role="status"
          aria-label="Loading attendance context"
        >
          <Skeleton className="h-3 w-2/3 rounded-full" />
          <Skeleton className="h-3 w-1/2 rounded-full" />
          <Skeleton className="h-3 w-3/5 rounded-full" />
        </div>
      ) : failed || !context ? (
        <p className="mt-3 text-[12.5px] text-muted">
          Attendance context is currently unavailable.
        </p>
      ) : context.availability === "unavailable" ? (
        <p className="mt-3 text-[12.5px] text-muted">
          Attendance context is currently unavailable.
        </p>
      ) : context.availability === "empty" ? (
        <p className="mt-3 text-[12.5px] text-muted">
          No attendance activity is available for this review period.
        </p>
      ) : (
        <dl className="mt-2 divide-y divide-line/60 text-[12.5px]">
          <ContextRow
            label="Review period"
            value={`${formatDateOnly(context.periodStart)} – ${formatDateOnly(context.periodEnd)}`}
          />
          <ContextRow
            label="Attendance records"
            value={String(context.recordCount)}
          />
          <ContextRow
            label="First recorded time-in"
            value={formatDateTime(context.firstRecordedTimeIn)}
          />
          <ContextRow
            label="Latest recorded time-out"
            value={formatDateTime(context.lastRecordedTimeOut)}
          />
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-muted">
              Open attendance records{" "}
              <span className="text-[11px]">
                (records without a recorded time-out)
              </span>
            </dt>
            <dd className="text-right font-medium text-ink">
              {String(context.openRecordCount)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
