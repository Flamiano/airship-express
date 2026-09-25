"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { PerformanceDialogPanel } from "@/performance-development-dashboard/components/ui/performance";
import type {
  GoalMeasurementType,
  GoalProposalInput,
  PerformanceCycle,
  PerformanceGoal,
} from "@/performance-development-dashboard/types";
import { MEASUREMENT_TYPE_LABELS } from "@/performance-development-dashboard/lib/format/measurement";
import { MAX_GOAL_MEASUREMENT_UNIT_LENGTH } from "@/performance-development-dashboard/lib/constants";
import { formatDateOnly } from "@/performance-development-dashboard/lib/format/date";
import {
  PerformanceButton,
  PerformanceField,
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

type MetricChoice = "manual" | GoalMeasurementType;

const METRIC_CHOICES: {
  value: MetricChoice;
  title: string;
  hint: string;
}[] = [
  {
    value: "manual",
    title: "Manual",
    hint: "Track a percentage as work proceeds.",
  },
  {
    value: "number",
    title: "Number",
    hint: "Count-based target, e.g. 20 accounts.",
  },
  {
    value: "currency",
    title: "Currency",
    hint: "Monetary target, e.g. 500000 revenue.",
  },
  {
    value: "percentage",
    title: "Percentage",
    hint: "Rate target, e.g. 95% satisfaction.",
  },
  {
    value: "custom",
    title: "Custom",
    hint: "Any other measurable target with a unit.",
  },
];

type Props = {
  mode: "create" | "edit";
  initialGoal?: PerformanceGoal;
  /**
   * DISPLAY-ONLY owner name (the authenticated employee). Fixed to self:
   * the form never offers an employee selector and never submits ownership.
   */
  ownerDisplayName: string;
  cycles: PerformanceCycle[];
  defaultCycleId?: string;
  submitting: boolean;
  onSubmit: (input: GoalProposalInput) => Promise<void>;
  onCancel: () => void;
};

const EMPTY_FIELD = "";

export function ProposeGoalForm({
  mode,
  initialGoal,
  ownerDisplayName,
  cycles,
  defaultCycleId,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initialGoal?.title ?? EMPTY_FIELD);
  const [description, setDescription] = useState(
    initialGoal?.description ?? EMPTY_FIELD
  );
  const [category, setCategory] = useState(initialGoal?.category ?? EMPTY_FIELD);
  const [target, setTarget] = useState(initialGoal?.target ?? EMPTY_FIELD);
  const [metricChoice, setMetricChoice] = useState<MetricChoice>(
    initialGoal?.progress_method === "measurable"
      ? (initialGoal.measurement_type ?? "number")
      : "manual"
  );
  const [targetValue, setTargetValue] = useState(
    initialGoal?.target_value != null
      ? String(initialGoal.target_value)
      : EMPTY_FIELD
  );
  const [measurementUnit, setMeasurementUnit] = useState(
    initialGoal?.measurement_unit ?? EMPTY_FIELD
  );
  const [priority, setPriority] = useState(initialGoal?.priority ?? "medium");
  const [cycleId, setCycleId] = useState(
    initialGoal
      ? (initialGoal.cycle_id ?? EMPTY_FIELD)
      : (defaultCycleId ?? EMPTY_FIELD)
  );
  const [startDate, setStartDate] = useState(
    initialGoal?.start_date ?? EMPTY_FIELD
  );
  const [dueDate, setDueDate] = useState(initialGoal?.due_date ?? EMPTY_FIELD);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const selectedCycle = cycles.find((cycle) => cycle.id === cycleId) ?? null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFieldError("Goal title is required.");
      return;
    }
    if (startDate && dueDate && startDate > dueDate) {
      setFieldError("Start date must be on or before the due date.");
      return;
    }
    if (metricChoice !== "manual") {
      const parsedTarget =
        targetValue.trim() === EMPTY_FIELD ? NaN : Number(targetValue);
      if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
        setFieldError("Target must be a number greater than 0.");
        return;
      }
    }

    setFieldError(null);

    // Proposal payload: definition fields ONLY. Ownership, weight,
    // approval, status, and progress state are server-derived and never
    // sent — the server ignores/forces them regardless.
    const input: GoalProposalInput = {
      title: trimmedTitle,
      description: description.trim() || null,
      category: category.trim() || null,
      target: target.trim() || null,
      priority,
      cycle_id: cycleId || null,
      start_date: startDate || undefined,
      due_date: dueDate || undefined,
      progress_method: metricChoice === "manual" ? "manual" : "measurable",
      ...(metricChoice === "manual"
        ? {}
        : {
            measurement_type: metricChoice,
            target_value: Number(targetValue),
            measurement_unit:
              metricChoice === "percentage"
                ? null
                : measurementUnit.trim() || null,
          }),
    };

    onSubmit(input).catch((err) => {
      setFieldError(
        err instanceof Error ? err.message : "Failed to save this proposal."
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <PerformanceSectionHeader
          eyebrow="Your proposal"
          title="What do you want to achieve?"
        />
        <PerformanceField label="Goal title" htmlFor="proposal-title">
          <PerformanceTextInput
            id="proposal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Improve customer satisfaction"
            disabled={submitting}
          />
        </PerformanceField>

        <PerformanceField
          label="Description"
          htmlFor="proposal-description"
          optional
        >
          <PerformanceTextarea
            id="proposal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Add description — what does success look like?"
            disabled={submitting}
          />
        </PerformanceField>
      </section>

      <section className="flex flex-col gap-4">
        <PerformanceSectionHeader eyebrow="Goal details" title="Details" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Type
            </p>
            <div className="mt-1.5 min-h-[38px] rounded-lg bg-line/40 px-3 py-2 text-sm text-ink dark:bg-paper/5">
              Individual
            </div>
            <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
              Employee proposals are always personal goals.
            </span>
          </div>

          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Owner
            </p>
            <div className="mt-1.5 min-h-[38px] rounded-lg bg-line/40 px-3 py-2 text-sm text-ink dark:bg-paper/5">
              {ownerDisplayName}
            </div>
            <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
              Fixed to you — determined from your account.
            </span>
          </div>
        </div>

        <PerformanceField
          label="Timeframe"
          htmlFor="proposal-cycle"
          hint={
            selectedCycle
              ? `Performance period: ${formatDateOnly(
                  selectedCycle.period_start
                )} – ${formatDateOnly(selectedCycle.period_end)}`
              : "Choose the performance period this goal belongs to."
          }
        >
          <PerformanceSelect
            id="proposal-cycle"
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PerformanceField
            label="Start date"
            htmlFor="proposal-start-date"
            optional
          >
            <PerformanceTextInput
              id="proposal-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={submitting}
            />
          </PerformanceField>

          <PerformanceField label="Due date" htmlFor="proposal-due-date" optional>
            <PerformanceTextInput
              id="proposal-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={submitting}
            />
          </PerformanceField>
        </div>

        <PerformanceField label="Priority" htmlFor="proposal-priority">
          <PerformanceSelect
            id="proposal-priority"
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
      </section>

      <section className="flex flex-col gap-4">
        <PerformanceSectionHeader
          eyebrow="Measurement"
          title="Progress metric type"
        />
        <div role="radiogroup" aria-label="Progress metric type">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {METRIC_CHOICES.map((option) => {
              const checked = metricChoice === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 transition-colors ${
                    checked
                      ? "border-accent/60 bg-accent/[0.04]"
                      : "border-line hover:border-accent/40 dark:border-paper/15"
                  }`}
                >
                  <input
                    type="radio"
                    name="proposal-metric-type"
                    value={option.value}
                    checked={checked}
                    onChange={() => setMetricChoice(option.value)}
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

        {metricChoice !== "manual" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PerformanceField
              label="Target"
              htmlFor="proposal-target-value"
              hint={`Must be greater than 0 (${MEASUREMENT_TYPE_LABELS[metricChoice]}). Actual values are recorded after approval.`}
            >
              <PerformanceTextInput
                id="proposal-target-value"
                type="number"
                min="0"
                step="any"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={
                  metricChoice === "currency"
                    ? "e.g. 500000"
                    : metricChoice === "percentage"
                      ? "e.g. 95"
                      : "e.g. 20"
                }
                disabled={submitting}
              />
            </PerformanceField>

            {metricChoice !== "percentage" && (
              <PerformanceField
                label="Metric name"
                htmlFor="proposal-measurement-unit"
                optional
                hint='Display label only, e.g. "Accounts", "Projects".'
              >
                <PerformanceTextInput
                  id="proposal-measurement-unit"
                  type="text"
                  value={measurementUnit}
                  onChange={(e) => setMeasurementUnit(e.target.value)}
                  maxLength={MAX_GOAL_MEASUREMENT_UNIT_LENGTH}
                  placeholder="e.g. Accounts"
                  disabled={submitting}
                />
              </PerformanceField>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <PerformanceSectionHeader eyebrow="More details" title="More details" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PerformanceField
            label="Category"
            htmlFor="proposal-category"
            optional
          >
            <PerformanceTextInput
              id="proposal-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Skill building"
              disabled={submitting}
            />
          </PerformanceField>

          <PerformanceField label="Expected result" htmlFor="proposal-target" optional>
            <PerformanceTextInput
              id="proposal-target"
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. 90% customer satisfaction"
              disabled={submitting}
            />
          </PerformanceField>
        </div>
      </section>

      {fieldError && (
        <p
          aria-live="polite"
          className="rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600"
        >
          {fieldError}
        </p>
      )}

      <div className="mt-1 flex items-center justify-end gap-2">
        <PerformanceButton
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </PerformanceButton>
        <PerformanceButton type="submit" disabled={submitting}>
          {submitting
            ? mode === "create"
              ? "Saving..."
              : "Saving..."
            : mode === "create"
              ? "Save draft"
              : "Save changes"}
        </PerformanceButton>
      </div>
    </form>
  );
}

type ProposeGoalModalProps = {
  mode: "create" | "edit";
  initialGoal?: PerformanceGoal;
  ownerDisplayName: string;
  cycles: PerformanceCycle[];
  defaultCycleId?: string;
  submitting: boolean;
  onSubmit: (input: GoalProposalInput) => Promise<void>;
  onClose: () => void;
};

export function ProposeGoalModal({
  mode,
  initialGoal,
  ownerDisplayName,
  cycles,
  defaultCycleId,
  submitting,
  onSubmit,
  onClose,
}: ProposeGoalModalProps) {
  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="propose-goal-modal-title"
    >
      <PerformanceDialogPanel labelledBy="propose-goal-modal-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              {mode === "create" ? "New goal proposal" : "Edit goal proposal"}
            </p>
            <h2
              id="propose-goal-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {mode === "create"
                ? "Propose a personal goal"
                : "Edit your proposal"}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              {mode === "create"
                ? "Describe what you want to achieve. Your proposal stays a draft until you submit it for manager review."
                : "Update your proposal below. You can resubmit it for review once the requested changes are addressed."}
            </p>
          </div>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>

        <div className="mt-6">
          <ProposeGoalForm
            mode={mode}
            initialGoal={initialGoal}
            ownerDisplayName={ownerDisplayName}
            cycles={cycles}
            defaultCycleId={defaultCycleId}
            submitting={submitting}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      </PerformanceDialogPanel>
    </Modal>
  );
}
