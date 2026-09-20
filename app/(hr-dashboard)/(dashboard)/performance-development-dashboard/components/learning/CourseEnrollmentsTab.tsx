"use client";

import { useMemo, useState } from "react";
import { Plus, UserCheck } from "lucide-react";
import type {
  CourseEnrollment,
  CourseEnrollmentInput,
  EmployeeOption,
  UpdateCourseEnrollmentInput,
} from "@/performance-development-dashboard/types";
import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import { EnrollInCourseModal } from "@/performance-development-dashboard/components/learning/EnrollInCourseModal";
import { UpdateEnrollmentModal } from "@/performance-development-dashboard/components/learning/UpdateEnrollmentModal";

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

/** Neutral fallback for unknown/free-text status values stored in the schema. */
function statusBadge(status: string | null | undefined): {
  label: string;
  className: string;
} {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "bg-emerald-500/10 text-emerald-600",
      };
    case "in_progress":
      return {
        label: "In progress",
        className: "bg-amber-500/10 text-amber-600",
      };
    case "enrolled":
    case undefined:
    case null:
      return {
        label: "Enrolled",
        className: "bg-accent/10 text-accent",
      };
    default:
      return { label: status, className: "bg-line text-muted" };
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
      .sort(
        (a, b) =>
          a.enrolled_at.localeCompare(b.enrolled_at)
      );
  }, [enrollments, effectiveEmployeeId]);

  const selectedEmployeeName =
    employeeNamesById[effectiveEmployeeId ?? ""] ?? "Unknown employee";

  return (
    <div className="space-y-4">
      <FilterBar className="sm:justify-between">
          {isHrAdmin ? (
            <select
              value={effectiveEmployeeId ?? ""}
              onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-medium text-ink outline-none transition-colors focus:border-accent sm:max-w-[320px] dark:border-paper/15"
            >
              {employees.length === 0 && <option value="">No employees</option>}
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] font-medium text-ink sm:max-w-[320px] dark:border-paper/15">
              {selectedEmployeeName}
            </span>
          )}

          {isHrAdmin && (
            <button
              type="button"
              onClick={() => setEnrollOpen(true)}
              disabled={submitting || !effectiveEmployeeId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} strokeWidth={2} />
              Enroll in course
            </button>
          )}
      </FilterBar>

      {!effectiveEmployeeId ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <UserCheck size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            No employee selected
          </p>
        </div>
      ) : matching.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <UserCheck size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            No course enrollments yet
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {isHrAdmin
              ? `Enroll ${selectedEmployeeName} in a course to begin tracking their progress.`
              : "Your course enrollments will appear here once assigned by your performance team."}
          </p>
          {isHrAdmin && (
            <button
              type="button"
              onClick={() => setEnrollOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark"
            >
              <Plus size={15} strokeWidth={2} />
              Enroll in course
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10">
            <p className="text-[13px] font-medium text-ink">
              {selectedEmployeeName}
            </p>
            <span className="text-[12px] text-muted">
              · {matching.length} enrollment{matching.length === 1 ? "" : "s"}
            </span>
          </div>

          {matching.map((enrollment) => {
            const status = statusBadge(enrollment.status);
            return (
              <div
                key={enrollment.id}
                className="flex items-center gap-4 rounded-2xl border border-line bg-paper px-5 py-4 dark:border-paper/10"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-ink">
                      {courseTitlesById[enrollment.course_id] ??
                        "Unknown course"}
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
                            2,
                            Math.min(100, enrollment.progress_percent)
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-[12px] text-muted">
                      {Math.round(enrollment.progress_percent)}%
                    </span>
                  </div>

                  {enrollment.completed_at && (
                    <p className="text-[11.5px] text-muted">
                      Completed{" "}
                      {new Date(enrollment.completed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {isHrAdmin && (
                  <button
                    type="button"
                    onClick={() => setUpdating(enrollment)}
                    disabled={submitting}
                    className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
                  >
                    Update
                  </button>
                )}
              </div>
            );
          })}
        </div>
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