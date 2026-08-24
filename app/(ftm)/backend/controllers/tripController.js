const { getSupabase, getServiceSupabase, getParcelsSupabase } = require('../config/db');
const { broadcastAssignment } = require('../events/sse');
const { normalizeTrip, buildTripPayload } = require('../models/Trip');

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'Database is not configured' });
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

async function markBookingDispatched(supabase, bookingId) {
  if (!supabase || !bookingId) return;
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'Dispatched' })
    .eq('id', bookingId);
  if (error) console.error('Failed to persist dispatched booking status:', error.message || error);
}

async function getBookingParcelIds(supabase, bookingId) {
  if (!supabase || !bookingId) return [];
  const { data, error } = await supabase
    .from('bookings')
    .select('cargo_description')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data) return [];
  const payload = String(data.cargo_description || '');
  const match = /parcel_ids=([^;\s]+)/i.exec(payload);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

async function updateRemoteParcelStatus(bookingId, status) {
  if (!bookingId || !status) return;
  const parcelsSupabase = getParcelsSupabase();
  if (!parcelsSupabase) {
    console.warn('Unable to update remote parcels: parcels supabase client unavailable.');
    return;
  }

  const bookingSupabase = getServiceSupabase();
  const parcelIds = bookingSupabase ? await getBookingParcelIds(bookingSupabase, bookingId) : [];
  const updatePayload = { status };

  try {
    if (parcelIds.length > 0) {
      const { error } = await parcelsSupabase.from('parcels').update(updatePayload).in('id', parcelIds);
      if (!error) return;
      const msg = String(error.message || error || '');
      if (!/Could not find the table|public\.parcels|column .* does not exist/i.test(msg)) {
        console.error('Failed to update remote parcels by id:', error);
        return;
      }
      console.warn('Falling back to booking-based parcel update after id-based failure:', msg);
    }

    const { error: fallbackError } = await parcelsSupabase.from('parcels').update(updatePayload).eq('booking_id', bookingId);
    if (fallbackError) {
      const msg = String(fallbackError.message || fallbackError || '');
      if (!/Could not find the table|public\.parcels|column .* does not exist/i.test(msg)) {
        console.error('Failed to update remote parcels by booking_id:', fallbackError);
      }
    }
  } catch (err) {
    console.error('Error updating remote parcel statuses:', err);
  }
}

function isPermissionError(error) {
  const message = (error?.message || error || '').toString().toLowerCase();
  return message.includes('permission denied') || message.includes('not authorized') || message.includes('rls') || message.includes('jwt');
}

function isInTransitStatus(status) {
  return /in transit|in_transit|transit|assigned|scheduled|dispatch|moving|en route|active|delayed|late/i.test(String(status || ''));
}

function normalizeStopPoint(stop) {
  if (!stop) return null;

  const lat = Number(stop.lat ?? stop.latitude ?? stop.location_lat ?? 0);
  const lng = Number(stop.lng ?? stop.longitude ?? stop.location_lng ?? 0);
  const name = stop.name || stop.label || stop.address || stop.delivery_address || 'Stop';

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null;
  }

  return {
    name,
    lat,
    lng,
    status: stop.status || 'pending',
  };
}

function resolveTripStops(trip, routePlan) {
  const directStops = Array.isArray(trip?.trip_stops) ? trip.trip_stops : [];
  if (directStops.length > 0) {
    return [...directStops]
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map(normalizeStopPoint)
      .filter(Boolean);
  }

  const routeDestinations = Array.isArray(routePlan?.delivery_destinations)
    ? routePlan.delivery_destinations
    : Array.isArray(routePlan?.deliveryDestinations)
      ? routePlan.deliveryDestinations
      : [];

  if (routeDestinations.length > 0) {
    return routeDestinations.map(normalizeStopPoint).filter(Boolean);
  }

  const fallbackRoute = routePlan?.route_geojson || routePlan?.routeGeojson || null;
  if (fallbackRoute && Array.isArray(fallbackRoute.order) && fallbackRoute.order.length > 0) {
    const stopMap = new Map();
    routeDestinations.forEach((stop) => {
      const normalized = normalizeStopPoint(stop);
      if (normalized) stopMap.set(normalized.name, normalized);
    });
    return fallbackRoute.order
      .map((name) => stopMap.get(name))
      .filter(Boolean);
  }

  return [];
}

