import React from "react";
import { Building2, History, Printer } from "lucide-react";
import { StatusBadge } from "@/app/(fms)/fmscomponents/ui/StatusBadge";
import type { Invoice, CollectionHistoryRecord } from "@/app/(fms)/fmscomponents/financial/ar/types";

interface InvoiceDetailsProps {
  invoice: Invoice;
  collections: CollectionHistoryRecord[];
  onPrint: () => void;
  onClose: () => void;
}

const formatPeso = (val: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

export function InvoiceDetails({ invoice, collections, onPrint, onClose }: InvoiceDetailsProps) {
  const progressPct =
    invoice.total_amount > 0 ? Math.round((invoice.amount_paid / invoice.total_amount) * 100) : 0;
  const outstanding = invoice.total_amount - invoice.amount_paid;

  return (
    <div className="space-y-5 text-xs">
      <div className="grid grid-cols-2 gap-4 p-4 bg-background/80 rounded-xl border border-border/80">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-foreground/40 font-bold uppercase text-[10px] mb-1">
            <Building2 className="w-3 h-3 text-[#e5167e]" /> Billed To
          </div>
          <p className="font-bold text-foreground text-sm">{invoice.client_name}</p>
        </div>
        <div>
          <p className="text-foreground/40 font-bold uppercase text-[10px] mb-1">Status</p>
          <StatusBadge status={invoice.status} className="border bg-transparent" />
        </div>
        <div>
          <p className="text-foreground/40 font-bold uppercase text-[10px] mb-0.5">Invoice Date</p>
          <p className="font-bold text-foreground/80">
            {invoice.invoice_date
              ? new Date(invoice.invoice_date).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "N/A"}
          </p>
        </div>
        <div>
          <p className="text-foreground/40 font-bold uppercase text-[10px] mb-0.5">Due Date</p>
          <p className="font-bold text-foreground/80">
            {new Date(invoice.due_date).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div>
          <p className="text-foreground/40 font-bold uppercase text-[10px] mb-0.5">Waybill Ref</p>
          <p className="font-mono font-bold text-foreground/80">
            {invoice.external_waybill_id || "None"}
          </p>
        </div>
        <div>
          <p className="text-foreground/40 font-bold uppercase text-[10px] mb-0.5">Client Ref ID</p>
          <p className="font-mono font-bold text-foreground/80">
            {invoice.external_client_id || "None"}
          </p>
        </div>
      </div>

      <div className="p-4 bg-background/80 rounded-xl border border-border/80 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-foreground/70">Payment Progress</span>
          <span className="font-mono font-bold text-[#e5167e]">{progressPct}%</span>
        </div>
        <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#e5167e] rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono text-center">
          <div>
            <p className="text-[9px] text-foreground/40 uppercase font-sans">Total Billed</p>
            <p className="font-bold">{formatPeso(invoice.total_amount)}</p>
          </div>
          <div>
            <p className="text-[9px] text-foreground/40 uppercase font-sans">Amount Paid</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400">
              {formatPeso(invoice.amount_paid)}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-foreground/40 uppercase font-sans">Outstanding</p>
            <p className="font-bold text-rose-500">{formatPeso(outstanding)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-[#e5167e]" />
            <h3 className="font-bold uppercase text-[10px] text-foreground/70 tracking-wider">
              Linked Collections & Payment History
            </h3>
          </div>
          <span className="text-[10px] text-foreground/50">{collections.length} records</span>
        </div>

        {collections.length === 0 ? (
          <div className="p-4 bg-background/50 border border-border/60 rounded-xl text-center text-foreground/50 text-[11px]">
            No payments recorded for this invoice yet.
          </div>
        ) : (
          <div className="border border-border/80 rounded-xl overflow-hidden divide-y divide-border/60 bg-background/80">
            {collections.map((col) => (
              <div key={col.id} className="p-3 text-[11px] flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">
                      {col.reference_number}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-foreground/10 text-[9px] font-bold uppercase text-foreground/70">
                      {col.payment_method.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-foreground/50 text-[10px]">
                    {col.collection_date
                      ? new Date(col.collection_date).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "N/A"}{" "}
                    • {col.cash_account_name}
                  </p>
                </div>
                <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                  +{formatPeso(col.amount_received)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onPrint}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-background border border-border/80 hover:bg-border/30 rounded-xl text-foreground transition-colors"
        >
          <Printer className="w-4 h-4 text-foreground/60" /> Print Statement
        </button>
        <button
          onClick={onClose}
          className="px-5 py-2 text-xs font-bold text-white bg-[#e5167e] hover:bg-[#c01068] rounded-xl shadow-sm transition-all active:scale-95"
        >
          Close
        </button>
      </div>
    </div>
  );
}