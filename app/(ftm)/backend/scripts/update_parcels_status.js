#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.PARCELS_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.PARCELS_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing PARCELS_SUPABASE_URL or SUPABASE_URL in ../../.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateParcelsStatus() {
  console.log('🔄 Updating parcels status to "received"...');

  // Update all parcels with tracking numbers TRK001-TRK030 to received status
  const { data, error } = await supabase
    .from('parcels')
    .update({ status: 'received' })
    .in('tracking_number', Array.from({ length: 30 }, (_, i) => `TRK${String(i + 1).padStart(3, '0')}`))
    .select();

  if (error) {
    console.error('❌ Update error:', error.message);
    process.exit(1);
  }

  console.log(`✅ Successfully updated ${data.length} parcels to "received" status`);
  console.log('📊 Sample updated parcels:');
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
}

updateParcelsStatus().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
