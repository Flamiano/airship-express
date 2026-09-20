"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import {
  Award,
  GitBranch,
  GraduationCap,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  User as UserIcon,
} from "lucide-react";
import { EmptyState } from "@/performance-development-dashboard/components/ui/EmptyState";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import type {
  CurrentPerDevUser,
  DevelopmentProfile,
  EmployeeOption,
  PerformanceGoalStatus,
} from "@/performance-development-dashboard/types";
import { PERFORMANCE_GOAL_STATUS_LABELS, PERFORMANCE_GOAL_STATUS_TONES } from "@/performance-development-dashboard/types";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { formatDate, formatDateOnly } from "@/performance-development-dashboard/lib/format/date";

const DEVELOPMENT_API = "/performance-development-dashboard/api/performance/development";

const EMPLOYEE_LISTBOX_ID = "development-employee-listbox";

const STATUS_PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

type Props = {
  serverUser: CurrentPerDevUser;
  employees: EmployeeOption[];
};

function courseStatusBadge(status: string | null | undefined): {
  label: string;
  className: string;
} {
  switch (status) {
    case "completed":
      return { label: "Completed", className: "bg-emerald-500/10 text-emerald-600" };
    case "in_progress":
      return { label: "In progress", className: "bg-amber-500/10 text-amber-600" };
    case "enrolled":
    case undefined:
    case null:
      return { label: "Enrolled", className: "bg-accent/10 text-accent" };
    default:
      return { label: status, className: "bg-line text-muted" };
  }
}

function approvalBadge(status: string | null | undefined): {
  label: string;
  className: string;
} {
  switch (status) {
    case "approved":
      return { label: "Approved", className: "bg-emerald-500/10 text-emerald-600" };
    case "pending":
      return { label: "Pending approval", className: "bg-amber-500/10 text-amber-600" };
    case "rejected":
      return { label: "Rejected", className: "bg-red-500/10 text-red-600" };
    default:
      return { label: status ?? "—", className: "bg-line text-muted" };
  }
}

function attendanceBadge(status: string | null | undefined): {
  label: string;
  className: string;
} {
  switch (status) {
    case "attended":
      return { label: "Attended", className: "bg-emerald-500/10 text-emerald-600" };
    case "absent":
      return { label: "Absent", className: "bg-red-500/10 text-red-600" };
    default:
      return { label: status ?? "—", className: "bg-line text-muted" };
  }
}

