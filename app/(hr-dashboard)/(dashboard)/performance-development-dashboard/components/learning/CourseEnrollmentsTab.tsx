"use client";

import { useMemo, useState } from "react";
import { Plus, UserCheck } from "lucide-react";
import type {
  CourseEnrollment,
  CourseEnrollmentInput,
  EmployeeOption,
  UpdateCourseEnrollmentInput,
} from "@/performance-development-dashboard/types";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import {
  PerformanceButton,
  PerformanceEmptyState,
  PerformancePanel,
  PerformanceProgress,
  PerformanceSelect,
  PerformanceStatusBadge,
} from "@/performance-development-dashboard/components/ui/performance";
import { EnrollInCourseModal } from "@/performance-development-dashboard/components/learning/EnrollInCourseModal";
import { UpdateEnrollmentModal } from "@/performance-development-dashboard/components/learning/UpdateEnrollmentModal";
import { formatDate } from "@/performance-development-dashboard/lib/format/date";

type Props = {
  enrollments: CourseEnrollment[];
  courses: { id: string; title: string }[];
  employees: EmployeeOption[];
  isHrAdmin: boolean;
  employeeNamesById: Record<string, string>;
  currentUserEmployeeId: string | null;
  defaultEmployeeId: string | null;
  submitting?: boolean;
  onCreate: (input: CourseEnrollmentInput) => Promise<void>;
  onUpdate: (id: string, input: UpdateCourseEnrollmentInput) => Promise<void>;
};

/** Tones mirror the previous pills; unknown free-text values stay neutral. */
function enrollmentTone(status: string | null | undefined): string {
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

function enrollmentLabel(status: string | null | undefined): string {
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

export function CourseEnrollmentsTab({
  enrollments,
  courses,
  employees,
  isHrAdmin,
  employeeNamesById,
  currentUserEmployeeId,
  defaultEmployeeId,
  submitting,
  onCreate,
  onUpdate,
}: Props) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    defaultEmployeeId ?? currentUserEmployeeId
  );
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [updating, setUpdating] = useState<CourseEnrollment | null>(null);

  const effectiveEmployeeId = isHrAdmin
    ? selectedEmployeeId ?? employees[0]?.id ?? null
    : currentUserEmployeeId;

  const courseTitlesById: Record<string, string> = {};
  for (const course of courses) {
    courseTitlesById[course.id] = course.title;
  }

  const matching = useMemo(() => {
    if (!effectiveEmployeeId) return [];
    return enrollments
      .filter((enrollment) => enrollment.employee_id === effectiveEmployeeId)
      .sort((a, b) => a.enrolled_at.localeCompare(b.enrolled_at));
  }, [enrollments, effectiveEmployeeId]);

  const selectedEmployeeName =
    employeeNamesById[effectiveEmployeeId ?? ""] ?? "Unknown employee";

  return (
    <div className="space-y-4">
      <FilterBar>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {isHrAdmin ? (
            <PerformanceSelect
              id="course-enrollment-employee-filter"
              aria-label="Select employee"
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
        </div>

        {isHrAdmin && (
          <PerformanceButton
            onClick={() => setEnrollOpen(true)}
            disabled={submitting || !effectiveEmployeeId}
          >
            <Plus size={15} strokeWidth={2} />
            Enroll in course
          </PerformanceButton>
        )}
      </FilterBar>

      {!effectiveEmployeeId ? (
        <PerformanceEmptyState
          icon={<UserCheck size={22} strokeWidth={1.5} className="text-muted" />}
          title="No employee selected"
          message="Select an employee to view their course enrollments."
        />
      ) : matching.length === 0 ? (
        <PerformanceEmptyState
          icon={<UserCheck size={22} strokeWidth={1.5} className="text-muted" />}
          title="No course enrollments yet"
          message={
            isHrAdmin
              ? `Enroll ${selectedEmployeeName} in a course to begin tracking their progress.`
              : "Your course enrollments will appear here once assigned by your performance team."
          }
          action={
            isHrAdmin ? (
              <PerformanceButton
                onClick={() => setEnrollOpen(true)}
                className="mt-1"
              >
                <Plus size={15} strokeWidth={2} />
                Enroll in course
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
            <p className="text-[12px] text-muted">
              {matching.length} enrollment{matching.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="mt-4 divide-y divide-line dark:divide-paper/10">
            {matching.map((enrollment) => (
              <li
                key={enrollment.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-[13.5px] font-medium text-ink">
                      {courseTitlesById[enrollment.course_id] ??
                        "Unknown course"}
                    </p>
                    <PerformanceStatusBadge
                      tone={enrollmentTone(enrollment.status)}
                      className="shrink-0"
                    >
                      {enrollmentLabel(enrollment.status)}
                    </PerformanceStatusBadge>
                  </div>
                  <div className="mt-2 flex max-w-[220px] items-center gap-2">
                    <div className="flex-1">
                      <PerformanceProgress
                        value={enrollment.progress_percent}
                        label={`Course progress ${Math.round(enrollment.progress_percent)}% for ${courseTitlesById[enrollment.course_id] ?? "course"}`}
                      />
                    </div>
                    <span className="shrink-0 text-[12px] tabular-nums text-muted">
                      {Math.round(enrollment.progress_percent)}%
                    </span>
                  </div>
                  {enrollment.completed_at && (
                    <p className="mt-1.5 text-[11.5px] text-muted">
                      Completed {formatDate(enrollment.completed_at)}
                    </p>
                  )}
                </div>
                {isHrAdmin && (
                  <button
                    type="button"
                    onClick={() => setUpdating(enrollment)}
                    disabled={submitting}
                    aria-label={`Update enrollment in ${courseTitlesById[enrollment.course_id] ?? "course"}`}
                    className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 sm:self-center dark:border-paper/15"
                  >
                    Update
                  </button>
                )}
              </li>
            ))}
          </ul>
        </PerformancePanel>
      )}

      {enrollOpen && effectiveEmployeeId && (
        <EnrollInCourseModal
          courses={courses}
          defaultEmployeeId={effectiveEmployeeId}
          employees={employees}
          submitting={submitting ?? false}
          onSubmit={async (input) => {
            await onCreate(input);
            setEnrollOpen(false);
          }}
          onClose={() => setEnrollOpen(false)}
        />
      )}

      {updating && (
        <UpdateEnrollmentModal
          enrollment={updating}
          courseTitle={courseTitlesById[updating.course_id] ?? "Unknown course"}
          submitting={submitting ?? false}
          onSubmit={async (input) => {
            await onUpdate(updating.id, input);
            setUpdating(null);
          }}
          onClose={() => setUpdating(null)}
        />
      )}
    </div>
  );
}
