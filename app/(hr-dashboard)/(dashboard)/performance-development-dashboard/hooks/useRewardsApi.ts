"use client";

import { useCallback, useState } from "react";
import type {
  BadgeInput,
  BadgeListItem,
  EmployeePointsListItem,
  RecognitionInput,
  RecognitionListItem,
  RedemptionInput,
  RedemptionListItem,
  SetPointsInput,
  UpdateBadgeInput,
  UpdateRedemptionInput,
} from "@/performance-development-dashboard/types";
import { perDevFetch } from "@/performance-development-dashboard/lib/api/perDevFetch";

const REWARDS_API = "/performance-development-dashboard/api/performance/rewards";
const BADGES_API = `${REWARDS_API}/badges`;
const RECOGNITIONS_API = `${REWARDS_API}/recognitions`;
const POINTS_API = `${REWARDS_API}/points`;
const REDEMPTIONS_API = `${REWARDS_API}/redemptions`;

/**
 * Recognition & Rewards API client.
 *
 * Every endpoint is server-authorized with HR admin scope. The sender/recipient
 * of a recognition are BUSINESS fields chosen by HR — identity/attribution is
 * never sent to the client and is always resolved server-side for the audit
 * trail. Point balances are never updated from values implied by the client:
 * the server validates the employee and enforces non-negative totals.
 */
export function useRewardsApi() {
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

  /* ------------------------------ Badges ------------------------------- */

  const listBadges = useCallback(
    () => request(BADGES_API) as Promise<BadgeListItem[]>,
    [request]
  );

  const createBadge = useCallback(
    (input: BadgeInput) =>
      request(BADGES_API, "POST", input) as Promise<BadgeListItem>,
    [request]
  );

  const updateBadge = useCallback(
    (id: string, input: UpdateBadgeInput) =>
      request(`${BADGES_API}/${id}`, "PATCH", input) as Promise<BadgeListItem>,
    [request]
  );

  const deleteBadge = useCallback(
    (id: string) =>
      request(`${BADGES_API}/${id}`, "DELETE") as Promise<{
        id: string;
        deleted: boolean;
      }>,
    [request]
  );

  /* --------------------------- Recognitions ---------------------------- */

  const listRecognitions = useCallback(
    () => request(RECOGNITIONS_API) as Promise<RecognitionListItem[]>,
    [request]
  );

  const createRecognition = useCallback(
    (input: RecognitionInput) =>
      request(RECOGNITIONS_API, "POST", input) as Promise<RecognitionListItem>,
    [request]
  );

  /* ---------------------------- Points -------------------------------- */

  const listEmployeePoints = useCallback(
    () => request(POINTS_API) as Promise<EmployeePointsListItem[]>,
    [request]
  );

  const setEmployeePoints = useCallback(
    (input: SetPointsInput) =>
      request(POINTS_API, "POST", input) as Promise<EmployeePointsListItem>,
    [request]
  );

  /* --------------------------- Redemptions ---------------------------- */

  const listRedemptions = useCallback(
    () => request(REDEMPTIONS_API) as Promise<RedemptionListItem[]>,
    [request]
  );

  const createRedemption = useCallback(
    (input: RedemptionInput) =>
      request(REDEMPTIONS_API, "POST", input) as Promise<RedemptionListItem>,
    [request]
  );

  const updateRedemption = useCallback(
    (id: string, input: UpdateRedemptionInput) =>
      request(`${REDEMPTIONS_API}/${id}`, "PATCH", input) as Promise<
        RedemptionListItem
      >,
    [request]
  );

  return {
    listBadges,
    createBadge,
    updateBadge,
    deleteBadge,
    listRecognitions,
    createRecognition,
    listEmployeePoints,
    setEmployeePoints,
    listRedemptions,
    createRedemption,
    updateRedemption,
    runCreateBadge: (input: BadgeInput) => run(() => createBadge(input)),
    runUpdateBadge: (id: string, input: UpdateBadgeInput) =>
      run(() => updateBadge(id, input)),
    runDeleteBadge: (id: string) => run(() => deleteBadge(id)),
    runCreateRecognition: (input: RecognitionInput) =>
      run(() => createRecognition(input)),
    runSetEmployeePoints: (input: SetPointsInput) =>
      run(() => setEmployeePoints(input)),
    runCreateRedemption: (input: RedemptionInput) =>
      run(() => createRedemption(input)),
    runUpdateRedemption: (id: string, input: UpdateRedemptionInput) =>
      run(() => updateRedemption(id, input)),
    busy,
    error,
    clearError: () => setError(null),
  };
}