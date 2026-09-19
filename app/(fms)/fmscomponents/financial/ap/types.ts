export interface AccountPayable {
  id: string;
  created_at?: string;
  vendor_name: string;
  bill_number: string;
  amount_due: number;
  due_date: string;
  status: "pending" | "approved" | "paid";
}

export interface BillFormData {
  vendor_name: string;
  bill_number: string;
  amount_due: string;
  due_date: string;
  status: "pending" | "approved" | "paid";
}