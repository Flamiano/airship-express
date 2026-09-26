"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";

import { SummaryCard } from "../../fmscomponents/dashboard/SummaryCard";
import { DataTable, ColumnDef } from "../../fmscomponents/ui/DataTable";
import { Modal } from "../../fmscomponents/ui/Modal";
import { StatusBadge } from "../../fmscomponents/ui/StatusBadge";
import { SearchFilterBar } from "../../fmscomponents/ui/SearchFilterBar";
import { EmptyState } from "../../fmscomponents/ui/EmptyState";
import { LoadingState } from "../../fmscomponents/ui/LoadingState";

import { BillForm } from "../../fmscomponents/financial/ap/BillForm";
import { BillDetails } from "../../fmscomponents/financial/ap/BillDetails";
import { AccountPayable, BillFormData } from "../../fmscomponents/financial/ap/types";

import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Filter, 
  Download,
  Truck,
  Eye,
  Printer,
  RefreshCw,
  PieChart,
  AlertTriangle,
  CalendarClock,
  FileText,
  ShieldCheck,
  Building2
} from "lucide-react";

export default function AccountsPayablePage() {
  const router = useRouter();
  const [bills, setBills] = useState<AccountPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBill, setSelectedBill] = useState<AccountPayable | null>(null);

  // Form State
  const [formData, setFormData] = useState<BillFormData>({
    vendor_name: "",
    bill_number: "",
    amount_due: "",
    due_date: "",
    status: "pending"
  });

  const formatPeso = (val: number) => 
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Fetch Bills from Supabase
  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();

      if (sessionError || !sessionData.session) {
        if (sessionError?.name === "AuthSessionMissingError" || !sessionData.session) {
          router.replace("/fmsAuth");
          return;
        }
        throw sessionError ?? new Error("No active Supabase session");
      }

      const { data, error } = await supabase
        .from("accounts_payable")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to fetch bills", { description: error.message });
        console.error("Error fetching bills:", error.message, error.code, error.details, error.hint);
      } else if (data) {
        setBills(data as AccountPayable[]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load accounts payable.";
      toast.error("Failed to fetch bills", { description: message });
      console.error("Error fetching bills:", message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => { void fetchBills(); });
  }, [fetchBills]);

  const handleStatusUpdate = async (bill: AccountPayable, newStatus: "pending" | "approved" | "paid") => {
    const { data, error } = await supabase.rpc("update_ap_bill_status", {
      p_bill_id: bill.id,
      p_new_status: newStatus,
    });

    if (error) {
      toast.error("Integrated update failed", { description: error.message });
      return;
    }

    const result = data as { success?: boolean; error?: string } | null;
    if (result?.success === false || !result?.success) {
      toast.error("Integrated update failed", {
        description: result?.error || "The database did not persist this status change.",
      });
      await fetchBills();
      return;
    }

    toast.success(`Bill status updated to ${newStatus}`, {
      description: newStatus === "paid" 
        ? "Cross-posted to Disbursements and General Ledger."
        : newStatus === "approved" 
        ? "Queued to Disbursements ledger." 
        : "Status synchronized across modules."
    });

    await fetchBills();
  };

  // Handle Bill Submission
  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_name || !formData.bill_number || !formData.amount_due || !formData.due_date) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    const amountVal = parseFloat(formData.amount_due);

    try {
      const { data, error } = await supabase.rpc("create_ap_bill", {
        p_vendor_name: formData.vendor_name.trim(),
        p_bill_number: formData.bill_number.trim(),
        p_amount_due: amountVal,
        p_due_date: formData.due_date,
        p_initial_status: formData.status,
      });

      if (error) throw error;

      const result = data as { success?: boolean; error?: string; id?: string } | null;
      if (result && result.success === false) {
        throw new Error(result.error || "Create bill RPC reported failure.");
      }

      if (!result || result.success !== true) {
        throw new Error("Create bill RPC returned an unexpected response.");
      }

      await fetchBills();

      toast.success("Vendor bill added successfully!", {
        description: `Billed ${formatPeso(amountVal)} from ${formData.vendor_name}. Integrated into GL.`,
      });

      setIsModalOpen(false);
      setFormData({ vendor_name: "", bill_number: "", amount_due: "", due_date: "", status: "pending" });
    } catch (error) {
      toast.error("Failed to create bill", {
        description: error instanceof Error ? error.message : "Unable to create the vendor bill.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metrics Calculations
  const totalOutstanding = bills
    .filter(b => b.status?.toLowerCase() !== "paid")
    .reduce((sum, b) => sum + (Number(b.amount_due) || 0), 0);

  const totalPaidMonth = bills
    .filter(b => b.status?.toLowerCase() === "paid")
    .reduce((sum, b) => sum + (Number(b.amount_due) || 0), 0);

  const pendingApprovalCount = bills.filter(b => b.status?.toLowerCase() === "pending").length;

  // AP-specific analysis derived from existing bills data
  const payableStatusDistribution = useMemo(() => {
    const grandTotal = bills.reduce((sum, b) => sum + (Number(b.amount_due) || 0), 0) || 1;
    const byStatus = (s: string) => bills.filter((b) => b.status?.toLowerCase() === s);
    const sumAmt = (arr: AccountPayable[]) => arr.reduce((sum, b) => sum + (Number(b.amount_due) || 0), 0);

    const pending = byStatus("pending");
    const approved = byStatus("approved");
    const paid = byStatus("paid");
    const pendingAmt = sumAmt(pending);
    const approvedAmt = sumAmt(approved);
    const paidAmt = sumAmt(paid);

    return {
      pending: { count: pending.length, amount: pendingAmt, pct: Math.round((pendingAmt / grandTotal) * 100) },
      approved: { count: approved.length, amount: approvedAmt, pct: Math.round((approvedAmt / grandTotal) * 100) },
      paid: { count: paid.length, amount: paidAmt, pct: Math.round((paidAmt / grandTotal) * 100) },
    };
  }, [bills]);

  const obligationExposure = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(today.getDate() + 7);

    const overdue = { count: 0, amount: 0 };
    const dueSoon = { count: 0, amount: 0 };
    const later = { count: 0, amount: 0 };

    bills.forEach((b) => {
      if (b.status?.toLowerCase() === "paid") return;
      const amt = Number(b.amount_due) || 0;
      const due = new Date(b.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) {
        overdue.count += 1;
        overdue.amount += amt;
      } else if (due <= sevenDaysOut) {
        dueSoon.count += 1;
        dueSoon.amount += amt;
      } else {
        later.count += 1;
        later.amount += amt;
      }
    });

    return { overdue, dueSoon, later };
  }, [bills]);

  // Filter Logic
  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      (bill.vendor_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bill.bill_number || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || bill.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const hasNoRecords = !loading && bills.length === 0;
  const hasNoFilteredRecords = !loading && filteredBills.length === 0 && bills.length > 0;

  // CSV Export
  const handleExportCSV = () => {
    if (filteredBills.length === 0) return;
    const headers = ["Bill Number", "Vendor", "Amount Due (PHP)", "Due Date", "Status"];
    const rows = filteredBills.map((bill) => [
      `"${bill.bill_number}"`,
      `"${(bill.vendor_name || "").replace(/"/g, '""')}"`,
      bill.amount_due,
      bill.due_date,
      bill.status,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `accounts_payable_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<AccountPayable>[] = useMemo(() => [
    {
      header: "Bill Voucher Number",
      accessor: (bill) => (
        <span className="font-mono font-bold text-[#e5167e] text-xs bg-[#e5167e]/10 border border-[#e5167e]/20 px-2 py-1 rounded-md inline-block">
          {bill.bill_number}
        </span>
      )
    },
    {
      header: "Vendor / Carrier",
      accessor: (bill) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-muted/60 border border-border flex items-center justify-center shrink-0 text-muted-foreground">
            <Building2 className="w-3.5 h-3.5 text-[#e5167e]" />
          </div>
          <span className="font-bold text-foreground text-xs">{bill.vendor_name}</span>
        </div>
      )
    },
    {
      header: "Amount Due",
      accessor: (bill) => (
        <span className="font-black text-foreground tracking-tight font-mono text-sm">
          {formatPeso(Number(bill.amount_due))}
        </span>
      )
    },
    {
      header: "Due Date",
      accessor: (bill) => (
        <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
          {formatDate(bill.due_date)}
        </span>
      )
    },
    {
      header: "Status",
      accessor: (bill) => (
        <StatusBadge status={bill.status} />
      )
    },
    {
      header: "Actions / Status",
      className: "text-right",
      accessor: (bill) => (
        <div className="flex items-center justify-end gap-2">
          <button 
            onClick={() => setSelectedBill(bill)}
            className="p-1.5 text-muted-foreground hover:text-[#e5167e] hover:bg-[#e5167e]/10 rounded-lg transition-all duration-150 border border-transparent hover:border-[#e5167e]/20"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <select
            value={bill.status}
            onChange={(e) => handleStatusUpdate(bill, e.target.value as "pending" | "approved" | "paid")}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-border bg-card text-foreground outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition cursor-pointer shadow-sm hover:border-[#e5167e]/50"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      )
    }
  ], [handleStatusUpdate]);

  return (
    <div className="p-6 md:p-8 space-y-7 bg-background min-h-screen text-foreground transition-colors duration-200">
      
      {/* REFINED HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-card via-card/90 to-background p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#e5167e]/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e5167e]/10 border border-[#e5167e]/20 text-[#e5167e] text-xs font-extrabold uppercase tracking-widest">
              <CreditCard className="w-3.5 h-3.5" />
              Accounts Payable Operational Hub
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mt-2">
              Accounts Payable <span className="text-[#e5167e]">(AP)</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Monitor carrier bills, review vendor payment authorizations, track due-date exposure, and manage downstream disbursement workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={fetchBills}
              title="Refresh AP Ledger"
              className="p-2.5 text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e5167e]" : "text-muted-foreground"}`} />
            </button>
            <button 
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-foreground bg-card border border-border hover:bg-muted/50 rounded-xl transition shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              Export CSV
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#e5167e] hover:bg-[#e5167e]/90 rounded-xl transition shadow-md shadow-[#e5167e]/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Add Vendor Bill
            </button>
          </div>
        </div>
      </div>

      {/* METRIC SUMMARY CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 items-stretch">
        <SummaryCard
          title="Total Outstanding AP"
          value={formatPeso(totalOutstanding)}
          subtitle={`Across ${bills.filter(b => b.status?.toLowerCase() !== 'paid').length} active bills`}
          trend="Live Exposure"
          isPositive={false}
          icon={<CreditCard size={20} />}
          className="border-[#e5167e]/30 bg-gradient-to-br from-card via-card to-[#e5167e]/5"
        />
        <SummaryCard
          title="Pending Approval"
          value={`${pendingApprovalCount} Bills`}
          subtitle="Requires payout review"
          trend="Pending Review"
          isPositive={false}
          icon={<Clock size={20} />}
          className="border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/5"
        />
        <SummaryCard
          title="Total Registered Bills"
          value={`${bills.length}`}
          subtitle="All recorded payables"
          trend="Total Records"
          isPositive={true}
          icon={<Truck size={20} />}
        />
        <SummaryCard
          title="Paid & Settled"
          value={formatPeso(totalPaidMonth)}
          subtitle="Reconciled payouts"
          trend="Settled"
          isPositive={true}
          icon={<CheckCircle2 size={20} />}
          className="border-emerald-500/20 hover:border-emerald-500/40"
        />
      </section>

      {/* AP ANALYSIS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Payable Status Distribution Stepper */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6 hover:border-[#e5167e]/40 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-[#e5167e] text-xs font-extrabold uppercase tracking-wider">
                <PieChart className="w-4 h-4" />
                Payable Lifecycle Progression
              </div>
              <h3 className="text-base font-bold text-foreground">Payable Status Distribution</h3>
            </div>
            <span className="text-xs font-extrabold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/50">
              {bills.length} Total Bills
            </span>
          </div>

          <p className="text-xs text-muted-foreground -mt-2">
            Lifecycle progression tracking registered bills from pending verification through approval to final settlement.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Pending */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Pending
                </span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                  {payableStatusDistribution.pending.pct}%
                </span>
              </div>
              <div className="text-xl font-black text-foreground font-mono">
                {formatPeso(payableStatusDistribution.pending.amount)}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-amber-500/15">
                <span>Volume</span>
                <span className="font-bold text-foreground">{payableStatusDistribution.pending.count} {payableStatusDistribution.pending.count === 1 ? 'bill' : 'bills'}</span>
              </div>
            </div>

            {/* Approved */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Approved
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full">
                  {payableStatusDistribution.approved.pct}%
                </span>
              </div>
              <div className="text-xl font-black text-foreground font-mono">
                {formatPeso(payableStatusDistribution.approved.amount)}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-blue-500/15">
                <span>Volume</span>
                <span className="font-bold text-foreground">{payableStatusDistribution.approved.count} {payableStatusDistribution.approved.count === 1 ? 'bill' : 'bills'}</span>
              </div>
            </div>

            {/* Paid */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                  {payableStatusDistribution.paid.pct}%
                </span>
              </div>
              <div className="text-xl font-black text-foreground font-mono">
                {formatPeso(payableStatusDistribution.paid.amount)}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-emerald-500/15">
                <span>Volume</span>
                <span className="font-bold text-foreground">{payableStatusDistribution.paid.count} {payableStatusDistribution.paid.count === 1 ? 'bill' : 'bills'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
              <div
                style={{ width: `${payableStatusDistribution.pending.pct}%` }}
                className="bg-amber-500 h-full transition-all duration-500"
                title={`Pending: ${payableStatusDistribution.pending.pct}%`}
              />
              <div
                style={{ width: `${payableStatusDistribution.approved.pct}%` }}
                className="bg-blue-500 h-full transition-all duration-500"
                title={`Approved: ${payableStatusDistribution.approved.pct}%`}
              />
              <div
                style={{ width: `${payableStatusDistribution.paid.pct}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`Paid: ${payableStatusDistribution.paid.pct}%`}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground px-1">
              <span>Pending Review</span>
              <span>Approved Disbursement</span>
              <span>Reconciled Ledger</span>
            </div>
          </div>
        </div>

        {/* Upcoming Obligations Exposure */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6 flex flex-col justify-between hover:border-[#e5167e]/40 transition-colors">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-[#e5167e] text-xs font-extrabold uppercase tracking-wider">
                  <CalendarClock className="w-4 h-4" />
                  Exposure Analysis
                </div>
                <h3 className="text-base font-bold text-foreground">Upcoming Obligations</h3>
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/50">
                Due Date Proximity
              </span>
            </div>

            <p className="text-xs text-muted-foreground -mt-2">
              Categorized exposure of outstanding liabilities mapped to settlement urgency windows.
            </p>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                      Overdue Exposure
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {obligationExposure.overdue.count} {obligationExposure.overdue.count === 1 ? "bill requires immediate payout" : "bills require immediate payout"}
                    </div>
                  </div>
                </div>
                <span className="font-mono font-black text-foreground text-base">
                  {formatPeso(obligationExposure.overdue.amount)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                      Due Within 7 Days
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {obligationExposure.dueSoon.count} {obligationExposure.dueSoon.count === 1 ? "bill in current cycle" : "bills in current cycle"}
                    </div>
                  </div>
                </div>
                <span className="font-mono font-black text-foreground text-base">
                  {formatPeso(obligationExposure.dueSoon.amount)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/60 text-muted-foreground">
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-foreground/80 uppercase tracking-wide">
                      Due Later
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {obligationExposure.later.count} {obligationExposure.later.count === 1 ? "bill beyond 7 days" : "bills beyond 7 days"}
                    </div>
                  </div>
                </div>
                <span className="font-mono font-black text-foreground text-base">
                  {formatPeso(obligationExposure.later.amount)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${obligationExposure.overdue.count > 0 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
            {obligationExposure.overdue.count === 0
              ? "No overdue vendor obligations — payables are current."
              : `${obligationExposure.overdue.count} vendor ${obligationExposure.overdue.count === 1 ? "bill is" : "bills are"} past due and awaiting disbursement.`}
          </div>
        </div>
      </div>

      {/* BILLS DIRECTORY MANAGEMENT TABLE */}
      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col hover:border-[#e5167e]/30 transition-colors">
        <div className="p-4 md:p-5 border-b border-border bg-card/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#e5167e]" />
                Accounts Payable Directory
              </h3>
              <p className="text-xs text-muted-foreground">
                Financial directory of registered vendor bills, carrier obligations, and settlement status.
              </p>
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Showing <span className="font-bold text-foreground">{filteredBills.length}</span> of <span className="font-bold text-foreground">{bills.length}</span> entries
            </div>
          </div>

          <SearchFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Search by bill voucher number or vendor name..."
          >
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold text-foreground bg-background border border-border rounded-xl outline-none focus:border-[#e5167e] focus:ring-2 focus:ring-[#e5167e]/20 transition cursor-pointer shadow-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </SearchFilterBar>
        </div>

        {loading ? (
          <LoadingState message="Loading live AP ledger..." className="py-16" />
        ) : hasNoRecords ? (
          <EmptyState 
            title="No accounts payable records found." 
            description="Start by recording new vendor bills."
            className="m-5"
          />
        ) : hasNoFilteredRecords ? (
          <EmptyState 
            title="No accounts payable records match your current filters." 
            description="Try adjusting search criteria or filter settings."
            className="m-5"
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredBills}
            getRowId={(row) => row.id}
            className="border-0 rounded-none shadow-none"
          />
        )}
      </section>

      {/* ADD VENDOR BILL MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Vendor Bill"
      >
        <BillForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleAddBill}
          onCancel={() => setIsModalOpen(false)}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* VIEW BILL DETAILS MODAL */}
      <Modal
        isOpen={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        title="Vendor Payable Voucher Details"
        footer={
          <div className="flex items-center justify-between w-full">
            <button 
              onClick={() => window.print()} 
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-background border border-border hover:bg-muted/50 rounded-xl text-foreground transition shadow-sm"
            >
              <Printer className="w-4 h-4 text-muted-foreground" /> Print Voucher
            </button>
            <button 
              onClick={() => setSelectedBill(null)} 
              className="px-4 py-2 text-xs font-bold text-white bg-[#e5167e] rounded-xl shadow-md shadow-[#e5167e]/20 hover:bg-[#e5167e]/90 transition"
            >
              Close
            </button>
          </div>
        }
      >
        {selectedBill && (
          <BillDetails 
            bill={selectedBill} 
            formatDate={formatDate} 
            formatPeso={formatPeso} 
          />
        )}
      </Modal>

    </div>
  );
}