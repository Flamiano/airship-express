import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Next.js supplies its environment. Standalone Node callers can also use the
// FTM-owned local file; existing process values always take precedence.
const ftmEnvPath = path.resolve(__dirname, '../../../../.env.local');
if (fs.existsSync(ftmEnvPath)) process.loadEnvFile(ftmEnvPath);

let supabase = null;
let serviceSupabase = null;
let anonSupabase = null;
let hrSupabase = null;
let authSupabase = null;

const hasServiceRoleKey = () => Boolean(process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

const initSupabase = () => {
  const supabaseUrl = process.env.FTM_SUPABASE_URL || process.env.NEXT_PUBLIC_FTM_SUPABASE_URL || process.env.NEXT_PUBLIC__FTM_SUPABASE_URL || process.env.SUPABASE_URL;
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

  authSupabase = supabase;
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase client initialized');
  return supabase;
};

const getSupabase = () => supabase;
const getServiceSupabase = () => (hasServiceRoleKey() ? (serviceSupabase || null) : null);
const getHrSupabase = () => hrSupabase;
const getAuthSupabase = () => authSupabase || supabase;

const getParcelsSupabase = () => supabase;

export { initSupabase, getSupabase, getServiceSupabase, getHrSupabase, getAuthSupabase, getParcelsSupabase };
