export type FleetVehicleStatus = "Available" | "On Trip" | "Under Maintenance" | "Inactive" | "Unverified";
export type FleetRecord = Record<string, unknown>;

function field(record: FleetRecord | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && String(value).trim()) return value;
  }
  return null;
}

function normalized(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isActiveFleetTrip(trip: FleetRecord) {
  const status = normalized(trip.status);
  if (/complete|deliver|arrived|cancel|reject|fail|finished/.test(status)) return false;
  return /assign|accept|pickup|scheduled|dispatch|transit|deliver|enroute|active|moving|progress|delay|late/.test(status);
}

export function isCompletedFleetTrip(trip: FleetRecord) {
  return /complete|deliver|arrived|finished|success/.test(normalized(trip.status ?? trip.booking_status));
}

export function isDelayedFleetTrip(trip: FleetRecord, now: number) {
  if (/delay|late|overdue/.test(normalized(trip.status ?? trip.delivery_status))) return true;
  const eta = field(trip, "estimated_arrival", "estimatedArrival", "eta_at");
  return Boolean(eta && now > 0 && isActiveFleetTrip(trip) && new Date(String(eta)).getTime() < now);
}

export function getFleetVehicleStatus(vehicle: FleetRecord, trips: FleetRecord[], maintenance: FleetRecord[], relationshipsReady = true): FleetVehicleStatus {
  const vehicleId = String(field(vehicle, "id", "vehicle_id") || "");
  const hasActiveTrip = trips.some((trip) => String(field(trip, "vehicle_id", "vehicleId") || "") === vehicleId && isActiveFleetTrip(trip));
  if (hasActiveTrip) return "On Trip";

  const status = normalized(field(vehicle, "status", "availability"));
  const hasActiveMaintenance = maintenance.some((record) => String(record.vehicle_id || "") === vehicleId && normalized(record.status) === "inprogress");
  if (hasActiveMaintenance || /maintenance|service|repair|outofservice/.test(status)) return "Under Maintenance";
  if (/inactive|offline|unavailable|retired/.test(status)) return "Inactive";
  if (!relationshipsReady) return "Unverified";
  if (/available|ready|idle|standby|free/.test(status)) return "Available";
  return "Unverified";
}