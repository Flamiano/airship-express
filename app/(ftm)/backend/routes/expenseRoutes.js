const express = require('express');
const router = express.Router();
const { getServiceSupabase } = require('../config/db');
const { scanReceipt } = require('../services/receiptOcr');

const CATEGORY_MAP = {
  fuel: 'Fuel', maintenance: 'Maintenance', toll: 'Toll', parking: 'Parking', other: 'Other',
};

function normalizeExpense(entry) {
  if (!entry) return entry;
  return {
    id: entry.id,
    driver_id: entry.driver_id ?? null,
    vehicle_id: entry.vehicle_id,
    trip_id: entry.trip_id,
    amount: entry.amount,
    category: entry.category,
    note: entry.remarks ?? '',
    photo_url: entry.receipt_image ?? null,
    entry_date: entry.entry_date,
    created_at: entry.created_at,
  };
}

// GET /api/expenses?driver_id=... -> driver's own expense/cost history
router.get('/', async (req, res) => {
  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  const { driver_id: driverId, vehicle_id: vehicleId } = req.query;
  let query = supabase.from('cost_entries').select('*').order('entry_date', { ascending: false });
  if (vehicleId) query = query.eq('vehicle_id', vehicleId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: `Unable to load expenses: ${error.message}` });

  // cost_entries has no driver_id column; if the caller asked for a specific
  // driver, resolve it through that driver's currently assigned vehicle(s).
  let rows = data || [];
  if (driverId && !vehicleId) {
    const vehicleIds = new Set();

    const { data: assignments, error: assignmentError } = await supabase
      .from('driver_assignments')
      .select('vehicle_id')
      .eq('driver_id', driverId);
    if (!assignmentError && Array.isArray(assignments)) {
      assignments.forEach((assignment) => {
        if (assignment?.vehicle_id) vehicleIds.add(assignment.vehicle_id);
      });
    }

    if (vehicleIds.size === 0) {
      const { data: driverTrips, error: tripError } = await supabase
        .from('trips')
        .select('vehicle_id')
        .eq('driver_id', driverId)
        .not('vehicle_id', 'is', null);
      if (!tripError && Array.isArray(driverTrips)) {
        driverTrips.forEach((trip) => {
          if (trip?.vehicle_id) vehicleIds.add(trip.vehicle_id);
        });
      }
    }

    if (vehicleIds.size === 0) {
      const { data: latestTracking, error: trackingError } = await supabase
        .from('mobile_device_tracking')
        .select('vehicle_id')
        .eq('driver_id', driverId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!trackingError && latestTracking?.vehicle_id) {
        vehicleIds.add(latestTracking.vehicle_id);
      }
    }

    rows = rows.filter((row) => vehicleIds.has(row.vehicle_id));
  }

  return res.json(rows.map(normalizeExpense));
});

