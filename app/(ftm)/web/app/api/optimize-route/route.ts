import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { OptimizeRequest, OptimizeResponse, LatLng, OptimizeStop, VehicleRouteResult } from "../../lib/optimize";
import { solveHeuristic } from "../../lib/heuristicSolver";

const PYTHON_TIMEOUT_MS = 6000;

async function fetchOsrmPolyline(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }>
): Promise<Array<{ lat: number; lng: number }> | null> {
  try {
    const coords = [
      [origin.lng, origin.lat],
      ...stops.map((stop) => [stop.lng, stop.lat]),
      [destination.lng, destination.lat],
    ];

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

  if (!body?.origin || !body?.destination) {
    return NextResponse.json(
      { error: "origin and destination are required" },
      { status: 400 }
    );
  }

  let result: OptimizeResponse;

  try {
    const solved = await runOrTools(body);
    const orderedStops = solved.orderedStopIds
      .map((id: string) => body.stops.find((s: any) => s.id === id))
      .filter(Boolean) as OptimizeStop[];

    const routeSegments = (solved.routes?.length ? solved.routes : [{
      vehicleId: "vehicle-1",
      orderedStopIds: solved.orderedStopIds,
      polyline: [
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
          .map((id: string) => body.stops.find((s: any) => s.id === id))
          .filter(Boolean)
          .map((stop: any) => ({ lat: stop.lat, lng: stop.lng })) as Array<{ lat: number; lng: number }>;

        const osrmRoutePolyline = await fetchOsrmPolyline(body.origin, body.destination, routeStops);
        const polyline = osrmRoutePolyline ?? route.polyline ?? [
          body.origin,
          ...routeStops,
          body.destination,
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
      .map((id: string) => body.stops.find((s: any) => s.id === id))
      .filter(Boolean)
      .map((stop: any) => ({ lat: stop.lat, lng: stop.lng })) as Array<{ lat: number; lng: number }>;

    const polyline = (await fetchOsrmPolyline(body.origin, body.destination, allOrderedStops)) ??
      routeResults[0]?.polyline ?? [
        body.origin,
        ...orderedStops.map((s: any) => ({ lat: s.lat, lng: s.lng })),
        body.destination,
      ];

    // Use the initial metrics if provided, otherwise calculate from naive order
    const baselineDistanceMi = body.initialDistanceMi ?? (() => {
      const pts = [body.origin, ...body.stops, body.destination];
      let d = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const R = 3958.8;
        const dLat = ((b.lat - a.lat) * Math.PI) / 180;
        const dLng = ((b.lng - a.lng) * Math.PI) / 180;
        const lat1 = (a.lat * Math.PI) / 180;
        const lat2 = (b.lat * Math.PI) / 180;
        const h =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        d += 2 * R * Math.asin(Math.sqrt(h));
      }
      return d;
    })();

    const baselineEtaMinutes = body.initialEtaMinutes ?? Math.round((baselineDistanceMi / 32) * 60);
    const etaImprovementMin = Math.max(0, baselineEtaMinutes - solved.etaMinutes);

    result = {
      orderedStopIds: solved.orderedStopIds,
      routes: routeResults,
      polyline,
      distanceMi: solved.distanceMi,
      etaMinutes: solved.etaMinutes,
      fuelSavingsPct: body.prioritizeFuelEfficiency ? 14.2 : 6.8,
      etaImprovementMin,
      engine: "or-tools",
    };
  } catch (err) {
    const fallback = solveHeuristic(body.origin, body.destination, body.stops, {
      vehicleCount: body.vehicleCount ?? Math.min(3, Math.max(1, body.stops.length)),
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

    const routePolyline = routePaths[0]?.polyline ?? fallback.polyline;
    const totalDistance = routePaths.reduce((total: number, route: any) => total + route.distanceMi, 0);
    const totalEta = routePaths.reduce((total: number, route: any) => total + route.etaMinutes, 0);

    // Use initial metrics if provided for ETA improvement calculation
    const fallbackBaselineEtaMinutes = body.initialEtaMinutes ?? 18;
    const fallbackEtaImprovementMin = Math.max(0, fallbackBaselineEtaMinutes - totalEta);

    result = {
      orderedStopIds: fallback.orderedStopIds,
      routes: routePaths,
      polyline: routePolyline,
      distanceMi: totalDistance,
      etaMinutes: totalEta,
      fuelSavingsPct: body.prioritizeFuelEfficiency ? 12.5 : 5.0,
      etaImprovementMin: fallbackEtaImprovementMin,
      engine: "heuristic-fallback",
    };
  }

  return NextResponse.json(result);
}
