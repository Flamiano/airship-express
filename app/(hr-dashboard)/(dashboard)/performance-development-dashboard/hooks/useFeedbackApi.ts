"use client";

import { useCallback, useState } from "react";
import type {
  FeedbackRequestCreateInput,
  FeedbackRequestListItem,
  FeedbackRequestRespondInput,
} from "@/performance-development-dashboard/types";
import { perDevFetch } from "@/performance-development-dashboard/lib/api/perDevFetch";

const FEEDBACK_API = "/performance-development-dashboard/api/performance/feedback/requests";

/**
 * Feedback request rows are immutable after creation except for the single
 * recipient response (fulfill/decline), so this hook only exposes GET (list,
 * single) and POST (create, respond). Client code never sends
 * `requester_employee_id`, `status`, or timestamps; those are
 * server-controlled.
 */
export function useFeedbackApi() {
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
    () => request(FEEDBACK_API) as Promise<FeedbackRequestListItem[]>,
    [request]
  );

  const create = useCallback(
    (input: FeedbackRequestCreateInput) =>
      request(FEEDBACK_API, "POST", input) as Promise<FeedbackRequestListItem>,
    [request]
  );

  const get = useCallback(
    (requestId: string) =>
      request(`${FEEDBACK_API}/${requestId}`) as Promise<FeedbackRequestListItem>,
    [request]
  );

  const respond = useCallback(
    (requestId: string, input: FeedbackRequestRespondInput) =>
      request(
        `${FEEDBACK_API}/${requestId}/respond`,
        "POST",
        input
      ) as Promise<FeedbackRequestListItem>,
    [request]
  );

  const runList = useCallback(() => run(() => list()), [run, list]);

  const runCreate = useCallback(
    (input: FeedbackRequestCreateInput) => run(() => create(input)),
    [run, create]
  );

  const runGet = useCallback(
    (requestId: string) => run(() => get(requestId)),
    [run, get]
  );

  const runRespond = useCallback(
    (requestId: string, input: FeedbackRequestRespondInput) =>
      run(() => respond(requestId, input)),
    [run, respond]
  );

  return {
    list,
    create,
    get,
    respond,
    runList,
    runCreate,
    runGet,
    runRespond,
    busy,
    error,
    clearError: () => setError(null),
  };
}
