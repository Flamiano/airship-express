const express = require('express');
const router = express.Router();
const { getServiceSupabase, getParcelsSupabase } = require('../config/db');
const { normalizeVehicle } = require('../models/Vehicle');
const { normalizeTrip } = require('../models/Trip');

const SEED_TRIP_ID_PATTERN = /^D-TEST/;
const SEED_DRIVER_IDS = new Set(['a5d87bb4-d3a4-49c0-9bd7-6c5053233efe', '88657e7d-166f-4bb1-84a9-d7eee51d22c8']);
const SEED_DRIVER_EMAILS = new Set(['demo.driver@example.com']);
const SEED_VEHICLE_PLATES = new Set(['ABC-014', 'TRK-014']);
const DEMO_DRIVER_NAME_PATTERN = /demo driver/i;

function isSeedTrip(trip) {
  const id = String(trip?.id ?? trip?.trip_id ?? trip?.code ?? '');
  const vehicle = String(trip?.vehicle_id ?? trip?.vehicle ?? trip?.plate ?? '');
  const driverId = String(trip?.driver_id ?? trip?.driver ?? '');
  return (
    SEED_TRIP_ID_PATTERN.test(id) ||
    SEED_VEHICLE_PLATES.has(vehicle) ||
    SEED_DRIVER_IDS.has(driverId)
  );
}

function isSeedDriver(driver) {
  return (
    SEED_DRIVER_IDS.has(driver.id) ||
    SEED_DRIVER_EMAILS.has(driver.email) ||
    (typeof driver.full_name === 'string' && DEMO_DRIVER_NAME_PATTERN.test(driver.full_name)) ||
    (typeof driver.name === 'string' && DEMO_DRIVER_NAME_PATTERN.test(driver.name))
  );
}

