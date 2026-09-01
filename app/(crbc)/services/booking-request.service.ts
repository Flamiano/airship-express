import { createClient } from "../library/supabase/server";
import { validateDraft, normalizeDraft, validatePortalDraft, normalizePortalDraft } from "../library/validation/booking-request.validate";
import type { BookingRequestDraft } from "../library/validation/booking-request.validate";

export interface BookingRequest {
  id: string;
  request_id: string;
  customer_id: string;
  request_channel: string;
  receiver_name: string;
  receiver_contact: string | null;
  receiver_address: string;
  package_quantity: number;
  package_type: string;
  item_category: string | null;
  weight: number | null;
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  } | null;
  declared_value: number | null;
  airship_packaging_requested: boolean;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined customer info
  customer?: {
    id: string;
    customer_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
}

export interface BookingRequestListItem {
  id: string;
  request_id: string;
  customer_id: string;
  request_channel: string;
  receiver_name: string;
  receiver_contact: string | null;
  receiver_address: string;
  package_quantity: number;
  package_type: string;
  item_category: string | null;
  weight: number | null;
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  } | null;
  declared_value: number | null;
  airship_packaging_requested: boolean;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    customer_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
}

export interface CreateBookingRequestResult {
  success: boolean;
  error?: string;
  request_id?: string;
  customer_id?: string;
  customer_uuid?: string;
  status?: string;
}

export interface CustomerSearchResult {
  id: string;
  customer_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: string;
  created_at: string;
}


async function getCustomerByAuthUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string
): Promise<CustomerSearchResult | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_id, full_name, email, phone, address, role, created_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to fetch customer by auth user ID");
  }

  return data ?? null;
}

/**
 * Create a booking request for CRM staff
 */
export async function createBookingRequestForStaff(
  draft: BookingRequestDraft
): Promise<CreateBookingRequestResult> {
  const validationError = validateDraft(draft);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const normalizedDraft = normalizeDraft(draft);
  const supabase = await createClient();

  //Resolve the sender: reuse an existing customer or create one
  let customerUuid: string;
  let customerIdCode: string;

  if (normalizedDraft.customer_id) {
    //Staff provided a customer UUID - verify it exists
    const { data: existing, error: fetchError } = await supabase
      .from("customers")
      .select("id, customer_id")
      .eq("id", normalizedDraft.customer_id)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Selected customer could not be found." };
    }
    customerUuid = existing.id;
    customerIdCode = existing.customer_id;
  } else if (normalizedDraft.new_customer) {
    //Create new customer
    const { data: created, error: createError } = await supabase
      .from("customers")
      .insert({
        full_name: normalizedDraft.new_customer.full_name.trim(),
        email: normalizedDraft.new_customer.email?.trim() || null,
        phone: normalizedDraft.new_customer.phone || null,
        address: normalizedDraft.new_customer.address?.trim() || null,
      })
      .select("id, customer_id")
      .single();

    if (createError || !created) {
      console.error("Create customer error:", createError);
      return { success: false, error: "Failed to create the customer record." };
    }
    customerUuid = created.id;
    customerIdCode = created.customer_id;
  } else {
    return { success: false, error: "Customer is required." };
  }

  //Record HOW/WHEN the customer interacted with us
  const { data: interaction, error: interactionError } = await supabase
    .from("customer_interactions")
    .insert({
      customer_id: customerUuid,
      interaction_type: normalizedDraft.request_channel,
      notes: `Booking request (${normalizedDraft.package_quantity} × ${normalizedDraft.package_type})`,
    })
    .select("id")
    .single();

  if (interactionError || !interaction) {
    console.error("Create interaction error:", interactionError);
    return { success: false, error: "Failed to record the customer interaction." };
  }

  //Create the CRM booking request
  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .insert({
      customer_id: customerUuid,
      request_channel: normalizedDraft.request_channel,
      receiver_name: normalizedDraft.receiver_name.trim(),
      receiver_contact: normalizedDraft.receiver_contact || null,
      receiver_address: normalizedDraft.receiver_address.trim(),
      package_quantity: normalizedDraft.package_quantity,
      package_type: normalizedDraft.package_type,
      item_category: normalizedDraft.item_category?.trim() || null,
      weight: normalizedDraft.weight ?? null,
      dimensions: normalizedDraft.dimensions ?? null,
      declared_value: normalizedDraft.declared_value ?? null,
      airship_packaging_requested: normalizedDraft.airship_packaging_requested,
      remarks: normalizedDraft.remarks?.trim() || null,
      status: "PENDING",
    })
    .select("id, request_id, status")
    .single();

  if (requestError || !request) {
    console.error("Create booking request error:", requestError);
    return { success: false, error: "Failed to create the booking request." };
  }

  return {
    success: true,
    request_id: request.request_id,
    customer_id: customerIdCode,
    customer_uuid: customerUuid,
    status: request.status,
  };
}


