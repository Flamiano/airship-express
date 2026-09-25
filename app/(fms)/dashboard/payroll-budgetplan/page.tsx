"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Bell, RefreshCw } from "lucide-react";

import { SearchFilterBar } from "../../fmscomponents/ui/SearchFilterBar";
import { PayrollBudgetHeader } from "./components/PayrollBudgetHeader";
import { PayrollBudgetMetrics } from "./components/PayrollBudgetMetrics";
import { PendingQueueSection, ReviewHistoryQueueSection } from "./components/BudgetApprovalSections";
import { ApproveModal, RejectModal, DetailModal } from "./components/PayrollBudgetModals";

import { fetchLaborBudget, patchLaborBudget } from "./api";
import { LaborBudgetResponse, LaborBudgetRow } from "./types";
import { FISCAL_YEARS, PAGE_SIZE, monthName } from "./utils";

export default function FinancialBudgetApproval() {
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<LaborBudgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const [approveTarget, setApproveTarget] = useState<LaborBudgetRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LaborBudgetRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<LaborBudgetRow | null>(null);

  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetchLaborBudget(fiscalYear);
      setData(response);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load payroll budget submissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fiscalYear]);

  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [searchTerm, fiscalYear]);

  const rows = data?.rows ?? [];

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) => {
      const month = monthName(row.month).toLowerCase();
      const submitter = (row.created_by_name || "").toLowerCase();
      const modifier = (row.last_modified_by_name || "").toLowerCase();
      const notes = (row.notes || "").toLowerCase();

      return month.includes(term) || submitter.includes(term) || modifier.includes(term) || notes.includes(term);
    });
  }, [rows, searchTerm]);

  const pendingRows = useMemo(() => filteredRows.filter((r) => r.status === "pending_approval"), [filteredRows]);
  const historyRows = useMemo(() => filteredRows.filter((r) => ["approved", "active", "rejected", "closed"].includes(r.status || "")), [filteredRows]);

  const metrics = useMemo(() => {
    const pendingCount = rows.filter((r) => r.status === "pending_approval").length;
    const approvedCount = rows.filter((r) => r.status === "approved" || r.status === "active").length;
    const rejectedCount = rows.filter((r) => r.status === "rejected").length;
    const totalPlannedValue = rows.filter((r) => r.status === "approved" || r.status === "active").reduce((sum, r) => sum + (Number(r.planned_amount) || 0), 0);
    return { pendingCount, approvedCount, rejectedCount, totalPlannedValue };
  }, [rows]);

  const pendingTotalPages = Math.max(1, Math.ceil(pendingRows.length / PAGE_SIZE));
  const historyTotalPages = Math.max(1, Math.ceil(historyRows.length / PAGE_SIZE));
  const pendingPageRows = pendingRows.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE);
  const historyPageRows = historyRows.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);

  const handleApproveConfirm = async () => {
    if (!approveTarget?.plan_id) return toast.error("This submission has no plan reference and cannot be approved.");
    setProcessing(true);
    try {
      await patchLaborBudget(approveTarget.plan_id, { action: "approve" });
      toast.success(`${monthName(approveTarget.month)} budget approved.`);
      setApproveTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve this budget.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget?.plan_id) return toast.error("This submission has no plan reference and cannot be rejected.");
    setProcessing(true);
    try {
      await patchLaborBudget(rejectTarget.plan_id, { action: "reject", reason });
      toast.success(`${monthName(rejectTarget.month)} budget rejected.`);
      setRejectTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject this budget.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen text-foreground transition-colors duration-200">
      <PayrollBudgetHeader loading={loading} onRefresh={loadData} />
      
      <PayrollBudgetMetrics metrics={metrics} fiscalYear={fiscalYear} />

      {metrics.pendingCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
          <Bell className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">
            {metrics.pendingCount} budget{metrics.pendingCount === 1 ? "" : "s"} awaiting your review. Approve or reject each below.
          </span>
        </div>
      )}

      <SearchFilterBar searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder="Search month, submitter, modifier, or notes...">
        <select value={fiscalYear} title="Select fiscal year" onChange={(e) => setFiscalYear(Number(e.target.value))} className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#e5167e]/20 focus:border-[#e5167e] transition-all shadow-sm">
          {FISCAL_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <button type="button" title="Refresh payroll budget submissions" onClick={loadData} className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted/50 transition shadow-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e5167e]" : "text-muted-foreground"}`} />
        </button>
      </SearchFilterBar>

      <PendingQueueSection rows={pendingPageRows} loading={loading} page={pendingPage} totalPages={pendingTotalPages} onPageChange={setPendingPage} onApprove={setApproveTarget} onReject={setRejectTarget} />
      
      <ReviewHistoryQueueSection rows={historyPageRows} loading={loading} page={historyPage} totalPages={historyTotalPages} onPageChange={setHistoryPage} onDetail={setDetailTarget} />

      <ApproveModal isOpen={!!approveTarget} onClose={() => setApproveTarget(null)} processing={processing} fiscalYear={fiscalYear} target={approveTarget} onConfirm={handleApproveConfirm} />
      
      <RejectModal isOpen={!!rejectTarget} onClose={() => setRejectTarget(null)} processing={processing} fiscalYear={fiscalYear} target={rejectTarget} onConfirm={handleRejectConfirm} />
      
      <DetailModal isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} fiscalYear={fiscalYear} target={detailTarget} />
    </div>
  );
}