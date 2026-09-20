"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
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
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-xl dark:border-paper/15">
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
            <label
              htmlFor="course-title"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Title
            </label>
            <input
              id="course-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_COURSE_TITLE_LENGTH}
              placeholder="e.g. Warehouse Safety Fundamentals"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {title.length}/{MAX_COURSE_TITLE_LENGTH}
              </span>
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="course-duration"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Duration (minutes) <span className="text-muted">(optional)</span>
              </label>
              <input
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
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
              />
            </div>

            <div>
              <label
                htmlFor="course-competency"
                className="mb-1.5 block text-[12.5px] font-medium text-ink"
              >
                Linked competency{" "}
                <span className="text-muted">(optional, display-only)</span>
              </label>
              <select
                id="course-competency"
                value={competencyId}
                onChange={(e) => setCompetencyId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50 dark:border-paper/15"
              >
                <option value="">None</option>
                {competencyOptions.map((competency) => (
                  <option key={competency.id} value={competency.id}>
                    {competency.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="course-url"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Content URL <span className="text-muted">(optional)</span>
            </label>
            <input
              id="course-url"
              type="url"
              value={primaryContentUrl}
              onChange={(e) => setPrimaryContentUrl(e.target.value)}
              maxLength={MAX_COURSE_DESCRIPTION_LENGTH}
              placeholder="https://example.com/course/video"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
          </div>

          <div>
            <label
              htmlFor="course-description"
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
            >
              Description <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="course-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_COURSE_DESCRIPTION_LENGTH}
              rows={4}
              placeholder="What will the learner know after finishing this course?"
              className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
            <p className="mt-1 text-right text-[11px] text-muted">
              <span className="tabular-nums">
                {description.length}/{MAX_COURSE_DESCRIPTION_LENGTH}
              </span>
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
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : course
                  ? "Save changes"
                  : "Create course"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}