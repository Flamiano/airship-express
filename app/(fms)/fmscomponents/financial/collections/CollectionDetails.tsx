import React from "react";
import { CollectionRecord } from "./types";
import { StatusBadge } from "../../ui/StatusBadge";
import { ShieldCheck, Calendar, CreditCard, Building2, Hash, FileText, User, ArrowDownRight } from "lucide-react";

interface CollectionDetailsProps {
  collection: CollectionRecord;
  onClose: () => void;
  formatPeso: (val: number) => string;
  formatPaymentMethod: (method?: string | null) => string;
}

export function CollectionDetails({
  collection,
  onClose,
  formatPeso,
  formatPaymentMethod,
}: CollectionDetailsProps) {
  return (
    <div className="space-y-4 text-xs">
      
      {/* Hero Inflow Amount Card */}
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <ArrowDownRight className="w-3.5 h-3.5" />
            Total Amount Collected
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            +{formatPeso(Number(collection.amount_received) || 0)}
          </p>
        </div>
        <StatusBadge status="Recorded" />
      </div>

      {/* Audit Data Breakdown Grid */}
      <div className="p-4 bg-muted/20 rounded-2xl border border-border/80 space-y-3">
        
        <div className="flex justify-between items-center py-1 border-b border-border/40">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#e5167e]" />
            Client Name / Source:
          </span>
          <span className="font-bold text-foreground text-right">
            {collection.ar_invoices?.client_name || "Direct Payment / General Source"}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border/40">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#e5167e]" />
            Linked AR Invoice #:
          </span>
          <span className="font-bold font-mono text-foreground">
            {collection.ar_invoices?.invoice_number || "Direct Entry (Unlinked)"}
          </span>
        </div>

        {collection.ar_invoices?.external_waybill_id && (
          <div className="flex justify-between items-center py-1 border-b border-border/40">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              Waybill Reference:
            </span>
            <span className="font-bold font-mono text-foreground">
              {collection.ar_invoices.external_waybill_id}
            </span>
          </div>
        )}

        {collection.external_rider_id && (
          <div className="flex justify-between items-center py-1 border-b border-border/40">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              Rider / Operational Ref:
            </span>
            <span className="font-bold font-mono text-foreground">
              {collection.external_rider_id}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center py-1 border-b border-border/40">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#e5167e]" />
            Receiving Cash Account:
          </span>
          <span className="font-bold text-foreground">
            {collection.cash_mngmt?.account_name || "Unassigned Account"}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border/40">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-[#e5167e]" />
            Payment Method:
          </span>
          <span className="font-extrabold uppercase text-[#e5167e] bg-[#e5167e]/10 px-2 py-0.5 rounded text-[11px]">
            {formatPaymentMethod(collection.payment_method)}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border/40">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-muted-foreground" />
            Reference OR Number:
          </span>
          <span className="font-mono font-bold text-foreground bg-card px-2 py-0.5 rounded border border-border">
            {collection.reference_number || "—"}
          </span>
        </div>

        <div className="flex justify-between items-center py-1 border-b border-border/40">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            Collection Date:
          </span>
          <span className="font-medium text-foreground">
            {collection.created_at || collection.collection_date
              ? new Date(
                  collection.created_at || collection.collection_date!
                ).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </span>
        </div>

        <div className="flex justify-between items-center py-1">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Collection Category:
          </span>
          <span className="font-medium text-foreground">
            {collection.collection_type || "AR Settlement"}
          </span>
        </div>

      </div>

      {/* Footer Info & Action */}
      <div className="pt-2 flex items-center justify-between border-t border-border">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
            RPC Transaction Entry
        </span>
        <button
          onClick={onClose}
          className="px-4 py-2 font-bold text-white bg-[#e5167e] hover:bg-[#e5167e]/90 active:scale-95 rounded-xl transition text-xs shadow-sm"
        >
          Close Audit View
        </button>
      </div>
    </div>
  );
}