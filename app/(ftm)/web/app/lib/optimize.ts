// Optimization route types and utilities
export type LatLng = {
  lat: number;
  lng: number;
};

export type OptimizeStop = {
  id: string;
  lat: number;
  lng: number;
};

export type OptimizeRequest = {
  origin: LatLng;
  destination: LatLng;
  stops: OptimizeStop[];
  vehicleCount?: number;
  availableVehicles?: Array<{ id: string; [key: string]: any }>;
  prioritizeFuelEfficiency?: boolean;
  cargoWeightKg?: number;
  initialDistanceMi?: number;
  initialEtaMinutes?: number;
};

export type VehicleRouteResult = {
  vehicleId: string;
  orderedStopIds: string[];
  polyline: LatLng[];
  distanceMi: number;
  etaMinutes: number;
};

export type OptimizeResponse = {
  orderedStopIds: string[];
  polyline: LatLng[];
  routes?: VehicleRouteResult[];
  distanceMi: number;
  etaMinutes: number;
  fuelSavingsPct: number;
  etaImprovementMin: number;
  engine: "or-tools" | "heuristic-fallback";
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
  try {
    const response = await fetch("/api/optimize-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Optimization failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error optimizing route:", error);
    // Return fallback response
    return {
      orderedStopIds: payload.stops.map((s) => s.id),
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
