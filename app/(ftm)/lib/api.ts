import { supabase } from "./supabase/supabaseClient";
import { getFtmApiUrl } from "./apiBase";

export async function fetchJson(path: string, opts: RequestInit = {}) {
  const url = path.startsWith("http") ? path : getFtmApiUrl(path);
  let slowTimer: number | undefined;

  const getAccessToken = async () => {
    const current = await supabase.auth.getSession();
    if (current.data.session?.access_token) return current.data.session.access_token;

    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session?.access_token ?? null;
  };

  if (typeof window !== "undefined") {
    slowTimer = window.setTimeout(() => window.dispatchEvent(new Event("ftm:network-slow")), 2500);
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/ftmAuth")) {
        window.location.assign(`/ftmAuth?next=${encodeURIComponent(window.location.pathname)}`);
      }
      throw new Error("Your session has expired. Please sign in again.");
    }
    const headers = new Headers(opts.headers);
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${accessToken}`);
    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/ftmAuth")) {
        window.location.assign(`/ftmAuth?next=${encodeURIComponent(window.location.pathname)}`);
      }
      throw new Error(`Request failed ${res.status}: ${text}`);
    }
    return res.json();
  } finally {
    if (slowTimer) window.clearTimeout(slowTimer);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("ftm:network-finished"));
  }
}

export async function exportSystemBackup() {
  const current = await supabase.auth.getSession();
  const session = current.data.session || (await supabase.auth.refreshSession()).data.session;
  if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch(getFtmApiUrl("/api/system-backup/export"), {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Request failed ${response.status}: ${text}`);
  }
  return response.blob();
}

export async function getCurrentProfile() {
  return fetchJson("/api/profile") as Promise<{
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    role?: string | null;
    phone?: string | null;
    username?: string | null;
    employee_id?: string | null;
    department?: string | null;
    license_number?: string | null;
    license_expiry?: string | null;
    courier_id?: string | null;
    is_active?: boolean;
    created_at?: string | null;
    last_sign_in_at?: string | null;
    updated_at?: string | null;
  }>;
}

export async function updateCurrentProfile(payload: { full_name?: string; phone?: string }) {
  return fetchJson("/api/profile", { method: "PATCH", body: JSON.stringify(payload) }) as Promise<{
    id: string;
    full_name: string | null;
    phone: string | null;
    updated_at: string | null;
  }>;
}

export async function uploadProfileAvatar(content: string, onProgress?: (progress: number) => void) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token || (await supabase.auth.refreshSession()).data.session?.access_token;
  if (!accessToken) throw new Error("Your session has expired. Please sign in again.");

  return new Promise<{ avatar_url: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", getFtmApiUrl("/api/profile/avatar"));
    request.setRequestHeader("Content-Type", "application/json");
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.max(15, Math.min(75, Math.round((event.loaded / event.total) * 75))));
    };
    request.onerror = () => reject(new Error("Unable to reach the avatar service. Please try again."));
    request.onload = () => {
      let response: { avatar_url?: string; error?: string } = {};
      try { response = JSON.parse(request.responseText || "{}"); } catch { /* handled below */ }
      if (request.status < 200 || request.status >= 300 || !response.avatar_url) {
        reject(new Error(response.error || "The photo could not be uploaded."));
        return;
      }
      onProgress?.(80);
      resolve({ avatar_url: response.avatar_url });
    };
    request.send(JSON.stringify({ content }));
  });
}

export async function removeProfileAvatar() {
  return fetchJson("/api/profile/avatar", { method: "DELETE" }) as Promise<{ avatar_url: null }>;
}

function isIgnorableBackendError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Failed to fetch|fetch failed|JWT issued at future|invalid JWT|permission denied|not authorized|RLS|rls|Unauthorized/i.test(message);
}

function reportBackendLoadFailure(resource: string, error: unknown) {
  // A connection failure should fall back to the local data store quietly.
  if (error instanceof TypeError && /Failed to fetch|fetch failed/i.test(error.message)) return;
  if (isIgnorableBackendError(error)) return;
  console.error(`Failed to load ${resource} from the API route`, error);
}

