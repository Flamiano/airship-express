import { createClient } from "../library/supabase/server";
import { getBookingAnalytics } from "./analytics.service";
import { getSlaOverview } from "./shipment.service";
import { getCustomerAnalytics } from "./customer-analytics.service";


export type ReportType =
  | "customer-booking"
  | "freight-sla"
  | "customer-activity"
  | "customer-analytics";

export type ReportRow = Record<string, string | number | null>;


export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportBlock = {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
};

export type Report = {
  type: ReportType;
  title: string;
  description: string;
  /** Headline figures printed above the tables. */
  kpis: { label: string; value: string }[];
  blocks: ReportBlock[];
  /** Included in the PDF footer and the CSV filename. */
  generatedAt: string;
  /** True when any figure came from the Freight Ops mock adapter. */
  isDevData: boolean;
};

export type ReportFilters = {
  status?: string;
  channel?: string;
};

const fmt = (n: number) => n.toLocaleString("en-PH");

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/* ------------------------------------------------------------------ *
 * Builders
 * ------------------------------------------------------------------ */

async function customerBookingReport(
  filters: ReportFilters
): Promise<Report> {
  const supabase = await createClient();

  let query = supabase
    .from("booking_requests")
    .select(
      "request_id, request_channel, status, receiver_name, package_quantity, package_type, weight, created_at"
    )
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.channel && filters.channel !== "all") {
    query = query.eq("request_channel", filters.channel);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Customer & booking report error:", error);
  }

  const rows = data ?? [];
  const analytics = await getBookingAnalytics();

  const accepted = rows.filter((r) => r.status === "ACCEPTED").length;
  const pending = rows.filter((r) => r.status === "PENDING").length;
  const rejected = rows.filter(
    (r) => r.status === "REJECTED" || r.status === "CANCELLED"
  ).length;

  return {
    type: "customer-booking",
    title: "Customer & Booking Report",
    description:
      "Every booking request on the system, with channel, status and package detail.",
    kpis: [
      { label: "Bookings in report", value: fmt(rows.length) },
      { label: "Accepted", value: fmt(accepted) },
      { label: "Pending", value: fmt(pending) },
      { label: "Rejected / cancelled", value: fmt(rejected) },
      { label: "All-time bookings", value: fmt(analytics.totalBookings) },
    ],
    blocks: [
      {
        title: "Booking requests",
        columns: [
          { key: "request_id", label: "Request ID" },
          { key: "request_channel", label: "Channel" },
          { key: "status", label: "Status" },
          { key: "receiver_name", label: "Receiver" },
          { key: "package_quantity", label: "Qty" },
          { key: "package_type", label: "Type" },
          { key: "weight", label: "Weight (kg)" },
          { key: "created_at", label: "Submitted" },
        ],
        rows: rows.map((r) => ({
          request_id: r.request_id,
          request_channel: r.request_channel,
          status: r.status,
          receiver_name: r.receiver_name,
          package_quantity: r.package_quantity,
          package_type: r.package_type,
          weight: r.weight,
          created_at: shortDate(r.created_at),
        })),
      },
      {
        title: "Volume by channel (all time)",
        columns: [{ key: "channel", label: "Channel" }, { key: "count", label: "Bookings" }],
        rows: analytics.bookingsByChannel.map((c) => ({
          channel: c.label,
          count: c.count,
        })),
      },
    ],
    generatedAt: new Date().toISOString(),
    isDevData: false,
  };
}

