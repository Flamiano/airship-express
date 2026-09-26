import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, FileText, Bell } from "lucide-react";
import { DataTable } from "../../../fmscomponents/ui/DataTable";
import type { ColumnDef } from "../../../fmscomponents/ui/DataTable";
import { LoadingState } from "../../../fmscomponents/ui/LoadingState";
import { EmptyState } from "../../../fmscomponents/ui/EmptyState";
import { PayrollStatusBadge } from "./PayrollStatusBadge";
import { Pagination } from "./Pagination";
import { LaborBudgetRow } from "../types";
import { formatPeso, monthName } from "../utils";

interface PendingSectionProps {
  rows: LaborBudgetRow[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onApprove: (row: LaborBudgetRow) => void;
  onReject: (row: LaborBudgetRow) => void;
}

export function PendingQueueSection({ rows, loading, page, totalPages, onPageChange, onApprove, onReject }: PendingSectionProps) {
  const columns: ColumnDef<LaborBudgetRow>[] = [
    { header: "Month", accessor: (row) => <span className="font-bold text-foreground">{monthName(row.month)}</span> },
    { header: "Submitted By", accessor: (row) => row.created_by_name || "—" },
    { header: "Planned Amount", accessor: (row) => <span className="font-extrabold text-foreground">{formatPeso(row.planned_amount)}</span> },
    { header: "Actual Payroll", accessor: (row) => formatPeso(row.actual_amount) },
    { header: "Last Modified By", accessor: (row) => row.last_modified_by_name || "—" },
    { header: "Notes", accessor: (row) => <span className="text-muted-foreground truncate block max-w-[220px]">{row.notes || "—"}</span> },
    {
      header: "Actions",
      className: "text-right",
      accessor: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" title="Approve this budget" onClick={() => onApprove(row)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition">
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button type="button" title="Reject this budget with a required reason" onClick={() => onReject(row)} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Pending Approval Queue</h2>
        <p className="text-xs text-muted-foreground">Monthly labor budget submissions awaiting Finance decision</p>
      </div>

      {loading ? (
        <LoadingState message="Loading pending submissions..." />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Bell className="w-8 h-8" />} title="No budgets pending approval" />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable columns={columns} data={rows} getRowId={(row) => row.plan_id || `${row.month}`} />
          </div>
          <div className="space-y-3 md:hidden">
            <AnimatePresence initial={false}>
              {rows.map((row) => (
                <motion.div key={row.plan_id || `${row.month}-${row.status}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{monthName(row.month)}</span>
                    <span className="font-extrabold text-foreground">{formatPeso(row.planned_amount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Submitted by {row.created_by_name || "—"}</div>
                    <div>Actual payroll: {formatPeso(row.actual_amount)}</div>
                    {row.notes && <div className="truncate">{row.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <button type="button" onClick={() => onApprove(row)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button type="button" onClick={() => onReject(row)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} label="Pending Approval Queue" />
    </section>
  );
}

interface HistorySectionProps {
  rows: LaborBudgetRow[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDetail: (row: LaborBudgetRow) => void;
}

export function ReviewHistoryQueueSection({ rows, loading, page, totalPages, onPageChange, onDetail }: HistorySectionProps) {
  const columns: ColumnDef<LaborBudgetRow>[] = [
    { header: "Month", accessor: (row) => <span className="font-bold text-foreground">{monthName(row.month)}</span> },
    { header: "Planned", accessor: (row) => <span className="font-extrabold text-foreground">{formatPeso(row.planned_amount)}</span> },
    { header: "Actual", accessor: (row) => formatPeso(row.actual_amount) },
    { header: "Variance", accessor: (row) => <span className={row.variance > 0 ? "font-bold text-rose-600 dark:text-rose-400" : "font-bold text-emerald-600 dark:text-emerald-400"}>{formatPeso(row.variance)}</span> },
    { header: "Status", accessor: (row) => <PayrollStatusBadge status={row.status} /> },
    { header: "Last Modified By", accessor: (row) => row.last_modified_by_name || "—" },
    {
      header: "Detail",
      className: "text-right",
      accessor: (row) => (
        <button type="button" title="View full budget detail" onClick={() => onDetail(row)} className="p-1.5 rounded-lg text-muted-foreground hover:text-[#e5167e] hover:bg-[#e5167e]/10 transition">
          <FileText className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Review History</h2>
        <p className="text-xs text-muted-foreground">Read-only record of previously reviewed labor budgets</p>
      </div>

      {loading ? (
        <LoadingState message="Loading review history..." />
      ) : rows.length === 0 ? (
        <EmptyState title="No reviewed budgets yet" />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable columns={columns} data={rows} getRowId={(row) => row.plan_id || `${row.month}`} />
          </div>
          <div className="space-y-3 md:hidden">
            <AnimatePresence initial={false}>
              {rows.map((row) => (
                <motion.div key={row.plan_id || `${row.month}-${row.status}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{monthName(row.month)}</span>
                    <PayrollStatusBadge status={row.status} />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Planned: {formatPeso(row.planned_amount)}</div>
                    <div>Actual: {formatPeso(row.actual_amount)}</div>
                    <div>Variance: {formatPeso(row.variance)}</div>
                    <div>Last modified by {row.last_modified_by_name || "—"}</div>
                  </div>
                  <button type="button" onClick={() => onDetail(row)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-muted-foreground border border-border text-xs font-bold hover:text-[#e5167e] hover:border-[#e5167e]/40 transition">
                    <FileText className="w-3.5 h-3.5" /> View Detail
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} label="Review History" />
    </section>
  );
}