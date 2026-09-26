"use client";

import { ArrowRight, CheckCircle2, MessageSquare, Paperclip } from "lucide-react";
import type { PerformanceCheckIn } from "@/performance-development-dashboard/types";
import { formatDate } from "@/performance-development-dashboard/lib/format/date";
import {
  PerformancePanel,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";

export type CheckInClassification =
  | {
      status: "linked";
      goalTitle: string;
      /** Historical progress snapshot from the latest linked evidence row. */
      snapshot: number;
      evidenceCount: number;
    }
  | { status: "general" };

type Props = {
  checkIn: PerformanceCheckIn;
  employeeName?: string;
  givenByName?: string;
  givenByAccountName?: string | null;
  isHrAdmin: boolean;
  /**
   * Goal-linkage resolved from the check-in thread endpoint (the only
   * list-safe signal: evidence rows linked to this check-in). Absent while
   * the classification is still loading — the card then renders without the
   * type-specific sections.
   */
  classification?: CheckInClassification;
  onOpen?: () => void;
};

export function CheckInCard({
  checkIn,
  employeeName,
  givenByName,
  givenByAccountName,
  isHrAdmin,
  classification,
  onOpen,
}: Props) {
  const summary = checkIn.threadSummary;

  const displayEmployee = employeeName ?? "Unknown employee";
  const displayGiver =
    (isHrAdmin && givenByAccountName ? givenByAccountName : givenByName) ??
    "Unknown employee";
  const showGiver = checkIn.given_by !== checkIn.employee_id;

  const linked = classification?.status === "linked" ? classification : null;

  return (
    <PerformancePanel>
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 flex-1 truncate font-bricolage text-[17px] font-medium tracking-tight text-ink">
          {displayEmployee}
          {showGiver ? (
            <span className="ml-2 align-middle text-[12px] font-normal tracking-normal text-muted">
              · By {displayGiver}
            </span>
          ) : null}
        </p>
        <span className="shrink-0 text-[12.5px] tabular-nums text-muted">
          {formatDate(checkIn.created_at)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {linked ? (
          <PerformanceStatusBadge tone="bg-accent/10 text-accent">
            Goal-linked
          </PerformanceStatusBadge>
        ) : (
          <PerformanceStatusBadge tone="bg-line text-muted">
            General
          </PerformanceStatusBadge>
        )}
      </div>

      {linked ? (
        <div className="mt-3 rounded-xl border border-line bg-ink/[0.02] px-4 py-3 dark:border-paper/10 dark:bg-paper/[0.04]">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Goal
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-medium text-ink">
            {linked.goalTitle}
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted">
            Progress snapshot{" "}
            <span className="font-semibold tabular-nums text-ink">
              {linked.snapshot}%
            </span>{" "}
            · recorded with this check-in
          </p>
        </div>
      ) : null}

      <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink line-clamp-4">
        {checkIn.message}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
        {linked && linked.evidenceCount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Paperclip size={13} strokeWidth={1.75} />
            {linked.evidenceCount === 1
              ? "1 piece of evidence"
              : `${linked.evidenceCount} pieces of evidence`}
          </span>
        ) : null}
        {summary ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare size={13} strokeWidth={1.75} />
              {summary.messageCount === 0
                ? "No comments"
                : summary.messageCount === 1
                  ? "1 comment"
                  : `${summary.messageCount} comments`}
            </span>
            {summary.acknowledged ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} strokeWidth={1.75} />
                Acknowledged
                {summary.acknowledgedByEmployeeName ? (
                  <span className="text-muted">
                    by {summary.acknowledgedByEmployeeName} &middot;{" "}
                    {formatDate(summary.acknowledgedAt)}
                  </span>
                ) : null}
              </span>
            ) : null}
          </>
        ) : null}
      </div>

      {onOpen ? (
        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
          >
            View check-in
            <ArrowRight size={13} strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
    </PerformancePanel>
  );
}
