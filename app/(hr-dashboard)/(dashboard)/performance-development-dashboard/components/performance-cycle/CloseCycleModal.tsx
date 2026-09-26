"use client";

import { AlertCircle, Lock, X } from "lucide-react";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import type {
  PerformanceCycle,
  PerformanceCycleClosureReadiness,
} from "@/performance-development-dashboard/types";

type Props = {
  cycle: PerformanceCycle;
  /**
   * Populated only after the server rejects a close attempt with 409: the
   * authoritative reason this cycle cannot close yet. The pre-confirm view
   * explains consequences; it never invents readiness client-side.
   */
  closureReadiness: PerformanceCycleClosureReadiness | null;
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CloseCycleModal({
  cycle,
  closureReadiness,
  confirming,
  onClose,
  onConfirm,
}: Props) {
  const blocked =
    closureReadiness !== null && !closureReadiness.ready;

  return (
    <Modal
      onClose={onClose}
      closeDisabled={confirming}
      labelledBy="close-cycle-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="close-cycle-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {blocked ? "This cycle is not ready to close" : "Close cycle"}
            </h2>
          </div>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={confirming}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>

        <p className="mt-3 text-[13px] text-muted">{cycle.name}</p>

        {!blocked && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <Lock
              size={15}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <p className="text-[12.5px] leading-relaxed text-amber-700 dark:text-amber-400">
              Closing this cycle is terminal under the current system.
              Cycle-specific performance activity will be frozen, while
              historical records remain available. Employee acknowledgment
              of finalized appraisals may still occur afterward.
            </p>
          </div>
        )}

        {blocked && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
              <AlertCircle
                size={16}
                strokeWidth={2}
                className="shrink-0 text-red-600"
              />
              <p className="text-[12.5px] font-medium text-red-600">
                Resolve the blockers below before closing this cycle.
              </p>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Before closing
            </p>
            {closureReadiness.blockers.map((blocker) => (
              <div
                key={blocker.code}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5"
              >
                <p className="text-[12.5px] font-semibold text-red-600">
                  {blocker.label}
                  {blocker.count > 0 ? ` (${blocker.count})` : ""}
                </p>
                <p className="mt-0.5 text-[12.5px] text-red-600/90">
                  {blocker.description}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-[11.5px] text-muted">
          Readiness is based on records currently associated with this cycle.
        </p>

        <div className="mt-4 flex items-center justify-end gap-3">
          {blocked ? (
            <button
              type="button"
              onClick={onClose}
              disabled={confirming}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
            >
              Back
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={confirming}
                className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirming ? "Closing..." : "Close Cycle"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
