"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/performance-development-dashboard/components/ui/Skeleton";
import { formatDateOnly } from "@/performance-development-dashboard/lib/format/date";

/**
 * Read-only Leave activity context for an appraisal.
 *
 * Supplemental external context only: currently Approved HR2 Leave request
 * ranges overlapping the appraisal's cycle period. It is never a rating,
 * score, penalty, or attendance interpretation, is visually separated from
 * Goals (60%) / Competencies (40%) scoring, and performs no writes. Field
 * names mirror the Part 3 backend contract (`getAppraisalLeaveContext`);
 * only the approved contract is stored — never reasons, leave types,
 * balances, counts-as-days, or full Leave records. Kept independent from
 * the Time & Attendance Activity section: no reconciliation between them.
 */
type LeaveContextResponse = {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  approvedRequestCount: number;
  approvedRequests: { startDate: string; endDate: string }[];
  source: "hr2_leave_requests";
  verificationState: "current_status_unverified";
  availability: "available" | "empty" | "unavailable";
};

const LEAVE_CONTEXT_API =
  "/performance-development-dashboard/api/performance/appraisals";

function isLeaveContextResponse(value: unknown): value is LeaveContextResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.employeeId === "string" &&
    typeof record.periodStart === "string" &&
    typeof record.periodEnd === "string" &&
    typeof record.approvedRequestCount === "number" &&
    Array.isArray(record.approvedRequests) &&
    record.approvedRequests.every(
      (request) =>
        typeof request === "object" &&
        request !== null &&
        typeof (request as Record<string, unknown>).startDate === "string" &&
        typeof (request as Record<string, unknown>).endDate === "string"
    ) &&
    record.source === "hr2_leave_requests" &&
    record.verificationState === "current_status_unverified" &&
    (record.availability === "available" ||
      record.availability === "empty" ||
      record.availability === "unavailable")
  );
}

function formatRange(startDate: string, endDate: string): string {
  // Single-day requests render once; ranges render whole and are never
  // trimmed, prorated, or day-counted (daysCount is intentionally excluded).
  if (startDate === endDate) return formatDateOnly(startDate);
  return `${formatDateOnly(startDate)} – ${formatDateOnly(endDate)}`;
}

export function LeaveContextSection({
  appraisalId,
  isFinalized,
}: {
  appraisalId: string;
  isFinalized: boolean;
}) {
  const [context, setContext] = useState<LeaveContextResponse | null>(null);
  const [loading, setLoading] = useState(() => Boolean(appraisalId));
  const [failed, setFailed] = useState(() => !appraisalId);
  // Tracks the latest in-flight request so a slower earlier appraisal
  // response can never overwrite a newer one when appraisals are switched.
  const requestRef = useRef(0);

  /* Leave fetch per appraisal. Synchronous resets are required so a
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
          `${LEAVE_CONTEXT_API}/${encodeURIComponent(appraisalId)}/leave-context`,
          { credentials: "include" }
        );
        if (!res.ok) {
          // Authorization failures (401/403/404) belong to the parent
          // appraisal experience; this section only degrades, never retries
          // through another route or HR2 API.
          if (!cancelled && requestRef.current === requestId) setFailed(true);
          return;
        }
        const data: unknown = await res.json();
        if (!cancelled && requestRef.current === requestId) {
          if (isLeaveContextResponse(data)) {
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
      aria-labelledby="leave-context-heading"
      className="mt-6 rounded-2xl border border-line bg-paper p-4"
    >
      <h3
        id="leave-context-heading"
        className="text-[13px] font-medium text-ink"
      >
        Leave Activity
      </h3>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
        Leave activity shown here reflects current approved-request status for
        this review period and is provided as supplemental context only. It is
        not used in performance scoring. Request periods may extend beyond the
        review period.
        {isFinalized &&
          " External leave context — not part of the finalized appraisal record."}
      </p>

      {loading ? (
        <div
          className="mt-3 flex flex-col gap-2"
          role="status"
          aria-label="Loading leave context"
        >
          <Skeleton className="h-3 w-2/3 rounded-full" />
          <Skeleton className="h-3 w-1/2 rounded-full" />
          <Skeleton className="h-3 w-3/5 rounded-full" />
        </div>
      ) : failed || !context ? (
        <p className="mt-3 text-[12.5px] text-muted">
          Leave context is currently unavailable.
        </p>
      ) : context.availability === "unavailable" ? (
        <p className="mt-3 text-[12.5px] text-muted">
          Leave context is currently unavailable.
        </p>
      ) : context.availability === "empty" ? (
        <p className="mt-3 text-[12.5px] text-muted">
          No currently approved leave requests were found overlapping this
          review period.
        </p>
      ) : (
        <dl className="mt-2 divide-y divide-line/60 text-[12.5px]">
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-muted">Review period</dt>
            <dd className="text-right font-medium text-ink">
              {formatDateOnly(context.periodStart)} –{" "}
              {formatDateOnly(context.periodEnd)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-muted">Approved leave requests</dt>
            <dd className="text-right font-medium text-ink">
              {String(context.approvedRequestCount)}
            </dd>
          </div>
          <div className="py-1.5">
            <dt className="text-muted">Approved request periods</dt>
            <dd className="mt-1 flex flex-col gap-1">
              {context.approvedRequests.map((request, index) => (
                <span
                  key={`${request.startDate}:${request.endDate}:${index}`}
                  className="font-medium text-ink"
                >
                  {formatRange(request.startDate, request.endDate)}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
