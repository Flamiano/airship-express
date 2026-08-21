#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

console.log('🔑 Using Supabase project:', supabaseUrl);
console.log('📝 Disabling RLS on tables...\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function disableRLS() {
  try {
    const tables = ['route_plans', 'bookings', 'trips', 'vehicles'];
    
    for (const table of tables) {
      console.log(`⏳ Disabling RLS on ${table}...`);
      
      const { data, error } = await supabase.rpc('execute_sql', {
        sql: `ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY;`
      });
      
      if (error) {
        if (error.message.includes('could not find the function')) {
          console.log(`   ⚠️  Cannot execute SQL via RPC (function not available)`);
          console.log(`   📋 Run this SQL manually in Supabase SQL Editor:\n`);
          console.log(`      ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY;\n`);
        } else {
          console.log(`   ❌ Error: ${error.message}`);
        }
      } else {
        console.log(`   ✅ RLS disabled on ${table}`);
      }
    }
    
    console.log('\n✨ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

disableRLS();
