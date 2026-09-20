"use client";

import { Eye } from "lucide-react";
import type { PerformanceGoal } from "@/performance-development-dashboard/types";
import {
  PERFORMANCE_GOAL_STATUS_LABELS,
  PERFORMANCE_GOAL_STATUS_TONES,
} from "@/performance-development-dashboard/types";
import { formatDateOnly } from "@/performance-development-dashboard/lib/format/date";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

type Props = {
  goal: PerformanceGoal;
  employeeName?: string;
  assignedByName?: string;
  cycleName?: string;
  isHrAdmin: boolean;
  isManager?: boolean;
  busy?: { id: string; action: string } | null;
  onDetail: () => void;
  onMarkCompleted?: (id: string) => void;
};

export function GoalCard({
  goal,
  employeeName,
  assignedByName,
  cycleName,
  isHrAdmin,
  isManager = false,
  busy,
  onDetail,
  onMarkCompleted,
}: Props) {
  const statusTone =
    PERFORMANCE_GOAL_STATUS_TONES[goal.status] ?? PERFORMANCE_GOAL_STATUS_TONES.not_started;
  const goalBusy = busy?.id === goal.id ? busy.action : null;

  const dateLabel =
    goal.start_date && goal.due_date
      ? `${formatDateOnly(goal.start_date)} – ${formatDateOnly(goal.due_date)}`
      : goal.due_date
        ? `Due ${formatDateOnly(goal.due_date)}`
        : goal.start_date
          ? `Starts ${formatDateOnly(goal.start_date)}`
          : null;

  return (
    <div className="w-full rounded-2xl border border-line bg-paper px-5 py-5 dark:border-paper/10 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={
                statusTone +
                " rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              }
            >
              {PERFORMANCE_GOAL_STATUS_LABELS[goal.status]}
            </span>
            {goal.priority && (
              <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {PRIORITY_LABELS[goal.priority] ?? goal.priority}
              </span>
            )}
            {goal.weight != null && (
              <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted">
                Weight {goal.weight}%
              </span>
            )}
            {goal.category && (
              <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-medium text-muted">
                {goal.category}
              </span>
            )}
          </div>

          <p className="mt-2 font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {goal.title}
          </p>

          {goal.description && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted whitespace-pre-wrap line-clamp-2">
              {goal.description}
            </p>
          )}

          {goal.target && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted whitespace-pre-wrap line-clamp-2">
              <span className="font-medium text-ink">Expected: </span>
              {goal.target}
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-3 text-[12px] text-muted flex-wrap">
            {(isHrAdmin || isManager) && employeeName && (
              <>
                <span>{employeeName}</span>
                <span className="text-line">|</span>
              </>
            )}
            <span>{cycleName ?? "No cycle"}</span>
            {dateLabel && (
              <>
                <span className="text-line">|</span>
                <span>{dateLabel}</span>
              </>
            )}
            {assignedByName && (
              <>
                <span className="text-line">|</span>
                <span>Assigned by {assignedByName}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 lg:items-end">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Execution
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tabular-nums text-ink">
              {goal.progress_percent}%
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, goal.progress_percent))}%`,
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isHrAdmin && goal.status === "pending_completion" && onMarkCompleted && (
              <button
                type="button"
                disabled={goalBusy !== null}
                onClick={() => onMarkCompleted(goal.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark complete
              </button>
            )}
            <button
              type="button"
              onClick={onDetail}
              disabled={goalBusy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
            >
              <Eye size={13} strokeWidth={1.75} />
              Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}