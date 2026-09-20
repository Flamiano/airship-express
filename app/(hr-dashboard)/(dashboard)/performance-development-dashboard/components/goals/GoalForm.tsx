"use client";

import { useEffect, useState } from "react";
import type {
  EmployeeOption,
  GoalCreateInput,
  GoalUpdateInput,
  GoalWeightContext,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceGoalStatus,
} from "@/performance-development-dashboard/types";
import { HR_GOAL_STATUS_TRANSITIONS } from "@/performance-development-dashboard/types";
import { formatDateOnly } from "@/performance-development-dashboard/lib/format/date";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

type Props = {
  mode: "create" | "edit";
  initialGoal?: PerformanceGoal;
  employees: EmployeeOption[];
  cycles: PerformanceCycle[];
  /**
   * Pre-selects the cycle when creating a goal. The caller passes the current
   * active/draft cycle so a new goal is visibly tied to a performance period
   * by default. HR can still clear the selection. Never applied when editing.
   */
  defaultCycleId?: string;
  /**
   * DISPLAY-ONLY attribution name resolved server-side from the authenticated
   * account ("Assigned by"). Manager/employee selection never influences it,
   * and it is never submitted with the goal.
   */
  assignerDisplayName?: string;
  /**
   * DISPLAY-ONLY loader for the Goal Setting weight indicator. Resolves the
   * weights already stored for the selected employee (scoped to the cycle when
   * one is chosen) using the existing goals list API. When omitted, no weight
   * indicator is shown. It never writes and never validates.
   */
  onLoadWeightContext?: (input: {
    employeeId: string;
    cycleId: string | null;
  }) => Promise<GoalWeightContext>;
  submitting: boolean;
  onSubmit: (input: GoalCreateInput | GoalUpdateInput) => Promise<void>;
  onCancel: () => void;
};

const emptySelect = "";
const emptyDate = "";
const emptyText = "";

function formatWeightTotal(total: number): string {
  return Number.isInteger(total) ? String(total) : total.toFixed(2);
}

/**
 * DISPLAY-ONLY reporting-manager name for the selected employee, always
 * derived from the employee's own record server-side. Never editable, never
 * submitted, and never guessed:
 * - employee has a manager → that manager's name
 * - employee has no `manager_id` → "No reporting manager"
 * - manager id present but unresolved → safe unknown state
 */
function resolveReportingManagerDisplay(employee: EmployeeOption): string {
  if (employee.managerName?.trim()) return employee.managerName;
  if (employee.managerId) return "Unable to resolve manager";
  return "No reporting manager";
}

