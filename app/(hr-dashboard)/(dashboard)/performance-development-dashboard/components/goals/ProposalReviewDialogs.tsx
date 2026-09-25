"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  GoalReviewInput,
  GoalWeightContext,
  PerformanceGoal,
} from "@/performance-development-dashboard/types";
import { MAX_GOAL_REVIEW_NOTE_LENGTH } from "@/performance-development-dashboard/lib/constants";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceProgress,
  PerformanceTextInput,
  PerformanceTextarea,
} from "@/performance-development-dashboard/components/ui/performance";

function formatWeightTotal(total: number): string {
  return Number.isInteger(total) ? String(total) : total.toFixed(2);
}

type DialogShellProps = {
  labelledBy: string;
  eyebrow: string;
  title: string;
  submitting: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

function DialogShell({
  labelledBy,
  eyebrow,
  title,
  submitting,
  onClose,
  children,
}: DialogShellProps) {
  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy={labelledBy}
    >
      <PerformanceDialogPanel labelledBy={labelledBy}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              {eyebrow}
            </p>
            <h2
              id={labelledBy}
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {title}
            </h2>
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
        <div className="mt-6">{children}</div>
      </PerformanceDialogPanel>
    </Modal>
  );
}

function GoalContextSummary({ goal }: { goal: PerformanceGoal }) {
  return (
    <div className="rounded-xl border border-line bg-ink/[0.02] px-4 py-3 dark:border-paper/10 dark:bg-paper/[0.04]">
      <p className="text-[13.5px] font-medium text-ink">{goal.title}</p>
      {goal.description && (
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
          {goal.description}
        </p>
      )}
    </div>
  );
}

function ReviewNoteField({
  value,
  onChange,
  disabled,
  required,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  required: boolean;
  id: string;
}) {
  return (
    <PerformanceField
      label="Review note"
      htmlFor={id}
      optional={!required}
      hint={
        required
          ? `Required — the employee will see this note (max ${MAX_GOAL_REVIEW_NOTE_LENGTH} characters).`
          : `Optional — shared with the employee (max ${MAX_GOAL_REVIEW_NOTE_LENGTH} characters).`
      }
    >
      <PerformanceTextarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_GOAL_REVIEW_NOTE_LENGTH}
        rows={3}
        placeholder={
          required
            ? "Explain what needs to change…"
            : "Optional context for the employee…"
        }
        disabled={disabled}
      />
    </PerformanceField>
  );
}

type ApproveProps = {
  goal: PerformanceGoal;
  employeeName: string;
  /**
   * DISPLAY-ONLY weights already recorded for this employee/cycle. Never
   * authoritative: the appraisal's exact-100% server validation decides.
   */
  weightContext: GoalWeightContext | null;
  submitting: boolean;
  onSubmit: (input: GoalReviewInput) => Promise<void>;
  onClose: () => void;
};

