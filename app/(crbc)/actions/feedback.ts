"use server";

import { createClient } from "../library/supabase/server";
import { getCurrentUser } from "../library/auth/getCurrentUser";
import { getShipmentsByCustomerId } from "../services/shipment.service";
import { getSLAPoliciesFromStore } from "../services/sla-policies.store";
import type { Feedback, FeedbackShipment } from "../types/feedback";

type FeedbackRow = {
  id: string;
  booking_request_id: string;
  customer_id: string;
  tracking_number: string | null;
  reference: string;
  origin: string | null;
  destination: string | null;
  delivered_at: string | null;
  rating: number;
  comment: string | null;
  submitted_at: string;
  customer: { full_name: string | null; email: string | null } | null;
};

// ─── Customer actions ────────────────────────────────────────────────────────

/**
 * Returns delivered shipments for the logged-in customer, plus the IDs of
 * bookings that already have feedback submitted.
 */
export async function getCustomerDeliveredShipments(): Promise<{
  shipments: FeedbackShipment[];
  submittedIds: string[];
  error?: string;
}> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.profile.role !== "customer" || !currentUser.customer) {
    return { shipments: [], submittedIds: [], error: "Unauthorized" };
  }

  const supabase = await createClient();
  const customerId = currentUser.customer.customer_id; // e.g. "CUS-0001"
  const customerUuid = currentUser.customer.id;

  // Load delivered shipments from freight ops (same logic as shipment-history page)
  const slaPolicies = await getSLAPoliciesFromStore();
  const allShipments = await getShipmentsByCustomerId(customerId, slaPolicies);

  // Also fetch booking_requests with status DELIVERED that have no freight ops match
  const { data: deliveredBookings } = await supabase
    .from("booking_requests")
    .select("id, request_id, receiver_name, receiver_province, receiver_city, created_at")
    .eq("customer_id", customerUuid)
    .eq("status", "DELIVERED");

  const freightOpsRequestIds = new Set(allShipments.map((s) => s.request_id));

  type DeliveredItem = {
    request_id: string;
    tracking_number: string | null;
    reference: string;
    origin: string;
    destination: string;
    actual_delivery: string;
    receiver_name: string | null;
  };

  const freightDelivered: DeliveredItem[] = allShipments
    .filter((s) => s.actual_delivery !== null)
    .map((s) => ({
      request_id: s.request_id,
      tracking_number: s.tracking_number ?? null,
      reference: s.reference,
      origin: s.origin,
      destination: s.destination,
      actual_delivery: s.actual_delivery as string,
      receiver_name: s.receiver_name ?? null,
    }));

  const bookingOnlyDelivered: DeliveredItem[] = (deliveredBookings ?? [])
    .filter((b) => !freightOpsRequestIds.has(b.request_id))
    .map((b) => ({
      request_id: b.request_id,
      tracking_number: null,
      reference: b.request_id,
      origin: "—",
      destination: [b.receiver_city, b.receiver_province].filter(Boolean).join(", ") || "—",
      actual_delivery: b.created_at,
      receiver_name: b.receiver_name,
    }));

  // Merge: freight ops delivered + booking-only delivered (no freight ops record)
  const delivered: DeliveredItem[] = [...freightDelivered, ...bookingOnlyDelivered];

  // Get booking UUIDs for delivered shipments so we can check existing feedback
  const bookingRequestIds = delivered
    .map((s) => s.request_id)
    .filter(Boolean);

  let submittedIds: string[] = [];
  if (bookingRequestIds.length > 0) {
    // Look up the booking UUIDs from request_ids
    const { data: bookings } = await supabase
      .from("booking_requests")
      .select("id, request_id")
      .in("request_id", bookingRequestIds);

    const bookingUuids = (bookings ?? []).map((b) => b.id);

    if (bookingUuids.length > 0) {
      const { data: existing } = await supabase
        .from("shipment_feedback")
        .select("booking_request_id")
        .eq("customer_id", customerUuid)
        .in("booking_request_id", bookingUuids);

      // Map back to request_ids for the UI
      const submittedUuids = new Set((existing ?? []).map((e) => e.booking_request_id));
      submittedIds = (bookings ?? [])
        .filter((b) => submittedUuids.has(b.id))
        .map((b) => b.request_id);
    }
  }

  const shipments: FeedbackShipment[] = delivered.map((s) => ({
    shipment_id: s.request_id, // use request_id as the stable UI key
    tracking_number: s.tracking_number ?? s.reference,
    reference: s.reference,
    origin: s.origin,
    destination: s.destination,
    delivered_at: s.actual_delivery,
    receiver_name: s.receiver_name ?? "",
    customer_id: customerUuid,
    customer_email: currentUser.profile.email,
  }));

  return { shipments, submittedIds };
}

/**
 * Submits feedback for a delivered shipment.
 * `shipmentId` here is the booking request_id (e.g. "REQ-0001").
 */
