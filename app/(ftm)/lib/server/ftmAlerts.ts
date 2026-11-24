import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type AlertRecord = Record<string, unknown> & { metadata?: Record<string, unknown> | null };
const SEVERITIES = new Set(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);

function normalizeSeverity(value: unknown, fallback = "MEDIUM") {
  const normalized = String(value || "").trim().toUpperCase();
  return SEVERITIES.has(normalized) ? normalized : fallback;
}

function normalizeStatus(value: unknown) {
  return String(value || "ACTIVE").trim().toUpperCase();
}

function incidentToAlert(incident: AlertRecord) {
  const type = String(incident.incident_type || incident.type || "OTHER").toUpperCase();
  const severity = /SOS|EMERGENCY|ACCIDENT|THEFT/.test(type) ? "CRITICAL" : /BREAKDOWN|UNSAFE|SAFETY/.test(type) ? "HIGH" : /DELAY|ROUTE/.test(type) ? "MEDIUM" : "LOW";
  return {
    alert_type: type,
    category: "SAFETY",
    severity,
    title: incident.title || `${type.replace(/_/g, " ")} reported`,
    message: incident.description || incident.details || "Safety incident reported.",
    source_type: "INCIDENT_REPORT",
    source_id: String(incident.id),
    driver_id: incident.driver_id || null,
    vehicle_id: incident.vehicle_id || null,
    trip_id: incident.trip_id || null,
    booking_id: incident.booking_id || null,
    action_required: severity === "CRITICAL" || severity === "HIGH",
    metadata: { reason: incident.description || incident.details || null, photo_url: incident.photo_url || null, reported_at: incident.reported_at || incident.created_at || null },
  };
}

function notificationToAlert(notification: AlertRecord) {
  const type = String(notification.notification_type || notification.type || "NOTIFICATION").toUpperCase();
  const text = `${notification.title || ""} ${notification.message || ""}`.toLowerCase();
  const severity = /emergency|sos|critical/.test(text) ? "CRITICAL" : /overdue|breakdown|failed/.test(text) ? "HIGH" : /warning|delay|maintenance/.test(text) ? "MEDIUM" : "INFO";
  return {
    alert_type: type,
    category: /MAINT|SERVICE/.test(type) || /maintenance|service/.test(text) ? "MAINTENANCE" : "OPERATIONS",
    severity,
    title: notification.title || "Operational notification",
    message: notification.message || "Notification requires review.",
    source_type: "NOTIFICATION",
    source_id: String(notification.id),
    driver_id: notification.user_id || null,
    action_required: severity !== "INFO",
    metadata: { reason: notification.message || notification.title || null, is_read: Boolean(notification.is_read), notification_type: type },
  };
}

function maintenanceToAlert(record: AlertRecord) {
  const status = String(record.status || "").toLowerCase();
  const dueDate = typeof record.due_date === "string" ? new Date(record.due_date) : null;
  const overdue = /overdue|past due|expired/.test(status) || Boolean(dueDate && dueDate < new Date());
  const reason = record.description || record.notes || `Maintenance is ${overdue ? "overdue" : "due"}.`;
  return {
    alert_type: overdue ? "MAINTENANCE_OVERDUE" : "MAINTENANCE_DUE",
    category: "MAINTENANCE",
    severity: overdue ? "HIGH" : "MEDIUM",
    title: record.title || record.maintenance_type || "Maintenance notification",
    message: reason,
    source_type: "MAINTENANCE_HISTORY",
    source_id: String(record.id),
    vehicle_id: record.vehicle_id || null,
    action_required: true,
    metadata: { reason, due_date: record.due_date || null, status: record.status || null, mileage: record.mileage || null },
  };
}

function tripToAlert(trip: AlertRecord) {
  const status = String(trip.status || "UNKNOWN").trim().toUpperCase();
  const needsAction = /DELAY|LATE|CANCEL|REJECT|UNAVAILABLE|FAILED/.test(status);
  return {
    alert_type: `TRIP_${status}`,
    category: "OPERATIONS",
    severity: needsAction ? (/CANCEL|FAILED|UNAVAILABLE/.test(status) ? "HIGH" : "MEDIUM") : "INFO",
    status: status === "COMPLETED" ? "RESOLVED" : "ACTIVE",
    title: `Trip ${status.replace(/_/g, " ").toLowerCase()}`,
    message: `Trip ${trip.id} is ${String(trip.status || "unknown").toLowerCase()}.`,
    source_type: "TRIP_STATUS",
    source_id: `${trip.id}:${status}`,
    driver_id: trip.driver_id || null,
    vehicle_id: trip.vehicle_id || null,
    trip_id: trip.id || null,
    booking_id: trip.booking_id || null,
    action_required: needsAction,
    action_url: "/vrds/bookings",
    metadata: { reason: `Trip status changed to ${String(trip.status || "unknown").toLowerCase()}.`, status, progress: trip.progress ?? null, updated_at: trip.updated_at || null },
  };
}

function vehicleToAlert(vehicle: AlertRecord) {
  const status = String(vehicle.status || vehicle.availability || "").trim().toUpperCase();
  if (!/MAINTENANCE|UNAVAILABLE|OUT_OF_SERVICE|BREAKDOWN|OFFLINE/.test(status)) return null;
  const currentStatus = String(vehicle.status || vehicle.availability).toLowerCase();
  return {
    alert_type: `VEHICLE_${status}`,
    category: "FLEET",
    severity: /BREAKDOWN|OUT_OF_SERVICE|UNAVAILABLE/.test(status) ? "HIGH" : "MEDIUM",
    title: `Vehicle ${status.replace(/_/g, " ").toLowerCase()}`,
    message: `Vehicle ${vehicle.plate_number || vehicle.id} is ${currentStatus}.`,
    source_type: "VEHICLE_STATUS",
    source_id: `${vehicle.id}:${status}`,
    vehicle_id: vehicle.id || null,
    action_required: true,
    action_url: "/fvm",
    metadata: { reason: `Vehicle status is ${currentStatus}.`, status, plate_number: vehicle.plate_number || null },
  };
}

