"use client";

import { useCallback, useState } from "react";
import type {
  Certification,
  CertificationInput,
  Course,
  CourseEnrollment,
  CourseEnrollmentInput,
  CourseInput,
  TrainingEnrollment,
  TrainingEnrollmentInput,
  TrainingEvaluation,
  TrainingEvaluationInput,
  TrainingSession,
  TrainingSessionInput,
  UpdateCourseEnrollmentInput,
  UpdateTrainingEnrollmentInput,
} from "@/performance-development-dashboard/types";
import { perDevFetch } from "@/performance-development-dashboard/lib/api/perDevFetch";

const LEARNING_API =
  "/performance-development-dashboard/api/performance/learning";
const COURSES_API = `${LEARNING_API}/courses`;
const COURSE_ENROLLMENTS_API = `${LEARNING_API}/course-enrollments`;
const TRAINING_SESSIONS_API = `${LEARNING_API}/training-sessions`;
const TRAINING_ENROLLMENTS_API = `${LEARNING_API}/training-enrollments`;
const TRAINING_EVALUATIONS_API = `${LEARNING_API}/training-evaluations`;
const CERTIFICATIONS_API = `${LEARNING_API}/certifications`;

/**
 * Foundation Learning & Development API client.
 *
 * Read endpoints are shared across HR and employee scopes; the server decides
 * what an employee may see. Mutations are HR-scope only (the sole exception:
 * an employee may submit their own session evaluation). Identity fields
 * (`created_by`, `approved_by`, `issued_at`, actors) are never sent by the
 * client — they are exclusively server-derived.
 */
