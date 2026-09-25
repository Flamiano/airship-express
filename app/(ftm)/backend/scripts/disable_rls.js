#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
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
    const { error } = await supabase.rpc("sql", { query: sql });
    if (error) throw error;
    console.log("RLS policies disabled successfully.");
  } catch (error) {
    console.error("Failed to disable RLS:", error.message || error);
    process.exitCode = 1;
  }
}

disableRLS();
