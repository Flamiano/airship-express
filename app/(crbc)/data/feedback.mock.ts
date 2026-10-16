

import type { Feedback, FeedbackShipment } from "../types/feedback";

// UUID for pradillatoledo03@gmail.com — replace with real customers.id when integrated
export const MOCK_CUSTOMER_ID = "mock-customer-pradilla-001";
export const MOCK_CUSTOMER_NAME = "Pradilla Toledo";
export const MOCK_CUSTOMER_EMAIL = "pradillatoledo03@gmail.com";

export const MOCK_DELIVERED_SHIPMENTS: FeedbackShipment[] = [
  {
    shipment_id: "shp-mock-001",
    tracking_number: "AE-2025-00101",
    reference: "REQ-2025-00101",
    origin: "Cebu City, Cebu",
    destination: "Makati City, Metro Manila",
    delivered_at: "2025-07-10T14:30:00Z",
    receiver_name: "Maria Santos",
    customer_id: MOCK_CUSTOMER_ID,
    customer_email: MOCK_CUSTOMER_EMAIL,
  },
  {
    shipment_id: "shp-mock-002",
    tracking_number: "AE-2025-00087",
    reference: "REQ-2025-00087",
    origin: "Davao City, Davao del Sur",
    destination: "Quezon City, Metro Manila",
    delivered_at: "2025-07-05T09:15:00Z",
    receiver_name: "Jose Reyes",
    customer_id: MOCK_CUSTOMER_ID,
    customer_email: MOCK_CUSTOMER_EMAIL,
  },
  {
    shipment_id: "shp-mock-003",
    tracking_number: "AE-2025-00063",
    reference: "REQ-2025-00063",
    origin: "Iloilo City, Iloilo",
    destination: "Taguig City, Metro Manila",
    delivered_at: "2025-06-28T16:45:00Z",
    receiver_name: "Ana Cruz",
    customer_id: MOCK_CUSTOMER_ID,
    customer_email: MOCK_CUSTOMER_EMAIL,
  },
  {
    shipment_id: "shp-mock-004",
    tracking_number: "AE-2025-00044",
    reference: "REQ-2025-00044",
    origin: "Cagayan de Oro, Misamis Oriental",
    destination: "Pasig City, Metro Manila",
    delivered_at: "2025-06-20T11:00:00Z",
    receiver_name: "Roberto Lim",
    customer_id: MOCK_CUSTOMER_ID,
    customer_email: MOCK_CUSTOMER_EMAIL,
  },
  {
    shipment_id: "shp-mock-005",
    tracking_number: "AE-2025-00031",
    reference: "REQ-2025-00031",
    origin: "Bacolod City, Negros Occidental",
    destination: "Mandaluyong City, Metro Manila",
    delivered_at: "2025-06-12T08:20:00Z",
    receiver_name: "Liza Fernandez",
    customer_id: MOCK_CUSTOMER_ID,
    customer_email: MOCK_CUSTOMER_EMAIL,
  },
];

// In-memory store — persists for the lifetime of the Node.js process (dev only)
const feedbackStore: Feedback[] = [
  {
    id: "fb-seed-001",
    shipment_id: "shp-mock-003",
    customer_id: MOCK_CUSTOMER_ID,
    customer_name: MOCK_CUSTOMER_NAME,
    customer_email: MOCK_CUSTOMER_EMAIL,
    tracking_number: "AE-2025-00063",
    reference: "REQ-2025-00063",
    origin: "Iloilo City, Iloilo",
    destination: "Taguig City, Metro Manila",
    delivered_at: "2025-06-28T16:45:00Z",
    rating: 5,
    comment: "Very fast delivery! Package arrived in perfect condition.",
    submitted_at: "2025-06-29T07:10:00Z",
  },
];

export function getMockFeedbackStore(): Feedback[] {
  return feedbackStore;
}

export function addMockFeedback(entry: Feedback): void {
  feedbackStore.push(entry);
}

export function hasMockFeedback(shipmentId: string): boolean {
  return feedbackStore.some((f) => f.shipment_id === shipmentId);
}

export function getMockFeedbackByCustomer(customerId: string): Feedback[] {
  return feedbackStore.filter((f) => f.customer_id === customerId);
}
