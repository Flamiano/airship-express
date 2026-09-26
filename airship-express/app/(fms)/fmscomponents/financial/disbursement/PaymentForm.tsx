import React from "react";
import { PaymentFormData, DISBURSEMENT_METHODS } from "./types";
import {
  Loader2,
  Calendar,
  CreditCard,
  Hash,
  MessageSquare,
  DollarSign,
} from "lucide-react";

interface PaymentFormProps {
  formData: PaymentFormData;
  setFormData: React.Dispatch<React.SetStateAction<PaymentFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  maxAmount: number;
}

export function PaymentForm({
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  maxAmount,
}: PaymentFormProps) {
  const formatMoney = (val: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Remaining Balance Summary Card */}
      <div className="relative overflow-hidden rounded-xl border border-[#e5167e]/30 bg-[#e5167e]/5 dark:bg-[#e5167e]/10 p-4 transition-colors">
        <div className="flex items-center justify-between relative z-10">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#e5167e]">
              Settlement Target
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Remaining balance to settle
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-foreground font-mono tracking-tight">
              {formatMoney(maxAmount)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[#e5167e]" />
            Payment Amount (PHP) <span className="text-[#e5167e]">*</span>
          </label>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            max={maxAmount}
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 font-mono font-semibold"
          />
          <span className="text-[10px] text-muted-foreground mt-1 block">
            Max allowable: {formatMoney(maxAmount)}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#e5167e]" />
            Payment Date <span className="text-[#e5167e]">*</span>
          </label>
          <input
            required
            type="date"
            value={formData.payment_date}
            onChange={(e) =>
              setFormData({ ...formData, payment_date: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold mb-1.5 text-foreground/80 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[#e5167e]" />
            Payment Method <span className="text-[#e5167e]">*</span>
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
            Reference / Voucher # <span className="text-[#e5167e]">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="e.g. PV-10293 or OR-8831"
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
          placeholder="Optional payment confirmation notes..."
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
          {isSubmitting ? "Recording Payment..." : "Record Disbursement Payment"}
        </button>
      </div>
    </form>
  );
}