import React from "react";
import { Tag } from "lucide-react";

export interface InvoiceFormProps {
  mode: "create" | "edit";
  clientName: string;
  setClientName: (val: string) => void;
  totalAmount: string;
  setTotalAmount: (val: string) => void;
  invoiceDate: string;
  setInvoiceDate: (val: string) => void;
  dueDate: string;
  setDueDate: (val: string) => void;
  externalWaybillId: string;
  setExternalWaybillId: (val: string) => void;
  externalClientId: string;
  setExternalClientId: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  minAmount?: number;
  invoiceNumber?: string;
}

export function InvoiceForm({
  mode,
  clientName,
  setClientName,
  totalAmount,
  setTotalAmount,
  invoiceDate,
  setInvoiceDate,
  dueDate,
  setDueDate,
  externalWaybillId,
  setExternalWaybillId,
  externalClientId,
  setExternalClientId,
  onSubmit,
  onCancel,
  isSubmitting,
  minAmount = 0.01,
  invoiceNumber,
}: InvoiceFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="pb-3 border-b border-border/40">
        <span className="text-[10px] font-black text-[#e5167e] uppercase tracking-wider">
          {mode === "create" ? "New Record" : "Update Record"}
        </span>
        {invoiceNumber && (
          <p className="text-xs font-mono text-foreground/50 mt-0.5">{invoiceNumber}</p>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-bold text-foreground/70 mb-1.5 uppercase tracking-wider">
          Client Name *
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Pacific Freight Logistics"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="w-full px-3.5 py-2 text-xs bg-background border border-border/80 rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e] transition-all font-medium"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-foreground/70 mb-1.5 uppercase tracking-wider">
            Total Amount (PHP) *
          </label>
          <input
            type="number"
            step="0.01"
            min={minAmount}
            required
            placeholder="15000.00"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full px-3.5 py-2 text-xs bg-background border border-border/80 rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e] transition-all font-mono font-medium"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-foreground/70 mb-1.5 uppercase tracking-wider">
            Invoice Date
          </label>
          <input
            type="date"
            required
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full px-3.5 py-2 text-xs bg-background border border-border/80 rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e] transition-all font-medium"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-foreground/70 mb-1.5 uppercase tracking-wider">
          Due Date *
        </label>
        <input
          type="date"
          required
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-3.5 py-2 text-xs bg-background border border-border/80 rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e] transition-all font-medium"
        />
      </div>

      <div className="border-t border-border/60 pt-3.5 space-y-3">
        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-[#e5167e]" />
          <p className="text-[10px] font-bold uppercase text-[#e5167e] tracking-wider">
            External Freight References
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase">
              Waybill ID
            </label>
            <input
              type="text"
              placeholder="e.g. WB-89012"
              value={externalWaybillId}
              onChange={(e) => setExternalWaybillId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-background border border-border/80 rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e] transition-all font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-foreground/60 mb-1 uppercase">
              External Client ID
            </label>
            <input
              type="text"
              placeholder="e.g. CLT-4401"
              value={externalClientId}
              onChange={(e) => setExternalClientId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-background border border-border/80 rounded-xl outline-none text-foreground focus:border-[#e5167e] focus:ring-1 focus:ring-[#e5167e] transition-all font-mono"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/80">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold text-foreground/70 hover:text-foreground hover:bg-border/30 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-bold text-white bg-[#e5167e] hover:bg-[#c01068] rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : mode === "create" ? "Save Invoice" : "Update Invoice"}
        </button>
      </div>
    </form>
  );
}