const { getServiceSupabase } = require('../config/db');
const { normalizeVehicle, buildVehiclePayload } = require('../models/Vehicle');

function isPermissionError(error) {
  const message = (error?.message || error || '').toString().toLowerCase();
  return message.includes('permission denied') || message.includes('not authorized') || message.includes('rls') || message.includes('jwt');
}

async function getVehicles(req, res) {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase vehicles query error:', error.message || error);
    if (isPermissionError(error)) {
      return res.status(403).json({
        error: 'Vehicle list is not available from Supabase yet',
        details: 'Enable service-role access or apply the required RLS policies before querying vehicles.',
      });
    }
    return res.status(500).json({
      error: 'Unable to load vehicles',
      details: error.message || 'permission denied for table vehicles',
    });
  }

  return res.json((data || []).map(normalizeVehicle));
}

async function createVehicle(req, res) {
  const vehicle = req.body;
  const payload = buildVehiclePayload(vehicle);

  if (!payload.id || !payload.plate_number || !payload.vehicle_type) {
    return res.status(400).json({ error: 'id, plate_number, and vehicle_type are required' });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { data, error } = await supabase.from('vehicles').insert(payload).select('*').single();
  if (error) {
    if (isPermissionError(error)) {
      return res.status(403).json({
        error: 'Vehicle could not be created in Supabase',
        details: 'Enable service-role access or apply the required RLS policies before writing vehicles.',
      });
    }
    return res.status(500).json({ error: `Unable to create vehicle: ${error.message}` });
  }
  return res.status(201).json(normalizeVehicle(data));
}

module.exports = { getVehicles, createVehicle };
