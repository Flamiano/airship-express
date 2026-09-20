"use client";

import { ChevronRight } from "lucide-react";
import {
  APPRAISAL_STATUS_LABELS,
  APPRAISAL_STATUS_TONES,
  performanceRatingBandFromRank,
  type AppraisalStatus,
  type PerformanceAppraisal,
} from "@/performance-development-dashboard/types";
import { formatDate } from "@/performance-development-dashboard/lib/format/date";

type Props = {
  appraisal: PerformanceAppraisal;
  employeeName?: string;
  evaluatorName?: string;
  reviewerByAccountName?: string | null;
  cycleName?: string | null;
  selectable?: boolean;
  onOpen?: () => void;
};

export function AppraisalCard({
  appraisal,
  employeeName,
  evaluatorName,
  reviewerByAccountName,
  cycleName,
  selectable = true,
  onOpen,
}: Props) {
  const status = appraisal.status as AppraisalStatus;
  const statusLabel =
    APPRAISAL_STATUS_LABELS[status] ?? (appraisal.status || "Unknown stage");
  const statusTone =
    APPRAISAL_STATUS_TONES[status] ?? "bg-line text-muted";

  const finalized =
    appraisal.final_score !== null &&
    appraisal.final_score !== undefined &&
    appraisal.performance_rating !== null &&
    appraisal.performance_rating !== undefined;
  const band =
    finalized && appraisal.performance_rating !== null
      ? performanceRatingBandFromRank(appraisal.performance_rating)
      : null;

  const content = (
    <div className="w-full rounded-2xl border border-line bg-paper px-5 py-5 dark:border-paper/10 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusTone}`}
            >
              {statusLabel}
            </span>
            <span className="text-[12px] font-medium text-muted">
              {formatDate(appraisal.created_at)}
            </span>
          </div>

          <p className="mt-3 font-bricolage text-[17px] font-medium tracking-tight text-ink">
            {appraisal.review_period}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span>
              Employee:{" "}
              <span className="font-medium text-ink">
                {employeeName ?? "Unknown employee"}
              </span>
            </span>
            <span className="text-line">|</span>
            <span>
              Evaluator:{" "}
              <span className={`font-medium ${appraisal.evaluator_id ? "text-ink" : "text-amber-600"}`}>
                {appraisal.evaluator_id ? (evaluatorName ?? "Unknown employee") : "Not assigned — reassign required"}
              </span>
            </span>
            {reviewerByAccountName && (
              <>
                <span className="text-line">|</span>
                <span>
                  HR Admin:{" "}
                  <span className="font-medium text-ink">
                    {reviewerByAccountName}
                  </span>
                </span>
              </>
            )}
            {cycleName && (
              <>
                <span className="text-line">|</span>
                <span>
                  Cycle:{" "}
                  <span className="font-medium text-ink">{cycleName}</span>
                </span>
              </>
            )}
            {finalized && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                {appraisal.final_score !== null &&
                  appraisal.final_score !== undefined &&
                  appraisal.final_score.toFixed(2)}
                {band ? ` · ${band.label}` : ""}
              </span>
            )}
          </div>
        </div>

        {selectable && (
          <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-accent">
            Open
            <ChevronRight size={14} strokeWidth={1.75} />
          </span>
        )}
      </div>
    </div>
  );

  if (selectable && onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left transition-opacity hover:opacity-90"
      >
        {content}
      </button>
    );
  }

  return content;
}