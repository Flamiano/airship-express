"use client";

import { useMemo, useState } from "react";
import { BookOpen, Plus, Search } from "lucide-react";
import type {
  Course,
  CourseEnrollment,
  CourseInput,
} from "@/performance-development-dashboard/types";
import { FilterBar } from "@/performance-development-dashboard/components/ui/FilterBar";
import {
  PerformanceButton,
  PerformanceEmptyState,
} from "@/performance-development-dashboard/components/ui/performance";
import { CourseCard } from "@/performance-development-dashboard/components/learning/CourseCard";
import { CourseDetailDialog } from "@/performance-development-dashboard/components/learning/CourseDetailDialog";
import { CreateEditCourseModal } from "@/performance-development-dashboard/components/learning/CreateEditCourseModal";

type Props = {
  courses: Course[];
  competenciesById: Record<string, string>;
  enrollments: CourseEnrollment[];
  isHrAdmin: boolean;
  submitting?: boolean;
  onCreate: (input: CourseInput) => Promise<void>;
  onUpdate: (id: string, input: CourseInput) => Promise<void>;
};

export function CoursesTab({
  courses,
  competenciesById,
  enrollments,
  isHrAdmin,
  submitting,
  onCreate,
  onUpdate,
}: Props) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [viewing, setViewing] = useState<Course | null>(null);

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter(
      (course) =>
        course.title.toLowerCase().includes(query) ||
        (course.description ?? "").toLowerCase().includes(query)
    );
  }, [courses, search]);

  const filtering = search.trim() !== "";

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(course: Course) {
    setViewing(null);
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
      <FilterBar>
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

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {filtering && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-accent hover:underline"
            >
              Clear search
            </button>
          )}
        </div>

        {isHrAdmin && (
          <PerformanceButton onClick={openCreate} disabled={submitting}>
            <Plus size={15} strokeWidth={2} />
            Add course
          </PerformanceButton>
        )}
      </FilterBar>

      {displayed.length === 0 ? (
        <PerformanceEmptyState
          icon={<BookOpen size={22} strokeWidth={1.5} className="text-muted" />}
          title={filtering ? "No matching courses" : "No courses yet"}
          message={
            filtering
              ? "Try a different search term."
              : isHrAdmin
                ? "Add courses to build the training catalog. Courses may link to a competency for reference (display-only)."
                : "The performance team has not published any courses yet."
          }
          action={
            isHrAdmin && !filtering ? (
              <PerformanceButton onClick={openCreate} className="mt-1">
                <Plus size={15} strokeWidth={2} />
                Add your first course
              </PerformanceButton>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {displayed.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              competencyName={
                course.competency_id
                  ? (competenciesById[course.competency_id] ?? null)
                  : null
              }
              isHrAdmin={isHrAdmin}
              onView={() => setViewing(course)}
              onEdit={isHrAdmin ? () => openEdit(course) : undefined}
            />
          ))}
        </div>
      )}

      {viewing && (
        <CourseDetailDialog
          course={viewing}
          competencyName={
            viewing.competency_id
              ? (competenciesById[viewing.competency_id] ?? null)
              : null
          }
          enrollments={enrollments}
          isHrAdmin={isHrAdmin}
          onEdit={isHrAdmin ? () => openEdit(viewing) : undefined}
          onClose={() => setViewing(null)}
        />
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
