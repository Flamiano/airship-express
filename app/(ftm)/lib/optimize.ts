// Optimization route types and utilities
export type LatLng = {
  lat: number;
  lng: number;
};

export type OptimizationMode = "fastest" | "shortest" | "fuel" | "balanced";

export type ParcelRouteEvent = {
  parcelId: string;
  kind: "pickup" | "delivery";
  weightKg?: number;
};

export type OptimizeStop = {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  label?: string;
  weightKg?: number;
  parcelEvents?: ParcelRouteEvent[];
};

export type OptimizeRequest = {
  origin: LatLng;
  destination: LatLng;
  stops: OptimizeStop[];
  vehicleCount?: number;
  availableVehicles?: Array<{ id: string; [key: string]: unknown }>;
  prioritizeFuelEfficiency?: boolean;
  optimizationMode?: OptimizationMode;
  cargoWeightKg?: number;
  vehicleCapacityKg?: number;
  initialDistanceMi?: number;
  initialEtaMinutes?: number;
  fuelEfficiencyKmPerL?: number;
  distanceMatrix?: number[][];
  durationMatrix?: number[][];
};

export function hasCompleteParcelEventPairs(stops: OptimizeStop[]): boolean {
  const eventsByParcel = new Map<string, { pickups: number; deliveries: number }>();
  for (const stop of stops) {
    for (const event of stop.parcelEvents ?? []) {
      if (
        typeof event.parcelId !== "string"
        || !event.parcelId.trim()
        || (event.kind !== "pickup" && event.kind !== "delivery")
      ) {
        return false;
      }
      const counts = eventsByParcel.get(event.parcelId) ?? { pickups: 0, deliveries: 0 };
      if (event.kind === "pickup") counts.pickups++;
      else counts.deliveries++;
      eventsByParcel.set(event.parcelId, counts);
    }
  }
  return Array.from(eventsByParcel.values()).every(
    ({ pickups, deliveries }) => pickups === 1 && deliveries === 1
  );
}

export function hasValidParcelEventOrder(
  stops: OptimizeStop[],
  orderedStopIds: string[]
): boolean {
  if (!hasCompleteParcelEventPairs(stops)) return false;
  const stopIds = new Set(stops.map((stop) => stop.id));
  if (
    orderedStopIds.length !== stops.length
    || new Set(orderedStopIds).size !== orderedStopIds.length
    || orderedStopIds.some((id) => !stopIds.has(id))
  ) {
    return false;
  }
  const orderIndex = new Map(orderedStopIds.map((id, index) => [id, index]));
  const pickupPosition = new Map<string, number>();
  const deliveryPosition = new Map<string, number>();

  for (const stop of stops) {
    for (const event of stop.parcelEvents ?? []) {
      const position = orderIndex.get(stop.id);
      if (position === undefined) return false;
      if (event.kind === "pickup") pickupPosition.set(event.parcelId, position);
      else deliveryPosition.set(event.parcelId, position);
    }
  }

  return Array.from(pickupPosition.entries()).every(([parcelId, pickup]) => {
    const delivery = deliveryPosition.get(parcelId);
    return delivery !== undefined && pickup < delivery;
  });
}

export type VehicleRouteResult = {
  vehicleId: string;
  orderedStopIds: string[];
  polyline: LatLng[];
  distanceMi: number;
  etaMinutes: number;
};

export type RouteCalculationSnapshot = {
  orderedStopIds: string[];
  stops: Array<{ id: string; name: string; lat: number; lng: number }>;
  distanceMi: number;
  durationMinutes: number;
  polyline?: LatLng[];
};

export type OptimizeResponse = {
  costSource?: "osrm" | "estimated";
  fallback?: boolean;
  fallbackReason?: string;
  orderedStopIds: string[];
  polyline: LatLng[];
  routes?: VehicleRouteResult[];
  baselineRoute?: RouteCalculationSnapshot;
  optimizedRoute?: RouteCalculationSnapshot;
  depot?: LatLng;
  destination?: LatLng;
  vehicleId?: string | null;
  distanceMi: number;
  etaMinutes: number;
  fuelSavingsPct: number;
  distanceSavedMi?: number;
  fuelEfficiencyKmPerL?: number | null;
  baselineFuelLiters?: number | null;
  optimizedFuelLiters?: number | null;
  fuelSavedLiters?: number | null;
  etaImprovementMin: number;
  engine: "or-tools" | "heuristic-fallback";
  baselineDistanceMi?: number;
  baselineEtaMinutes?: number;
};

// Sample payload for testing
export const SAMPLE_OPTIMIZATION_PAYLOAD: OptimizeRequest = {
  origin: { lat: 14.5995, lng: 120.9745 },
  destination: { lat: 14.5995, lng: 120.9745 },
  stops: [
    { id: "stop-1", lat: 14.6120, lng: 120.9842 },
    { id: "stop-2", lat: 14.5880, lng: 121.0244 },
  ],
};

// Client-side optimization function
export async function optimizeRoute(
  payload: OptimizeRequest
): Promise<OptimizeResponse> {
  const response = await fetch("/api/optimize-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({})) as Partial<OptimizeResponse> & { error?: string; details?: string };
  if (!response.ok) {
    throw new Error(result.details || result.error || `Optimization failed: ${response.statusText}`);
  }
  const expectedIds = payload.stops.map((stop) => stop.id);
  if ((result.engine !== "or-tools" && result.engine !== "heuristic-fallback")
    || !Array.isArray(result.orderedStopIds)
    || result.orderedStopIds.length !== expectedIds.length
    || new Set(result.orderedStopIds).size !== expectedIds.length
    || result.orderedStopIds.some((id) => !expectedIds.includes(id))) {
    throw new Error("The optimizer did not return a valid route for every selected stop.");
  }
  return result as OptimizeResponse;
}
