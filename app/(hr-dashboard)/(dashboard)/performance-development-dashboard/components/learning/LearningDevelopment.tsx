"use client";

import { cn } from "@/app/(hr-dashboard)/(dashboard)/payroll-benefits-dashboard/utils/helpers/classNames";
import { useState } from "react";
import { toast } from "sonner";
import {
  Award,
  BookOpen,
  CalendarDays,
  GraduationCap,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { SkeletonPanel } from "@/performance-development-dashboard/components/ui/Skeleton";
import type {
  Certification,
  CertificationInput,
  Course,
  CourseEnrollment,
  CourseEnrollmentInput,
  CourseInput,
  CurrentPerDevUser,
  EmployeeOption,
  TrainingEnrollment,
  TrainingEnrollmentInput,
  TrainingEvaluation,
  TrainingEvaluationInput,
  TrainingSession,
  TrainingSessionInput,
  UpdateCourseEnrollmentInput,
  UpdateTrainingEnrollmentInput,
} from "@/performance-development-dashboard/types";
import { useLearningApi } from "@/performance-development-dashboard/hooks/useLearningApi";
import { CoursesTab } from "@/performance-development-dashboard/components/learning/CoursesTab";
import { CourseEnrollmentsTab } from "@/performance-development-dashboard/components/learning/CourseEnrollmentsTab";
import { TrainingTab } from "@/performance-development-dashboard/components/learning/TrainingTab";
import { CertificationsTab } from "@/performance-development-dashboard/components/learning/CertificationsTab";

type Props = {
  serverUser: CurrentPerDevUser;
  isHrAdmin: boolean;
  initialCourses: Course[];
  initialCourseEnrollments: CourseEnrollment[];
  initialTrainingSessions: TrainingSession[];
  initialTrainingEnrollments: TrainingEnrollment[];
  initialTrainingEvaluations: TrainingEvaluation[];
  initialCertifications: Certification[];
  initialError?: string;
  employees: EmployeeOption[];
  competenciesById: Record<string, string>;
  employeeNamesById: Record<string, string>;
  currentUserEmployeeId: string | null;
  defaultEmployeeId: string | null;
};

type TabKey = "courses" | "enrollments" | "training" | "certifications";

const TABS: { key: TabKey; label: string; icon: typeof BookOpen }[] = [
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "enrollments", label: "Course Enrollments", icon: UserCheck },
  { key: "training", label: "Training", icon: CalendarDays },
  { key: "certifications", label: "Certifications", icon: Award },
];

