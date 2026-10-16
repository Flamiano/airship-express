import type {
  FreightOpsShipment,
  FreightOpsShipmentReference,
  FreightOpsTrackingEvent,
  FreightOpsShipmentStatus,
  FreightOpsTrackingEventStatus,
  FreightOpsDeliveryPlatform,
  FreightOpsHandover,
} from "../types/freight-ops";

//shipment mock data

interface MockHub {
  id: string;
  name: string;
  code: string;
  city: string;
  province: string;
}

const HUBS: MockHub[] = [
  { id: "11111111-1111-4111-8111-000000000001", name: "Manila Distribution Hub", code: "HUB-MNL", city: "Manila", province: "Metro Manila" },
  { id: "11111111-1111-4111-8111-000000000002", name: "Bulacan Sorting Hub", code: "HUB-BUL", city: "Malolos", province: "Bulacan" },
  { id: "11111111-1111-4111-8111-000000000003", name: "Cebu Distribution Hub", code: "HUB-CEB", city: "Cebu City", province: "Cebu" },
  { id: "11111111-1111-4111-8111-000000000004", name: "Davao Distribution Hub", code: "HUB-DVO", city: "Davao City", province: "Davao del Sur" },
];

const HUB_MNL = HUBS[0];
const HUB_BUL = HUBS[1];
const HUB_CEB = HUBS[2];
const HUB_DVO = HUBS[3];


const MOCK_REQUEST_IDS: string[] = [
  "REQ-0014", "REQ-0015", "REQ-0016", "REQ-0017", "REQ-0018", "REQ-0019", "REQ-0020",
  "REQ-0021", "REQ-0022", "REQ-0023", "REQ-0024", "REQ-0025", "REQ-0026", "REQ-0027",
  "REQ-0028", "REQ-0029", "REQ-0030", "REQ-0031", "REQ-0032", "REQ-0033",
  "REQ-0039", "REQ-0040", "REQ-0043",
];


interface Scenario {
  clientName: string;
  consignee: string;
  destination: string;
  originHub: MockHub;
  platform: FreightOpsDeliveryPlatform;
  serviceType: string;
  mode: FreightOpsShipment["mode"];
  status: FreightOpsShipmentStatus;
  etaOffsetDays: number;
  deliveredOn: string | null;
  noHandover?: boolean;
  weightKg: number;
  volumeCbm: number;
  itemCategory: string;
  batchRef: string;
  riderName: string;
  codAmount?: number;
}

