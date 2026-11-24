import "server-only";

const HEADERS = { "User-Agent": "AirshipExpressFleet/1.0 (contact: support@airship-express.com)", Accept: "application/json" };
const CACHE_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_MS = 1000;
const PROVIDER_COOLDOWN_MS = 30 * 1000;
const PHILIPPINES = { minLat: 5, maxLat: 20, minLng: 119, maxLng: 129 };
const searchCache = new Map<string, { data: unknown; expiresAt: number }>();
let lastSearchAt = 0;
let cooldownUntil = 0;

async function fetchGeocode(url: string) {
  return fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(8000) });
}

export function activateProviderCooldown() {
  cooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
}

export function getSearchCache(key: string) {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return entry.data;
}

export function canSearch() {
  const now = Date.now();
  if (cooldownUntil > now || now - lastSearchAt < RATE_LIMIT_MS) return false;
  lastSearchAt = now;
  return true;
}

export function cacheSearch(key: string, data: unknown) {
  searchCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function isInPhilippines(lat: number, lng: number) {
  return lat >= PHILIPPINES.minLat && lat <= PHILIPPINES.maxLat && lng >= PHILIPPINES.minLng && lng <= PHILIPPINES.maxLng;
}

export async function searchGeocode(query: string) {
  const primary = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${query}, Philippines`)}&addressdetails=1&limit=6`;
  const fallbacks = [
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`,
    `https://geocode.maps.co/search?q=${encodeURIComponent(query)}&limit=6`,
  ];
  let response = await fetchGeocode(primary);
  if (!response.ok) {
    if (response.status === 429) {
      activateProviderCooldown();
      return [];
    }
    for (const fallback of fallbacks) {
      response = await fetchGeocode(fallback);
      if (response.ok) break;
      if (response.status === 429) {
        activateProviderCooldown();
        return [];
      }
    }
  }
  if (!response.ok) return [];
  const payload = await response.json();
  if (!Array.isArray(payload)) return payload || [];
  return payload.filter((item) => isInPhilippines(Number(item.lat), Number(item.lon)));
}

export async function reverseGeocode(lat: string, lon: string) {
  const urls = [
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`,
    `https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
    `https://geocode.maps.co/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
  ];
  let lastResponse: Response | null = null;
  for (const url of urls) {
    const response = await fetchGeocode(url);
    lastResponse = response;
    if (response.ok) return response.json();
    if (response.status === 429) activateProviderCooldown();
  }
  throw new Error(`Reverse geocode service failed${lastResponse ? ` with HTTP ${lastResponse.status}` : ""}`);
}