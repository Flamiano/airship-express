"use client";

import { useMemo, useState } from "react";
import { Briefcase, Pencil, Plus, Search } from "lucide-react";
import type {
  Competency,
  PositionCompetencyRequirement,
  PositionCompetencyRequirementInput,
  PositionOption,
  UpdatePositionCompetencyRequirementInput,
} from "@/performance-development-dashboard/types";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
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

function barWidth(level: number, max: number): string {
  return `${Math.max(10, Math.min(100, (level / max) * 100))}%`;
}

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

  const maxLevel = useMemo(
    () =>
      requirements.reduce(
        (max, requirement) => Math.max(max, requirement.required_level),
        1
      ),
    [requirements]
  );

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
      <FilterBar className="sm:justify-between">
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

          <div className="flex items-center gap-2">
            <select
              value={effectivePositionId ?? ""}
              onChange={(e) => setSelectedPositionId(e.target.value || null)}
              disabled={!isHrAdmin}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-medium text-ink outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-paper/15"
            >
              {positions.length === 0 && <option value="">No positions</option>}
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title}
                </option>
              ))}
            </select>

            {isHrAdmin && (
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                disabled={submitting || !effectivePositionId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} strokeWidth={2} />
                Assign competency
              </button>
            )}
          </div>
      </FilterBar>

      {!effectivePositionId ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <Briefcase size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            No position available
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {isHrAdmin
              ? "Select a position from the dropdown to view its required levels."
              : "Your profile is not linked to a job position yet."}
          </p>
        </div>
      ) : matching.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <Briefcase size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {search
              ? "No matching requirements"
              : "No requirements yet"}
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {search
              ? "Try a different search term."
              : isHrAdmin
                ? "Assign competencies to set the levels this position should expect."
                : "Your position has no required competencies assigned yet."}
          </p>
          {isHrAdmin && !search && (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              <Plus size={15} strokeWidth={2} />
              Assign your first requirement
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {selectedPosition && (
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10">
              <Briefcase size={16} strokeWidth={1.75} className="text-accent" />
              <p className="text-[13px] font-medium text-ink">
                {selectedPosition.title}
              </p>
              {selectedPosition.department && (
                <span className="text-[12px] text-muted">
                  · {selectedPosition.department}
                </span>
              )}
            </div>
          )}

          {matching.map((requirement) => (
            <div
              key={requirement.id}
              className="flex items-center gap-4 rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-ink">
                    {competenciesById[requirement.competency_id] ??
                      "Unknown competency"}
                  </p>
                  <span className="shrink-0 text-[12px] text-muted">
                    Level {requirement.required_level}
                  </span>
                </div>
                <div className="h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-line dark:bg-paper/10">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: barWidth(requirement.required_level, maxLevel) }}
                  />
                </div>
              </div>

              {isHrAdmin && (
                <Tooltip label="Edit required level">
                  <button
                    type="button"
                    onClick={() => setEditing(requirement)}
                    disabled={submitting}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Edit required level for ${competenciesById[requirement.competency_id]}`}
                  >
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
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