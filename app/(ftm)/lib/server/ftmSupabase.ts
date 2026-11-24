import "server-only";
import { createClient } from "@supabase/supabase-js";

function getSupabaseUrl() {
  const url =
    process.env.FTM_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_FTM_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC__FTM_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) throw new Error("FTM Supabase URL is not configured.");
  return url;
}

export function createFtmAuthClient() {
  const key =
    process.env.FTM_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) throw new Error("FTM Supabase anon key is not configured.");

  return createClient(getSupabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function createFtmServiceClient() {
  const key = process.env.FTM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;

  return createClient(getSupabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function createFtmParcelClient() {
  const key =
    process.env.FTM_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.FTM_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC__FTM_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = getSupabaseUrl();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function createFtmHrServiceClient() {
  const url = process.env.HR_SUPABASE_URL || process.env.NEXT_PUBLIC_HR_SUPABASE_URL;
  const key = process.env.HR_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
