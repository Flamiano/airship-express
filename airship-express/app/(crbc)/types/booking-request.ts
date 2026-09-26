// Canonical types for CRM booking requests and customer interactions.
//
// Boundary notes:
// - Interaction channel records HOW the customer reached us. It lives on
//   interactions/requests, never on the customers record.
// - BookingRequest.status is the CRM REQUEST lifecycle only. Operational
//   shipment statuses (BOOKED, IN_TRANSIT, DELIVERED, ...) are owned by
//   Freight Operations and must not be merged into this enum.

export type InteractionChannel = "WALK_IN" | "PHONE_CALL" | "PORTAL";

export const INTERACTION_CHANNELS: InteractionChannel[] = [
  "WALK_IN",
  "PHONE_CALL",
  "PORTAL",
];

export const CHANNEL_LABELS: Record<InteractionChannel, string> = {
  WALK_IN: "Walk-in",
  PHONE_CALL: "Phone Call",
  PORTAL: "Portal",
};

export type PackageType = "box" | "parcel" | "document";

export type PackageDimensions = {
  length_cm: number;
  width_cm: number;
  height_cm: number;
};

export type BookingRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED";

export type BookingRequest = {
  id: string;
  request_id: string;
  customer_id: string;
  request_channel: InteractionChannel;
  receiver_name: string;
  receiver_contact?: string | null;
  receiver_address: string;
  package_quantity: number;
  package_type: PackageType;
  item_category?: string | null;
  weight?: number | null;
  dimensions?: PackageDimensions | null;
  declared_value?: number | null;
  airship_packaging_requested: boolean;
  remarks?: string | null;
  status: BookingRequestStatus;
  created_at: string;
  updated_at: string;
};

// Customer Interaction = HOW/WHEN the customer interacted with Airship Xpress.
export type CustomerInteraction = {
  id: string;
  customer_id: string;
  interaction_type: InteractionChannel;
  notes?: string | null;
  interaction_date: string;
  created_at: string;
};

export const REQUEST_STATUS_LABELS: Record<BookingRequestStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};
