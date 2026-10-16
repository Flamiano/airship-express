export interface FeedbackShipment {
  shipment_id: string;
  tracking_number: string;
  reference: string;
  origin: string;
  destination: string;
  delivered_at: string;
  receiver_name: string;
  customer_id: string; // maps to customers.id (uuid)
  customer_email: string;
}

export interface Feedback {
  id: string;
  shipment_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  tracking_number: string;
  reference: string;
  origin: string;
  destination: string;
  delivered_at: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  submitted_at: string;
}
