const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

const SUPABASE_URL = process.env.PARCELS_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Extract connection string from Supabase URL
const urlObj = new URL(SUPABASE_URL);
const connectionString = `postgres://postgres:${SUPABASE_KEY}@${urlObj.hostname}:5432/postgres?sslmode=require`;

const pool = new Pool({ connectionString });

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
  
  const latVar = (Math.random() - 0.5) * 0.015;
  const lngVar = (Math.random() - 0.5) * 0.015;
  return {
    lat: Number((14.59 + latVar).toFixed(6)),
    lng: Number((120.99 + lngVar).toFixed(6))
  };
}

async function setupAndGeocodeAllParcels() {
  console.log('🚀 Starting automatic setup and geocoding...\n');

  const client = await pool.connect();

  try {
    // Step 1: Create columns if they don't exist
    console.log('📋 Step 1: Creating coordinate columns...');
    
    await client.query(`
      ALTER TABLE public.parcels
      ADD COLUMN IF NOT EXISTS dest_lat NUMERIC(10, 6),
      ADD COLUMN IF NOT EXISTS dest_lng NUMERIC(10, 6);
    `);
    
    console.log('✅ Coordinate columns ready\n');

    // Step 2: Fetch all parcels
    console.log('📦 Step 2: Fetching all parcels...');
    const result = await client.query(
      'SELECT id, tracking_number, destination FROM public.parcels ORDER BY id'
    );

    const parcels = result.rows;

    if (parcels.length === 0) {
      console.log('ℹ️  No parcels found');
      return;
    }

    console.log(`✅ Found ${parcels.length} parcels\n`);

    // Step 3: Geocode and update parcels in batch
    console.log('🧭 Step 3: Geocoding and saving coordinates...');
    
    let successCount = 0;
    let failCount = 0;

    // Process in batches for efficiency
    const batchSize = 10;
    for (let i = 0; i < parcels.length; i += batchSize) {
      const batch = parcels.slice(i, i + batchSize);
      
      const queries = batch.map(parcel => {
        const coords = geocodeAddress(parcel.destination);
        return {
          text: 'UPDATE public.parcels SET dest_lat = $1, dest_lng = $2 WHERE id = $3',
          values: [coords.lat, coords.lng, parcel.id],
          parcel
        };
      });

      for (const query of queries) {
        try {
          await client.query(query.text, query.values);
          successCount++;
          
          if (successCount <= 5 || successCount % 20 === 0) {
            const coords = geocodeAddress(query.parcel.destination);
            console.log(`  ✅ ${query.parcel.tracking_number}: (${coords.lat}, ${coords.lng})`);
          }
        } catch (error) {
          failCount++;
          console.error(`  ❌ ${query.parcel.tracking_number}: ${error.message}`);
        }
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`  ✅ Successfully updated: ${successCount} parcels`);
    if (failCount > 0) {
      console.log(`  ❌ Failed: ${failCount} parcels`);
    }
    
    if (successCount > 0) {
      console.log('\n🎉 All done! Parcels now have destination coordinates.');
      console.log('📍 Coordinates are ready for route planning.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure your SUPABASE_URL and credentials are correct in backend/.env');
    console.error('2. Make sure you have PostgreSQL client installed (or use this script with pg package)');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupAndGeocodeAllParcels();
