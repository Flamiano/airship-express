import React from "react";
import { GLFormData, GL_ENTRY_FORM_ID } from "./types";

interface JournalEntryFormProps {
  formData: GLFormData;
  onChange: (field: keyof GLFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  formId?: string;
}

export function JournalEntryForm({
  formData,
  onChange,
  onSubmit,
  formId = GL_ENTRY_FORM_ID,
}: JournalEntryFormProps) {
  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-3 text-xs">
      <div>
        <label className="block font-bold mb-1 text-foreground">Account Name</label>
        <input
          required
          type="text"
          placeholder="e.g. Accounts Payable / Cash"
          value={formData.account_name}
          onChange={(e) => onChange("account_name", e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] transition"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-bold mb-1 text-foreground">Entry Type</label>
          <select
            value={formData.entry_type}
            onChange={(e) => onChange("entry_type", e.target.value)}
            className="w-full p-2.5 bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] transition"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <div>
          <label className="block font-bold mb-1 text-foreground">Category</label>
          <select
            value={formData.account_category}
            onChange={(e) => onChange("account_category", e.target.value)}
            className="w-full p-2.5 bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] transition"
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block font-bold mb-1 text-foreground">Amount (PHP)</label>
        <input
          type="number"
          step="0.01"
          required
          placeholder="0.00"
          value={formData.amount}
          onChange={(e) => onChange("amount", e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] transition"
        />
      </div>
      <div>
        <label className="block font-bold mb-1 text-foreground">Reference Number</label>
        <input
          type="text"
          placeholder="e.g. JV-2026-001"
          value={formData.reference_no}
          onChange={(e) => onChange("reference_no", e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] transition"
        />
      </div>
      <div>
        <label className="block font-bold mb-1 text-foreground">Description</label>
        <input
          type="text"
          placeholder="e.g. Manual Adjustment"
          value={formData.description}
          onChange={(e) => onChange("description", e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] transition"
        />
      </div>
    </form>
  );
}