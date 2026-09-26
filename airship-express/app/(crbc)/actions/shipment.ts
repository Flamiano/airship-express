"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../library/supabase/server";
import { createBookingRequestForPortal } from "../services/booking-request.service";
import { normalizePortalDraft } from "../library/validation/booking-request.validate";
import type { BookingPackageDetails } from "./customer";

export type RequestShipmentResult = {
  error?: string;
  success?: boolean;
  booking?: {
    id: string;
    booking_id: string;
  };
};

export async function requestShipment(input: {
  receiverName: string;
  receiverPhone?: string;
  receiverAddress: string;
  packageDetails: Partial<BookingPackageDetails>;
}): Promise<RequestShipmentResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "You must be signed in to request a shipment." };
    }

    const draft = normalizePortalDraft({
      request_channel: "PORTAL",
      receiver_name: input.receiverName,
      receiver_contact: input.receiverPhone,
      receiver_address: input.receiverAddress,
      package_quantity: input.packageDetails.package_quantity ?? 1,
      package_type: input.packageDetails.package_type ?? "parcel",
      item_category: input.packageDetails.item_category,
      weight: input.packageDetails.weight,
      dimensions: input.packageDetails.dimensions,
      declared_value: input.packageDetails.declared_value,
      airship_packaging_requested:
        input.packageDetails.packaging_service === "provided",
      remarks: input.packageDetails.remarks,
    });

    const result = await createBookingRequestForPortal(draft, user.id);

    if (!result.success || !result.request_id) {
      return { error: result.error ?? "Failed to submit your shipment request. Please try again." };
    }

    revalidatePath("/customer/shipments");

    return {
      success: true,
      booking: {
        id: result.request_id,
        booking_id: result.request_id,
      },
    };
  } catch (error) {
    console.error(error);
    return { error: "Something went wrong." };
  }
}
