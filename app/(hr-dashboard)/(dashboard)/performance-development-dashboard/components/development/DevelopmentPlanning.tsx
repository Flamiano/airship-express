"use client";

import { useCallback, useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  RefreshCw,
  Search,
  User as UserIcon,
} from "lucide-react";
import { EmptyState } from "@/performance-development-dashboard/components/ui/EmptyState";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import {
  PerformanceButton,
  PerformanceEmptyState,
  PerformanceErrorBanner,
  PerformancePageHeader,
  PerformancePanel,
  PerformanceProgress,
  PerformanceSectionHeader,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";
import type {
  CurrentPerDevUser,
  DevelopmentProfile,
  EmployeeOption,
  PerformanceGoalStatus,
} from "@/performance-development-dashboard/types";
import { PERFORMANCE_GOAL_STATUS_LABELS, PERFORMANCE_GOAL_STATUS_TONES } from "@/performance-development-dashboard/types";
import { DEV_PLAN_ITEM_STATUS_LABELS } from "@/performance-development-dashboard/types";
import type { DevPlanItemStatus } from "@/performance-development-dashboard/types";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { formatDate, formatDateOnly } from "@/performance-development-dashboard/lib/format/date";

const DEVELOPMENT_API = "/performance-development-dashboard/api/performance/development";

const EMPLOYEE_LISTBOX_ID = "development-employee-listbox";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

type Props = {
  serverUser: CurrentPerDevUser;
  employees: EmployeeOption[];
};

/**
 * Status tones mirror the previous pills exactly — only the markup moves to
 * the shared badge. Labels are preserved verbatim.
 */
function courseStatusTone(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "in_progress":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "enrolled":
    case undefined:
    case null:
      return "bg-accent/10 text-accent";
    default:
      return "bg-line text-muted";
  }
}

function courseStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "enrolled":
    case undefined:
    case null:
      return "Enrolled";
    default:
      return status;
  }
}

function approvalTone(status: string | null | undefined): string {
  switch (status) {
    case "approved":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "pending":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "rejected":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-line text-muted";
  }
}

function approvalLabel(status: string | null | undefined): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending approval";
    case "rejected":
      return "Rejected";
    default:
      return status ?? "—";
  }
}

function attendanceTone(status: string | null | undefined): string {
  switch (status) {
    case "attended":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "absent":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-line text-muted";
  }
}

function attendanceLabel(status: string | null | undefined): string {
  switch (status) {
    case "attended":
      return "Attended";
    case "absent":
      return "Absent";
    default:
      return status ?? "—";
  }
}

function goalStatusTone(status: PerformanceGoalStatus): string {
  return (
    PERFORMANCE_GOAL_STATUS_TONES[status] ?? PERFORMANCE_GOAL_STATUS_TONES.not_started
  );
}

function goalStatusLabel(status: PerformanceGoalStatus): string {
  return PERFORMANCE_GOAL_STATUS_LABELS[status] ?? status;
}

/**
 * Tones mirror the appraisal workflow's development-action pills. Unknown
 * values stay neutral — the column is write-managed, not schema-constrained.
 */
function devActionTone(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "in_progress":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    default:
      return "bg-line text-muted";
  }
}

function devActionLabel(status: string): string {
  return (
    DEV_PLAN_ITEM_STATUS_LABELS[status as DevPlanItemStatus] ?? status
  );
}

/** Non-status tag (competency names, goal categories): never uppercased. */
function NeutralTag({ name }: { name: string }) {
  return (
    <span className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-muted dark:bg-paper/[0.08]">
      {name}
    </span>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 truncate text-[14px] font-medium text-ink">{value}</p>
    </div>
  );
}

