import React from "react";
import { SlidersHorizontal, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CashAccount, AdjustmentFormData, ADJUSTMENT_FORM_ID } from "./types";

interface AdjustmentFormProps {
  accounts: CashAccount[];
  formData: AdjustmentFormData;
  onChange: (field: keyof AdjustmentFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  formatPeso: (val: number) => string;
}

export function AdjustmentForm({ accounts, formData, onChange, onSubmit, formatPeso }: AdjustmentFormProps) {
  const selectedAcc = accounts.find((a) => a.id === formData.accountId);

  return (
    <form id={ADJUSTMENT_FORM_ID} onSubmit={onSubmit} className="space-y-4 text-xs">
      <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-muted-foreground">
        <span className="font-semibold">Manual Cash Entry & Reconciliation</span>
        <SlidersHorizontal className="w-4 h-4 text-[#e5167e]" />
      </div>

      <div className="space-y-1.5">
        <label className="block font-bold text-foreground">Target Cash Account</label>
        <select
          value={formData.accountId}
          onChange={(e) => onChange("accountId", e.target.value)}
          className="w-full p-3 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e]/50 transition"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.account_name} ({formatPeso(Number(acc.current_balance) || 0)})
            </option>
          ))}
        </select>
        {selectedAcc && (
          <div className="text-[11px] text-muted-foreground flex justify-between px-1">
            <span>Current Recorded Balance:</span>
            <span className="font-mono font-bold text-foreground">
              {formatPeso(Number(selectedAcc.current_balance) || 0)}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block font-bold text-foreground">Adjustment Direction</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange("adjustmentDirection", "inflow")}
            className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${
              formData.adjustmentDirection === "inflow"
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-sm"
                : "bg-background border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            Inflow (Increase)
          </button>
          <button
            type="button"
            onClick={() => onChange("adjustmentDirection", "outflow")}
            className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${
              formData.adjustmentDirection === "outflow"
                ? "bg-rose-500/10 border-rose-500 text-rose-500 shadow-sm"
                : "bg-background border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            Outflow (Decrease)
          </button>
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <label className="block font-bold text-foreground">Adjustment Amount (PHP)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground font-bold">
            ₱
          </span>
          <input
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => onChange("amount", e.target.value)}
            className="w-full pl-8 pr-3 py-3 bg-background border border-border rounded-xl font-mono font-bold text-foreground outline-none focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e]/50 transition"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block font-bold text-foreground">Reference Number / Memo (Optional)</label>
        <input
          type="text"
          placeholder="e.g. ADJ-BANK-FEES or MANUAL-RECON"
          value={formData.reference}
          onChange={(e) => onChange("reference", e.target.value)}
          className="w-full p-3 bg-background border border-border rounded-xl font-mono text-foreground outline-none focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e]/50 transition"
        />
      </div>
    </form>
  );
}