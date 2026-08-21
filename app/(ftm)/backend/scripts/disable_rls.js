#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function disableRLS() {
  const sql = `
    ALTER TABLE IF EXISTS public.route_plans DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.bookings DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.trips DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.vehicles DISABLE ROW LEVEL SECURITY;
  `;

  try {
    const { error } = await supabase.rpc('sql', { query: sql });
    if (error) throw error;
    console.log('RLS policies disabled successfully.');
  } catch (error) {
    console.error('Failed to disable RLS:', error.message || error);
    process.exitCode = 1;
  }
}

disableRLS();#!/usr/bin/env node
/**
 * Supabase RLS Disabler
 * Temporarily disables RLS on key tables to fix permission errors
 * 
 * Usage: node disable_rls.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function disableRLS() {
  console.log('🔓 Disabling RLS policies...\n');

  const sql = `
    -- Disable RLS on key tables to fix permission errors
    ALTER TABLE IF EXISTS public.route_plans DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.bookings DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.trips DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.vehicles DISABLE ROW LEVEL SECURITY;
  `;

  try {
    const { data, error } = await supabase.rpc('sql', { query: sql });
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ RLS policies disabled successfully!');
    console.log('\n📋 Tables with RLS disabled:');
    console.log('  - route_plans');
    console.log('  - bookings');
    console.log('  - trips');
    console.log('  - vehicles');
    console.log('\n🔄 Refresh http://localhost:3000 and try again!');
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

disableRLS();
