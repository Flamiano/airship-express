"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../library/supabase/server";

type Channel = "walk_in" | "call";

type addCustomerInput = {
  senderName: string;
  senderNumber?: string;
  senderEmail?: string;
  senderAddress?: string;
  receiverName: string;
  receiverNumber?: string;
  receiverAddress: string;
  source: Channel;
  existingCustomerId?: string;
};

type CustomerResult = {
  id: string;
  customer_id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  isNew: boolean;
};

/**
 * Find existing customer by phone number, or create new one if not found.
 * Returns the customer (existing or new) and whether it was newly created.
 */
async function findOrCreateCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  senderName: string,
  senderNumber: string | undefined,
  senderEmail: string | undefined,
  senderAddress: string | undefined
): Promise<{ data: CustomerResult | null; error: string | null }> {
  const phone = senderNumber?.trim() || null;

  if (phone) {
    const { data: existing, error: searchError } = await supabase
      .from("customers")
      .select("id, customer_id, full_name, phone, address")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();

    if (searchError) {
      console.error("Search customer error:", searchError);
      return { data: null, error: "Failed to search for existing customer." };
    }

    if (existing) {
      // Found existing customer - return it (not new)
      return {
        data: {
          ...existing,
          isNew: false,
        },
        error: null,
      };
    }
  }

  // No existing customer found (or no phone provided) - create new
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      full_name: senderName.trim(),
      phone,
      email: senderEmail?.trim() || null,
      address: senderAddress?.trim() || null,
    })
    .select("id, customer_id, full_name, phone, address")
    .single();

  if (customerError) {
    console.error("Create customer error:", customerError);
    return { data: null, error: "Failed to create customer." };
  }

  return {
    data: {
      ...customer,
      isNew: true,
    },
    error: null,
  };
}

export async function addCustomer(input: addCustomerInput) {
  try {
    const supabase = await createClient();
    const {
      senderName,
      senderNumber,
      senderEmail,
      senderAddress,
      receiverName,
      receiverNumber,
      receiverAddress,
      source,
      existingCustomerId,
    } = input;

    if (!senderName?.trim()) return { error: "Sender name is required." };
    if (!receiverName?.trim()) return { error: "Receiver name is required." };
    if (!receiverAddress?.trim()) return { error: "Receiver address is required." };

    let customer: CustomerResult | null = null;

    if (existingCustomerId) {
      // User already confirmed this customer — trust it, don't re-resolve.
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_id, full_name, phone, address")
        .eq("id", existingCustomerId)
        .single();

      if (error || !data) {
        return { error: "Selected customer could not be found." };
      }
      customer = { ...data, isNew: false };
    } else {
      const { data, error } = await findOrCreateCustomer(
        supabase,
        senderName,
        senderNumber,
        senderEmail,
        senderAddress
      );
      if (error || !data) return { error };
      customer = data;
    }

    // ...rest unchanged, using `customer.id` below

    // Create booking linked to the customer (existing or new)
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        sender_customer_id: customer.id,
        receiver_name: receiverName.trim(),
        receiver_phone: receiverNumber?.trim() || null,
        receiver_address: receiverAddress.trim(),
        source,
        status: "PENDING",
      })
      .select("id, booking_id")
      .single();

    if (bookingError) {
      console.error(bookingError);
      return { error: "Customer was created, but booking creation failed." };
    }

    revalidatePath("/crbc/customers");

    return {
      success: true,
      customer,
      booking,
      customerIsNew: customer.isNew,
    };
  } catch (error) {
    console.error(error);
    return { error: "Something went wrong." };
  }
}

export async function searchCustomer(
  customerId?: string,
  phone?: string
): Promise<{ data: CustomerResult | null; error: string | null }> {
  try {
    const supabase = await createClient();

    if (!customerId && !phone) {
      return { data: null, error: "Customer ID or phone number is required." };
    }

    let query = supabase
      .from("customers")
      .select("id, customer_id, full_name, phone, address")
      .limit(1);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    } else if (phone) {
      query = query.eq("phone", phone);
    }

    const { data: customer, error } = await query.maybeSingle();

    if (error) {
      console.error("Search customer error:", error);
      return { data: null, error: "Failed to search for customer." };
    }

    if (!customer) {
      return { data: null, error: "Customer not found." };
    }

    return {
      data: {
        ...customer,
        isNew: false,
      },
      error: null,
    };
  } catch (error) {
    console.error(error);
    return { data: null, error: "Something went wrong." };
  }
}