import { getFleetVehicleStatus, type FleetVehicleStatus } from "../../fleetData";

export type InventoryRecord = Record<string, unknown> & {
  id?: string | number;
  active_trip?: InventoryRecord | null;
  driver?: string | null;
  driver_id?: string | number | null;
  assignment_conflict?: boolean;
  assignment_status?: string | null;
  assignment_data_available?: boolean;
  trip_data_available?: boolean;
  route_name?: string | null;
  routeName?: string | null;
  route_details?: { route_name?: string | null } | null;
  routeDetails?: { route_name?: string | null } | null;
  to_location?: string | null;
};

export type InventoryRow = {
  vehicle: InventoryRecord;
  status: FleetVehicleStatus;
};

export type VehicleSortField =
  | "id"
  | "plate_number"
  | "vehicle_type"
  | "manufacturer"
  | "capacity_kg"
  | "fuel_type"
  | "mileage"
  | "registration_expiry"
  | "insurance_expiry"
  | "status"
  | "assignment";

export type VehicleDocument = InventoryRecord & {
  signed_url?: string | null;
};

export type VehicleFormValues = {
  plate_number: string;
  vehicle_type: string;
  manufacturer: string;
  model: string;
  year: string;
  capacity_kg: string;
  fuel_type: string;
  mileage: string;
  registration_expiry: string;
  insurance_expiry: string;
  vin_number: string;
  engine_number: string;
};

export const VEHICLE_STATUSES: FleetVehicleStatus[] = ["Available", "On Trip", "Under Maintenance", "Inactive"];

export function valueOf(record: InventoryRecord | null | undefined, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return null;
}

export function textValue(value: unknown, fallback = "Not recorded") {
  return value === null || value === undefined || String(value).trim() === "" ? fallback : String(value);
}

export function formatDate(value: unknown) {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" })
    : "Not recorded";
}

export function documentExpiry(value: unknown, now = Date.now()) {
  if (!value) return "missing" as const;
  const timestamp = new Date(String(value)).getTime();
  if (!Number.isFinite(timestamp)) return "missing" as const;
  if (timestamp < now) return "expired" as const;
  if (timestamp <= now + 30 * 86_400_000) return "soon" as const;
  return "valid" as const;
}

export function getVehicleStatus(vehicle: InventoryRecord, maintenance: InventoryRecord[], relationshipsReady: boolean) {
  const trip = vehicle.active_trip && typeof vehicle.active_trip === "object" ? vehicle.active_trip as InventoryRecord : null;
  const tripDataReady = relationshipsReady && vehicle.trip_data_available !== false;
  return getFleetVehicleStatus(vehicle, trip ? [trip] : [], maintenance, tripDataReady);
}

export function isVehicleAssigned(vehicle: InventoryRecord) {
  if (vehicle.active_trip?.id || vehicle.active_trip?.driver_id || vehicle.driver_id) return true;
  if (vehicle.assignment_conflict) return false;
  const assignmentStatus = String(vehicle.assignment_status || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  return ["assigned", "accepted", "inprogress", "intransit", "dispatched"].includes(assignmentStatus);
}

export function getAssignmentLabel(vehicle: InventoryRecord) {
  const trip = vehicle.active_trip as InventoryRecord | null | undefined;
  if (trip?.id) {
    const routeName = trip.route_name || trip.routeName || trip.route_details?.route_name || trip.routeDetails?.route_name;
    return textValue(routeName, `Trip ${String(trip.id)}`);
  }
  if (vehicle.driver_id) return `Driver ${String(vehicle.driver || vehicle.driver_id)}`;
  if (vehicle.assignment_conflict) return "Conflicting driver links";
  if (isVehicleAssigned(vehicle)) return "Assigned · driver not linked";
  if (vehicle.assignment_data_available === false) return "Assignment unverified";
  return "Unassigned";
}

export function getExpiryTone(value: unknown, now = Date.now()) {
  const expiry = documentExpiry(value, now);
  if (expiry === "expired") return "border-rose-200 bg-rose-50 text-rose-700";
  if (expiry === "soon" || expiry === "missing") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function getExpiryLabel(value: unknown) {
  const expiry = documentExpiry(value);
  if (expiry === "expired") return "Expired";
  if (expiry === "soon") return "Due within 30 days";
  if (expiry === "missing") return "Missing";
  return "Current";
}