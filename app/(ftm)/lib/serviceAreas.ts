export const PERSISTED_SERVICE_AREA_KEY = "vrds-bulk-service-area";
export const ALL_SERVICE_AREA_SENTINEL = "__ALL_SERVICE_CITIES__";

export const SERVICE_AREA_CITIES = [
  // Metro Manila and NCR adjacent cities
  "Caloocan",
  "Quezon City",
  "Manila",
  "Makati",
  "Pasig",
  "Mandaluyong",
  "San Juan",
  "Marikina",
  "Pasay",
  "Taguig",
  "Parañaque",
  "Valenzuela",
  "Antipolo City",
  "Las Piñas",
  "Muntinlupa",
  "Bacoor",
  "Cavite City",
  "Dasmariñas",
  "Imus",
  "General Trias",
  "Trece Martires",
  "Tagaytay",
  // Major provincial hubs
  "Baguio City",
  "Bacolod City",
  "Batangas City",
  "Cagayan de Oro",
  "Cebu City",
  "Davao City",
  "General Santos City",
  "Iloilo City",
  "La Trinidad",
  "Lipa",
  "San Pablo City",
  "Santa Rosa",
  "Tarlac City",
  "Zamboanga City",
  "Angeles City",
  "San Fernando",
  "Bataan",
  "Puerto Princesa",
  "Butuan City",
  "Iligan City",
  "Dumaguete City",
  "Cabanatuan City",
  "Naga City",
  "Legazpi City",
  "Sorsogon City",
  "Tuguegarao City",
] as const;

type ServiceAreaCity = (typeof SERVICE_AREA_CITIES)[number];

