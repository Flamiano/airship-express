"use client";

import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import { LearningTag } from "@/performance-development-dashboard/components/learning/CourseCard";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceSectionHeader,
} from "@/performance-development-dashboard/components/ui/performance";
import type {
  Course,
  CourseEnrollment,
} from "@/performance-development-dashboard/types";

type Props = {
  course: Course;
  competencyName: string | null;
  /** Enrollments already loaded for the page (server-scoped). */
  enrollments: CourseEnrollment[];
  isHrAdmin: boolean;
  onEdit?: () => void;
  onClose: () => void;
};

/**
 * Read-only course detail. Presents only existing data: the catalog record,
 * its display-only competency reference, and the in-scope enrollment count.
 * No writes, no invented fields.
 */
export function CourseDetailDialog({
  course,
  competencyName,
  enrollments,
  isHrAdmin,
  onEdit,
  onClose,
}: Props) {
  const enrollmentCount = enrollments.filter(
    (enrollment) => enrollment.course_id === course.id
  ).length;

  return (
    <Modal
      onClose={onClose}
      closeDisabled={false}
      labelledBy="course-detail-dialog-title"
    >
      <PerformanceDialogPanel labelledBy="course-detail-dialog-title">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Course
            </p>
            <h2
              id="course-detail-dialog-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {course.title}
            </h2>
            {course.duration_minutes !== null &&
              course.duration_minutes !== undefined && (
                <p className="mt-1 text-[12.5px] tabular-nums text-muted">
                  {course.duration_minutes} min
                </p>
              )}
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
            <PerformanceSectionHeader eyebrow="Overview" title="Description" />
            {course.description ? (
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                {course.description}
              </p>
            ) : (
              <p className="mt-2 text-[13.5px] italic leading-relaxed text-muted/60">
                No description recorded for this course.
              </p>
            )}
            {course.primary_content_url && (
              <a
                href={course.primary_content_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block truncate text-[13px] font-medium text-accent hover:underline"
              >
                Open course content
              </a>
            )}
          </section>

          <section>
            <PerformanceSectionHeader
              eyebrow="Reference"
              title="Linked competency"
              description="A display-only reference. Completing this course never changes a competency level — those change only through an explicit HR assessment."
            />
            <div className="mt-2">
              {competencyName ? (
                <LearningTag name={competencyName} />
              ) : (
                <p className="text-[13px] leading-relaxed text-muted">
                  No competency linked.
                </p>
              )}
            </div>
          </section>

          <section>
            <PerformanceSectionHeader
              eyebrow="Enrollments"
              title="Enrollment context"
            />
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {enrollmentCount === 0
                ? "No enrollments recorded in scope."
                : enrollmentCount === 1
                  ? "1 enrollment recorded in scope."
                  : `${enrollmentCount} enrollments recorded in scope.`}
            </p>
          </section>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <PerformanceButton variant="ghost" onClick={onClose}>
            Close
          </PerformanceButton>
          {isHrAdmin && onEdit ? (
            <PerformanceButton onClick={onEdit}>Edit course</PerformanceButton>
          ) : null}
        </div>
      </PerformanceDialogPanel>
    </Modal>
  );
}