const SCENARIOS: Scenario[] = [
  { clientName: "Maria Santos", consignee: "Maria Santos", destination: "Quezon City, Metro Manila", originHub: HUB_MNL, platform: "LBC Express", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 1, deliveredOn: "2026-08-18", weightKg: 0.8, volumeCbm: 0.003, itemCategory: "Legal documents", batchRef: "BATCH-2026-0001", riderName: "Rex Manuel" },
  { clientName: "Juan Dela Cruz", consignee: "Juan Dela Cruz", destination: "Cebu City, Cebu", originHub: HUB_MNL, platform: "J&T Express", serviceType: "Standard", mode: "Air", status: "Delivered", etaOffsetDays: 5, deliveredOn: "2026-08-24", weightKg: 12.5, volumeCbm: 0.03, itemCategory: "Electronics", batchRef: "BATCH-2026-0002", riderName: "Marlon Sadam" },
  { clientName: "Angela Reyes", consignee: "Angela Reyes", destination: "Davao City, Davao del Sur", originHub: HUB_MNL, platform: "Custom Partner", serviceType: "Standard", mode: "Air", status: "Delivered", etaOffsetDays: 5, deliveredOn: "2026-08-28", weightKg: 45, volumeCbm: 0.096, itemCategory: "Home goods", batchRef: "BATCH-2026-0003", riderName: "Joel Bacsain" },
  { clientName: "Miguel Torres", consignee: "Miguel Torres", destination: "Makati City, Metro Manila", originHub: HUB_MNL, platform: "Flash Express", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 2, deliveredOn: "2026-08-21", weightKg: 1.2, volumeCbm: 0.002, itemCategory: "Bank documents", batchRef: "BATCH-2026-0001", riderName: "Rex Manuel" },
  { clientName: "Rosa Bautista", consignee: "Rosa Bautista", destination: "Iloilo City, Iloilo", originHub: HUB_CEB, platform: "Custom Partner", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 5, deliveredOn: "2026-08-25", weightKg: 8.4, volumeCbm: 0.018, itemCategory: "Fashion items", batchRef: "BATCH-2026-0003", riderName: "Joel Bacsain" },
  { clientName: "Carlos Mendoza", consignee: "Carlos Mendoza", destination: "Baguio City, Benguet", originHub: HUB_BUL, platform: "LBC Express", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 3, deliveredOn: "2026-08-24", weightKg: 120, volumeCbm: 0.24, itemCategory: "Frozen goods", batchRef: "BATCH-2026-0002", riderName: "Marlon Sadam" },
  { clientName: "Elena Aquino", consignee: "Elena Aquino", destination: "Pasig City, Metro Manila", originHub: HUB_MNL, platform: "J&T Express", serviceType: "Standard", mode: "Road", status: "Delayed", etaOffsetDays: 1, deliveredOn: "2026-08-27", weightKg: 3.6, volumeCbm: 0.009, itemCategory: "Office supplies", batchRef: "BATCH-2026-0001", riderName: "Rex Manuel" },
  { clientName: "Rafael Santos", consignee: "Rafael Santos", destination: "Cagayan de Oro, Misamis Oriental", originHub: HUB_MNL, platform: "Custom Partner", serviceType: "Standard", mode: "Air", status: "Delayed", etaOffsetDays: 5, deliveredOn: "2026-09-05", weightKg: 78.5, volumeCbm: 0.158, itemCategory: "Machinery parts", batchRef: "BATCH-2026-0004", riderName: "Danilo Uy" },
  { clientName: "Liza Fernandez", consignee: "Liza Fernandez", destination: "San Juan, Metro Manila", originHub: HUB_MNL, platform: "Flash Express", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 1, deliveredOn: "2026-08-27", weightKg: 0.5, volumeCbm: 0.001, itemCategory: "Medical records", batchRef: "BATCH-2026-0001", riderName: "Rex Manuel" },
  { clientName: "Paolo Ramos", consignee: "Paolo Ramos", destination: "Batangas City, Batangas", originHub: HUB_MNL, platform: "J&T Express", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 4, deliveredOn: "2026-08-30", weightKg: 22, volumeCbm: 0.047, itemCategory: "Retail goods", batchRef: "BATCH-2026-0002", riderName: "Marlon Sadam" },
  { clientName: "Grace Lim", consignee: "Grace Lim", destination: "Zamboanga City, Zamboanga del Sur", originHub: HUB_MNL, platform: "Custom Partner", serviceType: "Standard", mode: "Air", status: "In Transit", etaOffsetDays: 5, deliveredOn: null, weightKg: 96, volumeCbm: 0.206, itemCategory: "Food products", batchRef: "BATCH-2026-0004", riderName: "Danilo Uy" },
  { clientName: "Marco Villanueva", consignee: "Marco Villanueva", destination: "Taguig City, Metro Manila", originHub: HUB_MNL, platform: "Flash Express", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 1, deliveredOn: "2026-08-31", weightKg: 2.1, volumeCbm: 0.003, itemCategory: "Notarized docs", batchRef: "BATCH-2026-0001", riderName: "Rex Manuel" },
  { clientName: "Sofia Navarro", consignee: "Sofia Navarro", destination: "Bacolod City, Negros Occidental", originHub: HUB_CEB, platform: "Custom Partner", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 5, deliveredOn: "2026-09-06", weightKg: 15.7, volumeCbm: 0.031, itemCategory: "Personal items", batchRef: "BATCH-2026-0003", riderName: "Joel Bacsain" },
  { clientName: "Andrei Cruz", consignee: "Andrei Cruz", destination: "General Santos, South Cotabato", originHub: HUB_DVO, platform: "Custom Partner", serviceType: "Standard", mode: "Air", status: "Delivered", etaOffsetDays: 6, deliveredOn: "2026-09-10", weightKg: 210, volumeCbm: 0.378, itemCategory: "Industrial parts", batchRef: "BATCH-2026-0004", riderName: "Danilo Uy" },
  { clientName: "Bianca Flores", consignee: "Bianca Flores", destination: "Caloocan City, Metro Manila", originHub: HUB_MNL, platform: "J&T Express", serviceType: "Standard", mode: "Road", status: "Delayed", etaOffsetDays: 1, deliveredOn: "2026-09-11", weightKg: 6.9, volumeCbm: 0.016, itemCategory: "Cosmetics", batchRef: "BATCH-2026-0005", riderName: "Carlo Nolasco" },
  { clientName: "Nathan Uy", consignee: "Nathan Uy", destination: "Puerto Princesa, Palawan", originHub: HUB_MNL, platform: "Custom Partner", serviceType: "Standard", mode: "Air", status: "In Transit", etaOffsetDays: 3, deliveredOn: null, weightKg: 64, volumeCbm: 0.13, itemCategory: "Tourist gear", batchRef: "BATCH-2026-0005", riderName: "Carlo Nolasco" },
  { clientName: "Camille Aquino", consignee: "Camille Aquino", destination: "Naga City, Camarines Sur", originHub: HUB_MNL, platform: "TikTok Shop Drop-Off", serviceType: "Standard", mode: "Road", status: "Batched", etaOffsetDays: 3, deliveredOn: null, weightKg: 18.2, volumeCbm: 0.035, itemCategory: "School supplies", batchRef: "BATCH-2026-0006", riderName: "Alvin Ramos" },
  { clientName: "Dominic Reyes", consignee: "Dominic Reyes", destination: "Mandaluyong, Metro Manila", originHub: HUB_MNL, platform: "Shopee Drop-Off", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 2, deliveredOn: "2026-09-19", weightKg: 0.9, volumeCbm: 0.002, itemCategory: "Legal contracts", batchRef: "BATCH-2026-0006", riderName: "Alvin Ramos" },
  { clientName: "Isabelle Santos", consignee: "Isabelle Santos", destination: "Cagayan de Oro, Misamis Oriental", originHub: HUB_MNL, platform: "Custom Partner", serviceType: "Standard", mode: "Air", status: "In Transit", etaOffsetDays: 5, deliveredOn: null, weightKg: 88, volumeCbm: 0.172, itemCategory: "Medical supplies", batchRef: "BATCH-2026-0007", riderName: "Rhea Domingo" },
  { clientName: "Rodrigo Garcia", consignee: "Rodrigo Garcia", destination: "Butuan City, Agusan del Norte", originHub: HUB_DVO, platform: "Lazada Drop-Off", serviceType: "Standard", mode: "Road", status: "Batched", etaOffsetDays: 5, deliveredOn: null, noHandover: true, weightKg: 26.4, volumeCbm: 0.052, itemCategory: "Agri products", batchRef: "BATCH-2026-0008", riderName: "Rhea Domingo" },
  { clientName: "Pradilla Toledo", consignee: "Pradilla Toledo", destination: "Makati City, Metro Manila", originHub: HUB_MNL, platform: "LBC Express", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 2, deliveredOn: "2026-09-20", weightKg: 1.5, volumeCbm: 0.003, itemCategory: "Personal items", batchRef: "BATCH-2026-0009", riderName: "Rex Manuel" },
  { clientName: "Pradilla Toledo", consignee: "Pradilla Toledo", destination: "Quezon City, Metro Manila", originHub: HUB_MNL, platform: "J&T Express", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 1, deliveredOn: "2026-09-25", weightKg: 0.8, volumeCbm: 0.002, itemCategory: "Documents", batchRef: "BATCH-2026-0009", riderName: "Alvin Ramos" },
  { clientName: "Pradilla Toledo", consignee: "Pradilla Toledo", destination: "Pasig City, Metro Manila", originHub: HUB_MNL, platform: "Flash Express", serviceType: "Standard", mode: "Road", status: "Delivered", etaOffsetDays: 2, deliveredOn: "2026-10-01", weightKg: 2.0, volumeCbm: 0.004, itemCategory: "Retail goods", batchRef: "BATCH-2026-0009", riderName: "Carlo Nolasco" },
];


