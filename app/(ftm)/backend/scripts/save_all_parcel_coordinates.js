const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.PARCELS_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.PARCELS_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Manila Metro service area reference coordinates
const CITY_COORDINATES = {
  'Caloocan': { lat: 14.675, lng: 121.01 },
  'Quezon City': { lat: 14.63, lng: 121.045 },
  'Manila': { lat: 14.59, lng: 120.99 },
  'Makati': { lat: 14.54, lng: 121.03 },
  'Pasig': { lat: 14.57, lng: 121.075 },
  'Mandaluyong': { lat: 14.575, lng: 121.04 },
  'San Juan': { lat: 14.605, lng: 121.035 },
  'Marikina': { lat: 14.65, lng: 121.1 },
  'Pasay': { lat: 14.525, lng: 120.995 },
  'Taguig': { lat: 14.525, lng: 121.055 },
  'Parañaque': { lat: 14.485, lng: 121.015 },
  'Valenzuela': { lat: 14.705, lng: 120.99 },
  'BGC': { lat: 14.525, lng: 121.055 }, // Bonifacio Global City in Taguig
  'Clark': { lat: 15.19, lng: 120.55 }, // Clark Freeport
  'Cavite': { lat: 14.30, lng: 120.90 },
  'Pampanga': { lat: 15.10, lng: 120.63 },
};

function geocodeAddress(address) {
  const haystack = (address || '').toLowerCase();
  
  // Try to find a known city in the address
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (haystack.includes(city.toLowerCase())) {
      // Add slight random variation so multiple parcels in same city aren't identical
      const latVar = (Math.random() - 0.5) * 0.015;
      const lngVar = (Math.random() - 0.5) * 0.015;
      return {
        lat: Number((coords.lat + latVar).toFixed(6)),
        lng: Number((coords.lng + lngVar).toFixed(6))
      };
    }
  }
  
  // Default to Manila if city not recognized
  const latVar = (Math.random() - 0.5) * 0.015;
  const lngVar = (Math.random() - 0.5) * 0.015;
  return {
    lat: Number((14.59 + latVar).toFixed(6)),
    lng: Number((120.99 + lngVar).toFixed(6))
  };
}

async function geocodeAndSaveParcels() {
  console.log('🧭 Geocoding and saving parcel coordinates...');

  // Fetch all parcels
  const { data: parcels, error: fetchError } = await supabase
    .from('parcels')
    .select('id, tracking_number, destination');

  if (fetchError) {
    console.error('❌ Fetch error:', fetchError.message);
    process.exit(1);
  }

  if (!parcels || parcels.length === 0) {
    console.log('ℹ️  No parcels found');
    process.exit(0);
  }

  console.log(`📦 Processing ${parcels.length} parcels...`);

  // Geocode and update each parcel
  let successCount = 0;
  let failCount = 0;

  for (const parcel of parcels) {
    const coords = geocodeAddress(parcel.destination);
    
    const { error } = await supabase
      .from('parcels')
      .update({ 
        dest_lat: coords.lat, 
        dest_lng: coords.lng 
      })
      .eq('id', parcel.id);

    if (error) {
      console.error(`  ❌ ${parcel.tracking_number}: ${error.message}`);
      failCount++;
    } else {
      successCount++;
      console.log(`  ✅ ${parcel.tracking_number}: (${coords.lat}, ${coords.lng})`);
    }
  }

  console.log(`\n📊 Result: ${successCount} updated, ${failCount} failed`);
  
  if (failCount === 0) {
    console.log('✅ All parcels now have destination coordinates!');
  }
}

geocodeAndSaveParcels().catch((err) => {
  console.error('❌ Operation failed:', err.message);
  process.exit(1);
});
