import { SERVICE_AREA_CITIES, inferCityFromCoordinates } from "./serviceAreas";

export function normalizeParcelGroupValue(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim().toUpperCase();
}

function normalizeLocation(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function getParcelGroupCity(parcel: {
  destinationAddress?: string | null;
  destLat?: number | null;
  destLng?: number | null;
}) {
  const address = String(parcel.destinationAddress ?? "").trim();
  const normalized = normalizeLocation(address);
  const segments = address.split(",").map((segment) => segment.trim()).filter(Boolean);
  const coordinateCity = inferCityFromCoordinates(parcel.destLat, parcel.destLng);
  if (coordinateCity) return coordinateCity;

  const namedCity = SERVICE_AREA_CITIES.find((city) => normalized.includes(normalizeLocation(city)));
  if (namedCity) return namedCity;
  if (normalized.includes("metro manila")) return "Manila";

  const lastSegment = segments[segments.length - 1];
  return lastSegment || "Unknown";
}

export function getParcelGroupKey(parcel: {
  courier?: string | null;
  destinationAddress?: string | null;
  destLat?: number | null;
  destLng?: number | null;
}) {
  const courier = String(parcel.courier || "Unknown courier").trim();
  const city = getParcelGroupCity(parcel);
  return {
    courier,
    city,
    key: `${normalizeParcelGroupValue(courier)}::${normalizeParcelGroupValue(city)}`,
  };
}