export async function submitFeedback(input: {
  shipmentId: string; // booking request_id
  rating: number;
  comment: string;
}): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.profile.role !== "customer" || !currentUser.customer) {
    return { success: false, error: "Unauthorized" };
  }

  if (input.rating < 1 || input.rating > 5) {
    return { success: false, error: "Rating must be between 1 and 5." };
  }

  const supabase = await createClient();
  const customerUuid = currentUser.customer.id;

  // Resolve booking UUID from request_id
  const { data: booking, error: bookingError } = await supabase
    .from("booking_requests")
    .select("id, request_id, customer_id")
    .eq("request_id", input.shipmentId)
    .eq("customer_id", customerUuid)
    .maybeSingle();

  if (bookingError || !booking) {
    return { success: false, error: "Shipment not found or access denied." };
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("shipment_feedback")
    .select("id")
    .eq("booking_request_id", booking.id)
    .eq("customer_id", customerUuid)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Feedback already submitted for this shipment." };
  }

  // Get shipment details for denormalisation
  const slaPolicies = await getSLAPoliciesFromStore();
  const customerId = currentUser.customer.customer_id;
  const allShipments = await getShipmentsByCustomerId(customerId, slaPolicies);
  const shipment = allShipments.find((s) => s.request_id === input.shipmentId);

  const { error: insertError } = await supabase
    .from("shipment_feedback")
    .insert({
      booking_request_id: booking.id,
      customer_id: customerUuid,
      tracking_number: shipment?.tracking_number ?? shipment?.reference ?? null,
      reference: input.shipmentId,
      origin: shipment?.origin ?? null,
      destination: shipment?.destination ?? null,
      delivered_at: shipment?.actual_delivery ?? null,
      rating: input.rating,
      comment: input.comment.trim() || null,
    });

  if (insertError) {
    console.error("Submit feedback error:", insertError);
    return { success: false, error: "Failed to submit feedback. Please try again." };
  }

  return { success: true };
}

/**
 * Returns all feedback submitted by the logged-in customer.
 */
export async function getCustomerFeedback(): Promise<{
  feedback: Feedback[];
  error?: string;
}> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.profile.role !== "customer" || !currentUser.customer) {
    return { feedback: [], error: "Unauthorized" };
  }

  const supabase = await createClient();
  const customerUuid = currentUser.customer.id;

  const { data, error } = await supabase
    .from("shipment_feedback")
    .select(`
      id,
      booking_request_id,
      customer_id,
      tracking_number,
      reference,
      origin,
      destination,
      delivered_at,
      rating,
      comment,
      submitted_at
    `)
    .eq("customer_id", customerUuid)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Get customer feedback error:", error);
    return { feedback: [], error: "Failed to load feedback." };
  }

  const feedback: Feedback[] = (data ?? []).map((row) => ({
    id: row.id,
    shipment_id: row.reference, // request_id used as shipment_id in UI
    customer_id: row.customer_id,
    customer_name: currentUser.profile.full_name ?? currentUser.profile.email,
    customer_email: currentUser.profile.email,
    tracking_number: row.tracking_number ?? row.reference,
    reference: row.reference,
    origin: row.origin ?? "",
    destination: row.destination ?? "",
    delivered_at: row.delivered_at ?? "",
    rating: row.rating as Feedback["rating"],
    comment: row.comment,
    submitted_at: row.submitted_at,
  }));

  return { feedback };
}

// ─── Staff actions ───────────────────────────────────────────────────────────

/**
 * Returns all feedback with optional filters. Staff/admin/super_admin only.
 */
export async function getAllFeedback(filters?: {
  rating?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ feedback: Feedback[]; error?: string }> {
  const currentUser = await getCurrentUser();
  if (
    !currentUser ||
    !["staff", "admin", "super_admin"].includes(currentUser.profile.role)
  ) {
    return { feedback: [], error: "Unauthorized" };
  }

  const supabase = await createClient();

  let query = supabase
    .from("shipment_feedback")
    .select(`
      id,
      booking_request_id,
      customer_id,
      tracking_number,
      reference,
      origin,
      destination,
      delivered_at,
      rating,
      comment,
      submitted_at,
      customer:customers!shipment_feedback_customer_id_fkey (
        full_name,
        email
      )
    `)
    .order("submitted_at", { ascending: false });

  if (filters?.rating && filters.rating !== "all") {
    query = query.eq("rating", parseInt(filters.rating, 10));
  }

  if (filters?.dateFrom) {
    query = query.gte("submitted_at", new Date(filters.dateFrom).toISOString());
  }

  if (filters?.dateTo) {
    // Make dateTo inclusive by going to end of that day
    const to = new Date(filters.dateTo);
    to.setDate(to.getDate() + 1);
    query = query.lt("submitted_at", to.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Get all feedback error:", error);
    return { feedback: [], error: "Failed to load feedback." };
  }

  const rows = (data ?? []) as unknown as FeedbackRow[];

  const feedback: Feedback[] = rows.map((row) => ({
    id: row.id,
    shipment_id: row.reference,
    customer_id: row.customer_id,
    customer_name: row.customer?.full_name ?? "Unknown",
    customer_email: row.customer?.email ?? "—",
    tracking_number: row.tracking_number ?? row.reference,
    reference: row.reference,
    origin: row.origin ?? "",
    destination: row.destination ?? "",
    delivered_at: row.delivered_at ?? "",
    rating: row.rating as Feedback["rating"],
    comment: row.comment,
    submitted_at: row.submitted_at,
  }));

  return { feedback };
}