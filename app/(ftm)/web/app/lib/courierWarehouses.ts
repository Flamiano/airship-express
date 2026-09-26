/**
 * Fixed warehouse marker by courier and city.
 *
 * Each courier has a deterministic warehouse pin in each service city, with no
 * city-centroid or shared-city behavior. The final coordinate is still fixed and
 * hardcoded for the pair (courier, city).
 */
import { COURIER_NAMES, CourierName } from "./parcelTypes";
import { getCityCoordinate, SERVICE_AREA_CITIES, ServiceAreaCity } from "./serviceAreas";

export type CourierWarehouse = {
  id: string;
  courier: CourierName;
  city: ServiceAreaCity;
  name: string;
  lat: number;
  lng: number;
};

const CITY_BASE_WAREHOUSE: Record<ServiceAreaCity, { lat: number; lng: number }> = {
  Caloocan: { lat: 14.675, lng: 121.01 },
  "Quezon City": { lat: 14.63, lng: 121.045 },
  Manila: { lat: 14.59, lng: 120.99 },
  Makati: { lat: 14.54, lng: 121.03 },
  Pasig: { lat: 14.57, lng: 121.075 },
  Mandaluyong: { lat: 14.575, lng: 121.04 },
  "San Juan": { lat: 14.605, lng: 121.035 },
  Marikina: { lat: 14.65, lng: 121.1 },
  Pasay: { lat: 14.525, lng: 120.995 },
  Taguig: { lat: 14.525, lng: 121.055 },
  "Parañaque": { lat: 14.485, lng: 121.015 },
  Valenzuela: { lat: 14.705, lng: 120.99 },
  "Antipolo City": { lat: 14.6019, lng: 121.1797 },
  "Las Piñas": { lat: 14.454, lng: 120.999 },
  "Muntinlupa": { lat: 14.404, lng: 121.035 },
  Bacoor: { lat: 14.459, lng: 120.95 },
  "Cavite City": { lat: 14.48, lng: 120.89 },
  Dasmariñas: { lat: 14.326, lng: 120.936 },
  Imus: { lat: 14.425, lng: 120.94 },
  "General Trias": { lat: 14.386, lng: 120.882 },
  "Trece Martires": { lat: 14.279, lng: 120.87 },
  Tagaytay: { lat: 14.114, lng: 120.94 },
  "Baguio City": { lat: 16.415, lng: 120.596 },
  "Bacolod City": { lat: 10.6765, lng: 122.951 },
  "Batangas City": { lat: 13.756, lng: 121.058 },
  "Cagayan de Oro": { lat: 8.4542, lng: 124.6319 },
  "Cebu City": { lat: 10.3157, lng: 123.8854 },
  "Davao City": { lat: 7.1907, lng: 125.4553 },
  "General Santos City": { lat: 6.1167, lng: 125.171 },
  "Iloilo City": { lat: 10.7202, lng: 122.5621 },
  "La Trinidad": { lat: 16.4145, lng: 120.5904 },
  Lipa: { lat: 13.941, lng: 121.163 },
  "San Pablo City": { lat: 14.07, lng: 121.321 },
  "Santa Rosa": { lat: 14.314, lng: 121.111 },
  "Tarlac City": { lat: 15.480, lng: 120.597 },
  "Zamboanga City": { lat: 6.9214, lng: 122.079 },
  "Angeles City": { lat: 15.145, lng: 120.59 },
  "San Fernando": { lat: 15.032, lng: 120.69 },
  Bataan: { lat: 14.357, lng: 120.574 },
  "Puerto Princesa": { lat: 9.739, lng: 118.737 },
  "Butuan City": { lat: 8.949, lng: 125.54 },
  "Iligan City": { lat: 8.228, lng: 124.246 },
  "Dumaguete City": { lat: 9.309, lng: 123.307 },
  "Cabanatuan City": { lat: 15.486, lng: 120.967 },
  "Naga City": { lat: 13.621, lng: 123.195 },
  "Legazpi City": { lat: 13.139, lng: 123.741 },
  "Sorsogon City": { lat: 12.973, lng: 124.004 },
  "Tuguegarao City": { lat: 17.613, lng: 121.726 },
};

const COURIER_CITY_OFFSETS: Record<CourierName, { dLat: number; dLng: number }> = {
  ShopeeXpress: { dLat: 0.0060, dLng: 0.0045 },
  "JNT Express": { dLat: -0.0055, dLng: 0.0065 },
  "Lazada Express": { dLat: 0.0050, dLng: -0.0060 },
  "Flash Express": { dLat: -0.0060, dLng: -0.0045 },
  "TikTok Delivery": { dLat: 0.0070, dLng: 0.0020 },
  LBC: { dLat: -0.0020, dLng: 0.0075 },
  "GOGO Xpress": { dLat: 0.0020, dLng: -0.0070 },
  "Airship Express": { dLat: -0.0075, dLng: -0.0015 },
};

function buildRegistry() {
  const registry = new Map<string, CourierWarehouse>();

  SERVICE_AREA_CITIES.forEach((city) => {
    const cityBase = CITY_BASE_WAREHOUSE[city];
    if (!cityBase) return;

    COURIER_NAMES.forEach((courier) => {
      const offset = COURIER_CITY_OFFSETS[courier] ?? { dLat: 0, dLng: 0 };
      const id = `${courier}::${city}`;
      registry.set(id, {
        id,
        courier,
        city,
        name: `${courier} Hub \u2013 ${city}`,
        lat: Number((cityBase.lat + offset.dLat).toFixed(6)),
        lng: Number((cityBase.lng + offset.dLng).toFixed(6)),
      });
    });
  });

  return registry;
}

const WAREHOUSE_REGISTRY = buildRegistry();

