const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.FTM_PARCELS_SUPABASE_URL || process.env.PARCELS_SUPABASE_URL || process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_URL || process.env.NEXT_PUBLIC_PARCEL_SUPABASE_URL || process.env.FTM_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.FTM_PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.FTM_PARCELS_SUPABASE_ANON_KEY || process.env.PARCELS_SUPABASE_ANON_KEY || process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Parcel Supabase credentials are missing from the workspace environment.');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const couriers = ['Airship Express', 'JNT Express', 'LBC', 'ShopeeXpress', 'Lazada Express', 'Flash Express'];
const cities = [
  ['Manila', 14.5995, 120.9842],
  ['Quezon City', 14.6760, 121.0437],
  ['Caloocan', 14.6507, 120.9660],
  ['Makati', 14.5547, 121.0244],
  ['Pasig', 14.5764, 121.0851],
  ['Taguig', 14.5176, 121.0509],
  ['Pasay', 14.5378, 121.0014],
  ['Paranaque', 14.4793, 121.0198],
  ['Marikina', 14.6507, 121.1029],
  ['Mandaluyong', 14.5794, 121.0359],
];
const firstNames = ['Andrea', 'Bianca', 'Carlos', 'Daniel', 'Elaine', 'Francis', 'Grace', 'Hannah', 'Ivan', 'Jasmine', 'Kevin', 'Leah', 'Marco', 'Nina', 'Oscar', 'Paolo', 'Rina', 'Samuel', 'Tessa', 'Victor'];
const lastNames = ['Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Navarro', 'Bautista', 'Aquino', 'Dela Cruz', 'Ramos'];
const streets = ['Rizal', 'Mabini', 'Bonifacio', 'Aguinaldo', 'Katipunan', 'Ortigas', 'P. Tuazon', 'Quezon', 'Taft', 'Commonwealth'];

function makeParcel(index) {
  const number = String(index + 1).padStart(3, '0');
  const city = cities[index % cities.length];
  const customer = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]}`;
  const street = streets[index % streets.length];
  const address = `${100 + index} ${street} Avenue, ${city[0]}, Metro Manila`;
  return {
    tracking_number: `PUP-20260924-${number}`,
    barcode: `PUPBAR20260924${number}`,
    sender_name: 'Airship Express Hub - Binondo',
    customer_name: customer,
    customer_number: `09${String(170000000 + index)}`,
    destination: address,
    city: city[0],
    courier: couriers[index % couriers.length],
    priority: index % 10 === 0 ? 'High' : 'Normal',
    status: 'picked_up',
    region: 'NCR',
    current_parcels_location: 'Airship Express Hub - Binondo',
    date_received: new Date(Date.now() - (index % 7) * 86400000).toISOString(),
    received_by: 'FTM Dispatch',
    updated_at: new Date().toISOString(),
  };
}

async function seed() {
  const rows = Array.from({ length: 150 }, (_, index) => makeParcel(index));
  const trackingNumbers = rows.map((row) => row.tracking_number);
  const { data: existing, error: existingError } = await supabase
    .from('parcels')
    .select('tracking_number')
    .in('tracking_number', trackingNumbers);
  if (existingError) throw existingError;

  const existingSet = new Set((existing || []).map((row) => row.tracking_number));
  const pending = rows.filter((row) => !existingSet.has(row.tracking_number));
  if (pending.length === 0) {
    console.log('No new parcels needed; all 150 records already exist.');
    return;
  }

  const { data, error } = await supabase.from('parcels').insert(pending).select('id, tracking_number, status');
  if (error) throw error;
  console.log(`Inserted ${data.length} picked_up parcels; skipped ${rows.length - pending.length} existing records.`);
}

seed().catch((error) => {
  console.error('Parcel seed failed:', error.message || error);
  process.exitCode = 1;
});
