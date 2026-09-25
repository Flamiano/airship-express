"use client";

import { useMemo, useState } from "react";
import { Award, Plus, Search } from "lucide-react";
import type {
  Competency,
  EmployeeCompetencyAssessmentInput,
  EmployeeCompetencyProfileItem,
  EmployeeOption,
  PositionOption,
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
import { AssessEmployeeModal } from "@/performance-development-dashboard/components/competencies/AssessEmployeeModal";

type Props = {
  profile: EmployeeCompetencyProfileItem[];
  employees: EmployeeOption[];
  positions: PositionOption[];
  competencies: Competency[];
  competenciesById: Record<string, string>;
  employeeNamesById: Record<string, string>;
  employeePositionById: Record<string, string | null>;
  isHrAdmin: boolean;
  currentUserEmployeeId: string | null;
  defaultEmployeeId: string | null;
  submitting?: boolean;
  onAssess: (input: EmployeeCompetencyAssessmentInput) => Promise<void>;
};

function positionTitleForEmployee(
  employeeId: string,
  employeePositionById: Record<string, string | null>,
  positions: PositionOption[]
): string | null {
  const positionId = employeePositionById[employeeId];
  if (!positionId) return null;
  return positions.find((position) => position.id === positionId)?.title ?? null;
}

function gapStatus(item: EmployeeCompetencyProfileItem): {
  label: string;
  tone: string;
} {
  if (item.gap === null) {
    return { label: "Not assigned", tone: "bg-line text-muted" };
  }
  if (item.gap <= 0) {
    return { label: "Met", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  }
  return {
    label: `Below by ${item.gap}`,
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
}

function requiredLabel(item: EmployeeCompetencyProfileItem): string {
  if (item.effective_required_level === null) return "Not assigned";
  if (item.required_level !== null) {
    return `Level ${item.required_level} (assessment-specific)`;
  }
  if (item.position_required_level !== null) {
    return `Level ${item.position_required_level} (position)`;
  }
  return "Level unknown";
}

export function EmployeeCompetenciesTab({
  profile,
  employees,
  positions,
  competencies,
  competenciesById,
  employeeNamesById,
  employeePositionById,
  isHrAdmin,
  currentUserEmployeeId,
  defaultEmployeeId,
  submitting,
  onAssess,
}: Props) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    defaultEmployeeId ?? currentUserEmployeeId
  );
  const [search, setSearch] = useState("");
  const [assessOpen, setAssessOpen] = useState(false);

  const effectiveEmployeeId =
    selectedEmployeeId ??
    (isHrAdmin ? employees[0]?.id ?? null : currentUserEmployeeId);

  const matching = useMemo(() => {
    if (!effectiveEmployeeId) return [];
    const query = search.trim().toLowerCase();
    return profile.filter((item) => {
      if (item.employee_id !== effectiveEmployeeId) return false;
      if (!query) return true;
      return (competenciesById[item.competency_id] ?? "")
        .toLowerCase()
        .includes(query);
    });
  }, [profile, effectiveEmployeeId, search, competenciesById]);

  const selectedEmployeeName =
    employeeNamesById[effectiveEmployeeId ?? ""] ?? "Unknown employee";

  const filtering = search.trim() !== "";

  const selectedPositionTitle = effectiveEmployeeId
    ? positionTitleForEmployee(
        effectiveEmployeeId,
        employeePositionById,
        positions
      )
    : null;

  return (
    <div className="space-y-4">
      <FilterBar>
        <label className="relative block w-full sm:max-w-[320px]">
          <span className="sr-only">Search profile</span>
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
          {isHrAdmin ? (
            <PerformanceSelect
              id="employee-profile-filter"
              aria-label="Filter by employee"
              value={effectiveEmployeeId ?? ""}
              onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
              className="sm:w-auto sm:max-w-[240px]"
            >
              {employees.length === 0 && <option value="">No employees</option>}
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </PerformanceSelect>
          ) : (
            <span className="rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-medium text-ink dark:border-paper/15">
              {selectedEmployeeName}
            </span>
          )}

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
            onClick={() => setAssessOpen(true)}
            disabled={submitting || !effectiveEmployeeId}
          >
            <Plus size={15} strokeWidth={2} />
            Assess competency
          </PerformanceButton>
        )}
      </FilterBar>

      {!effectiveEmployeeId ? (
        <PerformanceEmptyState
          icon={<Award size={22} strokeWidth={1.5} className="text-muted" />}
          title="No employee selected"
          message="Select an employee to view their competency profile."
        />
      ) : matching.length === 0 ? (
        <PerformanceEmptyState
          icon={<Award size={22} strokeWidth={1.5} className="text-muted" />}
          title={filtering ? "No matching competencies" : "No assessments yet"}
          message={
            filtering
              ? "Try a different search term."
              : isHrAdmin
                ? `Record the first assessment to begin building ${selectedEmployeeName}'s competency profile.`
                : "Your competency profile will appear here once your performance team records your first assessment."
          }
          action={
            isHrAdmin && !filtering ? (
              <PerformanceButton
                onClick={() => setAssessOpen(true)}
                className="mt-1"
              >
                <Plus size={15} strokeWidth={2} />
                Record your first assessment
              </PerformanceButton>
            ) : undefined
          }
        />
      ) : (
        <PerformancePanel>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-bricolage text-[17px] font-medium tracking-tight text-ink">
              {selectedEmployeeName}
            </p>
            {selectedPositionTitle && (
              <p className="text-[12px] text-muted">{selectedPositionTitle}</p>
            )}
          </div>
          <ul className="mt-4 divide-y divide-line dark:divide-paper/10">
            {matching.map((item) => {
              const status = gapStatus(item);
              return (
                <li
                  key={`${item.employee_id}:${item.competency_id}`}
                  className="py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                      {competenciesById[item.competency_id] ??
                        "Unknown competency"}
                    </p>
                    <PerformanceStatusBadge
                      tone={status.tone}
                      className="shrink-0"
                    >
                      {status.label}
                    </PerformanceStatusBadge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-full max-w-[220px]">
                      <PerformanceProgress
                        value={
                          (item.current_level / COMPETENCY_LEVEL_MAX) * 100
                        }
                        label={`Current level ${item.current_level} of ${COMPETENCY_LEVEL_MAX} for ${competenciesById[item.competency_id] ?? "competency"}`}
                      />
                    </div>
                    <span className="shrink-0 text-[12px] tabular-nums text-muted">
                      Level {item.current_level}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-muted">
                    Required: {requiredLabel(item)}
                  </p>
                </li>
              );
            })}
          </ul>
        </PerformancePanel>
      )}

      {assessOpen && effectiveEmployeeId && (
        <AssessEmployeeModal
          employees={employees}
          competencies={competencies}
          profile={profile}
          defaultEmployeeId={effectiveEmployeeId}
          submitting={submitting ?? false}
          onSubmit={async (input) => {
            await onAssess(input);
            setAssessOpen(false);
          }}
          onClose={() => setAssessOpen(false)}
        />
      )}
    </div>
  );
}
