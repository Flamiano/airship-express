import React from "react";
import { AccountPayable } from "./types";
import { StatusBadge } from "../../ui/StatusBadge";
import { Building2, Calendar, CreditCard, ShieldCheck } from "lucide-react";

interface BillDetailsProps {
  bill: AccountPayable;
  formatDate: (dateStr: string) => string;
  formatPeso: (val: number) => string;
}

export function BillDetails({ bill, formatDate, formatPeso }: BillDetailsProps) {
  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#e5167e]/10 via-card to-card border border-[#e5167e]/20 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-extrabold text-[#e5167e] uppercase tracking-widest block mb-0.5">
            Vendor Bill Voucher
          </span>
          <h3 className="text-xl font-black text-foreground font-mono">{bill.bill_number}</h3>
        </div>
        <StatusBadge status={bill.status} />
      </div>

      {/* Structured Voucher Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/20 rounded-xl border border-border">
        <div className="space-y-1">
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-[#e5167e]" /> Vendor / Carrier
          </p>
          <p className="font-extrabold text-foreground text-sm">{bill.vendor_name}</p>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-[#e5167e]" /> Authorization Status
          </p>
          <p className="font-bold text-foreground text-xs capitalize">{bill.status}</p>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-[#e5167e]" /> Settlement Due Date
          </p>
          <p className="font-bold text-foreground text-xs">{formatDate(bill.due_date)}</p>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-3 h-3 text-[#e5167e]" /> Total Amount Due
          </p>
          <p className="font-black text-foreground text-base font-mono">
            {formatPeso(Number(bill.amount_due))}
          </p>
        </div>
      </div>
    </div>
  );
}