import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFtmParcelClient } from "./ftmSupabase";
import { validateBookingAssignment } from "./ftmBookings";

type TripCoordinate = { lat?: unknown; lng?: unknown };
type TripRecord = Record<string, unknown> & {
  id?: unknown;
  driver_id?: string | null;
  vehicle_id?: string | null;
  courier_id?: string | null;
  courier?: string | null;
  estimated_arrival?: string | null;
  estimatedArrival?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  fromCoords?: TripCoordinate | null;
  toCoords?: TripCoordinate | null;
};

export function normalizeTrip(record: TripRecord = {}): TripRecord {
  const rawStatus = String(record.status || "").trim().toLowerCase();
  const arrival = record.estimated_arrival || record.estimatedArrival;
  const arrivalTime = typeof arrival === "string" || typeof arrival === "number" ? new Date(arrival).getTime() : NaN;
  const active = /in transit|in_transit|transit|assigned|accepted|pickup confirmed|pickup assigned|scheduled|dispatch|moving|en route|active/.test(rawStatus);
  const activity = record.updated_at || record.updatedAt || record.created_at || record.createdAt;
  const activityTime = typeof activity === "string" || typeof activity === "number" ? new Date(activity).getTime() : NaN;
  const overdue = active && ((Number.isFinite(arrivalTime) && arrivalTime < Date.now()) || (!Number.isFinite(arrivalTime) && Number.isFinite(activityTime) && activityTime < Date.now() - 24 * 60 * 60 * 1000));
  return {
    ...record,
    vehicle: record.vehicle_plate || record.vehicle_id,
    driver: record.driver_name || record.driver_id,
    from: record.from_location,
    to: record.to_location,
    distanceKm: record.distance_km,
    durationMinutes: record.duration_minutes,
    loadKg: record.load_kg,
    fromLocation: record.from_location,
    toLocation: record.to_location,
    fromCoords: record.from_latitude && record.from_longitude ? { lat: record.from_latitude, lng: record.from_longitude } : null,
    toCoords: record.to_latitude && record.to_longitude ? { lat: record.to_latitude, lng: record.to_longitude } : null,
    bookingId: record.booking_id || record.bookingId || null,
    routePlanId: record.route_plan_id || record.routePlanId || null,
    courierId: record.courier_id || record.courierId || null,
    courier: record.courier || null,
    vehicleId: record.vehicle_id || record.vehicleId || null,
    vehiclePlate: record.vehicle_plate || record.vehiclePlate || null,
    driverId: record.driver_id || record.driverId || null,
    driverName: record.driver_name || record.driverName || null,
    pickupStatus: record.pickup_status || record.pickupStatus || "pending",
    pickupProofUrl: record.pickup_proof_url || record.pickupProofUrl || null,
    pickupConfirmedAt: record.pickup_confirmed_at || record.pickupConfirmedAt || null,
    status: overdue ? "Delayed" : record.status || null,
    progress: record.progress != null ? Number(record.progress) : null,
    estimatedDeparture: record.estimated_departure || record.estimatedDeparture || null,
    estimatedArrival: record.estimated_arrival || record.estimatedArrival || null,
    actualDeparture: record.actual_departure || record.actualDeparture || null,
    actualArrival: record.actual_arrival || record.actualArrival || null,
    createdAt: record.created_at || record.createdAt || null,
    updatedAt: record.updated_at || record.updatedAt || null,
  };
}

