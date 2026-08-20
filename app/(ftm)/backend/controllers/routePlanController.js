const { getServiceSupabase } = require('../config/db');
const { normalizeRoutePlan, buildRoutePlanPayload } = require('../models/RoutePlan');
const { runOptimizer } = require('../services/routeOptimizer');
const crypto = require('crypto');


const LEGACY_ROUTE_PLAN_COLUMNS = [
  'id',
  'trip_id',
  'courier',
  'pickup_location',
  'pickup_latitude',
  'pickup_longitude',
  'delivery_destinations',
  'status',
  'created_at',
  'updated_at',
];

const WORKFLOW_ROUTE_PLAN_COLUMNS = [
  'route_geojson',
  'distance_km',
  'estimated_duration_min',
  'planned_delivery_date',
  'generated_by',
  'created_by',
];

const ROUTE_PLAN_COLUMNS = [...new Set([...LEGACY_ROUTE_PLAN_COLUMNS, ...WORKFLOW_ROUTE_PLAN_COLUMNS])];

function getCompatibleRoutePlanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([key]) => ROUTE_PLAN_COLUMNS.includes(key))
  );
}

function getLegacyRoutePlanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([key]) => LEGACY_ROUTE_PLAN_COLUMNS.includes(key))
  );
}

async function insertRoutePlanWithFallback(supabase, payload) {
  const candidates = [
    { name: 'workflow', payload },
    { name: 'legacy', payload: getLegacyRoutePlanPayload(payload) },
  ];

  let lastError = null;

  for (const candidate of candidates) {
    const { data, error } = await supabase.from('route_plans').insert(candidate.payload).select('*').single();
    if (!error) return { data, error: null };

    lastError = error;
    const isSchemaMismatch =
      isRoutePlansTableMissing(error) ||
      isSupabaseSchemaCacheError(error) ||
      /Could not find the '.*column.*' of 'route_plans'/i.test(error.message || '') ||
      /column .* of 'route_plans'/i.test(error.message || '');

    if (candidate.name === 'workflow' && isSchemaMismatch) {
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: lastError };
}

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'Database is not configured' });
}

// GET /api/route-plans?courier=FastEx
// Powers VRDS > Booking's "select an existing Route Plan that belongs to the
// selected courier" step (Step 3) — the dispatcher never has to remember or
// re-enter route details, they just pick from this filtered list.
function isRoutePlansTableMissing(error) {
  return error && typeof error.message === 'string' && error.message.includes("Could not find the table 'public.route_plans'");
}

function isSupabaseSchemaCacheError(error) {
  return (
    error &&
    ((error.code && error.code === 'PGRST002') ||
      (typeof error.message === 'string' && /Could not query the database for the schema cache/i.test(error.message)))
  );
}

function isRLSPermissionError(error) {
  const message = (error?.message || '').toLowerCase();
  return (
    error &&
    (message.includes('permission denied') ||
      message.includes('permission denied for table') ||
      message.includes('rls') ||
      error.code === 'PGRST301')
  );
}

// The table may be on either the older status set or the newer workflow set.
// Accept both so the app can migrate without breaking reads in the interim.
const OPEN_ROUTE_PLAN_STATUSES = ['draft', 'assigned', 'in_progress', 'active', 'archived'];

async function getRoutePlans(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  let query = supabase.from('route_plans').select('*').order('created_at', { ascending: false });
  if (req.query.courier) query = query.eq('courier', req.query.courier);

  const { data, error } = await query;
  if (error) {
    if (isRoutePlansTableMissing(error) || isSupabaseSchemaCacheError(error)) {
      console.warn('Route plans table unavailable or schema cache error; returning empty route plans list.');
      return res.json([]);
    }
    return res.status(500).json({ error: `Unable to load route plans: ${error.message}` });
  }

  const rows = Array.isArray(data) ? data : [];
  const filteredRows = OPEN_ROUTE_PLAN_STATUSES.length > 0
    ? rows.filter((row) => !row?.status || OPEN_ROUTE_PLAN_STATUSES.includes(String(row.status).trim().toLowerCase()))
    : rows;

  return res.json(filteredRows.map(normalizeRoutePlan));
}

// GET /api/route-plans/:id — fetch one route plan (used by Bookings to pull
// the full optimized stop sequence for a booking's parcels before dispatch).
async function getRoutePlanById(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  const { data, error } = await supabase.from('route_plans').select('*').eq('id', req.params.id).maybeSingle();
  if (error) {
    if (isRoutePlansTableMissing(error) || isSupabaseSchemaCacheError(error)) {
      return res.status(404).json({ error: 'Route plan not found' });
    }
    return res.status(500).json({ error: `Unable to load route plan: ${error.message}` });
  }
  if (!data) return res.status(404).json({ error: 'Route plan not found' });
  return res.json(normalizeRoutePlan(data));
}

