"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type { EmployeeOption } from "@/performance-development-dashboard/types";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { MAX_CHECK_IN_MESSAGE_LENGTH } from "@/performance-development-dashboard/lib/constants";

type Props = {
  canSelectEmployee: boolean;
  employees: EmployeeOption[];
  defaultEmployeeId?: string | null;
  submitting: boolean;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
};

export function CreateCheckInModal({
  canSelectEmployee,
  employees,
  defaultEmployeeId,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [employeeId, setEmployeeId] = useState(
    canSelectEmployee ? (defaultEmployeeId ?? "") : ""
  );
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setFormError("Check-in message is required.");
      return;
    }

    const input: Record<string, unknown> = { message: trimmedMessage };
    if (canSelectEmployee && employeeId) {
      input.employee_id = employeeId;
    }

    try {
      await onSubmit(input);
      setMessage("");
      if (canSelectEmployee && defaultEmployeeId) setEmployeeId(defaultEmployeeId);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create check-in."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="create-check-in-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="create-check-in-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              New check-in
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
          {canSelectEmployee && (
            <div>
              <label
                htmlFor="check-in-employee"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Employee
              </label>
              <select
                id="check-in-employee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
              >
                <option value="">Select employee (defaults to your record)</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {employee.department ? ` · ${employee.department}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="check-in-message"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Message
            </label>
            <textarea
              id="check-in-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_CHECK_IN_MESSAGE_LENGTH}
              rows={5}
              placeholder="Write an ongoing performance discussion or feedback note..."
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 flex items-center justify-between text-[11px] text-muted">
              <span>
                {canSelectEmployee
                  ? "The employee and given-by identities are recorded server-side."
                  : "This check-in is recorded against your own employee record."}
              </span>
              <span className="tabular-nums">
                {message.length}/{MAX_CHECK_IN_MESSAGE_LENGTH}
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
              {submitting ? "Saving..." : "Add check-in"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}