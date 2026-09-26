/**
 * Shared route-optimization service.
 *
 * Wraps calls to the OR-Tools/OSRM microservice (backend/ortools_service) so
 * that BOTH the manual "preview" endpoint (routes/optimizeRoutes.js) and the
 * automatic optimization triggered on trip dispatch (controllers/tripController.js)
 * go through one code path, persist results the same way, and fall back the
 * same way if the microservice is unreachable.
 *
 * This is what makes optimization "automated, not manual": tripController
 * calls optimizeAndPersist() itself the moment a trip is dispatched — no
 * button click required. The web dashboard's "Optimize" button still works,
 * it just calls the same function on demand for a preview.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { getServiceSupabase } = require('../config/db');

const ORTOOLS_SERVICE_URL = process.env.ORTOOLS_SERVICE_URL || 'http://localhost:8000/optimize';
const OPTIMIZER_API_KEY = process.env.OPTIMIZER_API_KEY || '';
// Automated optimization is on by default. Set USE_ORTOOLS=false to force
// the local nearest-neighbor fallback everywhere (e.g. CI, offline dev).
const USE_ORTOOLS_SERVICE = process.env.USE_ORTOOLS !== 'false';

function haversineMeters(a, b) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const lat1 = toRadians(Number(a.lat) || 0);
  const lon1 = toRadians(Number(a.lng) || 0);
  const lat2 = toRadians(Number(b.lat) || 0);
  const lon2 = toRadians(Number(b.lng) || 0);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const earthRadius = 6371000; // meters
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.asin(Math.sqrt(h));
}

function distance(a, b) {
  return haversineMeters(a, b);
}

function computeNearestNeighbor(depot, stops) {
  const remaining = stops.map((stop) => ({ ...stop }));
  const order = [];
  let current = depot;
  let totalDistance = 0;

  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    remaining.forEach((stop, index) => {
      const d = distance(current, stop);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = index;
      }
    });

    const nextStop = remaining.splice(nearestIndex, 1)[0];
    order.push(nextStop.name || `Stop ${order.length + 1}`);
    totalDistance += nearestDistance;
    current = nextStop;
  }

  return { order, totalDistance };
}

function computeNaiveDistance(depot, stops) {
  let totalDistance = 0;
  let current = depot;
  stops.forEach((stop) => {
    totalDistance += distance(current, stop);
    current = stop;
  });
  return totalDistance;
}

function fetchOsrmRouteMetrics(points) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(points) || points.length < 2) {
      return reject(new Error('At least two points are required to fetch an OSRM route'));
    }

    const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`OSRM route request failed with status ${res.statusCode}`));
        }
        try {
          const data = JSON.parse(body);
          if (!data || data.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) {
            return reject(new Error('OSRM route request returned no routes'));
          }
          const route = data.routes[0];
          resolve({
            distance: route.distance,
            duration: route.duration,
            geometry: route.geometry,
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('OSRM route request timed out')));
    req.end();
  });
}

function postJson(urlString, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (error) {
      return reject(new Error(`Invalid OR-Tools service URL: ${urlString}`));
    }

    const lib = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
      timeout: 8000,
    };

    const req = lib.request(options, (res) => {
      let responseText = '';
      res.on('data', (chunk) => { responseText += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          return reject(new Error(`Invalid JSON from OR-Tools service: ${parseError.message}`));
        }
        if (res.statusCode >= 400) {
          const message = parsed?.detail || parsed?.error || parsed?.message || res.statusMessage || `Status ${res.statusCode}`;
          return reject(new Error(message));
        }
        resolve(parsed);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('OR-Tools service request timed out')));
    req.write(body);
    req.end();
  });
}

/**
 * Calls the OR-Tools/OSRM microservice, falling back to a local
 * nearest-neighbor heuristic if the microservice is disabled or unreachable.
 *
 * @param {{depot: object, stops: object[], numVehicles?: number, vehicleCapacities?: number[], distanceMatrixProvider?: string, routeProvider?: string, includeTraffic?: boolean}} params
 */