export function GoalForm({
  mode,
  initialGoal,
  employees,
  cycles,
  defaultCycleId,
  assignerDisplayName,
  onLoadWeightContext,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const [employeeId, setEmployeeId] = useState(initialGoal?.employee_id ?? emptySelect);
  const [title, setTitle] = useState(initialGoal?.title ?? emptyText);
  const [description, setDescription] = useState(initialGoal?.description ?? emptyText);
  const [category, setCategory] = useState(initialGoal?.category ?? emptyText);
  const [target, setTarget] = useState(initialGoal?.target ?? emptyText);
  const [weight, setWeight] = useState(
    initialGoal?.weight != null ? String(initialGoal.weight) : emptyText
  );
  const [priority, setPriority] = useState(
    initialGoal?.priority ?? "medium"
  );
  const [roleId, setRoleId] = useState(initialGoal?.role_id ?? emptySelect);
  const [cycleId, setCycleId] = useState(
    initialGoal
      ? (initialGoal.cycle_id ?? emptySelect)
      : (defaultCycleId ?? emptySelect)
  );
  const [startDate, setStartDate] = useState(initialGoal?.start_date ?? emptyDate);
  const [dueDate, setDueDate] = useState(initialGoal?.due_date ?? emptyDate);
  const [status, setStatus] = useState<PerformanceGoalStatus>(
    initialGoal?.status ?? "not_started"
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [weightResult, setWeightResult] = useState<{
    key: string;
    context: GoalWeightContext | null;
  } | null>(null);

  const selectedCycle = cycles.find((cycle) => cycle.id === cycleId) ?? null;

  const selectedEmployee =
    employees.find((employee) => employee.id === employeeId) ?? null;

  const weightContextEnabled =
    mode === "create" && Boolean(onLoadWeightContext) && employeeId !== emptySelect;
  const weightContextKey = weightContextEnabled
    ? `${employeeId}::${cycleId || emptySelect}`
    : null;
  const weightContext =
    weightContextKey && weightResult?.key === weightContextKey
      ? weightResult.context
      : null;
  const weightContextLoading =
    weightContextEnabled && weightResult?.key !== weightContextKey;

  useEffect(() => {
    if (!weightContextEnabled || !onLoadWeightContext || !weightContextKey) {
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      onLoadWeightContext({ employeeId, cycleId: cycleId || null })
        .then((context) => {
          if (!cancelled) setWeightResult({ key: weightContextKey, context });
        })
        .catch(() => {
          if (!cancelled) setWeightResult({ key: weightContextKey, context: null });
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [weightContextEnabled, weightContextKey, onLoadWeightContext, employeeId, cycleId]);

  useEffect(() => {
    if (mode !== "create") return;
    if (!defaultCycleId) return;
    if (cycleId !== emptySelect) return;
    setCycleId(defaultCycleId);
  }, [mode, defaultCycleId, cycleId]);

  /**
   * The goal's `role_id` (the job position it is aligned to) is a DB column
   * with an existing server contract, so it is kept on create — but never
   * picked by hand anymore. It is derived automatically from the selected
   * employee's own `job_position_id`. Employees without a recorded position
   * keep the previous null default, like the old "No role" option.
   */
  useEffect(() => {
    if (mode !== "create") return;
    const employee = employees.find((e) => e.id === employeeId);
    setRoleId(employee?.job_position_id ?? emptySelect);
  }, [mode, employeeId, employees]);

  const numericWeight = weight.trim() === emptyText ? null : Number(weight);
  const weightOutOfRange =
    numericWeight !== null &&
    !Number.isNaN(numericWeight) &&
    (numericWeight <= 0 || numericWeight > 100);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (mode === "create" && !employeeId) {
      setFieldError("Select an employee to assign this goal to.");
      return;
    }
    if (!trimmedTitle) {
      setFieldError("Goal title is required.");
      return;
    }
    if (startDate && dueDate && startDate > dueDate) {
      setFieldError("Start date must be on or before the due date.");
      return;
    }
    if (weight.trim() !== emptyText && Number.isNaN(Number(weight))) {
      setFieldError("Weight must be a valid number.");
      return;
    }

    setFieldError(null);

    const input: GoalCreateInput | GoalUpdateInput = {
      title: trimmedTitle,
      description: description.trim() || null,
      category: category.trim() || null,
      target: target.trim() || null,
      priority,
      role_id: roleId || null,
      start_date: startDate || undefined,
      due_date: dueDate || undefined,
      weight: weight.trim() === emptyText ? null : Number(weight),
      ...(mode === "edit" ? { status } : {}),
    };

    const payloadCycleId = cycleId || null;
    if (mode === "create" || (initialGoal && payloadCycleId !== initialGoal.cycle_id)) {
      input.cycle_id = payloadCycleId;
    }

    if (mode === "create") {
      input.employee_id = employeeId;
    }

    onSubmit(input).catch((err) => {
      setFieldError(
        err instanceof Error ? err.message : "Failed to save this goal."
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === "create" && (
        <label className="block">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Employee
          </span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
          >
            <option value="">Select employee...</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {mode === "create" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Role / Position
            </p>
            <div className="mt-1.5 min-h-[38px] rounded-lg bg-line/40 px-3 py-2 text-sm text-ink dark:bg-paper/5">
              {selectedEmployee
                ? (selectedEmployee.position?.trim() || "Not available")
                : ""}
            </div>
            <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
              Read-only, from the employee's current job record.
            </span>
          </div>

          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Reporting Manager
            </p>
            <div className="mt-1.5 min-h-[38px] rounded-lg bg-line/40 px-3 py-2 text-sm text-ink dark:bg-paper/5">
              {selectedEmployee
                ? resolveReportingManagerDisplay(selectedEmployee)
                : ""}
            </div>
            <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
              Read-only, from the employee's manager record.
            </span>
          </div>
        </div>
      )}

      {mode === "create" && (
        <div>
          <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Assigned by
          </p>
          <div className="mt-1.5 min-h-[38px] rounded-lg bg-line/40 px-3 py-2 text-sm text-ink dark:bg-paper/5">
            {assignerDisplayName?.trim() || ""}
          </div>
          <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
            Automatically determined from your account.
          </span>
        </div>
      )}

      {mode === "create" ? (
        <label className="block">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Performance cycle
          </span>
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
          >
            <option value="">No cycle</option>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
            {selectedCycle
              ? `Performance period: ${formatDateOnly(
                  selectedCycle.period_start
                )} – ${formatDateOnly(selectedCycle.period_end)}`
              : "Choose the performance period this expected outcome belongs to."}
          </span>
        </label>
      ) : (
        <div>
          <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Performance cycle
          </p>
          <p className="mt-1.5 text-sm text-ink">
            {selectedCycle ? selectedCycle.name : "No cycle"}
          </p>
          {selectedCycle && (
            <p className="mt-0.5 text-[11.5px] text-muted">
              Performance period: {formatDateOnly(selectedCycle.period_start)} –{" "}
              {formatDateOnly(selectedCycle.period_end)}
            </p>
          )}
        </div>
      )}

      {mode === "edit" && initialGoal && (
        <div>
          <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Status
          </p>
          {initialGoal.status === "completed" ? (
            <>
              <p className="mt-1.5 text-sm text-ink">
                {HR_GOAL_STATUS_TRANSITIONS.completed.length === 0
                  ? "Completed"
                  : initialGoal.status}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Completed goals cannot change status.
              </p>
            </>
          ) : (
            <>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PerformanceGoalStatus)}
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
              >
                <option value={initialGoal.status}>
                  {initialGoal.status.replace(/_/g, " ")}
                </option>
                {HR_GOAL_STATUS_TRANSITIONS[initialGoal.status].map((next) => (
                  <option key={next} value={next}>
                    {next.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Status advances one step at a time. Only the next allowed status is offered.
              </p>
            </>
          )}
        </div>
      )}

      <label className="block">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
          Goal title
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Complete onboarding certification"
          disabled={submitting}
          className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
        />
      </label>

      <label className="block">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
          Description
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What does success look like?"
          disabled={submitting}
          className="mt-1.5 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Category
          </span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Skill building"
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>

        <label className="block">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Target
          </span>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. 90% customer satisfaction"
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Weight
          </span>
          <input
            type="number"
            min="0"
            step="any"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0.0"
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
          <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
            Percentage of the goal score. Evaluated goals must total 100%.
          </span>
        </label>

        <label className="block">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Priority
          </span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
          >
            {PRIORITIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        </div>

      {weightOutOfRange && (
        <p className="text-[11.5px] text-muted">
          A single goal weight should be greater than 0 and at most 100. The evaluated goal weights must total exactly 100% at finalization.
        </p>
      )}

      {mode === "create" && employeeId && (weightContextLoading || weightContext) && (
        <p
          aria-live="polite"
          className="rounded-lg bg-line/40 px-3 py-2 text-[11.5px] leading-relaxed text-muted"
        >
          {weightContextLoading
            ? "Checking the weights already recorded for this employee…"
            : `Existing goals for this employee${
                cycleId ? " in this cycle" : ""
              }: ${formatWeightTotal(
                weightContext?.weightTotal ?? 0
              )}% across ${weightContext?.goalCount ?? 0} goal${
                weightContext?.goalCount === 1 ? "" : "s"
              }. The evaluated goal weights must total 100%.`}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Start date
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
          />
        </label>

        <label className="block">
          <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
            Due date
          </span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
          />
        </label>
      </div>

      {fieldError && (
        <p
          aria-live="polite"
          className="rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600"
        >
          {fieldError}
        </p>
      )}

      <div className="mt-1 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create goal"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}