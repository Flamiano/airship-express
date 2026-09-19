// components/financial/budget/BudgetForm.tsx
import React from "react";
import { BudgetFormData, BUDGET_FORM_ID } from "./types";

interface BudgetFormProps {
  formData: BudgetFormData;
  onChange: (field: keyof BudgetFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function BudgetForm({ formData, onChange, onSubmit }: BudgetFormProps) {
  return (
    <form id={BUDGET_FORM_ID} onSubmit={onSubmit} className="space-y-3 text-xs">
      <div>
        <label className="block font-bold text-foreground/70 mb-1">
          Period / Department Name
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Q3 Operational Budget or IT Dept"
          value={formData.period_name}
          onChange={(e) => onChange("period_name", e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e]"
        />
      </div>

      <div>
        <label className="block font-bold text-foreground/70 mb-1">
          Allocated Amount (PHP)
        </label>
        <input
          type="number"
          step="0.01"
          required
          placeholder="0.00"
          value={formData.allocated_amount}
          onChange={(e) => onChange("allocated_amount", e.target.value)}
          className="w-full p-2.5 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-bold text-foreground/70 mb-1">Start Date</label>
          <input
            type="date"
            value={formData.start_date}
            onChange={(e) => onChange("start_date", e.target.value)}
            className="w-full p-2.5 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e]"
          />
        </div>

        <div>
          <label className="block font-bold text-foreground/70 mb-1">End Date</label>
          <input
            type="date"
            value={formData.end_date}
            onChange={(e) => onChange("end_date", e.target.value)}
            className="w-full p-2.5 bg-background border border-border rounded-xl font-medium text-foreground outline-none focus:border-[#e5167e]"
          />
        </div>
      </div>
    </form>
  );
}