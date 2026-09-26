export const PERSISTED_SERVICE_AREA_KEY = "vrds-bulk-service-area";
export const ALL_SERVICE_AREA_SENTINEL = "__ALL_SERVICE_CITIES__";

export const SERVICE_AREA_CITIES = [
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
] as const;

type ServiceAreaCity = (typeof SERVICE_AREA_CITIES)[number];

export const SERVICE_CITY_BOUNDS: Record<ServiceAreaCity, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
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

// Compute simple centroid coordinates per city for map markers
export const SERVICE_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  Object.entries(SERVICE_CITY_BOUNDS).map(([city, bounds]) => [city, { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 }])
) as Record<string, { lat: number; lng: number }>;

export function getCityCoordinate(cityName: string) {
  return SERVICE_CITY_COORDINATES[cityName] ?? null;
}

export type { ServiceAreaCity };
