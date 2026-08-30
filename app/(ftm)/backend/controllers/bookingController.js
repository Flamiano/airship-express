const { getSupabase } = require('../config/db');
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

module.exports = { getBookings, createBooking };
