import {
  getMockFreightOpsShipmentsWithEvents,
  getMockFreightOpsHandoverByShipmentId,
} from "../data/freight-ops.mock";
import type { SLAPolicy, SlaTier } from "../types/sla";
import type {
  FreightOpsShipment,
  FreightOpsShipmentReference,
  FreightOpsTrackingEvent,
  FreightOpsHandover,
  ShipmentSource,
  ShipmentViewModel,
  FreightOpsTrackingEventStatus,
} from "../types/freight-ops";
import type { BookingWithCustomer } from "./shipment.service";


interface FreightOpsDataset {
  source: ShipmentSource;
  shipments: FreightOpsShipment[];
  events: FreightOpsTrackingEvent[];
  references: FreightOpsShipmentReference[];
  handoversByShipmentId: Map<string, FreightOpsHandover>;
}

/**
 * MOCK — synthetic development data. No real parcel is represented here.
 */
function loadFromMock(): FreightOpsDataset {
  const built = getMockFreightOpsShipmentsWithEvents();

  const handoversByShipmentId = new Map<string, FreightOpsHandover>();
  for (const b of built) {
    const handover = getMockFreightOpsHandoverByShipmentId(b.shipment.id);
    if (handover) handoversByShipmentId.set(b.shipment.id, handover);
  }

  return {
    source: "mock",
    shipments: built.map((b) => b.shipment),
    events: built.flatMap((b) => b.events),
    references: built.map((b) => b.reference),
    handoversByShipmentId,
  };
}

async function loadFromApi(): Promise<FreightOpsDataset> {
  throw new Error(
    "Freight Ops API is not configured"
  );
}

async function loadDataset(): Promise<FreightOpsDataset> {
  if (process.env.FREIGHT_OPS_API_URL) {
    return loadFromApi();
  }
  return loadFromMock();
}

export function deriveActualDelivery(
  events: FreightOpsTrackingEvent[]
): string | null {
  const delivered = events
    .filter((e) => e.status === "Delivered")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return delivered.length ? delivered[delivered.length - 1].created_at : null;
}

/** Newest event timestamp, replacing the fabricated `last_tracking_update`. */
export function deriveLastTrackingUpdate(
  events: FreightOpsTrackingEvent[]
): string | null {
  if (!events.length) return null;
  return events
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-1)[0].created_at;
}

// NCR province-name variants.
const NCR_PROVINCES: ReadonlySet<string> = new Set([
  "metro manila",
  "ncr",
  "national capital region",
  "national capital region - manila",
  "national capital region - first district",
  "national capital region - second district",
  "national capital region - third district",
  "national capital region - fourth district",
]);


export function classifySlaTier(province: string | null | undefined): SlaTier | null {
  const normalized = province?.trim().toLowerCase();
  if (!normalized) return null;
  return NCR_PROVINCES.has(normalized) ? "Metro Manila" : "Province";
}