// POST /api/route-plans
// Step 2: dispatcher supplies courier + pickup + one or more delivery
// destinations; OR-Tools computes the optimized order/distance/ETA, and the
// result is saved as a reusable Route Plan (not tied to any single trip yet).
async function createRoutePlan(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  const body = req.body || {};
  if (!body.courier || !body.pickup_location || !Array.isArray(body.delivery_destinations) || body.delivery_destinations.length === 0) {
    return res.status(400).json({ error: 'courier, pickup_location, and at least one delivery destination are required' });
  }

  const depot = {
    name: body.pickup_location,
    lat: Number(body.pickup_latitude),
    lng: Number(body.pickup_longitude),
  };
  const stops = body.delivery_destinations
    .map((stop) => ({
      // Keep any extra metadata the caller attached to a stop (e.g. the
      // warehouse's city, its aggregate demand in kg, and which parcel_ids
      // it represents) so it survives the optimizer round trip and is
      // still there when Bookings reads the saved route plan back.
      ...stop,
      name: stop.name || stop.address || stop.delivery_address,
      lat: Number(stop.lat ?? stop.latitude),
      lng: Number(stop.lng ?? stop.longitude),
    }))
    .filter((stop) => stop.name && Number.isFinite(stop.lat) && Number.isFinite(stop.lng));

  if (!Number.isFinite(depot.lat) || !Number.isFinite(depot.lng)) {
    return res.status(400).json({ error: 'pickup_latitude/pickup_longitude are required' });
  }
  if (stops.length === 0) {
    return res.status(400).json({ error: 'delivery_destinations must include valid lat/lng for each stop' });
  }

  let optimized;
  try {
    optimized = await runOptimizer({ depot, stops, numVehicles: 1 });
  } catch (err) {
    console.error('Route plan optimization failed:', err?.message || err);
    return res.status(502).json({ error: 'Route optimization service failed' });
  }

  // Persist stops in the OR-Tools optimized visiting order (not input order)
  // so anything reading delivery_destinations back later — Bookings, trip
  // creation, Active Deliveries — gets the efficient sequence directly.
  const stopsByName = new Map(stops.map((stop) => [stop.name, stop]));
  const orderedStops = Array.isArray(optimized.order) && optimized.order.length > 0
    ? optimized.order.map((name) => stopsByName.get(name)).filter(Boolean)
    : stops;
  // Include any stop the optimizer didn't echo back by name (defensive).
  orderedStops.forEach((stop) => stopsByName.delete(stop.name));
  const finalStops = [...orderedStops, ...Array.from(stopsByName.values())];

  const payloadRaw = buildRoutePlanPayload({
    ...body,
    route_geojson: {
      order: optimized.order,
      routes: optimized.routes || null,
      route_geometry: optimized.route_geometry || null,
    },
    distance_km: optimized.distance_km,
    estimated_duration_min: optimized.duration_min,
    generated_by: optimized.solver || 'OR-Tools',
    delivery_destinations: finalStops,
    // A route plan created here is about to be attached to a specific
    // courier's bulk booking, so it starts life as "assigned" rather than
    // the generic "draft" default.
    status: body.status || 'assigned',
    created_by: body.created_by || null,
  });

  const payload = Object.fromEntries(
    Object.entries(payloadRaw)
      .filter(([, v]) => v != null)
      .filter(([key]) => ROUTE_PLAN_COLUMNS.includes(key))
  );

  // The app is now compatible with the richer workflow schema, but the live
  // Supabase tenant may still be on the older table. Keep the payload broad so
  // the same code works once the migration is applied and still tolerates the
  // older database during rollout.
  const compatiblePayload = getCompatibleRoutePlanPayload(payload);
  if (!compatiblePayload.id) compatiblePayload.id = crypto.randomUUID();

  const { data, error } = await insertRoutePlanWithFallback(supabase, compatiblePayload);
  if (error) {
    // Check for RLS permission errors
    if (isRLSPermissionError(error)) {
      console.error('Route plan insert blocked by RLS policies:', error.message || error);
      return res.status(403).json({
        error: 'Unable to save route plan: permission denied for table route_plans',
        details: 'Supabase RLS policies are not configured for service-role access. Run the SQL migration to fix this.',
        migration: 'backend/migrations/20260814_fix_rls_policies.sql',
        hint: 'Execute this in Supabase SQL Editor: ALTER TABLE public.route_plans DISABLE ROW LEVEL SECURITY;'
      });
    }

    const schemaMismatch =
      isRoutePlansTableMissing(error) ||
      isSupabaseSchemaCacheError(error) ||
      /Could not find the '.*column.*' of 'route_plans'/i.test(error.message || '') ||
      /column .* of 'route_plans'/i.test(error.message || '');

    if (schemaMismatch) {
      console.error('Route plan insert failed because the Supabase route_plans schema is not migrated:', error.message || error);
      return res.status(500).json({
        error: 'route_plans table is not migrated to the workflow schema.',
        details: error.message || 'Unknown schema mismatch',
        migration: 'backend/migrations/20260814_route_plans_workflow_migration.sql',
      });
    }

    return res.status(500).json({ error: `Unable to save route plan: ${error.message}` });
  }
  return res.status(201).json(normalizeRoutePlan(data));
}

module.exports = { getRoutePlans, getRoutePlanById, createRoutePlan };