// POST /api/expenses -> create an expense from the driver app's receipt
// capture screen. Optionally runs server-side OCR on the photo (Expo Go
// compatible - the photo itself is captured on-device with
// expo-image-picker; OCR happens here, not on the device) to sanity-check
// or backfill fields the driver left blank.
router.post('/', async (req, res) => {
  const {
    driver_id: driverId,
    vehicle_id: vehicleId,
    amount,
    category,
    note,
    fuel_type: fuelType,
    fuel_station: fuelStation,
    photo_base64: photoBase64,
    liters,
    price_per_liter: pricePerLiter,
    reference_number: referenceNumber,
    location,
    payment_method: paymentMethod,
  } = req.body || {};

  const normalizedVehicleId = typeof vehicleId === 'string' ? vehicleId.trim() || null : vehicleId || null;
  let finalVehicleId = normalizedVehicleId;
  let finalAmount = Number(amount);
  let finalCategory = CATEGORY_MAP[category] || category;
  let finalNote = note;
  let ocrMeta = null;

  if (photoBase64 && (!Number.isFinite(finalAmount) || !finalCategory || !referenceNumber || !paymentMethod || !location || !finalNote || liters == null || pricePerLiter == null || !fuelStation)) {
    const ocr = await scanReceipt(photoBase64);
    if (ocr.ok) {
      ocrMeta = {
        confidence: ocr.confidence,
        location: ocr.location || null,
        referenceNumber: ocr.referenceNumber || null,
        paymentMethod: ocr.paymentMethod || null,
        currency: ocr.currency || null,
        amountText: ocr.amountText || null,
        liters: Number.isFinite(Number(ocr.liters)) ? Number(ocr.liters) : null,
        pricePerLiter: Number.isFinite(Number(ocr.price_per_liter)) ? Number(ocr.price_per_liter) : (Number.isFinite(Number(ocr.pricePerLiter)) ? Number(ocr.pricePerLiter) : null),
        fuelStation: ocr.fuel_station || ocr.fuelStation || null,
      };
      if (ocr.confidence === 'high') {
        if (!Number.isFinite(finalAmount) && ocr.amount != null) finalAmount = ocr.amount;
        if (!finalCategory && ocr.category) finalCategory = CATEGORY_MAP[ocr.category];
        if (!finalNote && ocr.note) finalNote = ocr.note;
        if (!location && ocr.location) location = ocr.location;
        if (!referenceNumber && ocr.referenceNumber) referenceNumber = ocr.referenceNumber;
        if (!paymentMethod && ocr.paymentMethod) paymentMethod = ocr.paymentMethod;
        if ((liters == null || liters === '') && ocr.liters != null) liters = ocr.liters;
        if ((pricePerLiter == null || pricePerLiter === '') && ocr.price_per_liter != null) pricePerLiter = ocr.price_per_liter;
        if ((pricePerLiter == null || pricePerLiter === '') && ocr.pricePerLiter != null) pricePerLiter = ocr.pricePerLiter;
        if (!fuelStation && ocr.fuel_station) fuelStation = ocr.fuel_station;
        if (!fuelStation && ocr.fuelStation) fuelStation = ocr.fuelStation;
      } else {
        console.warn('[expenseRoutes] OCR confidence not high, skipping automatic backfill:', ocr.confidence, ocr.source);
      }
    }
  }

  if (!Number.isFinite(finalAmount) || finalAmount < 0) {
    return res.status(400).json({ error: 'A valid amount is required' });
  }
  if (!finalCategory) {
    return res.status(400).json({ error: 'A valid category is required' });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database is not configured' });

  // Storing full base64 in a text column is fine for small receipt photos at
  // this project's scale; swap to Supabase Storage + a URL column if photos
  // get larger or numerous.
  const metadataParts = [
    finalNote,
    referenceNumber && `Reference: ${referenceNumber}`,
    location && `Location: ${location}`,
    paymentMethod && `Payment: ${paymentMethod}`,
  ].filter(Boolean);

  // If the driver supplied explicit fuel metadata (or OCR provided it),
  // store a structured JSON description so the web UI can `JSON.parse`
  // and pick up fields like `liters` and `price_per_liter`.
  let descriptionJson = null;
  if (finalCategory === 'Fuel' && (
    liters != null || pricePerLiter != null || fuelType || fuelStation
  )) {
    descriptionJson = {
      note: finalNote || null,
      referenceNumber: referenceNumber || null,
      location: location || null,
      paymentMethod: paymentMethod || null,
      liters: Number.isFinite(Number(liters)) ? Number(liters) : undefined,
      price_per_liter: Number.isFinite(Number(pricePerLiter)) ? Number(pricePerLiter) : undefined,
      fuel_type: fuelType || undefined,
      fuel_station: fuelStation || undefined,
    };
  }

  const payload = {
    vehicle_id: finalVehicleId,
    category: finalCategory,
    amount: finalAmount,
    entry_date: new Date().toISOString().slice(0, 10),
    remarks: descriptionJson ? JSON.stringify(descriptionJson) : metadataParts.join(' • ') || null,
    receipt_image: photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : null,
  };

  const selectColumns = 'id,vehicle_id,trip_id,category,amount,entry_date,remarks,receipt_image,created_at';
  let result = await supabase.from('cost_entries').insert(payload).select(selectColumns).single();
  if (result.error && /receipt_image/i.test(result.error.message)) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.receipt_image;
    result = await supabase.from('cost_entries').insert(fallbackPayload).select(selectColumns).single();
  }

  if (result.error) {
    console.error('Supabase expense insert error:', result.error.message);
    return res.status(500).json({ error: `Unable to create expense: ${result.error.message}` });
  }

  return res.status(201).json({ ...normalizeExpense(result.data), driver_id: driverId || null, ocr: ocrMeta });
});

// POST /api/expenses/scan -> OCR-only preview, used by the driver app to
// auto-fill the amount/category/note fields right after a photo is taken,
// before the driver taps submit.
router.post('/scan', async (req, res) => {
  const { photo_base64: photoBase64 } = req.body || {};
  if (!photoBase64) return res.status(400).json({ error: 'photo_base64 is required' });

  console.log('[expenseRoutes] /api/expenses/scan received, photoBase64 length:', photoBase64.length);
  try {
    const ocr = await scanReceipt(photoBase64);
    console.log('[expenseRoutes] /api/expenses/scan result:', { ok: ocr.ok, reason: ocr.reason, source: ocr.source });
    if (!ocr.ok) {
      return res.json({ ok: false, reason: ocr.reason, details: ocr.details || null });
    }
    return res.json(ocr);
  } catch (err) {
    console.error('[expenseRoutes] /api/expenses/scan failed:', err?.message || err);
    return res.status(500).json({ ok: false, reason: 'ocr_failed', details: err?.message || 'OCR processing failed' });
  }
});

module.exports = router;
