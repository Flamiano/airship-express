import { createClient } from "../library/supabase/server";
import {
  getShipmentsByRequestIds,
  getAllFreightOpsShipments,
  getShipmentTracking,
  evaluationDate,
} from "./freight-ops.service";
import { getSLAPoliciesFromStore } from "./sla-policies.store";
import type { SLAPolicy, SlaTier, SLARecord } from "../types/sla";
import type { ShipmentViewModel } from "../types/freight-ops";


export interface BookingWithCustomer {
  id: string;
  request_id: string;
  customer_id: string;
  receiver_name: string;
  receiver_province: string | null;
  receiver_city: string | null;
  receiver_barangay: string | null;
  receiver_full_address: string | null;
  package_quantity: number;
  package_type: string;
  item_category: string | null;
  weight: number | null;
  dimensions: { length_cm: number; width_cm: number; height_cm: number } | null;
  declared_value: number | null;
  airship_packaging_requested: boolean;
  remarks: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  customers: {
    customer_id: string;
    full_name: string;
  } | null;
}


export interface ShipmentWithDetails {
  request_id: string;
  shipment_id: string;
  reference: string;
  tracking_number: string | null;
  status: ShipmentViewModel["status"];
  progress: number;
  current_location: string | null;
  origin: string;
  destination: string;
  mode: string;
  platform: string;
  service_type: string;
  booking_created_at: string;
  expected_delivery_date: string | null;
  sla_started_at: string;
  actual_delivery: string | null;
  status_updated_at: string | null;

  // From booking_requests (CRBC-owned)
  customer_id: string;
  receiver_name: string;
  receiver_address: string;
  package_quantity: number;
  package_type: string;
  item_category: string | null;
  weight: number | null;
  dimensions: { length_cm: number; width_cm: number; height_cm: number } | null;
  declared_value: number | null;
  airship_packaging_requested: boolean;
  remarks: string | null;
  booking_status: string;
  customer_code: string;
  customer_name: string;
  region: SlaTier | null;
  expected_delivery: string | null;
  days_variance: number | null;
  sla_status: ShipmentViewModel["slaStatus"];
  source: ShipmentViewModel["source"];
}

