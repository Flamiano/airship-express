export const HUB_ADDRESS = "Airship Express Hub - Binondo, Manila";
export const HUB_POS = { lat: 14.5995, lng: 120.9745 };

export const PARCEL_TYPES = [
  "Document",
  "E-commerce Package",
  "Electronics",
  "Clothing",
  "Bulk / Box",
  "Fragile",
] as const;

export type ParcelType = (typeof PARCEL_TYPES)[number];
export const COURIER_NAMES = ["Airship Express"] as const;
export type CourierName = (typeof COURIER_NAMES)[number];
export type ParcelStatus = "PICKED_UP" | "BOOKED" | "IN_TRANSIT" | "DELAYED" | "DELIVERED" | "CANCELLED";

export function isTripInTransitStatus(status?: string | null) {
  const normalized = String(status || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  return /\b(accepted|scheduled|in transit|transit|dispatched|dispatch|delivering|moving|en route|on route)\b/.test(normalized);
}

export function isOperationalTrip(trip: { id?: string | null; trip_id?: string | null; status?: string | null }) {
  const status = String(trip.status ?? "").trim().toLowerCase();
  if (!status) return false;
  if (/completed|cancelled|canceled|delivered|failed|closed/.test(status)) return false;
  return /transit|assigned|accepted|pickup confirmed|pickup assigned|dispatch|scheduled|active|moving|in_transit|in transit|en route|route|delayed|late|critical/.test(status);
}

export function isCompletedTripStatus(status?: string | null) {
  return /\b(completed|delivered|finished|arrived)\b/i.test(String(status ?? "").replace(/[_-]+/g, " "));
}

export type Parcel = {
  id: string;
  trackingNumber: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  destinationAddress: string;
  bulk_qr_code?: string;
  bulkQrCode?: string;
  bulk_parcel_count?: number | null;
  parcel_count?: number | null;
  package_count?: number | null;
  quantity?: number | null;
  destLat: number;
  destLng: number;
  parcelType: ParcelType;
  courier?: CourierName;
  weightKg: number;
  notes?: string;
  status: ParcelStatus;
  receivedAt: string;
  bookingId?: string;
  routePlanId?: string;
  tripId?: string;
};

export type BookingStatus = "PENDING" | "DRIVER_VEHICLE_ASSIGNED" | "DISPATCHED" | "CANCELLED";

export type RoutePlanPoint = {
  id?: string;
  name?: string;
  address?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  purpose?: string;
  kind?: string;
  arrival?: string;
  departure?: string;
  durationMinutes?: number;
  instructions?: string;
  parcelReference?: string;
  parcelEvents?: Array<{ parcelId: string; trackingNumber: string; kind: "pickup" | "delivery" }>;
};

export type RoutePlanDetails = {
  route_name?: string;
  route_type?: string;
  vehicle_type?: string;
  priority?: string;
  notes?: string;
  estimated_load_kg?: number | null;
  origin?: RoutePlanPoint;
  destination?: RoutePlanPoint;
  stops?: RoutePlanPoint[];
  included_parcel_ids?: string[];
  schedule?: {
    depart_at?: string | null;
    expected_arrival?: string | null;
    window_start?: string | null;
    window_end?: string | null;
    duration_minutes?: number | null;
  };
};

export type PersistedRoutePlan = {
  id?: string;
  route_name?: string;
  route_type?: string;
  status?: string | null;
  courier?: string | null;
  pickup_location?: string;
  pickupLocation?: string;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  delivery_destinations?: RoutePlanPoint[];
  deliveryDestinations?: RoutePlanPoint[];
  route_details?: RoutePlanDetails | null;
  routeDetails?: RoutePlanDetails | null;
  planned_delivery_date?: string | null;
  plannedDeliveryDate?: string | null;
  optimized_distance_km?: number | null;
  optimized_duration_min?: number | null;
  optimizedDistanceKm?: number | null;
  optimizedDurationMinutes?: number | null;
  distance_km?: number | null;
  estimated_duration_min?: number | null;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  tripId?: string | null;
  bookingId?: string | null;
  vehicleId?: string | null;
  driverId?: string | null;
  vehicleInfo?: Record<string, unknown> | null;
  driverInfo?: Record<string, unknown> | null;
  depot?: Record<string, unknown> | null;
  baselineRoute?: Record<string, unknown> | null;
  optimizedRoute?: Record<string, unknown> | null;
  stopSequence?: unknown;
  baselineDistanceKm?: number | null;
  baselineDurationMinutes?: number | null;
  distanceSavedKm?: number | null;
  fuelEfficiencyKmPerL?: number | null;
  baselineFuelLiters?: number | null;
  optimizedFuelLiters?: number | null;
  fuelSavedLiters?: number | null;
  optimizationResult?: Record<string, unknown> | null;
};

export type DispatchState = {
  status: "PICKUP_ASSIGNED" | "READY" | "DELIVERING" | "COMPLETED";
  progress: number;
  etaMinutes: number;
  currentPos: { lat: number; lng: number };
};

export type Booking = {
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffLongitude?: number | string | null;
  dropoffLatitude?: number | string | null;
  deliveryDestinations?: RoutePlanPoint[];
  routePlanId?: string;
  routePlan?: PersistedRoutePlan | null;
  id: string;
  parcelIds: string[];
  parcelCount?: number;
  courier?: CourierName | string;
  courierId?: string;
  routeLabel: string;
  totalWeightKg: number;
  createdAt: string;
  status: BookingStatus;
  driverId?: string;
  driver_id?: string;
  driverName?: string;
  vehicleId?: string;
  vehicle_id?: string;
  vehiclePlate?: string;
  dispatch?: DispatchState;
};

export type Driver = {
  id: string;
  name: string;
  vehicleId?: string;
  courierId?: string;
  courier?: string;
  status: "Available" | "Assigned";
};

export type Vehicle = {
  id: string;
  courierId?: string;
  courier?: CourierName | string;
  plate: string;
  plateNumber?: string;
  type?: string;
  model?: string;
  capacityKg: number;
  fuelEfficiencyKmPerL?: number | null;
  status: "Available" | "Assigned";
};

export const PARCEL_STATUS_LABEL: Record<ParcelStatus, string> = {
  PICKED_UP: "Pick Up",
  BOOKED: "Booked",
  IN_TRANSIT: "In transit",
  DELAYED: "Delayed",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pending assignment",
  DRIVER_VEHICLE_ASSIGNED: "Ready to dispatch",
  DISPATCHED: "Dispatched",
  CANCELLED: "Cancelled",
};
