const express = require('express');
const router = express.Router();
const { getServiceSupabase } = require('../config/db');

// Returns list of drivers with optional latest location from mobile_device_tracking
router.get('/', async (req, res) => {
  try {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) {
      console.warn('Driver list: Supabase client not configured, returning empty array');
      return res.json([]);
    }

    // Select basic driver profiles
    const { data: drivers, error: driversErr } = await serviceSupabase
      .from('users')
      .select('id, email, full_name, role, phone, created_at, updated_at')
      .eq('role', 'driver')
      .order('full_name', { ascending: true });

    if (driversErr) {
      console.warn('Supabase drivers query warning:', driversErr.message || driversErr);
      // Return empty array instead of 500 error to allow frontend to continue
      return res.json([]);
    }

    if (!drivers || drivers.length === 0) {
      return res.json([]);
    }

    // Attach latest mobile location (if any) per driver and query vehicle assignments
    const enriched = await Promise.all((drivers || []).map(async (d) => {
      // Query vehicle assignment for this driver
      try {
        const { data: assignments, error: assignErr } = await serviceSupabase
          .from('driver_assignments')
          .select('vehicle_id')
          .eq('driver_id', d.id)
          .limit(1);

        const assignment = assignments?.[0];
        if (!assignErr && assignment?.vehicle_id) {
          d.vehicle_id = assignment.vehicle_id;
        }
      } catch (e) {
        // ignore assignment lookup errors
      }

      try {
        const { data: latest, error: locErr } = await serviceSupabase
          .from('mobile_device_tracking')
          .select('lat, lng, recorded_at')
          .eq('driver_id', d.id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!locErr && latest) {
          d.last_location_lat = latest.lat;
          d.last_location_lng = latest.lng;
          d.last_location_at = latest.recorded_at;
        } else {
          // Fallback: try driver_tracking table
          try {
            const { data: dt, error: dtErr } = await serviceSupabase
              .from('driver_tracking')
              .select('latitude, longitude, recorded_at')
              .eq('driver_id', d.id)
              .order('recorded_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!dtErr && dt) {
              d.last_location_lat = dt.latitude;
              d.last_location_lng = dt.longitude;
              d.last_location_at = dt.recorded_at;
            }
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore per-driver errors
      }
      return d;
    }));

    return res.json(enriched);
  } catch (err) {
    console.warn('Driver list error:', err);
    // Return empty array on error instead of 500 to allow frontend to continue
    return res.json([]);
  }
});

module.exports = router;
