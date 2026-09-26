"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Chip,
  DataTable,
  DataTableRow,
  EmptyState,
  Modal,
  PageHeader,
  ProgressBar,
  SkeletonCards,
  SkeletonRegion,
  SkeletonStats,
  StatCard,
  TableActions,
  TableCell,
  controlSmallClass,
  errorTextClass,
  inputClass,
  selectClass,
  sectionTitleClass,
  textareaClass,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/components/ui";
import { useHrAuth } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/hr-auth";
import { useDirectory } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/directory";
import { useApiResource, useApiMutation } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/use-api";
import { ApiError } from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/lib/api-error";
import { BookOpen, Eye, Pencil, Sparkles, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Course = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  competency_id: string | null;
  hr3_competencies: { name: string } | null;
};

type Enrollment = {
  id: string;
  employee_id: string | null;
  course_id: string | null;
  status: string;
  progress_percent: number | null;
  completed_at: string | null;
  hr3_courses: { title: string } | null;
};

type Competency = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
};

type Score = {
  id: string;
  employee_id: string | null;
  competency_id: string | null;
  current_level: number;
  required_level: number | null;
};

const ENROLLMENT_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const ENROLLMENT_FILTERS = ["all", "not_started", "in_progress", "completed"] as const;

type EnrollmentFilter = (typeof ENROLLMENT_FILTERS)[number];

function enrollmentLabel(status: string) {
  return ENROLLMENT_LABELS[status] ?? status;
}

function enrollmentVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "in_progress") return "warning";
  return "neutral";
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "Self-paced";
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} hr`;
  return `${minutes} min`;
}

function EnrollmentDetailsModal({
  enrollment,
  onSaved,
}: {
  enrollment: Enrollment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [progress, setProgress] = useState(
    enrollment.progress_percent ?? 0
  );
  const [status, setStatus] = useState(enrollment.status);

  const updateEnrollment = useApiMutation({
    path: "enrollments",
    method: "PUT",
    onSuccess: () => {
      onSaved();
      toast.success("Progress updated successfully.");
    },
  });

  const isCompleted = status === "completed";

  async function handleSave() {
    const nextStatus =
      progress >= 100
        ? "completed"
        : status === "not_started" && progress > 0
          ? "in_progress"
          : status;
    const { error: submitError } = await updateEnrollment.submit({
      id: enrollment.id,
      progress_percent: progress,
      status: nextStatus,
    });
    if (submitError) {
      toast.error("Failed to update progress. Please try again.");
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium text-ink dark:text-paper">
          {enrollment.hr3_courses?.title ?? "Course"}
        </h3>
        <Badge variant={enrollmentVariant(enrollment.status)}>
          {enrollmentLabel(enrollment.status)}
        </Badge>
      </div>
      <div className="mb-2 flex items-center gap-3">
        <ProgressBar
          value={progress}
          label={`Progress for ${enrollment.hr3_courses?.title}`}
          className="flex-1"
        />
        <span className="w-10 shrink-0 text-right text-xs text-muted">
          {progress}%
        </span>
      </div>
      {!isCompleted && (
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          aria-label={`Progress for ${enrollment.hr3_courses?.title}`}
          className="w-full accent-accent"
        />
      )}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Status
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Enrollment status"
            className={controlSmallClass}
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <Button
          onClick={handleSave}
          loading={updateEnrollment.submitting}
          disabled={progress === (enrollment.progress_percent ?? 0) && status === enrollment.status}
        >
          Save
        </Button>
      </div>
    </>
  );
}

function AssignForm({ courses, onAssigned, onClose }: { courses: Course[]; onAssigned: () => void; onClose: () => void }) {
  const { directory } = useDirectory();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [courseId, setCourseId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const enrollMutation = useApiMutation({
    path: "enrollments",
    method: "POST",
  });

  const filteredEmployees = employeeSearch.trim()
    ? directory.filter((u) =>
        u.name.toLowerCase().includes(employeeSearch.trim().toLowerCase()) ||
        u.jobTitle.toLowerCase().includes(employeeSearch.trim().toLowerCase())
      )
    : directory;

  function toggleEmployee(id: string) {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setSelectedEmployees(filteredEmployees.map((u) => u.id));
  }

  function clearAll() {
    setSelectedEmployees([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEmployees.length === 0 || !courseId) {
      toast.error("Choose at least one employee and a course.");
      return;
    }
    setSubmitting(true);

    const results = await Promise.allSettled(
      selectedEmployees.map((employeeId) =>
        enrollMutation.submit({ employee_id: employeeId, course_id: courseId })
      )
    );

    setSubmitting(false);

    const succeeded = results.filter((r) => r.status === "fulfilled" && !(r as PromiseFulfilledResult<{ error: unknown }>).value.error).length;
    const failed = results.length - succeeded;
    const duplicates = results.filter(
      (r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<{ error: unknown }>).value.error instanceof ApiError && (r as PromiseFulfilledResult<{ error: { code: string } }>).value.error.code === "CONFLICT"
    ).length;

    setSelectedEmployees([]);
    setEmployeeSearch("");
    setCourseId("");
    onAssigned();

    if (failed === 0) {
      toast.success(`Course assigned to ${succeeded} employee${succeeded !== 1 ? "s" : ""}.`);
    } else {
      const duplicateMsg = duplicates > 0 ? ` (${duplicates} already enrolled)` : "";
      toast.success(`${succeeded} assigned, ${failed} failed${duplicateMsg}.`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required aria-label="Select course" className={selectClass}>
        <option value="" disabled>Select course</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.title}</option>
        ))}
      </select>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Select Employees ({selectedEmployees.length})</span>
        <div className="flex gap-2">
          <button type="button" onClick={selectAll} className="text-xs text-accent hover:underline">Select all</button>
          <button type="button" onClick={clearAll} className="text-xs text-muted hover:text-underline">Clear</button>
        </div>
      </div>
      <input
        type="text"
        placeholder="Search employees..."
        aria-label="Search employees"
        value={employeeSearch}
        onChange={(e) => setEmployeeSearch(e.target.value)}
        className={`${inputClass} text-sm`}
      />
      <div className="max-h-48 overflow-y-auto rounded-lg border border-line dark:border-paper/15">
        {filteredEmployees.length === 0 ? (
          <p className="p-3 text-xs text-muted">
            No employees match &ldquo;{employeeSearch}&rdquo;
          </p>
        ) : (
          <div className="flex flex-col">
            {filteredEmployees.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b border-line last:border-0 dark:border-paper/15 hover:bg-accent/[0.04] ${selectedEmployees.includes(u.id) ? "bg-accent/[0.06]" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedEmployees.includes(u.id)}
                  onChange={() => toggleEmployee(u.id)}
                  aria-label={`Select ${u.name}`}
                  className="h-4 w-4 shrink-0 rounded border-line accent-accent"
                />
                <span className="flex-1 truncate text-ink dark:text-paper">{u.name}</span>
                {u.jobTitle && <span className="shrink-0 text-xs text-muted">{u.jobTitle}</span>}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={submitting}>
          {submitting ? "Assigning…" : `Assign to ${selectedEmployees.length || ""} Employee${selectedEmployees.length !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </form>
  );
}