function isMissingAlertsTable(error: { message?: string } | null) {
  return Boolean(error && /schema cache|relation .*alerts|table .*alerts/i.test(error.message || ""));
}

async function syncSourceAlerts(supabase: SupabaseClient) {
  const results = await Promise.all([
    supabase.from("incident_reports").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("maintenance_history").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("trips").select("id, booking_id, vehicle_id, driver_id, status, progress, updated_at").order("updated_at", { ascending: false }).limit(200),
    supabase.from("vehicles").select("id, plate_number, status, availability, updated_at").order("updated_at", { ascending: false }).limit(200),
  ]);
  const sources: AlertRecord[] = [];
  if (!results[0].error) sources.push(...(results[0].data || []).map(incidentToAlert));
  if (!results[1].error) sources.push(...(results[1].data || []).map(notificationToAlert));
  if (!results[2].error) sources.push(...(results[2].data || []).map(maintenanceToAlert));
  if (!results[3].error) sources.push(...(results[3].data || []).map(tripToAlert));
  if (!results[4].error) {
    const vehicleAlerts = (results[4].data || [])
      .map(vehicleToAlert)
      .filter((alert): alert is NonNullable<ReturnType<typeof vehicleToAlert>> => alert !== null);
    sources.push(...vehicleAlerts);
  }
  const valid = sources.filter((source): source is AlertRecord => source !== null);
  if (!valid.length) return [];
  const { error } = await supabase.from("alerts").upsert(valid, { onConflict: "source_type,source_id", ignoreDuplicates: false });
  if (error && !isMissingAlertsTable(error)) throw error;
  if (error) console.warn("Alerts migration is not applied; serving source events until public.alerts exists.");
  return valid;
}

function fallbackAlert(source: AlertRecord): AlertRecord {
  return {
    ...source,
    id: `${source.source_type}:${source.source_id}`,
    status: source.status || "ACTIVE",
    created_at: source.metadata?.reported_at || source.metadata?.updated_at || new Date().toISOString(),
    updated_at: source.metadata?.updated_at || null,
  };
}

export async function listAlerts(
  supabase: SupabaseClient,
  filter: { status?: string | null; category?: string | null; severity?: string | null; userId: string; role: string; limit?: string | null; offset?: string | null },
) {
  const sourceAlerts = await syncSourceAlerts(supabase);
  const limit = Math.min(Number(filter.limit) || 100, 200);
  const offset = Number(filter.offset) || 0;
  let query = supabase.from("alerts").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (filter.status) query = query.eq("status", normalizeStatus(filter.status));
  if (filter.category) query = query.eq("category", String(filter.category).toUpperCase());
  if (filter.severity) query = query.eq("severity", normalizeSeverity(filter.severity));
  if (filter.role === "driver") query = query.eq("driver_id", filter.userId);
  const { data, error } = await query;
  if (error && !isMissingAlertsTable(error)) throw error;
  if (!error) return data || [];
  return sourceAlerts.map(fallbackAlert)
    .filter((alert) => filter.role !== "driver" || alert.driver_id === filter.userId)
    .filter((alert) => !filter.status || alert.status === normalizeStatus(filter.status))
    .filter((alert) => !filter.category || alert.category === String(filter.category).toUpperCase())
    .filter((alert) => !filter.severity || alert.severity === normalizeSeverity(filter.severity))
    .slice(offset, offset + limit);
}

export async function transitionAlert(supabase: SupabaseClient, id: string, status: string, actorId: string) {
  const nextStatus = normalizeStatus(status);
  const { data: current, error: readError } = await supabase.from("alerts").select("*").eq("id", id).maybeSingle();
  if (readError || !current) throw readError || new Error("Alert not found");
  const now = new Date().toISOString();
  const patch: AlertRecord = { status: nextStatus, updated_at: now };
  if (nextStatus === "ACKNOWLEDGED") Object.assign(patch, { acknowledged_at: now, acknowledged_by: actorId });
  if (nextStatus === "RESOLVED" || nextStatus === "DISMISSED") Object.assign(patch, { resolved_at: now, resolved_by: actorId });
  const { data, error } = await supabase.from("alerts").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  const { error: historyError } = await supabase.from("alert_history").insert({
    alert_id: id,
    actor_id: actorId,
    action: nextStatus,
    previous_status: current.status,
    new_status: nextStatus,
    description: `Alert status changed from ${current.status} to ${nextStatus}.`,
  });
  if (historyError) console.warn("Alert history insert failed:", historyError.message);
  return data;
}

export async function listAlertHistory(supabase: SupabaseClient, userId: string, role: string, limitValue?: string | null, offsetValue?: string | null) {
  const limit = Math.min(Number(limitValue) || 100, 200);
  const offset = Number(offsetValue) || 0;
  const { data, error } = await supabase.from("alert_history").select("*, alerts(title,category,severity,source_type,source_id,driver_id)")
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) {
    if (isMissingAlertsTable(error) || /relation .*alert_history|table .*alert_history/i.test(error.message)) return [];
    throw error;
  }
  if (role !== "driver") return data || [];
  return (data || []).filter((entry) => entry.alerts?.driver_id === userId);
}