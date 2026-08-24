"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../library/supabase/server";
import type {
  InteractionChannel,
  PackageDimensions,
  PackageType,
} from "../types/booking-request";
import {
  isValidEmail,
  isValidPhone,
  normalizePhone,
} from "../library/validation/customer.data.validate";

export type BookingRequestDraft = {
  // Step 1 — sender
  existingCustomerId?: string;
  newCustomer?: {
    full_name: string;
    customer_type: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  request_channel: InteractionChannel;

  // Step 2 — receiver
  receiver_name: string;
  receiver_contact?: string;
  receiver_address: string;

  // Step 3 — package
  package_quantity: number;
  package_type: PackageType;
  item_category?: string;
  weight?: number;
  dimensions?: PackageDimensions;
  declared_value?: number;
  airship_packaging_requested: boolean;
  remarks?: string;
};

type SubmitResult = {
  error?: string;
  success?: boolean;
  request_id?: string;
  customer_id?: string;
};

const CHANNELS: InteractionChannel[] = ["WALK_IN", "PHONE_CALL", "PORTAL"];
const PACKAGE_TYPES: PackageType[] = ["box", "parcel", "document"];

function validateDraft(draft: BookingRequestDraft): string | null {
  if (!CHANNELS.includes(draft.request_channel)) {
    return "Invalid interaction channel.";
  }

  const hasExisting = !!draft.existingCustomerId;
  const hasNew =
    !!draft.newCustomer && !!draft.newCustomer.full_name?.trim();

  if (!hasExisting && !hasNew) {
    return "Select an existing customer or provide new customer information.";
  }

  if (!draft.receiver_name?.trim()) {
    return "Receiver name is required.";
  }
  if (!draft.receiver_address?.trim()) {
    return "Receiver address is required.";
  }
  if (
    draft.receiver_contact?.trim() &&
    !isValidPhone(draft.receiver_contact)
  ) {
    return "Enter a valid Philippine mobile number for the receiver.";
  }

  if (!PACKAGE_TYPES.includes(draft.package_type)) {
    return "Invalid package type.";
  }
  if (!Number.isInteger(draft.package_quantity) || draft.package_quantity < 1) {
    return "Package quantity must be a whole number of at least 1.";
  }
  if (draft.weight !== undefined && draft.weight <= 0) {
    return "Weight must be greater than zero.";
  }
  if (draft.declared_value !== undefined && draft.declared_value < 0) {
    return "Declared value cannot be negative.";
  }

  if (draft.newCustomer) {
    const { email, phone } = draft.newCustomer;
    if (email && !isValidEmail(email)) {
      return "Enter a valid Gmail address for the new customer.";
    }
    if (phone && !isValidPhone(phone)) {
      return "Enter a valid Philippine mobile number for the new customer.";
    }
  }

  return null;
}


export async function submitBookingRequest(
  draft: BookingRequestDraft
): Promise<SubmitResult> {
  try {
    const validationError = validateDraft(draft);
    if (validationError) return { error: validationError };

    const supabase = await createClient();

    // 1. Resolve the sender: reuse an existing customer or create one.
    let customerId: string;
    let customerIdCode: string;

    if (draft.existingCustomerId) {
      const { data: existing, error: fetchError } = await supabase
        .from("customers")
        .select("id, customer_id")
        .eq("id", draft.existingCustomerId)
        .single();

      if (fetchError || !existing) {
        return { error: "Selected customer could not be found." };
      }
      customerId = existing.id;
      customerIdCode = existing.customer_id;
    } else {
      const { data: created, error: createError } = await supabase
        .from("customers")
        .insert({
          full_name: draft.newCustomer!.full_name.trim(),
          email: draft.newCustomer!.email?.trim() || null,
          phone: draft.newCustomer!.phone
            ? normalizePhone(draft.newCustomer!.phone)
            : null,
          address: draft.newCustomer!.address?.trim() || null,
        })
        .select("id, customer_id")
        .single();

      if (createError || !created) {
        console.error("Create customer error:", createError);
        return { error: "Failed to create the customer record." };
      }
      customerId = created.id;
      customerIdCode = created.customer_id;
    }

    // 2. Record HOW/WHEN the customer interacted with us.
    const { data: interaction, error: interactionError } = await supabase
      .from("customer_interactions")
      .insert({
        customer_id: customerId,
        interaction_type: draft.request_channel,
        notes: `Booking request (${draft.package_quantity} × ${draft.package_type})`,
      })
      .select("id")
      .single();

    if (interactionError || !interaction) {
      console.error("Create interaction error:", interactionError);
      return { error: "Failed to record the customer interaction." };
    }

    // 3. Create the CRM booking request.
    const { data: request, error: requestError } = await supabase
      .from("booking_requests")
      .insert({
        customer_id: customerId,
        request_channel: draft.request_channel,
        receiver_name: draft.receiver_name.trim(),
        receiver_contact: draft.receiver_contact
          ? normalizePhone(draft.receiver_contact)
          : null,
        receiver_address: draft.receiver_address.trim(),
        package_quantity: draft.package_quantity,
        package_type: draft.package_type,
        item_category: draft.item_category?.trim() || null,
        weight: draft.weight ?? null,
        dimensions: draft.dimensions ?? null,
        declared_value: draft.declared_value ?? null,
        airship_packaging_requested: draft.airship_packaging_requested,
        remarks: draft.remarks?.trim() || null,
        status: "PENDING",
      })
      .select("id, request_id")
      .single();

    if (requestError || !request) {
      console.error("Create booking request error:", requestError);
      return { error: "Failed to create the booking request." };
    }


    await submitToFreightOperations(request.id);

    revalidatePath("/crbc/customers");
    revalidatePath(`/crbc/customers/${customerIdCode}`);

    return {
      success: true,
      request_id: request.request_id,
      customer_id: customerIdCode,
    };
  } catch (error) {
    console.error(error);
    return { error: "Something went wrong." };
  }
}


async function submitToFreightOperations(requestId: string): Promise<void> {
  void requestId;
}

export type CustomerSearchResult = {
  id: string;
  customer_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};


// reusing the returned id instead of creating a new customer row.
export async function findCustomers(
  query: string
): Promise<{ data: CustomerSearchResult[]; error?: string }> {
  try {
    const q = query.trim();
    if (q.length < 2) return { data: [] };

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customers")
      .select("id, customer_id, full_name, email, phone")
      .or(
        [
          `full_name.ilike.%${q}%`,
          `customer_id.ilike.%${q}%`,
          `email.ilike.%${q}%`,
          `phone.ilike.%${q}%`,
        ].join(",")
      )
      .limit(8);

    if (error) {
      console.error("Find customers error:", error);
      return { data: [], error: "Failed to search customers." };
    }

    return { data };
  } catch (error) {
    console.error(error);
    return { data: [], error: "Something went wrong." };
  }
}
