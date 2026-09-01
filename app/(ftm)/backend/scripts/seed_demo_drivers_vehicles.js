const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ../../.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generateUUID() {
  return `${[8, 4, 4, 4, 12].map(n => crypto.randomBytes(n/2).toString('hex')).join('-')}`;
}

async function seedDemoDriversAndVehicles() {
  const demoDrivers = [
    { id: generateUUID(), full_name: 'Marco Reyes', email: 'marco.reyes@airship.local', phone: '09171234567', role: 'driver' },
    { id: generateUUID(), full_name: 'Alicia Santos', email: 'alicia.santos@airship.local', phone: '09172234567', role: 'driver' },
    { id: generateUUID(), full_name: 'Daniel Cruz', email: 'daniel.cruz@airship.local', phone: '09173234567', role: 'driver' },
    { id: generateUUID(), full_name: 'Rina Gomez', email: 'rina.gomez@airship.local', phone: '09174234567', role: 'driver' },
    { id: generateUUID(), full_name: 'Leo Bautista', email: 'leo.bautista@airship.local', phone: '09175234567', role: 'driver' },
    { id: generateUUID(), full_name: 'Nina Mendoza', email: 'nina.mendoza@airship.local', phone: '09176234567', role: 'driver' },
  ];

  const demoVehicles = [
    { id: generateUUID(), plate_number: 'ABC-1234', vehicle_type: 'Van', capacity_kg: 800 },
    { id: generateUUID(), plate_number: 'XYZ-4567', vehicle_type: 'Truck', capacity_kg: 1500 },
    { id: generateUUID(), plate_number: 'LMN-8901', vehicle_type: 'Pickup', capacity_kg: 1100 },
    { id: generateUUID(), plate_number: 'QRS-1123', vehicle_type: 'Van', capacity_kg: 900 },
    { id: generateUUID(), plate_number: 'TUV-3345', vehicle_type: 'Truck', capacity_kg: 1800 },
    { id: generateUUID(), plate_number: 'WXY-7788', vehicle_type: 'Box Truck', capacity_kg: 2000 },
  ];

  console.log(`📋 Seeding ${demoDrivers.length} demo drivers...`);
  const { data: driversData, error: driversError } = await supabase
    .from('users')
    .insert(demoDrivers)
    .select();

  if (driversError) {
    if (driversError.message?.includes('duplicate key') || driversError.message?.includes('already exists')) {
      console.log('ℹ️  Drivers already exist in Supabase');
    } else {
      console.error('⚠️  Drivers insert warning:', driversError.message);
    }
  } else {
    console.log(`✅ Inserted ${driversData?.length || 0} demo drivers`);
  }

  console.log(`📋 Seeding ${demoVehicles.length} demo vehicles...`);
  const { data: vehiclesData, error: vehiclesError } = await supabase
    .from('vehicles')
    .insert(demoVehicles)
    .select();

  if (vehiclesError) {
    if (vehiclesError.message?.includes('duplicate key') || vehiclesError.message?.includes('already exists')) {
      console.log('ℹ️  Vehicles already exist in Supabase');
    } else {
      console.error('⚠️  Vehicles insert warning:', vehiclesError.message);
    }
  } else {
    console.log(`✅ Inserted ${vehiclesData?.length || 0} demo vehicles`);
  }

  console.log('✨ Demo drivers and vehicles seeded successfully!');
  process.exit(0);
}

seedDemoDriversAndVehicles().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
