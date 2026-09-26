export type Disbursement = {
  id: string;
  vendor_name?: string;
  description?: string;
  due_date?: string;
  amount: number;
  amount_paid: number;
  payout_method?: string;
  payment_method?: string;
  status?: string;
  reference_number?: string;
  expense_category?: string;
  notes?: string;
};

export type DisbursementFormData = {
  vendor_name: string;
  expense_category: string;
  description: string;
  amount: string;
  due_date: string;
  payment_method: string;
  reference_number: string;
  notes: string;
};

export type PaymentFormData = {
  amount: string;
  payment_date: string;
  reference_number: string;
  payment_method: string;
  notes: string;
};

export const DISBURSEMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Check",
  "Online Payment",
];