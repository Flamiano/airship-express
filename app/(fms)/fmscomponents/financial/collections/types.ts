// components/financial/collections/types.ts

export interface ARInvoice {
  id: string;
  invoice_number?: string | null;
  client_name?: string | null;
  total_amount?: number | null;
  amount_paid?: number | null;
  status?: string | null;
  due_date?: string | null;
  external_waybill_id?: string | null;
}

export interface CashAccount {
  id: string;
  account_name: string;
  account_type?: string;
  current_balance?: number;
}

export interface CollectionRecord {
  id: string;
  created_at?: string;
  cash_account_id?: string | null;
  invoice_id?: string | null;
  amount_received: number | null;
  payment_method: string | null;
  reference_number: string | null;
  collection_type?: string;
  external_rider_id?: string | null;
  collection_date?: string;
  ar_invoices?: {
    client_name?: string | null;
    due_date?: string | null;
    invoice_number?: string | null;
    external_waybill_id?: string | null;
  } | null;
  cash_mngmt?: {
    account_name?: string | null;
  } | null;
}

export interface CollectionFormData {
  cash_account_id: string;
  invoice_id: string;
  client_name: string;
  amount_received: string;
  payment_method: string;
  reference_number: string;
}