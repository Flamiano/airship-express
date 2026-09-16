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
export const COURIER_NAMES = [
  "ShopeeXpress",
  "JNT Express",
  "Lazada Express",
  "Flash Express",
  "TikTok Delivery",
  "LBC",
  "GOGO Xpress",
  "Airship Express",
] as const;
export type CourierName = (typeof COURIER_NAMES)[number];
export type ParcelStatus = "RECEIVED" | "READY_FOR_BOOKING" | "PICKED_UP" | "BOOKED" | "IN_TRANSIT" | "DELAYED" | "DELIVERED" | "CANCELLED";

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

export type DispatchState = {
  status: "READY" | "DELIVERING" | "COMPLETED";
  progress: number;
  etaMinutes: number;
  currentPos: { lat: number; lng: number };
};

export type Booking = {
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffLongitude?: any;
  dropoffLatitude?: any;
  deliveryDestinations?: Array<{ name?: string; label?: string; lat?: number; lng?: number; latitude?: number; longitude?: number; status?: string }>;
  routePlanId?: string;
  id: string;
  parcelIds: string[];
  parcelCount?: number;
  courier?: CourierName | string;
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
  status: "Available" | "Assigned";
};

export const PARCEL_STATUS_LABEL: Record<ParcelStatus, string> = {
  RECEIVED: "Received",
  READY_FOR_BOOKING: "Ready for booking",
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
