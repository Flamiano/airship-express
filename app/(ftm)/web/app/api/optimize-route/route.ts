import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { OptimizeRequest, OptimizeResponse, LatLng, OptimizeStop, VehicleRouteResult } from "../../lib/optimize";
import { solveHeuristic } from "../../lib/heuristicSolver";

const PYTHON_TIMEOUT_MS = 6000;

function isValidLatLng(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== "object") return false;
  const point = value as { lat?: number; lng?: number };
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function buildWarehouseFirstPolyline(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  stops: Array<{ id?: string; kind?: "warehouse" | "parcel"; lat: number; lng: number }>
): Array<{ lat: number; lng: number }> {
  const warehouseStops = stops.filter((stop) => stop.kind === "warehouse");
  const parcelStops = stops.filter((stop) => stop.kind !== "warehouse");
  const orderedStops = [...warehouseStops, ...parcelStops];
  return [origin, ...orderedStops.map((stop) => ({ lat: stop.lat, lng: stop.lng })), destination];
}

async function fetchOsrmPolyline(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }>
): Promise<Array<{ lat: number; lng: number }> | null> {
  try {
    const safeStops = stops.filter((stop) => isValidLatLng(stop));
    const coords = [
      [origin.lng, origin.lat],
      ...safeStops.map((stop) => [stop.lng, stop.lat]),
      [destination.lng, destination.lat],
    ].filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat) && !(lat === 0 && lng === 0));

    if (coords.length < 2) return null;

    const url = new URL("https://router.project-osrm.org/route/v1/driving/" + coords.map((coord) => coord.join(",")).join(";"));
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("overview", "full");
    url.searchParams.set("steps", "false");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json = await res.json();
    const geometry = json?.routes?.[0]?.geometry;
    if (!geometry || geometry.type !== "LineString") return null;

    return geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
  } catch {
    return null;
  }
}

async function fetchOsrmCostMatrix(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }>
): Promise<{ distanceMatrix: number[][]; durationMatrix: number[][] } | null> {
  try {
    const coords = [origin, ...stops, destination]
      .filter((point) => isValidLatLng(point))
      .map((point) => `${point.lng},${point.lat}`);
    if (coords.length < 2) return null;

      const url = new URL(`https://router.project-osrm.org/table/v1/driving/${coords.join(";")}`);
    url.searchParams.set("annotations", "distance,duration");
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = await res.json();
    const distances = json?.distances;
    const durations = json?.durations;
    if (!Array.isArray(distances) || !Array.isArray(durations)) return null;
    if (distances.length !== coords.length || durations.length !== coords.length) return null;

      const distanceMatrix = distances.map((row: unknown[]) => row.map((value) => value == null ? Number.NaN : Number(value) / 1609.344));
      const durationMatrix = durations.map((row: unknown[]) => row.map((value) => value == null ? Number.NaN : Number(value) / 60));
      const validMatrix = (matrix: number[][]) => matrix.every((row) => row.length === coords.length && row.every(Number.isFinite));
    return validMatrix(distanceMatrix) && validMatrix(durationMatrix) ? { distanceMatrix, durationMatrix } : null;
  } catch {
    return null;
  }
}

function calcDistanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function calculateRouteDistanceMi(points: Array<{ lat: number; lng: number }>): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calcDistanceMiles(points[i], points[i + 1]);
  }
  return total;
}

function roundDistanceMi(value: number): number {
  return Math.round(value * 10) / 10;
}

function computeFuelSavingsPct(baselineDistanceMi: number, optimizedDistanceMi: number): number {
  if (!Number.isFinite(baselineDistanceMi) || baselineDistanceMi <= 0) return 0;
  const savingsPct = ((baselineDistanceMi - optimizedDistanceMi) / baselineDistanceMi) * 100;
  if (!Number.isFinite(savingsPct)) return 0;
  return Math.max(0, Math.min(100, savingsPct));
}

