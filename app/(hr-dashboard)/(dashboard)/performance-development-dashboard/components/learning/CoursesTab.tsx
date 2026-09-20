"use client";

import { useMemo, useState } from "react";
import { BookOpen, Link2, Pencil, Plus, Search, Timer } from "lucide-react";
import type { Course, CourseInput } from "@/performance-development-dashboard/types";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import { CreateEditCourseModal } from "@/performance-development-dashboard/components/learning/CreateEditCourseModal";

type Props = {
  courses: Course[];
  competenciesById: Record<string, string>;
  isHrAdmin: boolean;
  submitting?: boolean;
  onCreate: (input: CourseInput) => Promise<void>;
  onUpdate: (id: string, input: CourseInput) => Promise<void>;
};

export function CoursesTab({
  courses,
  competenciesById,
  isHrAdmin,
  submitting,
  onCreate,
  onUpdate,
}: Props) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter(
      (course) =>
        course.title.toLowerCase().includes(query) ||
        (course.description ?? "").toLowerCase().includes(query)
    );
  }, [courses, search]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setModalOpen(true);
  }

  async function handleSubmit(input: CourseInput) {
    if (editing) {
      await onUpdate(editing.id, input);
    } else {
      await onCreate(input);
    }
    setModalOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <FilterBar className="sm:justify-between">
          <label className="relative block w-full sm:max-w-[320px]">
            <span className="sr-only">Search courses</span>
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses..."
              className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-accent dark:border-paper/15"
            />
          </label>

          {isHrAdmin && (
            <button
              type="button"
              onClick={openCreate}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} strokeWidth={2} />
              Add course
            </button>
          )}
      </FilterBar>

      {displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line px-6 py-14 text-center dark:border-paper/10">
          <BookOpen size={22} strokeWidth={1.5} className="text-muted" />
          <p className="font-bricolage text-[18px] font-medium tracking-tight text-ink">
            {search ? "No matching courses" : "No courses yet"}
          </p>
          <p className="max-w-sm text-[13px] text-muted">
            {search
              ? "Try a different search term."
              : isHrAdmin
                ? "Add courses to build the training catalog. Courses may link to a competency for reference (display-only)."
                : "The performance team has not published any courses yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((course) => {
            const competencyName = course.competency_id
              ? competenciesById[course.competency_id] ?? null
              : null;

            return (
              <div
                key={course.id}
                className="group flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5 dark:border-paper/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bricolage text-[16px] font-medium tracking-tight text-ink">
                      {course.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {competencyName && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                          <Link2 size={11} strokeWidth={2} />
                          {competencyName}
                        </span>
                      )}
                      {course.duration_minutes !== null &&
                        course.duration_minutes !== undefined && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.05] px-2.5 py-0.5 text-[11px] font-semibold text-muted dark:bg-paper/[0.08]">
                            <Timer size={11} strokeWidth={2} />
                            {course.duration_minutes} min
                          </span>
                        )}
                    </div>
                  </div>
                  {isHrAdmin && (
                    <Tooltip label="Edit course">
                      <button
                        type="button"
                        onClick={() => openEdit(course)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-accent"
                        aria-label={`Edit ${course.title}`}
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                    </Tooltip>
                  )}
                </div>

                {course.description ? (
                  <p className="text-[13px] leading-relaxed text-muted">
                    {course.description}
                  </p>
                ) : (
                  <p className="text-[13px] italic text-muted/60">
                    No description.
                  </p>
                )}

                {course.primary_content_url && (
                  <a
                    href={course.primary_content_url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[12.5px] font-medium text-accent hover:underline"
                  >
                    Open course content
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <CreateEditCourseModal
          course={editing}
          competenciesById={competenciesById}
          submitting={submitting ?? false}
          onSubmit={handleSubmit}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}