const PROGRESS_BY_EVENT: Record<FreightOpsTrackingEventStatus, number> = {
  Registered: 5,
  "Pickup Scheduled": 15,
  "Picked Up": 25,
  "Dropped Off": 30,
  "At Origin Hub": 40,
  "In Transit": 55,
  "At Destination Hub": 70,
  "Out for Delivery": 85,
  Delivered: 100,
  "Delivery Failed": 90,
  Returned: 60,
  Intake: 10,
};

const LEVEL_BY_EVENT: Record<FreightOpsTrackingEventStatus, FreightOpsTrackingEvent["level"]> = {
  Registered: "info",
  "Pickup Scheduled": "info",
  "Picked Up": "info",
  "Dropped Off": "info",
  "At Origin Hub": "info",
  "In Transit": "info",
  "At Destination Hub": "info",
  "Out for Delivery": "info",
  Delivered: "success",
  "Delivery Failed": "error",
  Returned: "warning",
  Intake: "info",
};

function eventPathFor(status: FreightOpsShipmentStatus): FreightOpsTrackingEventStatus[] {
  if (status === "Delivered" || status === "Delayed") {
    return ["Registered", "Picked Up", "At Origin Hub", "In Transit", "At Destination Hub", "Out for Delivery", "Delivered"];
  }
  if (status === "In Transit") {
    return ["Registered", "Picked Up", "At Origin Hub", "In Transit", "At Destination Hub"];
  }
  if (status === "Batched") {
    return ["Registered", "Picked Up", "At Origin Hub"];
  }
  return ["Intake", "Registered"];
}