export function ApproveProposalDialog({
  goal,
  employeeName,
  weightContext,
  submitting,
  onSubmit,
  onClose,
}: ApproveProps) {
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const numericWeight = weight.trim() === "" ? null : Number(weight);
  const projectedTotal =
    weightContext !== null &&
    (numericWeight === null || Number.isFinite(numericWeight))
      ? weightContext.weightTotal + (numericWeight ?? 0)
      : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (weight.trim() === "" || numericWeight === null || Number.isNaN(numericWeight)) {
      setFieldError("Appraisal weight is required to approve this goal.");
      return;
    }
    setFieldError(null);
    try {
      await onSubmit({
        weight: numericWeight,
        review_note: note.trim() || null,
      });
    } catch (err) {
      setFieldError(
        err instanceof Error ? err.message : "Failed to approve this proposal."
      );
    }
  }

  return (
    <DialogShell
      labelledBy="approve-proposal-title"
      eyebrow={`Goal proposal · ${employeeName}`}
      title="Approve goal"
      submitting={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <GoalContextSummary goal={goal} />
        <p className="text-[12.5px] leading-relaxed text-muted">
          Once approved, this goal becomes part of the employee&apos;s official
          performance plan and may be included in appraisal scoring. This does
          not change any already-finalized appraisal.
        </p>

        <PerformanceField
          label="Appraisal weight"
          htmlFor="approve-weight"
          hint="Required. Percentage of the goal score, 1–100. Other goals are not adjusted automatically."
        >
          <div className="relative">
            <PerformanceTextInput
              id="approve-weight"
              type="number"
              min="0"
              step="any"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="25"
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

        {projectedTotal !== null && (
          <div
            aria-live="polite"
            className="rounded-xl border border-line px-4 py-3 dark:border-paper/15"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-[12.5px] font-medium text-ink">
                Projected weight allocation
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-ink">
                {formatWeightTotal(projectedTotal)}% / 100%
              </p>
            </div>
            <div className="mt-2">
              <PerformanceProgress
                value={projectedTotal}
                label={`Projected weight allocation ${formatWeightTotal(projectedTotal)} percent of 100 percent`}
              />
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              {weightContext && (
                <>
                  Existing approved weight:{" "}
                  {formatWeightTotal(weightContext.weightTotal)}% across{" "}
                  {weightContext.goalCount} goal
                  {weightContext.goalCount === 1 ? "" : "s"}.{" "}
                </>
              )}
              Final allocation is validated server-side at appraisal
              submission.
            </p>
          </div>
        )}

        <ReviewNoteField
          id="approve-note"
          value={note}
          onChange={setNote}
          disabled={submitting}
          required={false}
        />

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
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </PerformanceButton>
          <PerformanceButton type="submit" disabled={submitting}>
            {submitting ? "Approving..." : "Approve goal"}
          </PerformanceButton>
        </div>
      </form>
    </DialogShell>
  );
}

type ReturnRejectProps = {
  goal: PerformanceGoal;
  employeeName: string;
  submitting: boolean;
  onSubmit: (input: GoalReviewInput) => Promise<void>;
  onClose: () => void;
};

export function ReturnProposalDialog({
  goal,
  employeeName,
  submitting,
  onSubmit,
  onClose,
}: ReturnRejectProps) {
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) {
      setFieldError("A review note is required so the employee knows what to change.");
      return;
    }
    setFieldError(null);
    try {
      await onSubmit({ review_note: note.trim() });
    } catch (err) {
      setFieldError(
        err instanceof Error ? err.message : "Failed to return this proposal."
      );
    }
  }

  return (
    <DialogShell
      labelledBy="return-proposal-title"
      eyebrow={`Goal proposal · ${employeeName}`}
      title="Return for revision"
      submitting={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <GoalContextSummary goal={goal} />
        <p className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-muted">
          Requested changes
        </p>
        <ReviewNoteField
          id="return-note"
          value={note}
          onChange={setNote}
          disabled={submitting}
          required
        />

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
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </PerformanceButton>
          <PerformanceButton type="submit" disabled={submitting}>
            {submitting ? "Returning..." : "Return to employee"}
          </PerformanceButton>
        </div>
      </form>
    </DialogShell>
  );
}

export function RejectProposalDialog({
  goal,
  employeeName,
  submitting,
  onSubmit,
  onClose,
}: ReturnRejectProps) {
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) {
      setFieldError("A review note is required to reject a proposal.");
      return;
    }
    setFieldError(null);
    try {
      await onSubmit({ review_note: note.trim() });
    } catch (err) {
      setFieldError(
        err instanceof Error ? err.message : "Failed to reject this proposal."
      );
    }
  }

  return (
    <DialogShell
      labelledBy="reject-proposal-title"
      eyebrow={`Goal proposal · ${employeeName}`}
      title="Reject goal proposal?"
      submitting={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <GoalContextSummary goal={goal} />
        <p className="text-[12.5px] leading-relaxed text-muted">
          The employee will be able to view the decision and review note, but
          this proposal cannot be resubmitted.
        </p>
        <ReviewNoteField
          id="reject-note"
          value={note}
          onChange={setNote}
          disabled={submitting}
          required
        />

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
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </PerformanceButton>
          <PerformanceButton type="submit" disabled={submitting}>
            {submitting ? "Rejecting..." : "Reject proposal"}
          </PerformanceButton>
        </div>
      </form>
    </DialogShell>
  );
}
