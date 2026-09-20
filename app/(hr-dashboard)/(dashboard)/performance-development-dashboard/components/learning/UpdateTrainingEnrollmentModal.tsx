"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import {
  TRAINING_APPROVAL_STATUSES,
  TRAINING_ATTENDANCE_STATUSES,
  type TrainingEnrollment,
  type UpdateTrainingEnrollmentInput,
} from "@/performance-development-dashboard/types";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";

type Props = {
  enrollment: TrainingEnrollment;
  employeeName: string;
  submitting: boolean;
  onSubmit: (input: UpdateTrainingEnrollmentInput) => Promise<void>;
  onClose: () => void;
};

export function UpdateTrainingEnrollmentModal({
  enrollment,
  employeeName,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [approvalStatus, setApprovalStatus] = useState(
    enrollment.approval_status
  );
  const [attendanceStatus, setAttendanceStatus] = useState(
    enrollment.attendance_status ?? ""
  );
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const input: UpdateTrainingEnrollmentInput = {
      approval_status: approvalStatus as (typeof TRAINING_APPROVAL_STATUSES)[number],
      attendance_status: attendanceStatus
        ? ((attendanceStatus as (typeof TRAINING_ATTENDANCE_STATUSES)[number]))
        : null,
    };

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
      labelledBy="update-training-enrollment-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="update-training-enrollment-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Update session enrollment
            </h2>
            <p className="mt-1 text-[12.5px] text-muted">{employeeName}</p>
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
              htmlFor="enrollment-approval"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Approval
            </label>
            <select
              id="enrollment-approval"
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              {TRAINING_APPROVAL_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11.5px] text-muted">
              Approving records the acting administrator&apos;s linked employee
              as the approver.
            </p>
          </div>

          <div>
            <label
              htmlFor="enrollment-attendance"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Attendance <span className="text-muted">(optional)</span>
            </label>
            <select
              id="enrollment-attendance"
              value={attendanceStatus}
              onChange={(e) => setAttendanceStatus(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              <option value="">Not recorded</option>
              {TRAINING_ATTENDANCE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
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
              {submitting ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}