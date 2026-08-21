const express = require('express');
const router = express.Router();
const { getSupabase } = require('../config/db');

// GET /api/admin/optimized_routes
router.get('/optimized_routes', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  try {
    const { data, error } = await supabase.from('optimized_routes').select('id, trip_id, distance_km, estimated_duration_min, generated_by, created_at').order('created_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: error.message || 'Failed to fetch optimized routes' });
    return res.json(data || []);
  } catch (err) {
    console.error('adminRoutes optimized_routes error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/optimized_routes/:id
router.get('/optimized_routes/:id', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });
  const id = req.params.id;
  try {
    const { data, error } = await supabase.from('optimized_routes').select('*').eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message || 'Failed to fetch optimized route' });
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json(data);
  } catch (err) {
    console.error('adminRoutes optimized_routes/:id error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
