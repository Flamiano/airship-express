// components/financial/cash/types.ts

export type AccountType = "bank" | "vault" | "petty_cash";
export type TransactionType = "inflow" | "outflow" | "adjustment";

export interface CashAccount {
  id: string;
  created_at: string;
  account_name: string | null;
  account_number_ending: string | null;
  current_balance: number | null;
  account_type: AccountType | null;
}

export interface CashTransaction {
  id: string;
  cash_account_id: string;
  transaction_type: TransactionType;
  amount: number;
  source_module: string | null;
  reference_id: string | null;
  transaction_date: string;
  created_at: string;
  cash_mngmt?: {
    account_name: string | null;
    account_number_ending: string | null;
  } | null;
}

export interface TransferFormData {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
}

export interface AdjustmentFormData {
  accountId: string;
  adjustmentDirection: "inflow" | "outflow";
  amount: string;
  // Not currently persisted by the adjustment insert (no input renders for it either) —
  // preserved exactly as-is. Whether manual adjustments should carry a reference number
  // is a decision for a later audit, not this UI pass.
  reference: string;
}

export const TRANSFER_FORM_ID = "transfer-form";
export const ADJUSTMENT_FORM_ID = "adjust-form";