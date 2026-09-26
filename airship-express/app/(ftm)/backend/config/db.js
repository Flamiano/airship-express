const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let supabase = null;
let serviceSupabase = null;
let anonSupabase = null;
let hrSupabase = null;
let authSupabase = null;

const initSupabase = () => {
  const supabaseUrl = process.env.FTM_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.FTM_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || (!serviceKey && !anonKey)) {
    console.warn('Supabase env vars not configured. Falling back to in-memory routes.');
    return null;
  }

  if (serviceKey) {
    console.log('Initializing Supabase client with SERVICE_ROLE key');
    serviceSupabase = createClient(supabaseUrl, serviceKey);
  }

  if (anonKey) {
    console.log('Initializing Supabase client with ANON key');
    anonSupabase = createClient(supabaseUrl, anonKey);
  }

  supabase = serviceSupabase || anonSupabase;

  const hrUrl = process.env.HR_SUPABASE_URL || process.env.NEXT_PUBLIC_HR_SUPABASE_URL;
  const hrServiceKey = process.env.HR_SUPABASE_SERVICE_ROLE_KEY;
  if (hrUrl && hrServiceKey) {
    hrSupabase = createClient(hrUrl, hrServiceKey);
    console.log('HR Supabase client initialized');
  } else {
    console.warn('HR Supabase env vars not configured. HR bridge endpoints will return 503.');
  }

  authSupabase = process.env.FTM_AUTH_PROVIDER === 'hr' ? hrSupabase : supabase;
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase client initialized');
  return supabase;
};

const getSupabase = () => supabase;
const getServiceSupabase = () => serviceSupabase || supabase;
const getHrSupabase = () => hrSupabase;
const getAuthSupabase = () => authSupabase || supabase;

// Parcels may be hosted in a separate Supabase project. Provide a helper
// to return a parcels-specific client when PARCELS_SUPABASE_* env vars are
// present; otherwise fall back to the main supabase client.
const getParcelsSupabase = () => {
  const parcelsUrl = process.env.FTM_PARCELS_SUPABASE_URL || process.env.PARCELS_SUPABASE_URL || process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_URL || process.env.NEXT_PUBLIC_PARCEL_SUPABASE_URL || process.env.NEXT_PUBLIC__FTM_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.FTM_SUPABASE_URL || process.env.SUPABASE_URL;
  const parcelsKey = process.env.FTM_PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.FTM_PARCELS_SUPABASE_ANON_KEY || process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY || process.env.PARCELS_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_PARCEL_SUPABASE_ANON_KEY || process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.FTM_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (parcelsUrl && parcelsKey) {
    try {
      return createClient(parcelsUrl, parcelsKey);
    } catch (e) {
      console.warn('Failed to init parcels supabase client:', e?.message || e);
      return supabase;
    }
  }
  return supabase;
};

module.exports = { initSupabase, getSupabase, getServiceSupabase, getHrSupabase, getAuthSupabase, getParcelsSupabase };