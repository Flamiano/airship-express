"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Card from "@/app/(hr-dashboard)/performance-development-dashboard/components/Card";
import Badge from "@/app/(hr-dashboard)/performance-development-dashboard/components/Badge";
import Button from "@/app/(hr-dashboard)/performance-development-dashboard/components/Button";
import PageHeader from "@/app/(hr-dashboard)/performance-development-dashboard/components/PageHeader";
import EmptyState from "@/app/(hr-dashboard)/performance-development-dashboard/components/EmptyState";
import ProgressBar from "@/app/(hr-dashboard)/performance-development-dashboard/components/ProgressBar";
import StatCard from "@/app/(hr-dashboard)/performance-development-dashboard/components/StatCard";
import {
  SkeletonCards,
  SkeletonRegion,
  SkeletonStats,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/Skeleton";
import {
  staggerContainer,
  staggerItem,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/motion";
import {
  errorTextClass,
  iconEditClass,
  inputClass,
  listRowClass,
  quietDangerClass,
  selectClass,
  textareaClass,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/formStyles";
import { useHrAuth } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/hr-auth";
import {
  useDirectory,
} from "@/app/(hr-dashboard)/performance-development-dashboard/lib/directory";
import { readApiError } from "@/app/(hr-dashboard)/performance-development-dashboard/lib/api-error";
import { BookOpen, Pencil, Sparkles, UserPlus } from "lucide-react";
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

function enrollmentLabel(status: string) {
  return ENROLLMENT_LABELS[status] ?? status;
}

function enrollmentVariant(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "in_progress") return "warning";
  return "neutral";
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "Self-paced";
  if (minutes >= 60 && minutes % 60 === 0)
    return `${minutes / 60} hr`;
  return `${minutes} min`;
}

function AssignForm({
  courses,
  onAssigned,
}: {
  courses: Course[];
  onAssigned: () => void;
}) {
  const { directory } = useDirectory();
  const [employeeId, setEmployeeId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId || !courseId) {
      toast.error("Choose an employee and a course.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/performance-development-dashboard/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          course_id: courseId,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to assign course");
      }
      setEmployeeId("");
      setCourseId("");
      onAssigned();
      toast.success("Course assigned successfully.");
    } catch {
      toast.error("Failed to assign course. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 flex max-w-md flex-col gap-3"
    >
      <h2 className="text-lg font-semibold font-bricolage">
        Assign a Course
      </h2>
      <select
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        required
        aria-label="Select employee"
        className={selectClass}
      >
        <option value="" disabled>
          Select employee
        </option>
        {directory.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {u.jobTitle}
          </option>
        ))}
      </select>
      <select
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        required
        aria-label="Select course"
        className={selectClass}
      >
        <option value="" disabled>
          Select course
        </option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <Button type="submit" loading={submitting}>
        {submitting ? "Assigning…" : "Assign Course"}
      </Button>
    </form>
  );
}

