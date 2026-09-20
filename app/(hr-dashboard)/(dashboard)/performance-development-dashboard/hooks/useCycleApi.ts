"use client";

import { useCallback, useState } from "react";
import type {
  CycleCreateInput,
  PerformanceCycle,
  PerformanceCycleReadiness,
} from "@/performance-development-dashboard/types";
import { perDevFetch } from "@/performance-development-dashboard/lib/api/perDevFetch";

const CYCLES_API = "/performance-development-dashboard/api/performance/cycles";

export function useCycleApi() {
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    (path: string, method: "GET" | "POST" = "GET", body?: unknown) =>
      perDevFetch(path, { method, body }),
    []
  );

  const list = useCallback(
    () => request(CYCLES_API) as Promise<PerformanceCycle[]>,
    [request]
  );

  const create = useCallback(
    (input: CycleCreateInput) =>
      request(CYCLES_API, "POST", input) as Promise<PerformanceCycle>,
    [request]
  );

  const open = useCallback(
    (id: string) =>
      request(`${CYCLES_API}/${id}/open`, "POST") as Promise<PerformanceCycle>,
    [request]
  );

  const advance = useCallback(
    (id: string) =>
      request(`${CYCLES_API}/${id}/advance`, "POST") as Promise<PerformanceCycle>,
    [request]
  );

  const getReadiness = useCallback(
    (id: string) =>
      request(`${CYCLES_API}/${id}/readiness`) as Promise<PerformanceCycleReadiness>,
    [request]
  );

  const close = useCallback(
    (id: string) =>
      request(`${CYCLES_API}/${id}/close`, "POST") as Promise<PerformanceCycle>,
    [request]
  );

  const runAction = useCallback(
    async <T,>(id: string, action: string, fn: (cycleId: string) => Promise<T>) => {
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
    open,
    advance,
    getReadiness,
    close,
    runAction,
    busy,
    error,
    clearError: () => setError(null),
  };
}