const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyDemoData() {
  console.log('📋 Verifying demo drivers in Supabase...');
  const { data: drivers, error: driversError } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('role', 'driver')
    .limit(10);

  if (driversError) {
    console.error('❌ Error querying drivers:', driversError.message);
  } else {
    console.log(`✅ Found ${drivers?.length || 0} drivers`);
    if (drivers && drivers.length > 0) {
      console.log('Sample drivers:');
      drivers.slice(0, 3).forEach((d) => {
        console.log(`  - ${d.full_name} (${d.email})`);
      });
    }
  }

  console.log('\n📋 Verifying demo vehicles in Supabase...');
  const { data: vehicles, error: vehiclesError } = await supabase
    .from('vehicles')
    .select('id, plate_number, vehicle_type, capacity_kg')
    .limit(10);

  if (vehiclesError) {
    console.error('❌ Error querying vehicles:', vehiclesError.message);
  } else {
    console.log(`✅ Found ${vehicles?.length || 0} vehicles`);
    if (vehicles && vehicles.length > 0) {
      console.log('Sample vehicles:');
      vehicles.slice(0, 3).forEach((v) => {
        console.log(`  - ${v.plate_number} (${v.vehicle_type}, ${v.capacity_kg}kg)`);
      });
    }
  }

  process.exit(0);
}

verifyDemoData().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
