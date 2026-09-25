"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceSelect,
} from "@/performance-development-dashboard/components/ui/performance";
import type { CourseEnrollmentInput, EmployeeOption } from "@/performance-development-dashboard/types";

type Props = {
  courses: { id: string; title: string }[];
  employees: EmployeeOption[];
  defaultEmployeeId: string;
  submitting: boolean;
  onSubmit: (input: CourseEnrollmentInput) => Promise<void>;
  onClose: () => void;
};

export function EnrollInCourseModal({
  courses,
  employees,
  defaultEmployeeId,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId);
  const [courseId, setCourseId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // New-enrollment selector: active employees only. Options without a status
  // carry no signal (e.g. scoped lists) and stay eligible; the server rejects
  // inactive employees independently so stale submissions still fail closed.
  const eligibleEmployees = employees.filter(
    (employee) => !employee.status || employee.status === "active"
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!courseId) {
      setFormError("Select a course to enroll in.");
      return;
    }

    try {
      await onSubmit({ employee_id: employeeId, course_id: courseId });
      setCourseId("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create enrollment."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="enroll-in-course-modal-title"
    >
      <PerformanceDialogPanel
        size="sm"
        labelledBy="enroll-in-course-modal-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="enroll-in-course-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              Enroll in course
            </h2>
          </div>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <PerformanceField label="Employee" htmlFor="enroll-employee">
            <PerformanceSelect
              id="enroll-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting}
            >
              {eligibleEmployees.length === 0 && (
                <option value="">No active employees</option>
              )}
              {eligibleEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </PerformanceSelect>
          </PerformanceField>

          <PerformanceField label="Course" htmlFor="enroll-course">
            <PerformanceSelect
              id="enroll-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={submitting}
            >
              <option value="">Select a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </PerformanceSelect>
          </PerformanceField>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[12.5px] font-medium text-red-600">
                {formError}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <PerformanceButton
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </PerformanceButton>
            <PerformanceButton
              type="submit"
              disabled={submitting || !courseId}
            >
              {submitting ? "Enrolling..." : "Enroll"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}