export function addDays(date: string, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split("T")[0];
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/* ------------------------------------------------------------------ *
 * Mapper: Freight Ops entity -> CRBC view model
 * ------------------------------------------------------------------ */

function mapToViewModel(
  shipment: FreightOpsShipment,
  events: FreightOpsTrackingEvent[],
  booking: BookingWithCustomer,
  slaPolicies: SLAPolicy[],
  handover?: FreightOpsHandover,
  source: ShipmentSource = "mock"
): ShipmentViewModel {
  const receiverAddressParts = [
    booking.receiver_full_address,
    booking.receiver_barangay,
    booking.receiver_city,
    booking.receiver_province,
  ].filter(Boolean);

  /* ------------------------------------------------------------------ *
   * SLA GEOGRAPHY
   * ------------------------------------------------------------------ */
  const region = classifySlaTier(booking.receiver_province);
  const policy = region ? slaPolicies.find((p) => p.region === region) : undefined;
  const maxDays = policy?.maxDays ?? null;
  const slaStart = handover?.handed_over_at ?? shipment.created_at;
  const slaStartDate = slaStart.split("T")[0];

  const expectedDelivery =
    shipment.eta ??
    (maxDays !== null ? addDays(slaStartDate, maxDays) : null);
  const expectedDeliveryDate = expectedDelivery ? expectedDelivery.split("T")[0] : null;

  const actualDeliveryAt = deriveActualDelivery(events);

  let daysVariance: number | null = null;
  let slaStatus: ShipmentViewModel["slaStatus"] = "Pending";

  if (expectedDeliveryDate) {
    if (actualDeliveryAt) {
      const actual = daysBetween(expectedDeliveryDate, actualDeliveryAt.split("T")[0]);
      daysVariance = actual;
      slaStatus = actual <= 0 ? "On Time" : "Delayed";
    } else if (shipment.status === "In Transit" || shipment.status === "Delayed") {
      // Overdue but not yet delivered. This is a RISK, not a breach — it is
      // reported separately from compliance, which counts delivered parcels
      const today = evaluationDate();
      if (today > expectedDeliveryDate) {
        daysVariance = daysBetween(expectedDeliveryDate, today);
        slaStatus = "Delayed";
      }
    }
  }

  const customer = booking.customers;

  return {
    requestId: booking.request_id,
    shipmentId: shipment.id,
    reference: shipment.reference,
    trackingNumber: shipment.tracking_number,
    customerId: booking.customer_id,
    customerCode: customer?.customer_id ?? booking.customer_id,
    customerName: customer?.full_name ?? "",

    origin: shipment.origin,
    destination: shipment.destination,
    mode: shipment.mode,
    platform: shipment.platform,
    serviceType: shipment.service_type,
    region,

    status: shipment.status,
    progress: shipment.progress,
    currentLocation: shipment.current_location,

    bookingCreatedAt: booking.created_at,
    slaStartedAt: slaStart,
    expectedDeliveryDate,
    actualDeliveryAt,

    receiverName: booking.receiver_name,
    receiverAddress: receiverAddressParts.join(", "),
    packageQuantity: booking.package_quantity,
    packageType: booking.package_type,
    itemCategory: booking.item_category,
    weight: booking.weight,
    dimensions: booking.dimensions,
    declaredValue: booking.declared_value,
    airshipPackagingRequested: booking.airship_packaging_requested,
    remarks: booking.remarks,
    bookingStatus: booking.status,

    expectedDelivery,
    daysVariance,
    slaStatus,

    source,
  };
}

async function buildIndex() {
  const { source, shipments, events, references, handoversByShipmentId } =
    await loadDataset();

  const byRequestId = new Map<string, FreightOpsShipment>();
  const byShipmentId = new Map<string, FreightOpsShipment>();

  for (const ref of references) {
    const shipment = shipments.find((s) => s.id === ref.shipmentId);
    if (shipment) byRequestId.set(ref.requestId, shipment);
  }
  for (const shipment of shipments) byShipmentId.set(shipment.id, shipment);

  const eventsByShipment = new Map<string, FreightOpsTrackingEvent[]>();
  for (const event of events) {
    const list = eventsByShipment.get(event.shipment_id) ?? [];
    list.push(event);
    eventsByShipment.set(event.shipment_id, list);
  }

  return {
    source,
    byRequestId,
    byShipmentId,
    eventsByShipment,
    handoversByShipmentId,
  };
}

/** One Freight Ops shipment, correlated to a CRBC booking request. */
export async function getShipmentByRequestId(
  requestId: string,
  slaPolicies: SLAPolicy[],
  bookings: BookingWithCustomer[] = []
): Promise<ShipmentViewModel | null> {
  const results = await getShipmentsByRequestIds([requestId], slaPolicies, bookings);
  return results[0] ?? null;
}

/** One Freight Ops shipment by its own id. */
export async function getShipmentById(
  shipmentId: string,
  bookings: BookingWithCustomer[] = [],
  slaPolicies: SLAPolicy[]
): Promise<ShipmentViewModel | null> {
  const { byShipmentId, eventsByShipment, source, handoversByShipmentId } =
    await buildIndex();
  const shipment = byShipmentId.get(shipmentId);
  if (!shipment) return null;

  const ref = (await loadDataset()).references.find(
    (r) => r.shipmentId === shipmentId
  );
  const booking =
    bookings.find((b) => b.request_id === ref?.requestId) ?? EMPTY_BOOKING;

  return {
    ...mapToViewModel(
      shipment,
      eventsByShipment.get(shipment.id) ?? [],
      booking,
      slaPolicies,
      handoversByShipmentId.get(shipment.id)
    ),
    source,
  };
}

/**
 * Every Freight Ops shipment, with no booking attached.
 *
 * `EMPTY_BOOKING` carries a null `receiver_province`, so these have no SLA
 * tier and are reported as not evaluable. That is honest: without the CRBC
 * booking there is no destination geography to evaluate against.
 */
export async function getAllFreightOpsShipments(
  slaPolicies: SLAPolicy[]
): Promise<ShipmentViewModel[]> {
  const { byShipmentId, eventsByShipment, handoversByShipmentId } =
    await buildIndex();
  const out: ShipmentViewModel[] = [];

  for (const shipment of byShipmentId.values()) {
    out.push(
      mapToViewModel(
        shipment,
        eventsByShipment.get(shipment.id) ?? [],
        EMPTY_BOOKING,
        slaPolicies,
        handoversByShipmentId.get(shipment.id)
      )
    );
  }
  return out;
}


export async function getShipmentsByRequestIds(
  requestIds: string[],
  slaPolicies: SLAPolicy[],
  bookings: BookingWithCustomer[] = []
): Promise<ShipmentViewModel[]> {
  const { source, byRequestId, eventsByShipment, handoversByShipmentId } =
    await buildIndex();

  const bookingByRequestId = new Map(bookings.map((b) => [b.request_id, b]));

  const out: ShipmentViewModel[] = [];

  for (const [requestId, shipment] of byRequestId) {
    if (requestIds.length && !requestIds.includes(requestId)) continue;

    const booking = bookingByRequestId.get(requestId);
    if (bookings.length && !booking) continue;

    const view = mapToViewModel(
      shipment,
      eventsByShipment.get(shipment.id) ?? [],
      booking ?? EMPTY_BOOKING,
      slaPolicies,
      handoversByShipmentId.get(shipment.id)
    );
    out.push({ ...view, source });
  }

  return out;
}

/** Tracking events for a shipment, oldest first. */
export async function getShipmentTracking(
  shipmentId: string
): Promise<FreightOpsTrackingEvent[]> {
  const { eventsByShipment } = await buildIndex();
  return (eventsByShipment.get(shipmentId) ?? []).slice().sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
}

/** Which source is in use, so callers can label derived figures honestly. */
export async function getFreightOpsSource(): Promise<ShipmentSource> {
  const { source } = await loadDataset();
  return source;
}

/** Events present for a shipment, typed for status checks. */
export function hasDeliveredEvent(
  events: FreightOpsTrackingEvent[]
): boolean {
  return events.some(
    (e) => (e.status as FreightOpsTrackingEventStatus) === "Delivered"
  );
}

/* ------------------------------------------------------------------ *
 * Shared defaults
 * ------------------------------------------------------------------ */

export function evaluationDate(): string {
  const pinned = process.env.CRBC_SLA_EVAL_DATE?.trim();
  if (pinned) return pinned;
  return new Date().toISOString().split("T")[0];
}

/** Placeholder booking when a shipment is read without CRBC context. */
const EMPTY_BOOKING: BookingWithCustomer = {
  id: "",
  request_id: "",
  customer_id: "",
  receiver_name: "",
  receiver_province: null,
  receiver_city: null,
  receiver_barangay: null,
  receiver_full_address: null,
  package_quantity: 0,
  package_type: "",
  item_category: null,
  weight: null,
  dimensions: null,
  declared_value: null,
  airship_packaging_requested: false,
  remarks: null,
  status: "",
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
  customers: null,
};
