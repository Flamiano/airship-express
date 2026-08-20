const express = require('express');
const router = express.Router();
const { getSupabase } = require('../config/db');

// GET /api/health
router.get('/', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.json({ ok: false, error: 'supabase_not_configured' });

  try {
    // simple read to detect DB availability / permission errors
    const { data, error } = await supabase.from('vehicles').select('id').limit(1);
    if (error) {
      return res.json({ ok: false, error: error.message || String(error) });
    }
    return res.json({ ok: true, sample: Array.isArray(data) ? data.length : 0 });
  } catch (err) {
    return res.json({ ok: false, error: err?.message || String(err) });
  }
});

module.exports = router;
