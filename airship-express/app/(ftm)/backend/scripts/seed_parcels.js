const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.PARCELS_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.PARCELS_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing PARCELS_SUPABASE_URL or PARCELS_SUPABASE_ANON_KEY (or a fallback Supabase URL/key) in ../../.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedParcels() {
  // Service area cities with base coordinates
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

  // 30 realistic parcels with all required columns
  const destinations = [
    '123 Oak Street, Downtown District, Caloocan',
    '456 Maple Avenue, Midtown Plaza, Quezon City',
    '789 Pine Road, North Side Heights, Manila',
    '321 Elm Boulevard, East End Market, Makati',
    '654 Birch Lane, West Gate Complex, Pasig',
    '987 Cedar Street, South Park Shopping, Mandaluyong',
    '147 Spruce Avenue, Harbor Front, San Juan',
    '258 Walnut Road, Central Hub, Marikina',
    '369 Ash Boulevard, Tech Park, Pasay',
    '741 Hickory Lane, Riverside, Taguig',
    '852 Chestnut Street, Industrial Zone, Parañaque',
    '963 Poplar Avenue, Gateway Station, Valenzuela',
    '159 Sycamore Road, Summit Heights, Caloocan',
    '357 Dogwood Boulevard, Valley, Quezon City',
    '456 Mulberry Street, Ridge View, Manila',
    '567 Magnolia Lane, Forest Park, Makati',
    '678 Laurel Avenue, Grove Shopping, Pasig',
    '789 Hazel Road, Meadow View, Mandaluyong',
    '891 Willow Street, Strand Beach, San Juan',
    '912 Rowan Boulevard, Cliff Edge, Marikina',
    '123 Alder Lane, Platform Station, Pasay',
    '234 Fir Avenue, Junction Point, Taguig',
    '345 Larch Road, Terminal Station, Parañaque',
    '456 Basswood Street, Depot Center, Valenzuela',
    '567 Cottonwood Boulevard, Base Camp, Caloocan',
    '678 Hackberry Lane, Point Ridge, Quezon City',
    '789 Sandalwood Avenue, Crossroads, Manila',
    '891 Redwood Road, Crown Heights, Makati',
    '912 Ebony Street, Crest View, Pasig',
    '123 Mahogany Lane, Summit Tower, Mandaluyong'
  ];

  const validCouriers = [
    'ShopeeXpress',
    'JNT Express',
    'Lazada Express',
    'Flash Express',
    'TikTok Delivery',
    'LBC',
    'GOGO Xpress',
    'Airship Express'
  ];

  const parcels = [];
  for (let i = 1; i <= 30; i++) {
    parcels.push({
      tracking_number: `TRK${String(i).padStart(3, '0')}`,
      customer_name: `Customer ${i}`,
      status: 'received',
      barcode: `BAR${String(i).padStart(3, '0')}`,
      sender_name: 'Central Warehouse',
      destination: destinations[i - 1],
      courier: validCouriers[(i - 1) % validCouriers.length],
    });
  }

  console.log(`🚀 Inserting ${parcels.length} realistic parcels...`);

  const { data, error } = await supabase
    .from('parcels')
    .insert(parcels)
    .select();

  if (error) {
    console.error('❌ Insert error:', error.message);
    process.exit(1);
  }

  console.log(`✅ Successfully inserted ${data.length} parcels`);
  console.log('📊 Sample inserted parcels:');
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
}

seedParcels().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
