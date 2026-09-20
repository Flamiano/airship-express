"use client";

import { useCallback, useState } from "react";
import type {
  GoalCreateInput,
  GoalUpdateInput,
  PerformanceGoal,
} from "@/performance-development-dashboard/types";
import { perDevFetch } from "@/performance-development-dashboard/lib/api/perDevFetch";

const GOALS_API = "/performance-development-dashboard/api/performance/goals";

export function useGoalApi() {
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null);
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

  const list = useCallback(
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${GOALS_API}?${new URLSearchParams(params).toString()}`
          : GOALS_API;
      return request(url) as Promise<PerformanceGoal[]>;
    },
    [request]
  );

  const create = useCallback(
    (input: GoalCreateInput) =>
      request(GOALS_API, "POST", input) as Promise<PerformanceGoal>,
    [request]
  );

  const update = useCallback(
    (id: string, input: GoalUpdateInput) =>
      request(`${GOALS_API}/${id}`, "PATCH", input) as Promise<PerformanceGoal>,
    [request]
  );

  const progress = useCallback(
    (id: string, input: unknown) =>
      request(`${GOALS_API}/${id}/progress`, "POST", input) as Promise<PerformanceGoal>,
    [request]
  );

  const submit = useCallback(
    (id: string) =>
      request(`${GOALS_API}/${id}/submit`, "POST") as Promise<PerformanceGoal>,
    [request]
  );

  const runAction = useCallback(
    async <T,>(
      id: string,
      action: string,
      fn: (goalId: string) => Promise<T>
    ) => {
      setError(null);
      setBusy({ id, action });
      try {
        return await fn(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
        throw err;
      } finally {
        setBusy(null);
      }
    },
    []
  );

  return {
    list,
    create,
    update,
    progress,
    submit,
    runAction,
    busy,
    error,
    clearError: () => setError(null),
  };
}