export const SERVICE_CITY_BOUNDS: Record<ServiceAreaCity, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  // Metro Manila and NCR-adjacent cities
  Caloocan: { minLat: 14.59, maxLat: 14.76, minLng: 120.92, maxLng: 121.10 },
  "Quezon City": { minLat: 14.52, maxLat: 14.74, minLng: 121.00, maxLng: 121.09 },
  Manila: { minLat: 14.52, maxLat: 14.66, minLng: 120.94, maxLng: 121.04 },
  Makati: { minLat: 14.49, maxLat: 14.59, minLng: 121.00, maxLng: 121.06 },
  Pasig: { minLat: 14.52, maxLat: 14.62, minLng: 121.04, maxLng: 121.11 },
  Mandaluyong: { minLat: 14.54, maxLat: 14.61, minLng: 121.02, maxLng: 121.06 },
  "San Juan": { minLat: 14.58, maxLat: 14.63, minLng: 121.02, maxLng: 121.05 },
  Marikina: { minLat: 14.62, maxLat: 14.68, minLng: 121.08, maxLng: 121.12 },
  Pasay: { minLat: 14.50, maxLat: 14.55, minLng: 120.98, maxLng: 121.01 },
  Taguig: { minLat: 14.49, maxLat: 14.56, minLng: 121.03, maxLng: 121.08 },
  "Parañaque": { minLat: 14.45, maxLat: 14.52, minLng: 120.99, maxLng: 121.04 },
  Valenzuela: { minLat: 14.67, maxLat: 14.74, minLng: 120.96, maxLng: 121.02 },
  "Antipolo City": { minLat: 14.55, maxLat: 14.65, minLng: 121.15, maxLng: 121.25 },
  "Las Piñas": { minLat: 14.42, maxLat: 14.50, minLng: 120.97, maxLng: 121.04 },
  Muntinlupa: { minLat: 14.35, maxLat: 14.46, minLng: 121.00, maxLng: 121.08 },
  Bacoor: { minLat: 14.42, maxLat: 14.52, minLng: 120.89, maxLng: 121.00 },
  "Cavite City": { minLat: 14.46, maxLat: 14.51, minLng: 120.88, maxLng: 120.91 },
  Dasmariñas: { minLat: 14.30, maxLat: 14.35, minLng: 120.91, maxLng: 120.98 },
  Imus: { minLat: 14.39, maxLat: 14.45, minLng: 120.92, maxLng: 120.99 },
  "General Trias": { minLat: 14.34, maxLat: 14.42, minLng: 120.86, maxLng: 120.92 },
  "Trece Martires": { minLat: 14.25, maxLat: 14.32, minLng: 120.85, maxLng: 120.90 },
  Tagaytay: { minLat: 14.08, maxLat: 14.15, minLng: 120.90, maxLng: 120.99 },
  "Baguio City": { minLat: 16.38, maxLat: 16.45, minLng: 120.57, maxLng: 120.61 },
  "Batangas City": { minLat: 13.72, maxLat: 13.80, minLng: 121.04, maxLng: 121.09 },
  "Bacolod City": { minLat: 10.38, maxLat: 10.43, minLng: 122.93, maxLng: 123.03 },
  "Cagayan de Oro": { minLat: 8.40, maxLat: 8.55, minLng: 124.60, maxLng: 124.75 },
  "Cebu City": { minLat: 10.25, maxLat: 10.40, minLng: 123.80, maxLng: 123.95 },
  "Davao City": { minLat: 7.00, maxLat: 7.20, minLng: 125.55, maxLng: 125.75 },
  "General Santos City": { minLat: 6.10, maxLat: 6.15, minLng: 125.15, maxLng: 125.20 },
  "Iloilo City": { minLat: 10.69, maxLat: 10.74, minLng: 122.54, maxLng: 122.59 },
  "La Trinidad": { minLat: 16.38, maxLat: 16.45, minLng: 120.83, maxLng: 120.95 },
  Lipa: { minLat: 13.90, maxLat: 13.98, minLng: 121.13, maxLng: 121.18 },
  "San Pablo City": { minLat: 14.05, maxLat: 14.10, minLng: 121.31, maxLng: 121.35 },
  "Santa Rosa": { minLat: 14.29, maxLat: 14.33, minLng: 121.08, maxLng: 121.13 },
  "Tarlac City": { minLat: 15.45, maxLat: 15.55, minLng: 120.56, maxLng: 120.64 },
  "Zamboanga City": { minLat: 6.88, maxLat: 6.98, minLng: 122.06, maxLng: 122.16 },
  "Angeles City": { minLat: 15.10, maxLat: 15.20, minLng: 120.55, maxLng: 120.65 },
  "San Fernando": { minLat: 15.00, maxLat: 15.08, minLng: 120.66, maxLng: 120.72 },
  Bataan: { minLat: 14.30, maxLat: 14.42, minLng: 120.50, maxLng: 120.65 },
  "Puerto Princesa": { minLat: 9.70, maxLat: 9.78, minLng: 118.70, maxLng: 118.77 },
  "Butuan City": { minLat: 8.90, maxLat: 9.00, minLng: 125.50, maxLng: 125.60 },
  "Iligan City": { minLat: 8.20, maxLat: 8.25, minLng: 124.22, maxLng: 124.28 },
  "Dumaguete City": { minLat: 9.28, maxLat: 9.34, minLng: 123.28, maxLng: 123.34 },
  "Cabanatuan City": { minLat: 15.45, maxLat: 15.54, minLng: 120.94, maxLng: 121.00 },
  "Naga City": { minLat: 13.58, maxLat: 13.67, minLng: 123.18, maxLng: 123.22 },
  "Legazpi City": { minLat: 13.12, maxLat: 13.16, minLng: 123.72, maxLng: 123.77 },
  "Sorsogon City": { minLat: 12.95, maxLat: 13.02, minLng: 123.97, maxLng: 124.04 },
  "Tuguegarao City": { minLat: 17.58, maxLat: 17.66, minLng: 121.70, maxLng: 121.75 },
};

export function inferCityFromCoordinates(lat?: number | null, lng?: number | null): ServiceAreaCity | undefined {
  const safeLat = typeof lat === "number" ? lat : Number.NaN;
  const safeLng = typeof lng === "number" ? lng : Number.NaN;

  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return undefined;

  for (const [city, bounds] of Object.entries(SERVICE_CITY_BOUNDS) as [ServiceAreaCity, typeof SERVICE_CITY_BOUNDS[ServiceAreaCity]][]) {
    if (safeLat >= bounds.minLat && safeLat <= bounds.maxLat && safeLng >= bounds.minLng && safeLng <= bounds.maxLng) {
      return city;
    }
  }
  return undefined;
}

