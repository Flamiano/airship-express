const { getServiceSupabase } = require('../config/db');
const { createClient } = require('@supabase/supabase-js');

function getAlertClient(accessToken) {
  const serviceClient = getServiceSupabase();
  if (process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || !accessToken) return serviceClient;
  const url = process.env.FTM_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.FTM_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { global: { headers: { Authorization: `Bearer ${accessToken}` } } }) : serviceClient;
}

const SEVERITIES = new Set(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const normalizeSeverity = (value, fallback = 'MEDIUM') => {
  const normalized = String(value || '').trim().toUpperCase();
  return SEVERITIES.has(normalized) ? normalized : fallback;
};
const normalizeStatus = (value) => String(value || 'ACTIVE').trim().toUpperCase();

function incidentToAlert(incident) {
  const type = String(incident.incident_type || incident.type || 'OTHER').toUpperCase();
  const severity = /SOS|EMERGENCY|ACCIDENT|THEFT/.test(type) ? 'CRITICAL' : /BREAKDOWN|UNSAFE|SAFETY/.test(type) ? 'HIGH' : /DELAY|ROUTE/.test(type) ? 'MEDIUM' : 'LOW';
  return {
    alert_type: type,
    category: 'SAFETY',
    severity,
    title: incident.title || `${type.replace(/_/g, ' ')} reported`,
    message: incident.description || incident.details || 'Safety incident reported.',
    source_type: 'INCIDENT_REPORT',
    source_id: String(incident.id),
    driver_id: incident.driver_id || null,
    vehicle_id: incident.vehicle_id || null,
    trip_id: incident.trip_id || null,
    booking_id: incident.booking_id || null,
    action_required: severity === 'CRITICAL' || severity === 'HIGH',
    metadata: { reason: incident.description || incident.details || null, photo_url: incident.photo_url || null, reported_at: incident.reported_at || incident.created_at || null },
  };
}

function notificationToAlert(notification) {
  const type = String(notification.notification_type || notification.type || 'NOTIFICATION').toUpperCase();
  const text = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
  const severity = /emergency|sos|critical/.test(text) ? 'CRITICAL' : /overdue|breakdown|failed/.test(text) ? 'HIGH' : /warning|delay|maintenance/.test(text) ? 'MEDIUM' : 'INFO';
  return {
    alert_type: type,
    category: /MAINT|SERVICE/.test(type) || /maintenance|service/.test(text) ? 'MAINTENANCE' : 'OPERATIONS',
    severity,
    title: notification.title || 'Operational notification',
    message: notification.message || 'Notification requires review.',
    source_type: 'NOTIFICATION',
    source_id: String(notification.id),
    driver_id: notification.user_id || null,
    action_required: severity !== 'INFO',
    metadata: { reason: notification.message || notification.title || null, is_read: Boolean(notification.is_read), notification_type: type },
  };
}

function maintenanceToAlert(record) {
  const status = String(record.status || '').toLowerCase();
  const overdue = /overdue|past due|expired/.test(status) || (record.due_date && new Date(record.due_date) < new Date());
  return {
    alert_type: overdue ? 'MAINTENANCE_OVERDUE' : 'MAINTENANCE_DUE',
    category: 'MAINTENANCE',
    severity: overdue ? 'HIGH' : 'MEDIUM',
    title: record.title || record.maintenance_type || 'Maintenance notification',
    message: record.description || record.notes || `Maintenance is ${overdue ? 'overdue' : 'due'}.`,
    source_type: 'MAINTENANCE_HISTORY',
    source_id: String(record.id),
    vehicle_id: record.vehicle_id || null,
    action_required: true,
    metadata: { reason: record.description || record.notes || `Maintenance is ${overdue ? 'overdue' : 'due'}.`, due_date: record.due_date || null, status: record.status || null, mileage: record.mileage || null },
  };
}

function tripToAlert(trip) {
  const status = String(trip.status || 'UNKNOWN').trim().toUpperCase();
  const needsAction = /DELAY|LATE|CANCEL|REJECT|UNAVAILABLE|FAILED/.test(status);
  return {
    alert_type: `TRIP_${status}`,
    category: 'OPERATIONS',
    severity: needsAction ? (/CANCEL|FAILED|UNAVAILABLE/.test(status) ? 'HIGH' : 'MEDIUM') : 'INFO',
    status: status === 'COMPLETED' ? 'RESOLVED' : 'ACTIVE',
    title: `Trip ${status.replace(/_/g, ' ').toLowerCase()}`,
    message: `Trip ${trip.id} is ${String(trip.status || 'unknown').toLowerCase()}.`,
    source_type: 'TRIP_STATUS',
    source_id: `${trip.id}:${status}`,
    driver_id: trip.driver_id || null,
    vehicle_id: trip.vehicle_id || null,
    trip_id: trip.id || null,
    booking_id: trip.booking_id || null,
    action_required: needsAction,
    action_url: '/vrds/bookings',
    metadata: { reason: `Trip status changed to ${String(trip.status || 'unknown').toLowerCase()}.`, status, progress: trip.progress ?? null, updated_at: trip.updated_at || null },
  };
}

function vehicleToAlert(vehicle) {
  const status = String(vehicle.status || vehicle.availability || '').trim().toUpperCase();
  if (!/MAINTENANCE|UNAVAILABLE|OUT_OF_SERVICE|BREAKDOWN|OFFLINE/.test(status)) return null;
  return {
    alert_type: `VEHICLE_${status}`,
    category: 'FLEET',
    severity: /BREAKDOWN|OUT_OF_SERVICE|UNAVAILABLE/.test(status) ? 'HIGH' : 'MEDIUM',
    title: `Vehicle ${status.replace(/_/g, ' ').toLowerCase()}`,
    message: `Vehicle ${vehicle.plate_number || vehicle.id} is ${String(vehicle.status || vehicle.availability).toLowerCase()}.`,
    source_type: 'VEHICLE_STATUS',
    source_id: `${vehicle.id}:${status}`,
    vehicle_id: vehicle.id || null,
    action_required: true,
    action_url: '/fvm',
    metadata: { reason: `Vehicle status is ${String(vehicle.status || vehicle.availability).toLowerCase()}.`, status, plate_number: vehicle.plate_number || null },
  };
}

async function syncSourceAlerts(accessToken) {
  const supabase = getAlertClient(accessToken);
  if (!supabase) throw new Error('Database is not configured');
  const sources = [];
  const [incidents, notifications, maintenance, trips, vehicles] = await Promise.all([
    supabase.from('incident_reports').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('maintenance_history').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('trips').select('id, booking_id, vehicle_id, driver_id, status, progress, updated_at').order('updated_at', { ascending: false }).limit(200),
    supabase.from('vehicles').select('id, plate_number, status, availability, updated_at').order('updated_at', { ascending: false }).limit(200),
  ]);
  if (!incidents.error) sources.push(...(incidents.data || []).map(incidentToAlert));
  if (!notifications.error) sources.push(...(notifications.data || []).map(notificationToAlert));
  if (!maintenance.error) sources.push(...(maintenance.data || []).map(maintenanceToAlert));
  if (!trips.error) sources.push(...(trips.data || []).map(tripToAlert));
  if (!vehicles.error) sources.push(...(vehicles.data || []).map(vehicleToAlert).filter(Boolean));
  const validSources = sources.filter(Boolean);
  if (!validSources.length) return;
  if (!process.env.FTM_SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('FTM service-role key is not configured; serving authenticated source events without persisting generated alerts.');
    return validSources;
  }
  const { error } = await supabase.from('alerts').upsert(validSources, { onConflict: 'source_type,source_id', ignoreDuplicates: false });
  if (error) {
    if (!/schema cache|relation .*alerts|table .*alerts/i.test(error.message || '')) throw error;
    console.warn('Alerts migration is not applied; serving source events until public.alerts exists.');
  }
  return validSources;
}

function fallbackAlert(source) {
  return {
    ...source,
    id: `${source.source_type}:${source.source_id}`,
    status: source.status || 'ACTIVE',
    created_at: source.metadata?.reported_at || source.metadata?.updated_at || new Date().toISOString(),
    updated_at: source.metadata?.updated_at || null,
  };
}

async function listAlerts({ status, category, severity, userId, role, accessToken, limit = 100, offset = 0 }) {
  const supabase = getAlertClient(accessToken);
  if (!supabase) throw new Error('Database is not configured');
  const sourceAlerts = (await syncSourceAlerts(accessToken)) || [];
  let query = supabase.from('alerts').select('*').order('created_at', { ascending: false }).range(offset, offset + Math.min(Number(limit) || 100, 200) - 1);
  if (status) query = query.eq('status', normalizeStatus(status));
  if (category) query = query.eq('category', String(category).toUpperCase());
  if (severity) query = query.eq('severity', normalizeSeverity(severity));
  if (role === 'driver') query = query.eq('driver_id', userId);
  const { data, error } = await query;
  if (error) {
    if (!/schema cache|relation .*alerts|table .*alerts/i.test(error.message || '')) throw error;
    return sourceAlerts
      .map(fallbackAlert)
      .filter((alert) => !status || alert.status === normalizeStatus(status))
      .filter((alert) => !category || alert.category === String(category).toUpperCase())
      .filter((alert) => !severity || alert.severity === normalizeSeverity(severity))
      .slice(Number(offset) || 0, (Number(offset) || 0) + Math.min(Number(limit) || 100, 200));
  }
  return data || [];
}

async function transitionAlert(id, status, actorId, accessToken) {
  const supabase = getAlertClient(accessToken);
  if (!supabase) throw new Error('Database is not configured');
  const nextStatus = normalizeStatus(status);
  const { data: current, error: readError } = await supabase.from('alerts').select('*').eq('id', id).maybeSingle();
  if (readError || !current) throw readError || new Error('Alert not found');
  const now = new Date().toISOString();
  const patch = { status: nextStatus, updated_at: now };
  if (nextStatus === 'ACKNOWLEDGED') Object.assign(patch, { acknowledged_at: now, acknowledged_by: actorId });
  if (nextStatus === 'RESOLVED' || nextStatus === 'DISMISSED') Object.assign(patch, { resolved_at: now, resolved_by: actorId });
  const { data, error } = await supabase.from('alerts').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  const { error: historyError } = await supabase.from('alert_history').insert({ alert_id: id, actor_id: actorId, action: nextStatus, previous_status: current.status, new_status: nextStatus, description: `Alert status changed from ${current.status} to ${nextStatus}.` });
  if (historyError) console.warn('Alert history insert failed:', historyError.message);
  return data;
}

async function listHistory({ userId, role, accessToken, limit = 100, offset = 0 }) {
  const supabase = getAlertClient(accessToken);
  if (!supabase) throw new Error('Database is not configured');
  const { data, error } = await supabase.from('alert_history').select('*, alerts(title,category,severity,source_type,source_id)').order('created_at', { ascending: false }).range(offset, offset + Math.min(Number(limit) || 100, 200) - 1);
  if (error) {
    if (/schema cache|relation .*alert_history|table .*alert_history/i.test(error.message || '')) {
      console.warn('Alert history migration is not applied; returning an empty history until migration is available.');
      return [];
    }
    throw error;
  }
  if (role !== 'driver') return data || [];
  return (data || []).filter((entry) => entry.alerts?.driver_id === userId);
}

module.exports = { listAlerts, transitionAlert, listHistory, syncSourceAlerts };
