import { NextResponse } from "next/server";
import { hasPermission } from "../../lib/permissions";
import { authenticateFtmRequest } from "../../lib/server/ftmRequestAuth";
import { getAirshipCouriers } from "../../lib/server/ftmCourier";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const { context } = auth;
  if (!hasPermission(context.user.role, "driverPerformance", "view")) {
    return NextResponse.json({ error: "Permission denied: driverPerformance.view" }, { status: 403 });
  }

  try {
    const couriers = await getAirshipCouriers(context.serviceClient);
    const courierIds = new Set(couriers.map((courier) => courier.id));
    if (!courierIds.size) return NextResponse.json([]);
    const requestedCourierId = new URL(request.url).searchParams.get("courier_id");
    if (requestedCourierId && !courierIds.has(requestedCourierId)) return NextResponse.json([]);
    const queryDrivers = async (includePhone: boolean, includeLicense: boolean) => {
      const fields = ["id", "email", "full_name", ...(includePhone ? ["phone"] : []), "role", "is_active", "courier_id", "created_at", "updated_at", ...(includeLicense ? ["license_number", "license_expiration"] : [])].join(", ");
      const result = await context.serviceClient.from("users").select(fields).eq("role", "driver").in("courier_id", [...courierIds]).order("full_name", { ascending: true });
      return { data: result.data as unknown as Array<Record<string, unknown>> | null, error: result.error };
    };
    let driverResult = await queryDrivers(true, true);
    if (driverResult.error && /license_number|license_expiration|column .* does not exist|schema cache/i.test(driverResult.error.message)) {
      driverResult = await queryDrivers(true, false);
    }
    if (driverResult.error && /phone|column .* does not exist|schema cache/i.test(driverResult.error.message)) {
      driverResult = await queryDrivers(false, false);
    }
    const { data: queriedDrivers, error } = driverResult;
    if (error) return NextResponse.json({ error: `Unable to load drivers: ${error.message}` }, { status: 500 });
    if (!queriedDrivers?.length) return NextResponse.json([]);

    if (!queriedDrivers?.length) return NextResponse.json([]);
    const filteredDrivers = queriedDrivers;
    const courierNames = new Map(couriers.map((courier) => [courier.id, courier.name]));
    const driverIds = filteredDrivers.map((driver) => String(driver.id));
    const activeAssignmentStatuses = new Set(["assigned", "accepted", "in_progress"]);
    const canonicalVehicleByDriver = new Map<string, string>();
    if (driverIds.length) {
      const { data: assignments } = await context.serviceClient
        .from("booking_assignments")
        .select("driver_id,vehicle_id,status,assigned_at")
        .in("driver_id", driverIds)
        .order("assigned_at", { ascending: false });
      (assignments || []).forEach((assignment) => {
        const driverId = assignment.driver_id == null ? "" : String(assignment.driver_id);
        const vehicleId = assignment.vehicle_id == null ? "" : String(assignment.vehicle_id);
        if (driverId && vehicleId && activeAssignmentStatuses.has(String(assignment.status || "").toLowerCase()) && !canonicalVehicleByDriver.has(driverId)) {
          canonicalVehicleByDriver.set(driverId, vehicleId);
        }
      });
    }

    const enriched = await Promise.all(filteredDrivers.map(async (driver) => {
      const result: Record<string, unknown> = {
        ...driver,
        status: driver.is_active === false ? "Inactive" : "Available",
        courier: courierNames.get(String(driver.courier_id)) || null,
      };
      const canonicalVehicleId = canonicalVehicleByDriver.get(String(driver.id));
      if (canonicalVehicleId) result.vehicle_id = canonicalVehicleId;
      else try {
        const { data: assignments, error: assignmentError } = await context.serviceClient
          .from("driver_assignments")
          .select("vehicle_id")
          .eq("driver_id", driver.id)
          .limit(1);
        if (!assignmentError && assignments?.[0]?.vehicle_id) result.vehicle_id = assignments[0].vehicle_id;
      } catch {
        // Assignment enrichment is optional for older FTM schemas.
      }

      try {
        const { data: location, error: locationError } = await context.serviceClient
          .from("mobile_device_tracking")
          .select("lat, lng, recorded_at")
          .eq("driver_id", driver.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!locationError && location) {
          result.last_location_lat = location.lat;
          result.last_location_lng = location.lng;
          result.last_location_at = location.recorded_at;
          return result;
        }
        const fallback = await context.serviceClient
          .from("driver_tracking")
          .select("latitude, longitude, recorded_at")
          .eq("driver_id", driver.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!fallback.error && fallback.data) {
          result.last_location_lat = fallback.data.latitude;
          result.last_location_lng = fallback.data.longitude;
          result.last_location_at = fallback.data.recorded_at;
        }
      } catch {
        // Location history is optional for older FTM schemas.
      }
      return result;
    }));
    return NextResponse.json(enriched);
  } catch (error) {
    console.warn("Driver list error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load drivers." }, { status: 500 });
  }
}