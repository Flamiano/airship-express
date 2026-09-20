"use client";

import { MessageSquare, CheckCircle2 } from "lucide-react";
import type { PerformanceCheckIn } from "@/performance-development-dashboard/types";
import {
  formatDateTime,
  formatDate,
} from "@/performance-development-dashboard/lib/format/date";

type Props = {
  checkIn: PerformanceCheckIn;
  employeeName?: string;
  givenByName?: string;
  givenByAccountName?: string | null;
  isHrAdmin: boolean;
  onOpen?: () => void;
};

export function CheckInCard({
  checkIn,
  employeeName,
  givenByName,
  givenByAccountName,
  isHrAdmin,
  onOpen,
}: Props) {
  const summary = checkIn.threadSummary;
  const canOpen = Boolean(onOpen);

  return (
    <div className="w-full rounded-2xl border border-line bg-paper px-5 py-5 dark:border-paper/10 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              Check-in
            </span>
            <span className="text-[12px] font-medium text-muted">
              {formatDateTime(checkIn.created_at)}
            </span>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
            {checkIn.message}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span>
              Employee:{" "}
              <span className="font-medium text-ink">
                {employeeName ?? "Unknown employee"}
              </span>
            </span>
            <span className="text-line">|</span>
            <span>
              Given by:{" "}
              <span className="font-medium text-ink">
                {isHrAdmin && givenByAccountName
                  ? givenByAccountName
                  : givenByName ?? "Unknown employee"}
              </span>
            </span>
          </div>

          {summary && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 dark:border-paper/10 text-[12px] text-muted">
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

              <span className="inline-flex items-center gap-1.5 text-muted">
                <MessageSquare size={13} strokeWidth={1.75} />
                {summary.messageCount === 0
                  ? "No comments"
                  : summary.messageCount === 1
                    ? "1 comment"
                    : `${summary.messageCount} comments`}
              </span>
            </div>
          )}
        </div>
      </div>

      {canOpen && (
        <div className="mt-4 flex items-center justify-end border-t border-line pt-4 dark:border-paper/10">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent hover:text-ink dark:border-paper/15"
          >
            <MessageSquare size={13} strokeWidth={1.75} />
            View conversation
          </button>
        </div>
      )}
    </div>
  );
}