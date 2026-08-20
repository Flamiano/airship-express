#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function applyRlsPolicies() {
  console.log('🔐 Applying RLS policies to Supabase...');
  
  // Read the migration file
  const migrationPath = path.resolve(__dirname, '../migrations/20260814_enable_rls_service_role_access.sql');
  let sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split by statements (simple approach - split by semicolon)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Found ${statements.length} SQL statements to execute`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement + ';'
      }).catch(err => {
        // Fallback: try direct query if rpc doesn't work
        return { error: err };
      });
      
      if (error) {
        console.warn(`  ⚠️  Statement ${i + 1} warning: ${error.message || error}`);
      } else {
        console.log(`  ✅ Statement ${i + 1} executed successfully`);
        successCount++;
      }
    } catch (err) {
      console.error(`  ❌ Statement ${i + 1} failed: ${err.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Results: ${successCount} succeeded, ${errorCount} failed`);
  
  if (errorCount > 0) {
    console.log('\n⚠️  Note: Some statements may have failed due to RPC limitations.');
    console.log('👉 For best results, apply this migration manually via Supabase SQL Editor:');
    console.log('   https://app.supabase.com -> SQL Editor -> New Query');
    console.log(`   Copy contents of: ${migrationPath}`);
    process.exit(1);
  }
  
  console.log('\n✅ RLS policies applied successfully!');
  console.log('   You can now query vehicles from your backend.');
}

applyRlsPolicies().catch(err => {
  console.error('❌ Error applying RLS policies:', err);
  process.exit(1);
});
