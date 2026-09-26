const { getSupabase, getParcelsSupabase } = require('../config/db');
const { normalizeBooking, buildBookingPayload } = require('../models/Booking');

function isRecoverableSupabaseReadError(error) {
  const message = String(error?.message || error || '');
  return /JWT issued at future|permission denied for table bookings|Could not find the table 'public\.bookings'|Database is not configured|invalid JWT|Unauthorized|timed out/i.test(message);
}

async function getBookings(req, res) {
  const supabase = getSupabase();
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

  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase
    .from('bookings')
    .update({
      driver_id,
      driver_name: driver_name || null,
      vehicle_id,
      vehicle_plate: vehicle_plate || null,
      status: 'DRIVER_VEHICLE_ASSIGNED',
    })
    .eq('id', req.params.id)
    .select('*')
    .maybeSingle();

  if (error) return res.status(500).json({ error: `Unable to assign booking resources: ${error.message}` });
  if (!data) return res.status(404).json({ error: 'Booking not found' });

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
  return res.json(normalizeBooking(data));
}

module.exports = { getBookings, createBooking, assignBookingResources };
