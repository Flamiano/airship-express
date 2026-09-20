"use client";

import { useCallback, useState } from "react";
import type {
  Competency,
  CompetencyInput,
  EmployeeCompetencyAssessmentInput,
  EmployeeCompetencyProfileItem,
  PositionCompetencyRequirement,
  PositionCompetencyRequirementInput,
  UpdatePositionCompetencyRequirementInput,
} from "@/performance-development-dashboard/types";
import { perDevFetch } from "@/performance-development-dashboard/lib/api/perDevFetch";

const COMPETENCIES_API =
  "/performance-development-dashboard/api/performance/competencies";
const POSITION_REQUIREMENTS_API =
  "/performance-development-dashboard/api/performance/position-competencies";
const EMPLOYEE_COMPETENCIES_API =
  "/performance-development-dashboard/api/performance/employee-competencies";

/**
 * Foundation Competency Management API client.
 *
 * Read endpoints are shared across HR and employee scopes; the server decides
 * what an employee may see. Mutations are HR-scope only, and identity fields
 * (`assessed_by`, actor) are never sent by the client — they are exclusively
 * server-derived.
 */
export function useCompetencyApi() {
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

  /* ------------------------------- Competency library ------------------- */

  const listCompetencies = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${COMPETENCIES_API}?${new URLSearchParams(params).toString()}`
          : COMPETENCIES_API;
      return request(url) as Promise<Competency[]>;
    },
    [request]
  );

  const createCompetency = useCallback(
    (input: CompetencyInput) =>
      request(COMPETENCIES_API, "POST", input) as Promise<Competency>,
    [request]
  );

  const updateCompetency = useCallback(
    (id: string, input: CompetencyInput) =>
      request(`${COMPETENCIES_API}/${id}`, "PATCH", input) as Promise<Competency>,
    [request]
  );

  /* --------------------- Position competency requirements --------------- */

  const listPositionRequirements = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${POSITION_REQUIREMENTS_API}?${new URLSearchParams(
              params
            ).toString()}`
          : POSITION_REQUIREMENTS_API;
      return request(url) as Promise<PositionCompetencyRequirement[]>;
    },
    [request]
  );

  const createPositionRequirement = useCallback(
    (input: PositionCompetencyRequirementInput) =>
      request(POSITION_REQUIREMENTS_API, "POST", input) as Promise<
        PositionCompetencyRequirement
      >,
    [request]
  );

  const updatePositionRequirement = useCallback(
    (id: string, input: UpdatePositionCompetencyRequirementInput) =>
      request(
        `${POSITION_REQUIREMENTS_API}/${id}`,
        "PATCH",
        input
      ) as Promise<PositionCompetencyRequirement>,
    [request]
  );

  /* --------------------------- Employee competencies -------------------- */

  const listEmployeeCompetencies = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${EMPLOYEE_COMPETENCIES_API}?${new URLSearchParams(
              params
            ).toString()}`
          : EMPLOYEE_COMPETENCIES_API;
      return request(url) as Promise<EmployeeCompetencyProfileItem[]>;
    },
    [request]
  );

  const assessEmployee = useCallback(
    (input: EmployeeCompetencyAssessmentInput) =>
      request(EMPLOYEE_COMPETENCIES_API, "POST", input) as Promise<unknown>,
    [request]
  );

  return {
    listCompetencies,
    createCompetency,
    updateCompetency,
    listPositionRequirements,
    createPositionRequirement,
    updatePositionRequirement,
    listEmployeeCompetencies,
    assessEmployee,
    runCreateCompetency: (input: CompetencyInput) =>
      run(() => createCompetency(input)),
    runUpdateCompetency: (id: string, input: CompetencyInput) =>
      run(() => updateCompetency(id, input)),
    runCreatePositionRequirement: (input: PositionCompetencyRequirementInput) =>
      run(() => createPositionRequirement(input)),
    runUpdatePositionRequirement: (
      id: string,
      input: UpdatePositionCompetencyRequirementInput
    ) => run(() => updatePositionRequirement(id, input)),
    runAssessEmployee: (input: EmployeeCompetencyAssessmentInput) =>
      run(() => assessEmployee(input)),
    busy,
    error,
    clearError: () => setError(null),
  };
}