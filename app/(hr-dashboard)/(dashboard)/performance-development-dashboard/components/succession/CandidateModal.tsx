"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  EmployeeOption,
  SuccessionCandidate,
  SuccessionCandidateInput,
} from "@/performance-development-dashboard/types";
import {
  SUCCESSION_POTENTIAL_RATING_MAX,
  SUCCESSION_POTENTIAL_RATING_MIN,
  SUCCESSION_READINESS_SUGGESTIONS,
} from "@/performance-development-dashboard/types";
import {
  SUCCESSION_MAX_NOTES_LENGTH,
  SUCCESSION_MAX_READINESS_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";

type Props = {
  candidate: SuccessionCandidate | null;
  employees: EmployeeOption[];
  submitting: boolean;
  onSubmit: (input: SuccessionCandidateInput) => Promise<void>;
  onClose: () => void;
};

export function CandidateModal({
  candidate,
  employees,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [employeeId, setEmployeeId] = useState(
    candidate?.employee_id ?? ""
  );
  const [readinessLevel, setReadinessLevel] = useState(
    candidate?.readiness_level ?? ""
  );
  const [potentialRating, setPotentialRating] = useState<number | null>(
    candidate?.potential_rating ?? null
  );
  const [performanceRating, setPerformanceRating] = useState<string>(
    candidate?.performance_rating === null ||
      candidate?.performance_rating === undefined
      ? ""
      : String(candidate.performance_rating)
  );
  const [developmentNotes, setDevelopmentNotes] = useState(
    candidate?.development_notes ?? ""
  );
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = candidate !== null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const input: SuccessionCandidateInput = {
      employee_id: employeeId,
      readiness_level: readinessLevel.trim(),
      potential_rating: potentialRating,
      performance_rating:
        performanceRating.trim() === ""
          ? null
          : Number(performanceRating.trim()),
      development_notes: developmentNotes.trim() || null,
    };

    if (!isEdit && !input.employee_id) {
      setFormError("Select the employee to record as a successor.");
      return;
    }

    if (!input.readiness_level) {
      setFormError("Readiness level is required.");
      return;
    }

    if (
      input.performance_rating !== null &&
      (Number.isNaN(input.performance_rating) ||
        !Number.isFinite(input.performance_rating))
    ) {
      setFormError("Performance rating must be a valid number.");
      return;
    }

    try {
      await onSubmit(input);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="candidate-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development · Succession planning
            </p>
            <h2
              id="candidate-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {isEdit ? "Edit candidate" : "Add candidate"}
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="candidate-employee"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Employee
            </label>
            <select
              id="candidate-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting || isEdit}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              <option value="">Select an employee...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.department ? ` · ${employee.department}` : ""}
                </option>
              ))}
            </select>
            {isEdit && (
              <p className="mt-1 text-[11px] text-muted">
                The employee a candidate is recorded against cannot be changed
                — remove and re-add to swap the person.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="candidate-readiness"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Readiness level
            </label>
            <input
              id="candidate-readiness"
              type="text"
              list="candidate-readiness-suggestions"
              value={readinessLevel}
              onChange={(e) => setReadinessLevel(e.target.value)}
              maxLength={SUCCESSION_MAX_READINESS_LENGTH}
              placeholder="e.g. 3plus_years"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <datalist id="candidate-readiness-suggestions">
              {SUCCESSION_READINESS_SUGGESTIONS.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <p className="mt-1 text-[11px] text-muted">
              Free-text field recorded as-is — commonly used values are offered
              as suggestions.
            </p>
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {readinessLevel.length}/{SUCCESSION_MAX_READINESS_LENGTH}
              </span>
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="candidate-potential"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Potential rating{" "}
                <span className="text-muted">(optional)</span>
              </label>
              <select
                id="candidate-potential"
                value={potentialRating ?? ""}
                onChange={(e) =>
                  setPotentialRating(
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                disabled={submitting}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
              >
                <option value="">Not rated</option>
                {Array.from(
                  { length: SUCCESSION_POTENTIAL_RATING_MAX },
                  (_, index) => SUCCESSION_POTENTIAL_RATING_MIN + index
                ).map((value) => (
                  <option key={value} value={value}>
                    {value} / {SUCCESSION_POTENTIAL_RATING_MAX}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="candidate-performance"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Performance rating{" "}
                <span className="text-muted">(optional)</span>
              </label>
              <input
                id="candidate-performance"
                type="number"
                inputMode="decimal"
                step="any"
                value={performanceRating}
                onChange={(e) => setPerformanceRating(e.target.value)}
                disabled={submitting}
                placeholder="e.g. 4.5"
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
              />
              <p className="mt-1 text-[11px] text-muted">
                Stored as entered — the schema applies no range; no score is
                calculated from it.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="candidate-notes"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Development notes{" "}
              <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="candidate-notes"
              value={developmentNotes}
              onChange={(e) => setDevelopmentNotes(e.target.value)}
              maxLength={SUCCESSION_MAX_NOTES_LENGTH}
              rows={3}
              placeholder="Development considerations for this candidate"
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {developmentNotes.length}/{SUCCESSION_MAX_NOTES_LENGTH}
              </span>
            </p>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[12.5px] font-medium text-red-600">
                {formError}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : isEdit
                  ? "Save changes"
                  : "Add candidate"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}