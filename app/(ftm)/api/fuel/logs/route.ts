import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { normalizeFuelLogs } from "../../../lib/fuelLogNormalization";

export const dynamic = "force-dynamic";

async function fetchFuelRows(
  loadPage: (from: number, to: number) => PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  }>,
) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await loadPage(from, from + 999);
    if (error) return { rows, error: error.message };
    const page = data || [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return { rows, error: null };
}

function numericInput(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function optionalText(...values: unknown[]) {
  const value = values.find((candidate) => candidate != null && String(candidate).trim() !== "");
  if (typeof value !== "string" && typeof value !== "number") return null;
  return String(value).trim() || null;
}

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "fuelManagement", "view")) {
    return NextResponse.json({ error: "Permission denied: fuelManagement.view" }, { status: 403 });
  }
  const [costEntries, legacyFuelLogs] = await Promise.all([
    fetchFuelRows((from, to) => auth.context.serviceClient
      .from("cost_entries")
      .select("*")
      .ilike("category", "fuel")
      .order("entry_date", { ascending: false })
      .range(from, to)),
    fetchFuelRows((from, to) => auth.context.serviceClient
      .from("fuel_logs")
      .select("*")
      .order("logged_at", { ascending: false })
      .range(from, to)),
  ]);
  const sourceErrors = [
    costEntries.error ? `Fuel expense ledger unavailable: ${costEntries.error}` : null,
    legacyFuelLogs.error ? `Legacy fuel records unavailable: ${legacyFuelLogs.error}` : null,
  ].filter((message): message is string => Boolean(message));
  if (sourceErrors.length === 2) {
    return NextResponse.json({ error: sourceErrors.join("; ") }, { status: 500 });
  }
  return NextResponse.json({
    rows: normalizeFuelLogs(costEntries.rows, legacyFuelLogs.rows),
    sourceErrors,
  });
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "fuelManagement", "create")) {
    return NextResponse.json({ error: "Permission denied: fuelManagement.create" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const vehicleId = optionalText(body.vehicleId);
  const driverId = optionalText(body.driverId);
  const tripId = optionalText(body.tripId);
  const liters = numericInput(body.liters);
  const pricePerLiter = numericInput(body.pricePerLiter ?? body.price_per_liter);
  const amount = numericInput(body.cost ?? body.amount);
  const calculatedAmount = liters != null && liters > 0 && pricePerLiter != null && pricePerLiter > 0
    ? liters * pricePerLiter
    : null;
  if (!vehicleId || (liters != null && (!Number.isFinite(liters) || liters <= 0))
    || (pricePerLiter != null && (!Number.isFinite(pricePerLiter) || pricePerLiter <= 0))
    || (amount != null && (!Number.isFinite(amount) || amount <= 0))
    || (amount == null && calculatedAmount == null)) {
    return NextResponse.json({ error: "A vehicle and a recorded fuel amount or liters with price per liter are required" }, { status: 400 });
  }
  const { data: vehicle, error: vehicleError } = await auth.context.serviceClient
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .maybeSingle();
  if (vehicleError) return NextResponse.json({ error: `Unable to validate fuel vehicle: ${vehicleError.message}` }, { status: 500 });
  if (!vehicle) return NextResponse.json({ error: "The selected vehicle does not exist." }, { status: 400 });

  let linkedTrip: Record<string, unknown> | null = null;
  if (tripId) {
    const { data: trip, error: tripError } = await auth.context.serviceClient
      .from("trips")
      .select("id,vehicle_id,driver_id")
      .eq("id", tripId)
      .maybeSingle();
    if (tripError) return NextResponse.json({ error: `Unable to validate fuel trip: ${tripError.message}` }, { status: 500 });
    if (!trip) return NextResponse.json({ error: "The selected trip does not exist." }, { status: 400 });
    linkedTrip = trip;
    if (trip.vehicle_id && String(trip.vehicle_id) !== vehicleId) {
      return NextResponse.json({ error: "The selected vehicle does not match the trip vehicle." }, { status: 400 });
    }
    if (driverId && trip.driver_id && String(trip.driver_id) !== driverId) {
      return NextResponse.json({ error: "The selected driver does not match the trip driver." }, { status: 400 });
    }
  }
  if (driverId) {
    const { data: driver, error: driverError } = await auth.context.serviceClient
      .from("users")
      .select("id")
      .eq("id", driverId)
      .maybeSingle();
    if (driverError) return NextResponse.json({ error: `Unable to validate fuel driver: ${driverError.message}` }, { status: 500 });
    if (!driver) return NextResponse.json({ error: "The selected driver does not exist." }, { status: 400 });
  }
  const fuelType = optionalText(body.fuelType, body.fuel_type);
  const station = optionalText(body.station, body.fuelStation, body.fuel_station);
  const location = optionalText(body.location);
  const paymentMethod = optionalText(body.paymentMethod, body.payment_method);
  const referenceNumber = optionalText(body.referenceNumber, body.reference_number);
  const odometerReading = numericInput(body.odometerReading ?? body.odometer_reading);
  if (odometerReading != null && (!Number.isFinite(odometerReading) || odometerReading < 0)) {
    return NextResponse.json({ error: "Odometer reading must be a non-negative number." }, { status: 400 });
  }
  const amountToRecord = amount ?? calculatedAmount;
  if (amountToRecord == null) {
    return NextResponse.json({ error: "A valid recorded fuel amount or liters with price per liter is required." }, { status: 400 });
  }
  const record = {
    source_app: "ftm_manual",
    vehicle_id: vehicleId,
    driver_id: driverId || linkedTrip?.driver_id || null,
    trip_id: tripId,
    category: "fuel",
    amount: amountToRecord,
    liters,
    price_per_liter: pricePerLiter,
    odometer_reading: odometerReading,
    receipt_image: optionalText(body.fuelReceiptImage),
    entry_date: optionalText(body.loggedAt) || new Date().toISOString().slice(0, 10),
    review_status: "pending",
    review_flags: [],
    category_details: {
      liters,
      price_per_liter: pricePerLiter,
      odometer_reading: odometerReading,
      fuel_type: fuelType,
      fuel_station: station,
      location,
      payment_method: paymentMethod,
      reference_number: referenceNumber,
    },
  };
  const { data, error } = await auth.context.serviceClient.from("cost_entries").insert(record).select("*").single();
  if (error) return NextResponse.json({ error: `Unable to create fuel expense: ${error.message}` }, { status: 500 });
  return NextResponse.json(normalizeFuelLogs([data], [])[0], { status: 201 });
}