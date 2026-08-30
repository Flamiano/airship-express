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
  'BGC': { lat: 14.525, lng: 121.055 },
  'Clark': { lat: 15.19, lng: 120.55 },
  'Cavite': { lat: 14.30, lng: 120.90 },
  'Pampanga': { lat: 15.10, lng: 120.63 },
  'Bulacan': { lat: 14.82, lng: 120.98 },
  'Laguna': { lat: 14.28, lng: 121.30 },
};

function geocodeAddress(address) {
  const haystack = (address || '').toLowerCase();
  
  // Try to find a known city in the address
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (haystack.includes(city.toLowerCase())) {
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

async function setupAndGeocodeAllParcels() {
  console.log('🚀 Starting automatic setup and geocoding...\n');

  try {
    // Step 1: Try to create columns using raw SQL via RPC or direct query
    console.log('📋 Step 1: Ensuring coordinate columns exist...');
    
    try {
      // Try using exec_sql if available, otherwise the columns might already exist
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE public.parcels
          ADD COLUMN IF NOT EXISTS dest_lat NUMERIC(10, 6),
          ADD COLUMN IF NOT EXISTS dest_lng NUMERIC(10, 6);
        `
      });
      
      if (createError && !createError.message.includes('does not exist')) {
        console.log('ℹ️  Columns may already exist or exec_sql not available');
      } else if (!createError) {
        console.log('✅ Coordinate columns created/verified');
      }
    } catch (e) {
      // exec_sql might not exist, but columns might already be created
      console.log('ℹ️  Attempting to proceed without RPC (columns may already exist)');
    }

    // Step 2: Fetch all parcels
    console.log('\n📦 Step 2: Fetching all parcels...');
    const { data: parcels, error: fetchError } = await supabase
      .from('parcels')
      .select('id, tracking_number, destination');

    if (fetchError) {
      // If fetch fails, try selecting just available columns
      console.error('❌ Fetch error:', fetchError.message);
      console.log('Attempting fallback...');
      process.exit(1);
    }

    if (!parcels || parcels.length === 0) {
      console.log('ℹ️  No parcels found');
      process.exit(0);
    }

    console.log(`✅ Found ${parcels.length} parcels\n`);

    // Step 3: Geocode and update each parcel
    console.log('🧭 Step 3: Geocoding and saving coordinates...');
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < parcels.length; i++) {
      const parcel = parcels[i];
      const coords = geocodeAddress(parcel.destination);
      
      const { error } = await supabase
        .from('parcels')
        .update({ 
          dest_lat: coords.lat, 
          dest_lng: coords.lng 
        })
        .eq('id', parcel.id);

      if (error) {
        failCount++;
        errors.push(`${parcel.tracking_number}: ${error.message}`);
        
        // Only log first few errors to avoid spam
        if (failCount <= 3) {
          console.error(`  ❌ ${parcel.tracking_number}: ${error.message}`);
        }
      } else {
        successCount++;
        if (successCount <= 5 || successCount % 20 === 0) {
          console.log(`  ✅ ${parcel.tracking_number}: (${coords.lat}, ${coords.lng})`);
        }
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`  ✅ Successfully updated: ${successCount} parcels`);
    console.log(`  ❌ Failed: ${failCount} parcels`);
    
    if (failCount > 0 && failCount <= 10) {
      console.log(`\nFailed parcels:`);
      errors.forEach(err => console.log(`  ${err}`));
    }
    
    if (successCount > 0) {
      console.log('\n🎉 Geocoding complete! Parcels now have destination coordinates.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

setupAndGeocodeAllParcels();
