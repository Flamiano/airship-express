"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  CriticalPositionInput,
  CriticalPositionListItem,
  JobPositionOption,
} from "@/performance-development-dashboard/types";
import {
  SUCCESSION_RISK_LEVEL_SUGGESTIONS,
} from "@/performance-development-dashboard/types";
import {
  SUCCESSION_MAX_REASON_LENGTH,
  SUCCESSION_MAX_RISK_LEVEL_LENGTH,
} from "@/performance-development-dashboard/lib/constants";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";

type Props = {
  position: CriticalPositionListItem | null;
  jobPositions: JobPositionOption[];
  submitting: boolean;
  onSubmit: (input: CriticalPositionInput) => Promise<void>;
  onClose: () => void;
};

export function CriticalPositionModal({
  position,
  jobPositions,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [positionId, setPositionId] = useState(position?.position_id ?? "");
  const [riskLevel, setRiskLevel] = useState(position?.risk_level ?? "");
  const [reason, setReason] = useState(position?.reason ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!positionId) {
      setFormError("Select the job position to mark as critical.");
      return;
    }

    const trimmedRisk = riskLevel.trim();
    if (!trimmedRisk) {
      setFormError("Risk level is required.");
      return;
    }

    const input: CriticalPositionInput = {
      position_id: positionId,
      risk_level: trimmedRisk,
      reason: reason.trim() || null,
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
      labelledBy="critical-position-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development · Succession planning
            </p>
            <h2
              id="critical-position-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {position ? "Edit critical position" : "New critical position"}
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
              htmlFor="critical-position"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Job position
            </label>
            <select
              id="critical-position"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              <option value="">Select a job position...</option>
              {jobPositions.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                  {job.isActive ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="critical-risk"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Risk level
            </label>
            <input
              id="critical-risk"
              type="text"
              list="critical-risk-suggestions"
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              maxLength={SUCCESSION_MAX_RISK_LEVEL_LENGTH}
              placeholder="e.g. medium"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <datalist id="critical-risk-suggestions">
              {SUCCESSION_RISK_LEVEL_SUGGESTIONS.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <p className="mt-1 text-[11px] text-muted">
              Free-text field — commonly used values are offered as suggestions
              but any value is allowed.
            </p>
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {riskLevel.length}/{SUCCESSION_MAX_RISK_LEVEL_LENGTH}
              </span>
            </p>
          </div>

          <div>
            <label
              htmlFor="critical-reason"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Reason <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="critical-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={SUCCESSION_MAX_REASON_LENGTH}
              rows={3}
              placeholder="Why is this position critical?"
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {reason.length}/{SUCCESSION_MAX_REASON_LENGTH}
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
                : position
                  ? "Save changes"
                  : "Add critical position"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}