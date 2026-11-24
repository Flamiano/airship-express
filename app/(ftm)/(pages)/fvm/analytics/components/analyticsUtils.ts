export type Row = Record<string, unknown>;
export type DateRange = "today" | "7" | "30" | "month" | "custom";

export function field(record: Row | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return null;
}

export function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getDateValue(record: Row | null | undefined, keys: string[]): Date | null {
  for (const key of keys) {
    const raw = record?.[key];
    if (raw == null || raw === "") continue;
    const date = new Date(String(raw));
    if (Number.isFinite(date.getTime())) return date;
  }
  return null;
}

export function getTripDurationMinutes(trip: Row): number {
  const explicitMinutes = safeNumber(field(trip, "duration_minutes", "durationMinutes", "estimated_duration_min", "estimatedDurationMin", "duration_min", "durationMin"));
  if (explicitMinutes != null && explicitMinutes > 0) return explicitMinutes;

  const start = getDateValue(trip, ["actual_departure", "actualDeparture", "estimated_departure", "estimatedDeparture", "scheduled_at", "scheduledAt"]);
  const end = getDateValue(trip, ["actual_arrival", "actualArrival", "estimated_arrival", "estimatedArrival", "delivered_at", "deliveredAt", "completed_at", "completedAt"]);
  if (start && end) {
    const diffMs = end.getTime() - start.getTime();
    if (diffMs >= 0) return Math.max(0, diffMs / 60_000);
  }

  const distanceKm = safeNumber(field(trip, "distance_km", "distanceKm", "route_distance_km", "routeDistanceKm", "mileage_km", "mileageKm"));
  if (distanceKm != null && distanceKm > 0) return Math.max(15, (distanceKm / 22) * 60);

  return 0;
}

export function getTripDistanceKm(trip: Row): number {
  const explicitDistance = safeNumber(field(trip, "distance_km", "distanceKm", "route_distance_km", "routeDistanceKm", "mileage_km", "mileageKm"));
  if (explicitDistance != null && explicitDistance >= 0) return explicitDistance;

  const durationMinutes = getTripDurationMinutes(trip);
  if (durationMinutes > 0) return Number(((durationMinutes / 60) * 22).toFixed(1));

  return 0;
}

export function getTripLoadKg(trip: Row): number {
  return safeNumber(field(trip, "load_kg", "loadKg", "cargo_weight_kg", "cargoWeightKg", "parcel_weight_kg", "parcelWeightKg", "total_weight_kg", "totalWeightKg")) ?? 0;
}

export function getMaintenanceMinutes(record: Row): number {
  const explicitMinutes = safeNumber(field(record, "duration_minutes", "durationMinutes"));
  if (explicitMinutes != null && explicitMinutes > 0) return explicitMinutes;

  const start = getDateValue(record, ["scheduled_at", "scheduledAt", "started_at", "startedAt"]);
  const end = getDateValue(record, ["performed_at", "performedAt", "completed_at", "completedAt", "finished_at", "finishedAt"]);
  if (start && end) {
    const diffMs = end.getTime() - start.getTime();
    if (diffMs > 0) return Math.max(0, diffMs / 60_000);
  }

  return 0;
}

export function dateOf(record: Row | null | undefined): Date | null {
  const raw = field(record, "actual_arrival", "delivered_at", "completed_at", "updated_at", "updatedAt", "created_at", "createdAt", "scheduled_at", "estimated_departure", "estimated_departure_at");
  if (!raw) return null;
  const value = new Date(String(raw));
  return Number.isFinite(value.getTime()) ? value : null;
}

export function resolveVehicleId(record: Row): string {
  return String(field(record, "id", "vehicle_id", "vehicleId") ?? "");
}

export function resolveVehiclePlate(record: Row): string {
  return String(field(record, "plate_number", "plateNumber", "plate", "vehicle_plate", "vehiclePlate") ?? resolveVehicleId(record) ?? "Vehicle");
}

export function resolveVehicleType(record: Row): string {
  return String(field(record, "vehicle_type", "vehicleType", "type", "fleet_type") ?? "Not recorded");
}

export function formatCompactNumber(value: number | null | undefined, suffix = "") {
  if (value == null || Number.isNaN(value)) return "—";
  const safeValue = Number(value);
  if (!Number.isFinite(safeValue)) return "—";
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: safeValue >= 100 ? 0 : 1 }).format(safeValue);
  return suffix ? `${formatted}${suffix}` : formatted;
}

export function formatHours(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(1)}h`;
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Number(value).toFixed(1)}%`;
}

export function getRangeWindow(range: DateRange, customFrom: string, customTo: string, referenceNow: number) {
  const start = new Date(referenceNow || Date.now());
  const end = new Date(referenceNow || Date.now());

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "7") {
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "30") {
    start.setDate(end.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "custom" && customFrom) {
    const from = new Date(`${customFrom}T00:00:00`);
    const to = customTo ? new Date(`${customTo}T23:59:59.999`) : new Date(referenceNow || Date.now());
    return {
      start: Number.isFinite(from.getTime()) ? from : new Date(referenceNow || Date.now()),
      end: Number.isFinite(to.getTime()) ? to : new Date(referenceNow || Date.now()),
    };
  }

  start.setDate(end.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getPreviousWindow(range: DateRange, customFrom: string, customTo: string, referenceNow: number) {
  const current = getRangeWindow(range, customFrom, customTo, referenceNow);
  const durationMs = current.end.getTime() - current.start.getTime();
  const previousEnd = new Date(current.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return { start: previousStart, end: previousEnd };
}

export function calcDelta(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  return Number.isFinite(delta) ? delta : null;
}
