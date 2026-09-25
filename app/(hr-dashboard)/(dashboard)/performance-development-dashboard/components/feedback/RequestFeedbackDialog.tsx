"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceSelect,
  PerformanceTextarea,
} from "@/performance-development-dashboard/components/ui/performance";
import { MAX_FEEDBACK_REQUEST_MESSAGE_LENGTH } from "@/performance-development-dashboard/lib/constants";
import type { EmployeeOption } from "@/performance-development-dashboard/types";

type Props = {
  employees: EmployeeOption[];
  actorEmployeeUuid?: string | null;
  submitting: boolean;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
};

/**
 * Create dialog: "Request feedback from [employee]" + optional message.
 * The requester is always the authenticated employee (server-resolved) and
 * is never an editable field; the caller's own record is excluded from the
 * selector (the server rejects self-requests regardless).
 */
export function RequestFeedbackDialog({
  employees,
  actorEmployeeUuid,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const candidates = actorEmployeeUuid
    ? employees.filter((employee) => employee.id !== actorEmployeeUuid)
    : employees;
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!recipientId) {
      setFormError("Choose who to request feedback from.");
      return;
    }

    const input: Record<string, unknown> = {
      recipient_employee_id: recipientId,
    };
    const trimmed = message.trim();
    if (trimmed) input.request_message = trimmed;

    try {
      await onSubmit(input);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to send the request."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="request-feedback-dialog-title"
    >
      <PerformanceDialogPanel labelledBy="request-feedback-dialog-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="request-feedback-dialog-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Request feedback
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
          <PerformanceField
            label="Request feedback from"
            htmlFor="feedback-recipient"
          >
            <PerformanceSelect
              id="feedback-recipient"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              disabled={submitting}
            >
              <option value="">Select a colleague</option>
              {candidates.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.department ? ` · ${employee.department}` : ""}
                </option>
              ))}
            </PerformanceSelect>
          </PerformanceField>

          <div>
            <PerformanceField
              label="Message"
              htmlFor="feedback-request-message"
              optional
            >
              <PerformanceTextarea
                id="feedback-request-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_FEEDBACK_REQUEST_MESSAGE_LENGTH}
                rows={4}
                placeholder="Add context — e.g. what you'd like feedback on..."
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {message.length}/{MAX_FEEDBACK_REQUEST_MESSAGE_LENGTH}
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
              {submitting ? "Sending..." : "Send Request"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}
