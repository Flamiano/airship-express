const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.PARCELS_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function applyMigration() {
  console.log('📋 Applying migration to add parcel coordinates...');

  const migrationFile = path.join(__dirname, '..', 'migrations', '20260814_add_parcel_coordinates.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error('❌ Migration file not found:', migrationFile);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFile, 'utf-8');

  // Execute the migration via Supabase SQL
  // Note: We use the admin client which has permission to execute raw SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    // If exec_sql doesn't exist, try using the REST API
    console.log('Note: exec_sql not available, you may need to run this migration manually in Supabase SQL Editor');
    console.log('\nMigration SQL:');
    console.log(sql);
    process.exit(1);
  }

  console.log('✅ Migration applied successfully');
}

applyMigration().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  console.log('\nYou may need to run this in Supabase SQL Editor manually:');
  const migrationFile = path.join(__dirname, '..', 'migrations', '20260814_add_parcel_coordinates.sql');
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  console.log(sql);
  process.exit(1);
});
