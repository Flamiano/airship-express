"use client";

import { useCallback, useState } from "react";
import type {
  CriticalPositionInput,
  CriticalPositionListItem,
  SuccessionCandidateInput,
  SuccessionCandidateListItem,
  UpdateCriticalPositionInput,
  UpdateSuccessionCandidateInput,
} from "@/performance-development-dashboard/types";
import { perDevFetch } from "@/performance-development-dashboard/lib/api/perDevFetch";

const SUCCESSION_API = "/performance-development-dashboard/api/performance/succession";
const CRITICAL_POSITIONS_API = `${SUCCESSION_API}/critical-positions`;
const CANDIDATES_API = `${SUCCESSION_API}/candidates`;

/**
 * Succession Planning API client.
 *
 * Every endpoint is server-authorized with HR admin scope (this module has no
 * employee self-service concept). Identity/attribution fields are never sent —
 * the server derives the acting HR account and records it in the audit trail.
 */
export function useSuccessionApi() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    (
      path: string,
      method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
      body?: unknown
    ) =>
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

  /* -------------------------- Critical positions ----------------------- */

  const listCriticalPositions = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${CRITICAL_POSITIONS_API}?${new URLSearchParams(params).toString()}`
          : CRITICAL_POSITIONS_API;
      return request(url) as Promise<CriticalPositionListItem[]>;
    },
    [request]
  );

  const createCriticalPosition = useCallback(
    (input: CriticalPositionInput) =>
      request(CRITICAL_POSITIONS_API, "POST", input) as Promise<
        CriticalPositionListItem
      >,
    [request]
  );

  const updateCriticalPosition = useCallback(
    (id: string, input: UpdateCriticalPositionInput) =>
      request(
        `${CRITICAL_POSITIONS_API}/${id}`,
        "PATCH",
        input
      ) as Promise<CriticalPositionListItem>,
    [request]
  );

  const deleteCriticalPosition = useCallback(
    (id: string) =>
      request(`${CRITICAL_POSITIONS_API}/${id}`, "DELETE") as Promise<{
        id: string;
        deleted: boolean;
      }>,
    [request]
  );

  /* ------------------------- Succession candidates ---------------------- */

  const listAllCandidates = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${CANDIDATES_API}?${new URLSearchParams(params).toString()}`
          : CANDIDATES_API;
      return request(url) as Promise<SuccessionCandidateListItem[]>;
    },
    [request]
  );

  const addCandidate = useCallback(
    (criticalPositionId: string, input: SuccessionCandidateInput) =>
      request(
        `${CRITICAL_POSITIONS_API}/${criticalPositionId}/candidates`,
        "POST",
        input
      ) as Promise<SuccessionCandidateListItem>,
    [request]
  );

  const updateCandidate = useCallback(
    (id: string, input: UpdateSuccessionCandidateInput) =>
      request(
        `${CANDIDATES_API}/${id}`,
        "PATCH",
        input
      ) as Promise<SuccessionCandidateListItem>,
    [request]
  );

  const removeCandidate = useCallback(
    (id: string) =>
      request(`${CANDIDATES_API}/${id}`, "DELETE") as Promise<{
        id: string;
        deleted: boolean;
      }>,
    [request]
  );

  return {
    listCriticalPositions,
    createCriticalPosition,
    updateCriticalPosition,
    deleteCriticalPosition,
    listAllCandidates,
    addCandidate,
    updateCandidate,
    removeCandidate,
    runCreateCriticalPosition: (input: CriticalPositionInput) =>
      run(() => createCriticalPosition(input)),
    runUpdateCriticalPosition: (id: string, input: UpdateCriticalPositionInput) =>
      run(() => updateCriticalPosition(id, input)),
    runDeleteCriticalPosition: (id: string) =>
      run(() => deleteCriticalPosition(id)),
    runAddCandidate: (criticalPositionId: string, input: SuccessionCandidateInput) =>
      run(() => addCandidate(criticalPositionId, input)),
    runUpdateCandidate: (id: string, input: UpdateSuccessionCandidateInput) =>
      run(() => updateCandidate(id, input)),
    runRemoveCandidate: (id: string) => run(() => removeCandidate(id)),
    busy,
    error,
    clearError: () => setError(null),
  };
}