"use client";

import { useState } from "react";
import { Briefcase, Hash, Pencil, Trash2 } from "lucide-react";
import type { SuccessionCandidateListItem } from "@/performance-development-dashboard/types";
import {
  successionPotentialLabel,
  successionReadinessTone,
} from "@/performance-development-dashboard/types";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";

type Props = {
  candidate: SuccessionCandidateListItem;
  submitting: boolean;
  onEdit: (candidate: SuccessionCandidateListItem) => void;
  onRemove: (candidate: SuccessionCandidateListItem) => void;
};

export function CandidateCard({ candidate, submitting, onEdit, onRemove }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4 dark:border-paper/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-bricolage text-[15px] font-medium tracking-tight text-ink">
            {candidate.employeeName}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
            {candidate.employeeNumber && (
              <span className="inline-flex items-center gap-1">
                <Hash size={11} strokeWidth={2} />
                {candidate.employeeNumber}
              </span>
            )}
            {candidate.employeeJobPosition && (
              <span className="inline-flex items-center gap-1">
                <Briefcase size={11} strokeWidth={2} />
                {candidate.employeeJobPosition}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip label="Edit candidate">
            <button
              type="button"
              onClick={() => onEdit(candidate)}
              disabled={submitting}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-accent disabled:opacity-40"
              aria-label={`Edit ${candidate.employeeName}`}
            >
              <Pencil size={14} strokeWidth={1.75} />
            </button>
          </Tooltip>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onRemove(candidate);
                }}
                disabled={submitting}
                className="rounded-md bg-red-500/10 px-2 py-1 text-[11.5px] font-medium text-red-600 hover:bg-red-500/20"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="rounded-md px-2 py-1 text-[11.5px] font-medium text-muted hover:text-ink"
              >
                Cancel
              </button>
            </>
          ) : (
            <Tooltip label="Remove candidate">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={submitting}
                className="flex h-8 items-center justify-center rounded-md px-2 text-[12px] font-medium transition-colors disabled:opacity-40 text-muted hover:bg-red-500/10 hover:text-red-600"
                aria-label={`Remove ${candidate.employeeName}`}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${successionReadinessTone(
            candidate.readiness_level
          )}`}
        >
          {candidate.readiness_level || "Not set"}
        </span>
        <span className="inline-flex items-center rounded-full bg-ink/[0.05] px-2.5 py-0.5 text-[11px] font-semibold text-muted dark:bg-paper/[0.08]">
          Potential {successionPotentialLabel(candidate.potential_rating)}
        </span>
        {candidate.performance_rating !== null &&
          candidate.performance_rating !== undefined && (
            <span className="inline-flex items-center rounded-full bg-ink/[0.05] px-2.5 py-0.5 text-[11px] font-semibold text-muted dark:bg-paper/[0.08]">
              Perf {candidate.performance_rating}
            </span>
          )}
      </div>

      {candidate.development_notes ? (
        <p className="text-[12.5px] leading-relaxed text-muted">
          {candidate.development_notes}
        </p>
      ) : (
        <p className="text-[12.5px] italic text-muted/60">
          No development notes yet.
        </p>
      )}
    </div>
  );
}