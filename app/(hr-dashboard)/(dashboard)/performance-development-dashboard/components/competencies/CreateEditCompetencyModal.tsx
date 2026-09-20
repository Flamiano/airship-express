"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
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
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
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
            <label
              htmlFor="competency-name"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Name
            </label>
            <input
              id="competency-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_COMPETENCY_NAME_LENGTH}
              placeholder="e.g. Package Handling"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {name.length}/{MAX_COMPETENCY_NAME_LENGTH}
              </span>
            </p>
          </div>

          <div>
            <label
              htmlFor="competency-category"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Category
            </label>
            <select
              id="competency-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as CompetencyCategory)
              }
              disabled={submitting}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
            >
              <option value="technical">Technical</option>
              <option value="behavioral">Behavioral</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="competency-description"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Description <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="competency-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_COMPETENCY_DESCRIPTION_LENGTH}
              rows={4}
              placeholder="What does this competency mean in practice?"
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {description.length}/{MAX_COMPETENCY_DESCRIPTION_LENGTH}
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
                : competency
                  ? "Save changes"
                  : "Create competency"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}