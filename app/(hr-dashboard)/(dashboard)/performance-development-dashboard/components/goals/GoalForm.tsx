"use client";

import { useEffect, useState } from "react";
import type {
  EmployeeOption,
  GoalCreateInput,
  GoalMeasurementType,
  GoalProgressMethod,
  GoalUpdateInput,
  GoalWeightContext,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceGoalStatus,
} from "@/performance-development-dashboard/types";
import {
  GOAL_MEASUREMENT_TYPES,
  HR_GOAL_STATUS_TRANSITIONS,
} from "@/performance-development-dashboard/types";
import { MEASUREMENT_TYPE_LABELS } from "@/performance-development-dashboard/lib/format/measurement";
import { MAX_GOAL_MEASUREMENT_UNIT_LENGTH } from "@/performance-development-dashboard/lib/constants";
import { SCORING_WEIGHT_TOLERANCE } from "@/performance-development-dashboard/lib/performance/scoring";
import { formatDateOnly } from "@/performance-development-dashboard/lib/format/date";
import {
  PerformanceButton,
  PerformanceField,
  PerformanceProgress,
  PerformanceSectionHeader,
  PerformanceSelect,
  PerformanceTextarea,
  PerformanceTextInput,
} from "@/performance-development-dashboard/components/ui/performance";

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
   * indicator is shown. It never writes and never validates. Returns null
   * when the allocation cannot be evaluated (no cycle selected or load
   * failure) so callers fail closed instead of showing a cross-cycle total.
   */
  onLoadWeightContext?: (input: {
    employeeId: string;
    cycleId: string | null;
  }) => Promise<GoalWeightContext | null>;
  submitting: boolean;
  onSubmit: (input: GoalCreateInput | GoalUpdateInput) => Promise<void>;
  onCancel: () => void;
};

