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
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
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
  className: string;
} {
  if (item.gap === null) {
    return { label: "Not assigned", className: "bg-line text-muted" };
  }
  if (item.gap <= 0) {
    return { label: "Met", className: "bg-emerald-500/10 text-emerald-600" };
  }
  return {
    label: `Below by ${item.gap}`,
    className: "bg-amber-500/10 text-amber-600",
  };
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

  const maxLevel = useMemo(
    () =>
      matching.reduce(
        (max, item) => Math.max(max, item.current_level),
        1
      ),
    [matching]
  );

  const selectedPositionTitle = effectiveEmployeeId
    ? positionTitleForEmployee(
        effectiveEmployeeId,
        employeePositionById,
        positions
      )
    : null;

  return (
    <div className="space-y-4">
      <FilterBar className="sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
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

            {isHrAdmin ? (
              <select
                value={effectiveEmployeeId ?? ""}
                onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
                className="rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-medium text-ink outline-none transition-colors focus:border-accent dark:border-paper/15"
              >
                {employees.length === 0 && <option value="">No employees</option>}
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-medium text-ink dark:border-paper/15">
                {selectedEmployeeName}
              </span>
            )}
          </div>

          {isHrAdmin && (
            <button
              type="button"
              onClick={() => setAssessOpen(true)}
              disabled={submitting || !effectiveEmployeeId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} strokeWidth={2} />
              Assess competency
            </button>
          )}
      </FilterBar>

      {!effectiveEmployeeId ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <Award size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            No employee selected
          </p>
        </div>
      ) : matching.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <Award size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {search ? "No matching competencies" : "No assessments yet"}
          </p>
          {selectedPositionTitle && (
            <p className="max-w-sm text-[13px] text-muted">
              {selectedEmployeeName} · {selectedPositionTitle}
            </p>
          )}
          <p className="max-w-sm text-[13px] text-muted">
            {search
              ? "Try a different search term."
              : isHrAdmin
                ? "Record the first assessment to begin building this employee's competency profile."
                : "Your competency profile will appear here once your performance team records your first assessment."}
          </p>
          {isHrAdmin && !search && (
            <button
              type="button"
              onClick={() => setAssessOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              <Plus size={15} strokeWidth={2} />
              Record your first assessment
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10">
            <p className="text-[13px] font-medium text-ink">
              {selectedEmployeeName}
            </p>
            {selectedPositionTitle && (
              <span className="text-[12px] text-muted">
                · {selectedPositionTitle}
              </span>
            )}
          </div>

          {matching.map((item) => {
            const status = gapStatus(item);
            return (
              <div
                key={`${item.employee_id}:${item.competency_id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-ink">
                      {competenciesById[item.competency_id] ??
                        "Unknown competency"}
                    </p>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        status.className
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-line dark:bg-paper/10">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${Math.max(
                            10,
                            Math.min(100, (item.current_level / maxLevel) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-[12px] text-muted">
                      Level {item.current_level}
                    </span>
                  </div>

                  <p className="text-[11.5px] text-muted">
                    Required:{" "}
                    {item.effective_required_level === null
                      ? "Not assigned"
                      : item.required_level !== null
                        ? `Level ${item.required_level} (assessment-specific)`
                        : item.position_required_level !== null
                          ? `Level ${item.position_required_level} (position)`
                          : "Level unknown"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
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