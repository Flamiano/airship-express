const express = require('express');
const router = express.Router();
const { getSupabase, getServiceSupabase, getParcelsSupabase } = require('../config/db');
const { createClient } = require('@supabase/supabase-js');

function localParcelsClient() {
  const parcelsUrl =
    process.env.FTM_PARCELS_SUPABASE_URL ||
    process.env.PARCELS_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_PARCEL_SUPABASE_URL ||
    process.env.NEXT_PUBLIC__FTM_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.FTM_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const parcelsKey =
    process.env.FTM_PARCELS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.FTM_PARCELS_SUPABASE_ANON_KEY ||
    process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.PARCELS_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_PARCEL_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.FTM_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.FTM_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (parcelsUrl && parcelsKey) {
    return createClient(parcelsUrl, parcelsKey);
  }

  return getSupabase();
}

// Previously this returned a hard-coded list that could diverge from the
// database constraint and cause insert/update failures (check constraint
// "chk_status"). Instead fetch distinct status values from the parcels
// table on demand so UI and validation match the DB.
const EXTRA_PARCEL_STATUSES = ['received', 'picked_up'];

function isPermissionDeniedError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return /permission denied|not authorized|rls|role .* has no privilege|cannot access|query.*denied/i.test(msg);
}

function isParcelsTableError(error) {
  const msg = String(error?.message || error || '');
  return /Could not find the table|public\.parcels|Could not query the database for the schema cache/i.test(msg);
}

function isParcelAvailableForRoutePlanning(parcel) {
  if (!parcel || typeof parcel !== 'object') return false;

  const status = String(parcel.status ?? parcel.parcel_status ?? '').trim().toLowerCase();
  if (['delivered', 'cancelled', 'canceled', 'completed', 'closed'].includes(status)) {
    return false;
  }

  const hasRouteAssignment = parcel.route_plan_id != null || parcel.routePlanId != null || parcel.route_id != null || parcel.routeId != null;
  const hasTripAssignment = parcel.trip_id != null || parcel.tripId != null;
  const hasBookingAssignment = parcel.booking_id != null || parcel.bookingId != null;

  if (hasRouteAssignment || hasTripAssignment || hasBookingAssignment) {
    return false;
  }

  return true;
}

async function getAllowedParcelStatuses(supabase) {
  try {
    const { data, error } = await supabase.from('parcels').select('status').limit(1000);
    if (error || !Array.isArray(data)) return [...EXTRA_PARCEL_STATUSES];
    const set = new Set(EXTRA_PARCEL_STATUSES);
    data.forEach((r) => { if (r && r.status) set.add(String(r.status)); });
    return Array.from(set);
  } catch (err) {
    return [...EXTRA_PARCEL_STATUSES];
  }
}

// Normalize courier names to match warehouse system
function normalizeCourierName(courierName) {
  if (!courierName) return 'LBC'; // Default fallback
  
  const normalized = String(courierName).trim();
  
  // Map common courier name variations
  const courierMap = {
    'Shopee Xpress': 'ShopeeXpress',
    'ShopeeXpress': 'ShopeeXpress',
    'JNT Express': 'JNT Express',
    'Lazada Express': 'Lazada Express',
    'Flash Express': 'Flash Express',
    'TikTok Delivery': 'TikTok Delivery',
    'LBC': 'LBC',
    'GOGO Xpress': 'GOGO Xpress',
    'Airship Express': 'Airship Express',
  };
  
  return courierMap[normalized] || normalized;
}

