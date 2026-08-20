// Heuristic solver for route optimization fallback
import { LatLng, OptimizeStop, OptimizeResponse, VehicleRouteResult } from "./optimize";

interface HeuristicOptions {
  vehicleCount?: number;
  availableVehicles?: Array<{ id: string; [key: string]: any }>;
}

/**
 * Simple heuristic-based route solver as fallback when OR-Tools is unavailable
 * Uses nearest-neighbor algorithm for stop ordering
 */
export function solveHeuristic(
  origin: LatLng,
  destination: LatLng,
  stops: OptimizeStop[],
  options?: HeuristicOptions
): OptimizeResponse {
  // Calculate distance between two points (Haversine formula in miles)
  const calculateDistance = (p1: LatLng, p2: LatLng): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Estimate time in minutes (assuming ~25 mph average)
  const estimateTime = (distanceMiles: number): number => {
    return Math.round((distanceMiles / 25) * 60);
  };

  // Simple nearest neighbor algorithm
  const solveNearestNeighbor = (currentOrigin: LatLng): string[] => {
    const remaining = new Set(stops.map((s) => s.id));
    const ordered: string[] = [];
    let current = currentOrigin;

    while (remaining.size > 0) {
      let nearest: OptimizeStop | null = null;
      let minDist = Infinity;

      for (const stop of stops) {
        if (remaining.has(stop.id)) {
          const dist = calculateDistance(current, stop);
          if (dist < minDist) {
            minDist = dist;
            nearest = stop;
          }
        }
      }

      if (nearest) {
        ordered.push(nearest.id);
        remaining.delete(nearest.id);
        current = nearest;
      }
    }

    return ordered;
  };

  try {
    // For single route, use nearest neighbor
    if (!stops || stops.length === 0) {
      return {
        orderedStopIds: [],
        polyline: [],
        routes: [],
        distanceMi: 0,
        etaMinutes: 0,
        fuelSavingsPct: 0,
        etaImprovementMin: 0,
        engine: "heuristic-fallback",
      };
    }

    // Default to single route for simplicity
    const vehicleCount = options?.vehicleCount ?? 1;
    const orderedStopIds = solveNearestNeighbor(origin);

    // Calculate total distance and time
    let totalDistance = calculateDistance(origin, stops[0] || destination);
    for (let i = 0; i < orderedStopIds.length; i++) {
      const currentStop = stops.find((s) => s.id === orderedStopIds[i]);
      const nextStop = stops.find((s) => s.id === orderedStopIds[i + 1]) || destination;
      if (currentStop) {
        totalDistance += calculateDistance(currentStop, nextStop);
      }
    }

    const totalEta = estimateTime(totalDistance);

    // Build routes if multiple vehicles
    const routes: VehicleRouteResult[] =
      vehicleCount > 1
        ? orderedStopIds.reduce(
            (acc, stopId, idx) => {
              const routeIdx = idx % vehicleCount;
              if (!acc[routeIdx]) {
                acc[routeIdx] = {
                  vehicleId: options?.availableVehicles?.[routeIdx]?.id ?? `vehicle-${routeIdx + 1}`,
                  orderedStopIds: [],
                  polyline: [],
                  distanceMi: 0,
                  etaMinutes: 0,
                };
              }
              acc[routeIdx].orderedStopIds.push(stopId);
              return acc;
            },
            [] as VehicleRouteResult[]
          )
        : [];

    return {
      orderedStopIds,
      polyline: [], // Would require map API for actual polyline
      routes,
      distanceMi: Math.round(totalDistance * 10) / 10,
      etaMinutes: totalEta,
      fuelSavingsPct: 0,
      etaImprovementMin: 0,
      engine: "heuristic-fallback",
    };
  } catch (error) {
    console.error("Heuristic solver error:", error);
    return {
      orderedStopIds: stops.map((s) => s.id),
      polyline: [],
      routes: [],
      distanceMi: 0,
      etaMinutes: 0,
      fuelSavingsPct: 0,
      etaImprovementMin: 0,
      engine: "heuristic-fallback",
    };
  }
}
