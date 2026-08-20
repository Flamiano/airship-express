import { supabase } from "./supabaseClient";
import { parcelSupabase } from "./parcelSupabaseClient";

export async function fetchJson(path: string, opts: RequestInit = {}) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed ${res.status}: ${text}`);
  }
  return res.json();
}

function isIgnorableBackendError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Failed to fetch|JWT issued at future|invalid JWT|permission denied|not authorized|RLS|rls|Unauthorized/i.test(message);
}

function reportBackendLoadFailure(resource: string, error: unknown) {
  // The local Express API is optional while developing the UI. A connection
  // refusal should fall back to the in-memory store without a console error.
  if (error instanceof TypeError && error.message === "Failed to fetch") return;
  if (isIgnorableBackendError(error)) return;
  console.error(`Failed to load ${resource} from backend proxy`, error);
}

async function readSupabaseTable<T = Record<string, unknown>>(table: string, select = "*") {
  try {
    const { data, error } = await supabase.from(table).select(select).limit(200);
    if (error) throw error;
    return (Array.isArray(data) ? data : []) as T[];
  } catch (error) {
    console.warn(`[api] ${table} unavailable`, error);
    return [] as T[];
  }
}

async function readParcelTable<T = Record<string, unknown>>(table: string, select = "*") {
  try {
    const { data, error } = await parcelSupabase.from(table).select(select).limit(200);
    if (error) throw error;
    return (Array.isArray(data) ? data : []) as T[];
  } catch (error) {
    console.warn(`[api] parcel table ${table} unavailable`, error);
    return [] as T[];
  }
}

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "Unknown";
  if (["active", "available", "ready", "approved", "assigned"].includes(raw)) return "Active";
  if (["in transit", "in_transit", "transit", "dispatch", "dispatched", "moving"].includes(raw)) return "In Transit";
  if (["maintenance", "under maintenance", "out of service", "cancelled", "cancel", "pending"].includes(raw)) return "Maintenance";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export async function getCostEntries() {
  try {
    return await fetchJson('/api/costs');
  } catch (error) {
    reportBackendLoadFailure("cost entries", error);
    return [] as any[];
  }
}

export async function getTrips(options: { light?: boolean } = {}) {
  try {
    const query = options.light ? "?light=true" : "";
    return await fetchJson(`/api/trips${query}`);
  } catch (error) {
    reportBackendLoadFailure("trips", error);
    return [] as any[];
  }
}

export async function getDashboardSnapshot() {
  try {
    return await fetchJson('/api/dashboard');
  } catch (error) {
    reportBackendLoadFailure("dashboard snapshot", error);
    return {
      counts: { vehicles: 0, trips: 0, bookings: 0, drivers: 0 },
      vehicles: [],
      trips: [],
      bookings: [],
      drivers: [],
      costEntries: [],
      fuelLogs: [],
    };
  }
}

export async function getVehicles() {
  try {
    return await fetchJson('/api/vehicles');
  } catch (error) {
    reportBackendLoadFailure("vehicles", error);
    return [] as any[];
  }
}

export async function getBookings() {
  try {
    return await fetchJson('/api/bookings');
  } catch (error) {
    reportBackendLoadFailure("bookings", error);
    return [] as any[];
  }
}

export async function getDrivers() {
  try {
    return await fetchJson('/api/drivers');
  } catch (error) {
    reportBackendLoadFailure("drivers", error);
    return [] as any[];
  }
}

export async function getParcels() {
  try {
    return await fetchJson('/api/parcels');
  } catch (error) {
    reportBackendLoadFailure("parcels", error);
    return [] as any[];
  }
}

export async function getFuelLogs() {
  try {
    return await fetchJson('/api/fuel/logs');
  } catch (error) {
    reportBackendLoadFailure("fuel logs", error);
    return [] as any[];
  }
}

export async function getPendingParcelsByCourier() {
  return readParcelTable<any>("parcels", "*");
}

export async function getInventoryItems() {
  return readParcelTable<any>("inventory_items", "*");
}

export async function getIncidentReports() {
  const rows = await readSupabaseTable<any>("incident_reports", "*");
  return rows.map((report) => ({
    id: report.id,
    tripId: report.trip_id ?? report.tripId ?? null,
    vehicleId: report.vehicle_id ?? report.vehicleId ?? null,
    driverId: report.driver_id ?? report.driverId ?? null,
    incidentType: report.incident_type ?? report.incidentType ?? "Other",
    description: report.description ?? report.details ?? "No details available.",
    photoUrl: report.photo_url ?? report.photoUrl ?? null,
    reportedAt: report.reported_at ?? report.reportedAt ?? report.created_at ?? report.createdAt ?? null,
  }));
}

export async function getNotifications() {
  const rows = await readSupabaseTable<any>("notifications", "*");
  return rows.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    notificationType: notification.notification_type ?? notification.type ?? null,
    isRead: notification.is_read ?? notification.isRead ?? false,
    createdAt: notification.created_at ?? notification.createdAt ?? null,
  }));
}

export async function getTrackingEvents() {
  const rows = await readSupabaseTable<any>("tracking_events", "*");
  return rows.map((event) => ({
    id: event.id,
    entityType: event.entity_type ?? event.entityType ?? null,
    entityId: event.entity_id ?? event.entityId ?? null,
    tripId: event.trip_id ?? event.tripId ?? null,
    latitude: Number(event.latitude ?? event.lat ?? 0),
    longitude: Number(event.longitude ?? event.lng ?? 0),
    speed: Number(event.speed ?? 0),
    heading: Number(event.heading ?? 0),
    recordedAt: event.recorded_at ?? event.recordedAt ?? event.created_at ?? event.createdAt ?? null,
  }));
}

export async function getAlertsSnapshot() {
  const [incidents, notifications, trackingEvents] = await Promise.all([
    getIncidentReports(),
    getNotifications(),
    getTrackingEvents(),
  ]);
  return { incidents, notifications, trackingEvents };
}

export async function getRoutePlans(courier?: string) {
  const query = courier ? `?courier=${encodeURIComponent(courier)}` : "";
  return fetchJson(`/api/route-plans${query}`);
}

export async function getRoutePlan(id: string) {
  return fetchJson(`/api/route-plans/${encodeURIComponent(id)}`);
}

export async function createRoutePlan(payload: Record<string, unknown>) {
  return fetchJson("/api/route-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createBulkBooking(payload: Record<string, unknown>) {
  return fetchJson("/api/parcels/bulk-booking", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateParcelStatus(parcelId: string, status: string) {
  return fetchJson(`/api/parcels/${encodeURIComponent(parcelId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function createTrip(payload: Record<string, unknown>) {
  return fetchJson("/api/trips", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export default {
  fetchJson,
  getCostEntries,
  getTrips,
  getDashboardSnapshot,
  getVehicles,
  getBookings,
  getDrivers,
  getParcels,
  getInventoryItems,
  createTrip,
  getFuelLogs,
};
