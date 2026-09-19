import { supabase } from "@/app/(fms)/lib/supabase";

export interface GeneralLedgerEntry {
  id: string;
  created_at: string;
  account_name?: string;
  account_category?: string;
  entry_type?: "debit" | "credit";
  debit?: number;
  credit?: number;
  amount?: number;
  reference_no?: string;
  description?: string;
}

export interface GLFormData {
  account_name: string;
  account_category: string;
  entry_type: "debit" | "credit";
  amount: string;
  reference_no: string;
  description: string;
}

export const EMPTY_GL_FORM: GLFormData = {
  account_name: "Cash in Bank / Operating",
  account_category: "asset",
  entry_type: "debit",
  amount: "",
  reference_no: "",
  description: "",
};

export const GL_ENTRY_FORM_ID = "gl-entry-form";

export const getEntryDebit = (item: GeneralLedgerEntry) => {
  if (typeof item.debit === "number") return item.debit;
  if (item.entry_type === "debit") return Number(item.amount) || 0;
  return 0;
};

export const getEntryCredit = (item: GeneralLedgerEntry) => {
  if (typeof item.credit === "number") return item.credit;
  if (item.entry_type === "credit") return Number(item.amount) || 0;
  return 0;
};

export async function postJournalEntry(form: GLFormData) {
  const parsedAmount = parseFloat(form.amount) || 0;
  const isDebit = form.entry_type === "debit";

  const payload = {
    account_name: form.account_name,
    account_category: form.account_category,
    entry_type: form.entry_type,
    debit: isDebit ? parsedAmount : 0,
    credit: !isDebit ? parsedAmount : 0,
    amount: parsedAmount,
    reference_no: form.reference_no || `JV-${Date.now().toString().slice(-6)}`,
    description: form.description,
  };

  const { error } = await supabase.from("general_ledger").insert([payload]);
  return { error, parsedAmount };
}