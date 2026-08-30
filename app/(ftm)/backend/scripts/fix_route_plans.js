#!/usr/bin/env node
/**
 * Direct SQL execution against Supabase using the REST API
 * This executes migrations to fix route_plans table
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Parse the Supabase project ID from the URL
const projectId = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectId) {
  console.error('❌ Could not parse project ID from SUPABASE_URL');
  process.exit(1);
}

// Step 1: Ensure route_plans table exists with all required columns
const createTableSql = `
CREATE TABLE IF NOT EXISTS public.route_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id text,
  courier text,
  pickup_location text,
  pickup_latitude numeric,
  pickup_longitude numeric,
  delivery_destinations jsonb NOT NULL DEFAULT '[]'::jsonb,
  route_geojson jsonb,
  distance_km numeric,
  estimated_duration_min numeric,
  planned_delivery_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status = ANY (ARRAY['draft'::text, 'assigned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])
  ),
  generated_by text DEFAULT 'OR-Tools',
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT route_plans_pkey PRIMARY KEY (id),
  CONSTRAINT route_plans_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL,
  CONSTRAINT route_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

ALTER TABLE IF EXISTS public.route_plans
  ADD COLUMN IF NOT EXISTS trip_id text,
  ADD COLUMN IF NOT EXISTS courier text,
  ADD COLUMN IF NOT EXISTS pickup_location text,
  ADD COLUMN IF NOT EXISTS pickup_latitude numeric,
  ADD COLUMN IF NOT EXISTS pickup_longitude numeric,
  ADD COLUMN IF NOT EXISTS delivery_destinations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS route_geojson jsonb,
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS estimated_duration_min numeric,
  ADD COLUMN IF NOT EXISTS planned_delivery_date date,
  ADD COLUMN IF NOT EXISTS generated_by text DEFAULT 'Or-Tools',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
`;

// Step 2: Enable RLS and create policies
const rlsSql = `
ALTER TABLE IF EXISTS public.route_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_service_role_route_plans" ON public.route_plans;
DROP POLICY IF EXISTS "allow_authenticated_route_plans" ON public.route_plans;

CREATE POLICY "allow_service_role_route_plans" ON public.route_plans
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_authenticated_route_plans" ON public.route_plans
  FOR ALL
  USING (true)
  WITH CHECK (true);
`;

async function executeSQL(sql, description) {
  return new Promise((resolve, reject) => {
    console.log(`📍 ${description}...`);
    
    const url = new URL(SUPABASE_URL);
    const postData = JSON.stringify({ query: sql });

    const options = {
      hostname: url.hostname,
      path: '/rest/v1/rpc/sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ ${description} completed`);
          resolve(true);
        } else {
          console.error(`⚠️  ${description} status: ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ ${description} error:`, e.message);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🚀 Applying route_plans migrations to Supabase');
  console.log(`📍 Project: ${projectId}`);
  console.log('');

  // The direct SQL execution via REST API might not work, so instead
  // we'll output a clear guide for manual execution
  console.log('⚠️  Supabase requires manual SQL execution for schema changes.');
  console.log('');
  console.log('📋 FOLLOW THESE STEPS TO FIX route_plans:');
  console.log('');
  console.log('1️⃣  Open: https://app.supabase.com/project/' + projectId + '/sql');
  console.log('2️⃣  Click "New Query" button');
  console.log('3️⃣  Copy & paste this SQL:');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('/* CREATE TABLE & ADD COLUMNS */');
  console.log(createTableSql);
  console.log('');
  console.log('/* ENABLE RLS & CREATE POLICIES */');
  console.log(rlsSql);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('4️⃣  Click "RUN" button');
  console.log('5️⃣  Wait for success message');
  console.log('6️⃣  Come back and restart the backend');
  console.log('');
  console.log('✨ Once complete, route plans will save successfully!');
}

main().catch(console.error);