async function freightSlaReport(filters: ReportFilters): Promise<Report> {
  const { shipments, records, summary } = await getSlaOverview();

  // Optional status filter, applied to the Freight Ops shipment status.
  const filtered = filters.status && filters.status !== "all"
    ? shipments.filter((s) => s.status === filters.status)
    : shipments;

  const delivered = filtered.filter((s) => s.actual_delivery !== null);
  const onTime = records.filter((r) => r.slaStatus === "On Time").length;
  const delayed = records.filter((r) => r.slaStatus === "Delayed").length;

  return {
    type: "freight-sla",
    title: "Freight / SLA Report",
    description:
      "Shipment execution and SLA outcomes. Shipment data is read from the Freight Operations adapter; CRBC does not store it.",
    kpis: [
      { label: "Shipments", value: fmt(filtered.length) },
      { label: "Delivered", value: fmt(delivered.length) },
      { label: "On time", value: fmt(onTime) },
      { label: "Delayed", value: fmt(delayed) },
      { label: "Overdue in-flight", value: fmt(summary.overdue) },
      { label: "SLA compliance", value: `${summary.compliance}%` },
    ],
    blocks: [
      {
        title: "Shipment detail",
        columns: [
          { key: "reference", label: "Shipment" },
          { key: "tracking_number", label: "Tracking no." },
          { key: "status", label: "Status" },
          { key: "origin", label: "Origin" },
          { key: "destination", label: "Destination" },
          { key: "expected_delivery", label: "Expected" },
          { key: "actual_delivery", label: "Delivered" },
          { key: "sla_status", label: "SLA" },
        ],
        rows: filtered.map((s) => ({
          reference: s.reference,
          tracking_number: s.tracking_number ?? "—",
          status: s.status,
          origin: s.origin,
          destination: s.destination,
          expected_delivery: s.expected_delivery ?? "—",
          actual_delivery: s.actual_delivery
            ? shortDate(s.actual_delivery)
            : "—",
          sla_status: s.sla_status,
        })),
      },
      {
        title: "SLA outcome by region",
        columns: [
          { key: "region", label: "Region" },
          { key: "onTime", label: "On time" },
          { key: "delayed", label: "Delayed" },
          { key: "pending", label: "Pending" },
        ],
        rows: regionBreakdown(records),
      },
    ],
    generatedAt: new Date().toISOString(),
    isDevData: shipments.some((s) => s.source === "mock"),
  };
}

function regionBreakdown(
  records: Awaited<ReturnType<typeof getSlaOverview>>["records"]
): ReportRow[] {
  const regions = [...new Set(records.map((r) => r.region))];
  return regions.map((region) => {
    const inRegion = records.filter((r) => r.region === region);
    return {
      region: region ?? "Not evaluable",
      onTime: inRegion.filter((r) => r.slaStatus === "On Time").length,
      delayed: inRegion.filter((r) => r.slaStatus === "Delayed").length,
      pending: inRegion.filter((r) => r.slaStatus === "Pending").length,
    };
  });
}

async function customerActivityReport(
  filters: ReportFilters
): Promise<Report> {
  const supabase = await createClient();

  let query = supabase
    .from("customer_interactions")
    .select(
      "id, customer_id, interaction_type, notes, interaction_date, created_at"
    )
    .order("interaction_date", { ascending: false });

  if (filters.channel && filters.channel !== "all") {
    query = query.eq("interaction_type", filters.channel);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Customer activity report error:", error);
  }

  const rows = data ?? [];
  const analytics = await getBookingAnalytics();

  // Resolve customer codes in one pass rather than per row.
  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const { data: customers } = await supabase
    .from("customers")
    .select("id, customer_id, full_name")
    .in("id", customerIds.length ? customerIds : ["00000000-0000-0000-0000-000000000000"]);

  const nameById = new Map(
    (customers ?? []).map((c) => [c.id, c])
  );

  return {
    type: "customer-activity",
    title: "Customer Activity Report",
    description:
      "Recorded customer interactions across every channel — portal, walk-in and phone.",
    kpis: [
      { label: "Interactions in report", value: fmt(rows.length) },
      { label: "All-time interactions", value: fmt(analytics.totalInteractions) },
    ],
    blocks: [
      {
        title: "Interaction log",
        columns: [
          { key: "interaction_date", label: "Date" },
          { key: "full_name", label: "Customer" },
          { key: "customer_id", label: "Customer ID" },
          { key: "interaction_type", label: "Channel" },
          { key: "notes", label: "Notes" },
        ],
        rows: rows.map((r) => {
          const customer = nameById.get(r.customer_id);
          return {
            interaction_date: shortDate(r.interaction_date ?? r.created_at),
            full_name: customer?.full_name ?? "—",
            customer_id: customer?.customer_id ?? "—",
            interaction_type: r.interaction_type,
            notes: r.notes ?? "—",
          };
        }),
      },
      {
        title: "Volume by channel (all time)",
        columns: [{ key: "channel", label: "Channel" }, { key: "count", label: "Interactions" }],
        rows: analytics.interactionsByType.map((c) => ({
          channel: c.label,
          count: c.count,
        })),
      },
    ],
    generatedAt: new Date().toISOString(),
    isDevData: false,
  };
}

