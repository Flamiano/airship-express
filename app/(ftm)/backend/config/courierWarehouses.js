/**
 * Backend mirror of app/lib/courierWarehouses.ts — keep these two in sync.
 *
 * Every courier gets exactly ONE fixed warehouse per covered city, so a
 * single city can have several warehouses (one per courier brand). Used as
 * a server-side fallback/validation source when the frontend doesn't supply
 * explicit pickup coordinates (e.g. scripts, direct API calls).
 */

const SERVICE_CITY_COORDINATES = {
  Caloocan: { lat: 14.675, lng: 121.01 },
  'Quezon City': { lat: 14.63, lng: 121.045 },
  Manila: { lat: 14.59, lng: 120.99 },
  Makati: { lat: 14.54, lng: 121.03 },
  Pasig: { lat: 14.57, lng: 121.075 },
  Mandaluyong: { lat: 14.575, lng: 121.04 },
  'San Juan': { lat: 14.605, lng: 121.035 },
  Marikina: { lat: 14.65, lng: 121.10 },
  Pasay: { lat: 14.525, lng: 120.995 },
  Taguig: { lat: 14.525, lng: 121.055 },
  'Parañaque': { lat: 14.485, lng: 121.015 },
  Valenzuela: { lat: 14.705, lng: 120.99 },
};

const COURIER_NAMES = [
  'ShopeeXpress',
  'JNT Express',
  'Lazada Express',
  'Flash Express',
  'TikTok Delivery',
  'LBC',
  'GOGO Xpress',
  'Airship Express',
];

const COURIER_OFFSET_DEG = {
  ShopeeXpress: { dLat: 0.006, dLng: 0.004 },
  'JNT Express': { dLat: -0.005, dLng: 0.006 },
  'Lazada Express': { dLat: 0.004, dLng: -0.006 },
  'Flash Express': { dLat: -0.006, dLng: -0.004 },
  'TikTok Delivery': { dLat: 0.007, dLng: 0.001 },
  LBC: { dLat: -0.001, dLng: 0.007 },
  'GOGO Xpress': { dLat: 0.001, dLng: -0.007 },
  'Airship Express': { dLat: -0.007, dLng: -0.001 },
};

const REGISTRY = new Map();
Object.keys(SERVICE_CITY_COORDINATES).forEach((city) => {
  const centroid = SERVICE_CITY_COORDINATES[city];
  COURIER_NAMES.forEach((courier) => {
    const offset = COURIER_OFFSET_DEG[courier] || { dLat: 0, dLng: 0 };
    REGISTRY.set(`${courier}::${city}`, {
      courier,
      city,
      name: `${courier} Hub \u2013 ${city}`,
      lat: Number((centroid.lat + offset.dLat).toFixed(6)),
      lng: Number((centroid.lng + offset.dLng).toFixed(6)),
    });
  });
});

function getCourierWarehouse(courier, city) {
  if (!courier || !city) return null;
  return REGISTRY.get(`${courier}::${city}`) || null;
}

function listCourierWarehouses(courier) {
  const all = Array.from(REGISTRY.values());
  return courier ? all.filter((w) => w.courier === courier) : all;
}

module.exports = { getCourierWarehouse, listCourierWarehouses, SERVICE_CITY_COORDINATES, COURIER_NAMES };
