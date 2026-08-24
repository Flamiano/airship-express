const express = require('express');
const router = express.Router();
const { getServiceSupabase } = require('../config/db');

const COST_CATEGORIES = new Set([
  'Fuel', 'Maintenance', 'Toll', 'Salary', 'Insurance', 'Other', 'Driver', 'Parking', 'Revenue',
]);

function normalizeCostEntry(entry) {
  if (!entry) return entry;

  // Keep the API contract used by the fleet UI while persisting against the
  // database's canonical `remarks` and `entry_date` columns.
  return {
    ...entry,
    vehicleId: entry.vehicle_id || entry.vehicleId || null,
    tripId: entry.trip_id || entry.tripId || null,
    category: entry.category,
    amount: entry.amount != null ? Number(entry.amount) : null,
    entryDate: entry.entry_date || entry.entryDate || null,
    remarks: entry.remarks ?? entry.remarks ?? entry.description ?? null,
    description: entry.description ?? entry.remarks ?? '',
    recorded_at: entry.recorded_at ?? entry.entry_date ?? entry.created_at ?? null,
  };
}

function toEntryDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

router.get('/', async (_req, res) => {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase
    .from('cost_entries')
    .select('*')
    .order('entry_date', { ascending: false });

  if (error) {
    const message = String(error.message || error || '');
    console.error('Supabase cost query error:', message);
    if (/JWT issued at future|invalid JWT|permission denied|not authorized|rls|Unauthorized/i.test(message)) {
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: `Unable to load cost entries: ${message}` });
  }

  return res.json((data || []).map(normalizeCostEntry));
});

router.post('/', async (req, res) => {
  const record = req.body || {};
  const amount = Number(record.amount);

  if (!COST_CATEGORIES.has(record.category)) {
    return res.status(400).json({ error: 'A valid cost category is required' });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number' });
  }

  const entryDate = toEntryDate(record.entry_date || record.recorded_at || record.date);
  if (!entryDate) return res.status(400).json({ error: 'entry_date must be a valid date' });

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const payload = {
    vehicle_id: record.vehicle_id || record.vehicle || null,
    trip_id: record.trip_id || record.trip || null,
    category: record.category,
    amount,
    entry_date: entryDate,
    remarks: record.remarks ?? record.description ?? null,
    receipt_image: record.receipt_image ?? null,
  };

  let result = await supabase.from('cost_entries').insert(payload).select('*').single();
  if (result.error && /receipt_image/i.test(result.error.message)) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.receipt_image;
    result = await supabase.from('cost_entries').insert(fallbackPayload).select('*').single();
  }

  if (result.error) {
    console.error('Supabase cost insert error:', result.error.message);
    return res.status(500).json({ error: `Unable to create cost entry: ${result.error.message}` });
  }

  return res.status(201).json(normalizeCostEntry(result.data));
});

module.exports = router;