function CourseForm({
  competencies,
  onCreated,
}: {
  competencies: Competency[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/performance-development-dashboard/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          duration_minutes: duration ? parseInt(duration) : null,
          competency_id: competencyId || null,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to create course");
      }
      setTitle("");
      setDescription("");
      setDuration("");
      setCompetencyId("");
      onCreated();
      toast.success("Course created successfully.");
    } catch {
      toast.error("Failed to create course. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 flex max-w-md flex-col gap-3"
    >
      <h2 className="text-lg font-semibold font-bricolage">
        Add Course
      </h2>
      <input
        type="text"
        placeholder="Title (e.g. Safe Parcel Handling)"
        aria-label="Course title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={inputClass}
      />
      <textarea
        placeholder="Description (optional)"
        aria-label="Course description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={textareaClass}
      />
      <input
        type="number"
        min="1"
        placeholder="Duration in minutes (optional)"
        aria-label="Duration in minutes"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        className={inputClass}
      />
      <select
        value={competencyId}
        onChange={(e) => setCompetencyId(e.target.value)}
        aria-label="Linked competency"
        className={selectClass}
      >
        <option value="">No linked competency</option>
        {competencies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="submit" loading={submitting}>
        {submitting ? "Saving…" : "Add Course"}
      </Button>
    </form>
  );
}

function CourseEditForm({
  course,
  competencyOptions,
  onUpdated,
}: {
  course: Course;
  competencyOptions: Competency[];
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [duration, setDuration] = useState(
    course.duration_minutes?.toString() ?? ""
  );
  const [competencyId, setCompetencyId] = useState(
    course.competency_id ?? ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/performance-development-dashboard/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: course.id,
          title,
          description,
          duration_minutes: duration ? parseInt(duration) : null,
          competency_id: competencyId || null,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to update course");
      }
      onUpdated();
      toast.success("Course updated successfully.");
    } catch {
      toast.error("Failed to update course. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        aria-label="Course title"
        className={inputClass}
      />
      <textarea
        placeholder="Description (optional)"
        aria-label="Course description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={textareaClass}
      />
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          min="1"
          placeholder="Minutes"
          aria-label="Duration in minutes"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className={`${inputClass} min-w-[120px] flex-1`}
        />
        <select
          value={competencyId}
          onChange={(e) => setCompetencyId(e.target.value)}
          aria-label="Linked competency"
          className={`${selectClass} min-w-[160px] flex-1`}
        >
          <option value="">No linked competency</option>
          {competencyOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="submit" loading={saving}>
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={onUpdated}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function LearningPage() {
  const { user, isAdmin } = useHrAuth();
  const { getDirectoryUser } = useDirectory();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, number>>(
    {}
  );
  const [savedProgress, setSavedProgress] = useState<Record<string, number>>(
    {}
  );
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [courseRes, enrollRes, scoreRes, compRes] = await Promise.all([
          fetch("/performance-development-dashboard/api/courses"),
          fetch("/performance-development-dashboard/api/enrollments"),
          fetch("/performance-development-dashboard/api/competency-scores"),
          fetch("/performance-development-dashboard/api/competency"),
        ]);
        if (!courseRes.ok || !enrollRes.ok || !scoreRes.ok || !compRes.ok) {
          throw new Error("Failed to load learning data");
        }
        const courseJson = await courseRes.json();
        const enrollJson = await enrollRes.json();
        const scoreJson = await scoreRes.json();
        const compJson = await compRes.json();
        if (cancelled) return;
        setCourses(courseJson.courses || []);
        setEnrollments(enrollJson.enrollments || []);
        setScores(scoreJson.scores || []);
        setCompetencies(compJson.competencies || []);
      } catch {
        if (!cancelled) setError("Could not load learning data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function refetch() {
    setRefreshKey((k) => k + 1);
  }

  async function handleEnroll(courseId: string) {
    setError(null);
    try {
      const res = await fetch("/performance-development-dashboard/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to enroll");
      }
      refetch();
      toast.success("Enrolled successfully.");
    } catch {
      toast.error("Failed to enroll. Please try again.");
    }
  }

  async function commitProgress(enrollment: Enrollment) {
    const progress = progressDrafts[enrollment.id];
    if (progress === undefined) return;
    if (savedProgress[enrollment.id] === progress) return;
    const nextStatus =
      progress >= 100
        ? "completed"
        : enrollment.status === "not_started" && progress > 0
          ? "in_progress"
          : enrollment.status;
    setSavedProgress((prev) => ({ ...prev, [enrollment.id]: progress }));
    try {
      const res = await fetch("/performance-development-dashboard/api/enrollments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: enrollment.id,
          progress_percent: progress,
          status: nextStatus,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to update progress");
      }
      refetch();
      toast.success("Progress updated successfully.");
    } catch {
      toast.error("Failed to update progress. Please try again.");
    }
  }

  async function deleteCourse(id: string) {
    if (!window.confirm("Delete this course? Existing enrollments will be orphaned."))
      return;
    try {
      const res = await fetch(
        `/performance-development-dashboard/api/courses?id=${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw await readApiError(res, "Failed to delete course");
      }
      refetch();
      toast.success("Course deleted successfully.");
    } catch {
      toast.error("Failed to delete course. Please try again.");
    }
  }

  const myEmployeeId = user?.employeeId ?? null;
  const myEnrollments = enrollments.filter(
    (e) => e.employee_id === myEmployeeId
  );
  const enrolledCourseIds = new Set(
    myEnrollments.map((e) => e.course_id).filter(Boolean) as string[]
  );

  const gapCompetencyIds = useMemo(() => {
    const mine = scores.filter((s) => s.employee_id === myEmployeeId);
    return new Set(
      mine
        .filter(
          (s) => s.required_level !== null && s.current_level < s.required_level
        )
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
    const inProgress = enrollments.filter(
      (e) => e.status === "in_progress"
    ).length;
    const completed = enrollments.filter(
      (e) => e.status === "completed"
    ).length;
    const employees = new Set(
      enrollments.map((e) => e.employee_id)
    ).size;
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
      .sort((a, b) =>
        (a.employee?.name ?? "Unknown").localeCompare(
          b.employee?.name ?? "Unknown"
        )
      );
  }, [enrollments, getDirectoryUser]);

  const enrollmentCountByCourse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const enrollment of enrollments) {
      if (!enrollment.course_id) continue;
      counts.set(
        enrollment.course_id,
        (counts.get(enrollment.course_id) ?? 0) + 1
      );
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
          <h2 className="mb-3 text-lg font-semibold font-bricolage">
            Fills your skill gaps
          </h2>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="shown"
            className="mb-8 flex max-w-md flex-col gap-3"
          >
            {recommendedCourses.map((course) => {
              const enrolled = enrolledCourseIds.has(course.id);
              return (
                <motion.div key={course.id} variants={staggerItem}>
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="mb-1 font-medium">{course.title}</h3>
                        {course.description && (
                          <p className="mb-2 text-sm text-muted">
                            {course.description}
                          </p>
                        )}
                        <span className="text-xs text-muted">
                          {formatDuration(course.duration_minutes)}
                          {course.hr3_competencies?.name &&
                            ` • Builds: ${course.hr3_competencies.name}`}
                        </span>
                      </div>
                      <Sparkles className="h-5 w-5 shrink-0 text-accent" />
                    </div>
                    {!enrolled && (
                      <div className="mt-3">
                        <Button onClick={() => handleEnroll(course.id)}>
                          Enroll
                        </Button>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}

      {!loading && !isAdmin && (
        <>
          <h2 className="mb-3 text-lg font-semibold font-bricolage">
            My Enrollments
          </h2>
          {myEnrollments.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title="No enrollments yet"
              description="Enroll in a course below to get started."
            />
          )}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="shown"
            className="mb-8 flex max-w-md flex-col gap-3"
          >
            {myEnrollments.map((e) => {
              const progress = progressDrafts[e.id] ?? e.progress_percent ?? 0;
              return (
                <motion.div key={e.id} variants={staggerItem}>
                  <Card>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-medium">{e.hr3_courses?.title}</h3>
                      <Badge variant={enrollmentVariant(e.status)}>
                        {enrollmentLabel(e.status)}
                      </Badge>
                    </div>
                    <div className="mb-2 flex items-center gap-3">
                      <ProgressBar
                        value={progress}
                        label={`Progress for ${e.hr3_courses?.title}`}
                        className="flex-1"
                      />
                      <span className="w-10 shrink-0 text-right text-xs text-muted">
                        {progress}%
                      </span>
                    </div>
                    {e.status !== "completed" && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={progress}
                        onChange={(ev) =>
                          setProgressDrafts((drafts) => ({
                            ...drafts,
                            [e.id]: Number(ev.target.value),
                          }))
                        }
                        onPointerUp={() => commitProgress(e)}
                        onBlur={() => commitProgress(e)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") commitProgress(e);
                        }}
                        aria-label={`Progress for ${e.hr3_courses?.title}`}
                        className="w-full accent-accent"
                      />
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}

      {!loading && isAdmin && (
        <AssignForm courses={courses} onAssigned={refetch} />
      )}

      {!loading && isAdmin && (
        <>
          <h2 className="mb-3 text-lg font-semibold font-bricolage">
            Team Progress
          </h2>
          {groupedEnrollments.length === 0 && (
            <EmptyState
              icon={UserPlus}
              title="No assignments yet"
              description="Assign a course above to get started."
            />
          )}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="shown"
            className="mb-8 flex max-w-md flex-col gap-4"
          >
            {groupedEnrollments.map((group) => (
              <motion.div key={group.employeeId} variants={staggerItem}>
                <Card>
                  <div className="mb-3">
                    <h3 className="font-semibold font-bricolage">
                      {group.employee?.name ?? "Unknown employee"}
                    </h3>
                    {group.employee?.jobTitle && (
                      <p className="text-xs capitalize text-muted">
                        {group.employee.jobTitle}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    {group.enrollments.map((e) => {
                      const progress =
                        progressDrafts[e.id] ?? e.progress_percent ?? 0;
                      return (
                        <div
                          key={e.id}
                          className={`p-3 ${listRowClass}`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-sm font-medium">
                              {e.hr3_courses?.title}
                            </h4>
                            <Badge variant={enrollmentVariant(e.status)}>
                              {enrollmentLabel(e.status)}
                            </Badge>
                          </div>
                          <div className="mb-2 flex items-center gap-3">
                            <ProgressBar
                              value={progress}
                              label={`Progress for ${e.hr3_courses?.title}`}
                              className="flex-1"
                            />
                            <span className="w-10 shrink-0 text-right text-xs text-muted">
                              {progress}%
                            </span>
                          </div>
                          {e.status !== "completed" && (
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={progress}
                              onChange={(ev) =>
                                setProgressDrafts((drafts) => ({
                                  ...drafts,
                                  [e.id]: Number(ev.target.value),
                                }))
                              }
                              onPointerUp={() => commitProgress(e)}
                              onBlur={() => commitProgress(e)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter") commitProgress(e);
                              }}
                              aria-label={`Progress for ${e.hr3_courses?.title}`}
                              className="w-full accent-accent"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </>
      )}

      <h2 className="mb-3 text-lg font-semibold font-bricolage">
        Course Catalog
      </h2>
      {!loading && courses.length === 0 && (
        <p className="mb-4 text-sm text-muted">
          No courses available yet.
        </p>
      )}
      {!loading && courses.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="shown"
          className="flex max-w-md flex-col gap-3"
        >
          {courses.map((course) => {
            const enrolled = enrolledCourseIds.has(course.id);
            const myEnrollment = myEnrollments.find(
              (e) => e.course_id === course.id
            );
            const enrolledCount = enrollmentCountByCourse.get(course.id) ?? 0;
            return (
              <motion.div key={course.id} variants={staggerItem}>
                <Card>
                  <h3 className="mb-1 font-medium">{course.title}</h3>
                  {course.description && (
                    <p className="mb-2 text-sm text-muted">
                      {course.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">
                      {formatDuration(course.duration_minutes)}
                      {course.hr3_competencies?.name &&
                        ` • ${course.hr3_competencies.name}`}
                    </span>
                    {!isAdmin ? (
                      enrolled ? (
                        <Badge variant={enrollmentVariant(myEnrollment?.status ?? "")}>
                          {myEnrollment?.status === "completed"
                            ? "Completed"
                            : `Enrolled · ${myEnrollment?.progress_percent ?? 0}%`}
                        </Badge>
                      ) : (
                        <Button onClick={() => handleEnroll(course.id)}>
                          Enroll
                        </Button>
                      )
                    ) : (
                      <Badge variant="neutral">
                        {enrolledCount} enrolled
                      </Badge>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {!loading && isAdmin && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold font-bricolage">
            Manage Catalog
          </h2>
          <CourseForm
            competencies={competencies}
            onCreated={refetch}
          />
          {courses.length === 0 && (
            <p className="mb-4 text-sm text-muted">
              No courses in the catalog yet.
            </p>
          )}
          <div className="flex max-w-md flex-col gap-2">
            {courses.map((c) =>
              editingCourseId === c.id ? (
                <div
                  key={c.id}
                  className={`flex items-start gap-2 px-4 py-3 ${listRowClass}`}
                >
                  <CourseEditForm
                    course={c}
                    competencyOptions={competencies}
                    onUpdated={() => {
                      refetch();
                      setEditingCourseId(null);
                    }}
                  />
                </div>
              ) : (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-2 px-4 py-2 ${listRowClass}`}
                >
                  <div>
                    <span className="text-sm">{c.title}</span>
                    {c.hr3_competencies?.name && (
                      <Badge variant="neutral">
                        {c.hr3_competencies.name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCourseId(
                          editingCourseId === c.id ? null : c.id
                        )
                      }
                      aria-label={
                        editingCourseId === c.id
                          ? "Close course editor"
                          : "Edit course"
                      }
                      aria-expanded={editingCourseId === c.id}
                      className={iconEditClass}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCourse(c.id)}
                      className={quietDangerClass}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
