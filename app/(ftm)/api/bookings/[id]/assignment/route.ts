import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission } from "../../../../lib/permissions";
import { authenticateFtmRequest } from "../../../../lib/server/ftmRequestAuth";
import { createFtmParcelClient } from "../../../../lib/server/ftmSupabase";
import { normalizeBooking, validateBookingAssignment } from "../../../../lib/server/ftmBookings";
import { isAirshipCourier } from "../../../../lib/server/ftmCourier";

export const dynamic = "force-dynamic";

async function updateResourceStatus(
  supabase: SupabaseClient,
  resource: { driverId?: string | null; vehicleId?: string | null },
  status: string,
) {
  const updates: Array<PromiseLike<{ error: { message: string } | null }>> = [];
  if (resource.vehicleId) {
    updates.push((async () => {
      const availability = status.toLowerCase() === "available" ? "available" : status.toLowerCase();
      const assignmentStatus = status.toLowerCase().replace(/\s+/g, "_");
      const primary = await supabase.from("vehicles")
        .update({ status, availability, assignment_status: assignmentStatus })
        .eq("id", resource.vehicleId);
      if (primary.error && /assignment_status|column .* does not exist|schema cache/i.test(primary.error.message)) {
        return supabase.from("vehicles").update({ status, availability }).eq("id", resource.vehicleId);
      }
      return primary;
    })());
  }
  if (resource.driverId) {
    updates.push(supabase.from("users").update({ is_active: status.toLowerCase() !== "inactive" }).eq("id", resource.driverId));
  }
  (await Promise.all(updates)).forEach((result) => {
    if (result.error) console.warn(`Unable to update ${status.toLowerCase()} resource status:`, result.error.message);
  });
}

type BookingTripSource = {
  id: string;
  route_plan_id?: string | null;
  courier_id?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  dropoff_latitude?: number | null;
  dropoff_longitude?: number | null;
  total_weight_kg?: number | null;
  load_kg?: number | null;
  cargo_weight?: number | null;
};

type TripAssignment = {
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehiclePlate?: string | null;
};

