const express = require('express');
const router = express.Router();
const { getServiceSupabase, getParcelsSupabase } = require('../config/db');

router.get('/assignments', async (req, res) => {
  const driverId = req.fleetUser?.role === 'driver' ? req.fleetUser.id : null;
  if (!driverId) return res.status(403).json({ error: 'Only an authenticated driver can view driver assignments.' });

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  try {
    const { data: assignments, error: assignmentError } = await supabase
      .from('booking_assignments')
      .select('*')
      .eq('driver_id', driverId)
      .order('assigned_at', { ascending: false });
    if (assignmentError) return res.status(500).json({ error: `Unable to load driver assignments: ${assignmentError.message}` });

    const bookingIds = [...new Set((assignments || []).map((assignment) => assignment.booking_id).filter(Boolean))];
    const vehicleIds = [...new Set((assignments || []).map((assignment) => assignment.vehicle_id).filter(Boolean))];
    const routePlanIds = [...new Set((assignments || []).map((assignment) => assignment.route_plan_id).filter(Boolean))];
    const [{ data: bookings }, { data: vehicles }, { data: routePlans }] = await Promise.all([
      bookingIds.length ? supabase.from('bookings').select('*').in('id', bookingIds) : { data: [] },
      vehicleIds.length ? supabase.from('vehicles').select('*').in('id', vehicleIds) : { data: [] },
      routePlanIds.length ? supabase.from('route_plans').select('*').in('id', routePlanIds) : { data: [] },
    ]);

    const bookingById = new Map((bookings || []).map((booking) => [String(booking.id), booking]));
    const vehicleById = new Map((vehicles || []).map((vehicle) => [String(vehicle.id), vehicle]));
    const routePlanById = new Map((routePlans || []).map((routePlan) => [String(routePlan.id), routePlan]));
    const parcelsSupabase = getParcelsSupabase();
    const parcelByBookingId = new Map();

    if (parcelsSupabase && bookingIds.length) {
      const { data: parcels } = await parcelsSupabase.from('parcels').select('*').in('booking_id', bookingIds);
      (parcels || []).forEach((parcel) => {
        const key = String(parcel.booking_id);
        const current = parcelByBookingId.get(key) || [];
        current.push(parcel);
        parcelByBookingId.set(key, current);
      });
    }

    return res.json((assignments || []).map((assignment) => ({
      ...assignment,
      booking: bookingById.get(String(assignment.booking_id)) || null,
      vehicle: vehicleById.get(String(assignment.vehicle_id)) || null,
      route_plan: assignment.route_plan_id ? routePlanById.get(String(assignment.route_plan_id)) || null : null,
      parcels: parcelByBookingId.get(String(assignment.booking_id)) || [],
    })));
  } catch (error) {
    console.error('Driver assignment query failed:', error.message || error);
    return res.status(500).json({ error: 'Unable to load driver assignments.' });
  }
});

// Returns list of drivers with optional latest location from mobile_device_tracking
router.get('/', async (req, res) => {
  try {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) {
      console.warn('Driver list: Supabase client not configured, returning empty array');
      return res.json([]);
    }

    // Select basic driver profiles
    let { data: drivers, error: driversErr } = await serviceSupabase
      .from('users')
      .select('id, email, full_name, role, is_active, courier_id, created_at, updated_at')
      .eq('role', 'driver')
      .order('full_name', { ascending: true });

    if (driversErr) {
      console.warn('Supabase drivers query warning:', driversErr.message || driversErr);
      // Return empty array instead of 500 error to allow frontend to continue
      return res.json([]);
    }

    if (req.query.courier_id) {
      drivers = drivers.filter((driver) => String(driver.courier_id) === String(req.query.courier_id));
    }

    if (!drivers || drivers.length === 0) {
      return res.json([]);
    }

    const courierIds = [...new Set(drivers.map((driver) => driver.courier_id).filter(Boolean))];
    const { data: couriers } = courierIds.length > 0
      ? await serviceSupabase.from('couriers').select('id, name, code').in('id', courierIds)
      : { data: [] };
    const courierById = new Map((couriers || []).map((courier) => [String(courier.id), courier]));
    drivers = drivers.map((driver) => ({
      ...driver,
      status: driver.is_active === false ? 'Inactive' : 'Available',
      courier: courierById.get(String(driver.courier_id))?.name || null,
    }));

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
