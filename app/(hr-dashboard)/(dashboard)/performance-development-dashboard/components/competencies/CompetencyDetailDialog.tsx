"use client";

import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  COMPETENCY_CATEGORY_LABELS,
  COMPETENCY_CATEGORY_TONES,
} from "@/performance-development-dashboard/components/competencies/CompetencyCard";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceSectionHeader,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";
import type {
  Competency,
  PositionCompetencyRequirement,
  PositionOption,
} from "@/performance-development-dashboard/types";

type Props = {
  competency: Competency;
  /** Position requirements already loaded for the page (server-scoped). */
  requirements: PositionCompetencyRequirement[];
  positions: PositionOption[];
  isHrAdmin: boolean;
  onEdit?: () => void;
  onClose: () => void;
};

/**
 * Read-only competency detail. Presents only existing data: the library
 * record, the position requirements already in scope (the applicability
 * model), and the 1..5 level scale the schema enforces. No writes, no
 * invented fields.
 */
export function CompetencyDetailDialog({
  competency,
  requirements,
  positions,
  isHrAdmin,
  onEdit,
  onClose,
}: Props) {
  const categoryLabel =
    COMPETENCY_CATEGORY_LABELS[competency.category] ?? competency.category;
  const categoryTone =
    COMPETENCY_CATEGORY_TONES[competency.category] ?? "bg-line text-muted";

  const applicable = requirements.filter(
    (requirement) => requirement.competency_id === competency.id
  );

  return (
    <Modal
      onClose={onClose}
      closeDisabled={false}
      labelledBy="competency-detail-dialog-title"
    >
      <PerformanceDialogPanel labelledBy="competency-detail-dialog-title">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Competency
            </p>
            <h2
              id="competency-detail-dialog-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {competency.name}
            </h2>
            <div className="mt-2">
              <PerformanceStatusBadge tone={categoryTone}>
                {categoryLabel}
              </PerformanceStatusBadge>
            </div>
          </div>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <PerformanceSectionHeader
              eyebrow="Overview"
              title="Description"
            />
            {competency.description ? (
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                {competency.description}
              </p>
            ) : (
              <p className="mt-2 text-[13.5px] italic leading-relaxed text-muted/60">
                No description recorded for this competency.
              </p>
            )}
          </section>

          <section>
            <PerformanceSectionHeader
              eyebrow="Applicability"
              title="Position requirements"
              description="Positions expected to demonstrate this competency, with the level each position requires."
            />
            {applicable.length === 0 ? (
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                Not assigned to any position.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line dark:divide-paper/10 dark:border-paper/15">
                {applicable.map((requirement) => {
                  const position = positions.find(
                    (candidate) => candidate.id === requirement.position_id
                  );
                  return (
                    <li
                      key={requirement.id}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-ink">
                          {position?.title ?? "Unknown position"}
                        </p>
                        {position?.department ? (
                          <p className="truncate text-[12px] text-muted">
                            {position.department}
                          </p>
                        ) : null}
                      </div>
                      <PerformanceStatusBadge
                        tone="bg-line text-muted"
                        className="shrink-0 tabular-nums"
                      >
                        Level {requirement.required_level} of 5
                      </PerformanceStatusBadge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <PerformanceSectionHeader
              eyebrow="Evaluation"
              title="Level scale"
              description="Competency levels are recorded on the schema's 1 to 5 scale. Within appraisals, competencies contribute 40% of the final result."
            />
          </section>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <PerformanceButton variant="ghost" onClick={onClose}>
            Close
          </PerformanceButton>
          {isHrAdmin && onEdit ? (
            <PerformanceButton onClick={onEdit}>Edit competency</PerformanceButton>
          ) : null}
        </div>
      </PerformanceDialogPanel>
    </Modal>
  );
}
