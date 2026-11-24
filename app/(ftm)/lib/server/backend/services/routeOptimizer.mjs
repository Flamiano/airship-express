/** Local Python OR-Tools adapter retained for the legacy trip optimization hooks. */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServiceSupabase } from '../config/db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PYTHON_TIMEOUT_MS = 25000;
const MAX_OUTPUT_BYTES = 2_000_000;

// The supplied source had lost both of these functions inside an unfinished
// comment. Use the recovered legacy solver so its named-stop API stays intact.
function runOptimizer(depot, stops, options = {}) {
  if (!depot || !Array.isArray(stops) || stops.length === 0) {
    return Promise.reject(new Error('At least one stop and a depot are required.'));
  }
  const payload = {
    depot,
    stops,
    num_vehicles: options.numVehicles || 1,
    vehicle_capacities: options.vehicleCapacities,
    use_road_distance: options.useRoadDistance !== false,
    time_limit_secs: options.timeLimitSecs || 3,
  };
  const script = path.resolve(__dirname, '../../python-services/ortools_service/cli.py');
  const python = process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'py' : 'python3');
  const args = process.platform === 'win32' && !process.env.PYTHON_EXECUTABLE ? ['-3', '-B', script] : ['-B', script];
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Python OR-Tools optimization timed out.'));
    }, PYTHON_TIMEOUT_MS);
    child.on('error', error => finish(error));
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(new Error('Python OR-Tools response exceeded the output limit.'));
      }
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-10_000); });
    child.stdin.on('error', error => finish(error));
    child.on('close', code => {
      if (code !== 0) return finish(new Error(`Python OR-Tools exited with code ${code}: ${stderr.trim()}`));
      try {
        const result = JSON.parse(stdout);
        if (!Array.isArray(result.order) || !Array.isArray(result.routes) || !Number.isFinite(result.distance_km)) {
          throw new Error('Python OR-Tools returned an invalid route result.');
        }
        finish(null, { ...result, used_ortools: true });
      } catch (error) { finish(error); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function optimizeAndPersist({ depot, stops, tripId, ...options }) {
  const result = await runOptimizer(depot, stops, options);
  const supabase = getServiceSupabase();
  if (!supabase) return result;
  try {
    const { data, error } = await supabase.from('optimized_routes').insert({
      trip_id: tripId || null,
      route_geojson: { order: result.order, routes: result.routes },
      distance_km: result.distance_km,
      estimated_duration_min: result.duration_min ?? null,
      generated_by: result.solver || 'OR-Tools service',
    }).select('*').maybeSingle();
    if (error) console.warn('[routeOptimizer] Failed to persist route:', error.message);
    else if (data?.id) {
      result.saved_id = data.id;
      if (tripId) {
        const { error: tripError } = await supabase.from('trips').update({ optimized_route_id: data.id }).eq('id', tripId);
        if (tripError) console.warn('[routeOptimizer] Failed to link route:', tripError.message);
      }
    }
  } catch (error) {
    console.warn('[routeOptimizer] Failed to persist route:', error.message);
  }
  return result;
}

/**
 * Automatically optimizes the route for a single trip's pickup -> dropoff
 * (and any other stops already queued for the same vehicle) the instant the
 * trip is dispatched. No dispatcher action required. Safe to call
 * fire-and-forget; failures are logged, never thrown back at the caller.
 */
async function autoOptimizeForTrip(trip) {
  try {
    const supabase = getServiceSupabase();
    if (!supabase || !trip?.vehicle_id) return null;

    // Pull every other active (not yet completed/cancelled) trip assigned to
    // the same vehicle so the optimizer plans the whole run, not just this
    // one stop in isolation.
    const { data: vehicleTrips, error } = await supabase
      .from('trips')
      .select(`id, status, bookings(pickup_location, pickup_latitude, pickup_longitude, dropoff_location, dropoff_latitude, dropoff_longitude, cargo_weight)`)
      .eq('vehicle_id', trip.vehicle_id)
      .not('status', 'in', '("Completed","Cancelled")');

    if (error) {
      console.warn('[routeOptimizer] Could not load vehicle trip queue for auto-optimization:', error.message);
      return null;
    }

    const source = (vehicleTrips && vehicleTrips.length > 0) ? vehicleTrips : [trip];
    const stops = [];
    let depot = null;

    source.forEach((t) => {
      const booking = Array.isArray(t.bookings) ? t.bookings[0] : t.bookings;
      if (!booking) return;
      if (!depot && booking.pickup_latitude != null && booking.pickup_longitude != null) {
        depot = { name: booking.pickup_location || 'Depot', lat: Number(booking.pickup_latitude), lng: Number(booking.pickup_longitude) };
      }
      if (booking.dropoff_latitude != null && booking.dropoff_longitude != null) {
        stops.push({
          name: booking.dropoff_location || `Stop ${stops.length + 1}`,
          lat: Number(booking.dropoff_latitude),
          lng: Number(booking.dropoff_longitude),
          demand: Math.max(0, Math.round(Number(booking.cargo_weight) || 0)),
        });
      }
    });

    if (!depot || stops.length === 0) return null;

    const result = await optimizeAndPersist({ depot, stops, tripId: trip.id, numVehicles: 1 });
    console.log(`[routeOptimizer] Auto-optimized route for trip ${trip.id} (${stops.length} stop(s), ${result.used_ortools ? 'OR-Tools' : 'fallback heuristic'}).`);
    return result;
  } catch (err) {
    console.warn('[routeOptimizer] Automatic optimization failed:', err.message || err);
    return null;
  }
}

export { runOptimizer, optimizeAndPersist, autoOptimizeForTrip };
