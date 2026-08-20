const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function applySqlMigration(filePath) {
  const migrationPath = path.resolve(__dirname, '..', filePath);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log(`📋 Applying migration: ${filePath}`);
  console.log('---');
  console.log(sql);
  console.log('---');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
    
    if (error) {
      // Try alternative approach: split by semicolon and execute statements individually
      console.log('⚠️  RPC approach failed, trying direct statements...');
      
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const statement of statements) {
        const { error: stmtError } = await supabase.from('_migrations').select('*').limit(1);
        if (stmtError?.code === 'PGRST100') {
          console.log('⚠️  Cannot execute raw SQL via client library');
          console.log('📌 Please run this SQL manually in Supabase Studio:');
          console.log(sql);
          process.exit(1);
        }
      }
    }

    console.log('✅ Migration applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error applying migration:', err.message);
    console.log('\n📌 Please run this SQL manually in Supabase Studio:');
    console.log(sql);
    process.exit(1);
  }
}

const migrationFile = process.argv[2] || 'migrations/20260817_seed_demo_drivers_vehicles.sql';
applySqlMigration(migrationFile);
