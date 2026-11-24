import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { createFtmServiceClient, createFtmParcelClient } from "../../lib/server/ftmSupabase";
import { AIRSHIP_COURIER_NAME, belongsToAirshipCourier, getAirshipCouriers, isAirshipCourier } from "../../lib/server/ftmCourier";
import { isParcelAvailableForRoutePlanning, isParcelTableError, normalizeParcelResponse } from "../../lib/server/ftmParcels";

export const dynamic = "force-dynamic";

function isPermissionError(error: unknown) {
  return /permission denied|not authorized|rls|role .* has no privilege|cannot access|query.*denied/i.test(String((error as { message?: string })?.message || error || ""));
}

async function fetchParcelRows(client: ReturnType<typeof createFtmParcelClient>, requestedStatus: string) {
  if (!client) return { data: null, error: { message: "Database not configured" } };
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = client.from("parcels").select("*").order("id").range(offset, offset + 999);
    if (requestedStatus) query = query.ilike("status", requestedStatus);
    const { data, error } = await query;
    if (error) return { data: null, error };
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < 1000) return { data: rows, error: null };
  }
}

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "view")) {
    return NextResponse.json({ error: "Permission denied: vrds.view" }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedStatus = String(url.searchParams.get("status") || "").trim();
  const historyMode = String(url.searchParams.get("history") || "").toLowerCase() === "true";
  const supabase = createFtmParcelClient();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let { data, error } = await fetchParcelRows(supabase, requestedStatus);
  if (error && isPermissionError(error)) {
    const serviceClient = createFtmServiceClient();
    if (serviceClient) {
      const result = await fetchParcelRows(serviceClient, requestedStatus);
      data = result.data;
      error = result.error;
    }
  }
  if (error) {
    if (isPermissionError(error)) return NextResponse.json({ error: "Database access to parcel records is not configured." }, { status: 403 });
    if (isParcelTableError(error)) {
      return NextResponse.json({ error: "The FTM parcels table has not been created yet.", migration: "supabase/migrations/20261009_create_ftm_parcels.sql" }, { status: 503 });
    }
    if (/fetch failed|econnreset|enotfound|etimedout|network error|connection closed/i.test(error.message)) {
      return NextResponse.json({ error: `Unable to reach the parcel database: ${error.message}` }, { status: 503 });
    }
    return NextResponse.json({ error: error.message || "Failed to fetch parcels" }, { status: 500 });
  }
  const rows = Array.isArray(data) ? data : [];
  let airshipCouriers: Awaited<ReturnType<typeof getAirshipCouriers>> = [];
  try { airshipCouriers = await getAirshipCouriers(context.serviceClient); } catch (courierError) {
    return NextResponse.json({ error: "Unable to resolve Airship Express parcel scope.", details: courierError instanceof Error ? courierError.message : String(courierError) }, { status: 500 });
  }
  const courierIds = new Set(airshipCouriers.map((courier) => courier.id));
  const routePlanIds = [...new Set(rows.map((parcel) => String(parcel.route_plan_id || "")).filter(Boolean))];
  const routePlansResult = routePlanIds.length
    ? await context.serviceClient.from("route_plans").select("id,courier,courier_id").in("id", routePlanIds)
    : { data: [], error: null };
  if (routePlansResult.error) return NextResponse.json({ error: `Unable to filter parcels by route: ${routePlansResult.error.message}` }, { status: 500 });
  const airshipRouteIds = new Set((routePlansResult.data || []).filter((routePlan) => belongsToAirshipCourier(routePlan, courierIds)).map((routePlan) => String(routePlan.id)));
  const bookingIds = [...new Set(rows.map((parcel) => String(parcel.booking_id || "")).filter(Boolean))];
  const bookingsResult = bookingIds.length
    ? await context.serviceClient.from("bookings").select("id,courier,courier_id,route_plan_id").in("id", bookingIds)
    : { data: [], error: null };
  const airshipBookingIds = new Set((bookingsResult.data || []).filter((booking) =>
    belongsToAirshipCourier(booking, courierIds) || airshipRouteIds.has(String(booking.route_plan_id || ""))
  ).map((booking) => String(booking.id)));
  const airshipRows = rows.filter((parcel) => belongsToAirshipCourier(parcel, courierIds)
    || airshipRouteIds.has(String(parcel.route_plan_id || ""))
    || airshipBookingIds.has(String(parcel.booking_id || "")));
  return NextResponse.json(airshipRows.filter((parcel) => historyMode || isParcelAvailableForRoutePlanning(parcel)).map(normalizeParcelResponse));
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "create")) {
    return NextResponse.json({ error: "Permission denied: vrds.create" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const senderName = String(body.sender_name ?? body.senderName ?? "").trim();
  const recipientName = String(body.recipient_name ?? body.recipientName ?? "").trim();
  const deliveryAddress = String(body.delivery_address ?? body.dropoff_location ?? body.destination ?? "").trim();
  const weightKg = Number(body.weight_kg ?? body.weightKg);
  const destLat = Number(body.dest_lat ?? body.destLat);
  const destLng = Number(body.dest_lng ?? body.destLng);
  if (!senderName || !recipientName || !deliveryAddress || !Number.isFinite(weightKg) || weightKg <= 0) {
    return NextResponse.json({ error: "Sender, recipient, delivery address, and a positive parcel weight are required." }, { status: 400 });
  }

  const id = `PAR-${randomUUID()}`;
  const trackingNumber = `AXP-${randomUUID().slice(0, 8).toUpperCase()}`;
  let airshipCourier;
  try { airshipCourier = (await getAirshipCouriers(context.serviceClient))[0]; } catch (error) {
    return NextResponse.json({ error: "Unable to resolve Airship Express courier.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
  if (!airshipCourier) return NextResponse.json({ error: "Register an active Airship Express courier before creating parcels." }, { status: 409 });
  const { data, error } = await context.serviceClient.from("parcels").insert({
    id,
    tracking_number: trackingNumber,
    sender_name: senderName,
    sender_phone: String(body.sender_phone ?? body.senderPhone ?? "").trim() || null,
    recipient_name: recipientName,
    recipient_phone: String(body.recipient_phone ?? body.recipientPhone ?? "").trim() || null,
    delivery_address: deliveryAddress,
    dropoff_location: deliveryAddress,
    destination: deliveryAddress,
    dest_lat: Number.isFinite(destLat) ? destLat : null,
    dest_lng: Number.isFinite(destLng) ? destLng : null,
    parcel_type: String(body.parcel_type ?? body.parcelType ?? "Parcel").trim(),
    weight_kg: weightKg,
    courier: AIRSHIP_COURIER_NAME,
    courier_id: airshipCourier.id,
    notes: String(body.notes ?? "").trim() || null,
    status: "picked_up",
    received_at: new Date().toISOString(),
  }).select("*").single();

  if (error && isParcelTableError(error)) {
    return NextResponse.json({ error: "The FTM parcels table has not been created yet.", migration: "supabase/migrations/20261009_create_ftm_parcels.sql" }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: `Unable to register parcel in FTM Supabase: ${error.message}` }, { status: 500 });
  return NextResponse.json(normalizeParcelResponse(data), { status: 201 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function HEAD(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return new Response(null, { status: auth.response.status });
  if (!hasPermission(auth.context.user.role, "vrds", "view")) return new Response(null, { status: 403 });
  return new Response(null, { status: 200 });
}
