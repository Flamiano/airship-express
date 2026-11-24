type TripRecord = {
  driver_id?: string | null;
  driverId?: string | null;
  status?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  routePlan?: { routeDetails?: { schedule?: { window_end?: string | null; expected_arrival?: string | null } } | null } | null;
  route_plan?: { route_details?: { schedule?: { window_end?: string | null; expected_arrival?: string | null } } | null } | null;
};

const eligibleStatuses = new Set([
  "pending", "scheduled", "assigned", "accepted", "in progress", "in transit", "dispatched", "picked up",
  "out for delivery", "delayed", "late", "exception", "completed", "complete", "delivered",
]);

export function normalizePerformanceStatus(status: unknown) {
  return String(status ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

export function isCompletedPerformanceStatus(status: unknown) {
  return ["completed", "complete", "delivered"].includes(normalizePerformanceStatus(status));
}

export function isEligiblePerformanceStatus(status: unknown) {
  const normalized = normalizePerformanceStatus(status);
  return eligibleStatuses.has(normalized) && !/cancel|void|deleted/.test(normalized);
}

export function getDriverLinkedTripCohort<T extends TripRecord>(
  trips: readonly T[],
  start: Date | null,
  end: Date | null,
): T[] {
  if (!start || !end || start > end) return [];

  return trips.filter((trip) => {
    if (!String(trip.driver_id ?? trip.driverId ?? "").trim() || !isEligiblePerformanceStatus(trip.status)) return false;
    const rawCreatedAt = trip.created_at ?? trip.createdAt;
    if (!rawCreatedAt) return false;
    const createdAt = new Date(rawCreatedAt);
    return Number.isFinite(createdAt.getTime()) && createdAt >= start && createdAt <= end;
  });
}

export function getTripDeliveryDeadline(trip: TripRecord) {
  const schedule = trip.routePlan?.routeDetails?.schedule ?? trip.route_plan?.route_details?.schedule;
  return schedule?.window_end ?? schedule?.expected_arrival ?? null;
}
