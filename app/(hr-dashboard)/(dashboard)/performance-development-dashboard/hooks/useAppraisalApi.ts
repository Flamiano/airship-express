"use client";

import { useCallback, useState } from "react";
import type {
  AppraisalCreateInput,
  AppraisalScoringInputs,
  PerformanceAppraisal,
} from "@/performance-development-dashboard/types";
import { perDevFetch } from "@/performance-development-dashboard/lib/api/perDevFetch";

const APPRAISALS_API = "/performance-development-dashboard/api/performance/appraisals";

/**
 * Foundation Appraisal API client.
 *
 * The workflow is server-controlled (status transitions, reviewer and
 * employee identity). This hook only calls the exposed transition endpoints
 * and never sends `status`, `reviewer_id`, `reviewer_hr_admin_id`, or actor
 * fields: those are exclusively server-derived.
 */
export function useAppraisalApi() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    (path: string, method: "GET" | "POST" = "GET", body?: unknown) =>
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

  const list = useCallback(
    () => request(APPRAISALS_API) as Promise<PerformanceAppraisal[]>,
    [request]
  );

  const create = useCallback(
    (input: AppraisalCreateInput) =>
      request(APPRAISALS_API, "POST", input) as Promise<PerformanceAppraisal>,
    [request]
  );

  const getOne = useCallback(
    (id: string) =>
      request(`${APPRAISALS_API}/${id}`) as Promise<PerformanceAppraisal>,
    [request]
  );

  const submitSelfAssessment = useCallback(
    (id: string, input: { strengths?: string; improvements?: string }) =>
      request(
        `${APPRAISALS_API}/${id}/self-assessment`,
        "POST",
        input
      ) as Promise<PerformanceAppraisal>,
    [request]
  );

  const submitManagerAssessment = useCallback(
    (
      id: string,
      input: {
        goalRatings: { goal_id: string; rating: number }[];
        competencyRatings: { competency_id: string; rating: number }[];
        comments: string;
      }
    ) =>
      request(
        `${APPRAISALS_API}/${id}/manager-assessment`,
        "POST",
        input
      ) as Promise<PerformanceAppraisal>,
    [request]
  );

  const finalize = useCallback(
    (id: string) =>
      request(`${APPRAISALS_API}/${id}/finalize`, "POST") as Promise<
        PerformanceAppraisal
      >,
    [request]
  );

  const getScoringInputs = useCallback(
    (id: string) =>
      request(`${APPRAISALS_API}/${id}/scoring-inputs`) as Promise<
        AppraisalScoringInputs
      >,
    [request]
  );

  const acknowledge = useCallback(
    (id: string) =>
      request(`${APPRAISALS_API}/${id}/acknowledge`, "POST") as Promise<
        PerformanceAppraisal
      >,
    [request]
  );

  const startSelfAssessment = useCallback(
    (id: string) =>
      request(
        `${APPRAISALS_API}/${id}/start-self-assessment`,
        "POST"
      ) as Promise<PerformanceAppraisal>,
    [request]
  );

  const reassignEvaluator = useCallback(
    (id: string, evaluatorId: string) =>
      request(
        `${APPRAISALS_API}/${id}/reassign-evaluator`,
        "POST",
        { evaluator_id: evaluatorId }
      ) as Promise<PerformanceAppraisal>,
    [request]
  );

  return {
    list,
    create,
    getOne,
    getScoringInputs,
    submitSelfAssessment,
    submitManagerAssessment,
    finalize,
    acknowledge,
    startSelfAssessment,
    reassignEvaluator,
    runCreate: (input: AppraisalCreateInput) => run(() => create(input)),
    runSubmitSelfAssessment: (
      id: string,
      input: { strengths?: string; improvements?: string }
    ) => run(() => submitSelfAssessment(id, input)),
    runSubmitManagerAssessment: (
      id: string,
      input: {
        goalRatings: { goal_id: string; rating: number }[];
        competencyRatings: { competency_id: string; rating: number }[];
        comments: string;
      }
    ) => run(() => submitManagerAssessment(id, input)),
    runFinalize: (id: string) =>
      run(() => finalize(id)),
    runAcknowledge: (id: string) => run(() => acknowledge(id)),
    runStartSelfAssessment: (id: string) =>
      run(() => startSelfAssessment(id)),
    runReassignEvaluator: (id: string, evaluatorId: string) =>
      run(() => reassignEvaluator(id, evaluatorId)),
    busy,
    error,
    clearError: () => setError(null),
  };
}