async function customerAnalyticsReport(): Promise<Report> {
  const data = await getCustomerAnalytics();

  const resolutionRate = data.totalConcerns > 0
    ? `${Math.round((data.resolvedConcerns / data.totalConcerns) * 100)}%`
    : "—";

  return {
    type: "customer-analytics",
    title: "Customer Analytics Report",
    description:
      "Customer engagement, satisfaction, and service performance across all channels.",
    kpis: [
      { label: "Total Customers", value: fmt(data.totalCustomers) },
      { label: "Active (30d)", value: fmt(data.activeCustomers) },
      { label: "Total Bookings", value: fmt(data.totalBookings) },
      { label: "Avg. Rating", value: data.totalFeedback > 0 ? `${data.avgRating} / 5` : "—" },
      { label: "Open Concerns", value: fmt(data.openConcerns) },
      { label: "Resolution Rate", value: resolutionRate },
    ],
    blocks: [
      {
        title: "Customer Growth (last 6 months)",
        columns: [{ key: "month", label: "Month" }, { key: "value", label: "New Customers" }],
        rows: data.customerGrowth,
      },
      {
        title: "Booking Trend (last 6 months)",
        columns: [{ key: "month", label: "Month" }, { key: "value", label: "Bookings" }],
        rows: data.bookingTrend,
      },
      {
        title: "Bookings by Channel",
        columns: [{ key: "label", label: "Channel" }, { key: "value", label: "Bookings" }],
        rows: data.bookingsByChannel,
      },
      {
        title: "Interaction Trend (last 6 months)",
        columns: [{ key: "month", label: "Month" }, { key: "value", label: "Interactions" }],
        rows: data.interactionTrend,
      },
      {
        title: "Rating Distribution",
        columns: [{ key: "label", label: "Rating" }, { key: "value", label: "Reviews" }],
        rows: data.ratingDistribution,
      },
      {
        title: "Feedback Trend (last 6 months)",
        columns: [{ key: "month", label: "Month" }, { key: "value", label: "Reviews" }],
        rows: data.feedbackTrend,
      },
      {
        title: "Concerns by Status",
        columns: [{ key: "label", label: "Status" }, { key: "value", label: "Count" }],
        rows: data.concernsByStatus,
      },
      {
        title: "Concern Volume Trend (last 6 months)",
        columns: [{ key: "month", label: "Month" }, { key: "value", label: "Concerns" }],
        rows: data.concernTrend,
      },
    ],
    generatedAt: new Date().toISOString(),
    isDevData: false,
  };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export const REPORT_TYPES: ReportType[] = [
  "customer-booking",
  "freight-sla",
  "customer-activity",
  "customer-analytics",
];

export const REPORT_LABELS: Record<ReportType, string> = {
  "customer-booking": "Customer & Booking Report",
  "freight-sla": "Freight / SLA Report",
  "customer-activity": "Customer Activity Report",
  "customer-analytics": "Customer Analytics Report",
};

export async function getReport(
  type: ReportType,
  filters: ReportFilters = {}
): Promise<Report> {
  switch (type) {
    case "freight-sla":
      return freightSlaReport(filters);
    case "customer-activity":
      return customerActivityReport(filters);
    case "customer-analytics":
      return customerAnalyticsReport();
    case "customer-booking":
    default:
      return customerBookingReport(filters);
  }
}


export function reportToCsv(report: Report): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines: string[] = [];
  lines.push(escape(report.title));
  lines.push(escape(`Generated: ${new Date(report.generatedAt).toISOString()}`));
  lines.push("");
  lines.push("Summary");
  for (const kpi of report.kpis) {
    lines.push(`${escape(kpi.label)},${escape(kpi.value)}`);
  }

  for (const block of report.blocks) {
    lines.push("");
    lines.push(escape(block.title));
    lines.push(block.columns.map((c) => escape(c.label)).join(","));
    for (const row of block.rows) {
      lines.push(block.columns.map((c) => escape(row[c.key])).join(","));
    }
  }

  return lines.join("\r\n");
}
