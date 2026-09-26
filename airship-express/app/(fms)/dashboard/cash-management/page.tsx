"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Download,
  ArrowRightLeft,
  SlidersHorizontal,
  Building2,
  Vault,
  Coins,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Loader2,
  CreditCard,
  Layers,
  Activity,
  ArrowUp,
  ArrowDown,
  Scale,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
  PieChart,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";

import { SummaryCard } from "../../fmscomponents/dashboard/SummaryCard";
import { DataTable, ColumnDef } from "../../fmscomponents/ui/DataTable";
import { Modal } from "../../fmscomponents/ui/Modal";
import { SearchFilterBar } from "../../fmscomponents/ui/SearchFilterBar";
import { TransferForm } from "../../fmscomponents/financial/cash/TransferForm";
import { AdjustmentForm } from "../../fmscomponents/financial/cash/AdjustmentForm";
import {
  CashAccount,
  CashTransaction,
  TransferFormData,
  AdjustmentFormData,
  TRANSFER_FORM_ID,
  ADJUSTMENT_FORM_ID,
  AccountType,
} from "../../fmscomponents/financial/cash/types";

const INITIAL_TRANSFER_FORM: TransferFormData = {
  fromAccountId: "",
  toAccountId: "",
  amount: "",
};

const INITIAL_ADJUSTMENT_FORM: AdjustmentFormData = {
  accountId: "",
  adjustmentDirection: "inflow",
  amount: "",
  reference: "",
};

