import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { runFtmRouteOptimizer } from "../../lib/server/ftmRoutePlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Point = { name?: string; lat: number; lng: number; [key: string]: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePoint(value: unknown): Point | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { ...value, lat, lng } : null;
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "vrds", "create")) {
    return NextResponse.json({ error: "Permission denied: vrds.create" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const depot = normalizePoint(body.depot);
  if (!depot || !Array.isArray(body.stops)) return NextResponse.json({ error: "Invalid optimization payload" }, { status: 400 });
  const stops = body.stops.map(normalizePoint).filter((stop): stop is Point => stop !== null);
  if (!stops.length) return NextResponse.json({ error: "At least one stop with coordinates is required" }, { status: 400 });

  let result;
  try {
    result = await runFtmRouteOptimizer(depot, stops, {
      numVehicles: Number(body.num_vehicles || 1),
      vehicleCapacities: Array.isArray(body.vehicle_capacities) ? body.vehicle_capacities.map(Number) : undefined,
    });
  } catch (error) {
    const failure = error as Error & { status?: number; details?: unknown };
    console.error("[optimize] Python OR-Tools optimization failed", {
      message: failure.message || String(error),
      status: failure.status,
      details: failure.details,
    });
    return NextResponse.json({
      error: "Unable to optimize route.",
      details: failure.message || "Python OR-Tools failed to solve this route.",
    }, { status: failure.status || 502 });
  }

  if (result.used_ortools) {
    try {
      const { data, error } = await auth.context.serviceClient.from("optimized_routes").insert({
        trip_id: body.trip_id || null,
        route_geojson: { order: result.order, routes: result.routes || null },
        distance_km: result.distance_km ?? result.distanceKm ?? null,
        estimated_duration_min: result.duration_min ?? null,
        generated_by: result.solver || "OR-Tools service",
      }).select("*").maybeSingle();
      if (error) console.warn("Failed to persist optimized route:", error.message);
      else if (data?.id) {
        result.saved_id = data.id;
        if (body.trip_id) {
          const { error: tripError } = await auth.context.serviceClient.from("trips").update({ optimized_route_id: data.id }).eq("id", body.trip_id);
          if (tripError) console.warn("Failed to reference optimized route from trip:", tripError.message);
        }
      }
    } catch (error) {
      console.warn("Failed to persist optimized route:", error);
    }
  }
  return NextResponse.json(result);
}