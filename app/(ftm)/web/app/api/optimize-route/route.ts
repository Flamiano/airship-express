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
        cargoWeightKg: payload.cargoWeightKg,
        prioritizeFuelEfficiency: payload.prioritizeFuelEfficiency,
        optimizationMode: payload.optimizationMode,
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
    const solved = await runOrTools(normalizedBody);
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

    // Use the initial metrics if provided, otherwise calculate from naive order
    const baselineDistanceMi = body.initialDistanceMi ?? (() => {
      const pts = [normalizedBody.origin, ...normalizedBody.stops, normalizedBody.destination];
      return calculateRouteDistanceMi(pts);
    })();

    const baselineEtaMinutes = body.initialEtaMinutes ?? Math.round((baselineDistanceMi / 32) * 60);
    const etaImprovementMin = Math.max(0, baselineEtaMinutes - solved.etaMinutes);
    const fuelSavingsPct = computeFuelSavingsPct(baselineDistanceMi, solved.distanceMi || calculateRouteDistanceMi(polyline));

    result = {
      orderedStopIds: solved.orderedStopIds,
      routes: routeResults,
      polyline,
      distanceMi: solved.distanceMi,
      etaMinutes: solved.etaMinutes,
      fuelSavingsPct,
      etaImprovementMin,
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

    const routePolyline =
      routePaths[0]?.polyline?.length
        ? routePaths[0].polyline
        : fallback.polyline?.length
        ? fallback.polyline
        : warehouseFallbackPolyline;
    const totalDistance = routePaths.reduce((total: number, route: any) => total + route.distanceMi, 0);
    const totalEta = routePaths.reduce((total: number, route: any) => total + route.etaMinutes, 0);

    // Use initial metrics if provided for ETA improvement calculation
    const fallbackBaselineDistanceMi = body.initialDistanceMi ?? calculateRouteDistanceMi([
      normalizedBody.origin,
      ...normalizedBody.stops.map((stop: any) => ({ lat: stop.lat, lng: stop.lng })),
      normalizedBody.destination,
    ]);
    const fallbackBaselineEtaMinutes = body.initialEtaMinutes ?? Math.round((fallbackBaselineDistanceMi / 32) * 60);
    const fallbackEtaImprovementMin = Math.max(0, fallbackBaselineEtaMinutes - totalEta);
    const fallbackFuelSavingsPct = computeFuelSavingsPct(fallbackBaselineDistanceMi, totalDistance || fallbackBaselineDistanceMi);

    result = {
      orderedStopIds: fallback.orderedStopIds,
      routes: routePaths,
      polyline: routePolyline,
      distanceMi: totalDistance,
      etaMinutes: totalEta,
      fuelSavingsPct: fallbackFuelSavingsPct,
      etaImprovementMin: fallbackEtaImprovementMin,
      engine: "heuristic-fallback",
    };
  }

  return NextResponse.json(result);
}