export default function CashManagementPage() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);

  // Form States
  const [transferForm, setTransferForm] = useState<TransferFormData>(INITIAL_TRANSFER_FORM);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormData>(INITIAL_ADJUSTMENT_FORM);

  // AR/AP Projections
  const [inflowForecast, setInflowForecast] = useState<number>(0);
  const [outflowObligation, setOutflowObligation] = useState<number>(0);

  // Search & Filters
  const [accountSearch, setAccountSearch] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const formatPeso = (val: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  // Fetch Cash Accounts
  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase
        .from("cash_mngmt")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAccounts((data as CashAccount[]) || []);
    } catch (err: any) {
      console.error("Error fetching accounts:", err);
      toast.error("Failed to load cash accounts", { description: err?.message });
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  // Fetch Cash Transactions & Forecasts
  const fetchTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from("cash_transactions")
        .select(`
          *,
          cash_mngmt (
            account_name,
            account_number_ending
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions((data as CashTransaction[]) || []);

      // AR Source: ar_invoices
      const { data: arData } = await supabase
        .from("ar_invoices")
        .select("*");
      if (arData) {
        const pendingAR = arData
          .filter((item: any) => item.status !== "paid" && item.status !== "cancelled")
          .reduce((sum: number, item: any) => sum + Number(item.amount_due || item.amount || 0), 0);
        setInflowForecast(pendingAR);
      }

      // AP Source: accounts_payable
      const { data: apData } = await supabase
        .from("accounts_payable")
        .select("*");
      if (apData) {
        const pendingAP = apData
          .filter((item: any) => item.status !== "paid" && item.status !== "cancelled")
          .reduce((sum: number, item: any) => sum + Number(item.amount_due || item.amount || 0), 0);
        setOutflowObligation(pendingAP);
      }
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
      toast.error("Failed to load transaction history", { description: err?.message });
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, [fetchAccounts, fetchTransactions]);

  // Set default account selections when accounts load
  useEffect(() => {
    if (accounts.length > 0) {
      if (!transferForm.fromAccountId) {
        setTransferForm((prev) => ({
          ...prev,
          fromAccountId: accounts[0]?.id || "",
          toAccountId: accounts[1]?.id || accounts[0]?.id || "",
        }));
      }
      if (!adjustmentForm.accountId) {
        setAdjustmentForm((prev) => ({
          ...prev,
          accountId: accounts[0]?.id || "",
        }));
      }
    }
  }, [accounts, transferForm.fromAccountId, adjustmentForm.accountId]);

  // Financial Calculations
  const totalCashPosition = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + (Number(curr.current_balance) || 0), 0);
  }, [accounts]);

  const totalInflows = useMemo(() => {
    return transactions
      .filter((t) => t.transaction_type === "inflow")
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [transactions]);

  const totalOutflows = useMemo(() => {
    return transactions
      .filter((t) => t.transaction_type === "outflow")
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [transactions]);

  const netCashMovement = useMemo(() => totalInflows - totalOutflows, [totalInflows, totalOutflows]);

  const netLiquidityOutlook = useMemo(() => {
    return totalCashPosition + inflowForecast - outflowObligation;
  }, [totalCashPosition, inflowForecast, outflowObligation]);

  // Directory Search Filtering
  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return accounts;
    const term = accountSearch.toLowerCase();
    return accounts.filter(
      (acc) =>
        acc.account_name?.toLowerCase().includes(term) ||
        acc.account_type?.toLowerCase().includes(term) ||
        acc.account_number_ending?.includes(term)
    );
  }, [accounts, accountSearch]);

  // Movement Log Search & Filtering
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesType = typeFilter === "all" || tx.transaction_type === typeFilter;
      const term = transactionSearch.toLowerCase();
      const accName = tx.cash_mngmt?.account_name?.toLowerCase() || "";
      const sourceMod = tx.source_module?.toLowerCase() || "";
      const refId = tx.reference_id?.toLowerCase() || "";
      const matchesSearch =
        !term || accName.includes(term) || sourceMod.includes(term) || refId.includes(term);
      return matchesType && matchesSearch;
    });
  }, [transactions, transactionSearch, typeFilter]);

  // Form Handlers
  const handleTransferChange = (field: keyof TransferFormData, value: string) => {
    setTransferForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAdjustmentChange = (field: keyof AdjustmentFormData, value: string) => {
    setAdjustmentForm((prev) => ({ ...prev, [field]: value }));
  };

  // RPC Execution for Transfers
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(transferForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid transfer amount.");
      return;
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      toast.error("Source and destination accounts must be different.");
      return;
    }

    const sourceAccount = accounts.find((a) => a.id === transferForm.fromAccountId);
    if (sourceAccount && (Number(sourceAccount.current_balance) || 0) < amountNum) {
      toast.error("Insufficient funds in source account.");
      return;
    }

    setActionLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc("transfer_cash_funds", {
        p_from_account_id: transferForm.fromAccountId,
        p_to_account_id: transferForm.toAccountId,
        p_amount: amountNum,
      });

      if (rpcError) throw rpcError;

      toast.success("Inter-account transfer completed!", {
        description: `Transferred ${formatPeso(amountNum)} across accounts.`,
      });

      setIsTransferOpen(false);
      setTransferForm(INITIAL_TRANSFER_FORM);
      fetchAccounts();
      fetchTransactions();
    } catch (err: any) {
      console.error("Transfer Error:", err);
      toast.error("Transfer failed", { description: err?.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Adjustment Handler
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(adjustmentForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid adjustment amount.");
      return;
    }

    setActionLoading(true);
    try {
      const targetAcc = accounts.find((a) => a.id === adjustmentForm.accountId);
      const isInflow = adjustmentForm.adjustmentDirection === "inflow";

      const { error: txError } = await supabase.from("cash_transactions").insert({
        cash_account_id: adjustmentForm.accountId,
        transaction_type: isInflow ? "inflow" : "outflow",
        amount: amountNum,
        source_module: "manual_adjustment",
        reference_id: adjustmentForm.reference || `ADJ-${Date.now().toString().slice(-6)}`,
        transaction_date: new Date().toISOString(),
      });

      if (txError) throw txError;

      if (targetAcc) {
        const current = Number(targetAcc.current_balance) || 0;
        const updated = isInflow ? current + amountNum : current - amountNum;
        await supabase
          .from("cash_mngmt")
          .update({ current_balance: updated })
          .eq("id", targetAcc.id);
      }

      toast.success("Cash adjustment applied!", {
        description: `Recorded ${adjustmentForm.adjustmentDirection.toUpperCase()} of ${formatPeso(
          amountNum
        )}.`,
      });

      setIsAdjustmentOpen(false);
      setAdjustmentForm(INITIAL_ADJUSTMENT_FORM);
      fetchAccounts();
      fetchTransactions();
    } catch (err: any) {
      console.error("Adjustment Error:", err);
      toast.error("Adjustment failed", { description: err?.message });
    } finally {
      setActionLoading(false);
    }
  };

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.error("No transactions available to export.");
      return;
    }

    const headers = [
      "Transaction Date",
      "Account Name",
      "Ending #",
      "Type",
      "Source Module",
      "Reference ID",
      "Amount (PHP)",
    ];
    const rows = filteredTransactions.map((tx) => [
      new Date(tx.transaction_date || tx.created_at).toLocaleDateString("en-PH"),
      `"${tx.cash_mngmt?.account_name || "N/A"}"`,
      tx.cash_mngmt?.account_number_ending || "N/A",
      tx.transaction_type,
      tx.source_module || "N/A",
      tx.reference_id || "N/A",
      tx.amount,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cash_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Transaction log exported successfully!");
  };

  const getAccountIcon = (type: AccountType | null) => {
    switch (type) {
      case "bank":
        return <Building2 className="w-5 h-5 text-blue-500" />;
      case "vault":
        return <Vault className="w-5 h-5 text-amber-500" />;
      case "petty_cash":
        return <Coins className="w-5 h-5 text-[#e5167e]" />;
      default:
        return <CreditCard className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const columns: ColumnDef<CashTransaction>[] = [
    {
      header: "Date & Reference",
      accessor: (row) => (
        <div className="space-y-0.5">
          <div className="font-mono font-bold text-foreground text-xs tracking-tight">
            {row.reference_id || `TX-${row.id.slice(0, 6)}`}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {new Date(row.transaction_date || row.created_at).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>
      ),
    },
    {
      header: "Cash Account",
      accessor: (row) => (
        <div className="space-y-0.5">
          <div className="font-bold text-foreground text-xs">
            {row.cash_mngmt?.account_name || "General Cash"}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {row.cash_mngmt?.account_number_ending
              ? `•••• ${row.cash_mngmt.account_number_ending}`
              : "Operational Account"}
          </div>
        </div>
      ),
    },
    {
      header: "Type",
      accessor: (row) => {
        const type = row.transaction_type;
        const isInflow = type === "inflow";
        const isOutflow = type === "outflow";
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold capitalize border ${
              isInflow
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : isOutflow
                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            }`}
          >
            {isInflow ? (
              <ArrowDownRight className="w-3.5 h-3.5" />
            ) : isOutflow ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <SlidersHorizontal className="w-3.5 h-3.5" />
            )}
            {type}
          </span>
        );
      },
    },
    {
      header: "Source Module",
      accessor: (row) => (
        <span className="uppercase text-[10px] px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground font-bold tracking-wider">
          {(row.source_module || "manual").replace(/_/g, " ")}
        </span>
      ),
    },
    {
      header: "Amount",
      className: "text-right",
      accessor: (row) => {
        const isOutflow = row.transaction_type === "outflow";
        return (
          <div
            className={`font-mono font-black text-sm text-right ${
              isOutflow ? "text-rose-500" : "text-emerald-500"
            }`}
          >
            {isOutflow ? "-" : "+"}
            {formatPeso(Number(row.amount) || 0)}
          </div>
        );
      },
    },
  ];

  const totalMovementVolume = totalInflows + totalOutflows;
  const inflowRatio = totalMovementVolume > 0 ? Math.round((totalInflows / totalMovementVolume) * 100) : 50;
  const outflowRatio = totalMovementVolume > 0 ? 100 - inflowRatio : 50;

  return (
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen text-foreground transition-colors duration-200">
      {/* 1. Refined Cash Management Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card/95 to-background border border-border p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#e5167e]/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[#e5167e] text-xs font-extrabold uppercase tracking-widest">
              <Wallet className="w-4 h-4" />
              Treasury & Liquidity Operations
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mt-1">
              Cash Management <span className="text-[#e5167e]">Position</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
              Real-time liquidity position monitoring, cash movement audit, inter-account transfers, and AR/AP projected cash obligations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                fetchAccounts();
                fetchTransactions();
              }}
              title="Refresh Cash Data"
              className="p-2.5 text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm active:scale-95"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  loadingAccounts || loadingTransactions ? "animate-spin text-[#e5167e]" : "text-muted-foreground"
                }`}
              />
            </button>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm"
            >
              <Download className="w-4 h-4 text-muted-foreground" />
              Export Log
            </button>

            {/* Secondary Action */}
            <button
              onClick={() => setIsTransferOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 hover:border-[#e5167e]/40 transition shadow-sm"
            >
              <ArrowRightLeft className="w-4 h-4 text-[#e5167e]" />
              Transfer Funds
            </button>

            {/* Primary Operational Action */}
            <button
              onClick={() => setIsAdjustmentOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#e5167e] rounded-xl hover:bg-[#e5167e]/90 transition shadow-md shadow-[#e5167e]/20 active:scale-95"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Cash Adjustment
            </button>
          </div>
        </div>
      </div>

      {/* 2 & 3. Primary Liquidity Focal Area & Liquidity Outlook */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Cash Position Control Panel */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-[#e5167e]/40 transition-colors">
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#e5167e]/5 rounded-bl-full pointer-events-none" />

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#e5167e] bg-[#e5167e]/10 px-3 py-1 rounded-full">
                Liquidity Focal Area
              </span>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Cash Position
              </h2>
              <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground break-words">
                {formatPeso(totalCashPosition)}
              </div>
            </div>

            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Consolidated real-time liquid fund balance held across active bank accounts, operational vaults, and petty cash reserves.
            </p>

            {/* Inflow vs Outflow Visual Movement Ratio */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-500 flex items-center gap-1 font-bold">
                  <ArrowDownCircle className="w-4 h-4" /> Total Inflows: {formatPeso(totalInflows)}
                </span>
                <span className="text-rose-500 flex items-center gap-1 font-bold">
                  <ArrowUpCircle className="w-4 h-4" /> Total Outflows: {formatPeso(totalOutflows)}
                </span>
              </div>

              <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex p-0.5 border border-border/40">
                <div
                  style={{ width: `${inflowRatio}%` }}
                  className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
                  title={`Inflows: ${inflowRatio}%`}
                />
                <div
                  style={{ width: `${outflowRatio}%` }}
                  className="bg-rose-500 h-full rounded-r-full transition-all duration-500"
                  title={`Outflows: ${outflowRatio}%`}
                />
              </div>

              <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                <span>Inflow Ratio: {inflowRatio}%</span>
                <span>Outflow Ratio: {outflowRatio}%</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between text-xs gap-3">
            <span className="text-muted-foreground">
              Based on active cash account records (<code className="font-mono text-foreground">cash_mngmt</code>)
            </span>
            <span className="font-semibold text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Live cash account data
            </span>
          </div>
        </div>

        {/* Liquidity Outlook Panel */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between hover:border-[#e5167e]/40 transition-colors">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Liquidity Outlook
              </h3>
              <Scale className="w-5 h-5 text-[#e5167e]" />
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">
                  Net Projected Cash Position
                </div>
                <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  {formatPeso(netLiquidityOutlook)}
                </div>
                <div className="text-[11px] text-muted-foreground pt-0.5">
                  Calculated from current cash position plus pending AR and AP records
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border/50 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">AR Forecasted Inflows</span>
                  <span className="font-mono font-bold text-emerald-500">+{formatPeso(inflowForecast)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-muted-foreground font-medium">AP Pending Obligations</span>
                  <span className="font-mono font-bold text-rose-500">-{formatPeso(outflowObligation)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 text-xs">
            {netLiquidityOutlook >= totalCashPosition ? (
              <p className="text-emerald-500 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Net projected liquidity remains positive based on open postings.
              </p>
            ) : (
              <p className="text-amber-500 font-semibold flex items-center gap-1.5">
                <Activity className="w-4 h-4 shrink-0" /> Pending AP obligations exceed projected AR inflows.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 4. Supporting KPI Area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Inflows"
          value={formatPeso(totalInflows)}
          subtitle="Collected Cash & Receipts"
          trend="Inflow Movements"
          isPositive={true}
          icon={<ArrowDownRight className="w-5 h-5 text-emerald-500" />}
        />
        <SummaryCard
          title="Total Outflows"
          value={formatPeso(totalOutflows)}
          subtitle="Disbursements & Debits"
          trend="Outflow Movements"
          isPositive={false}
          icon={<ArrowUpRight className="w-5 h-5 text-rose-500" />}
        />
        <SummaryCard
          title="Net Movement"
          value={formatPeso(netCashMovement)}
          subtitle="Inflow vs Outflow Net"
          trend={netCashMovement >= 0 ? "Net Positive" : "Net Negative"}
          isPositive={netCashMovement >= 0}
          icon={
            netCashMovement >= 0 ? (
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-rose-500" />
            )
          }
        />
        <SummaryCard
          title="Active Accounts"
          value={accounts.length.toString()}
          subtitle="Monitored Treasuries"
          icon={<Layers className="w-5 h-5 text-[#e5167e]" />}
        />
      </div>

      {/* 5. Cash & Bank Accounts Directory */}
      <section className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Cash & Bank Accounts Directory</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Operational directory of liquid assets, balances, and funding distribution
            </p>
          </div>

          <SearchFilterBar
            searchTerm={accountSearch}
            onSearchChange={setAccountSearch}
            placeholder="Search accounts or account numbers..."
            className="md:max-w-xs"
          />
        </div>

        {loadingAccounts ? (
          <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#e5167e]" /> Loading cash accounts directory...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground italic bg-muted/20 rounded-xl border border-border/50">
            No cash or bank accounts found matching your query.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((acc) => {
              const balance = Number(acc.current_balance) || 0;
              // Faithful percentage calculation without artificial minimum scale distortions
              const sharePercentage =
                totalCashPosition > 0 ? Math.round((balance / totalCashPosition) * 100) : 0;

              return (
                <div
                  key={acc.id}
                  className="p-5 rounded-xl bg-background border border-border/80 hover:border-[#e5167e]/40 transition-all duration-200 shadow-sm flex flex-col justify-between space-y-4 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-muted/60 group-hover:bg-[#e5167e]/10 transition-colors shrink-0">
                        {getAccountIcon(acc.account_type)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{acc.account_name || "Unnamed Account"}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="capitalize font-semibold">{acc.account_type || "general"}</span>
                          <span>•</span>
                          <span className="font-mono">
                            {acc.account_number_ending ? `•••• ${acc.account_number_ending}` : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-border/40">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Current Balance
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                      {formatPeso(balance)}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span>Liquidity Share</span>
                      <span className="font-mono font-bold text-foreground">{sharePercentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, Math.max(0, sharePercentage))}%` }}
                        className="h-full bg-[#e5167e] rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. Cash Transaction Movement Log */}
      <section className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Cash Transaction Movement Log</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Audit log of recorded inflows, outflows, manual adjustments, and inter-account transfers
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/60 text-xs w-full sm:w-auto overflow-x-auto">
              {["all", "inflow", "outflow", "adjustment"].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg font-bold capitalize transition ${
                    typeFilter === type
                      ? "bg-card text-[#e5167e] shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <SearchFilterBar
              searchTerm={transactionSearch}
              onSearchChange={setTransactionSearch}
              placeholder="Search reference, account, or module..."
              className="sm:max-w-xs"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredTransactions}
          isLoading={loadingTransactions}
          emptyMessage="No cash transactions match the selected filters."
        />
      </section>

      {/* 7. Inter-Account Transfer Modal */}
      <Modal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        title="Inter-Account Cash Transfer"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsTransferOpen(false)}
              className="px-4 py-2 border border-border rounded-xl font-bold hover:bg-background transition text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={TRANSFER_FORM_ID}
              disabled={actionLoading}
              className="px-4 py-2 bg-[#e5167e] text-white font-bold rounded-xl hover:bg-[#e5167e]/90 transition text-xs flex items-center gap-2 shadow-sm"
            >
              {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Execute Transfer
            </button>
          </>
        }
      >
        <TransferForm
          accounts={accounts}
          formData={transferForm}
          onChange={handleTransferChange}
          onSubmit={handleTransferSubmit}
          formatPeso={formatPeso}
        />
      </Modal>

      {/* 8. Cash Adjustment Modal */}
      <Modal
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        title="Manual Cash Adjustment"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAdjustmentOpen(false)}
              className="px-4 py-2 border border-border rounded-xl font-bold hover:bg-background transition text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={ADJUSTMENT_FORM_ID}
              disabled={actionLoading}
              className="px-4 py-2 bg-[#e5167e] text-white font-bold rounded-xl hover:bg-[#e5167e]/90 transition text-xs flex items-center gap-2 shadow-sm"
            >
              {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Apply Adjustment
            </button>
          </>
        }
      >
        <AdjustmentForm
          accounts={accounts}
          formData={adjustmentForm}
          onChange={handleAdjustmentChange}
          onSubmit={handleAdjustmentSubmit}
          formatPeso={formatPeso}
        />
      </Modal>
    </div>
  );
}