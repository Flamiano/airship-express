const express = require('express');
const router = express.Router();
const { getSupabase } = require('../config/db');

const supabase = getSupabase();
const useSupabase = Boolean(supabase);

router.get('/', async (req, res) => {
  if (useSupabase) {
    const { data, error } = await supabase.from('trip_statistics').select('*');
    if (error) {
      console.error('Supabase analytics query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
    return res.json(data);
  }

  return res.json([]);
});

module.exports = router;