export function normalizeCityName(value: string | null | undefined) {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Common city name aliases and variations (e.g., "Cebu" → "Cebu City", "Taguig" → "Taguig")
const CITY_ALIASES: Record<string, ServiceAreaCity> = {
  cebu: "Cebu City" as ServiceAreaCity,
  "cebu city": "Cebu City" as ServiceAreaCity,
  "las pinas": "Las Piñas" as ServiceAreaCity,
  "las piñas": "Las Piñas" as ServiceAreaCity,
  "muntinlupa city": "Muntinlupa" as ServiceAreaCity,
  "baguio": "Baguio City" as ServiceAreaCity,
  "baguio city": "Baguio City" as ServiceAreaCity,
  "batangas": "Batangas City" as ServiceAreaCity,
  "batangas city": "Batangas City" as ServiceAreaCity,
  "general trias": "General Trias" as ServiceAreaCity,
  "gen trias": "General Trias" as ServiceAreaCity,
  "tagaytay city": "Tagaytay" as ServiceAreaCity,
  benguet: "La Trinidad" as ServiceAreaCity,
  "la trinidad": "La Trinidad" as ServiceAreaCity,
  caloocan: "Caloocan" as ServiceAreaCity,
  "quezon city": "Quezon City" as ServiceAreaCity,
  manila: "Manila" as ServiceAreaCity,
  makati: "Makati" as ServiceAreaCity,
  pasig: "Pasig" as ServiceAreaCity,
  mandaluyong: "Mandaluyong" as ServiceAreaCity,
  "san juan": "San Juan" as ServiceAreaCity,
  marikina: "Marikina" as ServiceAreaCity,
  pasay: "Pasay" as ServiceAreaCity,
  taguig: "Taguig" as ServiceAreaCity,
  paraoque: "Parañaque" as ServiceAreaCity,
  valenzuela: "Valenzuela" as ServiceAreaCity,
  antipolo: "Antipolo City" as ServiceAreaCity,
  bacoor: "Bacoor" as ServiceAreaCity,
  dasmarinas: "Dasmariñas" as ServiceAreaCity,
  "dasmariñas": "Dasmariñas" as ServiceAreaCity,
  "imus city": "Imus" as ServiceAreaCity,
  "cavite city": "Cavite City" as ServiceAreaCity,
  "lipa city": "Lipa" as ServiceAreaCity,
  "san pablo": "San Pablo City" as ServiceAreaCity,
  "santa rosa": "Santa Rosa" as ServiceAreaCity,
  "angeles": "Angeles City" as ServiceAreaCity,
  "angeles city": "Angeles City" as ServiceAreaCity,
  "san fernando": "San Fernando" as ServiceAreaCity,
  "tarlac": "Tarlac City" as ServiceAreaCity,
  "tarlac city": "Tarlac City" as ServiceAreaCity,
};

// Compute simple centroid coordinates per city for map markers
export const SERVICE_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  Object.entries(SERVICE_CITY_BOUNDS).map(([city, bounds]) => [city, { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 }])
) as Record<string, { lat: number; lng: number }>;

export function resolveCityFromAddress(address: string) {
  if (!address) return undefined;
  const haystack = normalizeCityName(address).toLowerCase();

  for (const city of SERVICE_AREA_CITIES) {
    const cityKey = normalizeCityName(city).toLowerCase();
    if (haystack.includes(cityKey)) return city;
  }

  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    if (haystack.includes(alias.toLowerCase())) return city;
  }

  return undefined;
}

export function getCityCoordinate(cityName: string) {
  if (!cityName) return null;

  const normalized = normalizeCityName(cityName).toLowerCase();

  if (SERVICE_CITY_COORDINATES[cityName]) {
    return SERVICE_CITY_COORDINATES[cityName];
  }

  const aliased = CITY_ALIASES[normalized] ?? Object.entries(CITY_ALIASES).find(([key]) => key === normalized || normalized.includes(key) || key.includes(normalized))?.[1];
  if (aliased && SERVICE_CITY_COORDINATES[aliased]) {
    return SERVICE_CITY_COORDINATES[aliased];
  }

  for (const [city, coords] of Object.entries(SERVICE_CITY_COORDINATES)) {
    const cityKey = normalizeCityName(city).toLowerCase();
    if (cityKey === normalized || cityKey.includes(normalized) || normalized.includes(cityKey)) {
      return coords;
    }
  }

  return null;
}

export type { ServiceAreaCity };
