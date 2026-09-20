"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import type { BadgeInput, BadgeListItem } from "@/performance-development-dashboard/types";

type Props = {
  badge: BadgeListItem | null;
  submitting: boolean;
  onSubmit: (input: BadgeInput) => Promise<void>;
  onClose: () => void;
};

export function BadgeModal({ badge, submitting, onSubmit, onClose }: Props) {
  const [name, setName] = useState(badge?.name ?? "");
  const [description, setDescription] = useState(badge?.description ?? "");
  const [iconUrl, setIconUrl] = useState(badge?.icon_url ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = badge !== null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Badge name is required.");
      return;
    }

    const input: BadgeInput = {
      name: name.trim(),
      description: description.trim() || null,
      icon_url: iconUrl.trim() || null,
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
      labelledBy="badge-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development · Recognition &amp; Rewards
            </p>
            <h2
              id="badge-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {isEdit ? "Edit badge" : "Add badge"}
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
              htmlFor="badge-name"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Name
            </label>
            <input
              id="badge-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={submitting}
              placeholder="e.g. Team Player"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
            />
          </div>

          <div>
            <label
              htmlFor="badge-description"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Description <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="badge-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="What this badge recognizes"
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
            />
          </div>

          <div>
            <label
              htmlFor="badge-icon"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Icon URL or emoji <span className="text-muted">(optional)</span>
            </label>
            <input
              id="badge-icon"
              type="text"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              maxLength={500}
              disabled={submitting}
              placeholder="https://... or ⭐"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent disabled:opacity-50 dark:border-paper/15"
            />
            <p className="mt-1 text-[11px] text-muted">
              A URL renders as an image; anything else renders as text.
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
                : isEdit
                  ? "Save changes"
                  : "Add badge"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}