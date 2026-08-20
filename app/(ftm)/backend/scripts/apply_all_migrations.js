#!/usr/bin/env node
/**
 * Apply all pending Supabase migrations to route_plans table
 * Usage: node apply_all_migrations.js
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function readSql(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

async function applySqlViaSplit(sql) {
  // Split SQL into individual statements (split on semicolons outside of strings)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let skipCount = 0;
  const errors = [];

  for (const statement of statements) {
    try {
      // Try to execute via a simple select query to test connection
      // For DDL statements, we'll need to use a different approach
      const { error } = await supabase.rpc('sql_exec', { sql: statement }).catch(e => ({ error: e }));
      
      if (error) {
        // If sql_exec doesn't exist, this is expected
        if (error.message && error.message.includes('does not exist')) {
          console.log('⚠️  sql_exec RPC not available. Migrations must be applied manually.');
          return { success: false, message: 'RPC not available' };
        }
        errors.push({ statement: statement.substring(0, 50), error: error.message });
      } else {
        successCount++;
      }
    } catch (e) {
      errors.push({ statement: statement.substring(0, 50), error: e.message });
    }
  }

  return { successCount, skipCount, errors };
}

async function main() {
  console.log('🚀 Supabase Route Plans Migration Runner');
  console.log(`📍 Project: ${SUPABASE_URL}`);
  console.log('');

  try {
    // Check connection
    const { data, error } = await supabase.from('route_plans').select('COUNT(*)').limit(1);
    if (error) {
      console.log('⚠️  Current status: route_plans table has issues');
      console.log(`   Error: ${error.message}`);
      console.log('');
      console.log('📋 You must run these migrations manually in Supabase SQL Editor:');
      console.log('');
      console.log('1️⃣  Go to https://app.supabase.com → your project → SQL Editor');
      console.log('2️⃣  Click "New Query"');
      console.log('3️⃣  Copy and paste the SQL below:');
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('WORKFLOW MIGRATION (20260814_route_plans_workflow_migration.sql)');
      console.log('═══════════════════════════════════════════════════════════════');
      const workflowSql = await readSql(path.resolve(__dirname, '../migrations/20260814_route_plans_workflow_migration.sql'));
      console.log(workflowSql);
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('RLS POLICIES MIGRATION (20260814_enable_rls_service_role_access.sql)');
      console.log('═══════════════════════════════════════════════════════════════');
      const rlsSql = await readSql(path.resolve(__dirname, '../migrations/20260814_enable_rls_service_role_access.sql'));
      console.log(rlsSql);
      console.log('');
      console.log('4️⃣  Click "Run" for each SQL block');
      console.log('5️⃣  Run this script again to verify');
      process.exit(1);
    }

    console.log('✅ Route plans table is accessible');
    console.log('');

    // Verify the table has the workflow columns
    const { data: sampleRow } = await supabase.from('route_plans').select('*').limit(1);
    if (sampleRow && sampleRow.length > 0) {
      const row = sampleRow[0];
      const hasWorkflowColumns = row.distance_km !== undefined || row.route_geojson !== undefined;
      if (hasWorkflowColumns) {
        console.log('✅ Workflow schema is already applied');
      } else {
        console.log('⚠️  Workflow columns not found. Run the workflow migration in SQL Editor.');
      }
    }

    console.log('');
    console.log('To complete the setup, visit: https://app.supabase.com');
    console.log('And run the migrations shown above in the SQL Editor.');
  } catch (e) {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
  }
}

main();
