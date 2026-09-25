"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceTextInput,
} from "@/performance-development-dashboard/components/ui/performance";
import type { UpdatePositionCompetencyRequirementInput } from "@/performance-development-dashboard/types";

type Props = {
  competencyName: string;
  positionTitle: string;
  initialLevel: number;
  submitting: boolean;
  onSubmit: (input: UpdatePositionCompetencyRequirementInput) => Promise<void>;
  onClose: () => void;
};

export function EditRequirementLevelModal({
  competencyName,
  positionTitle,
  initialLevel,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [requiredLevel, setRequiredLevel] = useState(String(initialLevel));
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const level = Number(requiredLevel);
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      setFormError("Required level must be an integer between 1 and 5.");
      return;
    }

    try {
      await onSubmit({ required_level: level });
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to update the required level."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="edit-requirement-level-modal-title"
    >
      <PerformanceDialogPanel
        size="sm"
        labelledBy="edit-requirement-level-modal-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="edit-requirement-level-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Set required level
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
          <div className="rounded-xl border border-line px-4 py-3 dark:border-paper/15">
            <p className="text-[13.5px] font-medium text-ink">{competencyName}</p>
            <p className="text-[12px] text-muted">{positionTitle}</p>
          </div>

          <PerformanceField
            label="Required level"
            htmlFor="requirement-level"
            hint="The level (1-5) this position should expect."
          >
            <PerformanceTextInput
              id="requirement-level"
              type="number"
              min={1}
              max={5}
              step={1}
              value={requiredLevel}
              onChange={(e) => setRequiredLevel(e.target.value)}
              disabled={submitting}
            />
          </PerformanceField>

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
              {submitting ? "Saving..." : "Save level"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}
