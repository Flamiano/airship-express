import React from "react";
import { DisbursementFormData, DISBURSEMENT_METHODS } from "./types";
import {
  Loader2,
  Building2,
  Tag,
  FileText,
  DollarSign,
  Calendar,
  CreditCard,
  Hash,
  MessageSquare,
} from "lucide-react";

interface DisbursementFormProps {
  formData: DisbursementFormData;
  setFormData: React.Dispatch<React.SetStateAction<DisbursementFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

export function DisbursementForm({
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
}: DisbursementFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#e5167e]" />
            Vendor / Payee <span className="text-[#e5167e]">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="e.g. Acme Logistics Corp"
            value={formData.vendor_name}
            onChange={(e) =>
              setFormData({ ...formData, vendor_name: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#e5167e]" />
            Expense Category
          </label>
          <input
            type="text"
            placeholder="e.g. Freight Operations, Utilities"
            value={formData.expense_category}
            onChange={(e) =>
              setFormData({ ...formData, expense_category: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-[#e5167e]" />
          Description
        </label>
        <input
          type="text"
          placeholder="Brief description of financial obligation..."
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[#e5167e]" />
            Amount (PHP) <span className="text-[#e5167e]">*</span>
          </label>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 font-mono font-semibold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#e5167e]" />
            Due Date <span className="text-[#e5167e]">*</span>
          </label>
          <input
            required
            type="date"
            value={formData.due_date}
            onChange={(e) =>
              setFormData({ ...formData, due_date: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[#e5167e]" />
            Payment Method
          </label>
          <select
            value={formData.payment_method}
            onChange={(e) =>
              setFormData({ ...formData, payment_method: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20"
          >
            {DISBURSEMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-[#e5167e]" />
            Reference Number
          </label>
          <input
            type="text"
            placeholder="Optional external ref or invoice #"
            value={formData.reference_number}
            onChange={(e) =>
              setFormData({ ...formData, reference_number: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[#e5167e]" />
          Notes
        </label>
        <input
          type="text"
          placeholder="Additional administrative notes..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20"
        />
      </div>

      <div className="pt-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#e5167e] py-3 px-4 text-sm font-bold text-white shadow-md shadow-[#e5167e]/20 hover:bg-[#e5167e]/90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? "Saving Draft..." : "Create Disbursement Draft"}
        </button>
      </div>
    </form>
  );
}