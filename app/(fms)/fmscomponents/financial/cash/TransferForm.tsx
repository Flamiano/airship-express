import React from "react";
import { ArrowRightLeft, Building2, Vault, Coins, CreditCard } from "lucide-react";
import { CashAccount, TransferFormData, TRANSFER_FORM_ID, AccountType } from "./types";

interface TransferFormProps {
  accounts: CashAccount[];
  formData: TransferFormData;
  onChange: (field: keyof TransferFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  formatPeso: (val: number) => string;
}

export function TransferForm({ accounts, formData, onChange, onSubmit, formatPeso }: TransferFormProps) {
  const selectedSource = accounts.find((a) => a.id === formData.fromAccountId);
  const selectedDest = accounts.find((a) => a.id === formData.toAccountId);

  return (
    <form id={TRANSFER_FORM_ID} onSubmit={onSubmit} className="space-y-4 text-xs">
      <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-muted-foreground">
        <span className="font-semibold">Inter-Account Treasury Transfer</span>
        <ArrowRightLeft className="w-4 h-4 text-[#e5167e]" />
      </div>

      <div className="space-y-1.5">
        <label className="block font-bold text-foreground">From Account (Source)</label>
        <select
          value={formData.fromAccountId}
          onChange={(e) => onChange("fromAccountId", e.target.value)}
          className="w-full p-3 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e]/50 transition"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.account_name} ({formatPeso(Number(acc.current_balance) || 0)})
            </option>
          ))}
        </select>
        {selectedSource && (
          <div className="text-[11px] text-muted-foreground flex justify-between px-1">
            <span>Available Balance:</span>
            <span className="font-mono font-bold text-foreground">
              {formatPeso(Number(selectedSource.current_balance) || 0)}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block font-bold text-foreground">To Account (Destination)</label>
        <select
          value={formData.toAccountId}
          onChange={(e) => onChange("toAccountId", e.target.value)}
          className="w-full p-3 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e]/50 transition"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.account_name} ({formatPeso(Number(acc.current_balance) || 0)})
            </option>
          ))}
        </select>
        {selectedDest && (
          <div className="text-[11px] text-muted-foreground flex justify-between px-1">
            <span>Current Balance:</span>
            <span className="font-mono font-bold text-foreground">
              {formatPeso(Number(selectedDest.current_balance) || 0)}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5 pt-1">
        <label className="block font-bold text-foreground">Transfer Amount (PHP)</label>
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
    </form>
  );
}