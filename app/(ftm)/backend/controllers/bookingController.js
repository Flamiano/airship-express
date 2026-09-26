const { getSupabase, getServiceSupabase, getParcelsSupabase } = require('../config/db');
const { normalizeBooking, buildBookingPayload } = require('../models/Booking');
const { validateAssignment } = require('../services/courierAssignmentService');

function isRecoverableSupabaseReadError(error) {
  const message = String(error?.message || error || '');
  return /JWT issued at future|permission denied for table bookings|Could not find the table 'public\.bookings'|Database is not configured|invalid JWT|Unauthorized|timed out/i.test(message);
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

async function syncAssignedTrip(supabase, booking, { driverId, driverName, vehicleId, vehiclePlate }) {
  if (!booking?.id || !driverId || !vehicleId) return;

  const tripPayload = {
    id: `TRIP-${booking.id}`,
    booking_id: booking.id,
    route_plan_id: booking.route_plan_id || null,
    courier_id: booking.courier_id || null,
    driver_id: driverId,
    driver_name: driverName || null,
    vehicle_id: vehicleId,
    vehicle_plate: vehiclePlate || null,
    from_location: booking.pickup_location || null,
    to_location: booking.dropoff_location || null,
    from_latitude: booking.pickup_latitude || null,
    from_longitude: booking.pickup_longitude || null,
    to_latitude: booking.dropoff_latitude || null,
    to_longitude: booking.dropoff_longitude || null,
    load_kg: booking.total_weight_kg || booking.load_kg || booking.cargo_weight || 0,
    status: 'Assigned',
    progress: 0,
    pickup_status: 'pending',
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await supabase
    .from('trips')
    .select('id')
    .eq('booking_id', booking.id)
    .maybeSingle();
  if (lookupError) {
    console.warn('Unable to look up assigned trip for booking:', lookupError.message || lookupError);
    return;
  }

  let result = existing
    ? await supabase.from('trips').update(tripPayload).eq('id', existing.id)
    : await supabase.from('trips').insert(tripPayload);

  if (result.error && /column .* does not exist|schema cache|from_latitude|to_latitude/i.test(String(result.error.message || result.error))) {
    const legacyPayload = { ...tripPayload };
    delete legacyPayload.from_latitude;
    delete legacyPayload.from_longitude;
    delete legacyPayload.to_latitude;
    delete legacyPayload.to_longitude;
    result = existing
      ? await supabase.from('trips').update(legacyPayload).eq('id', existing.id)
      : await supabase.from('trips').insert(legacyPayload);
  }
  if (result.error) {
    console.warn('Unable to synchronize assigned trip for driver app:', result.error.message || result.error);
  }
}

async function notifyDriverAssignment(supabase, booking, driverId) {
  if (!supabase || !booking?.id || !driverId) return;

  const { error } = await supabase.from('notifications').insert({
    user_id: driverId,
    title: 'New booking assignment',
    message: `Booking ${booking.id} has been assigned to you: ${booking.pickup_location || 'pickup'} to ${booking.dropoff_location || 'destination'}.`,
    is_read: false,
  });
  if (error) {
    console.warn('Booking assignment saved but driver notification could not be sent:', error.message || error);
  }
}

async function getBookings(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase.from('bookings').select('*');
  if (error) {
    if (isRecoverableSupabaseReadError(error)) {
      console.warn('Bookings table unavailable; returning empty list fallback:', error.message || error);
      return res.json([]);
    }
    return res.status(500).json({ error: `Unable to load bookings: ${error.message}` });
  }
  return res.json((data || []).map(normalizeBooking));
}

async function createBooking(req, res) {
  const payload = buildBookingPayload(req.body);
  if (!payload.id || !payload.pickup_location || !payload.dropoff_location) {
    return res.status(400).json({ error: 'id, pickup_location, and dropoff_location are required' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase.from('bookings').insert(payload).select('*').single();
  if (error) return res.status(500).json({ error: `Unable to create booking: ${error.message}` });
  return res.status(201).json(normalizeBooking(data));
}

async function assignBookingResources(req, res) {
  const { driver_id, driver_name, vehicle_id, vehicle_plate } = req.body || {};
  if (!driver_id || !vehicle_id) {
    return res.status(400).json({ error: 'driver_id and vehicle_id are required' });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  let validation;
  try {
    validation = await validateAssignment(supabase, { driverId: driver_id, vehicleId: vehicle_id, bookingId: req.params.id });
  } catch (error) {
    console.error('Booking assignment validation failed:', {
      bookingId: req.params.id,
      driverId: driver_id,
      vehicleId: vehicle_id,
      message: error.message || String(error),
    });
    return res.status(409).json({ error: error.message || 'Driver and vehicle are not eligible for this booking.' });
  }

  const { data: bookingBeforeAssignment, error: bookingLookupError } = await supabase
    .from('bookings')
    .select('id, route_plan_id, pickup_location, dropoff_location')
    .eq('id', req.params.id)
    .maybeSingle();
  if (bookingLookupError) return res.status(500).json({ error: `Unable to load booking for assignment: ${bookingLookupError.message}` });
  if (!bookingBeforeAssignment) return res.status(404).json({ error: 'Booking not found' });

  const assignedAt = new Date().toISOString();
  const { data: assignment, error: assignmentError } = await supabase
    .from('booking_assignments')
    .upsert({
      booking_id: bookingBeforeAssignment.id,
      driver_id,
      vehicle_id,
      route_plan_id: bookingBeforeAssignment.route_plan_id || null,
      assigned_at: assignedAt,
      status: 'assigned',
      updated_at: assignedAt,
    }, { onConflict: 'booking_id' })
    .select('*')
    .single();
  if (assignmentError) return res.status(500).json({ error: `Unable to save booking assignment: ${assignmentError.message}` });

  const assignedVehiclePlate = validation.vehicle?.plate_number || vehicle_plate || null;

  const { data: previousBooking } = await supabase
    .from('bookings')
    .select('driver_id, vehicle_id')
    .eq('id', req.params.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('bookings')
    .update({
      driver_id,
      driver_name: driver_name || null,
      vehicle_id,
      vehicle_plate: assignedVehiclePlate,
      status: 'DRIVER_VEHICLE_ASSIGNED',
    })
    .eq('id', req.params.id)
    .select('*')
    .maybeSingle();

  if (error) return res.status(500).json({ error: `Unable to assign booking resources: ${error.message}` });
  if (!data) return res.status(404).json({ error: 'Booking not found' });

  if (previousBooking && (
    previousBooking.driver_id !== driver_id || previousBooking.vehicle_id !== vehicle_id
  )) {
    await updateResourceStatus(supabase, {
      driverId: previousBooking.driver_id,
      vehicleId: previousBooking.vehicle_id,
    }, 'Available');
  }
  await updateResourceStatus(supabase, { driverId: driver_id, vehicleId: vehicle_id }, 'Assigned');
  await syncAssignedTrip(supabase, data, {
    driverId: driver_id,
    driverName: driver_name,
    vehicleId: vehicle_id,
    vehiclePlate: assignedVehiclePlate,
  });
  await notifyDriverAssignment(supabase, data, driver_id);

  // Assignment does not dispatch the route. Keep linked parcels in the
  // booked/staged state until the authorized trip dispatch moves them to
  // in_transit.
  try {
    const parcelsSupabase = getParcelsSupabase();
    if (parcelsSupabase) {
      const cargoDescription = String(data.cargo_description || '');
      const parcelIds = cargoDescription.match(/parcel_ids=([^;\s]+)/i)?.[1]
        ?.split(',').map((id) => id.trim()).filter(Boolean) || [];
      if (parcelIds.length > 0) {
        let parcelUpdate = await parcelsSupabase.from('parcels').update({ status: 'booked' }).in('id', parcelIds);
        if (parcelUpdate.error && /invalid input value|status.*constraint|check constraint/i.test(String(parcelUpdate.error.message || parcelUpdate.error))) {
          parcelUpdate = await parcelsSupabase.from('parcels').update({ status: 'picked_up' }).in('id', parcelIds);
        }
        if (parcelUpdate.error) console.warn('Unable to preserve booked parcel status during assignment:', parcelUpdate.error.message || parcelUpdate.error);
      }
    }
  } catch (parcelError) {
    console.warn('Unable to synchronize parcel assignment status:', parcelError?.message || parcelError);
  }
  return res.json({ ...normalizeBooking(data), assignment });
}

module.exports = { getBookings, createBooking, assignBookingResources };
