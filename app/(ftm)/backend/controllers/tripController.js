const { getSupabase, getServiceSupabase, getParcelsSupabase } = require('../config/db');
const { broadcastAssignment } = require('../events/sse');
const { normalizeTrip, buildTripPayload } = require('../models/Trip');
const { validateAssignment } = require('../services/courierAssignmentService');

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'Database is not configured' });
}

async function updateResourceStatus(supabase, { driverId, vehicleId }, status) {
  const updates = [];

  if (vehicleId) {
    updates.push((async () => {
      const primary = await supabase
        .from('vehicles')
        .update({ status, availability: status, assignment_status: status.toLowerCase() })
        .eq('id', vehicleId);
      if (primary.error && /assignment_status|column .* does not exist|schema cache/i.test(String(primary.error.message || primary.error))) {
        return supabase
          .from('vehicles')
          .update({ status, availability: status })
          .eq('id', vehicleId);
      }
      return primary;
    })());
  }

  if (driverId) {
    updates.push(
      supabase
        .from('users')
        .update({ is_active: status.toLowerCase() !== 'inactive' })
        .eq('id', driverId)
    );
  }

  const results = await Promise.all(updates);
  results.forEach((result) => {
    if (result.error) {
      console.warn(`Unable to update ${status.toLowerCase()} resource status:`, result.error.message || result.error);
    }
  });
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

async function notifyDriverTripAssigned(supabase, trip) {
  if (!supabase || !trip?.driver_id) return;
  const pickup = trip.from_location || trip.pickup_location || 'pickup';
  const dropoff = trip.to_location || trip.dropoff_location || 'drop-off';
  const notification = {
    user_id: trip.driver_id,
    title: 'New trip assignment',
    message: `Trip ${trip.id} has been assigned to you: ${pickup} to ${dropoff}.`,
    is_read: false,
  };
  const { error } = await supabase.from('notifications').insert(notification);
  if (error) {
    console.warn('Trip assigned but driver notification could not be sent:', error.message || error);
    return;
  }

  try {
    const { data: tokens, error: tokenError } = await supabase
      .from('driver_push_tokens')
      .select('token')
      .eq('driver_id', trip.driver_id);
    if (tokenError) throw tokenError;

    const messages = (tokens || [])
      .map((item) => item.token)
      .filter((token) => /^ExponentPushToken\[.+\]$/.test(token))
      .map((to) => ({
        to,
        title: notification.title,
        body: notification.message,
        sound: 'default',
        data: { tripId: trip.id, notificationType: 'trip_assignment' },
      }));
    if (messages.length === 0) return;

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!pushResponse.ok) {
      console.warn('Expo push service rejected trip assignment:', await pushResponse.text());
    }
  } catch (error) {
    console.warn('Trip notification saved but push delivery failed:', error.message || error);
  }
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
  return /in transit|in_transit|transit|dispatched|dispatching|delivering|moving|en route|on route|active/i.test(String(status || ''));
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
    const buildTripQuery = (includeStops = true, includeBookingJoin = true) => {
      const coreFields = `
        id, booking_id, vehicle_id, vehicle_plate, driver_id, driver_name, status, progress,
        pickup_status, pickup_proof_url, pickup_confirmed_at,
        estimated_departure, estimated_arrival, actual_departure, actual_arrival,
        delay_reason, created_at, updated_at, route_plan_id
      `;
      const bookingJoin = includeBookingJoin
        ? `, bookings(pickup_location, pickup_latitude, pickup_longitude, dropoff_location, dropoff_latitude, dropoff_longitude, cargo_weight)`
        : '';
      const stopsJoin = includeStops ? ', trip_stops(sequence, name, latitude, longitude, status)' : '';
      const baseSelect = `${coreFields}${bookingJoin}${stopsJoin}`;
      const query = supabase.from('trips').select(baseSelect).order('created_at', { ascending: false }).limit(isLightRequest ? 100 : 200);
      if (req.query.status) query.eq('status', req.query.status);
      if (req.fleetUser?.role === 'driver') query.eq('driver_id', req.fleetUser.id);
      else if (req.query.driver_id) query.eq('driver_id', req.query.driver_id);
      return query;
    };

    let tripData = [];
    let tripError = null;
    let bookingsById = new Map();
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
        if (/trip_stops|Could not find a relationship|schema cache|Could not find the table/i.test(msg)) {
          console.warn('Trip schema relationship unavailable; retrying trips query without joins:', msg);
          const fallback = await buildTripQuery(false, false);
          const fallbackResult = await fallback;
          tripData = fallbackResult.data || [];
          const fallbackMsg = String(fallbackResult.error?.message || fallbackResult.error || '');
          tripError = /trip_stops|Could not find a relationship|schema cache|Could not find the table/i.test(fallbackMsg)
            ? null
            : fallbackResult.error;
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

    // Some Supabase projects do not expose a foreign-key relationship between
    // trips and bookings. Load the booking rows separately so trip locations
    // remain available to dashboard consumers in that schema variant.
    const bookingIds = Array.from(new Set((tripData || []).map((trip) => trip.booking_id).filter(Boolean)));
    if (bookingIds.length > 0) {
      const { data: bookingRows, error: bookingRowsError } = await supabase
        .from('bookings')
        .select('id, pickup_location, pickup_latitude, pickup_longitude, dropoff_location, dropoff_latitude, dropoff_longitude, cargo_weight, driver_id, driver_name, vehicle_id, vehicle_plate')
        .in('id', bookingIds);
      if (!bookingRowsError) {
        bookingsById = new Map((bookingRows || []).map((booking) => [String(booking.id), booking]));
      } else {
        console.warn('Unable to load booking locations for trips:', bookingRowsError.message || bookingRowsError);
      }
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
      const booking = Array.isArray(trip.bookings) ? trip.bookings[0] : trip.bookings || bookingsById.get(String(trip.booking_id));
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

  if (!payload.id || !payload.from_location || !payload.to_location) {
    return res.status(400).json({ error: 'id, from_location, and to_location are required' });
  }

  if (isInTransitStatus(payload.status) && !payload.vehicle_id) {
    return res.status(400).json({ error: 'A vehicle must be assigned before a trip can be dispatched.' });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  let assignment;
  if (payload.driver_id || payload.vehicle_id) {
    try {
      assignment = await validateAssignment(supabase, {
        driverId: payload.driver_id,
        vehicleId: payload.vehicle_id,
        bookingId: payload.booking_id,
        routePlanId: payload.route_plan_id,
        courierId: payload.courier_id,
        courier: payload.courier,
      });
    } catch (error) {
      return res.status(409).json({ error: error.message || 'Driver and vehicle are not eligible for this trip.' });
    }
    payload.courier_id = assignment.courier.id || payload.courier_id;
  }

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
  try {
    await notifyDriverTripAssigned(supabase, data);
  } catch (err) {
    console.error('Failed to create driver trip assignment notification:', err?.message || err);
  }
  await updateResourceStatus(supabase, {
    driverId: data?.driver_id,
    vehicleId: data?.vehicle_id,
  }, 'Assigned');
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
  // Keep the saved route plan linked to the dispatched trip so route-plan,
  // booking, and mission pages all read the same lifecycle state.
  try {
    const routePlanId = data?.route_plan_id || payload.route_plan_id || null;
    if (routePlanId) {
      const { error: routePlanUpdateError } = await supabase
        .from('route_plans')
        .update({ trip_id: data.id, status: isInTransitStatus(data.status) ? 'in_progress' : 'assigned' })
        .eq('id', routePlanId);
      if (routePlanUpdateError) {
        console.warn('Failed to update route plan dispatch state:', routePlanUpdateError.message || routePlanUpdateError);
      }
    }
  } catch (e) {
    console.error('Failed to sync route plan with trip:', e);
  }
  // update parcel records to reference this trip and mark remote parcels based on trip state
  try {
    const bookingId = data?.booking_id;
    if (bookingId) {
      const parcelStatus = isInTransitStatus(data?.status) ? 'in_transit' : 'booked';
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

async function confirmTripPickup(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  const tripId = req.params.id;
  const { driver_id, proof_url, manifest_verified, picked_up_parcel_ids = [] } = req.body || {};
  if (!proof_url || manifest_verified !== true) {
    return res.status(400).json({ error: 'Pickup proof and manifest verification are required before starting the trip.' });
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .maybeSingle();
  if (tripError) return res.status(500).json({ error: `Unable to load trip: ${tripError.message}` });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (driver_id && trip.driver_id && String(driver_id) !== String(trip.driver_id)) {
    return res.status(403).json({ error: 'Only the assigned driver can confirm this pickup.' });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('trips')
    .update({
      pickup_status: 'confirmed',
      pickup_proof_url: proof_url,
      pickup_confirmed_at: now,
      status: 'Pickup Confirmed',
    })
    .eq('id', tripId)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: `Unable to confirm pickup: ${error.message}` });

  if (trip.booking_id) {
    await updateRemoteParcelStatus(trip.booking_id, 'picked_up');
  }
  if (Array.isArray(picked_up_parcel_ids) && picked_up_parcel_ids.length > 0) {
    const parcelsSupabase = getParcelsSupabase();
    if (parcelsSupabase) {
      await parcelsSupabase.from('parcels').update({ status: 'picked_up' }).in('id', picked_up_parcel_ids);
    }
  }

  return res.json(normalizeTrip(data));
}

async function startTrip(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (tripError) return res.status(500).json({ error: `Unable to load trip: ${tripError.message}` });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.pickup_status !== 'confirmed') {
    return res.status(409).json({ error: 'Pickup proof and manifest verification are required before starting the delivery trip.' });
  }

  try {
    await validateAssignment(supabase, {
      driverId: trip.driver_id,
      vehicleId: trip.vehicle_id,
      bookingId: trip.booking_id,
      routePlanId: trip.route_plan_id,
      courierId: trip.courier_id,
      tripId: trip.id,
    });
  } catch (error) {
    return res.status(409).json({ error: error.message || 'The current driver and vehicle are no longer eligible to dispatch this trip.' });
  }

  return updateTripStatus(req, res, 'In Transit', 5, { pickupStatus: 'started', bookingId: trip.booking_id });
}

async function assignTrip(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  const tripId = req.params.id;
  const { driver_id } = req.body;
  if (!driver_id) return res.status(400).json({ error: 'driver_id is required' });

  try {
    const { data: trip, error: tripError } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (tripError) return res.status(500).json({ error: `Unable to load trip: ${tripError.message}` });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    try {
      const assignment = await validateAssignment(supabase, {
        driverId: driver_id,
        vehicleId: trip.vehicle_id,
        bookingId: trip.booking_id,
        routePlanId: trip.route_plan_id,
        courierId: trip.courier_id,
        tripId,
      });
      const { data, error } = await supabase.from('trips').update({ driver_id, driver_name: assignment.driver.full_name || null, courier_id: assignment.courier.id || trip.courier_id, status: 'Driver Assigned' }).eq('id', tripId).select('*').maybeSingle();
      if (error) {
        console.error('Assign trip error:', error.message || error);
        return res.status(500).json({ error: 'Failed to assign trip' });
      }
      if (!data) return res.status(404).json({ error: 'Trip not found' });
      try { broadcastAssignment({ type: 'assignment', trip: data }); } catch (err) { console.error('Broadcast failed:', err?.message || err); }
      try {
        await notifyDriverTripAssigned(supabase, data);
      } catch (err) {
        console.error('Failed to create driver trip assignment notification:', err?.message || err);
      }
      await updateResourceStatus(supabase, { driverId: data.driver_id, vehicleId: data.vehicle_id }, 'Assigned');
      return res.json(normalizeTrip(data));
    } catch (error) {
      return res.status(409).json({ error: error.message || 'Driver is not eligible for this trip.' });
    }
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
    const { data: trip, error: tripError } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle();
    if (tripError) return res.status(500).json({ error: `Unable to load trip: ${tripError.message}` });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    const update = {};
    if (driver_id || trip.driver_id) {
      try {
        const assignment = await validateAssignment(supabase, {
          driverId: driver_id || trip.driver_id,
          vehicleId: trip.vehicle_id,
          bookingId: trip.booking_id,
          routePlanId: trip.route_plan_id,
          courierId: trip.courier_id,
          tripId,
        });
        update.driver_id = driver_id || trip.driver_id;
        update.driver_name = assignment.driver.full_name || null;
        update.courier_id = assignment.courier.id || trip.courier_id;
      } catch (error) {
        return res.status(409).json({ error: error.message || 'Driver is not eligible for this trip.' });
      }
    }
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

async function updateTripStatus(req, res, status, progress, options = {}) {
  const supabase = getServiceSupabase();
  if (!supabase) return databaseUnavailable(res);

  const update = { status, progress };
  if (options.pickupStatus) update.pickup_status = options.pickupStatus;
  const { data, error } = await supabase.from('trips').update(update).eq('id', req.params.id).select('*').maybeSingle();
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

  const bookingId = options.bookingId || data?.booking_id;
  if (bookingId) {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const parcelStatus = /delayed|late|exception/.test(normalizedStatus)
      ? 'delayed'
      : isInTransitStatus(status)
        ? 'in_transit'
        : normalizedStatus === 'completed'
          ? 'delivered'
            : normalizedStatus === 'in transit'
              ? 'in_transit'
          : null;
    if (parcelStatus) {
      await updateRemoteParcelStatus(bookingId, parcelStatus);
    }
  }

  if (data?.route_plan_id) {
    const routePlanStatus = isInTransitStatus(status)
      ? 'in_progress'
      : status === 'Completed'
        ? 'completed'
        : null;
    if (routePlanStatus) {
      const { error: routePlanError } = await supabase
        .from('route_plans')
        .update({ status: routePlanStatus })
        .eq('id', data.route_plan_id);
      if (routePlanError) {
        console.warn('Failed to update route plan status:', routePlanError.message || routePlanError);
      }
    }
  }

  if (String(status).toLowerCase() === 'completed') {
    await updateResourceStatus(supabase, {
      driverId: data?.driver_id,
      vehicleId: data?.vehicle_id,
    }, 'Available');
  }

  return res.json(normalizeTrip(data));
}

module.exports = { getTrips, createTrip, confirmTripPickup, startTrip, assignTrip, acceptTrip, updateTripStatus };
