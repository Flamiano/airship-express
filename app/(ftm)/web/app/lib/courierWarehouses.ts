/**
 * Fixed warehouse marker by courier and city.
 *
 * Each courier has a deterministic warehouse pin in each service city, with no
 * city-centroid or shared-city behavior. The final coordinate is still fixed and
 * hardcoded for the pair (courier, city).
 */
import { COURIER_NAMES, CourierName } from "./parcelTypes";
import { SERVICE_AREA_CITIES, ServiceAreaCity } from "./serviceAreas";

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
  "Cebu City": { lat: 10.3157, lng: 123.8854 },
  "Davao City": { lat: 7.1907, lng: 125.4553 },
  "Manila City": { lat: 14.5995, lng: 120.9745 },
  "Cagayan de Oro": { lat: 8.4542, lng: 124.6319 },
  "Bacolod City": { lat: 10.6765, lng: 122.951 },
  "Iloilo City": { lat: 10.7202, lng: 122.5621 },
  "La Trinidad": { lat: 16.4145, lng: 120.5904 },
  "General Santos City": { lat: 6.1167, lng: 125.171 },
  "Zamboanga City": { lat: 6.9214, lng: 122.079 },
  "Antipolo City": { lat: 14.6019, lng: 121.1797 },
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

/** The one fixed warehouse a given courier operates in a given city, or undefined if the city/courier isn't covered. */
export function getCourierWarehouse(courier: string, city: string): CourierWarehouse | undefined {
  return WAREHOUSE_REGISTRY.get(`${courier}::${city}`);
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
  const haystack = (address || "").toLowerCase();
  if (!haystack) return undefined;
  return SERVICE_AREA_CITIES.find((city) => haystack.includes(city.toLowerCase()));
}
