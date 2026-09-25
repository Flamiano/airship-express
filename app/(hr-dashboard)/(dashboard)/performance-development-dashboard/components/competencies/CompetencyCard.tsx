"use client";

import { Eye, Pencil } from "lucide-react";
import type {
  Competency,
  PositionCompetencyRequirement,
  PositionOption,
} from "@/performance-development-dashboard/types";
import {
  PerformancePanel,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";

export const COMPETENCY_CATEGORY_TONES: Record<string, string> = {
  technical: "bg-accent/10 text-accent",
  behavioral: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

export const COMPETENCY_CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
};

type Props = {
  competency: Competency;
  /** Position requirements already loaded for the page (server-scoped). */
  requirements: PositionCompetencyRequirement[];
  positions: PositionOption[];
  isHrAdmin: boolean;
  onView: () => void;
  onEdit?: () => void;
};

/**
 * One competency library card. Shows only library fields (name, description,
 * category) plus derived applicability already in scope — no invented
 * statuses, levels, or metadata.
 */
export function CompetencyCard({
  competency,
  requirements,
  positions,
  isHrAdmin,
  onView,
  onEdit,
}: Props) {
  const categoryLabel =
    COMPETENCY_CATEGORY_LABELS[competency.category] ?? competency.category;
  const categoryTone =
    COMPETENCY_CATEGORY_TONES[competency.category] ?? "bg-line text-muted";

  const applicable = requirements.filter(
    (requirement) => requirement.competency_id === competency.id
  );
  const positionTitles = applicable
    .map(
      (requirement) =>
        positions.find((position) => position.id === requirement.position_id)
          ?.title
    )
    .filter((title): title is string => !!title);

  const scopeLabel =
    positionTitles.length === 0
      ? "Not assigned to any position"
      : positionTitles.length <= 2
        ? positionTitles.join(" · ")
        : `${positionTitles.slice(0, 2).join(" · ")} +${positionTitles.length - 2} more`;

  return (
    <PerformancePanel>
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 flex-1 font-bricolage text-[17px] font-medium tracking-tight text-ink">
          {competency.name}
        </p>
        <PerformanceStatusBadge tone={categoryTone} className="shrink-0">
          {categoryLabel}
        </PerformanceStatusBadge>
      </div>

      {competency.description ? (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
          {competency.description}
        </p>
      ) : (
        <p className="mt-2 text-[13px] italic leading-relaxed text-muted/60">
          No description.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 truncate text-[12px] text-muted">{scopeLabel}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onView}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
          >
            <Eye size={13} strokeWidth={1.75} aria-hidden="true" />
            View
          </button>
          {isHrAdmin && onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${competency.name}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
            >
              <Pencil size={13} strokeWidth={1.75} aria-hidden="true" />
              Edit
            </button>
          ) : null}
        </div>
      </div>
    </PerformancePanel>
  );
}
