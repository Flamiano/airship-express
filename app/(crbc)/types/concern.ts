export type ConcernCategory = "delivery" | "wrong_item" | "damaged" | "billing" | "other";
export type ConcernStatus = "open" | "in_progress" | "resolved" | "closed";
export type ConcernPriority = "high" | "medium" | "low";
export type ConcernTimelineType = "created" | "assigned" | "status_changed" | "customer_update" | "internal_note" | "resolved" | "closed" | "investigation_requested";

export interface ConcernCustomer {
  id: string;
  customer_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

export interface ConcernShipment {
  id: string;
  request_id: string;
  status: string;
}

export interface ConcernAssignee {
  id: string;
  full_name: string | null;
  email: string;
}

export interface ConcernUpdate {
  id: string;
  author: string;
  text: string;
  time: string;
}

export interface ConcernInternalNote {
  id: string;
  author: string;
  text: string;
  time: string;
}

export interface ConcernTimelineEntry {
  id: string;
  type: ConcernTimelineType;
  text: string;
  time: string;
  author: string;
  metadata?: Record<string, unknown>;
}

export interface Concern {
  id: string;
  concern_number: string;
  customer_id: string;
  subject: string;
  description: string;
  category: ConcernCategory;
  status: ConcernStatus;
  priority: ConcernPriority;
  shipment_id: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: ConcernCustomer;
  shipment?: ConcernShipment;
  assigned_to_profile?: ConcernAssignee;
  customerUpdates?: ConcernUpdate[];
  internalNotes?: ConcernInternalNote[];
  timeline?: ConcernTimelineEntry[];
}