function mockUuid(seed: number, offset: number): string {
  const n = ((seed + 1) * 1000 + offset).toString(16).padStart(12, "0").slice(0, 12);
  return `33333333-3333-4333-8333-${n}`;
}

function at(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00.000Z`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Handover is derived from the request's booking date so it always precedes transit. */
const BOOKING_DATES: string[] = [
  "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21",
  "2026-08-22", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27",
  "2026-08-28", "2026-08-31", "2026-09-02", "2026-09-05", "2026-09-08",
  "2026-09-11", "2026-09-15", "2026-09-18", "2026-09-22", "2026-09-25",
  "2026-09-18", "2026-09-24", "2026-09-29",
];

function handoverDateFor(index: number): string {
  return BOOKING_DATES[index] ?? "2026-08-17";
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */
interface BuiltRecord {
  shipment: FreightOpsShipment;
  events: FreightOpsTrackingEvent[];
  reference: FreightOpsShipmentReference;
  handover: FreightOpsHandover | null;
}

function build(): BuiltRecord[] {
  return MOCK_REQUEST_IDS.map((requestId, index) => {
    const s = SCENARIOS[index];
    const seq = index + 1;

    const shipmentId = mockUuid(0, seq);
    const reference = `SHP-2026-${8800 + seq}`;
    const trackingNumber = `PKG-2026-${String(seq).padStart(6, "0")}`;

    const handoverDate = handoverDateFor(index);
    const handoverAt = at(handoverDate, ["14:00", "09:30", "10:00", "08:15", "13:40", "08:30", "09:20", "15:00", "10:30", "11:15", "11:45", "08:00", "16:30", "10:00", "09:45", "08:50", "12:10", "07:40", "17:05", "11:20", "10:00", "09:00", "11:00"][index] ?? "10:00");

    const eta = addDays(handoverDate, s.etaOffsetDays);

    // --- tracking events -------------------------------------------------
    const path = eventPathFor(s.status);
    const events: FreightOpsTrackingEvent[] = [];

    if (s.deliveredOn) {
      // The final event is placed on deliveredOn; earlier events walk backwards.
      const last = new Date(`${s.deliveredOn}T00:00:00Z`);
      const step = 0.5;
      path.forEach((eventStatus, i) => {
        const atDate = new Date(last);
        atDate.setUTCHours(11);
        atDate.setTime(last.getTime() - (path.length - 1 - i) * 24 * 60 * 60 * 1000 * step);
        events.push({
          id: mockUuid(seq, i + 1),
          shipment_id: shipmentId,
          event_type: "status",
          message: `${eventStatus} — ${s.destination.split(",")[0]}`,
          level: LEVEL_BY_EVENT[eventStatus],
          status: eventStatus,
          lat: null,
          lng: null,
          location: i === 0 ? s.originHub.city : s.destination.split(",")[0],
          created_at: atDate.toISOString(),
        });
      });
      // Force the Delivered event onto the exact stated day.
      const deliveredIdx = events.findIndex((e) => e.status === "Delivered");
      if (deliveredIdx >= 0) {
        events[deliveredIdx] = {
          ...events[deliveredIdx],
          created_at: at(s.deliveredOn, ["09:15", "16:40", "11:05", "14:20", "10:30", "15:50", "17:25", "13:10", "10:05", "14:50", "18:45", "12:15", "09:05", "14:50"][seq - 1] ?? "12:00"),
        };
      }
    } else {
      // Not delivered: events run forward from the handover.
      path.forEach((eventStatus, i) => {
        const d = new Date(`${handoverAt}`);
        d.setTime(d.getTime() + i * 12 * 60 * 60 * 1000);
        events.push({
          id: mockUuid(seq, i + 1),
          shipment_id: shipmentId,
          event_type: "status",
          message: `${eventStatus} — ${s.destination.split(",")[0]}`,
          level: LEVEL_BY_EVENT[eventStatus],
          status: eventStatus,
          lat: null,
          lng: null,
          location: i === 0 ? s.originHub.city : s.destination.split(",")[0],
          created_at: d.toISOString(),
        });
      });
    }

    const lastEvent = events[events.length - 1];
    const createdAt = s.noHandover
      ? at(addDays(handoverDate, 8), "09:00")
      : at(addDays(handoverDate, -1), "16:00");

    // --- shipment row ----------------------------------------------------
    const shipment: FreightOpsShipment = {
      id: shipmentId,
      reference,
      tracking_number: trackingNumber,

      client_name: s.clientName,
      shipper: "Airship Express",
      consignee: s.consignee,
      client_id: null,
      seller_id: null,
      platform: s.platform,
      service_type: s.serviceType,
      cod_amount: s.codAmount ?? 0,

      origin: s.originHub.city,
      destination: s.destination,
      mode: s.mode,
      current_hub_id: s.status === "Batched" || s.status === "In Transit" ? s.originHub.id : null,

      status: s.status,
      progress: PROGRESS_BY_EVENT[(lastEvent.status ?? "Registered") as FreightOpsTrackingEventStatus],
      current_location: lastEvent.location,
      current_lat: null,
      current_lng: null,

      etd: createdAt.slice(0, 10),
      eta,
      expected_delivery_date: eta,

      description: s.itemCategory,
      dimensions: null,
      weight_kg: s.weightKg,
      volume_cbm: s.volumeCbm,
      shipping_fee: 180,
      recipient_phone: null,

      container_no: null,
      cargo_type: null,
      vessel: null,
      carrier: s.riderName,
      po_number: null,
      hazard_class: "None",
      incoterms: null,

      cancel_reason: null,
      archived_at: null,

      created_by: null,
      created_at: createdAt,
      updated_at: lastEvent.created_at,
    };

    const handover: FreightOpsHandover | null = s.noHandover
      ? null
      : {
          id: mockUuid(900 + Number(s.batchRef.slice(-4)), 1),
          batch_id: null,
          batch_reference: s.batchRef,
          shipment_id: shipmentId,
          platform: s.platform,
          handed_over_at: handoverAt,
        };

    return { shipment, events, reference: { requestId, shipmentId }, handover };
  });
}

const RECORDS = build();

export function getMockFreightOpsShipments(): FreightOpsShipment[] {
  return RECORDS.map((r) => r.shipment);
}

export function getMockFreightOpsShipmentsWithEvents(): {
  shipment: FreightOpsShipment;
  events: FreightOpsTrackingEvent[];
  reference: FreightOpsShipmentReference;
}[] {
  return RECORDS;
}

/** Handover per shipment — the SLA clock start. */
export function getMockFreightOpsHandoverByShipmentId(
  shipmentId: string
): FreightOpsHandover | null {
  return RECORDS.find((r) => r.shipment.id === shipmentId)?.handover ?? null;
}

