import { NextResponse } from "next/server";
import { hasPermission } from "../../../../lib/permissions";
import { parseMeasuredFuelLiters } from "../../../../lib/fuelConsumptionMeasurement";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";
import { normalizeTrip } from "../../../../lib/server/ftmTrips";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "fuelManagement", "update")) {
    return NextResponse.json({ error: "Permission denied: fuelManagement.update" }, { status: 403 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const payload = body as { actual_fuel_consumed_liters?: unknown };
  const liters = parseMeasuredFuelLiters(payload.actual_fuel_consumed_liters);
  if (liters == null) {
    return NextResponse.json({ error: "Actual fuel consumed must be a finite number greater than zero." }, { status: 400 });
  }

  const { data: trip, error: tripError } = await context.serviceClient
    .from("trips")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (tripError) return NextResponse.json({ error: `Unable to load trip: ${tripError.message}` }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  if (!["completed", "delivered"].includes(String(trip.status || "").toLowerCase())) {
    return NextResponse.json({ error: "Fuel consumption can only be recorded for a completed trip." }, { status: 409 });
  }

  const { data, error } = await context.serviceClient
    .from("trips")
    .update({ actual_fuel_consumed_liters: liters, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", trip.status)
    .select("*")
    .maybeSingle();
  if (error) {
    if (/actual_fuel_consumed_liters.*(?:does not exist|schema cache)|schema cache.*actual_fuel_consumed_liters/i.test(error.message)) {
      return NextResponse.json({ error: "The trip table is missing the fuel-consumption column. Apply the FTM fuel-consumption migration, then retry." }, { status: 503 });
    }
    return NextResponse.json({ error: `Unable to save fuel consumption: ${error.message}` }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Trip status changed before the measurement could be saved. Reload and retry." }, { status: 409 });

  return NextResponse.json(normalizeTrip(data));
}
