export type APStatus =
  | "pending"
  | "approved"
  | "partially_paid"
  | "paid"
  | "cancelled";

export interface AccountPayable {
  id: string;
  created_at?: string;
  vendor_name: string;
  bill_number: string;
  amount_due: number;
  total_amount?: number | null;
  amount_paid?: number | null;
  due_date: string;
  status: APStatus;
}

export interface BillFormData {
  vendor_name: string;
  bill_number: string;
  amount_due: string;
  due_date: string;
  status: "pending" | "approved" | "paid";
}
