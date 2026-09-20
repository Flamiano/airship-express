"use client";

import { useEffect, useState } from "react";
import { Edit3, X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  EmployeeOption,
  GoalUpdateInput,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceGoalStatus,
} from "@/performance-development-dashboard/types";
import {
  PERFORMANCE_GOAL_STATUS_LABELS,
  PERFORMANCE_GOAL_STATUS_TONES,
} from "@/performance-development-dashboard/types";
import { GoalForm } from "@/performance-development-dashboard/components/goals/GoalForm";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { formatDateOnly } from "@/performance-development-dashboard/lib/format/date";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

type Props = {
  goal: PerformanceGoal;
  isHrAdmin: boolean;
  isManager?: boolean;
  assignedToName: string;
  /**
   * Employee-layer assigner name (from `assigned_by` -> hr1_employees), e.g.
   * "Ana Garcia". Fallback when no account-level audit attribution exists.
   */
  assignedByEmployeeName: string;
  /**
   * Account-identity assigner name (from the `goal.created` audit actor),
   * e.g. the HR Admin account "cap cap". Present on every scoped response;
   * `null`/missing falls back to the employee-layer name.
   */
  assignedByAccountName?: string | null;
  cycleName?: string;
  employees: EmployeeOption[];
  cycles: PerformanceCycle[];
  busy?: { id: string; action: string } | null;
  onClose: () => void;
  onProgress: (id: string, progressPercent: number) => Promise<void>;
  onSubmit: (id: string) => Promise<void>;
  onMarkCompleted: (id: string) => Promise<void>;
  onUpdate: (id: string, input: GoalUpdateInput) => Promise<void>;
};

