/*
Geocode parcel pickup/destination addresses and update Supabase rows with latitude/longitude.

Usage:
  node geocode_parcels.js           # runs with default (will perform updates)
  DRY_RUN=1 node geocode_parcels.js # just prints planned updates

Notes:
- Requires ../../.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).
- Uses Nominatim (OpenStreetMap) for forward geocoding. Respects a 1s delay between requests.
- The script will try to detect coordinate column names and update the best matching pair.
*/

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ../../.env');
  process.exit(1);
}

const DRY_RUN = !!process.env.DRY_RUN;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocodeAddress(address) {
  if (!address) return null;
  const q = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=0`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'FTM-dev-script/1.0 (your-email@example.com)' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    return { lat: Number(first.lat), lon: Number(first.lon) };
  } catch (err) {
    console.warn('Geocode error for', address, err?.message || err);
    return null;
  }
}

function chooseCoordFields(sampleRow) {
  const keys = Object.keys(sampleRow || {});
  const candidatePairs = [
    ['destination_latitude', 'destination_longitude'],
    ['dropoff_latitude', 'dropoff_longitude'],
    ['pickup_latitude', 'pickup_longitude'],
    ['lat', 'lng'],
    ['latitude', 'longitude'],
    ['location_lat', 'location_lng'],
    ['location_latitude', 'location_longitude'],
  ];
  for (const [a, b] of candidatePairs) {
    if (keys.includes(a) && keys.includes(b)) return [a, b];
  }
  // fallback: if any of lat/lng exist individually
  if (keys.includes('latitude') && keys.includes('longitude')) return ['latitude', 'longitude'];
  // else create `latitude`/`longitude`
  return ['latitude', 'longitude'];
}

async function main() {
  console.log('Fetching parcels...');
  const { data: parcels, error } = await supabase.from('parcels').select('*').limit(1000);
  if (error) {
    console.error('Failed to fetch parcels:', error);
    process.exit(1);
  }
  if (!parcels || parcels.length === 0) {
    console.log('No parcels found.');
    return;
  }

  const [latField, lngField] = chooseCoordFields(parcels[0]);
  console.log('Using coordinate fields:', latField, lngField);

  for (let i = 0; i < parcels.length; i++) {
    const p = parcels[i];
    const id = p.id || p.barcode || p.tracking || `(index ${i})`;

    const hasLat = p[latField] != null && p[latField] !== '';
    const hasLng = p[lngField] != null && p[lngField] !== '';
    if (hasLat && hasLng) {
      console.log(`[${i+1}/${parcels.length}] Skipping ${id} — already has coordinates (${p[latField]}, ${p[lngField]})`);
      continue;
    }

    // choose an address field
    const address = p.destination || p.deliveryAddress || p.dropoff_location || p.pickup_location || p.sender || p.destination_address || p.address || p.delivery_address;
    if (!address) {
      console.log(`[${i+1}/${parcels.length}] Skipping ${id} — no address field to geocode`);
      continue;
    }

    console.log(`[${i+1}/${parcels.length}] Geocoding ${id} -> ${address}`);
    const coords = await geocodeAddress(address);
    // Respect Nominatim usage policy: don't spam
    await delay(1100);

    if (!coords) {
      console.warn(`  -> No geocode result for ${id}`);
      continue;
    }

    const payload = {};
    payload[latField] = coords.lat;
    payload[lngField] = coords.lon;

    console.log(`  -> Found: ${coords.lat}, ${coords.lon}`);
    if (DRY_RUN) {
      console.log('  DRY RUN - would update parcel', id, payload);
      continue;
    }

    try {
      const { data: updated, error: upErr } = await supabase.from('parcels').update(payload).eq('id', p.id).select('*').maybeSingle();
      if (upErr) {
        console.error('  Update failed for', id, upErr);
      } else {
        console.log('  Updated parcel', id);
      }
    } catch (err) {
      console.error('  Exception updating parcel', id, err);
    }
  }

  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
