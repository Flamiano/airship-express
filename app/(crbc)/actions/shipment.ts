"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../library/supabase/server";
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

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", user.id)
      .single();

    if (customerError || !customer) {
      return { error: "Customer profile could not be found." };
    }

    // Validate
    if (!input.receiverName?.trim()) {
      return { error: "Receiver name is required." };
    }
    if (!input.receiverAddress?.trim()) {
      return { error: "Delivery address is required." };
    }
    if (
      !input.packageDetails.package_quantity ||
      input.packageDetails.package_quantity < 1
    ) {
      return { error: "Quantity must be at least 1." };
    }
    if (!input.packageDetails.weight || input.packageDetails.weight <= 0) {
      return { error: "Weight must be greater than zero." };
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        sender_customer_id: customer.id,
        receiver_name: input.receiverName.trim(),
        receiver_phone: input.receiverPhone?.trim() || null,
        receiver_address: input.receiverAddress.trim(),
        source: "walk_in",
        status: "PENDING",
        package_quantity: input.packageDetails.package_quantity,
        package_type: input.packageDetails.package_type ?? "parcel",
        item_category: input.packageDetails.item_category ?? null,
        weight: input.packageDetails.weight,
        dimensions: input.packageDetails.dimensions ?? null,
        declared_value: input.packageDetails.declared_value ?? null,
        packaging_service: input.packageDetails.packaging_service ?? "empty",
        remarks: input.packageDetails.remarks?.trim() || null,
      })
      .select("id, booking_id")
      .single();

    if (bookingError) {
      console.error("Booking insert error:", bookingError);
      return { error: "Failed to submit your shipment request. Please try again." };
    }

    revalidatePath("/customer/shipments");
    revalidatePath("/crbc/customers");

    return {
      success: true,
      booking: {
        id: booking.id,
        booking_id: booking.booking_id,
      },
    };
  } catch (error) {
    console.error(error);
    return { error: "Something went wrong." };
  }
}
