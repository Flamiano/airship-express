import {
  hasCompleteParcelEventPairs,
  hasValidParcelEventOrder,
} from "./optimize";
import type {
  LatLng,
  OptimizeRequest,
  OptimizeResponse,
  OptimizeStop,
  VehicleRouteResult,
} from "./optimize";
type HeuristicOptions = Pick<
  OptimizeRequest,
  | "vehicleCount"
  | "availableVehicles"
  | "cargoWeightKg"
  | "vehicleCapacityKg"
  | "distanceMatrix"
  | "durationMatrix"
  | "fuelEfficiencyKmPerL"
  | "optimizationMode"
>;
type CostMatrices = { distanceMatrix: number[][]; durationMatrix: number[][] };
type RouteMetrics = { distanceMi: number; etaMinutes: number };

function haversineMiles(from: LatLng, to: LatLng) {
  const radians = Math.PI / 180;
  const latitudeDelta = (to.lat - from.lat) * radians;
  const longitudeDelta = (to.lng - from.lng) * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(from.lat * radians) *
      Math.cos(to.lat * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 3958.7613 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function estimateCostMatrices(points: LatLng[]): CostMatrices {
  const distanceMatrix = points.map((from, fromIndex) =>
    points.map((to, toIndex) => {
      if (fromIndex === toIndex) return 0;
      return haversineMiles(from, to) * 1.3;
    })
  );
  const durationMatrix = distanceMatrix.map((row) =>
    row.map((distanceMiles) => (distanceMiles * 60) / 30)
  );
  return { distanceMatrix, durationMatrix };
}

function isValidMatrix(matrix: number[][], size: number) {
  return (
    matrix.length === size &&
    matrix.every(
      (row) =>
        row.length === size &&
        row.every((value) => Number.isFinite(value) && value >= 0)
    )
  );
}

function getCostMatrices(
  points: LatLng[],
  options?: HeuristicOptions
): CostMatrices {
  const distanceMatrix = options?.distanceMatrix;
  const durationMatrix = options?.durationMatrix;
  if ((distanceMatrix === undefined) !== (durationMatrix === undefined)) {
    throw new Error("Distance and duration matrices must be supplied together.");
  }
  if (distanceMatrix === undefined || durationMatrix === undefined) {
    return estimateCostMatrices(points);
  }
  if (
    !isValidMatrix(distanceMatrix, points.length) ||
    !isValidMatrix(durationMatrix, points.length)
  ) {
    throw new Error("The optimizer cost matrices are invalid.");
  }
  return { distanceMatrix, durationMatrix };
}

export function solveHeuristic(
  origin: LatLng,
  destination: LatLng,
  stops: OptimizeStop[],
  options?: HeuristicOptions
): OptimizeResponse & { routes: VehicleRouteResult[] } {
  if (!stops.length) throw new Error("At least one route stop is required.");
  if (new Set(stops.map((stop) => stop.id)).size !== stops.length) {
    throw new Error("Route stop IDs must be unique.");
  }
  if (!hasCompleteParcelEventPairs(stops)) {
    throw new Error("Every parcel route needs exactly one pickup and one delivery stop.");
  }

  const points = [origin, ...stops, destination];
  const { distanceMatrix, durationMatrix } = getCostMatrices(points, options);
  const stopIndex = new Map(stops.map((stop, index) => [stop.id, index + 1]));
  const destinationIndex = points.length - 1;
  const baselineStopIds = stops.map((stop) => stop.id);
  const routeMetrics = (orderedStopIds: string[]): RouteMetrics => {
    const indexes = [
      0,
      ...orderedStopIds.map((id) => {
        const index = stopIndex.get(id);
        if (index === undefined) throw new Error(`Unknown route stop ID: ${id}`);
        return index;
      }),
      destinationIndex,
    ];
    return indexes.slice(0, -1).reduce(
      (metrics, from, index) => ({
        distanceMi: metrics.distanceMi + distanceMatrix[from][indexes[index + 1]],
        etaMinutes: metrics.etaMinutes + durationMatrix[from][indexes[index + 1]],
      }),
      { distanceMi: 0, etaMinutes: 0 }
    );
  };

  const baselineMetrics = routeMetrics(baselineStopIds);
  const mode = options?.optimizationMode || "fastest";
  const distanceScale = Math.max(baselineMetrics.distanceMi, 1);
  const durationScale = Math.max(baselineMetrics.etaMinutes, 1);
  const objective = (metrics: RouteMetrics) => {
    if (mode === "shortest" || mode === "fuel") return metrics.distanceMi;
    if (mode === "balanced") {
      return metrics.distanceMi / distanceScale + metrics.etaMinutes / durationScale;
    }
    return metrics.etaMinutes;
  };
  const edgeObjective = (from: number, to: number) =>
    objective({
      distanceMi: distanceMatrix[from][to],
      etaMinutes: durationMatrix[from][to],
    });

  const cargoWeightKg = Number(options?.cargoWeightKg);
  const vehicleCapacityKg = Number(
    options?.vehicleCapacityKg ?? options?.availableVehicles?.[0]?.capacityKg
  );
  if (
    Number.isFinite(cargoWeightKg)
    && cargoWeightKg > 0
    && Number.isFinite(vehicleCapacityKg)
    && vehicleCapacityKg > 0
    && cargoWeightKg > vehicleCapacityKg
  ) {
    throw new Error(`Cargo load (${cargoWeightKg} kg) exceeds vehicle capacity (${vehicleCapacityKg} kg).`);
  }

  const remaining = new Set(stops.map((stop) => stop.id));
  const nearestNeighborOrder: string[] = [];
  const pickedUpParcels = new Set<string>();
  let currentIndex = 0;
  while (remaining.size) {
    let nearestId: string | null = null;
    let nearestIndex = -1;
    let nearestCost = Number.POSITIVE_INFINITY;
    for (const stop of stops) {
      if (!remaining.has(stop.id)) continue;
      const eligible = (stop.parcelEvents ?? []).every(
        (event) => event.kind !== "delivery" || pickedUpParcels.has(event.parcelId)
      );
      if (!eligible) continue;
      const candidateIndex = stopIndex.get(stop.id)!;
      const cost = edgeObjective(currentIndex, candidateIndex);
      if (cost < nearestCost) {
        nearestId = stop.id;
        nearestIndex = candidateIndex;
        nearestCost = cost;
      }
    }
    if (nearestId === null) throw new Error("Unable to order every route stop.");
    nearestNeighborOrder.push(nearestId);
    remaining.delete(nearestId);
    for (const event of stops[nearestIndex - 1].parcelEvents ?? []) {
      if (event.kind === "pickup") pickedUpParcels.add(event.parcelId);
    }
    currentIndex = nearestIndex;
  }
  if (!hasValidParcelEventOrder(stops, nearestNeighborOrder)) {
    throw new Error("Parcel pickup stops must appear before their corresponding delivery stops.");
  }

  const vehicleCountInput = options?.vehicleCount ?? 1;
  const requestedVehicleCount = Number.isFinite(vehicleCountInput)
    ? Math.floor(vehicleCountInput)
    : 1;
  const vehicleCount = Math.min(stops.length, Math.max(1, requestedVehicleCount));
  if (vehicleCount > 1 && stops.some((stop) => stop.parcelEvents?.length)) {
    throw new Error("Parcel pickup and delivery routes require a single vehicle.");
  }
  const routeOrders = Array.from({ length: vehicleCount }, () => [] as string[]);
  nearestNeighborOrder.forEach((id, index) => {
    routeOrders[index % vehicleCount].push(id);
  });

  const improveRoute = (initialOrder: string[]) => {
    let order = initialOrder;
    const maxPasses = Math.min(20, order.length);
    for (let pass = 0; pass < maxPasses; pass++) {
      let bestOrder = order;
      let bestCost = objective(routeMetrics(order));
      for (let start = 0; start < order.length - 1; start++) {
        for (let end = start + 1; end < order.length; end++) {
          const candidate = [
            ...order.slice(0, start),
            ...order.slice(start, end + 1).reverse(),
            ...order.slice(end + 1),
          ];
          if (!hasValidParcelEventOrder(stops, candidate)) continue;
          const candidateCost = objective(routeMetrics(candidate));
          if (candidateCost < bestCost - 1e-9) {
            bestCost = candidateCost;
            bestOrder = candidate;
          }
        }
      }
      if (bestOrder === order) break;
      order = bestOrder;
    }
    return order;
  };

  const optimizedOrders = routeOrders.map(improveRoute);
  const routes = optimizedOrders.map((orderedStopIds, index) => {
    const metrics = routeMetrics(orderedStopIds);
    const orderedStops = orderedStopIds.map((id) => stops[stopIndex.get(id)! - 1]);
    return {
      vehicleId: options?.availableVehicles?.[index]?.id ?? `vehicle-${index + 1}`,
      orderedStopIds,
      polyline: [origin, ...orderedStops, destination],
      ...metrics,
    };
  });
  const orderedStopIds = optimizedOrders.flat();
  const totalDistanceMi = routes.reduce((total, route) => total + route.distanceMi, 0);
  const etaMinutes = Math.max(...routes.map((route) => route.etaMinutes));
  const fuelEfficiencyKmPerL = Number(
    options?.fuelEfficiencyKmPerL ?? options?.availableVehicles?.[0]?.fuelEfficiencyKmPerL
  );
  const validFuelEfficiency = Number.isFinite(fuelEfficiencyKmPerL) && fuelEfficiencyKmPerL > 0
    ? fuelEfficiencyKmPerL
    : null;
  const baselineFuelLiters = validFuelEfficiency === null
    ? null
    : baselineMetrics.distanceMi * 1.609344 / validFuelEfficiency;
  const optimizedFuelLiters = validFuelEfficiency === null
    ? null
    : totalDistanceMi * 1.609344 / validFuelEfficiency;

  return {
    orderedStopIds,
    routes,
    polyline: [origin, ...orderedStopIds.map((id) => stops[stopIndex.get(id)! - 1]), destination],
    distanceMi: totalDistanceMi,
    etaMinutes,
    baselineDistanceMi: baselineMetrics.distanceMi,
    baselineEtaMinutes: baselineMetrics.etaMinutes,
    distanceSavedMi: baselineMetrics.distanceMi - totalDistanceMi,
    fuelEfficiencyKmPerL: validFuelEfficiency,
    baselineFuelLiters,
    optimizedFuelLiters,
    fuelSavedLiters:
      baselineFuelLiters === null || optimizedFuelLiters === null
        ? null
        : baselineFuelLiters - optimizedFuelLiters,
    fuelSavingsPct:
      baselineMetrics.distanceMi > 0
        ? ((baselineMetrics.distanceMi - totalDistanceMi) / baselineMetrics.distanceMi) * 100
        : 0,
    etaImprovementMin: Math.max(0, Math.round(baselineMetrics.etaMinutes - etaMinutes)),
    engine: "heuristic-fallback",
  };
}