function goalStatusBadge(status: PerformanceGoalStatus): {
  label: string;
  className: string;
} {
  const tone =
    PERFORMANCE_GOAL_STATUS_TONES[status] ?? PERFORMANCE_GOAL_STATUS_TONES.not_started;
  const label = PERFORMANCE_GOAL_STATUS_LABELS[status] ?? status;
  return { label, className: tone };
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </span>
      <div>
        <h2 className="font-bricolage text-[15px] font-medium tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="text-[12px] text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

function CompetencyChip({ name }: { name: string }) {
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
  const goalTotal = profile?.goals.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
            Development Planning
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted">
            {`Hello ${firstName}. Review an employee's development needs, learning
            evidence, goals, and succession context. Everything on this page is
            read-only context — nothing here edits a score, goal, or record.`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (selectedEmployeeId) {
                setLoading(true);
                setError(null);
                loadProfile(selectedEmployeeId);
              }
            }}
            disabled={loading || !selectedEmployeeId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
          >
            <RefreshCw size={14} strokeWidth={1.75} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper px-4 py-4 dark:border-paper/10">
        <div>
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
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
          <span>Search by employee name or employee ID.</span>
        </div>

        {profile && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-accent/30 bg-accent/[0.04] px-4 py-3 dark:bg-accent/[0.08]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                Development Needs
              </p>
              <p className="mt-1 font-bricolage text-[28px] font-medium leading-none tracking-tight text-ink">
                {needsTotal}
              </p>
              <p className="mt-1 text-[12px] text-muted">Competency gaps</p>
            </div>

            <div className="rounded-xl border border-line bg-paper px-4 py-3 dark:border-paper/10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Performance Goals
              </p>
              <p className="mt-1 font-bricolage text-[28px] font-medium leading-none tracking-tight text-ink">
                {goalTotal}
              </p>
              <p className="mt-1 text-[12px] text-muted">Goals in this plan</p>
            </div>
          </div>
        )}
      </div>

      {!selectedEmployeeId && (
        <EmptyState message="Select an employee to review their development profile." />
      )}

      {loading && (
        <SkeletonList rows={3} />
      )}

      {!loading && error && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
          <p className="text-[13px] font-medium text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => {
              if (selectedEmployeeId) {
                setLoading(true);
                setError(null);
                loadProfile(selectedEmployeeId);
              }
            }}
            className="text-[12.5px] font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && profile && (
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
            <SectionHeading
              icon={<UserIcon size={17} strokeWidth={1.75} />}
              title="Employee Profile"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ProfileFact label="Employee number" value={profile.employee.employeeNumber ?? "—"} />
              <ProfileFact label="Department" value={profile.employee.department ?? "—"} />
              <ProfileFact label="Job position" value={profile.employee.jobPosition ?? "—"} />
              <ProfileFact label="Employee" value={profile.employee.name} />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
            <SectionHeading
              icon={<TrendingUp size={17} strokeWidth={1.75} />}
              title="Development Needs"
              subtitle="Competency gaps where the current level falls below the effective required level."
            />
            <div className="mt-4">
              {profile.developmentNeeds.length === 0 ? (
                <EmptyState message="No development needs for this employee yet." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {profile.developmentNeeds.map((need) => (
                    <li
                      key={need.competencyId}
                      className="flex flex-col gap-2 rounded-xl border border-line px-4 py-3 dark:border-paper/10 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {need.competencyName}
                        </p>
                        {need.competencyCategory && (
                          <p className="mt-0.5 text-[11.5px] text-muted">
                            {need.competencyCategory}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-[12px] text-muted">
                          Current {need.currentLevel} · Required{" "}
                          {need.effectiveRequiredLevel ?? "Not assigned"}
                        </span>
                        <span className={cn(STATUS_PILL, "bg-amber-500/10 text-amber-600")}>
                          Below by {need.gap}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
            <SectionHeading
              icon={<GraduationCap size={17} strokeWidth={1.75} />}
              title="Learning & Training Evidence"
              subtitle="Course and training enrollments are displayed as read-only context."
            />
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Course enrollments
                </p>
                {profile.learning.courseEnrollments.length === 0 ? (
                  <div className="mt-2">
                    <EmptyState message="No course enrollments for this employee yet." />
                  </div>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {profile.learning.courseEnrollments.map((enrollment) => {
                      const status = courseStatusBadge(enrollment.status);
                      return (
                        <li
                          key={enrollment.id}
                          className="flex flex-col gap-2 rounded-xl border border-line px-4 py-3 dark:border-paper/10 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">
                              {enrollment.courseTitle ?? "Untitled course"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {enrollment.competencyName && (
                                <CompetencyChip name={enrollment.competencyName} />
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
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-semibold tabular-nums text-ink">
                                {Math.round(enrollment.progress_percent)}%
                              </span>
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-line">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    enrollment.status === "completed"
                                      ? "bg-emerald-500"
                                      : "bg-accent"
                                  )}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(0, enrollment.progress_percent)
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <span className={cn(STATUS_PILL, status.className)}>
                              {status.label}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Training enrollments
                </p>
                {profile.learning.trainingEnrollments.length === 0 ? (
                  <div className="mt-2">
                    <EmptyState message="No training enrollments for this employee yet." />
                  </div>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {profile.learning.trainingEnrollments.map((enrollment) => {
                      const approval = approvalBadge(enrollment.approval_status);
                      const attendance = attendanceBadge(enrollment.attendance_status);
                      return (
                        <li
                          key={enrollment.id}
                          className="flex flex-col gap-2 rounded-xl border border-line px-4 py-3 dark:border-paper/10 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">
                              {enrollment.sessionTitle ?? "Untitled session"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {enrollment.competencyName && (
                                <CompetencyChip name={enrollment.competencyName} />
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
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn(
                                STATUS_PILL,
                                "capitalize",
                                approval.className
                              )}
                            >
                              {approval.label}
                            </span>
                            {enrollment.attendance_status && (
                              <span
                                className={cn(
                                  STATUS_PILL,
                                  "capitalize",
                                  attendance.className
                                )}
                              >
                                {attendance.label}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
            <SectionHeading
              icon={<Award size={17} strokeWidth={1.75} />}
              title="Certifications"
            />
            <div className="mt-4">
              {profile.learning.certifications.length === 0 ? (
                <EmptyState message="No certifications for this employee yet." />
              ) : (
                <ul className="flex flex-col gap-2">
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
                        className="flex flex-col gap-2 rounded-xl border border-line px-4 py-3 dark:border-paper/10 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {certification.courseTitle ?? "Untitled course"}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11.5px] text-muted">
                            <span>Issued {issued}</span>
                            <span className="text-line">|</span>
                            <span>Expires {expires}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
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
                            <span className={cn(STATUS_PILL, "bg-red-500/10 text-red-600")}>
                              Expired
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
            <SectionHeading
              icon={<Target size={17} strokeWidth={1.75} />}
              title="Performance Goals"
              subtitle="Current goals for this employee, shown as read-only context."
            />
            <div className="mt-4">
              {profile.goals.length === 0 ? (
                <EmptyState message="No performance goals for this employee yet." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {profile.goals.map((goal) => {
                    const status = goalStatusBadge(goal.status);
                    return (
                      <li
                        key={goal.id}
                        className="flex flex-col gap-2 rounded-xl border border-line px-4 py-3 dark:border-paper/10 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn(STATUS_PILL, status.className)}>
                              {status.label}
                            </span>
                            {goal.priority && (
                              <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                                {PRIORITY_LABELS[goal.priority] ?? goal.priority}
                              </span>
                            )}
                            {goal.category && (
                              <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-medium text-muted">
                                {goal.category}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 font-bricolage text-[16px] font-medium tracking-tight text-ink">
                            {goal.title}
                          </p>
                          {goal.description && (
                            <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted line-clamp-2">
                              {goal.description}
                            </p>
                          )}
                          {(goal.start_date || goal.due_date) && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                              <span>
                                {goal.start_date ? formatDateOnly(goal.start_date) : null}
                                {goal.start_date && goal.due_date ? " – " : ""}
                                {goal.due_date ? formatDateOnly(goal.due_date) : null}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[12px] font-semibold tabular-nums text-ink">
                            {goal.progress_percent}%
                          </span>
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-accent transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(0, goal.progress_percent))}%`,
                              }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {profile.succession && (
            <section className="rounded-2xl border border-line bg-paper p-5 dark:border-paper/10">
              <SectionHeading
                icon={<GitBranch size={17} strokeWidth={1.75} />}
                title="Succession Development Notes"
                subtitle="Notes recorded for this employee as a succession candidate."
              />
              <div className="mt-4 rounded-xl border border-line px-4 py-3 dark:border-paper/10">
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
            </section>
          )}
        </div>
      )}
    </div>
  );
}