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
  PerformanceTextInput,
  PerformanceTextarea,
} from "@/performance-development-dashboard/components/ui/performance";
import type { Course, CourseInput } from "@/performance-development-dashboard/types";
import { MAX_COURSE_DESCRIPTION_LENGTH, MAX_COURSE_TITLE_LENGTH } from "@/performance-development-dashboard/lib/constants";

type Props = {
  course: Course | null;
  competenciesById: Record<string, string>;
  submitting: boolean;
  onSubmit: (input: CourseInput) => Promise<void>;
  onClose: () => void;
};

export function CreateEditCourseModal({
  course,
  competenciesById,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [primaryContentUrl, setPrimaryContentUrl] = useState(
    course?.primary_content_url ?? ""
  );
  const [durationMinutes, setDurationMinutes] = useState(
    course?.duration_minutes ?? null
  );
  const [competencyId, setCompetencyId] = useState(
    course?.competency_id ?? ""
  );
  const [formError, setFormError] = useState<string | null>(null);

  const competencyOptions = Object.entries(competenciesById).map(
    ([id, name]) => ({ id, name })
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Course title is required.");
      return;
    }

    const submittedInput: CourseInput = {
      title: trimmedTitle,
      description: description.trim() || null,
      primary_content_url: primaryContentUrl.trim() || null,
      duration_minutes:
        durationMinutes === null || durationMinutes === undefined
          ? null
          : durationMinutes,
      competency_id: competencyId || null,
    };

    try {
      await onSubmit(submittedInput);
      setTitle("");
      setDescription("");
      setPrimaryContentUrl("");
      setDurationMinutes(null);
      setCompetencyId("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save course."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="create-edit-course-modal-title"
    >
      <PerformanceDialogPanel labelledBy="create-edit-course-modal-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="create-edit-course-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {course ? "Edit course" : "New course"}
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
          <div>
            <PerformanceField label="Title" htmlFor="course-title">
              <PerformanceTextInput
                id="course-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_COURSE_TITLE_LENGTH}
                placeholder="e.g. Warehouse Safety Fundamentals"
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {title.length}/{MAX_COURSE_TITLE_LENGTH}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <PerformanceField
              label="Duration (minutes)"
              htmlFor="course-duration"
              optional
            >
              <PerformanceTextInput
                id="course-duration"
                type="number"
                min={0}
                value={durationMinutes ?? ""}
                onChange={(e) =>
                  setDurationMinutes(
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                placeholder="60"
                disabled={submitting}
              />
            </PerformanceField>

            <PerformanceField
              label="Linked competency"
              htmlFor="course-competency"
              hint="Optional reference only — completing a course never changes a competency level."
            >
              <PerformanceSelect
                id="course-competency"
                value={competencyId}
                onChange={(e) => setCompetencyId(e.target.value)}
                disabled={submitting}
              >
                <option value="">None</option>
                {competencyOptions.map((competency) => (
                  <option key={competency.id} value={competency.id}>
                    {competency.name}
                  </option>
                ))}
              </PerformanceSelect>
            </PerformanceField>
          </div>

          <PerformanceField
            label="Content URL"
            htmlFor="course-url"
            optional
          >
            <PerformanceTextInput
              id="course-url"
              type="url"
              value={primaryContentUrl}
              onChange={(e) => setPrimaryContentUrl(e.target.value)}
              maxLength={MAX_COURSE_DESCRIPTION_LENGTH}
              placeholder="https://example.com/course/video"
              disabled={submitting}
            />
          </PerformanceField>

          <div>
            <PerformanceField
              label="Description"
              htmlFor="course-description"
              optional
            >
              <PerformanceTextarea
                id="course-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={MAX_COURSE_DESCRIPTION_LENGTH}
                rows={4}
                placeholder="What will the learner know after finishing this course?"
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {description.length}/{MAX_COURSE_DESCRIPTION_LENGTH}
            </p>
          </div>

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
            <PerformanceButton type="submit" disabled={submitting}>
              {submitting
                ? "Saving..."
                : course
                  ? "Save changes"
                  : "Create course"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}