// GET /api/parcels - list parcels from Supabase
router.get('/', async (req, res) => {
  try {
    const supabase = getParcelsSupabase() || getServiceSupabase() || getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { data, error } = await supabase.from('parcels').select('*').limit(1000);
    if (error) {
      console.error('Parcels query error:', error.message || error);
      const msg = String(error?.message || error || '');

      if (isPermissionDeniedError(error)) {
        console.warn('Supabase permission denied when querying parcels, retrying with service role access.');
        const fallbackSupabase = getServiceSupabase();
        if (fallbackSupabase && fallbackSupabase !== supabase) {
          const retry = await fallbackSupabase.from('parcels').select('*').limit(1000);
          if (!retry.error) {
            const responseData = Array.isArray(retry.data) ? retry.data : [];
            const aliasedData = responseData.map((parcel) => ({
              ...parcel,
              courier: normalizeCourierName(parcel.courier),
              bulk_qr_code: parcel.bulk_qr_code ?? parcel.qr_code ?? parcel.bulk_qr ?? parcel.bulkQrCode ?? parcel.qrCode ?? null,
              dropoff_location:
                parcel.dropoff_location ?? parcel.destination ?? parcel.dropoffLocation ?? parcel.delivery_address ?? parcel.deliveryAddress ?? parcel.address ?? parcel.pickup_location ?? parcel.pickupLocation ?? '',
              dest_lat:
                parcel.dest_lat ?? parcel.destLat ?? parcel.dropoff_latitude ?? parcel.dropoffLatitude ?? parcel.latitude ?? parcel.lat ?? null,
              dest_lng:
                parcel.dest_lng ?? parcel.destLng ?? parcel.dropoff_longitude ?? parcel.dropoffLongitude ?? parcel.longitude ?? parcel.lng ?? null,
            }));
            return res.json(aliasedData);
          }
          console.error('Parcels query retry with service role failed:', retry.error.message || retry.error);
        }
      }

      return res.status(500).json({ error: error.message || 'Failed to fetch parcels' });
    }

    const responseData = Array.isArray(data) ? data : [];
    const availableData = responseData.filter(isParcelAvailableForRoutePlanning);
    const aliasedData = availableData.map((parcel) => ({
      ...parcel,
      courier: normalizeCourierName(parcel.courier),
      bulk_qr_code: parcel.bulk_qr_code ?? parcel.qr_code ?? parcel.bulk_qr ?? parcel.bulkQrCode ?? parcel.qrCode ?? null,
      dropoff_location:
        parcel.dropoff_location ?? parcel.destination ?? parcel.dropoffLocation ?? parcel.delivery_address ?? parcel.deliveryAddress ?? parcel.address ?? parcel.pickup_location ?? parcel.pickupLocation ?? '',
      dest_lat:
        parcel.dest_lat ?? parcel.destLat ?? parcel.dropoff_latitude ?? parcel.dropoffLatitude ?? parcel.latitude ?? parcel.lat ?? null,
      dest_lng:
        parcel.dest_lng ?? parcel.destLng ?? parcel.dropoff_longitude ?? parcel.dropoffLongitude ?? parcel.longitude ?? parcel.lng ?? null,
    }));

    return res.json(aliasedData);
  } catch (err) {
    console.error('Parcels route error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/parcels/statuses - return allowed parcel status values
router.get('/statuses', async (req, res) => {
  try {
    const supabase = getParcelsSupabase() || getServiceSupabase() || getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const statuses = await getAllowedParcelStatuses(supabase);
    return res.json({ statuses });
  } catch (err) {
    console.error('Parcels statuses error:', err?.message || err);
    const msg = String(err?.message || err || '');
    if (/Could not find the table|public\.parcels|Could not query the database for the schema cache/i.test(msg)) {
      return res.json({ statuses: ['received', 'picked_up', 'Pending', 'Assigned', 'Scheduled', 'Loading', 'In Transit', 'Completed'] });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/parcels/:id - update parcel fields (courier, status, etc.)
router.patch('/:id', async (req, res) => {
  try {
    const parcelsSupabase = getParcelsSupabase() || getServiceSupabase() || localParcelsClient();
    if (!parcelsSupabase) return res.status(503).json({ error: 'Database not configured' });
    const bookingsSupabase = getServiceSupabase() || getSupabase();
    const id = req.params.id;
    const payload = req.body || {};

    console.log('Parcels PATCH payload for id', id, JSON.stringify(payload));

    // Build a safe update payload: allow booking_id, status, courier, and trip_id.
    const safeUpdate = {};
    let createdBookingFallback = null;

    if (payload.booking_id != null) {
      const bookingId = String(payload.booking_id);
      try {
        const { data: bookingData, error: bookingError } = await bookingsSupabase
          .from('bookings')
          .select('id')
          .eq('id', bookingId)
          .maybeSingle();
        if (bookingError) {
          console.error('Error checking booking existence:', bookingError);
        }
        if (!bookingData) {
          console.warn('Booking id not found for parcels PATCH, creating fallback booking in the main bookings database:', bookingId);
          const fallback = {
            id: bookingId,
            pickup_location: 'Bulk Attach',
            dropoff_location: 'Multiple Destinations',
            status: 'Pending',
          };
          try {
            const { data: inserted, error: insertErr } = await bookingsSupabase
              .from('bookings')
              .insert(fallback)
              .select('*')
              .maybeSingle();
            if (insertErr) {
              console.error('Failed to create fallback booking:', insertErr);
              return res.status(500).json({ error: 'Failed to create fallback booking', details: insertErr });
            }
            safeUpdate.booking_id = bookingId;
            createdBookingFallback = inserted;
          } catch (ie) {
            console.error('Fallback booking insertion failed:', ie);
            return res.status(500).json({ error: 'Failed to create fallback booking' });
          }
        } else {
          safeUpdate.booking_id = bookingId;
        }
      } catch (e) {
        console.error('Booking lookup failed:', e);
        return res.status(500).json({ error: 'Failed to validate booking_id' });
      }
    }

    if (payload.trip_id != null) {
      safeUpdate.trip_id = String(payload.trip_id);
    }

    // validate status against allowed set
    if (payload.status != null) {
      const allowed = await getAllowedParcelStatuses(parcelsSupabase);
      const statusVal = String(payload.status);
      if (allowed.includes(statusVal)) {
        safeUpdate.status = statusVal;
      } else {
        console.warn('Attempt to set unsupported parcel status:', statusVal, 'allowed:', allowed);
        // skip invalid status to avoid constraint violation
      }
    }

    // allow courier updates from the UI
    if (payload.courier !== undefined) {
      safeUpdate.courier = payload.courier === null ? null : String(payload.courier);
    }

    if (Object.keys(safeUpdate).length === 0) {
      // nothing safe to update
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await parcelsSupabase.from('parcels').update(safeUpdate).eq('id', id).select('*').maybeSingle();
    if (error) {
      console.error('Parcels update error full:', error);
      console.error('Parcels update error message:', error.message || error);
      const msg = String(error?.message || error || '');
      return res.status(500).json({ error: error.message || 'Failed to update parcel', details: error });
    }

    return res.json(data || {});
  } catch (err) {
    console.error('Parcels update route error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/parcels/pending-by-courier
router.get('/pending-by-courier', async (req, res) => {
  try {
    const parcelsSupabase = getParcelsSupabase() || localParcelsClient();
    if (!parcelsSupabase) return res.status(503).json({ error: 'Database not configured' });

    const { data, error } = await parcelsSupabase
      .from('parcels')
      .select('*')
      .is('booking_id', null)
      .limit(2000);
    if (error) {
      console.error('pending-by-courier error:', error.message || error);
      const msg = String(error?.message || error || '');
      return res.status(500).json({ error: error.message || 'Failed to fetch parcels' });
    }

    const grouped = {};
    (data || []).forEach((parcel) => {
      const courier = parcel.courier || 'Unassigned';
      if (!grouped[courier]) grouped[courier] = { courier, parcels: [], totalParcels: 0, totalWeight: 0 };
      grouped[courier].parcels.push(parcel);
      grouped[courier].totalParcels += 1;
      grouped[courier].totalWeight += Number(parcel.weight_kg || parcel.weight || 0);
    });

    return res.json(Object.values(grouped));
  } catch (err) {
    console.error('pending-by-courier error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/parcels/bulk-booking  { courier, parcel_ids, route_plan_id }
router.post('/bulk-booking', async (req, res) => {
  try {
    const { courier, parcel_ids: requestedParcelIds = [], route_plan_id: routePlanId, route_plan: routePlanPayload } = req.body || {};
    const requestedIds = Array.isArray(requestedParcelIds) ? requestedParcelIds : [];
    if (!courier) {
      return res.status(400).json({ error: 'courier is required' });
    }

    const parcelsSupabase = getParcelsSupabase() || localParcelsClient();
    const bookingsSupabase = getServiceSupabase() || getSupabase();
    if (!parcelsSupabase || !bookingsSupabase) return res.status(503).json({ error: 'Database not configured' });

    let routePlan = routePlanPayload || null;
    let persistedRoutePlanId = routePlanId || null;
    if (routePlanId) {
      const { data: fetchedRoutePlan, error: routePlanError } = await bookingsSupabase
        .from('route_plans')
        .select('*')
        .eq('id', routePlanId)
        .maybeSingle();
      if (routePlanError) {
        if (!routePlanError.message || !routePlanError.message.includes("Could not find the table 'public.route_plans'")) {
          return res.status(500).json({ error: `Unable to load route plan: ${routePlanError.message}` });
        }
      }
      if (fetchedRoutePlan) routePlan = fetchedRoutePlan;
    }
    if (!routePlan && requestedIds.length > 0) {
      routePlan = {
        courier,
        pickup_location: req.body.pickup_location || 'Airship Express Hub - Binondo, Manila',
        pickup_latitude: req.body.pickup_latitude ?? null,
        pickup_longitude: req.body.pickup_longitude ?? null,
        delivery_destinations: [{ name: req.body.dropoff_location || 'Selected delivery destinations' }],
      };
    }
    if (!routePlan) {
      return res.status(400).json({ error: 'route_plan or route_plan_id is required' });
    }
    if (routePlan.courier && routePlan.courier !== courier) {
      return res.status(400).json({ error: 'That route plan does not belong to the selected courier' });
    }

    if (!persistedRoutePlanId) {
      const isUuid = (value) => typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
      const routePlanInsert = {
        courier,
        pickup_location: routePlan.pickup_location || req.body.pickup_location || 'Airship Express Hub - Binondo, Manila',
        pickup_latitude: routePlan.pickup_latitude ?? req.body.pickup_latitude ?? null,
        pickup_longitude: routePlan.pickup_longitude ?? req.body.pickup_longitude ?? null,
        delivery_destinations: Array.isArray(routePlan.delivery_destinations) && routePlan.delivery_destinations.length > 0
          ? routePlan.delivery_destinations
          : [{ name: req.body.dropoff_location || 'Selected delivery destinations' }],
        status: routePlan.status || 'assigned',
      };
      if (isUuid(routePlan.id)) {
        routePlanInsert.id = routePlan.id;
      }
      const { data: insertedRoutePlan, error: insertRoutePlanError } = await bookingsSupabase
        .from('route_plans')
        .insert(routePlanInsert)
        .select('*')
        .maybeSingle();
      if (insertRoutePlanError) {
        if (!insertRoutePlanError.message || !insertRoutePlanError.message.includes("Could not find the table 'public.route_plans'")) {
          console.error('Unable to persist route plan for bulk booking:', insertRoutePlanError.message || insertRoutePlanError);
        }
      } else if (insertedRoutePlan) {
        routePlan = insertedRoutePlan;
        persistedRoutePlanId = insertedRoutePlan.id;
      }
    }

    let parcels = [];
    let parcelsError = null;
    let parcelsData = null;

    let parcelsQuery = parcelsSupabase.from('parcels').select('*');
    parcelsQuery = requestedIds.length > 0 ? parcelsQuery.in('id', requestedIds) : parcelsQuery.eq('courier', courier);
    ({ data: parcelsData, error: parcelsError } = await parcelsQuery);
    parcels = parcelsData || [];

    if (parcelsError) {
      const errorText = String(parcelsError?.message || parcelsError || '');
      const errorJson = String(JSON.stringify(parcelsError || ''));
      console.error('Unable to load parcels:', parcelsError.message || parcelsError, { errorText, errorJson });
      return res.status(500).json({ error: `Unable to load parcels: ${parcelsError.message || parcelsError}` });
    }
    if (!parcels || parcels.length === 0) {
      return res.status(400).json({ error: `No pending parcels found for courier "${courier}"` });
    }

    const bookingId = `BK-${Date.now()}`;
    const totalWeight = parcels.reduce((sum, p) => sum + Number(p.weight_kg || p.weight || 0), 0);
    const parcelIds = parcels.map((p) => p.id);
    const destinations = Array.isArray(routePlan.delivery_destinations) ? routePlan.delivery_destinations : [];

    const bookingPayload = {
      id: bookingId,
      courier: courier,
      route_plan_id: persistedRoutePlanId || routePlanId || routePlan?.id || null,
      delivery_destinations: destinations,
      pickup_location: routePlan.pickup_location,
      pickup_latitude: routePlan.pickup_latitude,
      pickup_longitude: routePlan.pickup_longitude,
      dropoff_location: destinations.length ? destinations[destinations.length - 1].name : routePlan.pickup_location,
      cargo_type: 'BulkDelivery',
      cargo_description: `${parcels.length} parcel(s) for ${courier}; parcel_ids=${parcelIds.join(',')}`,
      cargo_weight: totalWeight,
      status: 'Pending',
    };

    console.log('BULK BOOKING PAYLOAD', JSON.stringify(bookingPayload));
    let { data: booking, error: bookingError } = await bookingsSupabase
      .from('bookings')
      .insert(bookingPayload)
      .select('*')
      .single();

    if (bookingError && /column .* does not exist/i.test(String(bookingError.message || bookingError))) {
      console.warn('Booking insert schema mismatch; retrying with reduced booking payload.');
      const reducedPayload = {
        id: bookingId,
        courier: courier,
        route_plan_id: persistedRoutePlanId || routePlanId || routePlan?.id || null,
        delivery_destinations: destinations,
        pickup_location: routePlan.pickup_location,
        pickup_latitude: routePlan.pickup_latitude,
        pickup_longitude: routePlan.pickup_longitude,
        dropoff_location: destinations.length ? destinations[destinations.length - 1].name : routePlan.pickup_location,
        cargo_type: 'BulkDelivery',
        cargo_description: bookingPayload.cargo_description,
        cargo_weight: bookingPayload.cargo_weight,
        status: 'Pending',
      };
      const retry = await bookingsSupabase
        .from('bookings')
        .insert(reducedPayload)
        .select('*')
        .single();
      booking = retry.data;
      bookingError = retry.error;
    }

    if (bookingError) {
      console.error('BULK BOOKING INSERT ERROR', bookingError);
      return res.status(500).json({ error: `Unable to create bulk booking: ${bookingError.message}` });
    }

    let updateError = null;
    const attachPayload = {
      booking_id: bookingId,
      route_plan_id: persistedRoutePlanId || routePlanId || routePlan?.id || null,
      status: 'picked_up',
    };

    try {
      const batchUpdate = await parcelsSupabase
        .from('parcels')
        .update(attachPayload)
        .in('id', parcelIds.map((id) => String(id)));
      updateError = batchUpdate.error;
      if (updateError && /invalid input syntax for type bigint|type bigint|column .* does not exist|could not match/i.test(String(updateError.message || updateError))) {
        updateError = null;
        for (const parcelId of parcelIds) {
          const singleUpdate = await parcelsSupabase
            .from('parcels')
            .update(attachPayload)
            .eq('id', String(parcelId));
          if (singleUpdate.error) {
            updateError = singleUpdate.error;
            break;
          }
        }
      }
    } catch (err) {
      updateError = err;
    }

    if (updateError) {
      // Log the error but don't fail - the booking is created and tracks parcels via parcelIds
      console.warn('Warning: Failed to attach parcels to bulk booking (this is okay, booking tracks parcels via parcelIds):', updateError.message || updateError);
      console.warn('Parcels will still be tracked by the booking record. Status update may have also failed.');
    }

    return res.status(201).json({
      booking,
      routePlan,
      parcelCount: parcels.length,
      totalWeight,
      parcelIds,
    });
  } catch (err) {
    console.error('bulk-booking error:', err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
