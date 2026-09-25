"use client";

import { Eye, Pencil } from "lucide-react";
import type { Course } from "@/performance-development-dashboard/types";
import {
  PerformancePanel,
} from "@/performance-development-dashboard/components/ui/performance";

/**
 * Neutral tag for ordinary metadata (competency names). A status badge is
 * deliberately NOT used here: badges uppercase their content and imply a
 * lifecycle state, neither of which fits a competency reference.
 */
export function LearningTag({ name }: { name: string }) {
  return (
    <span className="rounded-full bg-ink/[0.05] px-2.5 py-0.5 text-[11px] font-medium text-muted dark:bg-paper/[0.08]">
      {name}
    </span>
  );
}

type Props = {
  course: Course;
  competencyName: string | null;
  isHrAdmin: boolean;
  onView: () => void;
  onEdit?: () => void;
};

/**
 * One course catalog card. Shows only course fields (title, description,
 * duration, competency reference, content link) — no invented statuses or
 * metrics.
 */
export function CourseCard({
  course,
  competencyName,
  isHrAdmin,
  onView,
  onEdit,
}: Props) {
  return (
    <PerformancePanel>
      <p className="min-w-0 font-bricolage text-[17px] font-medium tracking-tight text-ink">
        {course.title}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {competencyName && <LearningTag name={competencyName} />}
        {course.duration_minutes !== null &&
          course.duration_minutes !== undefined && (
            <span className="text-[12px] tabular-nums text-muted">
              {course.duration_minutes} min
            </span>
          )}
      </div>

      {course.description ? (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
          {course.description}
        </p>
      ) : (
        <p className="mt-2 text-[13px] italic leading-relaxed text-muted/60">
          No description.
        </p>
      )}

      {course.primary_content_url && (
        <a
          href={course.primary_content_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block truncate text-[12.5px] font-medium text-accent hover:underline"
        >
          Open course content
        </a>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
        >
          <Eye size={13} strokeWidth={1.75} aria-hidden="true" />
          View
        </button>
        {isHrAdmin && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${course.title}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-ink dark:border-paper/15"
          >
            <Pencil size={13} strokeWidth={1.75} aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </div>
    </PerformancePanel>
  );
}