function normalizeVehicleId(value: unknown) {
  return value == null ? null : String(value).trim() || null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function buildTripPayload(trip: TripRecord = {}) {
  const vehicleId = trip.vehicle_id || trip.vehicle;
  const driverId = trip.driver_id || trip.driver;
  const courierId = trip.courier_id ?? trip.courierId;
  return {
    id: trip.id || trip.trip_id || null,
    booking_id: trip.booking_id || null,
    route_plan_id: trip.route_plan_id || trip.routePlanId || null,
    courier_id: typeof courierId === "string" ? courierId : null,
    vehicle_id: normalizeVehicleId(vehicleId),
    driver_id: isUuid(driverId) ? driverId : null,
    driver_name: trip.driver_name || trip.driver || null,
    vehicle_plate: trip.vehicle_plate || trip.plate || null,
    from_location: trip.from_location || trip.from || null,
    to_location: trip.to_location || trip.to || null,
    from_latitude: trip.from_latitude || trip.fromCoords?.lat || null,
    from_longitude: trip.from_longitude || trip.fromCoords?.lng || null,
    to_latitude: trip.to_latitude || trip.toCoords?.lat || null,
    to_longitude: trip.to_longitude || trip.toCoords?.lng || null,
    status: trip.status || "Assigned",
    progress: Number(trip.progress || 0),
    distance_km: trip.distance_km ?? trip.distanceKm ?? null,
    duration_minutes: trip.duration_minutes ?? trip.durationMinutes ?? null,
    load_kg: trip.load_kg ?? trip.loadKg ?? null,
    scheduled_at: trip.scheduled_at ?? trip.scheduledAt ?? null,
    notes: trip.notes || null,
    pickup_status: trip.pickup_status || trip.pickupStatus || "pending",
    pickup_proof_url: trip.pickup_proof_url || trip.pickupProofUrl || null,
    pickup_confirmed_at: trip.pickup_confirmed_at || trip.pickupConfirmedAt || null,
  };
}

export function isInTransitStatus(status: unknown) {
  return /in transit|in_transit|transit|dispatched|dispatching|delivering|moving|en route|on route|active/i.test(String(status || ""));
}

export async function persistTripStops(supabase: SupabaseClient, tripId: string, stops: TripRecord[]) {
  if (!Array.isArray(stops) || !stops.length) return;
  const rows = stops.map((stop, index) => ({
    trip_id: tripId,
    sequence: index + 1,
    name: stop.name || stop.label || `Stop ${index + 1}`,
    latitude: Number(stop.lat ?? stop.latitude),
    longitude: Number(stop.lng ?? stop.longitude),
    status: "pending",
  })).filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
  if (!rows.length) return;
  const { error } = await supabase.from("trip_stops").insert(rows);
  if (error) console.warn("Failed to persist trip stops:", error.message);
}

export function normalizeTripStop(stop: TripRecord) {
  if (!stop) return null;
  const lat = Number(stop.lat ?? stop.latitude ?? stop.location_lat ?? 0);
  const lng = Number(stop.lng ?? stop.longitude ?? stop.location_lng ?? 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { name: stop.name || stop.label || stop.address || stop.delivery_address || "Stop", lat, lng, status: stop.status || "pending" };
}

export async function updateTripResources(supabase: SupabaseClient, resources: { driverId?: string | null; vehicleId?: string | null }, status: string) {
  const updates: Array<PromiseLike<{ error: { message: string } | null }>> = [];
  if (resources.vehicleId) {
    updates.push((async () => {
      const availability = status.toLowerCase() === "available" ? "available" : status.toLowerCase();
      const assignmentStatus = status.toLowerCase().replace(/\s+/g, "_");
      const primary = await supabase.from("vehicles").update({ status, availability, assignment_status: assignmentStatus }).eq("id", resources.vehicleId);
      if (primary.error && /assignment_status|column .* does not exist|schema cache/i.test(primary.error.message)) {
        return supabase.from("vehicles").update({ status, availability }).eq("id", resources.vehicleId);
      }
      return primary;
    })());
  }
  if (resources.driverId) updates.push(supabase.from("users").update({ is_active: status.toLowerCase() !== "inactive" }).eq("id", resources.driverId));
  (await Promise.all(updates)).forEach((result) => {
    if (result.error) console.warn(`Unable to update ${status.toLowerCase()} resource status:`, result.error.message);
  });
}

export async function updateRemoteParcelStatus(supabase: SupabaseClient, bookingId: string, status: string): Promise<string | null> {
  const parcels = createFtmParcelClient();
  if (!parcels) return "Parcel database is not configured.";
  let booking: Record<string, unknown> | null;
  let bookingError: { message: string } | null;
  const bookingResult = await supabase.from("bookings").select("parcel_ids,cargo_description").eq("id", bookingId).maybeSingle();
  booking = bookingResult.data as Record<string, unknown> | null;
  bookingError = bookingResult.error;
  if (bookingError && /parcel_ids.*does not exist|column .*parcel_ids/i.test(bookingError.message)) {
    const fallback = await supabase.from("bookings").select("cargo_description").eq("id", bookingId).maybeSingle();
    booking = fallback.data as Record<string, unknown> | null;
    bookingError = fallback.error;
  }
  if (bookingError) return `Unable to load the booking parcel manifest: ${bookingError.message}`;
  const manifestIds = String(booking?.cargo_description || "").match(/parcel_ids=([^;\s]+)/i)?.[1]?.split(",").map((id) => id.trim()).filter(Boolean) || [];
  const parcelIds = [...new Set([...(Array.isArray(booking?.parcel_ids) ? booking.parcel_ids : []), ...manifestIds].map(String).filter(Boolean))];
  if (!parcelIds.length) return null;
  const { data, error } = await parcels.from("parcels").update({ status }).in("id", parcelIds).select("id");
  if (error) return `Unable to update linked parcels: ${error.message}`;
  if (!data?.length) return "No linked parcel records were updated.";
  return null;
}

export async function notifyDriverTripAssigned(supabase: SupabaseClient, trip: TripRecord) {
  if (!trip?.driver_id) return;
  const notification = {
    user_id: trip.driver_id,
    title: "New trip assignment",
    message: `Trip ${trip.id} has been assigned to you: ${trip.from_location || "pickup"} to ${trip.to_location || "drop-off"}.`,
    is_read: false,
  };
  const { error } = await supabase.from("notifications").insert(notification);
  if (error) {
    console.warn("Trip assigned but driver notification could not be sent:", error.message);
    return;
  }
  try {
    const { data: tokens, error: tokenError } = await supabase.from("driver_push_tokens").select("token").eq("driver_id", trip.driver_id);
    if (tokenError) throw tokenError;
    const messages = (tokens || []).map((item) => item.token).filter((token) => /^ExponentPushToken\[.+\]$/.test(token)).map((to) => ({
      to,
      title: notification.title,
      body: notification.message,
      sound: "default",
      data: { tripId: trip.id, notificationType: "trip_assignment" },
    }));
    if (!messages.length) return;
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    if (!response.ok) console.warn("Expo push service rejected trip assignment:", await response.text());
  } catch (error) {
    console.warn("Trip notification saved but push delivery failed:", error);
  }
}

export async function validateTripAssignment(supabase: SupabaseClient, trip: TripRecord, driverId = trip.driver_id || undefined) {
  return validateBookingAssignment(supabase, trip, driverId, trip.vehicle_id || undefined, trip.courier_id || trip.courier, typeof trip.id === "string" ? trip.id : undefined);
}

export async function updateTripStatus(
  supabase: SupabaseClient,
  tripId: string,
  status: string,
  progress: number,
  options: { pickupStatus?: string; bookingId?: string } = {},
) {
  const update: TripRecord = { status, progress };
  if (options.pickupStatus) update.pickup_status = options.pickupStatus;
  const { data, error } = await supabase.from("trips").update(update).eq("id", tripId).select("*").maybeSingle();
  if (error || !data) return { data, error };

  const bookingId = options.bookingId || data.booking_id;
  if (bookingId) {
    const normalizedStatus = status.trim().toLowerCase();
    const assignmentStatus = isInTransitStatus(status)
      ? "in_progress"
      : normalizedStatus === "completed" || normalizedStatus === "delivered"
        ? "completed"
        : null;
    const bookingStatus = isInTransitStatus(status)
      ? "In Transit"
      : normalizedStatus === "completed" || normalizedStatus === "delivered"
        ? "Completed"
        : null;
    if (assignmentStatus) {
      const { error: assignmentError } = await supabase.from("booking_assignments")
        .update({ status: assignmentStatus, updated_at: new Date().toISOString() })
        .eq("booking_id", bookingId);
      if (assignmentError) return { data, error: assignmentError };
    }
    if (bookingStatus) {
      const { error: bookingError } = await supabase.from("bookings")
        .update({ status: bookingStatus, updated_at: new Date().toISOString() })
        .eq("id", bookingId);
      if (bookingError) return { data, error: bookingError };
    }
    const parcelStatus = /delayed|late|exception/.test(normalizedStatus)
      ? "delayed"
      : isInTransitStatus(status)
        ? "in_transit"
        : normalizedStatus === "completed"
          ? "delivered"
          : null;
    if (parcelStatus) await updateRemoteParcelStatus(supabase, bookingId, parcelStatus);
  }

  if (data.route_plan_id) {
    const normalizedStatus = status.trim().toLowerCase();
    const routePlanStatus = isInTransitStatus(status) ? "in_progress" : ["completed", "delivered"].includes(normalizedStatus) ? "completed" : null;
    if (routePlanStatus) {
      const { error: routePlanError } = await supabase.from("route_plans").update({ status: routePlanStatus }).eq("id", data.route_plan_id);
      if (routePlanError) console.warn("Failed to update route plan status:", routePlanError.message);
    }
  }
  if (isInTransitStatus(status)) {
    await updateTripResources(supabase, { driverId: data.driver_id, vehicleId: data.vehicle_id }, "In Transit");
  }
  if (["completed", "delivered"].includes(status.trim().toLowerCase())) {
    await updateTripResources(supabase, { driverId: data.driver_id, vehicleId: data.vehicle_id }, "Available");
  }
  return { data, error: null };
}