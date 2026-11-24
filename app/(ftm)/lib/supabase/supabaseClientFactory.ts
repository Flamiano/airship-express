import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseClientCache = typeof globalThis & {
  __airshipSupabaseClients?: Map<string, SupabaseClient>;
};

export function getCachedSupabaseClient(url: string, key: string): SupabaseClient {
  const globalScope = globalThis as SupabaseClientCache;
  const cache = globalScope.__airshipSupabaseClients ?? new Map<string, SupabaseClient>();
  globalScope.__airshipSupabaseClients = cache;

  const cacheKey = `${url}:passkey-enabled`;
  const existingClient = cache.get(cacheKey);
  if (existingClient) return existingClient;

  const client = createClient(url, key, {
    auth: {
      storageKey: `airship-express-auth-${url}`,
      experimental: { passkey: true },
    },
  });
  cache.set(cacheKey, client);
  return client;
}