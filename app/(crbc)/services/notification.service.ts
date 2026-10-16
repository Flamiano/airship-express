import { createClient } from "../library/supabase/server";
import { getSLAPoliciesFromStore } from "./sla-policies.store";
import { getShipmentsByCustomerId } from "./shipment.service";
import { getShipmentTracking } from "./freight-ops.service";
import type { BookingRequest } from "./booking-request.service";
import { REQUEST_STATUS_LABELS } from "../types/booking-request";
import type { Concern, ConcernStatus, ConcernPriority } from "../types/concern";


export type NotificationKind =
  | "request_accepted"
  | "request_rejected"
  | "request_cancelled"
  | "shipment_updated"
  | "shipment_delivered"
  | "pod_available"
  | "concern_created"
  | "concern_updated"
  | "concern_resolved"
  | "concern_closed";

export type CustomerNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  /** ISO timestamp of the underlying event. */
  at: string;
  /** Route the customer should visit to act on this. */
  href: string;
  read: boolean;
};

/** Most recent first. */
function byNewest(a: CustomerNotification, b: CustomerNotification) {
  return b.at.localeCompare(a.at);
}

function requestNotification(request: BookingRequest): CustomerNotification[] {
  const id = `req-${request.request_id}`;
  const href = `/customer/shipment-history/${request.request_id}`;

  const base = {
    id,
    href,
    at: request.updated_at,
    read: false,
  };

  switch (request.status) {
    case "ACCEPTED":
      return [
        {
          ...base,
          kind: "request_accepted",
          title: "Shipment Request accepted",
          detail: `${request.request_id} was accepted by Airship Express and sent to Freight Operations for processing.`,
        },
      ];
    case "REJECTED":
      return [
        {
          ...base,
          kind: "request_rejected",
          title: "Shipment Request not accepted",
          detail: `${request.request_id} could not be accepted. Please contact Airship Express for details.`,
        },
      ];
    case "CANCELLED":
      return [
        {
          ...base,
          kind: "request_cancelled",
          title: "Shipment Request cancelled",
          detail: `${request.request_id} was cancelled.`,
        },
      ];
    default:
      return [];
  }
}

function shipmentNotifications(
  shipment: Awaited<ReturnType<typeof getShipmentsByCustomerId>>[number]
): CustomerNotification[] {
  const href = `/customer/shipments/${shipment.request_id}`;
  const out: CustomerNotification[] = [];

  const deliveredAt = shipment.actual_delivery;
  const lastEventAt = shipment.status_updated_at;

  if (deliveredAt) {
    out.push({
      id: `shp-${shipment.shipment_id}-delivered`,
      kind: "shipment_delivered",
      title: "Shipment delivered",
      detail: `Shipment ${shipment.tracking_number ?? shipment.reference} was delivered on ${new Date(deliveredAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}.`,
      at: deliveredAt,
      href,
      read: false,
    });

    // POD exists because a Delivered event exists — same derivation the
    // document service uses, so the two never disagree.
    out.push({
      id: `shp-${shipment.shipment_id}-pod`,
      kind: "pod_available",
      title: "Proof of Delivery available",
      detail: `A Proof of Delivery record is now available for ${shipment.tracking_number ?? shipment.reference}.`,
      at: deliveredAt,
      href: "/customer/documents",
      read: false,
    });
  }

  if (lastEventAt && lastEventAt !== deliveredAt) {
    out.push({
      id: `shp-${shipment.shipment_id}-update`,
      kind: "shipment_updated",
      title: `Shipment ${shipment.status.toLowerCase()}`,
      detail: `${shipment.tracking_number ?? shipment.reference} is currently ${shipment.status}${shipment.current_location ? ` near ${shipment.current_location}` : ""}.`,
      at: lastEventAt,
      href,
      read: false,
    });
  }

  return out;
}


export async function getCustomerNotifications(
  customerUuid: string,
  requests: BookingRequest[]
): Promise<CustomerNotification[]> {
  const slaPolicies = await getSLAPoliciesFromStore();

  // Customer code, needed by the adapter which is keyed on it.
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("customer_id")
    .eq("id", customerUuid)
    .maybeSingle();

  const shipments = customer?.customer_id
    ? await getShipmentsByCustomerId(customer.customer_id, slaPolicies)
    : [];

  const notifications: CustomerNotification[] = [
    ...requests.flatMap(requestNotification),
    ...shipments.flatMap(shipmentNotifications),
  ];

  return notifications.sort(byNewest);
}


export async function getShipmentTimeline(shipmentId: string) {
  return getShipmentTracking(shipmentId);
}

function concernNotification(
  concernId: string,
  concernNumber: string,
  subject: string,
  kind: "concern_created" | "concern_updated" | "concern_resolved" | "concern_closed",
  detail: string,
  at: string
): CustomerNotification {
  return {
    id: `cnc-${concernId}-${kind}`,
    kind,
    title: `Concern ${kind.replace("concern_", "").replace("_", " ")}`,
    detail,
    at,
    href: `/customer/complaints/${concernNumber}`,
    read: false,
  };
}

export async function getConcernNotifications(
  customerUuid: string
): Promise<CustomerNotification[]> {
  const supabase = await createClient();

  // Get customer's concerns
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("profile_id", customerUuid)
    .maybeSingle();

  if (!customer) {
    return [];
  }

  const { data: concerns } = await supabase
    .from("concerns")
    .select("id, concern_number, subject, status, updated_at, created_at")
    .eq("customer_id", customer.id)
    .order("updated_at", { ascending: false });

  if (!concerns || concerns.length === 0) {
    return [];
  }

  const notifications: CustomerNotification[] = [];

  for (const concern of concerns) {
    // Created notification
    notifications.push(concernNotification(
      concern.id,
      concern.concern_number,
      concern.subject,
      "concern_created",
      `Your concern "${concern.subject}" (${concern.concern_number}) has been submitted and is being reviewed.`,
      concern.created_at
    ));

    // Updated notification (if updated_at differs from created_at)
    if (concern.updated_at !== concern.created_at) {
      notifications.push(concernNotification(
        concern.id,
        concern.concern_number,
        concern.subject,
        "concern_updated",
        `Your concern "${concern.subject}" (${concern.concern_number}) has been updated.`,
        concern.updated_at
      ));
    }

    // Resolved notification
    if (concern.status === "resolved") {
      notifications.push(concernNotification(
        concern.id,
        concern.concern_number,
        concern.subject,
        "concern_resolved",
        `Your concern "${concern.subject}" (${concern.concern_number}) has been resolved.`,
        concern.updated_at
      ));
    }

    // Closed notification
    if (concern.status === "closed") {
      notifications.push(concernNotification(
        concern.id,
        concern.concern_number,
        concern.subject,
        "concern_closed",
        `Your concern "${concern.subject}" (${concern.concern_number}) has been closed.`,
        concern.updated_at
      ));
    }
  }

  return notifications.sort((a, b) => b.at.localeCompare(a.at));
}

export { REQUEST_STATUS_LABELS };
