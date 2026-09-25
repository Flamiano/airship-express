"use client";

import { useMemo, useState } from "react";
import { Briefcase, Plus, Search } from "lucide-react";
import type {
  Competency,
  PositionCompetencyRequirement,
  PositionCompetencyRequirementInput,
  PositionOption,
  UpdatePositionCompetencyRequirementInput,
} from "@/performance-development-dashboard/types";
import { COMPETENCY_LEVEL_MAX } from "@/performance-development-dashboard/types";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import {
  PerformanceButton,
  PerformanceEmptyState,
  PerformancePanel,
  PerformanceProgress,
  PerformanceSelect,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";
import { AssignCompetencyModal } from "@/performance-development-dashboard/components/competencies/AssignCompetencyModal";
import { EditRequirementLevelModal } from "@/performance-development-dashboard/components/competencies/EditRequirementLevelModal";

type Props = {
  requirements: PositionCompetencyRequirement[];
  competencies: Competency[];
  positions: PositionOption[];
  competenciesById: Record<string, string>;
  isHrAdmin: boolean;
  defaultPositionId: string | null;
  submitting?: boolean;
  onCreate: (input: PositionCompetencyRequirementInput) => Promise<void>;
  onUpdate: (
    id: string,
    input: UpdatePositionCompetencyRequirementInput
  ) => Promise<void>;
};

export function PositionRequirementsTab({
  requirements,
  competencies,
  positions,
  competenciesById,
  isHrAdmin,
  defaultPositionId,
  submitting,
  onCreate,
  onUpdate,
}: Props) {
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(
    defaultPositionId
  );
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<PositionCompetencyRequirement | null>(
    null
  );

  const effectivePositionId = selectedPositionId ?? positions[0]?.id ?? null;

  const matching = useMemo(() => {
    if (!effectivePositionId) return [];
    const query = search.trim().toLowerCase();
    return requirements.filter((requirement) => {
      if (requirement.position_id !== effectivePositionId) return false;
      if (!query) return true;
      return (competenciesById[requirement.competency_id] ?? "")
        .toLowerCase()
        .includes(query);
    });
  }, [requirements, effectivePositionId, search, competenciesById]);

  const selectedPosition = positions.find(
    (position) => position.id === effectivePositionId
  );

  const filtering = search.trim() !== "";

  async function handleAssign(input: PositionCompetencyRequirementInput) {
    await onCreate(input);
    setAssignOpen(false);
    setSelectedPositionId(input.position_id);
  }

  async function handleEditLevel(input: UpdatePositionCompetencyRequirementInput) {
    if (!editing) return;
    await onUpdate(editing.id, input);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <label className="relative block w-full sm:max-w-[320px]">
          <span className="sr-only">Search requirements</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search competencies..."
            className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
          />
        </label>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          <PerformanceSelect
            id="requirement-position-filter"
            aria-label="Filter by position"
            value={effectivePositionId ?? ""}
            onChange={(e) => setSelectedPositionId(e.target.value || null)}
            disabled={!isHrAdmin}
            className="sm:w-auto sm:max-w-[240px]"
          >
            {positions.length === 0 && <option value="">No positions</option>}
            {positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.title}
              </option>
            ))}
          </PerformanceSelect>

          {filtering && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-accent hover:underline"
            >
              Clear search
            </button>
          )}
        </div>

        {isHrAdmin && (
          <PerformanceButton
            onClick={() => setAssignOpen(true)}
            disabled={submitting || !effectivePositionId}
          >
            <Plus size={15} strokeWidth={2} />
            Assign competency
          </PerformanceButton>
        )}
      </FilterBar>

      {!effectivePositionId ? (
        <PerformanceEmptyState
          icon={<Briefcase size={22} strokeWidth={1.5} className="text-muted" />}
          title="No position available"
          message={
            isHrAdmin
              ? "Select a position to view its required levels."
              : "Your profile is not linked to a job position yet."
          }
        />
      ) : matching.length === 0 ? (
        <PerformanceEmptyState
          icon={<Briefcase size={22} strokeWidth={1.5} className="text-muted" />}
          title={filtering ? "No matching requirements" : "No requirements yet"}
          message={
            filtering
              ? "Try a different search term."
              : isHrAdmin
                ? "Assign competencies to set the levels this position should expect."
                : "Your position has no required competencies assigned yet."
          }
          action={
            isHrAdmin && !filtering ? (
              <PerformanceButton
                onClick={() => setAssignOpen(true)}
                className="mt-1"
              >
                <Plus size={15} strokeWidth={2} />
                Assign your first requirement
              </PerformanceButton>
            ) : undefined
          }
        />
      ) : (
        <PerformancePanel>
          {selectedPosition && (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="font-bricolage text-[17px] font-medium tracking-tight text-ink">
                {selectedPosition.title}
              </p>
              {selectedPosition.department && (
                <p className="text-[12px] text-muted">
                  {selectedPosition.department}
                </p>
              )}
            </div>
          )}
          <ul className="mt-4 divide-y divide-line dark:divide-paper/10">
            {matching.map((requirement) => (
              <li
                key={requirement.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-[13.5px] font-medium text-ink">
                      {competenciesById[requirement.competency_id] ??
                        "Unknown competency"}
                    </p>
                    <PerformanceStatusBadge
                      tone="bg-line text-muted"
                      className="shrink-0 tabular-nums"
                    >
                      Level {requirement.required_level} of {COMPETENCY_LEVEL_MAX}
                    </PerformanceStatusBadge>
                  </div>
                  <div className="mt-2 max-w-[280px]">
                    <PerformanceProgress
                      value={
                        (requirement.required_level / COMPETENCY_LEVEL_MAX) *
                        100
                      }
                      label={`Required level ${requirement.required_level} of ${COMPETENCY_LEVEL_MAX} for ${competenciesById[requirement.competency_id] ?? "competency"}`}
                    />
                  </div>
                </div>
                {isHrAdmin && (
                  <button
                    type="button"
                    onClick={() => setEditing(requirement)}
                    disabled={submitting}
                    aria-label={`Edit required level for ${competenciesById[requirement.competency_id] ?? "competency"}`}
                    className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 sm:self-center dark:border-paper/15"
                  >
                    Edit level
                  </button>
                )}
              </li>
            ))}
          </ul>
        </PerformancePanel>
      )}

      {assignOpen && effectivePositionId && (
        <AssignCompetencyModal
          positions={positions}
          competencies={competencies}
          requirements={requirements}
          defaultPositionId={effectivePositionId}
          submitting={submitting ?? false}
          onSubmit={handleAssign}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {editing && (
        <EditRequirementLevelModal
          competencyName={
            competenciesById[editing.competency_id] ?? "Unknown competency"
          }
          positionTitle={
            positions.find((position) => position.id === editing.position_id)
              ?.title ?? "Unknown position"
          }
          initialLevel={editing.required_level}
          submitting={submitting ?? false}
          onSubmit={handleEditLevel}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
