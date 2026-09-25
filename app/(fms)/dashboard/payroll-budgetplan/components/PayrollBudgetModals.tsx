import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, XCircle, AlertTriangle } from "lucide-react";
import { Modal } from "../../../fmscomponents/ui/Modal";
import { PayrollStatusBadge } from "./PayrollStatusBadge";
import { LaborBudgetRow } from "../types";
import { formatPeso, monthName } from "../utils";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  processing: boolean;
  fiscalYear: number;
}

export function ApproveModal({ isOpen, onClose, processing, fiscalYear, target, onConfirm }: BaseModalProps & { target: LaborBudgetRow | null, onConfirm: () => void }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve Budget"
      maxWidth="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground font-bold transition text-xs border border-border">Cancel</button>
          <button type="button" disabled={processing} onClick={onConfirm} className="px-4 py-2 rounded-xl bg-[#e5167e] text-white font-bold hover:bg-[#e5167e]/90 disabled:opacity-50 transition shadow-md shadow-[#e5167e]/20 text-xs flex items-center gap-1.5">
            {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Approve Budget
          </button>
        </>
      }
    >
      {target && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-3">
          <div className="flex items-center gap-2 text-[#e5167e]">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-bold text-foreground">
              Approve the {monthName(target.month)} {fiscalYear} labor budget of {formatPeso(target.planned_amount)} submitted by {target.created_by_name || "—"}?
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Once approved, Payroll Admin will be able to activate it to enforce the cap.</p>
        </motion.div>
      )}
    </Modal>
  );
}

export function RejectModal({ isOpen, onClose, processing, fiscalYear, target, onConfirm }: BaseModalProps & { target: LaborBudgetRow | null, onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen) { setReason(""); setError(false); }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!reason.trim()) { setError(true); return; }
    onConfirm(reason.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reject Budget"
      maxWidth="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground font-bold transition text-xs border border-border">Cancel</button>
          <button type="button" disabled={processing} onClick={handleConfirm} className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-500 disabled:opacity-50 transition shadow-md shadow-rose-600/20 text-xs flex items-center gap-1.5">
            {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Reject Budget
          </button>
        </>
      }
    >
      {target && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-4">
          <div className="flex items-center gap-2 text-rose-500">
            <XCircle className="w-5 h-5" />
            <span className="text-sm font-bold text-foreground">
              Reject the {monthName(target.month)} {fiscalYear} labor budget of {formatPeso(target.planned_amount)} submitted by {target.created_by_name || "—"}?
            </span>
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground/70 mb-1">Reason for rejection *</label>
            <textarea rows={4} value={reason} onChange={(e) => { setReason(e.target.value); if (error) setError(false); }} placeholder="e.g. Amount exceeds the approved finance allocation for this period" className={`w-full p-2.5 bg-background border rounded-xl font-medium text-foreground outline-none transition ${error ? "border-rose-500 focus:border-rose-500" : "border-border focus:border-[#e5167e]"}`} />
            {error && <p className="text-xs text-rose-500 font-semibold mt-1">Rejection reason is required.</p>}
          </div>
        </motion.div>
      )}
    </Modal>
  );
}

export function DetailModal({ isOpen, onClose, target, fiscalYear }: Omit<BaseModalProps, "processing"> & { target: LaborBudgetRow | null }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={target ? `${monthName(target.month)} ${fiscalYear} Budget` : "Budget Detail"} maxWidth="max-w-lg">
      {target && (
        <div className="space-y-5">
          <PayrollStatusBadge status={target.status} />
          {target.is_over_budget && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              This month is OVER budget by {formatPeso(target.overspend)}.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Planned Budget</div>
              <div className="text-base font-extrabold text-foreground">{formatPeso(target.planned_amount)}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Actual Payroll</div>
              <div className="text-base font-extrabold text-foreground">{formatPeso(target.actual_amount)}</div>
            </div>
            <div className={`p-3 rounded-xl border space-y-1 ${target.remaining >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Remaining</div>
              <div className={`text-base font-extrabold ${target.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{formatPeso(target.remaining)}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Usage %</div>
              <div className="text-base font-extrabold text-foreground">{target.usage_pct.toFixed(2)}%</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Variance</div>
              <div className={`text-base font-extrabold ${target.variance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{formatPeso(target.variance)}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Variance %</div>
              <div className={`text-base font-extrabold ${target.variance_pct > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{target.variance_pct.toFixed(2)}%</div>
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border/60 pt-3">
            <div>Created by {target.created_by_name || "—"}</div>
            <div>Last modified by {target.last_modified_by_name || "—"}</div>
          </div>
          <div className="space-y-1 border-t border-border/60 pt-3">
            <div className="text-[10px] font-bold uppercase text-muted-foreground">Notes</div>
            <p className="text-xs text-foreground">{target.notes || "—"}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}