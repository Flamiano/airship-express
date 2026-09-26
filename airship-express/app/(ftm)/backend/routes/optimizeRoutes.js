const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const router = express.Router();
const { getSupabase } = require('../config/db');

const ORTOOLS_SERVICE_URL = process.env.ORTOOLS_SERVICE_URL || 'http://localhost:8000/optimize';
const USE_ORTOOLS_SERVICE = process.env.USE_ORTOOLS === 'true' || Boolean(process.env.ORTOOLS_SERVICE_URL);

function distance(a, b) {
  const dx = (a.lat || 0) - (b.lat || 0);
  const dy = (a.lng || 0) - (b.lng || 0);
  return Math.hypot(dx, dy);
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

function postJson(urlString, payload) {
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
      },
      timeout: 5000,
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
          const message = parsed?.error || parsed?.message || res.statusMessage || `Status ${res.statusCode}`;
          return reject(new Error(message));
        }

        resolve(parsed);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('OR-Tools service request timed out'));
    });
    req.write(body);
    req.end();
  });
}

router.post('/', async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.depot || !Array.isArray(payload.stops)) {
    return res.status(400).json({ error: 'Invalid optimization payload' });
  }

  const depot = payload.depot;
  const stops = payload.stops.filter((stop) => stop && stop.name && stop.lat != null && stop.lng != null);
  if (stops.length === 0) {
    return res.status(400).json({ error: 'At least one stop with coordinates is required' });
  }

  if (USE_ORTOOLS_SERVICE) {
    try {
      const ortoolsPayload = { depot, stops, nl: payload.nl };
      const result = await postJson(ORTOOLS_SERVICE_URL, ortoolsPayload);
      // Best-effort persist of optimization result
      try {
        const supabase = getSupabase();
        if (supabase) {
          const insertPayload = {
            trip_id: payload.trip_id || null,
            route_geojson: { order: result.order, routes: result.routes || null },
            distance_km: result.distance_km ?? result.distanceKm ?? null,
            estimated_duration_min: result.duration_min ?? null,
            generated_by: result.solver || 'OR-Tools service',
          };
          const { data: insertData, error: insertError } = await supabase.from('optimized_routes').insert(insertPayload).select('*').maybeSingle();
          if (insertError) {
            console.warn('Failed to persist optimized route:', insertError?.message || insertError);
          } else if (insertData && insertData.id) {
            // Attach the saved id to the response so callers can reference it
            result.saved_id = insertData.id;
            // If a trip_id was supplied, update the trips row to reference this optimized route
            try {
              if (payload.trip_id) {
                const { error: tripUpdateError } = await supabase.from('trips').update({ optimized_route_id: insertData.id }).eq('id', payload.trip_id);
                if (tripUpdateError) {
                  console.warn('Failed to update trip with optimized_route_id:', tripUpdateError?.message || tripUpdateError);
                }
              }
            } catch (tripUpdateEx) {
              console.warn('Exception while updating trip optimized_route_id:', tripUpdateEx?.message || tripUpdateEx);
            }
          }
        }
      } catch (persistErr) {
        console.warn('Failed to persist optimized route:', persistErr?.message || persistErr);
      }
      return res.json(result);
    } catch (err) {
      console.error('OR-Tools service unavailable, falling back to local heuristic:', err.message || err);
    }
  }

  const naiveDistance = computeNaiveDistance(depot, stops);
  const optimized = computeNearestNeighbor(depot, stops);
  const pctShorter = naiveDistance > 0 ? Math.round(((naiveDistance - optimized.totalDistance) / naiveDistance) * 100) : 0;

  return res.json({
    depot: depot.name || 'Depot',
    order: optimized.order,
    distance_km: Number(optimized.totalDistance.toFixed(2)),
    naive_distance_km: Number(naiveDistance.toFixed(2)),
    pct_shorter: pctShorter,
    solver: 'nearest-neighbor heuristic (fallback)',
  });
});

module.exports = router;
