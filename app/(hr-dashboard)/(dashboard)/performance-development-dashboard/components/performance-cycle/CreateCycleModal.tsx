"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type { CycleCreateInput } from "@/performance-development-dashboard/types";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";

type Props = {
  onClose: () => void;
  onSubmit: (input: CycleCreateInput) => Promise<void>;
};

export function CreateCycleModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setFieldError("Cycle name is required.");
      return;
    }
    if (!periodStart || !periodEnd) {
      setFieldError("Select both a start and an end date.");
      return;
    }
    if (periodStart > periodEnd) {
      setFieldError("Start date must be on or before the end date.");
      return;
    }

    setFieldError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmedName,
        period_start: periodStart,
        period_end: periodEnd,
      });
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Failed to create the cycle.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="create-cycle-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="create-cycle-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              New performance cycle
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

        <div className="mt-6 flex flex-col gap-4">
          <label className="block">
            <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Cycle name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. H2 2026 Performance Cycle"
              disabled={submitting}
              className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                Period start
              </span>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
              />
            </label>

            <label className="block">
              <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
                Period end
              </span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                disabled={submitting}
                className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
              />
            </label>
          </div>
        </div>

        {fieldError && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600">
            {fieldError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create cycle"}
          </button>
        </div>
      </div>
    </Modal>
  );
}