"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import {
  COURSE_ENROLLMENT_STATUSES,
  COURSE_PROGRESS_MAX,
  COURSE_PROGRESS_MIN,
  type CourseEnrollment,
  type UpdateCourseEnrollmentInput,
} from "@/performance-development-dashboard/types";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceSelect,
  PerformanceTextInput,
} from "@/performance-development-dashboard/components/ui/performance";

type Props = {
  enrollment: CourseEnrollment;
  courseTitle: string;
  submitting: boolean;
  onSubmit: (input: UpdateCourseEnrollmentInput) => Promise<void>;
  onClose: () => void;
};

export function UpdateEnrollmentModal({
  enrollment,
  courseTitle,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [status, setStatus] = useState(enrollment.status);
  const [progress, setProgress] = useState<number | "">(
    enrollment.progress_percent
  );
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    let progressNumber: number | null = null;
    if (progress !== "") {
      progressNumber = Number(progress);
      if (
        !Number.isFinite(progressNumber) ||
        progressNumber < COURSE_PROGRESS_MIN ||
        progressNumber > COURSE_PROGRESS_MAX
      ) {
        setFormError(
          `Progress must be between ${COURSE_PROGRESS_MIN} and ${COURSE_PROGRESS_MAX}.`
        );
        return;
      }
    }

    const input: UpdateCourseEnrollmentInput = {
      status: status as (typeof COURSE_ENROLLMENT_STATUSES)[number],
    };
    if (progressNumber !== null) {
      input.progress_percent = progressNumber;
    }

    try {
      await onSubmit(input);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update enrollment."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="update-enrollment-modal-title"
    >
      <PerformanceDialogPanel
        size="sm"
        labelledBy="update-enrollment-modal-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="update-enrollment-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Update course enrollment
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">{courseTitle}</p>
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
          <PerformanceField
            label="Status"
            htmlFor="enrollment-status"
            hint="Marking a course completed records the completion time and sets progress to 100%. It does not change any competency level — those change only through an explicit HR assessment."
          >
            <PerformanceSelect
              id="enrollment-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={submitting}
            >
              {COURSE_ENROLLMENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option.replace("_", " ")}
                </option>
              ))}
            </PerformanceSelect>
          </PerformanceField>

          <div>
            <PerformanceField label="Progress %" htmlFor="enrollment-progress">
              <PerformanceTextInput
                id="enrollment-progress"
                type="number"
                min={COURSE_PROGRESS_MIN}
                max={COURSE_PROGRESS_MAX}
                step="any"
                value={progress}
                onChange={(e) =>
                  setProgress(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                placeholder="0"
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {COURSE_PROGRESS_MIN}–{COURSE_PROGRESS_MAX}
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
            <PerformanceButton
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </PerformanceButton>
            <PerformanceButton type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save changes"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}
