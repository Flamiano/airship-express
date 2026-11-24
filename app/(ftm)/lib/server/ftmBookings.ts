import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type RecordValue = Record<string, unknown>;

export function normalizeBooking(record: RecordValue = {}) {
  return {
    ...record,
    pickupLocation: record.pickup_location,
    dropoffLocation: record.dropoff_location,
    bookingDate: record.booking_date || record.bookingDate,
    routePlanId: record.route_plan_id ?? record.routePlanId ?? null,
    routePlan: record.routePlan ?? record.route_plan ?? null,
    courierId: record.courier_id ?? record.courierId ?? null,
    courier: record.courier || null,
    driverId: record.driver_id ?? record.driverId ?? null,
    driverName: record.driver_name ?? record.driverName ?? null,
    vehicleId: record.vehicle_id ?? record.vehicleId ?? null,
    vehiclePlate: record.vehicle_plate ?? record.vehiclePlate ?? null,
    pickup_latitude: record.pickup_latitude ?? record.pickupLatitude ?? null,
    pickup_longitude: record.pickup_longitude ?? record.pickupLongitude ?? null,
    dropoff_latitude: record.dropoff_latitude ?? record.dropoffLatitude ?? null,
    dropoff_longitude: record.dropoff_longitude ?? record.dropoffLongitude ?? null,
    delivery_destinations: Array.isArray(record.delivery_destinations) ? record.delivery_destinations : record.deliveryDestinations || [],
    deliveryDestinations: Array.isArray(record.delivery_destinations) ? record.delivery_destinations : record.deliveryDestinations || [],
    cargo_weight: record.cargo_weight ?? record.total_weight_kg ?? record.totalWeightKg ?? null,
    parcel_ids: Array.isArray(record.parcel_ids) ? record.parcel_ids : record.parcelIds || [],
  };
}

export function buildBookingPayload(record: RecordValue = {}) {
  return {
    id: record.id || record.booking_id || null,
    customer_id: record.customer_id || record.customerId || null,
    route_plan_id: record.route_plan_id ?? record.routePlanId ?? null,
    courier_id: record.courier_id ?? record.courierId ?? null,
    courier: record.courier || null,
    booking_date: record.booking_date || record.bookingDate || null,
    pickup_location: record.pickup_location || record.pickupLocation || null,
    pickup_latitude: record.pickup_latitude ?? record.pickupLatitude ?? null,
    pickup_longitude: record.pickup_longitude ?? record.pickupLongitude ?? null,
    dropoff_location: record.dropoff_location || record.dropoffLocation || null,
    dropoff_latitude: record.dropoff_latitude ?? record.dropoffLatitude ?? null,
    dropoff_longitude: record.dropoff_longitude ?? record.dropoffLongitude ?? null,
    delivery_destinations: Array.isArray(record.delivery_destinations) ? record.delivery_destinations : record.deliveryDestinations || null,
    status: record.status || "Pending",
    notes: record.notes || null,
  };
}

const ACTIVE_TRIP_STATUSES = new Set([
  "assigned", "accepted", "pickup assigned", "pickup confirmed", "driver assigned", "vehicle assigned", "scheduled", "dispatching", "dispatched",
  "in transit", "in_transit", "delivering", "en route", "active", "moving",
]);

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isUnavailable(value: unknown) {
  return ["maintenance", "undermaintenance", "underrepair", "outofservice", "unavailable", "inactive", "breakdown", "unsafe", "urgentinspectionrequired"].includes(normalizeStatus(value));
}

function isActiveTrip(value: unknown) {
  return [...ACTIVE_TRIP_STATUSES].some((status) => normalizeStatus(status) === normalizeStatus(value));
}

