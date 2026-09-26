import React from "react";
import { Loader2, Building2, Hash, DollarSign, Calendar, ShieldCheck } from "lucide-react";
import { BillFormData } from "./types";

interface BillFormProps {
  formData: BillFormData;
  setFormData: React.Dispatch<React.SetStateAction<BillFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function BillForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
}: BillFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-[#e5167e]" /> Vendor / Carrier Name
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Shell Logistics Fuel"
          value={formData.vendor_name}
          onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
          className="w-full px-3.5 py-2.5 text-xs bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition shadow-sm font-medium"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5 text-[#e5167e]" /> Bill Voucher Number
        </label>
        <input
          type="text"
          required
          placeholder="e.g. BILL-2026-901"
          value={formData.bill_number}
          onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
          className="w-full px-3.5 py-2.5 text-xs bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition shadow-sm font-mono font-medium"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[#e5167e]" /> Amount Due (PHP)
          </label>
          <input
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            value={formData.amount_due}
            onChange={(e) => setFormData({ ...formData, amount_due: e.target.value })}
            className="w-full px-3.5 py-2.5 text-xs bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition shadow-sm font-mono font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#e5167e]" /> Due Date
          </label>
          <input
            type="date"
            required
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            className="w-full px-3.5 py-2.5 text-xs bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition shadow-sm font-medium"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#e5167e]" /> Initial Bill Status
        </label>
        <select
          value={formData.status}
          onChange={(e) =>
            setFormData({
              ...formData,
              status: e.target.value as "pending" | "approved" | "paid",
            })
          }
          className="w-full px-3.5 py-2.5 text-xs bg-background border border-border rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition shadow-sm font-medium cursor-pointer"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-border/60">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground border border-border hover:bg-muted/50 rounded-xl transition shadow-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2.5 text-xs font-bold text-white bg-[#e5167e] hover:bg-[#e5167e]/90 rounded-xl transition flex items-center gap-2 shadow-md shadow-[#e5167e]/20 active:scale-95"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Vendor Bill
        </button>
      </div>
    </form>
  );
}