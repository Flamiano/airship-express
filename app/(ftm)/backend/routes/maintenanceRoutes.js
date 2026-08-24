const express = require('express');
const router = express.Router();
const { getSupabase } = require('../config/db');

const supabase = getSupabase();
const useSupabase = Boolean(supabase);

router.get('/', async (req, res) => {
  if (useSupabase) {
    const { data, error } = await supabase.from('maintenance_history').select('*');
    if (error) {
      console.error('Supabase maintenance query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch maintenance records' });
    }
    return res.json(data);
  }

  return res.json([]);
});

router.post('/', async (req, res) => {
  const record = req.body;
  if (useSupabase) {
    const { data, error } = await supabase.from('maintenance_history').insert([record]).select('*').single();
    if (error) {
      console.error('Supabase maintenance insert error:', error.message);
      return res.status(500).json({ error: 'Failed to create maintenance record' });
    }
    return res.json(data);
  }

  return res.status(501).json({ error: 'Maintenance persistence is not configured' });
});

module.exports = router;
