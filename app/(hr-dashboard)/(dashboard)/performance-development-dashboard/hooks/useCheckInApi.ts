"use client";

import { useCallback, useState } from "react";
import type {
  CheckInAcknowledgment,
  CheckInCreateInput,
  CheckInMessageCreateInput,
  PerformanceCheckIn,
  PerformanceCheckInMessage,
  PerformanceCheckInThread,
} from "@/performance-development-dashboard/types";
import { perDevFetch } from "@/performance-development-dashboard/lib/api/perDevFetch";

const CHECK_INS_API = "/performance-development-dashboard/api/performance/checkins";

/**
 * Check-ins root rows are append-only (no PATCH/DELETE in the backend), so this
 * hook only exposes GET (list/thread) and POST (create, comment/reply,
 * acknowledge). Client code never sends `employee_id`, `author_employee_id`,
 * `author_account_id`, `given_by`, `feedback_type`, or identity fields; those
 * are server-controlled.
 */
export function useCheckInApi() {
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
    (params?: Record<string, string>) => {
      const url =
        params && Object.keys(params).length > 0
          ? `${CHECK_INS_API}?${new URLSearchParams(params).toString()}`
          : CHECK_INS_API;
      return request(url) as Promise<PerformanceCheckIn[]>;
    },
    [request]
  );

  const create = useCallback(
    (input: CheckInCreateInput) =>
      request(CHECK_INS_API, "POST", input) as Promise<PerformanceCheckIn>,
    [request]
  );

  const getThread = useCallback(
    (checkInId: string) =>
      request(`${CHECK_INS_API}/${checkInId}`) as Promise<PerformanceCheckInThread>,
    [request]
  );

  const postMessage = useCallback(
    (checkInId: string, input: CheckInMessageCreateInput) =>
      request(
        `${CHECK_INS_API}/${checkInId}/messages`,
        "POST",
        input
      ) as Promise<PerformanceCheckInMessage>,
    [request]
  );

  const acknowledge = useCallback(
    (checkInId: string) =>
      request(
        `${CHECK_INS_API}/${checkInId}/acknowledge`,
        "POST"
      ) as Promise<CheckInAcknowledgment>,
    [request]
  );

  const runCreate = useCallback(
    (input: CheckInCreateInput) => run(() => create(input)),
    [run, create]
  );

  const runGetThread = useCallback(
    (checkInId: string) => run(() => getThread(checkInId)),
    [run, getThread]
  );

  const runPostMessage = useCallback(
    (checkInId: string, input: CheckInMessageCreateInput) =>
      run(() => postMessage(checkInId, input)),
    [run, postMessage]
  );

  const runAcknowledge = useCallback(
    (checkInId: string) => run(() => acknowledge(checkInId)),
    [run, acknowledge]
  );

  return {
    list,
    create,
    getThread,
    postMessage,
    acknowledge,
    runCreate,
    runGetThread,
    runPostMessage,
    runAcknowledge,
    busy,
    error,
    clearError: () => setError(null),
  };
}