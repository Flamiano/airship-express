const express = require('express');
const router = express.Router();
const { getSupabase } = require('../config/db');
const { createClient } = require('@supabase/supabase-js');

const supabase = getSupabase();
const useSupabase = Boolean(supabase);

// Ensure we have an explicit service-role client for server-side inserts/reads
const serviceSupabase = createClient(
  process.env.FTM_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.FTM_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Get tracking history for a trip (all sources)
router.get('/:tripId', async (req, res) => {
  const tripId = req.params.tripId;
  if (useSupabase) {
    const { data, error } = await supabase
      .from('tracking_history')
      .select('*')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: true });
    if (error) {
      console.error('Supabase tracking query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch tracking history' });
    }
    return res.json(data);
  }

  return res.json([]);
});

// Get vehicle GPS tracking history
router.get('/vehicle-gps/:vehicleId', async (req, res) => {
  const vehicleId = req.params.vehicleId;
  const limit = parseInt(req.query.limit) || 100;

  if (useSupabase) {
    const { data, error } = await serviceSupabase
      .from('vehicle_gps_tracking')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase vehicle GPS query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch vehicle GPS tracking' });
    }
    return res.json((data || []).reverse());
  }

  return res.json([]);
});

// Get mobile device tracking history for a driver
router.get('/mobile-gps/:driverId', async (req, res) => {
  const driverId = req.params.driverId;
  const limit = parseInt(req.query.limit) || 100;

  if (useSupabase) {
    const { data, error } = await serviceSupabase
      .from('mobile_device_tracking')
      .select('*')
      .eq('driver_id', driverId)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase mobile GPS query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch mobile GPS tracking' });
    }
    return res.json((data || []).reverse());
  }

  return res.json([]);
});

// Record vehicle GPS tracking point
router.post('/vehicle-gps/record', async (req, res) => {
  const { vehicle_id, lat, lng, speed, heading, accuracy, signal_strength, battery_level, status, notes } = req.body;

  if (!vehicle_id || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'vehicle_id, lat, and lng are required' });
  }

  if (useSupabase) {
    const payload = {
      vehicle_id,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      speed: speed ? parseFloat(speed) : null,
      heading: heading ? parseFloat(heading) : null,
      accuracy: accuracy ? parseFloat(accuracy) : null,
      signal_strength: signal_strength ? parseInt(signal_strength) : null,
      battery_level: battery_level ? parseInt(battery_level) : null,
      status: status || 'active',
      notes: notes || null,
    };

    const { data, error } = await serviceSupabase
      .from('vehicle_gps_tracking')
      .insert([payload])
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Supabase vehicle GPS insert error:', error.message || error);
      return res.status(500).json({
        error: 'Failed to record vehicle GPS point',
        details: error.message || 'permission denied for table vehicle_gps_tracking',
      });
    }

    // Also mirror into tracking_history for trip-level timeline if trip_id provided
    try {
      const historyPayload = {
        trip_id: data.trip_id || null,
        vehicle_id: data.vehicle_id,
        latitude: data.lat,
        longitude: data.lng,
        speed: data.speed || null,
        recorded_at: data.recorded_at || null,
      };
      await serviceSupabase.from('tracking_history').insert([historyPayload]);
    } catch (e) {
      // ignore history mirror failures
    }

    return res.status(201).json(data);
  }

  return res.status(501).json({ error: 'Tracking persistence is not configured' });
});

