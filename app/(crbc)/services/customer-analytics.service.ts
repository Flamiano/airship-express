import { createClient } from "../library/supabase/server";
import { getAllShipments } from "./shipment.service";
import { getSLAPoliciesFromStore } from "./sla-policies.store";

function recentMonthKeys(count: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-PH", { month: "short" }),
    });
  }
  return out;
}

const bucket = (iso: string) => iso.slice(0, 7);

export async function getCustomerAnalytics() {
  const supabase = await createClient();
  const months = recentMonthKeys(6);

  // ── Customers ────────────────────────────────────────────────
  const { data: customers } = await supabase
    .from("customers")
    .select("id, created_at, updated_at");

  const totalCustomers = customers?.length ?? 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeCustomers = customers?.filter(
    (c) => new Date(c.updated_at) >= thirtyDaysAgo
  ).length ?? 0;

  const customerGrowth = months.map(({ key, label }) => ({
    month: label,
    value: customers?.filter((c) => bucket(c.created_at) === key).length ?? 0,
  }));

  // ── Bookings ─────────────────────────────────────────────────
  const { data: bookings } = await supabase
    .from("booking_requests")
    .select("request_channel, status, created_at");

  const totalBookings = bookings?.length ?? 0;

  const CHANNEL_LABELS: Record<string, string> = {
    PORTAL: "Portal",
    WALK_IN: "Walk-in",
    PHONE_CALL: "Phone",
  };
  const bookingsByChannel = Object.entries(CHANNEL_LABELS).map(([ch, label]) => ({
    label,
    value: bookings?.filter((b) => b.request_channel === ch).length ?? 0,
  }));

  const bookingTrend = months.map(({ key, label }) => ({
    month: label,
    value: bookings?.filter((b) => bucket(b.created_at) === key).length ?? 0,
  }));

  // ── Interactions ─────────────────────────────────────────────
  const { data: interactions } = await supabase
    .from("customer_interactions")
    .select("interaction_type, created_at");

  const totalInteractions = interactions?.length ?? 0;

  const interactionTrend = months.map(({ key, label }) => ({
    month: label,
    value: interactions?.filter((i) => bucket(i.created_at) === key).length ?? 0,
  }));

  // ── Feedback ─────────────────────────────────────────────────
  const { data: feedback } = await supabase
    .from("shipment_feedback")
    .select("rating, submitted_at");

  const totalFeedback = feedback?.length ?? 0;
  const avgRating =
    totalFeedback > 0
      ? feedback!.reduce((sum, f) => sum + f.rating, 0) / totalFeedback
      : 0;

  const ratingDistribution = [1, 2, 3, 4, 5].map((r) => ({
    label: `${r}★`,
    value: feedback?.filter((f) => f.rating === r).length ?? 0,
  }));

  const feedbackTrend = months.map(({ key, label }) => ({
    month: label,
    value: feedback?.filter((f) => bucket(f.submitted_at) === key).length ?? 0,
  }));

  // ── Concerns ─────────────────────────────────────────────────
  const { data: concerns } = await supabase
    .from("concerns")
    .select("status, priority, created_at");

  const totalConcerns = concerns?.length ?? 0;
  const openConcerns = concerns?.filter((c) =>
    ["open", "in_progress", "assigned"].includes(c.status)
  ).length ?? 0;
  const resolvedConcerns = concerns?.filter((c) =>
    ["resolved", "closed"].includes(c.status)
  ).length ?? 0;

  const concernsByStatus = [
    { label: "Open", value: concerns?.filter((c) => c.status === "open").length ?? 0 },
    { label: "In Progress", value: concerns?.filter((c) => c.status === "in_progress").length ?? 0 },
    { label: "Resolved", value: concerns?.filter((c) => c.status === "resolved").length ?? 0 },
    { label: "Closed", value: concerns?.filter((c) => c.status === "closed").length ?? 0 },
  ];

  const concernTrend = months.map(({ key, label }) => ({
    month: label,
    value: concerns?.filter((c) => bucket(c.created_at) === key).length ?? 0,
  }));

  // ── Shipments ─────────────────────────────────────────────────
  const slaPolicies = await getSLAPoliciesFromStore();
  const shipments = await getAllShipments(slaPolicies);
  const deliveredShipments = shipments.filter((s) => s.actual_delivery !== null).length;
  const inTransitShipments = shipments.filter((s) => s.status === "In Transit").length;

  return {
    totalCustomers,
    activeCustomers,
    inactiveCustomers: totalCustomers - activeCustomers,
    customerGrowth,
    totalBookings,
    bookingsByChannel,
    bookingTrend,
    totalInteractions,
    interactionTrend,
    totalFeedback,
    avgRating: Math.round(avgRating * 10) / 10,
    ratingDistribution,
    feedbackTrend,
    totalConcerns,
    openConcerns,
    resolvedConcerns,
    concernsByStatus,
    concernTrend,
    deliveredShipments,
    inTransitShipments,
  };
}
