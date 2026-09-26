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
  sender: {
    name: string;
    phone: string | null;
    address: string | null;
  };
  receiver: {
    name: string;
    contact: string | null;
    address: string;
  };
  package: {
    quantity: number;
    type: string;
    category: string | null;
    weight: number | null;
    dimensions: {
      length_cm: number;
      width_cm: number;
      height_cm: number;
    } | null;
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
 
  sender: {
    name: string;
    phone: string | null;
    address: string | null;
  };
  receiver: {
    name: string;
    contact: string | null;
    address: string;
  };
  package: {
    quantity: number;
    type: string;
    category: string | null;
    weight: number | null;
    dimensions: {
      length_cm: number;
      width_cm: number;
      height_cm: number;
    } | null;
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
    .eq("id", authUserId)
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
    supabaseClient?: any;
  } = {}
): Promise<BookingRequestListItem[]> {
  const supabase = options.supabaseClient ?? (await createClient());

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
      updated_at,
      customers:customer_id (
        full_name,
        phone,
        address
      )
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

  // Shape rows into the shipment-ready payload (preserves flat fields
  // for internal CRM consumers, adds nested groups for Freight Ops API).
  return (data ?? []).map((row: any) => ({
    id: row.id,
    request_id: row.request_id,
    customer_id: row.customer_id,
    request_channel: row.request_channel,
    receiver_name: row.receiver_name,
    receiver_contact: row.receiver_contact,
    receiver_address: row.receiver_address,
    package_quantity: row.package_quantity,
    package_type: row.package_type,
    item_category: row.item_category,
    weight: row.weight,
    dimensions: row.dimensions,
    declared_value: row.declared_value,
    airship_packaging_requested: row.airship_packaging_requested,
    remarks: row.remarks,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sender: {
      name: row.customers?.full_name ?? "",
      phone: row.customers?.phone ?? null,
      address: row.customers?.address ?? null,
    },
    receiver: {
      name: row.receiver_name,
      contact: row.receiver_contact,
      address: row.receiver_address,
    },
    package: {
      quantity: row.package_quantity,
      type: row.package_type,
      category: row.item_category,
      weight: row.weight,
      dimensions: row.dimensions,
    },
  }));
}


export async function getBookingRequestById(
  requestId: string,
  supabaseClient?: any
): Promise<BookingRequest | null> {
  const supabase = supabaseClient ?? (await createClient());

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
      updated_at,
      customers:customer_id (
        full_name,
        phone,
        address
      )
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

  return {
    id: data.id,
    request_id: data.request_id,
    customer_id: data.customer_id,
    request_channel: data.request_channel,
    receiver_name: data.receiver_name,
    receiver_contact: data.receiver_contact,
    receiver_address: data.receiver_address,
    package_quantity: data.package_quantity,
    package_type: data.package_type,
    item_category: data.item_category,
    weight: data.weight,
    dimensions: data.dimensions,
    declared_value: data.declared_value,
    airship_packaging_requested: data.airship_packaging_requested,
    remarks: data.remarks,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at,
    sender: {
      name: data.customers?.full_name ?? "",
      phone: data.customers?.phone ?? null,
      address: data.customers?.address ?? null,
    },
    receiver: {
      name: data.receiver_name,
      contact: data.receiver_contact,
      address: data.receiver_address,
    },
    package: {
      quantity: data.package_quantity,
      type: data.package_type,
      category: data.item_category,
      weight: data.weight,
      dimensions: data.dimensions,
    },
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