export function GoalDetailModal({
  goal,
  isHrAdmin,
  isManager = false,
  assignedToName,
  assignedByEmployeeName,
  assignedByAccountName,
  cycleName,
  employees,
  cycles,
  busy,
  onClose,
  onProgress,
  onSubmit,
  onMarkCompleted,
  onUpdate,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [progressInput, setProgressInput] = useState(goal.progress_percent ?? 0);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  useEffect(() => {
    setProgressInput(goal.progress_percent ?? 0);
  }, [goal.id, goal.progress_percent]);

  const statusTone =
    PERFORMANCE_GOAL_STATUS_TONES[goal.status] ?? PERFORMANCE_GOAL_STATUS_TONES.not_started;
  const goalBusy = busy?.id === goal.id ? busy.action : null;

  const employeeEditable =
    !isHrAdmin && !isManager &&
    (goal.status === "not_started" || goal.status === "in_progress");

  const managerCanEditProgress =
    isManager &&
    (goal.status === "not_started" || goal.status === "in_progress");

  const hrCanEditProgress =
    isHrAdmin &&
    (goal.status === "not_started" || goal.status === "in_progress");

  const hrCanComplete = isHrAdmin && goal.status === "pending_completion";
  const hrCanEdit = isHrAdmin && goal.status !== "completed";
  const managerCanEdit = isManager && goal.status !== "completed";

  async function handleProgressUpdate() {
    setProgressError(null);
    setProgressSaving(true);
    try {
      await onProgress(goal.id, progressInput);
    } catch (err) {
      setProgressError(
        err instanceof Error ? err.message : "Failed to update progress."
      );
    } finally {
      setProgressSaving(false);
    }
  }

  async function handleSubmit() {
    setProgressError(null);
    setProgressSaving(true);
    try {
      await onSubmit(goal.id);
    } catch (err) {
      setProgressError(
        err instanceof Error ? err.message : "Failed to submit goal."
      );
    } finally {
      setProgressSaving(false);
    }
  }

  async function handleEditSave(input: GoalUpdateInput) {
    await onUpdate(goal.id, input);
    setEditing(false);
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={goalBusy !== null}
      labelledBy="goal-detail-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
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
              {goal.category && (
                <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-medium text-muted">
                  {goal.category}
                </span>
              )}
            </div>
            <h2
              id="goal-detail-modal-title"
              className="mt-3 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {goal.title}
            </h2>
          </div>
          <Tooltip label="Close" side="bottom">
          <button
            type="button"
            onClick={onClose}
            disabled={goalBusy !== null}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
        </div>

        {editing && (isHrAdmin || isManager) ? (
          <div className="mt-6">
            <GoalForm
              mode="edit"
              initialGoal={goal}
              employees={employees}
              cycles={cycles}
              submitting={goalBusy !== null}
              onSubmit={handleEditSave}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink">
                Expected outcome
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Defined during Goal Setting for this performance cycle.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Description
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink whitespace-pre-wrap">
                {goal.description || "Not set"}
              </p>
            </div>

            <div className="rounded-lg border border-line bg-ink/[0.02] px-3 py-2 dark:bg-paper/[0.04] dark:border-paper/10">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Target
              </p>
              <p className="mt-0.5 text-[13px] text-ink">
                {goal.target || "Not set"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(isHrAdmin || isManager) && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Assigned to
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink">
                    {assignedToName}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Assigned by
                </p>
                <p className="mt-0.5 text-[13px] text-ink">
                  {assignedByAccountName
                    ? assignedByAccountName
                    : assignedByEmployeeName}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Performance cycle
                </p>
                <p className="mt-0.5 text-[13px] text-ink">
                  {cycleName ?? "No cycle"}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Weight
                </p>
                <p className="mt-0.5 text-[13px] text-ink tabular-nums">
                  {goal.weight != null ? `${goal.weight}%` : "Not set"}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Priority
                </p>
                <p className="mt-0.5 text-[13px] text-ink">
                  {PRIORITY_LABELS[goal.priority] ?? goal.priority}
                </p>
              </div>

              {goal.start_date && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                    Start date
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink">
                    {formatDateOnly(goal.start_date)}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-1 border-t border-line pt-4 dark:border-paper/10">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink">
                Goal Execution
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                How much of the expected outcome has actually been accomplished?
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Current progress
                </p>
                <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-ink">
                  {goal.progress_percent}%
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Goal status
                </p>
                <span
                  className={
                    statusTone +
                    " mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                  }
                >
                  {PERFORMANCE_GOAL_STATUS_LABELS[goal.status]}
                </span>
                {goal.status !== "completed" &&
                  !employeeEditable &&
                  !hrCanEditProgress &&
                  !managerCanEditProgress &&
                  !hrCanComplete && (
                    <p className="mt-1 text-[11.5px] text-muted">
                      Status advances one step at a time. Use the actions above to move this goal forward.
                    </p>
                  )}
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Due date
                </p>
                <p className="mt-0.5 text-[13px] text-ink">
                  {goal.due_date ? formatDateOnly(goal.due_date) : "No due date"}
                </p>
              </div>
            </div>

            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, goal.progress_percent))}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                Progress tracks execution of this goal. It is not an official
                performance rating.
              </p>
            </div>

            {(employeeEditable || hrCanEditProgress || managerCanEditProgress) ? (
              <div className="mt-1 flex flex-col gap-3 rounded-xl border border-line px-4 py-4 dark:border-paper/10">
                <div className="flex items-end gap-3">
                  <label className="flex-1">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                      Update current progress
                    </span>
                    <div className="mt-1.5 flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={progressInput}
                        onChange={(e) =>
                          setProgressInput(
                            Math.min(100, Math.max(0, Number(e.target.value)))
                          )
                        }
                        disabled={progressSaving}
                        className="flex-1 text-accent accent-current"
                      />
                      <span className="w-10 text-right text-[12px] font-semibold tabular-nums text-ink">
                        {progressInput}%
                      </span>
                    </div>
                    <span className="mt-1 block text-[11.5px] text-muted">
                      0–100%. Recording progress moves the goal to In Progress.
                    </span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleProgressUpdate}
                    disabled={progressSaving}
                    className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
                  >
                    {progressSaving ? "Saving..." : "Save progress"}
                  </button>
                  {employeeEditable && goal.status !== "pending_completion" && goal.status !== "completed" && (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={progressSaving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Submit completion
                    </button>
                  )}
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted">
                  Submitting marks the goal as pending HR confirmation. Status
                  changes follow the existing goal workflow.
                </p>
              </div>
            ) : null}

            {goal.status === "pending_completion" && !isHrAdmin && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-[12.5px] font-medium text-amber-600">
                  Submitted for review — pending HR confirmation.
                </p>
              </div>
            )}

            {goal.status === "completed" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-[12.5px] font-medium text-emerald-600">
                  This goal has been completed.
                </p>
              </div>
            )}
          </div>
        )}

        {progressError && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600">
            {progressError}
          </p>
        )}

        {!editing && (
          <div className="mt-5 flex items-center justify-end gap-3 border-t border-line pt-4 dark:border-paper/10">
            {(hrCanEdit || managerCanEdit) && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setProgressError(null);
                }}
                disabled={goalBusy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
              >
                <Edit3 size={13} strokeWidth={1.75} />
                Edit
              </button>
            )}
            {hrCanComplete && (
              <button
                type="button"
                onClick={() => onMarkCompleted(goal.id)}
                disabled={goalBusy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark complete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={goalBusy !== null}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}