export function DevelopmentPlanning({ serverUser, employees }: Props) {
  const firstName = serverUser.fullName.split(" ")[0];

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [profile, setProfile] = useState<DevelopmentProfile | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return employees;
    return employees.filter((employee) => employee.name.toLowerCase().includes(trimmed));
  }, [employees, query]);

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  const selectedEmployeeName = selectedEmployee?.name ?? null;

  const loadProfile = useCallback(async (employeeId: string) => {
    try {
      const response = await fetch(
        `${DEVELOPMENT_API}?employee_id=${encodeURIComponent(employeeId)}`,
        { credentials: "include" }
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          body && typeof body === "object" && "error" in body && body.error
            ? body.error
            : `Request failed with status ${response.status}`
        );
      }

      setProfile(body as DevelopmentProfile);
      setLoadedAt(Date.now());
    } catch (err) {
      setProfile(null);
      setLoadedAt(null);
      setError(err instanceof Error ? err.message : "Failed to load the development profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSelect(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    setQuery("");
    setDropdownOpen(false);
    setLoading(true);
    setError(null);
    loadProfile(employeeId);
  }

  function handleClear() {
    setSelectedEmployeeId(null);
    setQuery("");
    setProfile(null);
    setLoadedAt(null);
    setError(null);
    setLoading(false);
  }

  function handleRefresh() {
    if (selectedEmployeeId) {
      setLoading(true);
      setError(null);
      loadProfile(selectedEmployeeId);
    }
  }

  function handleComboboxKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (filteredEmployees.length === 0) break;
        if (!dropdownOpen) {
          setDropdownOpen(true);
          setActiveOptionIndex(0);
          break;
        }
        setActiveOptionIndex((current) =>
          current < 0 ? 0 : (current + 1) % filteredEmployees.length
        );
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (filteredEmployees.length === 0) break;
        if (!dropdownOpen) {
          setDropdownOpen(true);
          setActiveOptionIndex(filteredEmployees.length - 1);
          break;
        }
        setActiveOptionIndex((current) =>
          current <= 0 ? filteredEmployees.length - 1 : current - 1
        );
        break;
      }
      case "Home": {
        event.preventDefault();
        if (filteredEmployees.length === 0) break;
        setDropdownOpen(true);
        setActiveOptionIndex(0);
        break;
      }
      case "End": {
        event.preventDefault();
        if (filteredEmployees.length === 0) break;
        setDropdownOpen(true);
        setActiveOptionIndex(filteredEmployees.length - 1);
        break;
      }
      case "Enter": {
        event.preventDefault();
        if (
          dropdownOpen &&
          activeOptionIndex >= 0 &&
          filteredEmployees[activeOptionIndex]
        ) {
          handleSelect(filteredEmployees[activeOptionIndex].id);
        }
        break;
      }
      case "Escape": {
        event.preventDefault();
        setDropdownOpen(false);
        setActiveOptionIndex(-1);
        break;
      }
    }
  }

  const needsTotal = profile?.developmentNeeds.length ?? 0;
  const actionsTotal = profile?.developmentActions.length ?? 0;
  const goalTotal = profile?.goals.length ?? 0;

  return (
    <div className="space-y-6">
      <PerformancePageHeader
        title="Development Profile"
        description={`Hello ${firstName}. Review an employee's development needs, appraisal development actions, learning evidence, goals, and succession context. Everything on this page is read-only context — nothing here edits a score, goal, or record.`}
        actions={
          <PerformanceButton
            variant="ghost"
            onClick={handleRefresh}
            disabled={loading || !selectedEmployeeId}
          >
            <RefreshCw size={14} strokeWidth={1.75} className={loading ? "animate-spin" : ""} />
            Refresh
          </PerformanceButton>
        }
      />

      <FilterBar>
        <div className="w-full">
          <label
            htmlFor="development-employee-selector"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
          >
            Employee
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-muted dark:border-paper/15 sm:flex-1">
              {selectedEmployeeName ? (
                <>
                  <span className="min-w-0 truncate font-medium text-ink">
                    {selectedEmployeeName}
                    {selectedEmployee?.employeeIdNumber
                      ? ` (${selectedEmployee.employeeIdNumber})`
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <span className="text-muted">No employee selected</span>
              )}
            </div>

            <div className="relative w-full sm:min-w-0 sm:flex-1">
              <Search
                size={15}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="development-employee-selector"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
                aria-controls={dropdownOpen ? EMPLOYEE_LISTBOX_ID : undefined}
                aria-activedescendant={
                  dropdownOpen &&
                  activeOptionIndex >= 0 &&
                  filteredEmployees[activeOptionIndex]
                    ? `${EMPLOYEE_LISTBOX_ID}-option-${filteredEmployees[activeOptionIndex].id}`
                    : undefined
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveOptionIndex(-1);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() =>
                  setTimeout(() => {
                    setDropdownOpen(false);
                    setActiveOptionIndex(-1);
                  }, 120)
                }
                onKeyDown={handleComboboxKeyDown}
                placeholder="Search and select an employee..."
                className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
              />
              {dropdownOpen && (
              <div
                id={EMPLOYEE_LISTBOX_ID}
                role="listbox"
                aria-label="Employees"
                className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-paper shadow-lg dark:border-paper/15"
              >
                {filteredEmployees.length === 0 ? (
                  <p className="px-3 py-2 text-[12.5px] text-muted">No employees found.</p>
                ) : (
                  <div className="flex flex-col">
                    {filteredEmployees.map((employee, index) => (
                      <button
                        key={employee.id}
                        type="button"
                        id={`${EMPLOYEE_LISTBOX_ID}-option-${employee.id}`}
                        role="option"
                        aria-selected={employee.id === selectedEmployeeId}
                        onMouseDown={() => handleSelect(employee.id)}
                        onMouseEnter={() => setActiveOptionIndex(index)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors",
                          index === activeOptionIndex || employee.id === selectedEmployeeId
                            ? "bg-accent/10 text-ink"
                            : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-medium text-ink">
                            {employee.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {[employee.employeeIdNumber, employee.department]
                              .filter(Boolean)
                              .join(" · ") || "Active employee"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Search by employee name or employee ID.
          </p>
        </div>
      </FilterBar>

      {!selectedEmployeeId && !loading && !error && (
        <PerformanceEmptyState
          icon={<UserIcon size={22} strokeWidth={1.5} className="text-muted" />}
          title="No employee selected"
          message="Select an employee to review their development profile."
        />
      )}

      {loading && (
        <div aria-busy="true" role="status">
          <span className="sr-only">Loading development profile...</span>
          <SkeletonList rows={3} />
        </div>
      )}

      {!loading && error && (
        <PerformanceErrorBanner message={error} onRetry={handleRefresh} />
      )}

      {!loading && !error && profile && (
        <div className="flex flex-col gap-4">
          <PerformancePanel>
            <PerformanceSectionHeader
              eyebrow="Profile"
              title="Employee Profile"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ProfileFact label="Employee number" value={profile.employee.employeeNumber ?? "—"} />
              <ProfileFact label="Department" value={profile.employee.department ?? "—"} />
              <ProfileFact label="Job position" value={profile.employee.jobPosition ?? "—"} />
              <ProfileFact label="Employee" value={profile.employee.name} />
            </div>
          </PerformancePanel>

          <PerformancePanel>
            <PerformanceSectionHeader
              eyebrow="Gaps"
              title={needsTotal > 0 ? `Development Needs (${needsTotal})` : "Development Needs"}
              description="Competency gaps where the current level falls below the effective required level."
            />
            <div className="mt-4">
              {profile.developmentNeeds.length === 0 ? (
                <EmptyState message="No development needs for this employee yet." />
              ) : (
                <ul className="divide-y divide-line dark:divide-paper/10">
                  {profile.developmentNeeds.map((need) => (
                    <li
                      key={need.competencyId}
                      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {need.competencyName}
                        </p>
                        {need.competencyCategory && (
                          <p className="mt-0.5 text-[11.5px] capitalize text-muted">
                            {need.competencyCategory}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        <span className="text-[12px] tabular-nums text-muted">
                          Current {need.currentLevel} · Required{" "}
                          {need.effectiveRequiredLevel ?? "Not assigned"}
                        </span>
                        <PerformanceStatusBadge tone="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Below by {need.gap}
                        </PerformanceStatusBadge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PerformancePanel>

          <PerformancePanel>
            <PerformanceSectionHeader
              eyebrow="Follow-through"
              title={actionsTotal > 0 ? `Appraisal Development Actions (${actionsTotal})` : "Appraisal Development Actions"}
              description="Actions agreed in the employee's appraisals. Historical records — locked with their appraisal and shown here for follow-through, not edited here."
            />
            <div className="mt-4">
              {profile.developmentActions.length === 0 ? (
                <EmptyState message="No appraisal development actions recorded for this employee yet." />
              ) : (
                <ul className="divide-y divide-line dark:divide-paper/10">
                  {profile.developmentActions.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {item.action}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted">
                          Target: {item.target}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted">
                          {[
                            item.appraisalReviewPeriod ?? "Unknown review",
                            item.appraisalCycleName,
                            item.appraisalStatus
                              ? `Appraisal ${item.appraisalStatus.replace(/_/g, " ")}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        <span className="text-[12px] tabular-nums text-muted">
                          Updated {formatDate(item.updated_at)}
                        </span>
                        <PerformanceStatusBadge tone={devActionTone(item.status)}>
                          {devActionLabel(item.status)}
                        </PerformanceStatusBadge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PerformancePanel>

          <PerformancePanel>
            <PerformanceSectionHeader
              eyebrow="Learning"
              title="Learning & Training Evidence"
              description="Course and training enrollments are displayed as read-only context."
            />
            <div className="mt-4 flex flex-col gap-6">
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Course enrollments
                </p>
                {profile.learning.courseEnrollments.length === 0 ? (
                  <div className="mt-2">
                    <EmptyState message="No course enrollments for this employee yet." />
                  </div>
                ) : (
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line dark:divide-paper/10 dark:border-paper/15">
                    {profile.learning.courseEnrollments.map((enrollment) => (
                      <li
                        key={enrollment.id}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {enrollment.courseTitle ?? "Untitled course"}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            {enrollment.competencyName && (
                              <NeutralTag name={enrollment.competencyName} />
                            )}
                            <span className="text-[11.5px] text-muted">
                              Enrolled {formatDate(enrollment.enrolled_at)}
                            </span>
                            {enrollment.completed_at && (
                              <span className="text-[11.5px] text-muted">
                                · Completed {formatDate(enrollment.completed_at)}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex max-w-[280px] items-center gap-2">
                            <div className="flex-1">
                              <PerformanceProgress
                                value={enrollment.progress_percent}
                                label={`Course progress ${Math.round(enrollment.progress_percent)}% for ${enrollment.courseTitle ?? "course"}`}
                              />
                            </div>
                            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink">
                              {Math.round(enrollment.progress_percent)}%
                            </span>
                          </div>
                        </div>
                        <PerformanceStatusBadge
                          tone={courseStatusTone(enrollment.status)}
                          className="shrink-0 self-start sm:self-center"
                        >
                          {courseStatusLabel(enrollment.status)}
                        </PerformanceStatusBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Training enrollments
                </p>
                {profile.learning.trainingEnrollments.length === 0 ? (
                  <div className="mt-2">
                    <EmptyState message="No training enrollments for this employee yet." />
                  </div>
                ) : (
                  <ul className="mt-2 divide-y divide-line rounded-xl border border-line dark:divide-paper/10 dark:border-paper/15">
                    {profile.learning.trainingEnrollments.map((enrollment) => (
                      <li
                        key={enrollment.id}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {enrollment.sessionTitle ?? "Untitled session"}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {enrollment.competencyName && (
                              <NeutralTag name={enrollment.competencyName} />
                            )}
                            {enrollment.scheduleDate && (
                              <span className="text-[11.5px] text-muted">
                                {formatDate(enrollment.scheduleDate)}
                              </span>
                            )}
                            {enrollment.trainerName && (
                              <span className="text-[11.5px] text-muted">
                                by {enrollment.trainerName}
                              </span>
                            )}
                            {enrollment.mode && (
                              <span className="text-[11.5px] text-muted">{enrollment.mode}</span>
                            )}
                            {enrollment.venue && (
                              <span className="text-[11.5px] text-muted">{enrollment.venue}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <PerformanceStatusBadge tone={approvalTone(enrollment.approval_status)}>
                            {approvalLabel(enrollment.approval_status)}
                          </PerformanceStatusBadge>
                          {enrollment.attendance_status && (
                            <PerformanceStatusBadge tone={attendanceTone(enrollment.attendance_status)}>
                              {attendanceLabel(enrollment.attendance_status)}
                            </PerformanceStatusBadge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </PerformancePanel>

          <PerformancePanel>
            <PerformanceSectionHeader
              eyebrow="Credentials"
              title="Certifications"
            />
            <div className="mt-4">
              {profile.learning.certifications.length === 0 ? (
                <EmptyState message="No certifications for this employee yet." />
              ) : (
                <ul className="divide-y divide-line dark:divide-paper/10">
                  {profile.learning.certifications.map((certification) => {
                    const issued = formatDate(certification.issued_at);
                    const expires = formatDate(certification.expires_at);
                    const isExpired =
                      certification.expires_at &&
                      loadedAt !== null &&
                      new Date(`${certification.expires_at}T00:00:00Z`).getTime() < loadedAt;
                    return (
                      <li
                        key={certification.id}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {certification.courseTitle ?? "Untitled course"}
                          </p>
                          <p className="mt-1 text-[11.5px] text-muted">
                            Issued {issued} · Expires {expires}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {certification.certificate_url && (
                            <a
                              href={certification.certificate_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[12px] font-medium text-accent underline underline-offset-2 hover:text-accent-dark"
                            >
                              View certificate
                            </a>
                          )}
                          {isExpired && (
                            <PerformanceStatusBadge tone="bg-red-500/10 text-red-600 dark:text-red-400">
                              Expired
                            </PerformanceStatusBadge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </PerformancePanel>

          <PerformancePanel>
            <PerformanceSectionHeader
              eyebrow="Goals"
              title={goalTotal > 0 ? `Performance Goals (${goalTotal})` : "Performance Goals"}
              description="Current goals for this employee, shown as read-only context."
            />
            <div className="mt-4">
              {profile.goals.length === 0 ? (
                <EmptyState message="No performance goals for this employee yet." />
              ) : (
                <ul className="divide-y divide-line dark:divide-paper/10">
                  {profile.goals.map((goal) => (
                    <li key={goal.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PerformanceStatusBadge tone={goalStatusTone(goal.status)}>
                          {goalStatusLabel(goal.status)}
                        </PerformanceStatusBadge>
                        {goal.priority && (
                          <PerformanceStatusBadge tone="bg-line text-muted">
                            {PRIORITY_LABELS[goal.priority] ?? goal.priority}
                          </PerformanceStatusBadge>
                        )}
                        {goal.category && (
                          <NeutralTag name={goal.category} />
                        )}
                      </div>
                      <p className="mt-2 font-bricolage text-[16px] font-medium tracking-tight text-ink">
                        {goal.title}
                      </p>
                      {goal.description && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted">
                          {goal.description}
                        </p>
                      )}
                      {(goal.start_date || goal.due_date) && (
                        <p className="mt-2 text-[12px] text-muted">
                          {goal.start_date ? formatDateOnly(goal.start_date) : null}
                          {goal.start_date && goal.due_date ? " – " : ""}
                          {goal.due_date ? formatDateOnly(goal.due_date) : null}
                        </p>
                      )}
                      <div className="mt-2 flex max-w-[280px] items-center gap-2">
                        <div className="flex-1">
                          <PerformanceProgress
                            value={goal.progress_percent}
                            label={`Goal progress ${goal.progress_percent}% for ${goal.title}`}
                          />
                        </div>
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink">
                          {goal.progress_percent}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PerformancePanel>

          {profile.succession && (
            <PerformancePanel>
              <PerformanceSectionHeader
                eyebrow="Succession"
                title="Succession Development Notes"
                description="Notes recorded for this employee as a succession candidate."
              />
              <div className="mt-3 rounded-xl border border-line px-4 py-3 dark:border-paper/15">
                {profile.succession.developmentNotes ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                    {profile.succession.developmentNotes}
                  </p>
                ) : (
                  <p className="text-[13px] text-muted">
                    No development notes for this succession candidate yet.
                  </p>
                )}
              </div>
            </PerformancePanel>
          )}
        </div>
      )}
    </div>
  );
}
