const { getServiceSupabase } = require('../config/db');

function bad(details) {
  return { error: true, message: details || 'Unable to retrieve data right now.' };
}

async function fetchTable(query) {
  const { data, error } = await query;
  if (error) {
    console.error('[fleetTools] query error:', error.message || error);
    return { data: null, error };
  }
  return { data: data || [], error: null };
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

async function getAvailableVehicles() {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');

  const { data, error } = await fetchTable(
    supabase
      .from('vehicles')
      .select('id, plate_number, vehicle_type, manufacturer, model, status, availability, location, driver, mileage, next_service')
      .or('availability.ilike.available,status.ilike.available')
      .order('plate_number', { ascending: true })
      .limit(50)
  );
  if (error) return bad('Could not load available vehicles.');
  return { count: data.length, vehicles: data };
}

async function getVehicleStatus({ plate_or_id } = {}) {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');
  if (!plate_or_id) return bad('A plate number or vehicle id is required.');

  const { data, error } = await fetchTable(
    supabase
      .from('vehicles')
      .select('*')
      .or(`plate_number.ilike.%${plate_or_id}%,id.eq.${plate_or_id}`)
      .limit(5)
  );
  if (error) return bad('Could not look up that vehicle.');
  if (data.length === 0) return { found: false, message: `No vehicle matching "${plate_or_id}" was found.` };
  return { found: true, vehicles: data };
}

async function getFleetSummary() {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');

  const [vehiclesRes, tripsRes, driversRes] = await Promise.all([
    fetchTable(supabase.from('vehicles').select('id, status, availability')),
    fetchTable(supabase.from('trips').select('id, status')),
    fetchTable(supabase.from('users').select('id').eq('role', 'driver')),
  ]);
  if (vehiclesRes.error || tripsRes.error) return bad('Could not compute a fleet summary right now.');

  const vehicles = vehiclesRes.data;
  const trips = tripsRes.data;
  const isAvailable = (v) => /available/i.test(v.availability || v.status || '');
  const isMaintenance = (v) => /maintenance|out of service/i.test(v.status || '');
  const isInTransit = (t) => /transit|dispatch|moving|assigned|scheduled/i.test(t.status || '');
  const isCompleted = (t) => /complete/i.test(t.status || '');

  return {
    vehicles: {
      total: vehicles.length,
      available: vehicles.filter(isAvailable).length,
      inMaintenance: vehicles.filter(isMaintenance).length,
      assignedOrInUse: vehicles.length - vehicles.filter(isAvailable).length - vehicles.filter(isMaintenance).length,
    },
    trips: {
      total: trips.length,
      inTransit: trips.filter(isInTransit).length,
      completed: trips.filter(isCompleted).length,
    },
    drivers: {
      total: driversRes.error ? null : driversRes.data.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

async function getActiveTrips({ limit = 20 } = {}, scope) {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');

  let query = supabase
    .from('trips')
    .select('id, status, progress, driver_id, driver_name, vehicle_id, vehicle_plate, estimated_departure, estimated_arrival, delay_reason')
    .not('status', 'ilike', '%completed%')
    .not('status', 'ilike', '%cancelled%')
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limit) || 20, 50));

  if (scope?.role === 'driver' && scope.driverId) {
    query = query.eq('driver_id', scope.driverId);
  }

  const { data, error } = await fetchTable(query);
  if (error) return bad('Could not load active trips.');
  return { count: data.length, trips: data };
}

async function getTripStatus({ trip_id } = {}, scope) {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');
  if (!trip_id) return bad('A trip id is required.');

  let query = supabase.from('trips').select('*').eq('id', trip_id).limit(1);
  if (scope?.role === 'driver' && scope.driverId) query = query.eq('driver_id', scope.driverId);

  const { data, error } = await fetchTable(query);
  if (error) return bad('Could not look up that trip.');
  if (data.length === 0) return { found: false, message: `No trip "${trip_id}" was found for your account.` };
  return { found: true, trip: data[0] };
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

async function getAvailableDrivers() {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');

  const [driversRes, activeAssignmentsRes] = await Promise.all([
    fetchTable(supabase.from('users').select('id, full_name, phone').eq('role', 'driver')),
    fetchTable(supabase.from('driver_assignments').select('driver_id').eq('status', 'active').is('released_at', null)),
  ]);
  if (driversRes.error) return bad('Could not load drivers.');

  const busyIds = new Set((activeAssignmentsRes.data || []).map((a) => a.driver_id));
  const available = driversRes.data.filter((d) => !busyIds.has(d.id));
  return { count: available.length, drivers: available };
}

async function getDriverStatus({ driver_id, driver_name } = {}, scope) {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');

  const targetId = scope?.role === 'driver' ? scope.driverId : driver_id;
  let query = supabase.from('users').select('id, full_name, phone, role').eq('role', 'driver').limit(5);
  if (targetId) query = query.eq('id', targetId);
  else if (driver_name) query = query.ilike('full_name', `%${driver_name}%`);
  else return bad('Provide a driver name or id to look up.');

  const { data: drivers, error } = await fetchTable(query);
  if (error) return bad('Could not look up that driver.');
  if (drivers.length === 0) return { found: false, message: 'No matching driver was found.' };

  const driver = drivers[0];
  const [assignmentRes, performanceRes] = await Promise.all([
    fetchTable(supabase.from('driver_assignments').select('vehicle_id, status, assigned_at').eq('driver_id', driver.id).order('assigned_at', { ascending: false }).limit(1)),
    fetchTable(supabase.from('driver_performance').select('*').eq('driver_id', driver.id).limit(1)),
  ]);

  return {
    found: true,
    driver,
    currentAssignment: assignmentRes.data?.[0] || null,
    performance: performanceRes.data?.[0] || null,
  };
}

// ---------------------------------------------------------------------------
// Dispatch & routes
// ---------------------------------------------------------------------------

async function getActiveDispatches({ limit = 20 } = {}) {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');

  const { data: dispatches, error } = await fetchTable(
    supabase.from('dispatches').select('*').order('dispatched_at', { ascending: false }).limit(Math.min(Number(limit) || 20, 50))
  );
  if (error) return bad('Could not load dispatches.');
  if (dispatches.length === 0) return { count: 0, dispatches: [] };

  const tripIds = [...new Set(dispatches.map((d) => d.trip_id).filter(Boolean))];
  const { data: trips } = await fetchTable(
    supabase.from('trips').select('id, status, driver_name, vehicle_plate').in('id', tripIds)
  );
  const tripMap = new Map((trips || []).map((t) => [t.id, t]));

  return {
    count: dispatches.length,
    dispatches: dispatches.map((d) => ({ ...d, trip: tripMap.get(d.trip_id) || null })),
  };
}

async function getRouteInformation({ route_number, courier } = {}) {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');

  let query = supabase
    .from('route_plans')
    .select('id, route_number, courier, pickup_location, status, distance_km, estimated_duration_min, planned_delivery_date, assigned_vehicle_id, assigned_driver_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (route_number) query = query.ilike('route_number', `%${route_number}%`);
  if (courier) query = query.ilike('courier', `%${courier}%`);

  const { data, error } = await fetchTable(query);
  if (error) return bad('Could not load route plan information.');
  return { count: data.length, routes: data };
}

// ---------------------------------------------------------------------------
// Fuel & maintenance
// ---------------------------------------------------------------------------

async function getFuelSummary({ vehicle_id, days = 30 } = {}) {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');

  const since = new Date(Date.now() - Math.min(Number(days) || 30, 365) * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase.from('fuel_logs').select('vehicle_id, liters, cost, logged_at').gte('logged_at', since).order('logged_at', { ascending: false }).limit(200);
  if (vehicle_id) query = query.eq('vehicle_id', vehicle_id);

  const { data, error } = await fetchTable(query);
  if (error) return bad('Could not load fuel logs.');

  const totalLiters = data.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  const totalCost = data.reduce((sum, r) => sum + Number(r.cost || 0), 0);

  return {
    periodDays: Number(days) || 30,
    entryCount: data.length,
    totalLiters: Math.round(totalLiters * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    recentEntries: data.slice(0, 10),
  };
}

async function getVehicleMaintenance({ vehicle_id } = {}) {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');
  if (!vehicle_id) return bad('A vehicle id is required.');

  const { data, error } = await fetchTable(
    supabase.from('maintenance_history').select('*').eq('vehicle_id', vehicle_id).order('performed_at', { ascending: false }).limit(10)
  );
  if (error) return bad('Could not load maintenance history.');
  return { count: data.length, records: data };
}

// ---------------------------------------------------------------------------
// Mutation: report an operational issue
// ---------------------------------------------------------------------------

async function createIncidentReport({ incident_type, description, vehicle_id, trip_id } = {}, scope) {
  const supabase = getServiceSupabase();
  if (!supabase) return bad('Database is not configured.');
  if (!incident_type || !description) return bad('An incident type and description are required.');

  const payload = {
    incident_type,
    description,
    vehicle_id: vehicle_id || null,
    trip_id: trip_id || null,
    driver_id: scope?.role === 'driver' ? scope.driverId : null,
    reported_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('incident_reports').insert(payload).select('*').single();
  if (error) return bad('Could not file that report.');
  return { created: true, report: data };
}

// ---------------------------------------------------------------------------
// Tool registry consumed by the AI provider (Anthropic tool-use schema)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'get_fleet_summary',
    description: 'Get an overview of the whole fleet: vehicle counts by availability, trip counts by status, and driver headcount.',
    input_schema: { type: 'object', properties: {} },
    handler: (input, scope) => getFleetSummary(),
    roles: ['admin', 'fleet_manager', 'dispatcher'],
  },
  {
    name: 'get_available_vehicles',
    description: 'List vehicles that are currently available (not assigned, not in maintenance).',
    input_schema: { type: 'object', properties: {} },
    handler: () => getAvailableVehicles(),
    roles: ['admin', 'fleet_manager', 'dispatcher'],
  },
  {
    name: 'get_vehicle_status',
    description: 'Look up a specific vehicle by plate number or vehicle id.',
    input_schema: {
      type: 'object',
      properties: { plate_or_id: { type: 'string', description: 'Plate number or vehicle id to search for' } },
      required: ['plate_or_id'],
    },
    handler: (input) => getVehicleStatus(input),
    roles: ['admin', 'fleet_manager', 'dispatcher', 'driver'],
  },
  {
    name: 'get_active_trips',
    description: 'List trips that are currently in progress (not completed or cancelled). Drivers only see their own trips.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', description: 'Max number of trips to return, default 20' } },
    },
    handler: (input, scope) => getActiveTrips(input, scope),
    roles: ['admin', 'fleet_manager', 'dispatcher', 'driver'],
  },
  {
    name: 'get_trip_status',
    description: 'Get full details for one trip by id.',
    input_schema: {
      type: 'object',
      properties: { trip_id: { type: 'string' } },
      required: ['trip_id'],
    },
    handler: (input, scope) => getTripStatus(input, scope),
    roles: ['admin', 'fleet_manager', 'dispatcher', 'driver'],
  },
  {
    name: 'get_available_drivers',
    description: 'List drivers who do not currently have an active vehicle assignment.',
    input_schema: { type: 'object', properties: {} },
    handler: () => getAvailableDrivers(),
    roles: ['admin', 'fleet_manager', 'dispatcher'],
  },
  {
    name: 'get_driver_status',
    description: "Look up a driver's current assignment and performance stats by name or id. Drivers calling this always see only their own record.",
    input_schema: {
      type: 'object',
      properties: {
        driver_id: { type: 'string' },
        driver_name: { type: 'string' },
      },
    },
    handler: (input, scope) => getDriverStatus(input, scope),
    roles: ['admin', 'fleet_manager', 'dispatcher', 'driver'],
  },
  {
    name: 'get_active_dispatches',
    description: 'List recent dispatch records with their linked trip status.',
    input_schema: { type: 'object', properties: { limit: { type: 'integer' } } },
    handler: (input) => getActiveDispatches(input),
    roles: ['admin', 'fleet_manager', 'dispatcher'],
  },
  {
    name: 'get_route_information',
    description: 'Look up route plans by route number or courier name.',
    input_schema: {
      type: 'object',
      properties: { route_number: { type: 'string' }, courier: { type: 'string' } },
    },
    handler: (input) => getRouteInformation(input),
    roles: ['admin', 'fleet_manager', 'dispatcher'],
  },
  {
    name: 'get_fuel_summary',
    description: 'Summarize fuel consumption and cost, optionally for one vehicle, over a recent period.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_id: { type: 'string' },
        days: { type: 'integer', description: 'How many days back to summarize, default 30' },
      },
    },
    handler: (input) => getFuelSummary(input),
    roles: ['admin', 'fleet_manager'],
  },
  {
    name: 'get_vehicle_maintenance',
    description: 'Get recent maintenance history for a vehicle.',
    input_schema: {
      type: 'object',
      properties: { vehicle_id: { type: 'string' } },
      required: ['vehicle_id'],
    },
    handler: (input) => getVehicleMaintenance(input),
    roles: ['admin', 'fleet_manager'],
  },
  {
    name: 'create_incident_report',
    description: 'File an operational issue or incident report against a vehicle or trip. Only use this when the user explicitly asks to report or log an issue and has provided a description.',
    input_schema: {
      type: 'object',
      properties: {
        incident_type: { type: 'string', description: 'Short category, e.g. "Mechanical", "Accident", "Delay", "Safety"' },
        description: { type: 'string' },
        vehicle_id: { type: 'string' },
        trip_id: { type: 'string' },
      },
      required: ['incident_type', 'description'],
    },
    handler: (input, scope) => createIncidentReport(input, scope),
    roles: ['admin', 'fleet_manager', 'dispatcher', 'driver'],
  },
];

function toolsForRole(role) {
  return TOOLS.filter((t) => t.roles.includes(role));
}

async function runTool(name, input, scope) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return bad(`Unknown tool "${name}".`);
  if (!tool.roles.includes(scope.role)) {
    return bad('This account is not permitted to use that fleet function.');
  }
  try {
    return await tool.handler(input || {}, scope);
  } catch (err) {
    console.error(`[fleetTools] ${name} threw:`, err?.message || err);
    return bad('That fleet function failed unexpectedly.');
  }
}

module.exports = { TOOLS, toolsForRole, runTool };
