export interface Invoice {
  id?: string;
  created_at?: string;
  invoice_number: string;
  client_name: string;
  total_amount: number;
  amount_paid: number;
  due_date: string;
  invoice_date?: string;
  status: "Unpaid" | "Partially Paid" | "Paid" | "Overdue";
  external_client_id?: string | null;
  external_waybill_id?: string | null;
}

export interface CollectionHistoryRecord {
  id: string;
  invoice_id?: string | null;
  created_at?: string;
  collection_date?: string;
  amount_received: number;
  payment_method: string;
  reference_number: string;
  cash_account_id?: string | null;
  cash_account_name?: string | null;
}