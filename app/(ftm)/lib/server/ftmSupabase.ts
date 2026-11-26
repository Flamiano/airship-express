import "server-only";
import { createClient } from "@supabase/supabase-js";

function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "") || undefined;
}

function getSupabaseUrl() {
  const url =
    cleanEnv(process.env.FTM_SUPABASE_URL) ||
    cleanEnv(process.env.SUPABASE_URL) ||
    cleanEnv(process.env.NEXT_PUBLIC_FTM_SUPABASE_URL) ||
    cleanEnv(process.env.NEXT_PUBLIC__FTM_SUPABASE_URL) ||
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (!url) throw new Error("FTM Supabase URL is not configured.");
  return url;
}

export function createFtmAuthClient() {
  const key =
    cleanEnv(process.env.FTM_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.NEXT_PUBLIC_FTM_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

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
  const key =
    cleanEnv(process.env.FTM_SUPABASE_SERVICE_ROLE_KEY) ||
    cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
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
  const parcelUrl =
    cleanEnv(process.env.FTM_PARCELS_SUPABASE_URL) ||
    cleanEnv(process.env.PARCELS_SUPABASE_URL);
  const url = parcelUrl || getSupabaseUrl();
  const parcelKey =
    cleanEnv(process.env.FTM_PARCELS_SUPABASE_SERVICE_ROLE_KEY) ||
    cleanEnv(process.env.PARCELS_SUPABASE_SERVICE_ROLE_KEY) ||
    cleanEnv(process.env.FTM_PARCELS_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.PARCELS_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.NEXT_PUBLIC_FTM_PARCEL_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.NEXT_PUBLIC_PARCEL_SUPABASE_ANON_KEY);
  const coreKey =
    cleanEnv(process.env.FTM_SUPABASE_SERVICE_ROLE_KEY) ||
    cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const key = parcelUrl ? parcelKey : parcelKey || coreKey;
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
  const url =
    cleanEnv(process.env.HR_SUPABASE_URL) ||
    cleanEnv(process.env.NEXT_PUBLIC_HR_SUPABASE_URL);
  const key = cleanEnv(process.env.HR_SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}