async function getTrips(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  try {
    const isLightRequest = req.query.light === 'true';
    const buildTripQuery = (includeStops = true) => {
      const baseSelect = `
        id, booking_id, vehicle_id, driver_id, status, progress,
        estimated_departure, estimated_arrival, actual_departure, actual_arrival,
        delay_reason, created_at, updated_at, route_plan_id,
        bookings(pickup_location, pickup_latitude, pickup_longitude, dropoff_location, dropoff_latitude, dropoff_longitude, cargo_weight)
        ${includeStops ? ', trip_stops(sequence, name, latitude, longitude, status)' : ''}
      `;
      const query = supabase.from('trips').select(baseSelect).order('created_at', { ascending: false }).limit(isLightRequest ? 100 : 200);
      if (req.query.status) query.eq('status', req.query.status);
      if (req.query.driver_id) query.eq('driver_id', req.query.driver_id);
      return query;
    };

    let tripData = [];
    let tripError = null;
    let routePlans = [];
    let routePlanBookings = [];
    const routePlansPromise = isLightRequest
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('route_plans').select('*').order('created_at', { ascending: false }).limit(200);
    const routePlanBookingsPromise = isLightRequest
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('route_plan_bookings').select('*').limit(200);

    try {
      const firstQuery = buildTripQuery(true);
      const { data, error } = await firstQuery;
      if (error) {
        tripError = error;
        const msg = String(error.message || error || '');
        if (/trip_stops|Could not find a relationship|schema cache/i.test(msg)) {
          console.warn('trip_stops relation unavailable; retrying trips query without it:', msg);
          const fallback = await buildTripQuery(false);
          const fallbackResult = await fallback;
          tripData = fallbackResult.data || [];
          tripError = fallbackResult.error;
        } else {
          tripData = [];
        }
      } else {
        tripData = data || [];
      }
    } catch (err) {
      tripError = err;
    }

    const [routePlansResult, routePlanBookingsResult] = await Promise.all([
      routePlansPromise,
      routePlanBookingsPromise,
    ]);
    if (routePlansResult.error) {
      const msg = String(routePlansResult.error.message || routePlansResult.error || '');
      if (!/Could not find the table|schema cache|relationship/i.test(msg)) {
        console.warn('route_plans read warning:', msg);
      }
    } else {
      routePlans = Array.isArray(routePlansResult.data) ? routePlansResult.data : [];
    }

    if (routePlanBookingsResult.error) {
      const msg = String(routePlanBookingsResult.error.message || routePlanBookingsResult.error || '');
      if (!/Could not find the table|schema cache|relationship/i.test(msg)) {
        console.warn('route_plan_bookings read warning:', msg);
      }
    } else {
      routePlanBookings = Array.isArray(routePlanBookingsResult.data) ? routePlanBookingsResult.data : [];
    }

    if (tripError) {
      console.error('Supabase trips query error:', tripError.message || tripError);

      if (isPermissionError(tripError)) {
        return res.status(403).json({
          error: 'RLS policies not configured',
          details: 'Enable service role access in Supabase. See ENABLE_REAL_DATA.md for setup instructions.',
          hint: 'Run the SQL migration at: backend/migrations/20260715_enable_service_role_trips_bookings.sql'
        });
      }

      return res.status(500).json({
        error: 'Unable to load trips',
        details: tripError.message || 'Database query failed',
      });
    }

    const routePlanMap = new Map((Array.isArray(routePlans) ? routePlans : []).map((row) => [row.id, row]));
    const routePlanBookingsByRoutePlan = new Map();
    (Array.isArray(routePlanBookings) ? routePlanBookings : []).forEach((row) => {
      const key = row.route_plan_id || row.routePlanId;
      if (!key) return;
      const list = routePlanBookingsByRoutePlan.get(key) || [];
      list.push(row);
      routePlanBookingsByRoutePlan.set(key, list);
    });

    const tripsWithCoords = (tripData || []).map((trip) => {
      const booking = Array.isArray(trip.bookings) ? trip.bookings[0] : trip.bookings;
      const routePlan = trip.route_plan_id ? routePlanMap.get(trip.route_plan_id) : null;
      const stops = resolveTripStops(trip, routePlan);

      return normalizeTrip({
        ...trip,
        from_location: trip.from_location || routePlan?.pickup_location || booking?.pickup_location,
        to_location: trip.to_location || booking?.dropoff_location,
        from_latitude: trip.from_latitude ?? routePlan?.pickup_latitude ?? booking?.pickup_latitude,
        from_longitude: trip.from_longitude ?? routePlan?.pickup_longitude ?? booking?.pickup_longitude,
        to_latitude: trip.to_latitude ?? booking?.dropoff_latitude,
        to_longitude: trip.to_longitude ?? booking?.dropoff_longitude,
        load_kg: trip.load_kg ?? booking?.cargo_weight,
        stops,
        routePlanStops: stops,
      });
    });

    return res.json(tripsWithCoords);
  } catch (err) {
    console.error('getTrips exception:', err.message);
    return res.status(500).json({
      error: 'Server error',
      details: err.message,
    });
  }
}

