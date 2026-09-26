"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { SummaryCard } from "../../fmscomponents/dashboard/SummaryCard";
import { DataTable, ColumnDef } from "../../fmscomponents/ui/DataTable";
import { Modal } from "../../fmscomponents/ui/Modal";
import { StatusBadge } from "../../fmscomponents/ui/StatusBadge";
import { SearchFilterBar } from "../../fmscomponents/ui/SearchFilterBar";
import { 
  Banknote, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Download,
  Calendar,
  CreditCard,
  Plus,
  Eye,
  RefreshCw,
  PieChart,
  Wallet,
  ShieldCheck,
  Building2,
  FileText,
  Hash,
  Layers
} from "lucide-react";

import { CollectionForm } from "../../fmscomponents/financial/collections/CollectionForm";
import { CollectionDetails } from "../../fmscomponents/financial/collections/CollectionDetails";
import { 
  ARInvoice, 
  CashAccount, 
  CollectionRecord, 
  CollectionFormData 
} from "../../fmscomponents/financial/collections/types";

export const calculateInvoiceStatus = (
  totalAmount?: number | null,
  amountPaid?: number | null,
  dueDateStr?: string | null
): "Paid" | "Overdue" | "Partially Paid" | "Unpaid" => {
  const total = Number(totalAmount) || 0;
  const paid = Number(amountPaid) || 0;
  const outstanding = Math.max(0, total - paid);

  if (total > 0 && paid >= total) {
    return "Paid";
  }

  if (outstanding > 0) {
    if (dueDateStr) {
      const due = new Date(dueDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      if (due < today) {
        return "Overdue";
      }
    }
    if (paid > 0) {
      return "Partially Paid";
    }
    return "Unpaid";
  }

  return "Paid";
};

export default function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [openInvoices, setOpenInvoices] = useState<ARInvoice[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal & Detail State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<CollectionRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<CollectionFormData>({
    cash_account_id: "",
    invoice_id: "",
    client_name: "",
    amount_received: "",
    payment_method: "gcash",
    reference_number: ""
  });

  const formatPeso = (val: number) => 
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  const formatPaymentMethod = (method?: string | null) => {
    if (!method) return "—";
    switch (method) {
      case "bank_transfer": return "Bank Transfer";
      case "gcash": return "GCash";
      case "maya": return "Maya";
      case "cash": return "Cash";
      case "check": return "Check";
      default: return method.replace("_", " ");
    }
  };

  // Fetch Collections, Cash Accounts, and AR Invoices independently
  const fetchData = useCallback(async () => {
    setLoading(true);

    const [collRes, arRes, cashRes] = await Promise.all([
      supabase.from("collections").select("*"),
      supabase.from("ar_invoices").select("*"),
      supabase.from("cash_mngmt").select("id, account_name, account_type, current_balance")
    ]);

    if (collRes.error) {
      console.error("Error fetching collections:", collRes.error.message || collRes.error);
      toast.error("Failed to load collection records.");
    }

    if (arRes.error) {
      console.error("Error fetching AR invoices:", arRes.error.message || arRes.error);
    } else if (arRes.data) {
      const sortedInvoices = [...arRes.data].sort((a, b) => {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
        const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
        return dateA - dateB;
      });

      const updatedInvoices: ARInvoice[] = sortedInvoices.map((inv) => ({
        ...inv,
        status: calculateInvoiceStatus(inv.total_amount, inv.amount_paid, inv.due_date)
      }));

      // Only show invoices in dropdown that have an actual outstanding balance > 0 and are not Paid
      const filteredOpenInvoices = updatedInvoices.filter((inv) => {
        const total = Number(inv.total_amount) || 0;
        const paid = Number(inv.amount_paid) || 0;
        const remaining = total - paid;
        return remaining > 0 && inv.status !== "Paid";
      });

      setOpenInvoices(filteredOpenInvoices);
    }

    if (cashRes.error) {
      console.error("Error fetching cash accounts:", cashRes.error.message || cashRes.error);
    } else if (cashRes.data && cashRes.data.length > 0) {
      const sortedCash = [...cashRes.data].sort((a, b) => 
        (a.account_name || "").localeCompare(b.account_name || "")
      );
      setCashAccounts(sortedCash as CashAccount[]);
      setFormData((prev) => ({
        ...prev,
        cash_account_id: prev.cash_account_id || String(sortedCash[0].id || (sortedCash[0] as any).account_id)
      }));
    }

    if (collRes.data) {
      const arMap = new Map((arRes.data || []).map((inv: any) => [String(inv.id || inv.invoice_id), inv]));
      const cashMap = new Map((cashRes.data || []).map((cash: any) => [String(cash.id || cash.account_id || cash.cash_account_id), cash]));

      const mappedCollections: CollectionRecord[] = collRes.data.map((col: any) => {
        const colId = col.id || col.collection_id || "";
        const invoiceId = col.invoice_id;
        const cashAccountId = col.cash_account_id || col.account_id;

        const matchedInvoice = invoiceId ? arMap.get(String(invoiceId)) : null;
        const matchedAccount = cashAccountId ? cashMap.get(String(cashAccountId)) : null;

        return {
          ...col,
          id: String(colId),
          cash_account_id: cashAccountId ? String(cashAccountId) : null,
          invoice_id: invoiceId ? String(invoiceId) : null,
          amount_received: col.amount_received ?? col.amount ?? 0,
          payment_method: col.payment_method || col.method || col.channel || "",
          reference_number: col.reference_number || col.ref_number || col.reference_no || "",
          collection_type: col.collection_type || "AR Settlement",
          external_rider_id: col.external_rider_id || col.rider_id || null,
          created_at: col.created_at || col.collection_date || col.date || "",
          collection_date: col.collection_date || col.created_at || "",
          ar_invoices: matchedInvoice
            ? {
                client_name: matchedInvoice.client_name,
                due_date: matchedInvoice.due_date,
                invoice_number: matchedInvoice.invoice_number,
                external_waybill_id: matchedInvoice.external_waybill_id,
              }
            : null,
          cash_mngmt: matchedAccount
            ? {
                account_name: matchedAccount.account_name,
              }
            : null,
        };
      });

      // Sort by collection_date / created_at descending
      mappedCollections.sort((a, b) => {
        const timeA = a.created_at || a.collection_date ? new Date(a.created_at || a.collection_date || "").getTime() : 0;
        const timeB = b.created_at || b.collection_date ? new Date(b.created_at || b.collection_date || "").getTime() : 0;
        return timeB - timeA;
      });

      setCollections(mappedCollections);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormFieldChange = (field: keyof CollectionFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-fill form fields when an AR invoice is selected or deselected
  const handleInvoiceSelect = (invId: string) => {
    if (!invId) {
      setFormData((prev) => ({
        ...prev,
        invoice_id: "",
        client_name: "",
        amount_received: ""
      }));
      return;
    }

    const selected = openInvoices.find((inv) => String(inv.id) === invId);
    if (selected) {
      const total = Number(selected.total_amount) || 0;
      const paid = Number(selected.amount_paid) || 0;
      const remainingDue = Math.max(0, total - paid);

      setFormData((prev) => ({
        ...prev,
        invoice_id: invId,
        client_name: selected.client_name || "",
        amount_received: remainingDue > 0 ? String(remainingDue) : String(total),
        reference_number: prev.reference_number || `OR-${Date.now().toString().slice(-6)}`
      }));
    }
  };

  // Strong Validation & Atomic Execution via record_collection RPC
  const handleRecordCollection = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cash_account_id) {
      toast.error("Validation Error: Please select a receiving cash/bank account.");
      return;
    }

    const amount = parseFloat(formData.amount_received);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Validation Error: Please enter a valid amount received greater than 0.");
      return;
    }

    // Preserve existing validation: amount_received <= remaining invoice balance
    // Validate that a collection cannot exceed the invoice's remaining balance.
if (formData.invoice_id) {
  const selected = openInvoices.find(
    (inv) => String(inv.id) === formData.invoice_id
  );

  if (selected) {
    const total = Number(selected.total_amount) || 0;
    const paid = Number(selected.amount_paid) || 0;
    const remaining = Math.max(0, total - paid);

    if (Math.round(amount * 100) > Math.round(remaining * 100)) {
      toast.error(
        `Validation Error: Amount exceeds remaining invoice balance (${formatPeso(remaining)}).`
      );
      return;
    }
  }
}
    setSubmitting(true);
    try {
      const refNum = formData.reference_number.trim() || `OR-${Date.now().toString().slice(-6)}`;

      // Single transaction authority: record_collection RPC
      const { data, error } = await supabase.rpc("record_collection", {
        p_cash_account_id: formData.cash_account_id,
        p_invoice_id: formData.invoice_id || null,
        p_amount_received: amount,
        p_payment_method: formData.payment_method,
        p_reference_number: refNum
      });

      if (error) {
        throw new Error(error.message || "Database transaction error occurred.");
      }

      if (data && !data.success) {
        throw new Error(data.message || "Failed to record payment collection.");
      }

      toast.success("Payment recorded successfully!", {
        description: `Updated cash balance, created transaction inflow, and updated AR status.`
      });

      setIsModalOpen(false);
      setFormData({
        cash_account_id: cashAccounts[0] ? String(cashAccounts[0].id) : "",
        invoice_id: "",
        client_name: "",
        amount_received: "",
        payment_method: "gcash",
        reference_number: ""
      });

      await fetchData();
    } catch (err: any) {
      toast.error("Failed to record payment", { 
        description: err.message || "An unexpected error occurred while processing the transaction." 
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics Calculation dynamically derived from AR logic
  const metrics = useMemo(() => {
    const totalPortfolio = collections.reduce((acc, item) => acc + (Number(item.amount_received) || 0), 0);

    let totalOverdue = 0;
    let overdueCount = 0;
    let currentCount = 0;
    let totalOpenAR = 0;

    openInvoices.forEach((inv) => {
      const total = Number(inv.total_amount) || 0;
      const paid = Number(inv.amount_paid) || 0;
      const remaining = Math.max(0, total - paid);

      if (remaining <= 0) return;

      const currentStatus = calculateInvoiceStatus(inv.total_amount, inv.amount_paid, inv.due_date);

      totalOpenAR += remaining;

      if (currentStatus === "Overdue") {
        totalOverdue += remaining;
        overdueCount += 1;
      } else {
        currentCount += 1;
      }
    });

    const healthRatio = totalOpenAR > 0 ? ((totalOverdue / totalOpenAR) * 100).toFixed(1) : "0.0";

    return {
      totalPortfolio,
      totalOverdue,
      overdueCount,
      currentCount,
      totalCount: collections.length,
      healthRatio
    };
  }, [collections, openInvoices]);

  // Collection Method Distribution — how collected revenue breaks down by payment channel
  const methodDistribution = useMemo(() => {
    const totals: Record<string, { amount: number; count: number }> = {};
    let grandTotal = 0;

    collections.forEach((c) => {
      const key = c.payment_method || "unknown";
      const amt = Number(c.amount_received) || 0;
      if (!totals[key]) totals[key] = { amount: 0, count: 0 };
      totals[key].amount += amt;
      totals[key].count += 1;
      grandTotal += amt;
    });

    const safeTotal = grandTotal || 1;
    const palette: Record<string, { color: string; bg: string; border: string }> = {
      gcash: { color: "#007dfe", bg: "rgba(0, 125, 254, 0.1)", border: "rgba(0, 125, 254, 0.25)" },
      bank_transfer: { color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)", border: "rgba(139, 92, 246, 0.25)" },
      maya: { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.25)" },
      cash: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.25)" },
      check: { color: "#e5167e", bg: "rgba(229, 22, 126, 0.1)", border: "rgba(229, 22, 126, 0.25)" },
    };

    const defaultStyle = { color: "#64748b", bg: "rgba(100, 116, 139, 0.1)", border: "rgba(100, 116, 139, 0.25)" };

    return Object.entries(totals)
      .map(([method, data]) => {
        const style = palette[method] || defaultStyle;
        return {
          method,
          amount: data.amount,
          count: data.count,
          pct: Math.round((data.amount / safeTotal) * 100),
          ...style
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [collections]);

  // Linked vs. Direct Collection Activity Composition
  const activityComposition = useMemo(() => {
    let linkedAmt = 0, linkedCount = 0, directAmt = 0, directCount = 0;

    collections.forEach((c) => {
      const amt = Number(c.amount_received) || 0;
      if (c.invoice_id) {
        linkedAmt += amt;
        linkedCount += 1;
      } else {
        directAmt += amt;
        directCount += 1;
      }
    });

    const total = linkedAmt + directAmt || 1;
    return {
      linked: { amount: linkedAmt, count: linkedCount, pct: Math.round((linkedAmt / total) * 100) },
      direct: { amount: directAmt, count: directCount, pct: Math.round((directAmt / total) * 100) },
    };
  }, [collections]);

  // Filtering Logic
  const filteredCollections = useMemo(() => {
    return collections.filter((item) => {
      if (!searchTerm.trim()) return true;
      const searchLower = searchTerm.toLowerCase().trim();
      const clientName = item.ar_invoices?.client_name || "Direct Payment / General Client";
      const accountName = item.cash_mngmt?.account_name || "";
      const invNum = item.ar_invoices?.invoice_number || "";
      
      const matchClient = clientName.toLowerCase().includes(searchLower);
      const matchAccount = accountName.toLowerCase().includes(searchLower);
      const matchId = String(item.id || "").toLowerCase().includes(searchLower);
      const matchRef = (item.reference_number || "").toLowerCase().includes(searchLower);
      const matchInv = invNum.toLowerCase().includes(searchLower);

      return matchClient || matchAccount || matchId || matchRef || matchInv;
    });
  }, [collections, searchTerm]);

  // Table Column Definitions
  const columns: ColumnDef<CollectionRecord>[] = useMemo(
    () => [
      {
        header: "Collection ID & Linked Inv",
        accessor: (item) => {
          const invNum = item.ar_invoices?.invoice_number;
          return (
            <div className="space-y-0.5">
              <div className="font-bold text-[#e5167e] font-mono tracking-tight flex items-center gap-1.5">
                <Hash className="w-3 h-3 shrink-0 opacity-70" />
                <span>#{String(item.id).substring(0, 8)}</span>
              </div>
              {invNum ? (
                <div className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded border border-border/50">
                  <FileText className="w-2.5 h-2.5 text-[#e5167e]" />
                  <span>Inv: {invNum}</span>
                </div>
              ) : (
                <span className="text-[10px] text-foreground/40 italic font-medium">Direct Entry</span>
              )}
            </div>
          );
        },
      },
      {
        header: "Client Name",
        accessor: (item) => (
          <div className="space-y-0.5">
            <span className="font-bold text-foreground block truncate max-w-[180px]">
              {item.ar_invoices?.client_name || "Direct Payment / General Client"}
            </span>
            {item.ar_invoices?.external_waybill_id && (
              <span className="text-[10px] font-mono text-muted-foreground block">
                WB: {item.ar_invoices.external_waybill_id}
              </span>
            )}
          </div>
        ),
      },
      {
        header: "Receiving Cash Account",
        accessor: (item) => (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-semibold text-foreground/90 truncate max-w-[160px]">
              {item.cash_mngmt?.account_name || "Unassigned Account"}
            </span>
          </div>
        ),
      },
      {
        header: "Amount Received",
        accessor: (item) => (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs">
            <span>+{formatPeso(Number(item.amount_received) || 0)}</span>
          </div>
        ),
      },
      {
        header: "Payment Method",
        accessor: (item) => (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-card border border-border text-foreground uppercase shadow-2xs">
            <CreditCard className="w-3 h-3 text-[#e5167e]" />
            {formatPaymentMethod(item.payment_method)}
          </span>
        ),
      },
      {
        header: "Reference No.",
        accessor: (item) => (
          <span className="font-mono text-[11px] text-foreground/80 font-medium bg-muted/40 px-2 py-0.5 rounded border border-border/40">
            {item.reference_number || "—"}
          </span>
        ),
      },
      {
        header: "Collection Date",
        accessor: (item) => (
          <div className="flex items-center gap-1.5 text-foreground/80 font-medium text-xs">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>
              {item.created_at || item.collection_date
                ? new Date(item.created_at || item.collection_date!).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </span>
          </div>
        ),
      },
      {
        header: "Record Status",
        accessor: () => <StatusBadge status="Recorded" />,
      },
      {
        header: "Audit",
        className: "text-right pr-6",
        accessor: (item) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCollection(item);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#e5167e] bg-[#e5167e]/10 hover:bg-[#e5167e] hover:text-white rounded-lg transition-all duration-150 active:scale-95"
            aria-label="View collection details"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Audit</span>
          </button>
        ),
      },
    ],
    []
  );

  // CSV Export Report
  const handleExportCSV = () => {
    if (collections.length === 0) {
      toast.error("No collection records available to export.");
      return;
    }

    const headers = [
      "Collection ID", 
      "Client Name", 
      "Linked Invoice", 
      "Cash Account", 
      "Amount Received (PHP)", 
      "Payment Method", 
      "Reference No", 
      "Collection Date", 
      "Record Status"
    ];
    
    const rows = collections.map((col) => [
      `"${col.id}"`,
      `"${col.ar_invoices?.client_name || "Direct Payment / General Client"}"`,
      `"${col.ar_invoices?.invoice_number || "Unlinked"}"`,
      `"${col.cash_mngmt?.account_name || "Unassigned Account"}"`,
      col.amount_received || 0,
      `"${formatPaymentMethod(col.payment_method)}"`,
      `"${col.reference_number || "—"}"`,
      col.created_at || col.collection_date || "N/A",
      `"Recorded"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `collections_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen text-foreground transition-colors duration-200">
      
      {/* 1. PAGE HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card/95 to-background border border-border p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 rounded-full bg-[#e5167e]/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e5167e]/10 border border-[#e5167e]/20 text-[#e5167e] text-xs font-extrabold uppercase tracking-wider">
              <Banknote className="w-3.5 h-3.5" />
              Financial Management · Cash Realization
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight pt-1">
              Payment Collections <span className="text-[#e5167e]">& Audit</span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Track cash inflows, record settled AR invoices, monitor payment channel breakdown, and verify audit trails.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchData}
              title="Refresh Collections"
              className="p-2.5 text-foreground bg-card border border-border rounded-xl hover:bg-muted/60 hover:border-[#e5167e]/30 transition shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e5167e]" : "text-muted-foreground"}`} />
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted/60 hover:border-[#e5167e]/30 transition shadow-sm active:scale-95"
            >
              <Download className="w-4 h-4 text-muted-foreground" />
              Export CSV Report
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#e5167e] hover:bg-[#e5167e]/90 rounded-xl transition shadow-md shadow-[#e5167e]/25 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Log Payment Collection
            </button>
          </div>
        </div>
      </div>

      {/* 2. METRIC AREA */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 items-start">
        <SummaryCard
          title="Total Collected"
          value={formatPeso(metrics.totalPortfolio)}
          subtitle={`Across ${metrics.totalCount} recorded entry ${metrics.totalCount === 1 ? 'record' : 'records'}`}
          trend="Live Cash Flow"
          isPositive={true}
          icon={<Banknote className="w-5 h-5 text-[#e5167e]" />}
          className="border-[#e5167e]/30 bg-gradient-to-br from-card via-card to-[#e5167e]/5"
        />
        <SummaryCard
          title="Total Overdue Amount"
          value={formatPeso(metrics.totalOverdue)}
          subtitle={`${metrics.overdueCount} open ${metrics.overdueCount === 1 ? 'account' : 'accounts'} past due`}
          trend={metrics.overdueCount > 0 ? "Action Required" : "All Settled"}
          isPositive={metrics.overdueCount === 0}
          icon={<AlertCircle className="w-5 h-5 text-rose-500" />}
          className={metrics.overdueCount > 0 ? "border-rose-500/30 bg-rose-500/5" : ""}
        />
        <SummaryCard
          title="Current / On-Time"
          value={String(metrics.currentCount)}
          subtitle="Open AR accounts within credit terms"
          trend="In Credit Term"
          isPositive={true}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          className="border-emerald-500/20 hover:border-emerald-500/40"
        />
        <SummaryCard
          title="Portfolio Health Ratio"
          value={`${metrics.healthRatio}%`}
          subtitle="Overdue share of open exposure"
          trend="Risk Index"
          isPositive={metrics.totalOverdue === 0}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          className={metrics.totalOverdue > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}
        />
      </section>

      {/* 3. COLLECTION ANALYSIS PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Collection Method Distribution */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-[#e5167e]/40 transition-colors">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <PieChart className="w-4.5 h-4.5 text-[#e5167e]" />
                Collection Method Distribution
              </h3>
              <span className="text-[11px] font-extrabold text-[#e5167e] bg-[#e5167e]/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                {collections.length} Total Postings
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Proportional breakdown of collected revenue by payment channel
            </p>
          </div>

          {methodDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-8 text-center bg-muted/20 rounded-xl border border-dashed border-border">
              No collection records available to evaluate channel distribution.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Stacked Visual Bar */}
              <div className="h-3.5 w-full bg-muted rounded-full overflow-hidden flex shadow-inner">
                {methodDistribution.map((m) => (
                  <div
                    key={m.method}
                    style={{ width: `${Math.max(m.pct, 3)}%`, backgroundColor: m.color }}
                    className="h-full transition-all duration-500 relative group"
                    title={`${formatPaymentMethod(m.method)}: ${formatPeso(m.amount)} (${m.pct}%)`}
                  />
                ))}
              </div>

              {/* Grid Channel Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {methodDistribution.map((m) => (
                  <div
                    key={m.method}
                    className="p-3.5 rounded-xl border space-y-1.5 transition-colors"
                    style={{ backgroundColor: m.bg, borderColor: m.border }}
                  >
                    <div className="flex items-center justify-between font-bold" style={{ color: m.color }}>
                      <span className="inline-flex items-center gap-1.5 uppercase text-[11px]">
                        <CreditCard className="w-3.5 h-3.5" />
                        {formatPaymentMethod(m.method)}
                      </span>
                      <span className="text-xs font-black">{m.pct}%</span>
                    </div>
                    <div className="flex items-baseline justify-between pt-0.5">
                      <span className="font-extrabold text-foreground font-mono text-sm">{formatPeso(m.amount)}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground">{m.count} {m.count === 1 ? 'entry' : 'entries'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Primary Payment Channel: <strong className="text-foreground">{formatPaymentMethod(methodDistribution[0]?.method)}</strong></span>
            <span className="font-mono text-foreground/70">{methodDistribution[0]?.pct || 0}% of volume</span>
          </div>
        </div>

        {/* Collection Activity Composition */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col justify-between space-y-5 hover:border-[#e5167e]/40 transition-colors">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Wallet className="w-4.5 h-4.5 text-[#e5167e]" />
                Collection Activity Composition
              </h3>
              <span className="text-[11px] font-extrabold text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Inflow Settlement
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Ratio of collected revenue tied to AR invoices vs. direct/unlinked payments
            </p>
          </div>

          <div className="space-y-4">
            {/* Visual Ratio Bar */}
            <div className="h-3.5 w-full bg-muted rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${activityComposition.linked.pct}%` }}
                className="bg-blue-500 h-full transition-all duration-500"
                title={`Linked to AR Invoice: ${activityComposition.linked.pct}%`}
              />
              <div
                style={{ width: `${activityComposition.direct.pct}%` }}
                className="bg-slate-400 dark:bg-slate-600 h-full transition-all duration-500"
                title={`Direct / General: ${activityComposition.direct.pct}%`}
              />
            </div>

            {/* Structured Comparison Layout */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-blue-600 dark:text-blue-400 font-extrabold text-xs flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Linked to AR Invoices
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {activityComposition.linked.count} collection {activityComposition.linked.count === 1 ? 'record' : 'records'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-foreground font-mono text-base">
                    {formatPeso(activityComposition.linked.amount)}
                  </div>
                  <span className="text-[11px] font-bold text-blue-500 bg-blue-500/15 px-2 py-0.5 rounded">
                    {activityComposition.linked.pct}% of total
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-foreground/80 font-extrabold text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    Direct / General Inflows
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {activityComposition.direct.count} collection {activityComposition.direct.count === 1 ? 'record' : 'records'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-foreground font-mono text-base">
                    {formatPeso(activityComposition.direct.amount)}
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {activityComposition.direct.pct}% of total
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Collection Record Handling</span>
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> RPC-backed Entries
             </span>
          </div>
        </div>

      </div>

      {/* 4. COLLECTIONS AUDIT TABLE */}
      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">
                Collections Audit Directory
              </h3>
              <p className="text-xs text-muted-foreground">
                Historical log of cash receipts, payment channels, and associated AR records
              </p>
            </div>
            <div className="text-xs font-semibold text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border/50">
              Showing <strong className="text-foreground">{filteredCollections.length}</strong> of <strong className="text-foreground">{collections.length}</strong> entries
            </div>
          </div>

          <SearchFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Search ID, client, cash account, invoice, reference OR#..."
          />
        </div>

        <div className="overflow-x-auto">
          <DataTable
            columns={columns}
            data={filteredCollections}
            isLoading={loading}
            emptyMessage={
              searchTerm
                ? "No collection records matched your search query."
                : "No collection records logged in system."
            }
            onRowClick={(row) => setSelectedCollection(row)}
            getRowId={(row) => row.id}
          />
        </div>
      </section>

      {/* 5. LOG PAYMENT COLLECTION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Payment Collection"
        maxWidth="max-w-md"
      >
        <CollectionForm
          formData={formData}
          onChange={handleFormFieldChange}
          onInvoiceSelect={handleInvoiceSelect}
          onSubmit={handleRecordCollection}
          onCancel={() => setIsModalOpen(false)}
          cashAccounts={cashAccounts}
          openInvoices={openInvoices}
          submitting={submitting}
          formatPeso={formatPeso}
        />
      </Modal>

      {/* 6. COLLECTION AUDIT DETAILS MODAL */}
      <Modal
        isOpen={!!selectedCollection}
        onClose={() => setSelectedCollection(null)}
        title={
          selectedCollection
            ? `Collection Audit Record #${String(selectedCollection.id).substring(0, 8)}`
            : "Collection Details"
        }
        maxWidth="max-w-md"
      >
        {selectedCollection && (
          <CollectionDetails
            collection={selectedCollection}
            onClose={() => setSelectedCollection(null)}
            formatPeso={formatPeso}
            formatPaymentMethod={formatPaymentMethod}
          />
        )}
      </Modal>

    </div>
  );
}