function CourseForm({ competencies, onCreated, onClose }: { competencies: Competency[]; onCreated: () => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [competencyId, setCompetencyId] = useState("");

  const createCourse = useApiMutation({
    path: "courses",
    method: "POST",
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setDuration("");
      setCompetencyId("");
      onCreated();
      toast.success("Course created successfully.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: submitError } = await createCourse.submit({
      title,
      description,
      duration_minutes: duration ? parseInt(duration) : null,
      competency_id: competencyId || null,
    });
    if (submitError) {
      toast.error("Failed to create course. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="text" placeholder="Title (e.g. Safe Parcel Handling)" aria-label="Course title" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
      <textarea placeholder="Description (optional)" aria-label="Course description" value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} />
      <input type="number" min="1" placeholder="Duration in minutes (optional)" aria-label="Duration in minutes" value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass} />
      <select value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} aria-label="Linked competency" className={selectClass}>
        <option value="">No linked competency</option>
        {competencies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={createCourse.submitting}>
          {createCourse.submitting ? "Saving…" : "Add Course"}
        </Button>
      </div>
    </form>
  );
}

function CourseEditForm({ course, competencyOptions, onUpdated }: { course: Course; competencyOptions: Competency[]; onUpdated: () => void }) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [duration, setDuration] = useState(course.duration_minutes?.toString() ?? "");
  const [competencyId, setCompetencyId] = useState(course.competency_id ?? "");

  const updateCourse = useApiMutation({
    path: "courses",
    method: "PUT",
    onSuccess: () => {
      onUpdated();
      toast.success("Course updated successfully.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: submitError } = await updateCourse.submit({
      id: course.id,
      title,
      description,
      duration_minutes: duration ? parseInt(duration) : null,
      competency_id: competencyId || null,
    });
    if (submitError) {
      toast.error("Failed to update course. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required aria-label="Course title" className={inputClass} />
      <textarea placeholder="Description (optional)" aria-label="Course description" value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClass} />
      <div className="flex flex-wrap gap-2">
        <input type="number" min="1" placeholder="Minutes" aria-label="Duration in minutes" value={duration} onChange={(e) => setDuration(e.target.value)} className={`${inputClass} min-w-[120px] flex-1`} />
        <select value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} aria-label="Linked competency" className={`${selectClass} min-w-[160px] flex-1`}>
          <option value="">No linked competency</option>
          {competencyOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" loading={updateCourse.submitting}>
          {updateCourse.submitting ? "Saving…" : "Save Changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={onUpdated}>Cancel</Button>
      </div>
    </form>
  );
}

export default function LearningPage() {
  const { user, isAdmin } = useHrAuth();
  const { getDirectoryUser } = useDirectory();
  const [selectedEnrollment, setSelectedEnrollment] =
    useState<Enrollment | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [confirmingDeleteCourse, setConfirmingDeleteCourse] =
    useState<Course | null>(null);
  const [enrollmentFilter, setEnrollmentFilter] = useState<EnrollmentFilter>("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [isAssignCourseModalOpen, setIsAssignCourseModalOpen] = useState(false);

  const ADD_COURSE_TITLE_ID = "add-course-title";
  const ASSIGN_COURSE_TITLE_ID = "assign-course-title";

  const {
    data: courses,
    loading: coursesLoading,
    error: coursesError,
    refetch: refetchCourses,
  } = useApiResource<Course>({ path: "courses", listKey: "courses", errorMessage: "Could not load learning data. Please try again." });

  const {
    data: enrollments,
    loading: enrollmentsLoading,
    error: enrollmentsError,
    refetch: refetchEnrollments,
  } = useApiResource<Enrollment>({ path: "enrollments", listKey: "enrollments", errorMessage: "Could not load learning data. Please try again." });

  const {
    data: scores,
    error: scoresError,
  } = useApiResource<Score>({ path: "competency-scores", listKey: "scores", errorMessage: "Could not load learning data. Please try again." });

  const {
    data: competencies,
    error: competenciesError,
  } = useApiResource<Competency>({ path: "competency", listKey: "competencies", errorMessage: "Could not load learning data. Please try again." });

  const loading = coursesLoading || enrollmentsLoading;
  const error = coursesError || enrollmentsError || scoresError || competenciesError;

  function refetch() {
    refetchCourses();
    refetchEnrollments();
  }

  const enrollMutation = useApiMutation({
    path: "enrollments",
    method: "POST",
    onSuccess: () => {
      refetch();
      toast.success("Enrolled successfully.");
    },
  });

  const deleteCourseMutation = useApiMutation({
    path: "courses",
    method: "DELETE",
    onSuccess: () => {
      setConfirmingDeleteCourse(null);
      refetch();
      toast.success("Course deleted successfully.");
    },
  });

  async function handleEnroll(courseId: string) {
    const { error: submitError } = await enrollMutation.submit({ course_id: courseId });
    if (submitError) {
      toast.error("Failed to enroll. Please try again.");
    }
  }

  async function deleteCourse(id: string) {
    const { error: submitError } = await deleteCourseMutation.submit(null, { id });
    if (submitError) {
      toast.error("Failed to delete course. Please try again.");
    }
  }

  const myEmployeeId = user?.employeeId ?? null;
  const myEnrollments = enrollments.filter((e) => e.employee_id === myEmployeeId);
  const filteredMyEnrollments = useMemo(() => {
    if (enrollmentFilter === "all") return myEnrollments;
    return myEnrollments.filter((e) => e.status === enrollmentFilter);
  }, [myEnrollments, enrollmentFilter]);
  const enrolledCourseIds = new Set(
    myEnrollments.map((e) => e.course_id).filter(Boolean) as string[]
  );

  const catalogQuery = catalogSearch.trim().toLowerCase();
  const filteredCourses = useMemo(() => {
    if (!catalogQuery) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(catalogQuery) ||
        (c.description ?? "").toLowerCase().includes(catalogQuery) ||
        (c.hr3_competencies?.name ?? "").toLowerCase().includes(catalogQuery)
    );
  }, [courses, catalogQuery]);

  const gapCompetencyIds = useMemo(() => {
    const mine = scores.filter((s) => s.employee_id === myEmployeeId);
    return new Set(
      mine
        .filter((s) => s.required_level !== null && s.current_level < s.required_level)
        .map((s) => s.competency_id)
        .filter((id): id is string => !!id)
    );
  }, [scores, myEmployeeId]);

  const recommendedCourses = courses.filter(
    (c) =>
      c.competency_id !== null &&
      gapCompetencyIds.has(c.competency_id) &&
      !enrolledCourseIds.has(c.id)
  );

  const teamStats = useMemo(() => {
    const inProgress = enrollments.filter((e) => e.status === "in_progress").length;
    const completed = enrollments.filter((e) => e.status === "completed").length;
    const employees = new Set(enrollments.map((e) => e.employee_id)).size;
    return { total: enrollments.length, inProgress, completed, employees };
  }, [enrollments]);

  const employeeStats = {
    enrolled: myEnrollments.length,
    inProgress: myEnrollments.filter((e) => e.status === "in_progress").length,
    completed: myEnrollments.filter((e) => e.status === "completed").length,
  };

  const groupedEnrollments = useMemo(() => {
    const groups = new Map<string, Enrollment[]>();
    for (const enrollment of enrollments) {
      const key = enrollment.employee_id ?? "unknown";
      const list = groups.get(key) ?? [];
      list.push(enrollment);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .map(([employeeId, list]) => ({
        employeeId,
        employee: getDirectoryUser(employeeId),
        enrollments: list,
      }))
      .sort((a, b) => (a.employee?.name ?? "Unknown").localeCompare(b.employee?.name ?? "Unknown"));
  }, [enrollments, getDirectoryUser]);

  const enrollmentCountByCourse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const enrollment of enrollments) {
      if (!enrollment.course_id) continue;
      counts.set(enrollment.course_id, (counts.get(enrollment.course_id) ?? 0) + 1);
    }
    return counts;
  }, [enrollments]);

  const stats = !isAdmin
    ? [
        { label: "Enrolled", value: employeeStats.enrolled },
        { label: "In Progress", value: employeeStats.inProgress },
        { label: "Completed", value: employeeStats.completed },
      ]
    : [
        { label: "Assignments", value: teamStats.total },
        { label: "In Progress", value: teamStats.inProgress },
        { label: "Completed", value: teamStats.completed },
        { label: "Employees", value: teamStats.employees },
      ];

  return (
    <div>
      <PageHeader
        eyebrow="Learning Management"
        title="Learning"
        subtitle="Browse the course catalog, enroll, and track progress."
        actions={
          isAdmin ? (
            <div className="flex gap-2">
              <Button onClick={() => setIsAssignCourseModalOpen(true)}>
                Assign Course
              </Button>
              <Button onClick={() => setIsAddCourseModalOpen(true)}>
                Add Course
              </Button>
            </div>
          ) : undefined
        }
      />

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      {loading && (
        <SkeletonRegion label="Loading learning data…">
          <SkeletonStats count={isAdmin ? 4 : 3} />
          <SkeletonCards rows={3} className="mt-8 max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && (
        <div className="mb-8 flex flex-wrap gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      )}

      {!loading && !isAdmin && recommendedCourses.length > 0 && (
        <>
          <h2 className={`mb-3 ${sectionTitleClass}`}>Fills your skill gaps</h2>
          <DataTable columns={["Recommended Course", "Duration", "Builds", ""]} className="mb-8">
            {recommendedCourses.map((course) => {
              const enrolled = enrolledCourseIds.has(course.id);
              return (
                <DataTableRow key={course.id}>
                  <TableCell>
                    <div className="max-w-sm">
                      <p className="truncate font-medium text-ink dark:text-paper">
                        {course.title}
                      </p>
                      {course.description && (
                        <p className="truncate text-xs text-muted">
                          {course.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted">{formatDuration(course.duration_minutes)}</span>
                  </TableCell>
                  <TableCell>
                    {course.hr3_competencies?.name && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                        <Sparkles className="h-3.5 w-3.5 text-accent" />
                        {course.hr3_competencies.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!enrolled && (
                      <Button onClick={() => handleEnroll(course.id)}>Enroll</Button>
                    )}
                  </TableCell>
                </DataTableRow>
              );
            })}
          </DataTable>
        </>
      )}

      {!loading && !isAdmin && (
        <>
          <h2 className={`mb-3 ${sectionTitleClass}`}>My Enrollments</h2>
          {myEnrollments.length === 0 && (
            <EmptyState icon={BookOpen} title="No enrollments yet" description="Enroll in a course below to get started." />
          )}
          {myEnrollments.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {ENROLLMENT_FILTERS.map((value) => (
                <Chip key={value} active={enrollmentFilter === value} onClick={() => setEnrollmentFilter(value)}>
                  {value === "all" ? "All statuses" : enrollmentLabel(value)}
                </Chip>
              ))}
            </div>
          )}
          {myEnrollments.length > 0 && filteredMyEnrollments.length === 0 && (
            <EmptyState icon={BookOpen} title="No enrollments match" description="Try a different status filter to see more enrollments." />
          )}
          {filteredMyEnrollments.length > 0 && (
            <DataTable columns={["Course", "Status", "Progress", ""]} className="mb-8">
              {filteredMyEnrollments.map((e) => (
                <DataTableRow key={e.id}>
                  <TableCell>
                    <span className="font-medium text-ink dark:text-paper">
                      {e.hr3_courses?.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={enrollmentVariant(e.status)}>
                      {enrollmentLabel(e.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={e.progress_percent ?? 0}
                        label={`Progress for ${e.hr3_courses?.title}`}
                        className="flex-1"
                      />
                      <span className="w-9 shrink-0 text-right text-xs text-muted">
                        {e.progress_percent ?? 0}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <TableActions
                      actions={[
                        {
                          label: "View",
                          icon: <Eye size={14} />,
                          onClick: () => setSelectedEnrollment(e),
                        },
                      ]}
                    />
                  </TableCell>
                </DataTableRow>
              ))}
            </DataTable>
          )}
        </>
      )}

      {!loading && (
        <Modal
          open={isAssignCourseModalOpen}
          onClose={() => setIsAssignCourseModalOpen(false)}
          title="Assign Course"
          titleId={ASSIGN_COURSE_TITLE_ID}
        >
          <AssignForm courses={courses} onAssigned={() => { refetch(); setIsAssignCourseModalOpen(false); }} onClose={() => setIsAssignCourseModalOpen(false)} />
        </Modal>
      )}

      {!loading && isAdmin && (
        <>
          <h2 className={`mb-3 ${sectionTitleClass}`}>Team Progress</h2>
          {groupedEnrollments.length === 0 && (
            <EmptyState icon={UserPlus} title="No assignments yet" description='Click "Assign Course" above to get started.' />
          )}
          {groupedEnrollments.length > 0 && (
            <DataTable columns={["Employee", "Course", "Status", "Progress", ""]} className="mb-8">
              {groupedEnrollments.map((group) =>
                group.enrollments.map((e) => (
                  <DataTableRow key={e.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-ink dark:text-paper">
                          {group.employee?.name ?? "Unknown employee"}
                        </p>
                        {group.employee?.jobTitle && (
                          <p className="text-xs capitalize text-muted">
                            {group.employee.jobTitle}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-ink dark:text-paper">
                        {e.hr3_courses?.title}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={enrollmentVariant(e.status)}>
                        {enrollmentLabel(e.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={e.progress_percent ?? 0}
                          label={`Progress for ${e.hr3_courses?.title}`}
                          className="flex-1"
                        />
                        <span className="w-9 shrink-0 text-right text-xs text-muted">
                          {e.progress_percent ?? 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <TableActions
                        actions={[
                          {
                            label: "View",
                            icon: <Eye size={14} />,
                            onClick: () => setSelectedEnrollment(e),
                          },
                        ]}
                      />
                    </TableCell>
                  </DataTableRow>
                ))
              )}
            </DataTable>
          )}
        </>
      )}

      <Modal
        open={!!selectedEnrollment}
        onClose={() => setSelectedEnrollment(null)}
        title="Enrollment Details"
        size="md"
      >
        {selectedEnrollment && (
          <EnrollmentDetailsModal
            enrollment={selectedEnrollment}
            onClose={() => setSelectedEnrollment(null)}
            onSaved={() => {
              refetch();
              setSelectedEnrollment(null);
            }}
          />
        )}
      </Modal>

      <h2 className={`mb-3 ${sectionTitleClass}`}>Course Catalog</h2>
      {!loading && courses.length === 0 && (
        <EmptyState icon={BookOpen} title="No courses yet" description="No courses available yet." />
      )}
      {!loading && courses.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <input type="search" placeholder="Search courses..." aria-label="Search course catalog" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className={`${controlSmallClass} min-w-[200px]`} />
          </div>
          {filteredCourses.length === 0 && (
            <EmptyState icon={BookOpen} title="No courses match" description="Try a different search term to find more courses." />
          )}
        </>
      )}
      {!loading && filteredCourses.length > 0 && (
        <DataTable columns={["Course", "Duration", "Builds", "Status", "Action"]}>
          {filteredCourses.map((course) => {
            const enrolled = enrolledCourseIds.has(course.id);
            const myEnrollment = myEnrollments.find((e) => e.course_id === course.id);
            const enrolledCount = enrollmentCountByCourse.get(course.id) ?? 0;
            return (
              <DataTableRow key={course.id}>
                <TableCell>
                  <div className="max-w-sm">
                    <p className="truncate font-medium text-ink dark:text-paper">
                      {course.title}
                    </p>
                    {course.description && (
                      <p className="truncate text-xs text-muted">
                        {course.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted">{formatDuration(course.duration_minutes)}</span>
                </TableCell>
                <TableCell>
                  {course.hr3_competencies?.name ? (
                    <Badge variant="neutral">{course.hr3_competencies.name}</Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {!isAdmin ? (
                    enrolled ? (
                      <Badge variant={enrollmentVariant(myEnrollment?.status ?? "")}>
                        {myEnrollment?.status === "completed"
                          ? "Completed"
                          : `Enrolled · ${myEnrollment?.progress_percent ?? 0}%`}
                      </Badge>
                    ) : (
                      <span className="text-muted">Not enrolled</span>
                    )
                  ) : (
                    <Badge variant="neutral">{enrolledCount} enrolled</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!isAdmin && !enrolled && (
                    <Button onClick={() => handleEnroll(course.id)}>Enroll</Button>
                  )}
                </TableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      )}

      {!loading && isAdmin && (
        <>
          <h2 className={`mb-3 mt-10 ${sectionTitleClass}`}>Manage Catalog</h2>
          {!loading && (
            <Modal
              open={isAddCourseModalOpen}
              onClose={() => setIsAddCourseModalOpen(false)}
              title="Add Course"
              titleId={ADD_COURSE_TITLE_ID}
            >
              <CourseForm competencies={competencies} onCreated={() => { refetch(); setIsAddCourseModalOpen(false); }} onClose={() => setIsAddCourseModalOpen(false)} />
            </Modal>
          )}
          {courses.length === 0 && (
            <EmptyState icon={BookOpen} title="No courses yet" description='Click "Add Course" above to get started.' />
          )}
          {courses.length > 0 && (
            <DataTable columns={["Course", "Duration", "Competency", ""]} className="max-w-lg">
              {courses.map((c) => (
                <DataTableRow key={c.id}>
                  <TableCell>
                    <span className="font-medium text-ink dark:text-paper">
                      {c.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted">{formatDuration(c.duration_minutes)}</span>
                  </TableCell>
                  <TableCell>
                    {c.hr3_competencies?.name ? (
                      <Badge variant="neutral">{c.hr3_competencies.name}</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <TableActions
                      actions={[
                        {
                          label: "Edit",
                          icon: <Pencil size={14} />,
                          onClick: () => setEditingCourse(c),
                        },
                        {
                          label: "Delete",
                          icon: <Trash2 size={14} />,
                          danger: true,
                          onClick: () => setConfirmingDeleteCourse(c),
                        },
                      ]}
                    />
                  </TableCell>
                </DataTableRow>
              ))}
            </DataTable>
          )}

          {/* Edit course */}
          <Modal
            open={!!editingCourse}
            onClose={() => setEditingCourse(null)}
            title="Edit Course"
            size="md"
          >
            {editingCourse && (
              <CourseEditForm
                course={editingCourse}
                competencyOptions={competencies}
                onUpdated={() => {
                  refetch();
                  setEditingCourse(null);
                }}
              />
            )}
          </Modal>

          {/* Delete course */}
          <Modal
            open={!!confirmingDeleteCourse}
            onClose={() => setConfirmingDeleteCourse(null)}
            title="Delete Course"
            size="sm"
          >
            <p className="text-sm text-muted">
              Delete this course? This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="danger"
                onClick={() =>
                  confirmingDeleteCourse &&
                  deleteCourse(confirmingDeleteCourse.id)
                }
                loading={deleteCourseMutation.submitting}
              >
                {deleteCourseMutation.submitting ? "Deleting…" : "Confirm Delete"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmingDeleteCourse(null)}
              >
                Cancel
              </Button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
