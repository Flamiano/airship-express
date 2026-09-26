const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.PARCELS_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.PARCELS_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in ../../.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const serviceCities = [
  { name: 'Caloocan', lat: 14.675, lng: 121.01 },
  { name: 'Quezon City', lat: 14.63, lng: 121.045 },
  { name: 'Manila', lat: 14.59, lng: 120.99 },
  { name: 'Makati', lat: 14.54, lng: 121.03 },
  { name: 'Pasig', lat: 14.57, lng: 121.075 },
  { name: 'Mandaluyong', lat: 14.575, lng: 121.04 },
  { name: 'San Juan', lat: 14.605, lng: 121.035 },
  { name: 'Marikina', lat: 14.65, lng: 121.1 },
  { name: 'Pasay', lat: 14.525, lng: 120.995 },
  { name: 'Taguig', lat: 14.525, lng: 121.055 },
  { name: 'Parañaque', lat: 14.485, lng: 121.015 },
  { name: 'Valenzuela', lat: 14.705, lng: 120.99 },
];

async function addCoordinates() {
  console.log('🧭 Adding destination coordinates to parcels...');

  // Fetch all parcels without coordinates
  const { data: parcels, error: fetchError } = await supabase
    .from('parcels')
    .select('id, tracking_number, dest_lat, dest_lng')
    .or('dest_lat.is.null,dest_lng.is.null');

  if (fetchError) {
    console.error('❌ Fetch error:', fetchError.message);
    process.exit(1);
  }

  if (parcels.length === 0) {
    console.log('✅ All parcels already have coordinates');
    process.exit(0);
  }

  console.log(`📦 Found ${parcels.length} parcels missing coordinates`);

  // Update each parcel with coordinates
  const updates = parcels.map((parcel, index) => {
    const city = serviceCities[index % serviceCities.length];
    const latVariation = (Math.random() - 0.5) * 0.02;
    const lngVariation = (Math.random() - 0.5) * 0.02;
    
    const destLat = Number((city.lat + latVariation).toFixed(6));
    const destLng = Number((city.lng + lngVariation).toFixed(6));
    
    return supabase
      .from('parcels')
      .update({ dest_lat: destLat, dest_lng: destLng })
      .eq('id', parcel.id);
  });

  const results = await Promise.all(updates);

  let successCount = 0;
  let failCount = 0;

  results.forEach((result, index) => {
    if (result.error) {
      console.error(`  ❌ Parcel ${parcels[index].tracking_number}: ${result.error.message}`);
      failCount++;
    } else {
      successCount++;
      const city = serviceCities[index % serviceCities.length];
      console.log(`  ✅ ${parcels[index].tracking_number}: Added ${city.name} coordinates`);
    }
  });

  console.log(`\n📊 Result: ${successCount} updated, ${failCount} failed`);
  
  if (failCount === 0) {
    console.log('✅ All parcels now have coordinates!');
  }
}

addCoordinates().catch((err) => {
  console.error('❌ Operation failed:', err);
  process.exit(1);
});