async function resolveCourier(supabase: SupabaseClient, booking: RecordValue, requestedCourier?: unknown): Promise<RecordValue | null> {
  const value = requestedCourier || booking.courier_id || booking.courier;
  const routePlanId = booking.route_plan_id;
  if (value) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
    const column = isUuid ? "id" : "name";
    const { data } = await supabase.from("couriers").select("id, name, code").eq(column, value).maybeSingle();
    if (data) return data;
    if (!isUuid) {
      const byCode = await supabase.from("couriers").select("id, name, code").eq("code", value).maybeSingle();
      if (byCode.data) return byCode.data;
    }
    return isUuid ? null : { name: String(value) };
  }

  if (routePlanId) {
    const { data } = await supabase.from("route_plans").select("courier_id, courier").eq("id", routePlanId).maybeSingle();
    if (data) return resolveCourier(supabase, data, data.courier_id || data.courier);
  }
  return null;
}

async function hasActiveTrip(supabase: SupabaseClient, column: "driver_id" | "vehicle_id", id: string, excludingTripId?: string) {
  let query = supabase.from("trips").select("id, status").eq(column, id);
  if (excludingTripId) query = query.neq("id", excludingTripId);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to check ${column === "driver_id" ? "driver" : "vehicle"} assignments: ${error.message}`);
  return (data || []).some((trip) => isActiveTrip(trip.status));
}

export async function validateBookingAssignment(
  supabase: SupabaseClient,
  booking: RecordValue,
  driverId: string | undefined,
  vehicleId: string | undefined,
  requestedCourier?: unknown,
  tripId?: string,
) {
  if (!driverId || !vehicleId) throw new Error("A driver and vehicle are required for assignment.");
  const courier = await resolveCourier(supabase, booking, requestedCourier);
  if (!courier) throw new Error("The shipment courier could not be identified. Assign a registered courier before dispatch.");
  if (!courier.id) throw new Error("The selected driver and vehicle must belong to the shipment courier.");

  const driverResult = await supabase
    .from("users")
    .select("id, full_name, role, is_active, courier_id")
    .eq("id", driverId)
    .eq("role", "driver")
    .maybeSingle();
  if (driverResult.error) throw new Error(`Unable to load driver: ${driverResult.error.message}`);
  if (!driverResult.data) throw new Error("Driver not found.");

  const vehicleColumns = "id, plate_number, status, availability, assignment_status, courier_id";
  let vehicleResult = await supabase.from("vehicles").select(vehicleColumns).eq("id", vehicleId).maybeSingle();
  if (vehicleResult.error && /assignment_status|column .* does not exist|schema cache/i.test(vehicleResult.error.message)) {
    vehicleResult = await supabase.from("vehicles").select("id, plate_number, status, availability, courier_id").eq("id", vehicleId).maybeSingle();
  }
  if (vehicleResult.error) throw new Error(`Unable to load vehicle: ${vehicleResult.error.message}`);
  if (!vehicleResult.data) throw new Error("Vehicle not found.");

  const driver = driverResult.data;
  const vehicle = vehicleResult.data;
  if (driver.is_active === false) throw new Error("Driver is not available for assignment.");
  if (!driver.courier_id) throw new Error("Driver is not associated with a courier. Assign the driver to a registered courier first.");
  if (!vehicle.courier_id) throw new Error("Vehicle is not associated with a courier.");
  if (String(driver.courier_id) !== String(vehicle.courier_id)) throw new Error("Driver and vehicle must belong to the same courier.");
  if (courier.id && (String(driver.courier_id) !== String(courier.id) || String(vehicle.courier_id) !== String(courier.id))) {
    throw new Error("The selected driver and vehicle must belong to the shipment courier.");
  }

  const vehicleStatuses = [vehicle.status, vehicle.availability, vehicle.assignment_status].filter((value) => value != null);
  if (vehicleStatuses.some(isUnavailable)) throw new Error("Vehicle is not available for assignment.");
  if (await hasActiveTrip(supabase, "driver_id", driverId, tripId)) throw new Error("Driver is already assigned to an active trip.");
  const vehicleIsAssigned = vehicleStatuses.some((value) => ["assigned", "busy", "in use"].includes(normalizeStatus(value)));
  if (vehicleIsAssigned && await hasActiveTrip(supabase, "vehicle_id", vehicleId, tripId)) {
    throw new Error("Vehicle is not available for assignment.");
  }
  return { courier, driver, vehicle };
}