async function syncAssignedTrip(supabase: SupabaseClient, booking: BookingTripSource, assignment: TripAssignment) {
  if (!booking.id || !assignment.driverId || !assignment.vehicleId) return null;
  const trip = {
    id: `TRIP-${booking.id}`,
    booking_id: booking.id,
    route_plan_id: booking.route_plan_id || null,
    courier_id: booking.courier_id || null,
    driver_id: assignment.driverId,
    driver_name: assignment.driverName || null,
    vehicle_id: assignment.vehicleId,
    vehicle_plate: assignment.vehiclePlate || null,
    from_location: booking.pickup_location || null,
    to_location: booking.dropoff_location || null,
    from_latitude: booking.pickup_latitude || null,
    from_longitude: booking.pickup_longitude || null,
    to_latitude: booking.dropoff_latitude || null,
    to_longitude: booking.dropoff_longitude || null,
    load_kg: booking.total_weight_kg || booking.load_kg || booking.cargo_weight || 0,
    status: "Assigned",
    progress: 0,
    pickup_status: "pending",
    updated_at: new Date().toISOString(),
  };
  const { data: existing, error: lookupError } = await supabase.from("trips").select("id").eq("booking_id", booking.id).maybeSingle();
  if (lookupError) {
    console.warn("Unable to look up assigned trip for booking:", lookupError.message);
    return null;
  }
  const persist = async (payload: Record<string, unknown>) => existing
    ? supabase.from("trips").update(payload).eq("id", existing.id).select("id").single()
    : supabase.from("trips").insert(payload).select("id").single();
  let result = await persist(trip);
  if (result.error && /column .* does not exist|schema cache|from_location|to_location|from_latitude|from_longitude|to_latitude|to_longitude|load_kg/i.test(result.error.message)) {
    const legacy = { ...trip } as Record<string, unknown>;
    delete legacy.from_location;
    delete legacy.to_location;
    delete legacy.from_latitude;
    delete legacy.from_longitude;
    delete legacy.to_latitude;
    delete legacy.to_longitude;
    delete legacy.load_kg;
    result = await persist(legacy);
  }
  if (result.error) {
    console.warn("Unable to synchronize assigned trip for driver app:", result.error.message);
    return null;
  }
  return result.data?.id || existing?.id || trip.id;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "vrds", "update")) {
    return NextResponse.json({ error: "Permission denied: vrds.update" }, { status: 403 });
  }

  let body: { driver_id?: string; driver_name?: string; vehicle_id?: string; vehicle_plate?: string; courier_id?: string; courier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  const bookingId = id;
  const { driver_id, driver_name, vehicle_id, vehicle_plate } = body;
  if (!driver_id || !vehicle_id) {
    return NextResponse.json({ error: "driver_id and vehicle_id are required" }, { status: 400 });
  }

  const supabase = context.serviceClient;
  const { data: bookingBefore, error: lookupError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: `Unable to load booking for assignment: ${lookupError.message}` }, { status: 500 });
  if (!bookingBefore) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  let validation;
  try {
    validation = await validateBookingAssignment(supabase, bookingBefore, driver_id, vehicle_id, body.courier_id || body.courier);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Driver and vehicle are not eligible for this booking." }, { status: 409 });
  }
  if (!isAirshipCourier(validation.courier.name || validation.courier.code)) {
    return NextResponse.json({ error: "Only Airship Express bookings can be assigned from VRDS." }, { status: 409 });
  }

  const assignedAt = new Date().toISOString();
  const { data: assignment, error: assignmentError } = await supabase.from("booking_assignments").upsert({
    booking_id: bookingId,
    driver_id,
    vehicle_id,
    route_plan_id: bookingBefore.route_plan_id || null,
    assigned_at: assignedAt,
    status: "assigned",
    updated_at: assignedAt,
  }, { onConflict: "booking_id" }).select("*").single();
  if (assignmentError) {
    return NextResponse.json({ error: `Unable to save shared booking assignment: ${assignmentError.message}` }, { status: 500 });
  }

  const { data: previous } = await supabase.from("bookings").select("driver_id, vehicle_id").eq("id", bookingId).maybeSingle();
  const assignedVehiclePlate = validation.vehicle.plate_number || vehicle_plate || null;
  const { data, error } = await supabase.from("bookings").update({
    driver_id,
    driver_name: driver_name || null,
    vehicle_id,
    vehicle_plate: assignedVehiclePlate,
    status: "DRIVER_VEHICLE_ASSIGNED",
  }).eq("id", bookingId).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: `Unable to assign booking resources: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (data.route_plan_id) {
    const [{ data: routePlan, error: routePlanLookupError }, { data: assignedVehicle, error: vehicleLookupError }] = await Promise.all([
      supabase.from("route_plans").select("vehicle_info,driver_info,optimization_result,baseline_distance_km,optimized_distance_km").eq("id", data.route_plan_id).maybeSingle(),
      supabase.from("vehicles").select("id,plate_number,vehicle_type,capacity_kg,fuel_efficiency,courier_id").eq("id", vehicle_id).maybeSingle(),
    ]);
    const syncLookupError = routePlanLookupError || vehicleLookupError;
    if (syncLookupError || !routePlan || !assignedVehicle) {
      return NextResponse.json({
        error: "Booking was assigned, but its route-plan vehicle/driver snapshot could not be loaded.",
        details: syncLookupError?.message || "Linked route plan or vehicle was not found.",
        booking_id: data.id,
        route_plan_id: data.route_plan_id,
      }, { status: 500 });
    }
    const fuelEfficiencyKmPerL = Number(assignedVehicle.fuel_efficiency);
    const validFuelEfficiency = Number.isFinite(fuelEfficiencyKmPerL) && fuelEfficiencyKmPerL > 0
      ? fuelEfficiencyKmPerL
      : null;
    const baselineDistanceKm = routePlan.baseline_distance_km == null ? NaN : Number(routePlan.baseline_distance_km);
    const optimizedDistanceKm = routePlan.optimized_distance_km == null ? NaN : Number(routePlan.optimized_distance_km);
    const baselineFuelLiters = validFuelEfficiency !== null && Number.isFinite(baselineDistanceKm)
      ? baselineDistanceKm / validFuelEfficiency
      : null;
    const optimizedFuelLiters = validFuelEfficiency !== null && Number.isFinite(optimizedDistanceKm)
      ? optimizedDistanceKm / validFuelEfficiency
      : null;
    const fuelSavedLiters = baselineFuelLiters !== null && optimizedFuelLiters !== null
      ? baselineFuelLiters - optimizedFuelLiters
      : null;
    const { error: routePlanUpdateError } = await supabase.from("route_plans").update({
      vehicle_id,
      driver_id,
      status: "assigned",
      fuel_efficiency_km_per_l: validFuelEfficiency,
      baseline_fuel_liters: baselineFuelLiters,
      optimized_fuel_liters: optimizedFuelLiters,
      fuel_saved_liters: fuelSavedLiters,
      vehicle_info: {
        ...(routePlan.vehicle_info || {}),
        id: assignedVehicle.id,
        plate: assignedVehicle.plate_number || assignedVehicle.id,
        vehicleType: assignedVehicle.vehicle_type || null,
        capacityKg: assignedVehicle.capacity_kg ?? null,
        fuelEfficiencyKmPerL: validFuelEfficiency,
        courierId: assignedVehicle.courier_id || null,
      },
      driver_info: {
        ...(routePlan.driver_info || {}),
        id: validation.driver.id,
        name: driver_name || validation.driver.full_name || null,
        courierId: validation.driver.courier_id || null,
      },
      optimization_result: {
        ...(routePlan.optimization_result || {}),
        vehicleId: assignedVehicle.id,
        driverId: validation.driver.id,
        fuelEfficiencyKmPerL: validFuelEfficiency,
        baselineFuelLiters,
        optimizedFuelLiters,
        fuelSavedLiters,
      },
      updated_at: assignedAt,
    }).eq("id", data.route_plan_id);
    if (routePlanUpdateError) {
      return NextResponse.json({
        error: "Booking was assigned, but the linked route plan could not be synchronized.",
        details: routePlanUpdateError.message,
        booking_id: data.id,
        route_plan_id: data.route_plan_id,
      }, { status: 500 });
    }
  }

  if (previous && (previous.driver_id !== driver_id || previous.vehicle_id !== vehicle_id)) {
    await updateResourceStatus(supabase, { driverId: previous.driver_id, vehicleId: previous.vehicle_id }, "Available");
  }
  await updateResourceStatus(supabase, { driverId: driver_id, vehicleId: vehicle_id }, "Assigned");
  const syncedTripId = await syncAssignedTrip(supabase, data, { driverId: driver_id, driverName: driver_name, vehicleId: vehicle_id, vehiclePlate: assignedVehiclePlate });
  if (!syncedTripId) {
    return NextResponse.json({
      error: "Booking resources were assigned, but the shared trip record could not be created or updated.",
      booking_id: data.id,
    }, { status: 500 });
  }
  if (data.route_plan_id && syncedTripId) {
    const { error: tripLinkError } = await context.serviceClient
      .from("route_plans")
      .update({ trip_id: syncedTripId })
      .eq("id", data.route_plan_id);
    if (tripLinkError) {
      return NextResponse.json({
        error: "Booking assignment and trip were saved, but the route-plan trip link failed.",
        details: tripLinkError.message,
        booking_id: data.id,
        trip_id: syncedTripId,
        route_plan_id: data.route_plan_id,
      }, { status: 500 });
    }
  } else if (data.route_plan_id) {
    return NextResponse.json({
      error: "Booking assignment was saved, but its trip could not be synchronized to the route plan.",
      booking_id: data.id,
      route_plan_id: data.route_plan_id,
    }, { status: 500 });
  }
  const { error: notificationError } = await supabase.from("notifications").insert({
    user_id: driver_id,
    title: "New booking assignment",
    message: `Booking ${data.id} has been assigned to you: ${data.pickup_location || "pickup"} to ${data.dropoff_location || "destination"}.`,
    is_read: false,
  });
  if (notificationError) console.warn("Booking assignment saved but driver notification could not be sent:", notificationError.message);

  try {
    const cargoDescription = String(data.cargo_description || "");
    const parcelIds = cargoDescription.match(/parcel_ids=([^;\s]+)/i)?.[1]?.split(",").map((id: string) => id.trim()).filter(Boolean) || [];
    if (parcelIds.length) {
      const parcelsSupabase = createFtmParcelClient();
      if (!parcelsSupabase) throw new Error("Parcels Supabase is not configured.");
      let parcelUpdate = await parcelsSupabase.from("parcels").update({ status: "booked" }).in("id", parcelIds);
      if (parcelUpdate.error && /invalid input value|status.*constraint|check constraint/i.test(parcelUpdate.error.message)) {
        parcelUpdate = await parcelsSupabase.from("parcels").update({ status: "picked_up" }).in("id", parcelIds);
      }
      if (parcelUpdate.error) console.warn("Unable to preserve booked parcel status during assignment:", parcelUpdate.error.message);
    }
  } catch (error) {
    console.warn("Unable to synchronize parcel assignment status:", error);
  }

  return NextResponse.json({
    ...normalizeBooking(data),
    assignment,
  });
}