export function useLearningApi() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    (path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) =>
      perDevFetch(path, {
        method,
        body,
        sessionExpiredMessage: "Your session has expired. Please sign in again.",
      }),
    []
  );

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      setError(null);
      setBusy(true);
      try {
        return await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
        throw err;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  /* -------------------------------- Courses ----------------------------- */

  const listCourses = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${COURSES_API}?${new URLSearchParams(params).toString()}`
          : COURSES_API;
      return request(url) as Promise<Course[]>;
    },
    [request]
  );

  const createCourse = useCallback(
    (input: CourseInput) =>
      request(COURSES_API, "POST", input) as Promise<Course>,
    [request]
  );

  const updateCourse = useCallback(
    (id: string, input: CourseInput) =>
      request(`${COURSES_API}/${id}`, "PATCH", input) as Promise<Course>,
    [request]
  );

  /* --------------------------- Course enrollments ----------------------- */

  const listCourseEnrollments = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${COURSE_ENROLLMENTS_API}?${new URLSearchParams(
              params
            ).toString()}`
          : COURSE_ENROLLMENTS_API;
      return request(url) as Promise<CourseEnrollment[]>;
    },
    [request]
  );

  const createCourseEnrollment = useCallback(
    (input: CourseEnrollmentInput) =>
      request(COURSE_ENROLLMENTS_API, "POST", input) as Promise<
        CourseEnrollment
      >,
    [request]
  );

  const updateCourseEnrollment = useCallback(
    (id: string, input: UpdateCourseEnrollmentInput) =>
      request(
        `${COURSE_ENROLLMENTS_API}/${id}`,
        "PATCH",
        input
      ) as Promise<CourseEnrollment>,
    [request]
  );

  /* ---------------------------- Training sessions ----------------------- */

  const listTrainingSessions = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${TRAINING_SESSIONS_API}?${new URLSearchParams(
              params
            ).toString()}`
          : TRAINING_SESSIONS_API;
      return request(url) as Promise<TrainingSession[]>;
    },
    [request]
  );

  const createTrainingSession = useCallback(
    (input: TrainingSessionInput) =>
      request(TRAINING_SESSIONS_API, "POST", input) as Promise<
        TrainingSession
      >,
    [request]
  );

  const updateTrainingSession = useCallback(
    (id: string, input: TrainingSessionInput) =>
      request(
        `${TRAINING_SESSIONS_API}/${id}`,
        "PATCH",
        input
      ) as Promise<TrainingSession>,
    [request]
  );

  /* -------------------------- Training enrollments ---------------------- */

  const listTrainingEnrollments = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${TRAINING_ENROLLMENTS_API}?${new URLSearchParams(
              params
            ).toString()}`
          : TRAINING_ENROLLMENTS_API;
      return request(url) as Promise<TrainingEnrollment[]>;
    },
    [request]
  );

  const createTrainingEnrollment = useCallback(
    (input: TrainingEnrollmentInput) =>
      request(TRAINING_ENROLLMENTS_API, "POST", input) as Promise<
        TrainingEnrollment
      >,
    [request]
  );

  const updateTrainingEnrollment = useCallback(
    (id: string, input: UpdateTrainingEnrollmentInput) =>
      request(
        `${TRAINING_ENROLLMENTS_API}/${id}`,
        "PATCH",
        input
      ) as Promise<TrainingEnrollment>,
    [request]
  );

  /* -------------------------- Training evaluations ---------------------- */

  const listTrainingEvaluations = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${TRAINING_EVALUATIONS_API}?${new URLSearchParams(
              params
            ).toString()}`
          : TRAINING_EVALUATIONS_API;
      return request(url) as Promise<TrainingEvaluation[]>;
    },
    [request]
  );

  const createTrainingEvaluation = useCallback(
    (input: TrainingEvaluationInput) =>
      request(TRAINING_EVALUATIONS_API, "POST", input) as Promise<
        TrainingEvaluation
      >,
    [request]
  );

  /* ------------------------------ Certifications ------------------------ */

  const listCertifications = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${CERTIFICATIONS_API}?${new URLSearchParams(params).toString()}`
          : CERTIFICATIONS_API;
      return request(url) as Promise<Certification[]>;
    },
    [request]
  );

  const createCertification = useCallback(
    (input: CertificationInput) =>
      request(CERTIFICATIONS_API, "POST", input) as Promise<Certification>,
    [request]
  );

  return {
    listCourses,
    createCourse,
    updateCourse,
    listCourseEnrollments,
    createCourseEnrollment,
    updateCourseEnrollment,
    listTrainingSessions,
    createTrainingSession,
    updateTrainingSession,
    listTrainingEnrollments,
    createTrainingEnrollment,
    updateTrainingEnrollment,
    listTrainingEvaluations,
    createTrainingEvaluation,
    listCertifications,
    createCertification,
    runCreateCourse: (input: CourseInput) => run(() => createCourse(input)),
    runUpdateCourse: (id: string, input: CourseInput) =>
      run(() => updateCourse(id, input)),
    runCreateCourseEnrollment: (input: CourseEnrollmentInput) =>
      run(() => createCourseEnrollment(input)),
    runUpdateCourseEnrollment: (id: string, input: UpdateCourseEnrollmentInput) =>
      run(() => updateCourseEnrollment(id, input)),
    runCreateTrainingSession: (input: TrainingSessionInput) =>
      run(() => createTrainingSession(input)),
    runUpdateTrainingSession: (id: string, input: TrainingSessionInput) =>
      run(() => updateTrainingSession(id, input)),
    runCreateTrainingEnrollment: (input: TrainingEnrollmentInput) =>
      run(() => createTrainingEnrollment(input)),
    runUpdateTrainingEnrollment: (
      id: string,
      input: UpdateTrainingEnrollmentInput
    ) => run(() => updateTrainingEnrollment(id, input)),
    runCreateTrainingEvaluation: (input: TrainingEvaluationInput) =>
      run(() => createTrainingEvaluation(input)),
    runCreateCertification: (input: CertificationInput) =>
      run(() => createCertification(input)),
    busy,
    error,
    clearError: () => setError(null),
  };
}