async function readSupabaseTable<T = Record<string, unknown>>(table: string, select = "*") {
  const { data, error } = await supabase.from(table).select(select).limit(200);
  if (error) {
    reportBackendLoadFailure(table, error);
    throw new Error(`Unable to load ${table}: ${error.message}`);
  }
  return (Array.isArray(data) ? data : []) as T[];
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
    const rows = await fetchJson('/api/costs');
    return (Array.isArray(rows) ? rows : []).map((entry) => ({
      ...entry,
      id: entry.id ?? entry.entry_id,
      vehicleId: entry.vehicle_id ?? entry.vehicleId,
      tripId: entry.trip_id ?? entry.tripId,
      category: entry.category ?? "Other",
      amount: Number(entry.amount ?? 0),
      entryDate: entry.entry_date ?? entry.entryDate ?? entry.created_at,
      remarks: entry.remarks ?? entry.description ?? "",
      receipt_image: entry.receipt_image ?? entry.receiptImage,
    }));
  } catch (error) {
    reportBackendLoadFailure("cost entries", error);
    throw error;
  }
}

export async function getDashboardSnapshot() {
  try {
    return await fetchJson('/api/dashboard');
  } catch (error) {
    reportBackendLoadFailure("dashboard snapshot", error);
    throw error;
  }
}

export async function getTrips(options: { light?: boolean; all?: boolean; performance?: boolean } = {}) {
  try {
    const params = new URLSearchParams();
    if (options.light) params.set("light", "true");
    if (options.all) params.set("all", "true");
    if (options.performance) params.set("performance", "true");
    const query = params.toString() ? `?${params.toString()}` : "";
    return await fetchJson(`/api/trips${query}`);
  } catch (error) {
    reportBackendLoadFailure("trips", error);
    throw error;
  }
}

export async function getVehicles() {
  try {
    return await fetchJson('/api/vehicles');
  } catch (error) {
    reportBackendLoadFailure("vehicles", error);
    throw error;
  }
}

export async function getMaintenanceRecords() {
  try {
    return await fetchJson('/api/maintenance');
  } catch (error) {
    reportBackendLoadFailure("maintenance records", error);
    throw error;
  }
}

