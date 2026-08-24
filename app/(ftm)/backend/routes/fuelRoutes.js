const express = require('express');
const router = express.Router();
const { getServiceSupabase } = require('../config/db');

function normalizeFuelLog(row) {
  if (!row) return row;
  return {
    id: row.id,
    vehicleId: row.vehicle_id || row.vehicleId || null,
    driverId: row.driver_id || row.driverId || null,
    tripId: row.trip_id || row.tripId || null,
    liters: row.liters != null ? Number(row.liters) : null,
    cost: row.cost != null ? Number(row.cost) : null,
    odometerReading: row.odometer_reading != null ? Number(row.odometer_reading) : null,
    fuelReceiptImage: row.fuel_receipt_image || row.fuelReceiptImage || null,
    loggedAt: row.logged_at || row.loggedAt || row.created_at || null,
  };
}

router.get('/logs', async (_req, res) => {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase.from('fuel_logs').select('*').order('logged_at', { ascending: false }).limit(100);
  if (error) {
    const message = String(error.message || error || '');
    console.error('Supabase fuel_logs query error:', message);
    if (/JWT issued at future|invalid JWT|permission denied|not authorized|rls|Unauthorized/i.test(message)) {
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: `Unable to load fuel logs: ${message}` });
  }

  return res.json((data || []).map(normalizeFuelLog));
});

router.post('/logs', async (req, res) => {
  const payload = req.body || {};
  const liters = Number(payload.liters);
  if (!payload.vehicleId || !Number.isFinite(liters)) {
    return res.status(400).json({ error: 'vehicleId and liters are required' });
  }

  const record = {
    vehicle_id: payload.vehicleId,
    driver_id: payload.driverId || null,
    trip_id: payload.tripId || null,
    liters: liters,
    cost: payload.cost != null ? Number(payload.cost) : null,
    odometer_reading: payload.odometerReading != null ? Number(payload.odometerReading) : null,
    fuel_receipt_image: payload.fuelReceiptImage || null,
    logged_at: payload.loggedAt || null,
  };

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase.from('fuel_logs').insert(record).select('*').single();
  if (error) {
    console.error('Supabase fuel_logs insert error:', error.message || error);
    return res.status(500).json({ error: `Unable to create fuel log: ${error.message || error}` });
  }

  return res.status(201).json(normalizeFuelLog(data));
});

module.exports = router;
