import "server-only";
import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_MAP: Record<string, string> = { fuel: "Fuel", maintenance: "Maintenance", toll: "Toll", parking: "Parking", other: "Other" };

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeExpense(entry: JsonRecord) {
  return {
    id: entry.id,
    driver_id: entry.driver_id ?? null,
    vehicle_id: entry.vehicle_id,
    trip_id: entry.trip_id,
    amount: entry.amount,
    category: entry.category,
    note: entry.remarks ?? "",
    photo_url: entry.receipt_image ?? null,
    entry_date: entry.entry_date,
    created_at: entry.created_at,
  };
}

function buildExpenseDetails(category: string, fields: JsonRecord) {
  const details: JsonRecord = {
    category,
    note: fields.note || null,
    description: fields.note || null,
    reference_number: fields.reference_number || null,
    location: fields.location || null,
    payment_method: fields.payment_method || null,
  };
  if (category === "Fuel") {
    details.liters = fields.liters == null ? undefined : Number(fields.liters);
    details.price_per_liter = fields.price_per_liter == null ? undefined : Number(fields.price_per_liter);
    details.fuel_type = fields.fuel_type || null;
    details.fuel_station = fields.fuel_station || null;
    details.odometer_reading = fields.odometer_reading == null ? undefined : Number(fields.odometer_reading);
  }
  if (category === "Maintenance") details.maintenance_type = fields.maintenance_type || null;
  if (category === "Toll") details.toll_location = fields.location || null;
  if (category === "Parking") details.parking_location = fields.location || null;
  return details;
}

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "costAnalysis", "view")) {
    return NextResponse.json({ error: "Permission denied: costAnalysis.view" }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const driverId = params.get("driver_id");
  const vehicleId = params.get("vehicle_id");
  let query = context.serviceClient.from("cost_entries").select("*").order("entry_date", { ascending: false });
  if (vehicleId) query = query.eq("vehicle_id", vehicleId);
  let { data, error } = await query;
  if (driverId && !data?.length && !vehicleId) {
    const result = await context.serviceClient.from("cost_entries").select("*").order("entry_date", { ascending: false }).eq("driver_id", driverId);
    data = result.data;
    error = result.error;
  }
  if (error && driverId && /column .*driver_id|does not exist|not found/i.test(error.message)) {
    const fallback = await context.serviceClient.from("cost_entries").select("*").order("entry_date", { ascending: false });
    if (fallback.error) return NextResponse.json({ error: `Unable to load expenses: ${fallback.error.message}` }, { status: 500 });
    data = fallback.data || [];
  } else if (error) {
    return NextResponse.json({ error: `Unable to load expenses: ${error.message}` }, { status: 500 });
  }

  let rows = data || [];
  if (driverId && !vehicleId) {
    const vehicleIds = new Set<string>();
    const assignments = await context.serviceClient.from("driver_assignments").select("vehicle_id").eq("driver_id", driverId);
    (assignments.data || []).forEach((row) => row?.vehicle_id && vehicleIds.add(row.vehicle_id));
    if (!vehicleIds.size) {
      const trips = await context.serviceClient.from("trips").select("vehicle_id").eq("driver_id", driverId).not("vehicle_id", "is", null);
      (trips.data || []).forEach((row) => row?.vehicle_id && vehicleIds.add(row.vehicle_id));
    }
    if (!vehicleIds.size) {
      const location = await context.serviceClient.from("mobile_device_tracking").select("vehicle_id").eq("driver_id", driverId).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
      if (location.data?.vehicle_id) vehicleIds.add(location.data.vehicle_id);
    }
    rows = rows.filter((row) => vehicleIds.has(row.vehicle_id));
  }
  return NextResponse.json(rows.map(normalizeExpense));
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "costAnalysis", "create")) {
    return NextResponse.json({ error: "Permission denied: costAnalysis.create" }, { status: 403 });
  }
  let body: JsonRecord;
  try {
    const parsed: unknown = await request.json();
    if (!isJsonRecord(parsed)) {
      return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const vehicleId = typeof body.vehicle_id === "string" ? body.vehicle_id.trim() || null : body.vehicle_id || null;
  const amount = Number(body.amount);
  const rawCategory = typeof body.category === "string" ? body.category : "";
  const category = CATEGORY_MAP[rawCategory.toLowerCase()] || rawCategory;
  const note = body.note;
  const liters = body.liters;
  const pricePerLiter = body.price_per_liter;
  const fuelStation = body.fuel_station;
  const location = body.location;
  const paymentMethod = body.payment_method;
  const referenceNumber = body.reference_number;
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "A valid amount is required" }, { status: 400 });
  if (!category) return NextResponse.json({ error: "A valid category is required" }, { status: 400 });

  const description = [note, referenceNumber && `Reference: ${referenceNumber}`, location && `Location: ${location}`, paymentMethod && `Payment: ${paymentMethod}`].filter(Boolean).join(" \u2022 ");
  const structured = category === "Fuel" && (liters != null || pricePerLiter != null || body.fuel_type || fuelStation)
    ? JSON.stringify({ note: note || null, referenceNumber: referenceNumber || null, location: location || null, paymentMethod: paymentMethod || null, liters: Number.isFinite(Number(liters)) ? Number(liters) : undefined, price_per_liter: Number.isFinite(Number(pricePerLiter)) ? Number(pricePerLiter) : undefined, fuel_type: body.fuel_type || undefined, fuel_station: fuelStation || undefined })
    : null;
  const payload: JsonRecord = {
    driver_id: body.driver_id || null,
    vehicle_id: vehicleId,
    category,
    amount,
    entry_date: new Date().toISOString().slice(0, 10),
    remarks: structured || description || null,
    receipt_image: body.photo_base64 ? `data:image/jpeg;base64,${body.photo_base64}` : null,
    category_details: buildExpenseDetails(category, { ...body, note, liters, price_per_liter: pricePerLiter, fuel_station: fuelStation, location, payment_method: paymentMethod, reference_number: referenceNumber }),
  };
  const select = "id,vehicle_id,trip_id,category,amount,entry_date,remarks,receipt_image,created_at";
  const supabase = context.serviceClient;
  let result = await supabase.from("cost_entries").insert(payload).select(select).single();
  if (result.error && /receipt_image/i.test(result.error.message)) {
    const fallback = { ...payload };
    delete fallback.receipt_image;
    result = await supabase.from("cost_entries").insert(fallback).select(select).single();
  }
  if (result.error && /category_details|driver_id/i.test(result.error.message)) {
    const fallback = { ...payload };
    delete fallback.category_details;
    delete fallback.driver_id;
    result = await supabase.from("cost_entries").insert(fallback).select(select).single();
  }
  if (result.error) return NextResponse.json({ error: `Unable to create expense: ${result.error.message}` }, { status: 500 });
  const details = buildExpenseDetails(category, { ...body, note, liters, price_per_liter: pricePerLiter, fuel_station: fuelStation, location, payment_method: paymentMethod, reference_number: referenceNumber });
  const { error: detailsError } = await supabase.from("cost_entries").update({ category_details: details }).eq("id", result.data.id);
  if (detailsError && !/column .*category_details|does not exist|not found/i.test(detailsError.message)) {
    return NextResponse.json({ error: `Unable to create category cost: ${detailsError.message}` }, { status: 500 });
  }
  return NextResponse.json({ ...normalizeExpense(result.data), driver_id: body.driver_id || null }, { status: 201 });
}