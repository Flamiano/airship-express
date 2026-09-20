"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type { RedemptionListItem, UpdateRedemptionInput } from "@/performance-development-dashboard/types";
import {
  REWARDS_REDEMPTION_STATUS_SUGGESTIONS,
} from "@/performance-development-dashboard/types";
import { REWARDS_MAX_REWARD_DESCRIPTION_LENGTH } from "@/performance-development-dashboard/lib/constants";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";

type Props = {
  redemption: RedemptionListItem;
  submitting: boolean;
  onSubmit: (input: UpdateRedemptionInput) => Promise<void>;
  onClose: () => void;
};

export function ProcessRedemptionModal({ redemption, submitting, onSubmit, onClose }: Props) {
  const [status, setStatus] = useState(redemption.status);
  const [rewardDescription, setRewardDescription] = useState(
    redemption.reward_description ?? ""
  );
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!status.trim()) {
      setFormError("Status is required.");
      return;
    }

    const input: UpdateRedemptionInput = {
      status: status.trim(),
      reward_description: rewardDescription.trim() || null,
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
      labelledBy="process-redemption-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development · Recognition &amp; Rewards
            </p>
            <h2
              id="process-redemption-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Update redemption
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
          <div className="rounded-xl border border-line bg-accent/[0.04] px-4 py-3 dark:border-paper/15">
            <p className="text-[13px] font-medium text-ink">
              {redemption.employeeName}{" "}
              <span className="font-normal text-muted">
                · {redemption.points_used} points
              </span>
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              Requested{" "}
              {new Date(redemption.requested_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          <div>
            <label
              htmlFor="process-redemption-status"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Status
            </label>
            <input
              id="process-redemption-status"
              type="text"
              list="process-redemption-status-suggestions"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
            />
            <datalist id="process-redemption-status-suggestions">
              {REWARDS_REDEMPTION_STATUS_SUGGESTIONS.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <p className="mt-1 text-[11px] text-muted">
              Changing the status stamps the processed timestamp. The balance is
              never deducted automatically.
            </p>
          </div>

          <div>
            <label
              htmlFor="process-redemption-description"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Reward
            </label>
            <textarea
              id="process-redemption-description"
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
              maxLength={REWARDS_MAX_REWARD_DESCRIPTION_LENGTH}
              rows={3}
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
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