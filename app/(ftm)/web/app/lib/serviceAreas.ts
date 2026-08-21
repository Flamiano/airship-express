export const PERSISTED_SERVICE_AREA_KEY = "vrds-bulk-service-area";
export const ALL_SERVICE_AREA_SENTINEL = "__ALL_SERVICE_CITIES__";

export const SERVICE_AREA_CITIES = [
  // Metro Manila Cities
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
  // Other Major Philippine Cities
  "Cebu City",
  "Davao City",
  "Manila City",
  "Cagayan de Oro",
  "Bacolod City",
  "Iloilo City",
  "La Trinidad", // Benguet capital
  "General Santos City",
  "Zamboanga City",
  "Antipolo City",
] as const;

type ServiceAreaCity = (typeof SERVICE_AREA_CITIES)[number];

export const SERVICE_CITY_BOUNDS: Record<ServiceAreaCity, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  // Metro Manila Cities
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
  // Other Major Philippine Cities (wider bounds)
  "Cebu City": { minLat: 10.25, maxLat: 10.40, minLng: 123.80, maxLng: 123.95 },
  "Davao City": { minLat: 7.00, maxLat: 7.20, minLng: 125.55, maxLng: 125.75 },
  "Manila City": { minLat: 14.52, maxLat: 14.66, minLng: 120.94, maxLng: 121.04 },
  "Cagayan de Oro": { minLat: 8.40, maxLat: 8.55, minLng: 124.60, maxLng: 124.75 },
  "Bacolod City": { minLat: 10.38, maxLat: 10.43, minLng: 122.93, maxLng: 123.03 },
  "Iloilo City": { minLat: 10.69, maxLat: 10.74, minLng: 122.54, maxLng: 122.59 },
  "La Trinidad": { minLat: 16.38, maxLat: 16.45, minLng: 120.83, maxLng: 120.95 },
  "General Santos City": { minLat: 6.10, maxLat: 6.15, minLng: 125.15, maxLng: 125.20 },
  "Zamboanga City": { minLat: 6.88, maxLat: 6.98, minLng: 122.06, maxLng: 122.16 },
  "Antipolo City": { minLat: 14.55, maxLat: 14.65, minLng: 121.15, maxLng: 121.25 },
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

// Common city name aliases and variations (e.g., "Cebu" → "Cebu City", "Taguig" → "Taguig")
const CITY_ALIASES: Record<string, ServiceAreaCity> = {
  // Cebu variations
  cebu: "Cebu City" as ServiceAreaCity,
  "cebu city": "Cebu City" as ServiceAreaCity,
  // Las Piñas (note: normalize special characters)
  "las pinas": "Parañaque" as ServiceAreaCity, // Las Piñas is adjacent to Parañaque
  "las piñas": "Parañaque" as ServiceAreaCity,
  // Benguet variations
  benguet: "La Trinidad" as ServiceAreaCity,
  "la trinidad": "La Trinidad" as ServiceAreaCity,
  // City suffixes for Metro Manila
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
};

// Compute simple centroid coordinates per city for map markers
export const SERVICE_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  Object.entries(SERVICE_CITY_BOUNDS).map(([city, bounds]) => [city, { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 }])
) as Record<string, { lat: number; lng: number }>;

export function getCityCoordinate(cityName: string) {
  if (!cityName) return null;
  
  // Normalize the input: remove common suffixes and lowercase
  const normalized = cityName
    .toLowerCase()
    .replace(/\s+city\s*$/i, "") // Remove "City" suffix
    .replace(/\s+municipality\s*$/i, "") // Remove "Municipality" suffix
    .replace(/[ñ]/g, "n"); // Normalize special characters (ñ → n)
  
  // Try direct lookup first
  if (SERVICE_CITY_COORDINATES[cityName]) {
    return SERVICE_CITY_COORDINATES[cityName];
  }
  
  // Try alias lookup
  const aliased = CITY_ALIASES[normalized];
  if (aliased && SERVICE_CITY_COORDINATES[aliased]) {
    return SERVICE_CITY_COORDINATES[aliased];
  }
  
  // Try to find by case-insensitive exact match
  for (const [city, coords] of Object.entries(SERVICE_CITY_COORDINATES)) {
    if (city.toLowerCase() === normalized) {
      return coords;
    }
  }
  
  return null;
}

export type { ServiceAreaCity };
