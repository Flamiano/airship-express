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
