import React from "react";
import { Loader2, Building2, FileText, User, Hash, DollarSign, CreditCard, AlertCircle } from "lucide-react";
import { CashAccount, ARInvoice, CollectionFormData } from "./types";

interface CollectionFormProps {
  formData: CollectionFormData;
  onChange: (field: keyof CollectionFormData, value: string) => void;
  onInvoiceSelect: (invoiceId: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  cashAccounts: CashAccount[];
  openInvoices: ARInvoice[];
  submitting: boolean;
  formatPeso: (val: number) => string;
}

export function CollectionForm({
  formData,
  onChange,
  onInvoiceSelect,
  onSubmit,
  onCancel,
  cashAccounts,
  openInvoices,
  submitting,
  formatPeso,
}: CollectionFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 text-xs">
      
      {/* SECTION 1: Receiving Account */}
      <div className="space-y-1.5">
        <label className="font-extrabold text-foreground/80 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-[#e5167e]" />
          Receiving Cash / Bank Account <span className="text-[#e5167e]">*</span>
        </label>
        <select
          required
          value={formData.cash_account_id}
          onChange={(e) => onChange("cash_account_id", e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition-all"
        >
          {cashAccounts.length === 0 ? (
            <option value="">No Cash Accounts Available</option>
          ) : (
            cashAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name} ({formatPeso(Number(acc.current_balance) || 0)})
              </option>
            ))
          )}
        </select>
      </div>

      {/* SECTION 2: AR Invoice Matching (Optional) */}
      <div className="space-y-1.5 pt-1">
        <label className="font-extrabold text-foreground/80 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#e5167e]" />
            Select Open AR Invoice
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground lowercase">(optional)</span>
        </label>
        <select
          value={formData.invoice_id}
          onChange={(e) => onInvoiceSelect(e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition-all"
        >
          <option value="">-- Direct Payment (Unlinked Entry) --</option>
          {openInvoices.map((inv) => {
            const total = Number(inv.total_amount) || 0;
            const paid = Number(inv.amount_paid) || 0;
            const remaining = Math.max(0, total - paid);
            return (
              <option key={inv.id} value={inv.id}>
                {inv.client_name || "Client"} - #{inv.invoice_number || inv.id.substring(0, 8)} (Due: {formatPeso(remaining)})
              </option>
            );
          })}
        </select>
        {formData.invoice_id && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 pl-1">
            <AlertCircle className="w-3 h-3 text-blue-500 shrink-0" />
            Selecting an invoice pre-fills client name, remaining balance, and default OR reference.
          </p>
        )}
      </div>

      {/* SECTION 3: Client Name */}
      <div className="space-y-1.5 pt-1">
        <label className="font-extrabold text-foreground/80 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-[#e5167e]" />
          Client / Payer Name
        </label>
        <input
          type="text"
          placeholder="e.g. Airship Client / Customer"
          value={formData.client_name}
          onChange={(e) => onChange("client_name", e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition-all"
        />
      </div>

      {/* SECTION 4: Reference & Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <label className="font-extrabold text-foreground/80 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-[#e5167e]" />
            Reference / OR # <span className="text-[#e5167e]">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="OR-99102"
            value={formData.reference_number}
            onChange={(e) => onChange("reference_number", e.target.value)}
            className="w-full p-2.5 bg-background border border-border rounded-xl font-mono text-foreground outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-extrabold text-foreground/80 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[#e5167e]" />
            Amount Received (PHP) <span className="text-[#e5167e]">*</span>
          </label>
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={formData.amount_received}
            onChange={(e) => onChange("amount_received", e.target.value)}
            className="w-full p-2.5 bg-background border border-border rounded-xl font-mono text-foreground outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition-all"
          />
        </div>
      </div>

      {/* SECTION 5: Payment Channel */}
      <div className="space-y-1.5 pt-1">
        <label className="font-extrabold text-foreground/80 flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5 text-[#e5167e]" />
          Payment Channel / Method <span className="text-[#e5167e]">*</span>
        </label>
        <select
          value={formData.payment_method}
          onChange={(e) => onChange("payment_method", e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition-all"
        >
          <option value="gcash">GCash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cash">Cash</option>
          <option value="maya">Maya</option>
          <option value="check">Check</option>
        </select>
      </div>

      {/* Actions */}
      <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2.5 font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition text-xs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 font-bold text-white bg-[#e5167e] hover:bg-[#e5167e]/90 active:scale-95 rounded-xl transition shadow-md shadow-[#e5167e]/25 flex items-center gap-2 text-xs disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{submitting ? "Recording Payment..." : "Save Payment Collection"}</span>
        </button>
      </div>
    </form>
  );
}