/** Shared empty value for unselected/unset form fields (select, date, text). */
const EMPTY_FIELD = "";

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
  const [employeeId, setEmployeeId] = useState(initialGoal?.employee_id ?? EMPTY_FIELD);
  const [title, setTitle] = useState(initialGoal?.title ?? EMPTY_FIELD);
  const [description, setDescription] = useState(initialGoal?.description ?? EMPTY_FIELD);
  const [category, setCategory] = useState(initialGoal?.category ?? EMPTY_FIELD);
  const [target, setTarget] = useState(initialGoal?.target ?? EMPTY_FIELD);
  const [weight, setWeight] = useState(
    initialGoal?.weight != null ? String(initialGoal.weight) : EMPTY_FIELD
  );
  const [progressMethod, setProgressMethod] = useState<GoalProgressMethod>(
    initialGoal?.progress_method ?? "manual"
  );
  const [measurementType, setMeasurementType] = useState<
    GoalMeasurementType | ""
  >(initialGoal?.measurement_type ?? "");
  const [targetValue, setTargetValue] = useState(
    initialGoal?.target_value != null ? String(initialGoal.target_value) : EMPTY_FIELD
  );
  const [measurementUnit, setMeasurementUnit] = useState(
    initialGoal?.measurement_unit ?? EMPTY_FIELD
  );
  const [priority, setPriority] = useState(
    initialGoal?.priority ?? "medium"
  );
  const [roleId, setRoleId] = useState(initialGoal?.role_id ?? EMPTY_FIELD);
  const [cycleId, setCycleId] = useState(
    initialGoal
      ? (initialGoal.cycle_id ?? EMPTY_FIELD)
      : (defaultCycleId ?? EMPTY_FIELD)
  );
  const [startDate, setStartDate] = useState(initialGoal?.start_date ?? EMPTY_FIELD);
  const [dueDate, setDueDate] = useState(initialGoal?.due_date ?? EMPTY_FIELD);
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
    Boolean(onLoadWeightContext) && employeeId !== EMPTY_FIELD;
  const weightContextKey = weightContextEnabled
    ? `${mode}::${initialGoal?.id ?? "new"}::${employeeId}::${cycleId || EMPTY_FIELD}`
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
    if (cycleId !== EMPTY_FIELD) return;
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
    setRoleId(employee?.job_position_id ?? EMPTY_FIELD);
  }, [mode, employeeId, employees]);

  const numericWeight = weight.trim() === EMPTY_FIELD ? null : Number(weight);
  const weightOutOfRange =
    numericWeight !== null &&
    !Number.isNaN(numericWeight) &&
    (numericWeight <= 0 || numericWeight > 100);

  /**
   * Live allocation projection: stored weights for the employee/cycle,
   * excluding this goal's own stored weight when editing, plus the value
   * currently in the weight field. DISPLAY-ONLY guidance — the authoritative
   * 100% rule is enforced server-side at appraisal finalization. Shown only
   * once the stored context has loaded; hidden while loading, on load
   * failure, or when the field holds a non-numeric value (covered by the
   * existing "valid number" submit validation instead).
   */
  const storedOthersTotal =
    weightContext != null
      ? weightContext.weightTotal -
        (mode === "edit" ? (initialGoal?.weight ?? 0) : 0)
      : null;
  const projectedTotal =
    storedOthersTotal !== null &&
    (numericWeight === null || Number.isFinite(numericWeight))
      ? storedOthersTotal + (numericWeight ?? 0)
      : null;
  const projectedComplete =
    projectedTotal !== null &&
    Math.abs(projectedTotal - 100) < SCORING_WEIGHT_TOLERANCE;

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
    if (weight.trim() !== EMPTY_FIELD && Number.isNaN(Number(weight))) {
      setFieldError("Weight must be a valid number.");
      return;
    }
    if (progressMethod === "measurable") {
      if (!measurementType) {
        setFieldError("Select a measurement type for Target / Actual tracking.");
        return;
      }
      const parsedTarget =
        targetValue.trim() === EMPTY_FIELD ? NaN : Number(targetValue);
      if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
        setFieldError("Target must be a number greater than 0.");
        return;
      }
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
      weight: weight.trim() === EMPTY_FIELD ? null : Number(weight),
      ...(mode === "edit" ? { status } : {}),
      progress_method: progressMethod,
      ...(progressMethod === "measurable"
        ? {
            measurement_type: measurementType as GoalMeasurementType,
            target_value: Number(targetValue),
            measurement_unit:
              measurementType === "percentage"
                ? null
                : measurementUnit.trim() || null,
          }
        : {}),
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {mode === "create" && (
        <section className="flex flex-col gap-4">
          <PerformanceSectionHeader
            eyebrow="Ownership"
            title="Who is this goal for?"
          />
          <PerformanceField label="Employee" htmlFor="goal-employee">
            <PerformanceSelect
              id="goal-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting}
            >
              <option value="">Select employee...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </PerformanceSelect>
          </PerformanceField>
        </section>
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
              Read-only, from the employee&apos;s current job record.
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
              Read-only, from the employee&apos;s manager record.
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

      <section className="flex flex-col gap-4">
        <PerformanceSectionHeader
          eyebrow="Planning"
          title="When does this apply?"
        />
      {mode === "create" ? (
        <PerformanceField
          label="Performance cycle"
          htmlFor="goal-cycle"
          hint={
            selectedCycle
              ? `Performance period: ${formatDateOnly(
                  selectedCycle.period_start
                )} – ${formatDateOnly(selectedCycle.period_end)}`
              : "Choose the performance period this expected outcome belongs to."
          }
        >
          <PerformanceSelect
            id="goal-cycle"
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            disabled={submitting}
          >
            <option value="">No cycle</option>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </PerformanceSelect>
        </PerformanceField>
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
        <PerformanceField
          label="Status"
          htmlFor="goal-status"
          hint={
            initialGoal.status === "completed"
              ? "Completed goals cannot change status."
              : "Status advances one step at a time. Only the next allowed status is offered."
          }
        >
          {initialGoal.status === "completed" ? (
            <p className="mt-1.5 text-sm text-ink">
              {HR_GOAL_STATUS_TRANSITIONS.completed.length === 0
                ? "Completed"
                : initialGoal.status}
            </p>
          ) : (
            <PerformanceSelect
              id="goal-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as PerformanceGoalStatus)}
              disabled={submitting}
            >
              <option value={initialGoal.status}>
                {initialGoal.status.replace(/_/g, " ")}
              </option>
              {HR_GOAL_STATUS_TRANSITIONS[initialGoal.status].map((next) => (
                <option key={next} value={next}>
                  {next.replace(/_/g, " ")}
                </option>
              ))}
            </PerformanceSelect>
          )}
        </PerformanceField>
      )}
      </section>

      <section className="flex flex-col gap-4">
        <PerformanceSectionHeader
          eyebrow="Goal details"
          title="What should be accomplished?"
        />
        <PerformanceField label="Goal title" htmlFor="goal-title">
          <PerformanceTextInput
            id="goal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Complete onboarding certification"
            disabled={submitting}
          />
        </PerformanceField>

        <PerformanceField label="Description" htmlFor="goal-description" optional>
          <PerformanceTextarea
            id="goal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What does success look like?"
            disabled={submitting}
          />
        </PerformanceField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PerformanceField label="Category" htmlFor="goal-category" optional>
            <PerformanceTextInput
              id="goal-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Skill building"
              disabled={submitting}
            />
          </PerformanceField>

          <PerformanceField label="Target" htmlFor="goal-target" optional>
            <PerformanceTextInput
              id="goal-target"
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. 90% customer satisfaction"
              disabled={submitting}
            />
          </PerformanceField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PerformanceField
            label="Weight"
            htmlFor="goal-weight"
            optional
            hint="Percentage of the goal score. Evaluated goals must total 100%."
          >
            <div className="relative">
              <PerformanceTextInput
                id="goal-weight"
                type="number"
                min="0"
                step="any"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.0"
                disabled={submitting}
                className="pr-9"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted"
              >
                %
              </span>
            </div>
          </PerformanceField>

          <PerformanceField label="Priority" htmlFor="goal-priority">
            <PerformanceSelect
              id="goal-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={submitting}
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </PerformanceSelect>
          </PerformanceField>
        </div>

      {weightOutOfRange && (
        <p className="text-[11.5px] text-muted">
          A single goal weight should be greater than 0 and at most 100. The evaluated goal weights must total exactly 100% at finalization.
        </p>
      )}

      {projectedTotal !== null && (
        <div
          aria-live="polite"
          className="rounded-xl border border-line px-4 py-3 dark:border-paper/15"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[12.5px] font-medium text-ink">
              Goal weight allocation
            </p>
            <p className="text-[13px] font-semibold tabular-nums text-ink">
              {formatWeightTotal(projectedTotal)}% / 100%
            </p>
          </div>
          <div className="mt-2">
            <PerformanceProgress
              value={projectedTotal}
              label={`Goal weight allocation ${formatWeightTotal(projectedTotal)} percent of 100 percent`}
            />
          </div>
          <p
            className={`mt-1.5 text-[12px] leading-relaxed ${
              projectedComplete
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : projectedTotal > 100
                  ? "font-medium text-red-600"
                  : "text-muted"
            }`}
          >
            {projectedComplete
              ? "Weight allocation complete."
              : projectedTotal < 100
                ? `${formatWeightTotal(100 - projectedTotal)}% remaining.`
                : `Exceeds required total by ${formatWeightTotal(projectedTotal - 100)}%.`}
          </p>
        </div>
      )}

      {weightContextEnabled && !cycleId && projectedTotal === null && (
        <p
          aria-live="polite"
          className="rounded-lg bg-line/40 px-3 py-2 text-[11.5px] leading-relaxed text-muted"
        >
          Weight allocation unavailable because no performance cycle is
          selected. Select a cycle to evaluate allocation against the correct
          performance period.
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
      </section>

      <section className="flex flex-col gap-4">
        <PerformanceSectionHeader
          eyebrow="Measurement"
          title="How is progress tracked?"
        />
        <div role="radiogroup" aria-label="Progress tracking">
          <div className="flex flex-col gap-2 sm:flex-row">
            {(
              [
                {
                  value: "manual" as const,
                  title: "Manual Progress",
                  hint: "Enter a percentage as work proceeds.",
                },
                {
                  value: "measurable" as const,
                  title: "Target / Actual",
                  hint: "Progress is calculated from recorded actuals.",
                },
              ]
            ).map((option) => {
              const checked = progressMethod === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 transition-colors ${
                    checked
                      ? "border-accent/60 bg-accent/[0.04]"
                      : "border-line hover:border-accent/40 dark:border-paper/15"
                  }`}
                >
                  <input
                    type="radio"
                    name="goal-progress-method"
                    value={option.value}
                    checked={checked}
                    onChange={() => setProgressMethod(option.value)}
                    disabled={submitting}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-ink">
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">
                      {option.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {progressMethod === "measurable" && (
          <>
            <PerformanceField
              label="Measurement type"
              htmlFor="goal-measurement-type"
            >
              <PerformanceSelect
                id="goal-measurement-type"
                value={measurementType}
                onChange={(e) =>
                  setMeasurementType(
                    e.target.value as GoalMeasurementType | ""
                  )
                }
                disabled={submitting}
              >
                <option value="">Select type</option>
                {GOAL_MEASUREMENT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {MEASUREMENT_TYPE_LABELS[option]}
                  </option>
                ))}
              </PerformanceSelect>
            </PerformanceField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PerformanceField
                label="Target"
                htmlFor="goal-target-value"
                hint="Must be greater than 0. Actual values are recorded during execution."
              >
                <PerformanceTextInput
                  id="goal-target-value"
                  type="number"
                  min="0"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g. 1000000"
                  disabled={submitting}
                />
              </PerformanceField>

              {measurementType !== "percentage" && (
                <PerformanceField
                  label="Unit"
                  htmlFor="goal-measurement-unit"
                  optional
                  hint="Display label only, e.g. PHP, Orders."
                >
                  <PerformanceTextInput
                    id="goal-measurement-unit"
                    type="text"
                    value={measurementUnit}
                    onChange={(e) => setMeasurementUnit(e.target.value)}
                    maxLength={MAX_GOAL_MEASUREMENT_UNIT_LENGTH}
                    placeholder="e.g. PHP"
                    disabled={submitting}
                  />
                </PerformanceField>
              )}
            </div>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PerformanceField label="Start date" htmlFor="goal-start-date" optional>
          <PerformanceTextInput
            id="goal-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={submitting}
          />
        </PerformanceField>

        <PerformanceField label="Due date" htmlFor="goal-due-date" optional>
          <PerformanceTextInput
            id="goal-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={submitting}
          />
        </PerformanceField>
      </div>

      {fieldError && (
        <p
          aria-live="polite"
          className="rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600"
        >
          {fieldError}
        </p>
      )}

      <div className="mt-1 flex items-center justify-end gap-2">
        <PerformanceButton variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </PerformanceButton>
        <PerformanceButton type="submit" disabled={submitting}>
          {submitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create goal"
              : "Save changes"}
        </PerformanceButton>
      </div>
    </form>
  );
}