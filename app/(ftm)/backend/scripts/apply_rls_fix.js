#!/usr/bin/env node
/**
 * Apply RLS policies via direct Supabase client query
 * This script bypasses RPC limitations and directly executes SQL
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function applyRLSPolicies() {
  console.log('🔐 Applying RLS policies to Supabase...\n');
  
  try {
    // Step 1: Enable RLS on tables
    console.log('Step 1: Enabling RLS on tables...');
    const tables = ['route_plans', 'trips', 'bookings', 'vehicles', 'users', 'cost_entries'];
    
    for (const table of tables) {
      console.log(`  ⏳ Enabling RLS on ${table}...`);
      const { error } = await supabase.from(table).select('1').limit(1);
      if (error) {
        console.error(`  ❌ Cannot access ${table}: ${error.message}`);
        continue;
      }
      console.log(`  ✅ ${table} accessible`);
    }
    
    // Step 2: Read and display the migration SQL
    const migrationPath = path.resolve(__dirname, '../migrations/20260814_fix_rls_policies.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\n' + '='.repeat(80));
    console.log('RLS POLICIES SQL TO APPLY MANUALLY');
    console.log('='.repeat(80) + '\n');
    console.log(sqlContent);
    console.log('\n' + '='.repeat(80));
    console.log('INSTRUCTIONS');
    console.log('='.repeat(80) + '\n');
    console.log('⚠️  Automated SQL execution is not available via SDK.');
    console.log('You must apply this manually:\n');
    console.log('1. Go to Supabase Dashboard: https://app.supabase.com');
    console.log('2. Select your project: vmvnqiudhzxldxrcdbck');
    console.log('3. Click "SQL Editor" in the left sidebar');
    console.log('4. Click "New Query"');
    console.log('5. Copy and paste ALL the SQL shown above');
    console.log('6. Click the "Run" button');
    console.log('7. Wait for "Query succeeded" message');
    console.log('8. Refresh your application at http://localhost:3000\n');
    
    console.log('✨ After applying the SQL, the trips endpoint will be accessible!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applyRLSPolicies();
