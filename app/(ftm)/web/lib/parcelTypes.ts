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
export type ParcelStatus = "RECEIVED" | "READY_FOR_BOOKING" | "BOOKED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";

export type Parcel = {
  id: string;
  trackingNumber: string;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  destinationAddress: string;
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
};

export type BookingStatus = "PENDING" | "DRIVER_VEHICLE_ASSIGNED" | "DISPATCHED" | "CANCELLED";

export type DispatchState = {
  status: "READY" | "DELIVERING" | "COMPLETED";
  progress: number;
  etaMinutes: number;
  currentPos: { lat: number; lng: number };
};

export type Booking = {
  id: string;
  parcelIds: string[];
  parcelCount?: number;
  routePlanId?: string;
  routeLabel: string;
  totalWeightKg: number;
  createdAt: string;
  status: BookingStatus;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  dispatch?: DispatchState;
};

export type Driver = {
  id: string;
  name: string;
  status: "Available" | "Assigned";
};

export type Vehicle = {
  id: string;
  plate: string;
  type: string;
  capacityKg: number;
  status: "Available" | "Assigned";
};

export const PARCEL_STATUS_LABEL: Record<ParcelStatus, string> = {
  RECEIVED: "Received",
  READY_FOR_BOOKING: "Ready for booking",
  BOOKED: "Booked",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pending assignment",
  DRIVER_VEHICLE_ASSIGNED: "Ready to dispatch",
  DISPATCHED: "Dispatched",
  CANCELLED: "Cancelled",
};