// Persists the ordered multi-stop sequence (e.g. the OR-Tools-optimized
// courier warehouses a bulk route visits) into trip_stops, linked to the
// trip. Best-effort: a failure here never blocks trip creation/dispatch,
// it just means Active Deliveries falls back to showing origin->final stop
// only instead of the full waypoint list.
async function persistTripStops(supabase, tripId, stops) {
  if (!supabase || !tripId || !Array.isArray(stops) || stops.length === 0) return;
  const rows = stops
    .map((stop, index) => ({
      trip_id: tripId,
      sequence: index + 1,
      name: stop.name || stop.label || `Stop ${index + 1}`,
      latitude: Number(stop.lat ?? stop.latitude),
      longitude: Number(stop.lng ?? stop.longitude),
      status: 'pending',
    }))
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
  if (rows.length === 0) return;

  const { error } = await supabase.from('trip_stops').insert(rows);
  if (error) console.warn('Failed to persist trip_stops for trip', tripId, ':', error.message || error);
}

async function createTrip(req, res) {
  const trip = req.body;
  const stops = Array.isArray(trip?.stops) ? trip.stops : [];
  const payload = buildTripPayload(trip);

  if (!payload.id || !payload.vehicle_id || !payload.from_location || !payload.to_location) {
    return res.status(400).json({ error: 'id, vehicle_id, from_location, and to_location are required' });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  let { data, error } = await supabase.from('trips').insert(payload).select('*').single();

  if (error && (error.code === 'PGRST204' || /column|schema cache/i.test(error.message || ''))) {
    const legacyPayload = {
      id: payload.id,
      booking_id: payload.booking_id,
      vehicle_id: payload.vehicle_id,
      driver_id: payload.driver_id,
      status: payload.status,
      progress: payload.progress,
      estimated_departure: payload.scheduled_at,
    };
    ({ data, error } = await supabase.from('trips').insert(legacyPayload).select('*').single());
  }

  if (error?.code === '23503' && /trips_driver_id_fkey/i.test(error.message || '')) {
    return res.status(409).json({ error: 'The selected driver has no dispatch profile yet. Apply the driver-profile backfill migration, then assign again.' });
  }

  if (error?.code === '23505') {
    const { data: existingTrip, error: existingTripError } = await supabase
      .from('trips')
      .select('*')
      .eq('booking_id', payload.booking_id)
      .maybeSingle();
    if (!existingTripError && existingTrip) {
      return res.status(200).json(normalizeTrip(existingTrip));
    }
  }

  if (isRLSPermissionError(error)) {
    console.error('Trip insert blocked by RLS policies:', error.message || error);
    return res.status(403).json({
      error: 'Unable to create trip: permission denied for table trips',
      details: 'Supabase RLS policies are not configured for service-role access.',
      migration: 'backend/migrations/20260814_fix_rls_policies.sql',
      hint: 'Execute this in Supabase SQL Editor: ALTER TABLE public.trips DISABLE ROW LEVEL SECURITY;'
    });
  }

  if (error) {
    console.error('Create trip error:', error.message);
    return res.status(500).json({ error: `Unable to create trip: ${error.message}` });
  }
  // broadcast to connected driver clients if a driver is assigned
  try {
    if (data?.driver_id) broadcastAssignment({ type: 'assignment', trip: data });
  } catch (err) {
    console.error('Failed to broadcast assignment:', err?.message || err);
  }
  // Update the booking with driver and vehicle assignment
  try {
    const bookingId = data?.booking_id;
    if (bookingId) {
      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update({
          driver_id: data?.driver_id || null,
          driver_name: payload.driver_name || null,
          vehicle_id: data?.vehicle_id || null,
          vehicle_plate: trip.vehicle_plate || null,
          status: 'Dispatched',
        })
        .eq('id', bookingId);
      if (bookingUpdateError) {
        console.warn('Failed to update booking with driver/vehicle assignment:', bookingUpdateError.message || bookingUpdateError);
      }
    }
  } catch (e) {
    console.error('Failed to update booking:', e);
  }
  // update parcel records to reference this trip and mark remote parcels based on trip state
  try {
    const bookingId = data?.booking_id;
    if (bookingId) {
      const parcelStatus = isInTransitStatus(data?.status) ? 'in_transit' : 'assigned';
      await updateRemoteParcelStatus(bookingId, parcelStatus);
    }
  } catch (e) {
    console.error('Failed to sync parcels with trip create:', e);
  }
  try {
    await persistTripStops(supabase, data?.id, stops);
  } catch (e) {
    console.error('Failed to persist trip stops:', e);
  }
  return res.status(201).json(normalizeTrip({ ...data, stops }));
}

async function assignTrip(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  const tripId = req.params.id;
  const { driver_id } = req.body;
  if (!driver_id) return res.status(400).json({ error: 'driver_id is required' });

  try {
    const { data, error } = await supabase.from('trips').update({ driver_id, status: 'Driver Assigned' }).eq('id', tripId).select('*').maybeSingle();
    if (error) {
      console.error('Assign trip error:', error.message || error);
      return res.status(500).json({ error: 'Failed to assign trip' });
    }
    if (!data) return res.status(404).json({ error: 'Trip not found' });
    try { broadcastAssignment({ type: 'assignment', trip: data }); } catch (err) { console.error('Broadcast failed:', err?.message || err); }
    // update parcels for this booking to mark them assigned and with trip id
    try {
      const bookingId = data?.booking_id;
      if (bookingId) {
        await updateRemoteParcelStatus(bookingId, 'assigned');
      }
    } catch (e) {
      console.error('Failed to sync parcels with trip assign:', e);
    }
    return res.json(normalizeTrip(data));
  } catch (err) {
    console.error('Assign trip exception:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function acceptTrip(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  const tripId = req.params.id;
  const { driver_id } = req.body;

  try {
    const update = {};
    if (driver_id) update.driver_id = driver_id;
    // Mark as Scheduled/accepted — actual 'start' is separate
    update.status = 'Scheduled';

    const { data, error } = await supabase.from('trips').update(update).eq('id', tripId).select('*').maybeSingle();
    if (error) {
      console.error('Accept trip error:', error.message || error);
      return res.status(500).json({ error: 'Failed to accept trip' });
    }
    if (!data) return res.status(404).json({ error: 'Trip not found' });
    return res.json(normalizeTrip(data));
  } catch (err) {
    console.error('Accept trip exception:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function updateTripStatus(req, res, status, progress) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  const { data, error } = await supabase.from('trips').update({ status, progress }).eq('id', req.params.id).select('*').maybeSingle();
  if (error) {
    console.error('Update trip status error:', error.message);
    if (isPermissionError(error)) {
      return res.status(403).json({
        error: 'Permission denied updating trip',
        details: 'Service role access or RLS policy for trips is not configured correctly. Apply the backend service role migration and ensure SUPABASE_SERVICE_ROLE_KEY is used.',
      });
    }
    return res.status(500).json({ error: `Unable to update trip: ${error.message}` });
  }
  if (!data) return res.status(404).json({ error: 'Trip not found' });

  const bookingId = data?.booking_id;
  if (bookingId) {
    const parcelStatus = isInTransitStatus(status) ? 'in_transit' : status === 'Completed' ? 'delivered' : null;
    if (parcelStatus) {
      await updateRemoteParcelStatus(bookingId, parcelStatus);
    }
  }

  return res.json(normalizeTrip(data));
}

module.exports = { getTrips, createTrip, assignTrip, acceptTrip, updateTripStatus };
