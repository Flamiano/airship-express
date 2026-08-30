// Package shape shared with the customer-portal request form
// (RequestShipmentForm). Kept here so the portal form keeps its import path.
// New CRM code should use BookingRequestDraft in actions/booking-request.ts.
import type { PackageType } from "../types/booking-request";

export type BookingPackageDetails = {
  package_quantity: number;
  package_type: PackageType;
  item_category: string;
  weight: number;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  declared_value?: number;
  packaging_service: "empty" | "provided";
  remarks?: string;
};