export async function createMaintenanceRecord(payload: Record<string, unknown>) {
  return fetchJson('/api/maintenance', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCouriers() {
  try {
    return await fetchJson('/api/vehicles/couriers');
  } catch (error) {
    reportBackendLoadFailure("couriers", error);
    throw error;
  }
}

export async function createSupportTicket(payload: { driver_id?: string; subject?: string; message: string }) {
  return fetchJson("/api/support/report", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getNextVehicleId(courierId?: string) {
  const query = courierId ? `?courier_id=${encodeURIComponent(courierId)}` : "";
  const result = await fetchJson(`/api/vehicles/next-id${query}`);
  return String(result?.id || "");
}

export async function createVehicle(payload: Record<string, unknown>) {
  return fetchJson('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateVehicle(id: string, payload: Record<string, unknown>) {
  return fetchJson('/api/vehicles', {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, id }),
  });
}

export async function createVehicleDocument(payload: Record<string, unknown>) {
  return fetchJson('/api/vehicles/documents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadVehicleDocument(payload: Record<string, unknown>) {
  return fetchJson('/api/vehicles/documents/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getBookings() {
  try {
    return await fetchJson('/api/bookings');
  } catch (error) {
    reportBackendLoadFailure("bookings", error);
    throw error;
  }
}

export async function getDrivers() {
  try {
    return await fetchJson('/api/drivers');
  } catch (error) {
    reportBackendLoadFailure("drivers", error);
    throw error;
  }
}

export async function getDriverAssignments() {
  try {
    return await fetchJson('/api/drivers/assignments');
  } catch (error) {
    reportBackendLoadFailure("driver assignments", error);
    throw error;
  }
}

export async function getHrEmployees(options: { status?: string; department?: string } = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.department) params.set('department', options.department);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchJson(`/api/hr/employees${query}`);
}

export async function getHrAttendance(options: { employee_id?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (options.employee_id) params.set('employee_id', options.employee_id);
  if (options.status) params.set('status', options.status);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchJson(`/api/hr/attendance${query}`);
}

export async function getHrShifts(options: { driver_id?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (options.driver_id) params.set('driver_id', options.driver_id);
  if (options.status) params.set('status', options.status);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchJson(`/api/hr/shifts${query}`);
}

export async function getHrFreightLoads(options: { driver_id?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (options.driver_id) params.set('driver_id', options.driver_id);
  if (options.status) params.set('status', options.status);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchJson(`/api/hr/freight-loads${query}`);
}

export async function getParcels(options: { status?: string; history?: boolean } = {}) {
  try {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.history) params.set('history', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return await fetchJson(`/api/parcels${query}`);
  } catch (error) {
    reportBackendLoadFailure("parcels", error);
    throw error;
  }
}

export async function getParcelHistory() {
  return fetchJson('/api/parcels?history=true');
}

export async function getFuelLogs(): Promise<{ rows: Record<string, unknown>[]; sourceErrors: string[] }> {
  const result: unknown = await fetchJson('/api/fuel/logs');
  if (!result || typeof result !== "object" || !("rows" in result) || !("sourceErrors" in result)
    || !Array.isArray(result.rows) || !Array.isArray(result.sourceErrors)) {
    throw new Error("Fuel records returned an invalid response.");
  }
  if (!result.rows.every((row: unknown) => row != null && typeof row === "object" && !Array.isArray(row))
    || !result.sourceErrors.every((error: unknown) => typeof error === "string")) {
    throw new Error("Fuel records returned invalid row or source-error data.");
  }
  return {
    rows: result.rows as Record<string, unknown>[],
    sourceErrors: result.sourceErrors,
  };
}

export async function getExpenses() {
  try {
    return await fetchJson('/api/expenses');
  } catch (error) {
    reportBackendLoadFailure("expenses", error);
    throw error;
  }
}

export async function getCosts() {
  return fetchJson('/api/costs');
}

export async function createExpense(payload: Record<string, unknown>) {
  return fetchJson('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPendingParcelsByCourier() {
  return getParcels({ history: true });
}

export async function getInventoryItems() {
  try {
    const items = await fetchJson("/api/inventory");
    return Array.isArray(items) ? items : [];
  } catch (error) {
    reportBackendLoadFailure("inventory items", error);
    throw error;
  }
}

export async function getIncidentReports() {
  const rows = await readSupabaseTable<Record<string, unknown>>("incident_reports", "*");
  return rows.map((report) => ({
    id: String(report.id ?? ""),
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
  const rows = await readSupabaseTable<Record<string, unknown>>("notifications", "*");
  return rows.map((notification) => ({
    id: String(notification.id ?? ""),
    title: String(notification.title ?? ""),
    message: String(notification.message ?? ""),
    notificationType: notification.notification_type ?? notification.type ?? null,
    isRead: notification.is_read ?? notification.isRead ?? false,
    createdAt: notification.created_at ?? notification.createdAt ?? null,
  }));
}

export async function getTrackingEvents() {
  const rows = await readSupabaseTable<Record<string, unknown>>("tracking_events", "*");
  return rows.map((event) => ({
    id: String(event.id ?? ""),
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

export async function getAlerts(options: { status?: string; category?: string; severity?: string; limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.category) params.set("category", options.category);
  if (options.severity) params.set("severity", options.severity);
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchJson(`/api/alerts${query}`);
}

export async function updateAlertStatus(id: string, status: "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED") {
  return fetchJson(`/api/alerts/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getAlertHistory(options: { limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams();
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchJson(`/api/alerts/history${query}`);
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

function normalizeParcelStatusForApi(status: string) {
  const value = String(status ?? "").trim().toLowerCase();
  if (!value) return value;
  switch (value) {
    case "ready_for_booking":
    case "ready":
    case "received":
    case "pending":
      return "picked_up";
    case "booked":
    case "assigned":
      return "booked";
    default:
      return value;
  }
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
    body: JSON.stringify({ status: normalizeParcelStatusForApi(status) }),
  });
}

export async function createTrip(payload: Record<string, unknown>) {
  return fetchJson("/api/trips", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmTripPickup(tripId: string, payload: {
  driver_id: string;
  proof_url: string;
  manifest_verified: boolean;
  picked_up_parcel_ids?: string[];
}) {
  return fetchJson(`/api/trips/${encodeURIComponent(tripId)}/pickup-confirmation`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startTrip(tripId: string) {
  return fetchJson(`/api/trips/${encodeURIComponent(tripId)}/start`, {
    method: "POST",
  });
}

export async function assignBookingResources(bookingId: string, payload: Record<string, unknown>) {
  return fetchJson(`/api/bookings/${encodeURIComponent(bookingId)}/assignment`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getAdminUsers() {
  return fetchJson("/api/admin/users");
}

export async function updateAdminUserRole(userId: string, role: string) {
  return fetchJson(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function lockAdminUser(userId: string) {
  return fetchJson(`/api/admin/users/${encodeURIComponent(userId)}/lock`, { method: "PATCH" });
}

export async function unlockAdminUser(userId: string) {
  return fetchJson(`/api/admin/users/${encodeURIComponent(userId)}/unlock`, { method: "PATCH" });
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
