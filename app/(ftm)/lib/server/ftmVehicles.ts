import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeVehicle(vehicle: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...vehicle,
    type: vehicle.vehicle_type || vehicle.type,
    plate: vehicle.plate_number || vehicle.plate,
    capacity: vehicle.capacity_kg ?? vehicle.capacity ?? null,
    fuelEfficiency: vehicle.fuel_efficiency ?? vehicle.fuelEfficiency ?? null,
    locationLat: vehicle.location_lat ?? vehicle.locationLat ?? null,
    locationLng: vehicle.location_lng ?? vehicle.locationLng ?? null,
    lastService: vehicle.last_service ?? vehicle.lastService ?? null,
    nextService: vehicle.next_service ?? vehicle.nextService ?? null,
    plateNumber: vehicle.plate_number || vehicle.plate || vehicle.plateNumber || null,
    vehicleType: vehicle.vehicle_type || vehicle.type || vehicle.vehicleType || null,
    capacityKg: vehicle.capacity_kg ?? vehicle.capacity ?? vehicle.capacityKg ?? null,
    courierId: vehicle.courier_id || vehicle.courierId || null,
    mileage: vehicle.mileage ?? vehicle.odometer ?? null,
  };
}

export function buildVehiclePayload(vehicle: Record<string, unknown> = {}): Record<string, unknown> {
  const { locationLat, locationLng, fuelEfficiency, lastService, nextService, ...fields } = vehicle;
  return {
    ...fields,
    id: fields.id || fields.vehicle_id || null,
    plate_number: vehicle.plate_number || vehicle.plate || null,
    vehicle_type: vehicle.vehicle_type || vehicle.type || null,
    capacity_kg: vehicle.capacity_kg ?? vehicle.capacity ?? null,
    fuel_efficiency: vehicle.fuel_efficiency ?? fuelEfficiency ?? null,
    location_lat: vehicle.location_lat ?? locationLat ?? null,
    location_lng: vehicle.location_lng ?? locationLng ?? null,
    last_service: vehicle.last_service ?? lastService ?? null,
    next_service: vehicle.next_service ?? nextService ?? null,
  };
}

export async function getNextVehicleId(supabase: SupabaseClient, courierId?: string | null) {
  const { data, error } = await supabase.from("vehicles").select("id, courier_id");
  if (error) throw error;
  const vehicles = Array.isArray(data) ? data : [];
  const { data: courier } = courierId ? await supabase.from("couriers").select("code").eq("id", courierId).maybeSingle() : { data: null };
  const prefix = String(courier?.code || "VH").toUpperCase().replace(/[^A-Z0-9]/g, "") || "VH";
  const assigned = courierId ? vehicles.filter((vehicle) => String(vehicle.courier_id || "") === String(courierId) || String(vehicle.id || "").toUpperCase().startsWith(`${prefix}-`)) : vehicles;
  const usedIds = new Set(vehicles.map((vehicle) => String(vehicle.id || "")));
  const highest = assigned.reduce((number, vehicle) => {
    const match = String(vehicle.id || "").match(/(\d+)$/);
    return match ? Math.max(number, Number(match[1])) : number;
  }, 0);
  let next = highest + 1;
  let candidate = `${prefix}-${String(next).padStart(3, "0")}`;
  while (usedIds.has(candidate)) candidate = `${prefix}-${String(++next).padStart(3, "0")}`;
  return candidate;
}