function normalizeDriverRecord(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name || user.name || (user.user_metadata?.full_name ?? null) || null,
    name: user.name || user.full_name || (user.user_metadata?.full_name ?? null) || null,
    role: user.role || user.user_metadata?.role || null,
    phone: user.phone || user.user_metadata?.phone || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function buildFallbackDashboardSnapshot() {
  // Return empty arrays instead of demo data - we want to show real data only
  return {
    counts: {
      vehicles: 0,
      trips: 0,
      bookings: 0,
      drivers: 0,
      parcels: 0,
    },
    vehicles: [],
    trips: [],
    bookings: [],
    drivers: [],
    parcels: [],
  };
}

function attachDriverLocationSnapshot(enrichedDriver, locationRow) {
  if (!locationRow) return enrichedDriver;

  const lat = locationRow.lat ?? locationRow.latitude ?? locationRow.location_lat ?? locationRow.last_location_lat;
  const lng = locationRow.lng ?? locationRow.longitude ?? locationRow.location_lng ?? locationRow.last_location_lng;

  if (lat != null && lng != null) {
    enrichedDriver.last_location_lat = Number(lat);
    enrichedDriver.last_location_lng = Number(lng);
    enrichedDriver.last_location_latitude = Number(lat);
    enrichedDriver.last_location_longitude = Number(lng);
    enrichedDriver.location = { lat: Number(lat), lng: Number(lng) };
    enrichedDriver.latitude = Number(lat);
    enrichedDriver.longitude = Number(lng);
  }

  if (locationRow.recorded_at) {
    enrichedDriver.last_location_at = locationRow.recorded_at;
    enrichedDriver.last_seen_at = locationRow.recorded_at;
  }

  if (!enrichedDriver.vehicle_id && locationRow.vehicle_id) {
    enrichedDriver.vehicle_id = locationRow.vehicle_id;
  }

  return enrichedDriver;
}

async function fetchDrivers(serviceSupabase) {
  try {
    const { data, error } = await serviceSupabase
      .from('users')
      .select('id,email,full_name,role,phone,created_at,updated_at')
      .eq('role', 'driver')
      .order('full_name', { ascending: true })
      .limit(150);

    if (error || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    const normalized = data.map(normalizeDriverRecord).filter((driver) => !isSeedDriver(driver));
    if (normalized.length === 0) {
      return [];
    }

    const driverIds = normalized.map((driver) => driver.id);

    const [assignmentResult, mobileResult, trackingResult] = await Promise.all([
      serviceSupabase
        .from('driver_assignments')
        .select('driver_id, vehicle_id')
        .in('driver_id', driverIds),
      serviceSupabase
        .from('mobile_device_tracking')
        .select('driver_id, vehicle_id, lat, lng, latitude, longitude, recorded_at')
        .in('driver_id', driverIds)
        .order('recorded_at', { ascending: false }),
      serviceSupabase
        .from('driver_tracking')
        .select('driver_id, vehicle_id, latitude, longitude, recorded_at')
        .in('driver_id', driverIds)
        .order('recorded_at', { ascending: false }),
    ]);

    const assignmentMap = new Map();
    for (const row of assignmentResult.data || []) {
      if (row?.driver_id && row?.vehicle_id && !assignmentMap.has(row.driver_id)) {
        assignmentMap.set(row.driver_id, row.vehicle_id);
      }
    }

    const mobileByDriver = new Map();
    for (const row of mobileResult.data || []) {
      if (!row?.driver_id || mobileByDriver.has(row.driver_id)) continue;
      mobileByDriver.set(row.driver_id, row);
    }

    const trackingByDriver = new Map();
    for (const row of trackingResult.data || []) {
      if (!row?.driver_id || trackingByDriver.has(row.driver_id)) continue;
      trackingByDriver.set(row.driver_id, row);
    }

    return normalized.map((driver) => {
      const enriched = { ...driver };
      const assignmentVehicleId = assignmentMap.get(driver.id);
      if (assignmentVehicleId) {
        enriched.vehicle_id = assignmentVehicleId;
      }

      const mobileRow = mobileByDriver.get(driver.id);
      if (mobileRow) {
        attachDriverLocationSnapshot(enriched, mobileRow);
        return enriched;
      }

      const trackingRow = trackingByDriver.get(driver.id);
      if (trackingRow) {
        attachDriverLocationSnapshot(enriched, trackingRow);
      }

      return enriched;
    });
  } catch (err) {
    console.warn('Driver snapshot users query failed:', err?.message || err);
  }
  return [];
}

router.get('/', async (req, res) => {
  const supabase = getServiceSupabase();
  const parcelsSupabase = getParcelsSupabase() || supabase;
  if (!supabase) {
    return res.status(503).json({ error: 'Database is not configured' });
  }

  try {
    const [vehiclesResult, tripsResult, bookingsResult, parcelsResult, routePlansResult, routePlanBookingsResult, drivers] = await Promise.all([
      supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
      supabase.from('trips')
        .select(`*, bookings(pickup_location, pickup_latitude, pickup_longitude, dropoff_location, dropoff_latitude, dropoff_longitude, cargo_weight)`)
        .order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      // Parcels can be stored in a separate Supabase project. Query that
      // connection so a missing `parcels` table in the fleet project does
      // not prevent the whole dashboard (including fleet analytics) loading.
      parcelsSupabase.from('parcels').select('*').order('created_at', { ascending: false }),
      supabase.from('route_plans').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('route_plan_bookings').select('*').limit(200),
      fetchDrivers(supabase),
    ]);

    if (vehiclesResult.error || tripsResult.error || bookingsResult.error || parcelsResult.error || routePlansResult.error || routePlanBookingsResult.error) {
      const queryError = vehiclesResult.error || tripsResult.error || bookingsResult.error || parcelsResult.error || routePlansResult.error || routePlanBookingsResult.error;
      console.error('Dashboard snapshot query error:', queryError);
      if (queryError && (queryError.code === 'PGRST002' || queryError.code === '42501' || queryError.code === 'PGRST303')) {
        console.warn('Using fallback dashboard snapshot because Supabase data access is temporarily unavailable.');
        return res.json(buildFallbackDashboardSnapshot());
      }
      return res.status(500).json({ error: 'Failed to fetch dashboard snapshot data' });
    }

    const vehicleIds = (vehiclesResult.data || [])
      .map((vehicle) => vehicle?.id ?? vehicle?.vehicle_id)
      .filter(Boolean);

    const vehicleDriverMap = new Map();
    const driverLookupMap = new Map();

    if (vehicleIds.length > 0) {
      try {
        const { data: assignmentRows = [], error: assignmentError } = await supabase
          .from('driver_assignments')
          .select('vehicle_id, driver_id')
          .in('vehicle_id', vehicleIds);

        if (!assignmentError && Array.isArray(assignmentRows)) {
          for (const row of assignmentRows) {
            if (!row?.vehicle_id || !row?.driver_id || vehicleDriverMap.has(row.vehicle_id)) continue;
            vehicleDriverMap.set(row.vehicle_id, row.driver_id);
          }
        }
      } catch (err) {
        console.warn('Vehicle assignment lookup failed:', err?.message || err);
      }

      const driverIds = [...new Set([...vehicleDriverMap.values()])];
      if (driverIds.length > 0) {
        try {
          const { data: driverRows = [], error: driverError } = await supabase
            .from('users')
            .select('id, full_name, name')
            .in('id', driverIds);

          if (!driverError && Array.isArray(driverRows)) {
            for (const row of driverRows) {
              if (!row?.id) continue;
              driverLookupMap.set(row.id, row);
            }
          }
        } catch (err) {
          console.warn('Assigned driver lookup failed:', err?.message || err);
        }
      }
    }

    const vehicles = (vehiclesResult.data || []).map((vehicle) => {
      const normalized = normalizeVehicle(vehicle);
      const vehicleKey = normalized.id ?? normalized.vehicle_id ?? vehicle?.id ?? vehicle?.vehicle_id;
      const assignedDriverId = vehicleDriverMap.get(vehicleKey) ?? null;
      const assignedDriver = assignedDriverId ? driverLookupMap.get(assignedDriverId) : null;
      const driverName = assignedDriver?.full_name || assignedDriver?.name || normalized.driverName || normalized.driver || null;

      return {
        ...normalized,
        driver_id: assignedDriverId,
        driver: driverName,
        driverName,
      };
    });

    const trips = (tripsResult.data || [])
      .map((trip) => {
        const booking = Array.isArray(trip.bookings) ? trip.bookings[0] : trip.bookings;
        return normalizeTrip({
          ...trip,
          from_location: trip.from_location || booking?.pickup_location || null,
          to_location: trip.to_location || booking?.dropoff_location || null,
          from_latitude: trip.from_latitude ?? booking?.pickup_latitude ?? null,
          from_longitude: trip.from_longitude ?? booking?.pickup_longitude ?? null,
          to_latitude: trip.to_latitude ?? booking?.dropoff_latitude ?? null,
          to_longitude: trip.to_longitude ?? booking?.dropoff_longitude ?? null,
          load_kg: trip.load_kg ?? booking?.cargo_weight ?? null,
        });
      })
      .filter((trip) => !isSeedTrip(trip));
    const bookings = bookingsResult.data || [];
    const parcels = parcelsResult.data || [];
    const driverRecords = (Array.isArray(drivers) ? drivers : []).filter(
      (driver) =>
        !SEED_DRIVER_IDS.has(driver.id) &&
        !SEED_DRIVER_EMAILS.has(driver.email) &&
        !(typeof driver.full_name === 'string' && DEMO_DRIVER_NAME_PATTERN.test(driver.full_name))
    );

    const routePlans = Array.isArray(routePlansResult.data) ? routePlansResult.data : [];
    const routePlanBookings = Array.isArray(routePlanBookingsResult.data) ? routePlanBookingsResult.data : [];

    const getStatusFromTrip = (trip) => {
      const raw = String(trip?.status || '').toLowerCase();
      if (/delayed|late|delay|critical/.test(raw)) return 'Delayed';
      if (/approach|arriv|near/.test(raw)) return 'Approaching';
      return 'In Transit';
    };

    const getTripDestination = (trip, booking, routePlan) => {
      const routeStops = Array.isArray(routePlan?.delivery_destinations)
        ? routePlan.delivery_destinations
        : Array.isArray(routePlan?.stops)
          ? routePlan.stops
          : [];
      const lastStop = routeStops[routeStops.length - 1];
      return trip?.to_location || booking?.dropoff_location || routePlan?.destination || lastStop?.name || 'Assigned route';
    };

    const normalizeCoordinate = (value) => Number(value ?? 0);

    const deployments = trips.map((trip, idx) => {
      const booking = Array.isArray(trip.bookings) ? trip.bookings[0] : trip.bookings;
      const routePlan = trip.route_plan_id ? routePlans.find((row) => row.id === trip.route_plan_id) : null;
      const routeStops = Array.isArray(routePlan?.delivery_destinations)
        ? routePlan.delivery_destinations
        : Array.isArray(routePlan?.stops)
          ? routePlan.stops
          : [];
      const lastStop = routeStops[routeStops.length - 1];
      const lat = trip.to_latitude ?? lastStop?.latitude ?? booking?.dropoff_latitude ?? routePlan?.destination_latitude ?? null;
      const lng = trip.to_longitude ?? lastStop?.longitude ?? booking?.dropoff_longitude ?? routePlan?.destination_longitude ?? null;
      const rawStatus = getStatusFromTrip(trip);
      const etaSource = trip.estimated_arrival || trip.estimatedArrival;
      const etaValue = etaSource ? new Date(etaSource) : null;
      const flightTimeLeft = etaValue && !Number.isNaN(etaValue.getTime())
        ? `${Math.max(0, Math.ceil((etaValue.getTime() - Date.now()) / 60000))} min`
        : (trip.duration_minutes ? `${trip.duration_minutes} min` : '--:--');

      // Use scatter of coordinates around Manila hub as fallback if no destination found
      const fallbackCoords = [
        { lat: 14.5995 + (Math.random() * 0.5 - 0.25), lng: 120.9842 + (Math.random() * 0.5 - 0.25) },
        { lat: 14.7135, lng: 121.0049 },
        { lat: 14.4534, lng: 120.9933 },
        { lat: 14.3667, lng: 121.0333 },
      ][idx % 4];

      const finalLat = normalizeCoordinate(lat);
      const finalLng = normalizeCoordinate(lng);
      const hasValidCoords = Number.isFinite(finalLat) && Number.isFinite(finalLng) && (finalLat !== 0 || finalLng !== 0);

      return {
        vesselId: trip.id || `trip-${Math.random().toString(36).slice(2, 8)}`,
        destination: getTripDestination(trip, booking, routePlan),
        status: rawStatus,
        flightTimeLeft,
        cargoWeight: trip.load_kg || booking?.cargo_weight || routePlan?.cargo_weight || '—',
        lat: hasValidCoords ? finalLat : fallbackCoords.lat,
        lng: hasValidCoords ? finalLng : fallbackCoords.lng,
      };
    });

    const hubs = routePlans
      .map((routePlan) => {
        const lat = routePlan?.pickup_latitude ?? routePlan?.pickupLatitude ?? routePlan?.hub_latitude ?? null;
        const lng = routePlan?.pickup_longitude ?? routePlan?.pickupLongitude ?? routePlan?.hub_longitude ?? null;
        if (!lat || !lng) return null;
        return {
          name: routePlan.name || routePlan.route_name || routePlan.hub_name || 'Hub',
          lat: Number(lat),
          lng: Number(lng),
        };
      })
      .filter(Boolean);

    const hourlyDispatchTrend = Array.from({ length: 6 }, (_, index) => {
      const label = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'][index] || `${index}:00`;
      const volume = trips.filter((trip) => {
        const timestamp = trip.created_at || trip.createdAt;
        if (!timestamp) return false;
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return false;
        const hour = date.getHours();
        return hour >= (index * 3) && hour < ((index + 1) * 3);
      }).length;
      return { time: label, volume };
    });

    return res.json({
      counts: {
        vehicles: vehicles.length,
        trips: trips.length,
        bookings: bookings.length,
        drivers: driverRecords.length,
        parcels: parcels.length,
      },
      vehicles,
      trips,
      bookings,
      parcels,
      drivers: driverRecords,
      routePlans,
      routePlanBookings,
      deployments,
      hubs: hubs.length > 0 ? hubs : [{ name: 'Hub Alpha - Manila', lat: 14.5995, lng: 120.9842 }],
      hourlyDispatchTrend,
    });
  } catch (err) {
    console.error('Dashboard snapshot error:', err?.message || err);
    return res.status(500).json({ error: 'Unable to load dashboard snapshot' });
  }
});

module.exports = router;
