"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { ColumnDef } from "../../fmscomponents/ui/DataTable";
import { StatusBadge } from "../../fmscomponents/ui/StatusBadge";
import { Modal } from "../../fmscomponents/ui/Modal";
import { InvoiceForm } from "../../fmscomponents/financial/ar/InvoiceForm";
import { InvoiceDetails } from "../../fmscomponents/financial/ar/InvoiceDetails";
import type { Invoice, CollectionHistoryRecord } from "../../fmscomponents/financial/ar/types";

import { AROverviewHero } from "../../fmscomponents/financial/ar/AROverviewHero";
import { ARMetrics } from "../../fmscomponents/financial/ar/ARMetrics";
import { ARRiskAnalysis } from "../../fmscomponents/financial/ar/ARRiskAnalysis";
import { ReceivablesDirectory } from "../../fmscomponents/financial/ar/ReceivablesDirectory";

import { Copy, Eye, Pencil } from "lucide-react";

const formatPeso = (val: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

export default function AccountsReceivablePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [collections, setCollections] = useState<CollectionHistoryRecord[]>([]);
  const [, setCashAccountsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const [isRealizationExpanded, setIsRealizationExpanded] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const [clientName, setClientName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [externalClientId, setExternalClientId] = useState("");
  const [externalWaybillId, setExternalWaybillId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculateInvoiceStatus = (
    total: number,
    paid: number,
    dueDateStr: string
  ): "Unpaid" | "Partially Paid" | "Paid" | "Overdue" => {
    const validPaid = Math.max(0, Math.min(paid, total));
    if (validPaid >= total && total > 0) return "Paid";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);

    if (due < today) return "Overdue";
    if (validPaid > 0) return "Partially Paid";
    return "Unpaid";
  };

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [arRes, collRes, cashRes] = await Promise.all([
      supabase.from("ar_invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("collections").select("*"),
      supabase.from("cash_mngmt").select("id, account_name"),
    ]);

    if (arRes.error) {
      toast.error("Failed to fetch invoices", { description: arRes.error.message });
      console.error("Error fetching AR invoices:", arRes.error.message);
    } else if (arRes.data) {
      const sanitized = (arRes.data as Invoice[]).map((inv) => {
        const total = Number(inv.total_amount || 0);
        const paid = Math.min(Number(inv.amount_paid || 0), total);
        return {
          ...inv,
          total_amount: total,
          amount_paid: paid,
          status: calculateInvoiceStatus(total, paid, inv.due_date),
        };
      });
      setInvoices(sanitized);
    }

    const accMap: Record<string, string> = {};
    if (cashRes.data) {
      cashRes.data.forEach((acc: any) => {
        accMap[String(acc.id)] = acc.account_name;
      });
      setCashAccountsMap(accMap);
    }

    if (collRes.data) {
      const mappedCollections: CollectionHistoryRecord[] = collRes.data.map((col: any) => ({
        id: String(col.id),
        invoice_id: col.invoice_id ? String(col.invoice_id) : null,
        amount_received: Number(col.amount_received || 0),
        payment_method: col.payment_method || col.method || "N/A",
        reference_number: col.reference_number || col.reference_no || "—",
        created_at: col.created_at || col.collection_date || "",
        collection_date: col.collection_date || col.created_at || "",
        cash_account_id: col.cash_account_id ? String(col.cash_account_id) : null,
        cash_account_name: col.cash_account_id
          ? accMap[String(col.cash_account_id)] || "Cash Account"
          : "Unassigned",
      }));
      setCollections(mappedCollections);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setClientName("");
    setTotalAmount("");
    setDueDate("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setExternalClientId("");
    setExternalWaybillId("");
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(totalAmount);

    if (!clientName || isNaN(parsedAmount) || parsedAmount <= 0 || !dueDate) {
      toast.error("Please fill in all required fields with valid values.");
      return;
    }

    setIsSubmitting(true);
    const invNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const initialStatus = calculateInvoiceStatus(parsedAmount, 0, dueDate);

    const newInvoice = {
      invoice_number: invNum,
      client_name: clientName,
      total_amount: parsedAmount,
      amount_paid: 0,
      due_date: dueDate,
      invoice_date: invoiceDate || new Date().toISOString().split("T")[0],
      status: initialStatus,
      external_client_id: externalClientId.trim() || null,
      external_waybill_id: externalWaybillId.trim() || null,
    };

    const { error } = await supabase.from("ar_invoices").insert([newInvoice]);

    if (error) {
      toast.error("Failed to create invoice", { description: error.message });
    } else {
      await fetchData();
      resetForm();
      setIsCreateModalOpen(false);
      toast.success(`Invoice ${invNum} created successfully!`, {
        description: `Billed ${formatPeso(parsedAmount)} to ${clientName}.`,
      });
    }
    setIsSubmitting(false);
  };

  const openEditModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setClientName(inv.client_name);
    setTotalAmount(String(inv.total_amount));
    setDueDate(inv.due_date);
    setInvoiceDate(inv.invoice_date || new Date().toISOString().split("T")[0]);
    setExternalClientId(inv.external_client_id || "");
    setExternalWaybillId(inv.external_waybill_id || "");
    setIsEditModalOpen(true);
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice?.id) return;

    const parsedAmount = parseFloat(totalAmount);
    if (!clientName || isNaN(parsedAmount) || parsedAmount <= 0 || !dueDate) {
      toast.error("Please provide valid invoice details.");
      return;
    }

    if (parsedAmount < editingInvoice.amount_paid) {
      toast.error("Total amount cannot be less than the amount already paid.");
      return;
    }

    setIsSubmitting(true);
    const updatedStatus = calculateInvoiceStatus(parsedAmount, editingInvoice.amount_paid, dueDate);

    const updatedData = {
      client_name: clientName,
      total_amount: parsedAmount,
      due_date: dueDate,
      invoice_date: invoiceDate,
      status: updatedStatus,
      external_client_id: externalClientId.trim() || null,
      external_waybill_id: externalWaybillId.trim() || null,
    };

    const { error } = await supabase.from("ar_invoices").update(updatedData).eq("id", editingInvoice.id);

    if (error) {
      toast.error("Failed to update invoice", { description: error.message });
    } else {
      await fetchData();
      setIsEditModalOpen(false);
      setEditingInvoice(null);
      resetForm();
      toast.success(`Invoice ${editingInvoice.invoice_number} updated.`);
    }
    setIsSubmitting(false);
  };

  const handleCopyText = useCallback((e: React.MouseEvent, text: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  }, []);

  const totalReceivables = useMemo(() => invoices.reduce((acc, inv) => acc + inv.total_amount, 0), [invoices]);
  const totalPaid = useMemo(() => invoices.reduce((acc, inv) => acc + inv.amount_paid, 0), [invoices]);
  const outstandingBalance = useMemo(() => Math.max(0, totalReceivables - totalPaid), [totalReceivables, totalPaid]);
  
  const pendingInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === "Unpaid" || inv.status === "Partially Paid"),
    [invoices]
  );
  const overdueInvoices = useMemo(() => invoices.filter((inv) => inv.status === "Overdue"), [invoices]);
  const overdueTotal = useMemo(
    () => overdueInvoices.reduce((acc, inv) => acc + (inv.total_amount - inv.amount_paid), 0),
    [overdueInvoices]
  );
  const paidInvoices = useMemo(() => invoices.filter((inv) => inv.status === "Paid"), [invoices]);
  const partiallyPaidInvoices = useMemo(() => invoices.filter((inv) => inv.status === "Partially Paid"), [invoices]);
  const unpaidInvoices = useMemo(() => invoices.filter((inv) => inv.status === "Unpaid"), [invoices]);

  const collectionRate = useMemo(
    () => (totalReceivables > 0 ? Math.round((totalPaid / totalReceivables) * 100) : 0),
    [totalReceivables, totalPaid]
  );

  const agingBreakdown = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let current = 0,
      d1_30 = 0,
      d31_60 = 0,
      d61_90 = 0,
      d90Plus = 0;

    invoices.forEach((inv) => {
      const remaining = inv.total_amount - inv.amount_paid;
      if (remaining <= 0) return;

      const due = new Date(inv.due_date);
      due.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - due.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) current += remaining;
      else if (diffDays <= 30) d1_30 += remaining;
      else if (diffDays <= 60) d31_60 += remaining;
      else if (diffDays <= 90) d61_90 += remaining;
      else d90Plus += remaining;
    });

    return { current, d1_30, d31_60, d61_90, d90Plus };
  }, [invoices]);

  const portfolioStatusDistribution = useMemo(() => {
    const grandTotal = totalReceivables || 1;
    const paidVal = totalPaid;
    const partiallyPaidVal = partiallyPaidInvoices.reduce(
      (acc, inv) => acc + (inv.total_amount - inv.amount_paid),
      0
    );
    const unpaidVal = unpaidInvoices.reduce((acc, inv) => acc + inv.total_amount, 0);
    const overdueVal = overdueTotal;

    return {
      paid: { count: paidInvoices.length, amount: paidVal, pct: Math.round((paidVal / grandTotal) * 100) },
      partiallyPaid: {
        count: partiallyPaidInvoices.length,
        amount: partiallyPaidVal,
        pct: Math.round((partiallyPaidVal / grandTotal) * 100),
      },
      unpaid: { count: unpaidInvoices.length, amount: unpaidVal, pct: Math.round((unpaidVal / grandTotal) * 100) },
      overdue: { count: overdueInvoices.length, amount: overdueVal, pct: Math.round((overdueVal / grandTotal) * 100) },
    };
  }, [
    totalReceivables,
    totalPaid,
    paidInvoices,
    partiallyPaidInvoices,
    unpaidInvoices,
    overdueInvoices,
    overdueTotal,
  ]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        (inv.client_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (inv.invoice_number?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (inv.external_waybill_id?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (inv.external_client_id?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "All" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  const selectedInvoiceCollections = useMemo(() => {
    if (!selectedInvoice?.id) return [];
    return collections.filter((c) => String(c.invoice_id) === String(selectedInvoice.id));
  }, [selectedInvoice, collections]);

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) return;
    const headers = [
      "Invoice Number",
      "Client Name",
      "Waybill ID",
      "Client Ref ID",
      "Total Amount (PHP)",
      "Amount Paid (PHP)",
      "Remaining Balance (PHP)",
      "Payment Progress (%)",
      "Invoice Date",
      "Due Date",
      "Status",
    ];
    const rows = filteredInvoices.map((inv) => {
      const remaining = inv.total_amount - inv.amount_paid;
      const progress = inv.total_amount > 0 ? ((inv.amount_paid / inv.total_amount) * 100).toFixed(1) : "0.0";
      return [
        `"${inv.invoice_number}"`,
        `"${(inv.client_name || "").replace(/"/g, '""')}"`,
        `"${inv.external_waybill_id || "N/A"}"`,
        `"${inv.external_client_id || "N/A"}"`,
        inv.total_amount,
        inv.amount_paid,
        remaining,
        `"${progress}%"`,
        inv.invoice_date || "N/A",
        inv.due_date,
        inv.status,
      ];
    });
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ar_invoices_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        header: "Invoice & Waybill Ref",
        accessor: (inv) => (
          <div className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-1.5 group/inv">
              <span className="font-mono font-bold text-foreground text-xs hover:text-[#e5167e] transition-colors">
                {inv.invoice_number}
              </span>
              <button
                onClick={(e) => handleCopyText(e, inv.invoice_number, "Invoice Number")}
                className="opacity-0 group-hover/inv:opacity-100 text-foreground/40 hover:text-foreground p-0.5 transition-opacity"
                title="Copy Invoice Number"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            {inv.external_waybill_id && (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-foreground/5 border border-border/60 text-[10px] font-mono text-foreground/70 group/wb">
                <span className="text-foreground/40 uppercase text-[9px] font-sans font-bold">WB:</span>
                <span>{inv.external_waybill_id}</span>
                <button
                  onClick={(e) => handleCopyText(e, inv.external_waybill_id!, "Waybill ID")}
                  className="opacity-0 group-hover/wb:opacity-100 text-foreground/40 hover:text-foreground p-0.5 transition-opacity"
                  title="Copy Waybill ID"
                >
                  <Copy className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        ),
      },
      {
        header: "Client Name",
        accessor: (inv) => <span className="font-bold text-foreground">{inv.client_name}</span>,
      },
      {
        header: "Total Billed",
        accessor: (inv) => (
          <span className="font-extrabold text-foreground tracking-tight font-mono">
            {formatPeso(inv.total_amount)}
          </span>
        ),
      },
      {
        header: "Paid / Outstanding",
        accessor: (inv) => {
          const remainingBalance = inv.total_amount - inv.amount_paid;
          return (
            <div className="font-mono">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                {formatPeso(inv.amount_paid)} <span className="text-[10px] text-foreground/40 font-normal">paid</span>
              </div>
              <div className="text-foreground/80 text-[11px]">
                {formatPeso(remainingBalance)} <span className="text-[10px] text-foreground/40 font-normal">due</span>
              </div>
            </div>
          );
        },
      },
      {
        header: "Payment Progress",
        className: "min-w-[140px]",
        accessor: (inv) => {
          const progressPct =
            inv.total_amount > 0
              ? Math.min(100, Math.max(0, Math.round((inv.amount_paid / inv.total_amount) * 100)))
              : 0;
          const isPaid = inv.status === "Paid";
          const isPartiallyPaid = inv.status === "Partially Paid";

          return (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-foreground/60">{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isPaid ? "bg-emerald-500" : isPartiallyPaid ? "bg-amber-500" : "bg-[#e5167e]"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        header: "Due Date",
        accessor: (inv) => (
          <span className="text-foreground/60 whitespace-nowrap">
            {new Date(inv.due_date).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        ),
      },
      {
        header: "Status",
        accessor: (inv) => <StatusBadge status={inv.status} />,
      },
      {
        header: "Actions",
        className: "text-right",
        accessor: (inv) => (
          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedInvoice(inv);
              }}
              className="p-1.5 text-foreground/50 hover:text-[#e5167e] hover:bg-[#e5167e]/10 rounded-lg transition-all duration-150"
              title="View Statement & History"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(inv);
              }}
              className="p-1.5 text-foreground/50 hover:text-[#e5167e] hover:bg-[#e5167e]/10 rounded-lg transition-all duration-150"
              title="Edit Invoice"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [handleCopyText]
  );

  return (
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen text-foreground transition-colors duration-200">
      {/* 1. AR Overview Hero Section */}
      <AROverviewHero
        outstandingBalance={outstandingBalance}
        totalReceivables={totalReceivables}
        totalPaid={totalPaid}
        overdueTotal={overdueTotal}
        unpaidAmount={portfolioStatusDistribution.unpaid.amount}
        collectionRate={collectionRate}
        pendingCount={pendingInvoices.length}
        unpaidCount={unpaidInvoices.length}
        partiallyPaidCount={partiallyPaidInvoices.length}
        overdueCount={overdueInvoices.length}
        totalCount={invoices.length}
        loading={loading}
        onRefresh={fetchData}
        onExportCSV={handleExportCSV}
        onCreateInvoice={() => {
          resetForm();
          setIsCreateModalOpen(true);
        }}
      />

      {/* 2. AR Supporting Metrics Container */}
      <ARMetrics
        totalReceivables={totalReceivables}
        totalPaid={totalPaid}
        collectionRate={collectionRate}
        totalInvoicesCount={invoices.length}
        paidInvoicesCount={paidInvoices.length}
        partiallyPaidInvoicesCount={partiallyPaidInvoices.length}
        isRealizationExpanded={isRealizationExpanded}
        onToggleRealization={() => setIsRealizationExpanded((prev) => !prev)}
      />

      {/* 3. AR Risk & Portfolio Exposure Analysis */}
      <ARRiskAnalysis
        agingBreakdown={agingBreakdown}
        outstandingBalance={outstandingBalance}
        portfolioStatusDistribution={portfolioStatusDistribution}
        totalInvoicesCount={invoices.length}
        overdueCount={overdueInvoices.length}
      />

      {/* 4. Receivables Master Directory */}
      <ReceivablesDirectory
        invoices={filteredInvoices}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        columns={columns}
        onRowClick={(row) => setSelectedInvoice(row)}
        onClearFilters={() => {
          setSearchTerm("");
          setStatusFilter("All");
        }}
      />

      {/* Modals */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Customer Invoice"
      >
        <InvoiceForm
          mode="create"
          clientName={clientName}
          setClientName={setClientName}
          totalAmount={totalAmount}
          setTotalAmount={setTotalAmount}
          invoiceDate={invoiceDate}
          setInvoiceDate={setInvoiceDate}
          dueDate={dueDate}
          setDueDate={setDueDate}
          externalWaybillId={externalWaybillId}
          setExternalWaybillId={setExternalWaybillId}
          externalClientId={externalClientId}
          setExternalClientId={setExternalClientId}
          onSubmit={handleCreateInvoice}
          onCancel={() => setIsCreateModalOpen(false)}
          isSubmitting={isSubmitting}
        />
      </Modal>

      <Modal
        isOpen={isEditModalOpen && !!editingInvoice}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Invoice"
      >
        <InvoiceForm
          mode="edit"
          invoiceNumber={editingInvoice?.invoice_number}
          clientName={clientName}
          setClientName={setClientName}
          totalAmount={totalAmount}
          setTotalAmount={setTotalAmount}
          invoiceDate={invoiceDate}
          setInvoiceDate={setInvoiceDate}
          dueDate={dueDate}
          setDueDate={setDueDate}
          externalWaybillId={externalWaybillId}
          setExternalWaybillId={setExternalWaybillId}
          externalClientId={externalClientId}
          setExternalClientId={setExternalClientId}
          onSubmit={handleUpdateInvoice}
          onCancel={() => setIsEditModalOpen(false)}
          isSubmitting={isSubmitting}
          minAmount={editingInvoice?.amount_paid || 0.01}
        />
      </Modal>

      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Statement Ledger"
        maxWidth="max-w-xl"
      >
        {selectedInvoice && (
          <InvoiceDetails
            invoice={selectedInvoice}
            collections={selectedInvoiceCollections}
            onPrint={() => window.print()}
            onClose={() => setSelectedInvoice(null)}
          />
        )}
      </Modal>
    </div>
  );
}