// Record mobile device GPS tracking point
router.post('/mobile-gps/record', async (req, res) => {
  const { driver_id, vehicle_id, lat, lng, latitude, longitude, speed, heading, accuracy, battery_level, device_type, app_version, status } = req.body;

  const parsedLat = lat ?? latitude;
  const parsedLng = lng ?? longitude;

  if (!driver_id || parsedLat === undefined || parsedLng === undefined) {
    return res.status(400).json({ error: 'driver_id, lat/latitude, and lng/longitude are required' });
  }

  if (useSupabase) {
    const payload = {
      driver_id,
      vehicle_id: vehicle_id || null,
      lat: parseFloat(parsedLat),
      lng: parseFloat(parsedLng),
      speed: speed != null ? parseFloat(speed) : null,
      heading: heading != null ? parseFloat(heading) : null,
      accuracy: accuracy != null ? parseFloat(accuracy) : null,
      battery_level: battery_level != null ? parseInt(battery_level) : null,
      device_type: device_type || 'unknown',
      app_version: app_version || null,
      status: status || 'active',
    };

    const { data, error } = await serviceSupabase
      .from('mobile_device_tracking')
      .insert([payload])
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Supabase mobile GPS insert error:', error.message || error);
      // If the specific mobile_device_tracking table is missing (migration not applied)
      // fall back to inserting a normalized record into `tracking_history` and `driver_tracking`
      if (/mobile_device_tracking_vehicle_id_fkey/i.test(error.message || '')) {
        console.warn('Retrying mobile GPS insert without vehicle_id due to foreign key failure');
        const fallbackPayload = { ...payload, vehicle_id: null };
        const retry = await serviceSupabase
          .from('mobile_device_tracking')
          .insert([fallbackPayload])
          .select('*')
          .maybeSingle();

        if (!retry.error) {
          const dataWithoutVehicle = retry.data;
          try {
            const driverTrack = {
              driver_id: dataWithoutVehicle.driver_id,
              vehicle_id: null,
              trip_id: dataWithoutVehicle.trip_id || null,
              latitude: dataWithoutVehicle.lat,
              longitude: dataWithoutVehicle.lng,
              speed: dataWithoutVehicle.speed || null,
              heading: dataWithoutVehicle.heading || null,
              is_mock_location: false,
              recorded_at: dataWithoutVehicle.recorded_at || null,
            };
            await serviceSupabase.from('driver_tracking').insert([driverTrack]);
          } catch (e) {
            // ignore history mirror failures
          }
          return res.status(201).json(dataWithoutVehicle);
        }
      }
      // Table not found fallback
      if (/could not find the table\s+'public\.mobile_device_tracking'/i.test(error.message || '')) {
        console.warn('mobile_device_tracking table missing; falling back to tracking_history + driver_tracking');
        try {
          const historyPayload = {
            tracking_source: 'mobile',
            driver_id: payload.driver_id || null,
            vehicle_id: payload.vehicle_id || null,
            latitude: payload.lat,
            longitude: payload.lng,
            speed: payload.speed || null,
            heading: payload.heading || null,
            accuracy: payload.accuracy || null,
            recorded_at: null,
          };
          await serviceSupabase.from('tracking_history').insert([historyPayload]);
        } catch (e) {
          console.error('Fallback tracking_history insert failed:', e.message || e);
        }
        try {
          const driverTrack = {
            driver_id: payload.driver_id || null,
            vehicle_id: payload.vehicle_id || null,
            trip_id: null,
            latitude: payload.lat,
            longitude: payload.lng,
            speed: payload.speed || null,
            heading: payload.heading || null,
            is_mock_location: false,
            recorded_at: null,
          };
          await serviceSupabase.from('driver_tracking').insert([driverTrack]);
        } catch (e) {
          console.error('Fallback driver_tracking insert failed:', e.message || e);
        }
        return res.status(201).json({ warning: 'mobile_device_tracking table missing; wrote fallback tracking records' });
      }
      return res.status(500).json({
        error: 'Failed to record mobile GPS point',
        details: error.message || 'permission denied for table mobile_device_tracking',
      });
    }

    // Mirror into driver_tracking for quick driver-centric lookups
    try {
      const driverTrack = {
        driver_id: data.driver_id,
        vehicle_id: data.vehicle_id || null,
        trip_id: data.trip_id || null,
        latitude: data.lat,
        longitude: data.lng,
        speed: data.speed || null,
        heading: data.heading || null,
        is_mock_location: false,
        recorded_at: data.recorded_at || null,
      };
      await serviceSupabase.from('driver_tracking').insert([driverTrack]);
    } catch (e) {
      // ignore mirror failures
    }

    return res.status(201).json(data);
  }

  return res.status(501).json({ error: 'Tracking persistence is not configured' });
});

// Legacy: Record tracking point (original endpoint)
router.post('/:tripId', async (req, res) => {
  const tripId = req.params.tripId;
  const payload = { 
    trip_id: tripId, 
    tracking_source: req.body.tracking_source || 'mobile',
    ...req.body 
  };
  
  if (useSupabase) {
    // Normalize common coordinate keys to the schema's `latitude`/`longitude`
    if (payload.lat !== undefined && payload.latitude === undefined) {
      payload.latitude = parseFloat(payload.lat);
      delete payload.lat;
    }
    if (payload.lng !== undefined && payload.longitude === undefined) {
      payload.longitude = parseFloat(payload.lng);
      delete payload.lng;
    }

    const { data, error } = await supabase
      .from('tracking_history')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      console.error('Supabase tracking insert error:', error.message);
      return res.status(500).json({ error: 'Failed to record tracking point' });
    }
    return res.status(201).json(data);
  }

  return res.status(501).json({ error: 'Tracking persistence is not configured' });
});

module.exports = router;
