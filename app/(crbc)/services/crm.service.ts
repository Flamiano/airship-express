import { Customers } from "../types/customer"
import type {
  BookingRequest,
  CustomerInteraction,
} from "../types/booking-request"
import {
  INTERACTION_CHANNELS,
  type InteractionChannel,
} from "../types/booking-request"
import { createClient } from "../library/supabase/server";

type InteractionType = InteractionChannel
const INTERACTION_TYPES = INTERACTION_CHANNELS
export { INTERACTION_TYPES }
export type { InteractionType }

export const DATE_PRESETS = ["today", "week", "month", "year"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

export interface CustomerInteractionRow {
  id: string;
  customer_id: string;
  interaction_type: InteractionType;
  notes: string | null;
  interaction_date: string;
  created_at: string;
  customers: { customer_id: string; full_name: string } | null;
}

export interface GetInteractionsParams {
  page?: number;
  pageSize?: number;
  customerId?: string;
  interactionType?: InteractionType;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedInteractionsResult {
  data: CustomerInteractionRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/** Start of today / this week (Monday) / this month / this year, as an ISO string. */
export function getPresetStart(preset: DatePreset): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (preset === "week") {
    const day = start.getDay(); // 0 = Sunday
    start.setDate(start.getDate() - ((day + 6) % 7)); // back to Monday
  } else if (preset === "month") {
    start.setDate(1);
  } else if (preset === "year") {
    start.setMonth(0, 1);
  }

  return start.toISOString();
}

export async function getCustomerInteractions(
  params: GetInteractionsParams = {}
): Promise<PaginatedInteractionsResult> {
  const supabase = await createClient();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("customer_interactions")
    .select(
      `
      id,
      customer_id,
      interaction_type,
      notes,
      interaction_date,
      created_at,
      customers:customer_id (
        customer_id,
        full_name
      )
    `,
      { count: "exact" }
    )
    .order("interaction_date", { ascending: false })
    .order("id", { ascending: false }); // tiebreaker so pages stay stable

  if (params.customerId) query = query.eq("customer_id", params.customerId);
  if (params.interactionType) query = query.eq("interaction_type", params.interactionType);
  if (params.dateFrom) query = query.gte("interaction_date", params.dateFrom);
  if (params.dateTo) query = query.lte("interaction_date", params.dateTo);

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("Fetch customer interactions error:", error);
    throw new Error("Failed to fetch customer interactions");
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    // cast because Supabase can't infer a many-to-one join as an object without generated types
    data: (data ?? []) as unknown as CustomerInteractionRow[],
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export async function getAllCustomers(): Promise<Customers[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select(`
      id,
      customer_id,
      full_name,
      email,
      phone,
      province,
      city,
      barangay,
      full_address,
      role,
      created_at,
      updated_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error)
  }

  // Add computed status based on recent activity (updated within 30 days = Active)
  const customersWithStatus = (data ?? []).map((customer) => ({
    ...customer,
    status: getCustomerStatusFromUpdatedAt(customer.updated_at),
  }));

  // Sort: Active first, then by last activity descending
  return customersWithStatus.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "Active" ? -1 : 1;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function getCustomerStatusFromUpdatedAt(updatedAt: string): "Active" | "Inactive" {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return new Date(updatedAt) >= thirtyDaysAgo ? "Active" : "Inactive";
}

async function resolveCustomerUuid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerIdCode: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("id")
    .eq("customer_id", customerIdCode)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to resolve customer");
  }

  return data?.id ?? null;
}

// Channel is transactional history
export async function getInteractionsByCustomerId(
  customerId: string
): Promise<CustomerInteraction[]> {
  const supabase = await createClient();

  const uuid = await resolveCustomerUuid(supabase, customerId);
  if (!uuid) return [];

  const { data, error } = await supabase
    .from("customer_interactions")
    .select(
      `
      id,
      customer_id,
      interaction_type,
      notes,
      interaction_date,
      created_at
      `
    )
    .eq("customer_id", uuid)
    .order("interaction_date", { ascending: false });
     console.log("Fetched interactions:", uuid); //booking request table customer_id uuid is a foreign key to customers.id
  if (error) {
    console.error("Fetch customer interactions error:", error);
    throw new Error("Failed to fetch customer interactions");
  }

  return data;
}


export async function getBookingRequestsByCustomerId(
  customerId: string
): Promise<BookingRequest[]> {
  const supabase = await createClient();

  const uuid = await resolveCustomerUuid(supabase, customerId);
  if (!uuid) return [];

  const { data, error } = await supabase
    .from("booking_requests")
    .select("*")
    .eq("customer_id", uuid)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch booking requests error:", error);
    throw new Error("Failed to fetch booking requests");
  }

  return data;
}


/** Customers who have a portal account (auth_user_id set) — shown in the staff chat inbox. */
export async function getOnlineCustomers(): Promise<Customers[]> {
  const supabase = await createClient();

  // Fetch customers with portal accounts
  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, customer_id, full_name, email, auth_user_id, created_at, updated_at, role")
    .not("auth_user_id", "is", null)
    .order("updated_at", { ascending: false });

  if (customersError) throw new Error("Failed to fetch online customers");

  if (!customers || customers.length === 0) {
    return [];
  }

  // Fetch all unread messages for these customers in one query
  const authUserIds = customers.map((c) => c.auth_user_id).filter(Boolean);
  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("id, conversation_id, sender_role, read_at, created_at")
    .in("conversation_id", authUserIds)
    .is("read_at", null)
    .eq("sender_role", "customer");

  if (messagesError) {
    console.error("Failed to fetch unread messages:", messagesError);
    // Don't throw — return customers without unread counts
  }

  // Fetch latest message timestamp per conversation for sorting
  const { data: latestMessages, error: latestError } = await supabase
    .from("chat_messages")
    .select("conversation_id, created_at")
    .in("conversation_id", authUserIds)
    .order("created_at", { ascending: false });

  if (latestError) {
    console.error("Failed to fetch latest messages:", latestError);
  }

  // Build lookup maps
  const unreadCounts = new Map<string, number>();
  (messages ?? []).forEach((m) => {
    const count = unreadCounts.get(m.conversation_id) ?? 0;
    unreadCounts.set(m.conversation_id, count + 1);
  });

  const latestMessageAt = new Map<string, string>();
  (latestMessages ?? []).forEach((m) => {
    if (!latestMessageAt.has(m.conversation_id)) {
      latestMessageAt.set(m.conversation_id, m.created_at);
    }
  });

  // Transform customers with unread counts and latest activity
  return customers.map((customer) => ({
    ...customer,
    unread_count: customer.auth_user_id ? unreadCounts.get(customer.auth_user_id) ?? 0 : 0,
    latest_message_at: customer.auth_user_id ? latestMessageAt.get(customer.auth_user_id) ?? customer.updated_at : customer.updated_at,
  })) as Customers[];
}

export async function getCustomerById( id: string ): Promise<Customers | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select(
      `
      id,
      customer_id,
      full_name,
      email,
      phone,
      province,
      city,
      barangay,
      full_address,
      role,
      created_at,
      updated_at
      `
    )
    .eq("customer_id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to fetch customer");
  }

  return (data ?? null) as Customers | null;
}

export async function getShipmentsByCustomerId(customerId: string): Promise<BookingRequest[]> {
  const supabase = await createClient();

  // Resolve customer UUID from customer_id code
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return [];
  }

  const { data, error } = await supabase
    .from("booking_requests")
    .select("*")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch booking requests error:", error);
    throw new Error("Failed to fetch booking requests");
  }

  return data ?? [];
}

/**
 * Every booking request, newest first.
 *
 * Named `getAllBookingRequests` to avoid collision with
 * `shipment.service.getAllShipments()`, which returns real Freight Ops
 * shipment execution data. These are different sources: this reads the
 * CRBC-owned `booking_requests` table, that reads the Freight Ops adapter.
 */
export async function getAllBookingRequests(): Promise<BookingRequest[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booking_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch all booking requests error:", error);
    throw new Error("Failed to fetch booking requests");
  }

  return data ?? [];
}

export async function getDashboardMetrics() {
  const supabase = await createClient();

  // Total customers
  const { count: totalCustomers, error: countError } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error("Failed to fetch customer count");
  }

  // Active customers (updated in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: activeCustomers, error: activeError } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .gte("updated_at", thirtyDaysAgo.toISOString());

  if (activeError) {
    throw new Error("Failed to fetch active customer count");
  }

  // Active booking requests (PENDING, ACCEPTED, SUBMITTED)
  const { count: activeShipments, error: shipmentError } = await supabase
    .from("booking_requests")
    .select("*", { count: "exact", head: true })
    .in("status", ["PENDING", "ACCEPTED", "SUBMITTED"]);

  const { count: rejectedRequests, error: rejectedError } = await supabase
    .from("booking_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "REJECTED");

  if (rejectedError) {
    throw new Error("Failed to fetch rejected request count");
  }

  if (shipmentError) {
    throw new Error("Failed to fetch active shipment count");
  }

  // New customers this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: newCustomersThisMonth, error: newCustError } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfMonth.toISOString());

  if (newCustError) {
    throw new Error("Failed to fetch new customer count");
  }

  return {
    totalCustomers: totalCustomers ?? 0,
    activeCustomers: activeCustomers ?? 0,
    activeShipments: activeShipments ?? 0,
    rejectedRequests: rejectedRequests ?? 0,
    newCustomersThisMonth: newCustomersThisMonth ?? 0,
  };
}