function runOrTools(payload: OptimizeRequest): Promise<{
  orderedStopIds: string[];
  routes?: Array<{
    vehicleId: string;
    orderedStopIds: string[];
    polyline: Array<{ lat: number; lng: number }>;
    distanceMi: number;
    etaMinutes: number;
  }>;
  distanceMi: number;
  etaMinutes: number;
}> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "python", "optimize.py");
    const pythonCommand = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "py" : "python3");
    const pythonArgs =
      process.platform === "win32" && !process.env.PYTHON_EXECUTABLE
        ? ["-3", scriptPath]
        : [scriptPath];
    const proc = spawn(pythonCommand, pythonArgs);

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("OR-Tools process timed out"));
    }, PYTHON_TIMEOUT_MS);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || `optimize.py exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });

    proc.stdin.write(
      JSON.stringify({
        origin: payload.origin,
        destination: payload.destination,
        stops: payload.stops,
        availableVehicles: payload.availableVehicles,
        vehicleCount: payload.vehicleCount,
        cargoWeightKg: payload.cargoWeightKg,
        prioritizeFuelEfficiency: payload.prioritizeFuelEfficiency,
        optimizationMode: payload.optimizationMode,
        distanceMatrix: payload.distanceMatrix,
        durationMatrix: payload.durationMatrix,
      })
    );
    proc.stdin.end();
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as OptimizeRequest;
  const safeOrigin = isValidLatLng(body?.origin) ? body.origin : null;
  const safeDestination = isValidLatLng(body?.destination) ? body.destination : null;
  const safeStops = Array.isArray(body?.stops) ? body.stops.filter((stop: any) => isValidLatLng(stop)) : [];

  if (!safeOrigin || !safeDestination) {
    return NextResponse.json(
      { error: "origin and destination are required" },
      { status: 400 }
    );
  }

  const normalizedBody = {
    ...body,
    origin: safeOrigin,
    destination: safeDestination,
    stops: safeStops,
  };

  let result: OptimizeResponse;

  try {
    const roadCosts = await fetchOsrmCostMatrix(normalizedBody.origin, normalizedBody.destination, normalizedBody.stops);
    const solved = await runOrTools({
      ...normalizedBody,
      distanceMatrix: roadCosts?.distanceMatrix,
      durationMatrix: roadCosts?.durationMatrix,
    });
    const orderedStops = solved.orderedStopIds
      .map((id: string) => normalizedBody.stops.find((s: any) => s.id === id))
      .filter(Boolean) as OptimizeStop[];

    const directFallbackPolyline = buildWarehouseFirstPolyline(
      normalizedBody.origin,
      normalizedBody.destination,
      normalizedBody.stops.map((stop: any) => ({ id: stop.id, kind: stop.kind, lat: stop.lat, lng: stop.lng }))
    );

    const routeSegments = (solved.routes?.length ? solved.routes : [{
      vehicleId: "vehicle-1",
      orderedStopIds: solved.orderedStopIds,
      polyline: body.stops.some((stop: any) => stop.kind === "warehouse") ? directFallbackPolyline : [
        body.origin,
        ...orderedStops.map((s: any) => ({ lat: s.lat, lng: s.lng })),
        body.destination,
      ],
      distanceMi: solved.distanceMi,
      etaMinutes: solved.etaMinutes,
    }]) as Array<{
      vehicleId: string;
      orderedStopIds: string[];
      polyline: Array<{ lat: number; lng: number }>;
      distanceMi: number;
      etaMinutes: number;
    }>;

    const routeResults = await Promise.all(
      routeSegments.map(async (route) => {
        const routeStops = (route.orderedStopIds || [])
          .map((id: string) => normalizedBody.stops.find((s: any) => s.id === id))
          .filter(Boolean)
          .map((stop: any) => ({ lat: stop.lat, lng: stop.lng })) as Array<{ lat: number; lng: number }>;

        const osrmRoutePolyline = await fetchOsrmPolyline(normalizedBody.origin, normalizedBody.destination, routeStops);
        const polyline = osrmRoutePolyline ?? route.polyline ?? [
          normalizedBody.origin,
          ...routeStops,
          normalizedBody.destination,
        ];

        return {
          ...route,
          polyline,
        };
      })
    );

    const allOrderedStopIds = solved.routes?.length
      ? solved.routes.flatMap((route) => route.orderedStopIds || [])
      : solved.orderedStopIds;

    const allOrderedStops = (allOrderedStopIds || [])
      .map((id: string) => normalizedBody.stops.find((s: any) => s.id === id))
      .filter(Boolean)
      .map((stop: any) => ({ lat: stop.lat, lng: stop.lng })) as Array<{ lat: number; lng: number }>;

    const polyline = (await fetchOsrmPolyline(normalizedBody.origin, normalizedBody.destination, allOrderedStops.length ? allOrderedStops : normalizedBody.stops.map((stop: any) => ({ lat: stop.lat, lng: stop.lng })))) ??
      routeResults[0]?.polyline ??
      (normalizedBody.stops.some((stop: any) => stop.kind === "warehouse") ? buildWarehouseFirstPolyline(normalizedBody.origin, normalizedBody.destination, normalizedBody.stops) : [
        normalizedBody.origin,
        ...orderedStops.map((s: any) => ({ lat: s.lat, lng: s.lng })),
        normalizedBody.destination,
      ]);

    // Use the initial metrics if provided, otherwise calculate a straight-line fallback.
    const straightLineBaselineMi = (() => {
      const pts = [normalizedBody.origin, ...normalizedBody.stops, normalizedBody.destination];
      return calculateRouteDistanceMi(pts);
    })();

    const baselinePolyline = await fetchOsrmPolyline(
      normalizedBody.origin,
      normalizedBody.destination,
      normalizedBody.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))
    );
    const matrixRouteCost = (orderedIds: string[], matrix: number[][] | undefined) => {
      if (!matrix || matrix.length !== normalizedBody.stops.length + 2) return 0;
      const stopIndex = new Map(normalizedBody.stops.map((stop: any, index: number) => [stop.id, index + 1]));
      const indexes = [0, ...orderedIds.map((id) => stopIndex.get(id)).filter((index): index is number => index !== undefined), normalizedBody.stops.length + 1];
      return indexes.slice(0, -1).reduce((total, from, index) => total + (matrix[from]?.[indexes[index + 1]] || 0), 0);
    };
    const matrixRouteTotal = (matrix: number[][] | undefined) => solved.routes?.length
      ? solved.routes.reduce((total, route) => total + matrixRouteCost(route.orderedStopIds || [], matrix), 0)
      : matrixRouteCost(solved.orderedStopIds, matrix);
    const baselineRoadDistanceMi = roadCosts?.distanceMatrix
      ? matrixRouteCost(normalizedBody.stops.map((stop: any) => stop.id), roadCosts.distanceMatrix)
      : baselinePolyline?.length
      ? calculateRouteDistanceMi(baselinePolyline)
      : 0;
    const displayedRoadDistanceMi = roadCosts?.distanceMatrix
      ? matrixRouteTotal(roadCosts.distanceMatrix)
      : calculateRouteDistanceMi(polyline);
    const baselineRoadDurationMin = roadCosts?.durationMatrix
      ? matrixRouteCost(normalizedBody.stops.map((stop: any) => stop.id), roadCosts.durationMatrix)
      : 0;
    const displayedRoadDurationMin = roadCosts?.durationMatrix
      ? solved.routes?.length
        ? Math.max(...solved.routes.map((route) => matrixRouteCost(route.orderedStopIds || [], roadCosts.durationMatrix)))
        : matrixRouteCost(solved.orderedStopIds, roadCosts.durationMatrix)
      : 0;
    const baselineDistanceMi = roundDistanceMi(body.initialDistanceMi
      ?? (baselineRoadDistanceMi > 0 ? baselineRoadDistanceMi : straightLineBaselineMi));
    const baselineEtaMinutes = body.initialEtaMinutes
      ?? (baselineRoadDurationMin > 0
        ? Math.max(1, Math.round(baselineRoadDurationMin))
        : Math.max(1, Math.round((baselineDistanceMi / 32) * 60)));
    const displayedEtaMinutes = displayedRoadDurationMin > 0
      ? Math.max(1, Math.round(displayedRoadDurationMin))
      : Math.max(1, Math.round((displayedRoadDistanceMi / 32) * 60));
    const isTimeObjective = body.optimizationMode === "fastest" || body.optimizationMode === "balanced";
    const useBaselineRoute = baselineRoadDistanceMi > 0 && (isTimeObjective
      ? displayedEtaMinutes > baselineEtaMinutes
      : displayedRoadDistanceMi > baselineDistanceMi);
    const selectedRoadPolyline = useBaselineRoute && baselinePolyline?.length ? baselinePolyline : polyline;
    const selectedRoadDistanceMi = roadCosts?.distanceMatrix
      ? roundDistanceMi(useBaselineRoute ? baselineRoadDistanceMi : displayedRoadDistanceMi)
      : roundDistanceMi(calculateRouteDistanceMi(selectedRoadPolyline));
    const selectedRoadEtaMinutes = Math.max(1, Math.round(roadCosts?.durationMatrix
      ? useBaselineRoute ? baselineRoadDurationMin : displayedRoadDurationMin
      : (selectedRoadDistanceMi / 32) * 60));
    result = {
      orderedStopIds: solved.orderedStopIds,
      routes: routeResults,
      polyline: selectedRoadPolyline,
      distanceMi: selectedRoadDistanceMi > 0 ? selectedRoadDistanceMi : solved.distanceMi,
      etaMinutes: selectedRoadDistanceMi > 0 ? selectedRoadEtaMinutes : solved.etaMinutes,
      fuelSavingsPct: computeFuelSavingsPct(
        baselineDistanceMi,
        selectedRoadDistanceMi > 0 ? selectedRoadDistanceMi : solved.distanceMi
      ),
      etaImprovementMin: Math.max(0, baselineEtaMinutes - (selectedRoadDistanceMi > 0 ? selectedRoadEtaMinutes : solved.etaMinutes)),
      baselineDistanceMi,
      baselineEtaMinutes,
      engine: "or-tools",
    };
  } catch (err) {
    const fallback = solveHeuristic(normalizedBody.origin, normalizedBody.destination, normalizedBody.stops, {
      vehicleCount: body.vehicleCount ?? Math.min(3, Math.max(1, normalizedBody.stops.length)),
      availableVehicles: body.availableVehicles,
    });

    const routePaths = fallback.routes?.length
      ? fallback.routes?.map((route: VehicleRouteResult) => ({
          vehicleId: route.vehicleId,
          orderedStopIds: route.orderedStopIds,
          polyline: route.polyline,
          distanceMi: route.distanceMi,
          etaMinutes: route.etaMinutes,
        }))
      : [
          {
            vehicleId: "vehicle-1",
            orderedStopIds: fallback.orderedStopIds,
            polyline: fallback.polyline,
            distanceMi: fallback.distanceMi,
            etaMinutes: fallback.etaMinutes,
          },
        ];

    const fallbackOrderedStops = (fallback.orderedStopIds || [])
      .map((id: string) => normalizedBody.stops.find((stop: any) => stop.id === id))
      .filter(Boolean)
      .map((stop: any) => ({ lat: stop.lat, lng: stop.lng }));

    const warehouseFallbackPolyline = normalizedBody.stops.some((stop: any) => stop.kind === "warehouse")
      ? buildWarehouseFirstPolyline(normalizedBody.origin, normalizedBody.destination, normalizedBody.stops)
      : [
          normalizedBody.origin,
          ...fallbackOrderedStops,
          normalizedBody.destination,
        ];

    const osrmFallbackPolyline = await fetchOsrmPolyline(
      normalizedBody.origin,
      normalizedBody.destination,
      fallbackOrderedStops
    );
    const baselineFallbackPolyline = await fetchOsrmPolyline(
      normalizedBody.origin,
      normalizedBody.destination,
      normalizedBody.stops.map((stop: any) => ({ lat: stop.lat, lng: stop.lng }))
    );
    const generatedFallbackPolyline = osrmFallbackPolyline?.length
      ? osrmFallbackPolyline
      : routePaths[0]?.polyline?.length
      ? routePaths[0].polyline
      : fallback.polyline?.length
      ? fallback.polyline
      : warehouseFallbackPolyline;
    const generatedFallbackDistanceMi = calculateRouteDistanceMi(generatedFallbackPolyline);
    const baselineFallbackDistanceMi = baselineFallbackPolyline?.length
      ? calculateRouteDistanceMi(baselineFallbackPolyline)
      : calculateRouteDistanceMi([
          normalizedBody.origin,
          ...normalizedBody.stops.map((stop: any) => ({ lat: stop.lat, lng: stop.lng })),
          normalizedBody.destination,
        ]);
    const routePolyline = generatedFallbackDistanceMi > baselineFallbackDistanceMi && baselineFallbackPolyline?.length
      ? baselineFallbackPolyline
      : generatedFallbackPolyline;
    const selectedDistanceMi = roundDistanceMi(calculateRouteDistanceMi(routePolyline));
    const selectedEtaMinutes = Math.max(1, Math.round((selectedDistanceMi / 32) * 60));
    const roadRoutePaths = routePaths.map((route, index) => ({
      ...route,
      polyline: index === 0 ? routePolyline : route.polyline,
      distanceMi: index === 0
        ? selectedDistanceMi
        : route.distanceMi,
      etaMinutes: index === 0
        ? selectedEtaMinutes
        : route.etaMinutes,
    }));
    const totalDistance = selectedDistanceMi;
    const totalEta = selectedEtaMinutes;

    // Use initial metrics if provided for ETA improvement calculation
    const fallbackBaselineDistanceMi = roundDistanceMi(body.initialDistanceMi ?? baselineFallbackDistanceMi);
    const fallbackBaselineEtaMinutes = body.initialEtaMinutes ?? Math.round((fallbackBaselineDistanceMi / 32) * 60);
    const fallbackEtaImprovementMin = Math.max(0, fallbackBaselineEtaMinutes - totalEta);
    const fallbackFuelSavingsPct = computeFuelSavingsPct(fallbackBaselineDistanceMi, totalDistance || fallbackBaselineDistanceMi);

    result = {
      orderedStopIds: fallback.orderedStopIds,
      routes: roadRoutePaths,
      polyline: routePolyline,
      distanceMi: totalDistance,
      etaMinutes: totalEta,
      fuelSavingsPct: fallbackFuelSavingsPct,
      etaImprovementMin: fallbackEtaImprovementMin,
      baselineDistanceMi: fallbackBaselineDistanceMi,
      baselineEtaMinutes: fallbackBaselineEtaMinutes,
      engine: "heuristic-fallback",
    };
  }

  return NextResponse.json(result);
}