export function LearningDevelopment({
  serverUser,
  isHrAdmin,
  initialCourses,
  initialCourseEnrollments,
  initialTrainingSessions,
  initialTrainingEnrollments,
  initialTrainingEvaluations,
  initialCertifications,
  initialError,
  employees,
  competenciesById,
  employeeNamesById,
  currentUserEmployeeId,
  defaultEmployeeId,
}: Props) {
  const api = useLearningApi();

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [courseEnrollments, setCourseEnrollments] = useState<
    CourseEnrollment[]
  >(initialCourseEnrollments);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(
    initialTrainingSessions
  );
  const [trainingEnrollments, setTrainingEnrollments] = useState<
    TrainingEnrollment[]
  >(initialTrainingEnrollments);
  const [trainingEvaluations, setTrainingEvaluations] = useState<
    TrainingEvaluation[]
  >(initialTrainingEvaluations);
  const [certifications, setCertifications] = useState<Certification[]>(
    initialCertifications
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("courses");

  const firstName = serverUser.fullName.split(" ")[0] || "there";

  const courseTitlesById: Record<string, string> = {};
  for (const course of courses) {
    courseTitlesById[course.id] = course.title;
  }

  const sessionTitlesById: Record<string, string> = {};
  for (const session of trainingSessions) {
    sessionTitlesById[session.id] = session.title;
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      const [
        nextCourses,
        nextCourseEnrollments,
        nextTrainingSessions,
        nextTrainingEnrollments,
        nextTrainingEvaluations,
        nextCertifications,
      ] = await Promise.all([
        api.listCourses(),
        api.listCourseEnrollments(),
        api.listTrainingSessions(),
        api.listTrainingEnrollments(),
        api.listTrainingEvaluations(),
        api.listCertifications(),
      ]);
      setCourses(nextCourses);
      setCourseEnrollments(nextCourseEnrollments);
      setTrainingSessions(nextTrainingSessions);
      setTrainingEnrollments(nextTrainingEnrollments);
      setTrainingEvaluations(nextTrainingEvaluations);
      setCertifications(nextCertifications);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh learning data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshEnrollments() {
    setRefreshing(true);
    try {
      const [nextEnrollments, nextTrainingEnrollments, nextSessions, nextEvals] =
        await Promise.all([
          api.listCourseEnrollments(),
          api.listTrainingEnrollments(),
          api.listTrainingSessions(),
          api.listTrainingEvaluations(),
        ]);
      setCourseEnrollments(nextEnrollments);
      setTrainingEnrollments(nextTrainingEnrollments);
      setTrainingSessions(nextSessions);
      setTrainingEvaluations(nextEvals);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh learning data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateCourse(input: CourseInput) {
    await api.runCreateCourse(input);
    setActiveTab("courses");
    await refreshAll();
    toast.success("Course created.");
  }

  async function handleUpdateCourse(id: string, input: CourseInput) {
    await api.runUpdateCourse(id, input);
    await refreshAll();
    toast.success("Course updated.");
  }

  async function handleCreateCourseEnrollment(input: CourseEnrollmentInput) {
    await api.runCreateCourseEnrollment(input);
    setActiveTab("enrollments");
    await refreshAll();
    toast.success("Course enrollment created.");
  }

  async function handleUpdateCourseEnrollment(
    id: string,
    input: UpdateCourseEnrollmentInput
  ) {
    await api.runUpdateCourseEnrollment(id, input);
    await refreshAll();
    toast.success("Course enrollment updated.");
  }

  async function handleCreateTrainingSession(input: TrainingSessionInput) {
    await api.runCreateTrainingSession(input);
    setActiveTab("training");
    await refreshAll();
    toast.success("Training session created.");
  }

  async function handleUpdateTrainingSession(
    id: string,
    input: TrainingSessionInput
  ) {
    await api.runUpdateTrainingSession(id, input);
    await refreshAll();
    toast.success("Training session updated.");
  }

  async function handleCreateTrainingEnrollment(
    input: TrainingEnrollmentInput
  ) {
    await api.runCreateTrainingEnrollment(input);
    setActiveTab("training");
    await refreshAll();
    toast.success("Training enrollment created.");
  }

  async function handleUpdateTrainingEnrollment(
    id: string,
    input: UpdateTrainingEnrollmentInput
  ) {
    await api.runUpdateTrainingEnrollment(id, input);
    await refreshEnrollments();
    toast.success("Training enrollment updated.");
  }

  async function handleCreateTrainingEvaluation(input: TrainingEvaluationInput) {
    await api.runCreateTrainingEvaluation(input);
    await refreshEnrollments();
    toast.success("Evaluation submitted.");
  }

  async function handleCreateCertification(input: CertificationInput) {
    await api.runCreateCertification(input);
    setActiveTab("certifications");
    await refreshAll();
    toast.success("Certification issued.");
  }

  const coursesReady = activeTab === "courses" && !refreshing;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-bricolage text-[24px] font-medium leading-tight tracking-tight sm:text-[32px] xl:text-[36px]">
            Learning &amp; Development
          </h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted">
            {isHrAdmin
              ? `Hello ${firstName}. Maintain the course catalog, run training sessions, track who enrolls and completes, and issue certifications.`
              : `Hello ${firstName}. Browse the course catalog and training schedule, and track your own learning progress.`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-paper/15"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1 dark:border-paper/10">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-accent text-paper shadow-sm shadow-accent/25"
                  : "text-muted hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-paper/[0.06]"
              )}
            >
              <tab.icon size={14} strokeWidth={1.75} />
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
            <p className="text-[13px] font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={refreshAll}
              className="text-[12.5px] font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {refreshing && !coursesReady ? (
          <div aria-busy="true" role="status">
            <SkeletonPanel lines={6} />
          </div>
        ) : (
          <>
            {activeTab === "courses" && (
              <CoursesTab
                courses={courses}
                competenciesById={competenciesById}
                isHrAdmin={isHrAdmin}
                submitting={api.busy}
                onCreate={handleCreateCourse}
                onUpdate={handleUpdateCourse}
              />
            )}

            {activeTab === "enrollments" && (
              <CourseEnrollmentsTab
                enrollments={courseEnrollments}
                courses={courses}
                employees={isHrAdmin ? employees : []}
                isHrAdmin={isHrAdmin}
                employeeNamesById={employeeNamesById}
                currentUserEmployeeId={currentUserEmployeeId}
                defaultEmployeeId={defaultEmployeeId}
                submitting={api.busy}
                onCreate={handleCreateCourseEnrollment}
                onUpdate={handleUpdateCourseEnrollment}
              />
            )}

            {activeTab === "training" && (
              <TrainingTab
                sessions={trainingSessions}
                trainingEnrollments={trainingEnrollments}
                evaluations={trainingEvaluations}
                employees={isHrAdmin ? employees : []}
                competenciesById={competenciesById}
                employeeNamesById={employeeNamesById}
                isHrAdmin={isHrAdmin}
                currentUserEmployeeId={currentUserEmployeeId}
                defaultEmployeeId={defaultEmployeeId}
                submitting={api.busy}
                onCreateSession={handleCreateTrainingSession}
                onUpdateSession={handleUpdateTrainingSession}
                onCreateEnrollment={handleCreateTrainingEnrollment}
                onUpdateEnrollment={handleUpdateTrainingEnrollment}
                onCreateEvaluation={handleCreateTrainingEvaluation}
              />
            )}

            {activeTab === "certifications" && (
              <CertificationsTab
                certifications={certifications}
                courses={courses}
                employees={isHrAdmin ? employees : []}
                isHrAdmin={isHrAdmin}
                employeeNamesById={employeeNamesById}
                currentUserEmployeeId={currentUserEmployeeId}
                defaultEmployeeId={defaultEmployeeId}
                submitting={api.busy}
                onCreate={handleCreateCertification}
              />
            )}
          </>
        )}
      </div>

      {courses.length === 0 && activeTab === "courses" && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-line px-6 py-4 text-[13px] text-muted dark:border-paper/10">
          <GraduationCap size={15} strokeWidth={1.5} />
          {isHrAdmin
            ? "No courses in the catalog yet — add the first one to get started."
            : "No courses have been published yet."}
        </div>
      )}
    </div>
  );
}