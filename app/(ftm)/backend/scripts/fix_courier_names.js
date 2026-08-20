const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.PARCELS_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.PARCELS_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

async function fixCourierNames() {
  console.log('🔧 Fixing courier names for all parcels...');

  // Fetch all parcels with invalid couriers
  const { data: parcels, error: fetchError } = await supabase
    .from('parcels')
    .select('id, tracking_number, courier, status')
    .in('courier', ['FastEx', 'QuickDeliver']);

  if (fetchError) {
    console.error('❌ Fetch error:', fetchError.message);
    process.exit(1);
  }

  if (parcels.length === 0) {
    console.log('✅ No parcels with invalid courier names found');
    process.exit(0);
  }

  console.log(`📦 Found ${parcels.length} parcels with invalid courier names`);

  // Update each parcel with a valid courier name based on row position
  const updates = parcels.map((parcel, index) => {
    const newCourier = validCouriers[index % validCouriers.length];
    return supabase
      .from('parcels')
      .update({ courier: newCourier })
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
      const newCourier = validCouriers[index % validCouriers.length];
      console.log(`  ✅ ${parcels[index].tracking_number}: ${parcels[index].courier} → ${newCourier}`);
    }
  });

  console.log(`\n📊 Result: ${successCount} updated, ${failCount} failed`);
  
  if (failCount === 0) {
    console.log('✅ All parcels courier names fixed!');
  }
}

fixCourierNames().catch((err) => {
  console.error('❌ Operation failed:', err);
  process.exit(1);
});