export async function createBookingRequestForPortal(
  draft: ReturnType<typeof normalizePortalDraft>,
  authUserId: string
): Promise<CreateBookingRequestResult> {
  const validationError = validatePortalDraft(draft);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const normalizedDraft = normalizePortalDraft(draft);
  const supabase = await createClient();

  // Resolve customer from authenticated user
  const customer = await getCustomerByAuthUserId(supabase, authUserId);
  if (!customer) {
    return { success: false, error: "Customer profile not found for authenticated user." };
  }

  const customerUuid = customer.id;
  const customerIdCode = customer.customer_id;

  //Record HOW/WHEN the customer interacted with us
  const { data: interaction, error: interactionError } = await supabase
    .from("customer_interactions")
    .insert({
      customer_id: customerUuid,
      interaction_type: "PORTAL",
      notes: `Booking request (${normalizedDraft.package_quantity} × ${normalizedDraft.package_type})`,
    })
    .select("id")
    .single();

  if (interactionError || !interaction) {
    console.error("Create interaction error:", interactionError);
    return { success: false, error: "Failed to record the customer interaction." };
  }

  //Create the CRM booking request
  const { data: request, error: requestError } = await supabase
    .from("booking_requests")
    .insert({
      customer_id: customerUuid,
      request_channel: "PORTAL",
      receiver_name: normalizedDraft.receiver_name.trim(),
      receiver_contact: normalizedDraft.receiver_contact || null,
      receiver_address: normalizedDraft.receiver_address.trim(),
      package_quantity: normalizedDraft.package_quantity,
      package_type: normalizedDraft.package_type,
      item_category: normalizedDraft.item_category?.trim() || null,
      weight: normalizedDraft.weight ?? null,
      dimensions: normalizedDraft.dimensions ?? null,
      declared_value: normalizedDraft.declared_value ?? null,
      airship_packaging_requested: normalizedDraft.airship_packaging_requested,
      remarks: normalizedDraft.remarks?.trim() || null,
      status: "PENDING",
    })
    .select("id, request_id, status")
    .single();

  if (requestError || !request) {
    console.error("Create booking request error:", requestError);
    return { success: false, error: "Failed to create the booking request." };
  }

  return {
    success: true,
    request_id: request.request_id,
    customer_id: customerIdCode,
    customer_uuid: customerUuid,
    status: request.status,
  };
}


export async function getBookingRequests(
  options: {
    customerUuid?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<BookingRequestListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("booking_requests")
    .select(`
      id,
      request_id,
      customer_id,
      request_channel,
      receiver_name,
      receiver_contact,
      receiver_address,
      package_quantity,
      package_type,
      item_category,
      weight,
      dimensions,
      declared_value,
      airship_packaging_requested,
      remarks,
      status,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (options.customerUuid) {
    query = query.eq("customer_id", options.customerUuid);
  }
  if (options.status) {
    query = query.eq("status", options.status);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Fetch booking requests error:", error);
    throw new Error("Failed to fetch booking requests");
  }

  return data ?? [];
}


export async function getBookingRequestById(
  requestId: string
): Promise<BookingRequest | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booking_requests")
    .select(`
      id,
      request_id,
      customer_id,
      request_channel,
      receiver_name,
      receiver_contact,
      receiver_address,
      package_quantity,
      package_type,
      item_category,
      weight,
      dimensions,
      declared_value,
      airship_packaging_requested,
      remarks,
      status,
      created_at,
      updated_at
    `)
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) {
    console.error("Fetch booking request error:", error);
    throw new Error("Failed to fetch booking request");
  }

  if (!data) {
    return null;
  }

  // Optionally fetch customer info
  const { data: customer } = await supabase
    .from("customers")
    .select("id, customer_id, full_name, email, phone, address")
    .eq("id", data.customer_id)
    .maybeSingle();

  return {
    ...data,
    customer: customer ?? undefined,
  };
}


export async function getBookingRequestsByCustomerId(
  customerUuid: string
): Promise<BookingRequestListItem[]> {
  return getBookingRequests({ customerUuid: customerUuid });
}


export async function findCustomers(
  query: string
): Promise<{ error?: string; data?: CustomerSearchResult[] }> {
  const q = query.trim();
  if (q.length < 2) {
    return { data: [] };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_id, full_name, email, phone, address, role, created_at")
    .or(
      `full_name.ilike.%${q}%,customer_id.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Customer search error:", error);
    return { error: "Failed to search customers" };
  }

  return { data: data ?? [] };
}