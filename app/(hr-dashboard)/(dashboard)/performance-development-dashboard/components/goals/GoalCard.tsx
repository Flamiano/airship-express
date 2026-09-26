"use client";

import { Eye } from "lucide-react";
import type { PerformanceGoal } from "@/performance-development-dashboard/types";
import {
  GOAL_APPROVAL_STATUS_LABELS,
  GOAL_APPROVAL_STATUS_TONES,
  PERFORMANCE_GOAL_STATUS_LABELS,
  PERFORMANCE_GOAL_STATUS_TONES,
} from "@/performance-development-dashboard/types";
import { formatDateOnly } from "@/performance-development-dashboard/lib/format/date";
import { formatMeasuredPairCompact } from "@/performance-development-dashboard/lib/format/measurement";
import {
  PerformancePanel,
  PerformanceProgress,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function formatGoalDateRange(
  startDate: string | null,
  dueDate: string | null
): string | null {
  if (startDate && dueDate) {
    return `${formatDateOnly(startDate)} – ${formatDateOnly(dueDate)}`;
  }
  if (dueDate) {
    return `Due ${formatDateOnly(dueDate)}`;
  }
  if (startDate) {
    return `Starts ${formatDateOnly(startDate)}`;
  }
  return null;
}

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
  const goalBusy = busy?.id === goal.id ? busy.action : null;
  const statusTone =
    PERFORMANCE_GOAL_STATUS_TONES[goal.status] ??
    PERFORMANCE_GOAL_STATUS_TONES.not_started;
  // Approval answers "is this goal official?", status answers "how far along
  // is the work?". Approved goals render exactly as before (execution badge
  // + weight chip); proposals carry a second, visually distinct badge.
  const approval = goal.approval_status ?? "approved";
  const showApprovalBadge = approval !== "approved";
  const approvalTone =
    GOAL_APPROVAL_STATUS_TONES[approval] ?? GOAL_APPROVAL_STATUS_TONES.draft;

  const dateLabel = formatGoalDateRange(goal.start_date, goal.due_date);
  const meta: string[] = [];
  if ((isHrAdmin || isManager) && employeeName) meta.push(employeeName);
  meta.push(cycleName ?? "No cycle");
  if (dateLabel) meta.push(dateLabel);
  if (assignedByName) meta.push(`Assigned by ${assignedByName}`);

  return (
    <PerformancePanel>
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 flex-1 font-bricolage text-[18px] font-medium tracking-tight text-ink">
          {goal.title}
        </p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {showApprovalBadge && (
            <span title={`Approval state: ${GOAL_APPROVAL_STATUS_LABELS[approval]}`}>
              <PerformanceStatusBadge tone={approvalTone}>
                {GOAL_APPROVAL_STATUS_LABELS[approval]}
              </PerformanceStatusBadge>
            </span>
          )}
          <span title={`Execution state: ${PERFORMANCE_GOAL_STATUS_LABELS[goal.status]}`}>
            <PerformanceStatusBadge tone={statusTone}>
              {PERFORMANCE_GOAL_STATUS_LABELS[goal.status]}
            </PerformanceStatusBadge>
          </span>
        </div>
      </div>

      {(goal.priority || goal.category) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {goal.priority && (
            <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-medium text-muted">
              {PRIORITY_LABELS[goal.priority] ?? goal.priority}
            </span>
          )}
          {goal.category && (
            <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-medium text-muted">
              {goal.category}
            </span>
          )}
        </div>
      )}

      {goal.description && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted whitespace-pre-wrap line-clamp-2">
          {goal.description}
        </p>
      )}

      {goal.target && (
        <p className="mt-1 text-[13px] leading-relaxed text-muted whitespace-pre-wrap line-clamp-2">
          <span className="font-medium text-ink">Expected: </span>
          {goal.target}
        </p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Progress
          </p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">
            {goal.progress_percent}%
            {goal.weight != null && (
              <span className="ml-2 font-normal text-muted">
                · Weight {goal.weight}%
              </span>
            )}
          </p>
        </div>
        {(goal.progress_method ?? "manual") === "measurable" && (
          <p className="mt-1 truncate text-[12px] tabular-nums text-muted">
            {formatMeasuredPairCompact(
              goal.actual_value,
              goal.target_value,
              goal.measurement_type,
              goal.measurement_unit
            )}
          </p>
        )}
        <div className="mt-1.5">
          <PerformanceProgress
            value={goal.progress_percent}
            label={`${goal.title} progress`}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 truncate text-[12px] text-muted">
          {meta.join(" · ")}
        </p>
        <div className="flex shrink-0 items-center gap-2">
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
            <Eye size={13} strokeWidth={1.75} aria-hidden="true" />
            Details
          </button>
        </div>
      </div>
    </PerformancePanel>
  );
}
