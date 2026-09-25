"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import {
  TRAINING_EVALUATION_RATING_MAX,
  type EmployeeOption,
  type TrainingEvaluationInput,
} from "@/performance-development-dashboard/types";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceSelect,
  PerformanceTextarea,
} from "@/performance-development-dashboard/components/ui/performance";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { MAX_EVALUATION_COMMENT_LENGTH } from "@/performance-development-dashboard/lib/constants";

type Props = {
  sessionId: string;
  sessionTitle: string;
  employees: EmployeeOption[];
  defaultEmployeeId: string;
  isHrAdmin: boolean;
  enrolledEmployeeIds: string[];
  submitting: boolean;
  onSubmit: (input: TrainingEvaluationInput) => Promise<void>;
  onClose: () => void;
};

export function EvaluateSessionModal({
  sessionId,
  sessionTitle,
  employees,
  defaultEmployeeId,
  isHrAdmin,
  enrolledEmployeeIds,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [employeeId, setEmployeeId] = useState(
    isHrAdmin ? defaultEmployeeId ?? "" : ""
  );
  const [rating, setRating] = useState<number | null>(null);
  const [comments, setComments] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const ratingGroupRef = useRef<HTMLDivElement>(null);

  /**
   * Arrow-key support for the star radiogroup (Tab/Enter/Space already work
   * natively on the buttons). Up/Right increases, Down/Left decreases;
   * focus follows the newly selected star.
   */
  function handleRatingKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const forward =
      event.key === "ArrowRight" || event.key === "ArrowUp" ? true : null;
    const backward =
      event.key === "ArrowLeft" || event.key === "ArrowDown" ? true : null;
    if (forward === null && backward === null) return;
    event.preventDefault();
    const base = rating ?? (forward ? 0 : 6);
    const next = Math.min(5, Math.max(1, base + (forward ? 1 : -1)));
    setRating(next);
    requestAnimationFrame(() => {
      ratingGroupRef.current
        ?.querySelector<HTMLElement>(`[data-rating-value="${next}"]`)
        ?.focus();
    });
  }

  const selectableEmployees = isHrAdmin
    ? employees.filter((employee) =>
        enrolledEmployeeIds.includes(employee.id)
      )
    : [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const input: TrainingEvaluationInput = {
      session_id: sessionId,
      employee_id: isHrAdmin ? employeeId : "",
      rating,
      comments: comments.trim() || null,
    };

    if (!isHrAdmin) {
      // employee_id is not sent for employee scope; the server forces the
      // requesting employee's own id.
      delete (input as { employee_id?: string }).employee_id;
    } else if (!employeeId) {
      setFormError("Select the employee who attended.");
      return;
    }

    try {
      await onSubmit(input);
      setRating(null);
      setComments("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to submit evaluation."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="evaluate-session-modal-title"
    >
      <PerformanceDialogPanel
        size="sm"
        labelledBy="evaluate-session-modal-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="evaluate-session-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {isHrAdmin ? "Record evaluation" : "Submit evaluation"}
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">{sessionTitle}</p>
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
          {isHrAdmin && (
            <PerformanceField
              label="Attended employee"
              htmlFor="eval-employee"
            >
              <PerformanceSelect
                id="eval-employee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={submitting}
              >
                {selectableEmployees.length === 0 && (
                  <option value="">No enrolled employees</option>
                )}
                {selectableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </PerformanceSelect>
            </PerformanceField>
          )}

          <div>
            <p
              id="eval-rating-label"
              className="text-[12.5px] font-medium text-ink"
            >
              Rating{" "}
              <span className="ml-1.5 font-normal text-muted">(optional)</span>
            </p>
            <div
              ref={ratingGroupRef}
              className="mt-1.5 flex items-center gap-1.5"
              role="radiogroup"
              aria-labelledby="eval-rating-label"
              onKeyDown={handleRatingKeyDown}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <Tooltip key={value} label={`${value} star${value === 1 ? "" : "s"}`}>
                  <button
                    type="button"
                    onClick={() => setRating(value)}
                    disabled={submitting}
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    data-rating-value={value}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
                      rating !== null && value <= rating
                        ? "border-amber-400/50 bg-amber-400/10 text-amber-500"
                        : "border-line text-muted/50 hover:text-amber-500 dark:border-paper/15"
                    )}
                  >
                    ★
                  </button>
                </Tooltip>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted">
              {rating === null
                ? "Comments-only evaluations are allowed."
                : `${rating} out of ${TRAINING_EVALUATION_RATING_MAX}`}
            </p>
          </div>

          <div>
            <PerformanceField
              label="Comments"
              htmlFor="eval-comments"
              optional
            >
              <PerformanceTextarea
                id="eval-comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                maxLength={MAX_EVALUATION_COMMENT_LENGTH}
                rows={4}
                placeholder="What worked well? What could be improved?"
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {comments.length}/{MAX_EVALUATION_COMMENT_LENGTH}
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
            >
              <p className="text-[12.5px] font-medium text-red-600">
                {formError}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <PerformanceButton
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </PerformanceButton>
            <PerformanceButton type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit evaluation"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}
