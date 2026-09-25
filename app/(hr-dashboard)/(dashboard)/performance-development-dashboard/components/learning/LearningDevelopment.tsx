"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SkeletonList } from "@/performance-development-dashboard/components/ui/Skeleton";
import {
  PerformanceButton,
  PerformanceErrorBanner,
  PerformancePageHeader,
  PerformanceTabs,
} from "@/performance-development-dashboard/components/ui/performance";
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

  return (
    <div className="space-y-6">
      <PerformancePageHeader
        title="Learning & Development"
        description={
          isHrAdmin
            ? `Hello ${firstName}. Maintain the course catalog, run training sessions, track who enrolls and completes, and issue certifications.`
            : `Hello ${firstName}. Browse the course catalog and training schedule, and track your own learning progress.`
        }
        actions={
          <PerformanceButton
            variant="ghost"
            onClick={refreshAll}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </PerformanceButton>
        }
      />

      <PerformanceTabs
        tabs={[
          { key: "courses", label: "Courses", count: courses.length },
          {
            key: "enrollments",
            label: "Enrollments",
            count: courseEnrollments.length,
          },
          {
            key: "training",
            label: "Training",
            count: trainingSessions.length,
          },
          {
            key: "certifications",
            label: "Certifications",
            count: certifications.length,
          },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        ariaLabel="Learning and development views"
      />

      {error && (
        <PerformanceErrorBanner message={error} onRetry={refreshAll} />
      )}

      {refreshing ? (
        <div aria-busy="true" role="status">
          <span className="sr-only">Loading learning data...</span>
          <SkeletonList rows={3} />
        </div>
      ) : (
        <>
          {activeTab === "courses" && (
            <CoursesTab
              courses={courses}
              competenciesById={competenciesById}
              enrollments={courseEnrollments}
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
  );
}