const COURIER_ALIASES: Record<string, CourierName> = {
  "shopee xpress": "ShopeeXpress",
  "shopee express": "ShopeeXpress",
  "j&t express": "JNT Express",
  "jnt": "JNT Express",
  "lazada": "Lazada Express",
  "flash": "Flash Express",
  "tiktok": "TikTok Delivery",
  "tiktok express": "TikTok Delivery",
  "lbc express": "LBC",
  "gogo": "GOGO Xpress",
  "gogo express": "GOGO Xpress",
};

/** Normalize imported courier labels to the warehouse registry key. */
export function resolveCourierName(value: unknown): CourierName {
  const raw = String(value ?? "").trim();
  if (!raw) return "LBC";
  const normalized = raw.toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
  const exact = COURIER_NAMES.find((name) => name.toLowerCase() === normalized);
  if (exact) return exact;
  if (COURIER_ALIASES[normalized]) return COURIER_ALIASES[normalized];
  if (normalized.includes("tiktok")) return "TikTok Delivery";
  if (normalized.includes("gogo")) return "GOGO Xpress";
  if (normalized.includes("lbc")) return "LBC";
  if (normalized.includes("shopee")) return "ShopeeXpress";
  if (normalized.includes("jnt") || normalized.includes("j&t")) return "JNT Express";
  if (normalized.includes("lazada")) return "Lazada Express";
  if (normalized.includes("flash")) return "Flash Express";
  return "LBC";
}

/** The one fixed warehouse a given courier operates in a given city, or undefined if the city/courier isn't covered. */
export function getCourierWarehouse(courier: string, city: string): CourierWarehouse | undefined {
  const normalizedCity = String(city ?? "").trim();
  const cityKey = normalizedCity
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const knownCity = SERVICE_AREA_CITIES.find((candidate) => {
    const candidateKey = candidate
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return candidateKey === cityKey || candidateKey.includes(cityKey) || cityKey.includes(candidateKey);
  });
  return knownCity
    ? WAREHOUSE_REGISTRY.get(`${resolveCourierName(courier)}::${knownCity}`)
    : undefined;
}

/** Return a deterministic warehouse location even when imported city data is unknown. */
export function getCourierWarehouseLocation(courier: string, city: string) {
  const warehouse = getCourierWarehouse(courier, city);
  if (warehouse) return warehouse;

  const cityCoordinate = getCityCoordinate(city || "");
  if (cityCoordinate && !(cityCoordinate.lat === 0 && cityCoordinate.lng === 0)) {
    const resolvedCourier = resolveCourierName(courier);
    const offset = COURIER_CITY_OFFSETS[resolvedCourier] ?? { dLat: 0, dLng: 0 };
    return {
      id: `${resolvedCourier}::city-${city || "unknown"}`,
      courier: resolvedCourier,
      city,
      name: `${resolvedCourier} Hub${city ? ` - ${city}` : ""}`,
      lat: Number((cityCoordinate.lat + offset.dLat).toFixed(6)),
      lng: Number((cityCoordinate.lng + offset.dLng).toFixed(6)),
    };
  }

  const resolvedCourier = resolveCourierName(courier);
  const offset = COURIER_CITY_OFFSETS[resolvedCourier] ?? { dLat: 0, dLng: 0 };
  const base = { lat: 14.5995, lng: 120.9745 };
  return {
    id: `${resolvedCourier}::fallback-${city || "unknown"}`,
    courier: resolvedCourier,
    city,
    name: `${resolvedCourier} Hub${city ? ` - ${city}` : ""}`,
    lat: Number((base.lat + offset.dLat).toFixed(6)),
    lng: Number((base.lng + offset.dLng).toFixed(6)),
  };
}

/** All fixed warehouses for one courier, across every covered city. */
export function listCourierWarehouses(courier?: string): CourierWarehouse[] {
  const all = Array.from(WAREHOUSE_REGISTRY.values());
  return courier ? all.filter((w) => w.courier === courier) : all;
}

/** All courier warehouses sharing one city (i.e. the "multiple warehouses, different brands" view of a city). */
export function listCityWarehouses(city: string): CourierWarehouse[] {
  return Array.from(WAREHOUSE_REGISTRY.values()).filter((w) => w.city === city);
}

/** Best-effort match of a free-text address against a known service-area city (case-insensitive substring match). */
export function resolveKnownCity(address: string): ServiceAreaCity | undefined {
  const haystack = (address || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!haystack) return undefined;

  const aliasMap: Record<string, ServiceAreaCity> = {
    "las pinas": "Las Piñas",
    "muntinlupa": "Muntinlupa",
    "bacoor": "Bacoor",
    "general trias": "General Trias",
    "gen trias": "General Trias",
    "tagaytay": "Tagaytay",
    "baguio": "Baguio City",
    "batangas": "Batangas City",
    "cavite": "Cavite City",
    "lipa": "Lipa",
    "san pablo": "San Pablo City",
    "santa rosa": "Santa Rosa",
    "angeles": "Angeles City",
    "san fernando": "San Fernando",
    "tarlac": "Tarlac City",
    "naga": "Naga City",
    "tuguegarao": "Tuguegarao City",
    "legazpi": "Legazpi City",
    "butuan": "Butuan City",
    "dumaguete": "Dumaguete City",
    "iligan": "Iligan City",
    "cabanatuan": "Cabanatuan City",
    "sorsogon": "Sorsogon City",
  };

  const aliasMatch = Object.entries(aliasMap).find(([alias]) => haystack.includes(alias));
  if (aliasMatch) return aliasMatch[1];

  return SERVICE_AREA_CITIES.find((city) => {
    const cityKey = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return haystack.includes(cityKey);
  });
}
