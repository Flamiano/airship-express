"use client";

import React from "react";
import { ReceiptText, RotateCcw } from "lucide-react";
import { DataTable, type ColumnDef } from "@/app/(fms)/fmscomponents/ui/DataTable";
import { SearchFilterBar } from "@/app/(fms)/fmscomponents/ui/SearchFilterBar";
import { EmptyState } from "@/app/(fms)/fmscomponents/ui/EmptyState";
import { LoadingState } from "@/app/(fms)/fmscomponents/ui/LoadingState";
import type { Invoice } from "@/app/(fms)/fmscomponents/financial/ar/types";

export interface ReceivablesDirectoryProps {
  invoices: Invoice[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  columns: ColumnDef<Invoice>[];
  onRowClick: (row: Invoice) => void;
  onClearFilters: () => void;
}

export function ReceivablesDirectory({
  invoices,
  loading,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  columns,
  onRowClick,
  onClearFilters,
}: ReceivablesDirectoryProps) {
  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
      {/* Section Header */}
      <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-foreground">Receivables Directory</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#e5167e]/10 text-[#e5167e] border border-[#e5167e]/20 font-mono">
              {invoices.length} {invoices.length === 1 ? "Invoice" : "Invoices"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational invoice directory, statement ledgers, and freight waybill records
          </p>
        </div>
      </div>

      {/* Search and Filter Control Bar */}
      <div className="p-4 border-b border-border/80 bg-card/50">
        <SearchFilterBar
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          placeholder="Search invoice number, client name, or waybill ID..."
        >
          <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border overflow-x-auto w-full sm:w-auto">
            {["All", "Unpaid", "Partially Paid", "Paid", "Overdue"].map((status) => (
              <button
                key={status}
                onClick={() => onStatusFilterChange(status)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap focus:outline-none ${
                  statusFilter === status
                    ? "bg-[#e5167e] text-white shadow-sm"
                    : "text-foreground/60 hover:text-foreground hover:bg-border/30"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </SearchFilterBar>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <LoadingState message="Loading invoices from database..." className="py-16" />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices found."
          description="No invoices match your active search or filter criteria."
          icon={<ReceiptText className="w-8 h-8 text-foreground/20 mx-auto" />}
          action={
            (searchTerm || statusFilter !== "All") && (
              <button
                onClick={onClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#e5167e] bg-[#e5167e]/10 hover:bg-[#e5167e]/20 border border-[#e5167e]/20 rounded-xl transition-all focus:outline-none"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          onRowClick={onRowClick}
          getRowId={(row) => row.id ?? row.invoice_number}
          className="border-0 rounded-none shadow-none"
        />
      )}
    </section>
  );
}