async function fetchBookings(): Promise<BookingWithCustomer[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booking_requests")
    .select(`
      id,
      request_id,
      customer_id,
      receiver_name,
      receiver_province,
      receiver_city,
      receiver_barangay,
      receiver_full_address,
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
        customer_id,
        full_name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch booking requests error:", error);
    throw new Error("Failed to fetch booking requests");
  }

  return (data ?? []) as unknown as BookingWithCustomer[];
}

async function toShipmentWithDetails(
  view: ShipmentViewModel
): Promise<ShipmentWithDetails> {
  // Newest Freight Ops tracking event, replacing the fabricated
  // `last_tracking_update` field.
  const events = await getShipmentTracking(view.shipmentId);
  const statusUpdatedAt = events.length ? events[events.length - 1].created_at : null;

  return {
    request_id: view.requestId,
    shipment_id: view.shipmentId,
    reference: view.reference,
    tracking_number: view.trackingNumber,

    status: view.status,
    progress: view.progress,
    current_location: view.currentLocation,
    origin: view.origin,
    destination: view.destination,
    mode: view.mode,
    platform: view.platform,
    service_type: view.serviceType,

    booking_created_at: view.bookingCreatedAt,
    expected_delivery_date: view.expectedDeliveryDate,
    sla_started_at: view.slaStartedAt,
    actual_delivery: view.actualDeliveryAt,
    status_updated_at: statusUpdatedAt,

    customer_id: view.customerId,
    receiver_name: view.receiverName,
    receiver_address: view.receiverAddress,
    package_quantity: view.packageQuantity,
    package_type: view.packageType,
    item_category: view.itemCategory,
    weight: view.weight,
    dimensions: view.dimensions,
    declared_value: view.declaredValue,
    airship_packaging_requested: view.airshipPackagingRequested,
    remarks: view.remarks,
    booking_status: view.bookingStatus,

    customer_code: view.customerCode,
    customer_name: view.customerName,

    region: view.region,
    expected_delivery: view.expectedDelivery,
    days_variance: view.daysVariance,
    sla_status: view.slaStatus,

    source: view.source,
  };
}

export async function getAllShipments(
  slaPolicies: SLAPolicy[]
): Promise<ShipmentWithDetails[]> {
  const bookings = await fetchBookings();
  if (!bookings.length) return [];

  const views = await getShipmentsByRequestIds([], slaPolicies, bookings);

  return Promise.all(
    views.map((view) => toShipmentWithDetails(view))
  );
}

/** Get shipment by Freight Ops shipment id. */
export async function getShipmentById(
  shipmentId: string,
  slaPolicies: SLAPolicy[]
): Promise<ShipmentWithDetails | null> {
  const all = await getAllShipments(slaPolicies);
  return all.find((s) => s.shipment_id === shipmentId) ?? null;
}

/** Get shipment by CRBC booking request id (the integration correlation key). */
export async function getShipmentByRequestId(
  requestId: string,
  slaPolicies: SLAPolicy[]
): Promise<ShipmentWithDetails | null> {
  const bookings = await fetchBookings();
  const booking = bookings.find((b) => b.request_id === requestId);
  if (!booking) return null;

  const views = await getShipmentsByRequestIds([requestId], slaPolicies, [booking]);
  if (!views.length) return null;

  return toShipmentWithDetails(views[0]);
}

/** Get shipments for a specific customer. */
export async function getShipmentsByCustomerId(
  customerId: string,
  slaPolicies: SLAPolicy[]
): Promise<ShipmentWithDetails[]> {
  const all = await getAllShipments(slaPolicies);
  return all.filter((s) => s.customer_code === customerId);
}

/** Get shipments by a real Freight Ops shipment_status value. */
export async function getShipmentsByStatus(
  status: ShipmentViewModel["status"],
  slaPolicies: SLAPolicy[]
): Promise<ShipmentWithDetails[]> {
  const all = await getAllShipments(slaPolicies);
  return all.filter((s) => s.status === status);
}

/** Freight Ops shipments with no CRBC booking attached. */
export async function getUnlinkedFreightOpsShipments(
  slaPolicies: SLAPolicy[]
): Promise<ShipmentViewModel[]> {
  return getAllFreightOpsShipments(slaPolicies);
}


export function summarizeSla(shipments: ShipmentWithDetails[]) {
  const delivered = shipments.filter((s) => s.actual_delivery !== null);

  const onTime = delivered.filter((s) => s.sla_status === "On Time").length;
  const late = delivered.filter((s) => s.sla_status === "Delayed").length;

  const overdue = shipments.filter(
    (s) => s.actual_delivery === null && s.sla_status === "Delayed"
  ).length;

  const pending = shipments.filter(
    (s) => s.actual_delivery === null && s.sla_status === "Pending"
  ).length;

  const notEvaluable = shipments.filter((s) => s.region === null).length;

  const compliance =
    delivered.length > 0 ? Math.round((onTime / delivered.length) * 100) : 0;

  return {
    total: shipments.length,
    delivered: delivered.length,
    onTime,
    late,
    overdue,
    pending,
    notEvaluable,
    compliance,
    evaluationDate: evaluationDate(),
  };
}


export async function getSlaOverview(): Promise<{
  shipments: ShipmentWithDetails[];
  records: SLARecord[];
  summary: ReturnType<typeof summarizeSla>;
}> {
  // Policies are read ONCE and reused for both the records and the summary.
  const slaPolicies = await getSLAPoliciesFromStore();
  const shipments = await getAllShipments(slaPolicies);

  const records: SLARecord[] = shipments.map((s) => ({
    shipmentId: s.shipment_id,
    customerId: s.customer_code,
    region: s.region,
    expectedDelivery: s.expected_delivery,
    actualDelivery: s.actual_delivery ? s.actual_delivery.split("T")[0] : null,
    slaStatus: s.sla_status,
    daysVariance: s.days_variance,
  }));

  return { shipments, records, summary: summarizeSla(shipments) };
}

/** Get SLA summary for dashboard. */
export async function getSLASummary() {
  const slaPolicies = await getSLAPoliciesFromStore();
  return summarizeSla(await getAllShipments(slaPolicies));
}

/** Get SLA records for the SLA monitoring page. */
export async function getSLARecords() {
  const slaPolicies = await getSLAPoliciesFromStore();
  const shipments = await getAllShipments(slaPolicies);
  return shipments.map((s) => ({
    shipmentId: s.shipment_id,
    customerId: s.customer_code,
    region: s.region,
    expectedDelivery: s.expected_delivery,
    actualDelivery: s.actual_delivery ? s.actual_delivery.split("T")[0] : null,
    slaStatus: s.sla_status,
    daysVariance: s.days_variance,
  }));
}
