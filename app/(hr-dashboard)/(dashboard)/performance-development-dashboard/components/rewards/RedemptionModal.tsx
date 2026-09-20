"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type { EmployeeOption, RedemptionInput } from "@/performance-development-dashboard/types";
import {
  REWARDS_REDEMPTION_STATUS_SUGGESTIONS,
} from "@/performance-development-dashboard/types";
import { REWARDS_MAX_REWARD_DESCRIPTION_LENGTH } from "@/performance-development-dashboard/lib/constants";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";

type Props = {
  employees: EmployeeOption[];
  submitting: boolean;
  onSubmit: (input: RedemptionInput) => Promise<void>;
  onClose: () => void;
};

export function RedemptionModal({ employees, submitting, onSubmit, onClose }: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [pointsUsed, setPointsUsed] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [status, setStatus] = useState("pending");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!employeeId) {
      setFormError("Select the employee redeeming points.");
      return;
    }

    const pointsValue = Number(pointsUsed.trim());
    if (!Number.isInteger(pointsValue) || pointsValue < 0) {
      setFormError("Points used must be a whole number of 0 or more.");
      return;
    }
    if (!rewardDescription.trim()) {
      setFormError("Describe the reward being redeemed.");
      return;
    }

    const input: RedemptionInput = {
      employee_id: employeeId,
      points_used: pointsValue,
      reward_description: rewardDescription.trim(),
      status: status.trim() || "pending",
    };

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
      labelledBy="redemption-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development · Recognition &amp; Rewards
            </p>
            <h2
              id="redemption-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Log a redemption
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
              htmlFor="redemption-employee"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Employee
            </label>
            <select
              id="redemption-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting}
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
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="redemption-points"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Points used
              </label>
              <input
                id="redemption-points"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={pointsUsed}
                onChange={(e) => setPointsUsed(e.target.value)}
                disabled={submitting}
                placeholder="0"
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
              />
              <p className="mt-1 text-[11px] text-muted">
                Recorded only — the balance is adjusted separately.
              </p>
            </div>

            <div>
              <label
                htmlFor="redemption-status"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Status
              </label>
              <input
                id="redemption-status"
                type="text"
                list="redemption-status-suggestions"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
              />
              <datalist id="redemption-status-suggestions">
                {REWARDS_REDEMPTION_STATUS_SUGGESTIONS.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label
              htmlFor="redemption-description"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Reward
            </label>
            <textarea
              id="redemption-description"
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
              maxLength={REWARDS_MAX_REWARD_DESCRIPTION_LENGTH}
              rows={3}
              placeholder="e.g. Gift voucher, extra day off..."
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {rewardDescription.length}/
                {REWARDS_MAX_REWARD_DESCRIPTION_LENGTH}
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
              {submitting ? "Saving..." : "Log redemption"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}