async function runOptimizer({ depot, stops, numVehicles = 1, vehicleCapacities = null, distanceMatrixProvider = 'osrm', routeProvider = 'osrm', includeTraffic = false }) {
  if (USE_ORTOOLS_SERVICE) {
    try {
      const payload = {
        depot,
        stops,
        num_vehicles: numVehicles,
        use_road_distance: true,
        time_limit_secs: 5,
        distance_matrix_provider: distanceMatrixProvider,
        route_provider: routeProvider,
        include_traffic: includeTraffic,
      };
      if (vehicleCapacities && vehicleCapacities.length === numVehicles) {
        payload.vehicle_capacities = vehicleCapacities;
      }
      const headers = OPTIMIZER_API_KEY ? { 'X-API-Key': OPTIMIZER_API_KEY } : {};
      const result = await postJson(ORTOOLS_SERVICE_URL, payload, headers);
      return { ...result, used_ortools: true };
    } catch (err) {
      console.warn('[routeOptimizer] OR-Tools/OSRM service unavailable, falling back to nearest-neighbor heuristic:', err.message || err);
    }
  }

  const naiveDistance = computeNaiveDistance(depot, stops);
  const optimized = computeNearestNeighbor(depot, stops);
  const pctShorter = naiveDistance > 0 ? Math.round(((naiveDistance - optimized.totalDistance) / naiveDistance) * 100) : 0;

  let distanceKm = Number((optimized.totalDistance / 1000).toFixed(2));
  let durationMin = Number((distanceKm * 1.5).toFixed(1));
  let routeGeometry = null;

  try {
    const routeResponse = await fetchOsrmRouteMetrics([depot, ...stops.map((stop) => ({ ...stop }))]);
    if (routeResponse) {
      distanceKm = Number((routeResponse.distance / 1000).toFixed(2));
      durationMin = Number((routeResponse.duration / 60).toFixed(1));
      routeGeometry = routeResponse.geometry;
    }
  } catch (err) {
    console.warn('[routeOptimizer] OSRM fallback route request failed:', err.message || err);
  }

  return {
    depot: depot.name || 'Depot',
    order: optimized.order,
    routes: [{ vehicle_id: 0, stops: optimized.order, distance_km: distanceKm }],
    distance_km: distanceKm,
    duration_min: durationMin,
    naive_distance_km: Number((naiveDistance / 1000).toFixed(2)),
    pct_shorter: pctShorter,
    distance_source: 'straight-line-fallback',
    route_provider: routeProvider,
    route_geometry: routeGeometry,
    solver: 'nearest-neighbor heuristic (OSRM route fallback)',
    used_ortools: false,
  };
}

/**
 * Runs the optimizer AND persists the result to `optimized_routes`, linking
 * it back to a trip if a trip_id is supplied. Used both by the manual
 * endpoint and by the automatic trip-dispatch hook.
 */
async function optimizeAndPersist({ depot, stops, tripId = null, numVehicles = 1, vehicleCapacities = null, distanceMatrixProvider = 'osrm', routeProvider = 'osrm', includeTraffic = false }) {
  const result = await runOptimizer({
    depot,
    stops,
    numVehicles,
    vehicleCapacities,
    distanceMatrixProvider,
    routeProvider,
    includeTraffic,
  });

  try {
    const supabase = getServiceSupabase();
    if (supabase) {
      const insertPayload = {
        trip_id: tripId,
        route_geojson: {
          order: result.order,
          routes: result.routes || null,
          stops: (result.stops || []).map((stop) => ({
            name: stop.name || null,
            lat: stop.lat ?? null,
            lng: stop.lng ?? null,
          })),
          distance_source: result.distance_source,
          route_geometry: result.route_geometry || null,
        },
        distance_km: result.distance_km ?? null,
        estimated_duration_min: result.duration_min ?? null,
        generated_by: result.solver || 'OR-Tools',
      };
      const { data: insertData, error: insertError } = await supabase
        .from('optimized_routes')
        .insert(insertPayload)
        .select('*')
        .maybeSingle();

      if (insertError) {
        console.warn('[routeOptimizer] Failed to persist optimized route:', insertError.message || insertError);
      } else if (insertData?.id) {
        result.saved_id = insertData.id;
        if (tripId) {
          const { error: tripUpdateError } = await supabase
            .from('trips')
            .update({ optimized_route_id: insertData.id })
            .eq('id', tripId);
          if (tripUpdateError) {
            console.warn('[routeOptimizer] Failed to link optimized route to trip:', tripUpdateError.message || tripUpdateError);
          }
        }
      }
    }
  } catch (persistErr) {
    console.warn('[routeOptimizer] Exception while persisting optimized route:', persistErr.message || persistErr);
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

module.exports = { runOptimizer, optimizeAndPersist, autoOptimizeForTrip };
