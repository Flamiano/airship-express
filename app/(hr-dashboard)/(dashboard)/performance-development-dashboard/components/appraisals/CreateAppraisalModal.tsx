"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import type {
  EmployeeOption,
  PerformanceCycle,
} from "@/performance-development-dashboard/types";
import { MAX_REVIEW_PERIOD_LENGTH } from "@/performance-development-dashboard/lib/constants";

type Props = {
  employees: EmployeeOption[];
  cycles: PerformanceCycle[];
  defaultEmployeeId?: string | null;
  submitting: boolean;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
};

export function CreateAppraisalModal({
  employees,
  cycles,
  defaultEmployeeId,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");
  const [cycleId, setCycleId] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const trimmedPeriod = reviewPeriod.trim();
    if (!employeeId) {
      setFormError("Select the employee being appraised.");
      return;
    }
    if (!cycleId) {
      setFormError("Select a performance cycle.");
      return;
    }
    if (!trimmedPeriod) {
      setFormError("Review period is required.");
      return;
    }

    try {
      await onSubmit({
        employee_id: employeeId,
        cycle_id: cycleId,
        review_period: trimmedPeriod,
      });
      setReviewPeriod("");
      setCycleId("");
      if (defaultEmployeeId) setEmployeeId(defaultEmployeeId);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create appraisal."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="create-appraisal-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="create-appraisal-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              New appraisal
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
              htmlFor="appraisal-employee"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Employee
            </label>
            <select
              id="appraisal-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.department ? ` · ${employee.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="appraisal-cycle"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Performance Cycle
            </label>
            <select
              id="appraisal-cycle"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              <option value="">Select cycle</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name}
                  {cycle.status ? ` (${cycle.status})` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              The cycle this appraisal belongs to. Only active cycles are shown.
            </p>
          </div>

          <div>
            <label
              htmlFor="appraisal-review-period"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Review period
            </label>
            <input
              id="appraisal-review-period"
              type="text"
              value={reviewPeriod}
              onChange={(e) => setReviewPeriod(e.target.value)}
              maxLength={MAX_REVIEW_PERIOD_LENGTH}
              placeholder="e.g. Q3-2026"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 flex items-center justify-between text-[11px] text-muted">
              <span>
                The appraisal starts at Self Assessment. The employee can then
                complete and submit their self-assessment.
              </span>
              <span className="tabular-nums">
                {reviewPeriod.length}/{MAX_REVIEW_PERIOD_LENGTH}
              </span>
            </p>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[12.5px] font-medium text-red-600">{formError}</p>
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
              {submitting ? "Creating..." : "Create appraisal"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}