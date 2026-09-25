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
  PerformanceTextInput,
  PerformanceTextarea,
} from "@/performance-development-dashboard/components/ui/performance";
import type { Competency, CompetencyCategory, CompetencyInput } from "@/performance-development-dashboard/types";
import { MAX_COMPETENCY_DESCRIPTION_LENGTH, MAX_COMPETENCY_NAME_LENGTH } from "@/performance-development-dashboard/lib/constants";

type Props = {
  competency: Competency | null;
  submitting: boolean;
  onSubmit: (input: CompetencyInput) => Promise<void>;
  onClose: () => void;
};

export function CreateEditCompetencyModal({
  competency,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [name, setName] = useState(competency?.name ?? "");
  const [category, setCategory] = useState<CompetencyCategory>(
    competency?.category ?? "technical"
  );
  const [description, setDescription] = useState(competency?.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Competency name is required.");
      return;
    }

    try {
      await onSubmit({
        name: trimmedName,
        category,
        description: description.trim() || null,
      });
      setName("");
      setDescription("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save competency."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="create-edit-competency-modal-title"
    >
      <PerformanceDialogPanel labelledBy="create-edit-competency-modal-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="create-edit-competency-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {competency ? "Edit competency" : "New competency"}
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
            <PerformanceField label="Name" htmlFor="competency-name">
              <PerformanceTextInput
                id="competency-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_COMPETENCY_NAME_LENGTH}
                placeholder="e.g. Package Handling"
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {name.length}/{MAX_COMPETENCY_NAME_LENGTH}
            </p>
          </div>

          <PerformanceField label="Category" htmlFor="competency-category">
            <PerformanceSelect
              id="competency-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as CompetencyCategory)
              }
              disabled={submitting}
            >
              <option value="technical">Technical</option>
              <option value="behavioral">Behavioral</option>
            </PerformanceSelect>
          </PerformanceField>

          <div>
            <PerformanceField
              label="Description"
              htmlFor="competency-description"
              optional
            >
              <PerformanceTextarea
                id="competency-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={MAX_COMPETENCY_DESCRIPTION_LENGTH}
                rows={4}
                placeholder="What does this competency mean in practice?"
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {description.length}/{MAX_COMPETENCY_DESCRIPTION_LENGTH}
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
              {submitting
                ? "Saving..."
                : competency
                  ? "Save changes"
                  : "Create competency"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}
