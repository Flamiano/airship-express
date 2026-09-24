"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { SummaryCard } from "../../fmscomponents/dashboard/SummaryCard";
import { DataTable } from "../../fmscomponents/ui/DataTable";
import type { ColumnDef } from "../../fmscomponents/ui/DataTable";
import { Modal } from "../../fmscomponents/ui/Modal";
import { SearchFilterBar } from "../../fmscomponents/ui/SearchFilterBar";
import {
  PieChart,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Download,
  Plus,
  Loader2,
  Calendar,
  RefreshCw,
  Wallet,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  ClipboardList,
  FileCheck,
} from "lucide-react";
import { BudgetForm } from "../../fmscomponents/financial/budget/BudgetForm";
import {
  BudgetRecord,
  BudgetFormData,
  EMPTY_BUDGET_FORM,
  BUDGET_FORM_ID,
} from "../../fmscomponents/financial/budget/types";

// Extend the existing BudgetRecord type to locally type DB fields like status and department
type ExtendedBudgetRecord = BudgetRecord & {
  status?: string;
  department_name?: string | null;
};

export default function BudgetManagementPage() {
  const [budgets, setBudgets] = useState<ExtendedBudgetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);
  const [submittingBudget, setSubmittingBudget] = useState(false);
  const [budgetForm, setBudgetForm] = useState<BudgetFormData>(EMPTY_BUDGET_FORM);

  // Safe numerical parsing
  const parseAmount = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
    if (isNaN(num) || !isFinite(num)) return 0;
    return num;
  };

  // Fetch budget plans and calculate spending dynamically from general_ledger
  const fetchBudgets = useCallback(async () => {
    setLoading(true);

    try {
      const [plansRes, glRes] = await Promise.all([
        supabase.from("budget_plans").select("*").order("created_at", { ascending: false }),
        supabase.from("general_ledger").select("amount, entry_date").eq("account_category", "expense"),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (glRes.error) throw glRes.error;

      const plans = plansRes.data || [];
      const glExpenses = glRes.data || [];

      // Calculate spent_amount based on start_date and end_date matching GL records by entry_date
      const computedPlans: ExtendedBudgetRecord[] = plans.map((plan) => {
        const startTime = plan.start_date ? new Date(plan.start_date).getTime() : 0;
        const endTime = plan.end_date ? new Date(`${plan.end_date}T23:59:59.999Z`).getTime() : Infinity;

        const totalSpent = glExpenses
          .filter((entry) => {
            if (!entry.entry_date) return false;
            const entryTime = new Date(entry.entry_date).getTime();
            return entryTime >= startTime && entryTime <= endTime;
          })
          .reduce((sum, entry) => sum + parseAmount(entry.amount), 0);

        return {
          ...plan,
          spent_amount: totalSpent,
        };
      });

      setBudgets(computedPlans);
    } catch (err: any) {
      console.error("Error fetching budget data:", err.message);
      toast.error(`Failed to load budget plans: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const formatPeso = (val: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getAllocated = (item: ExtendedBudgetRecord) => parseAmount(item.allocated_amount);
  const getSpent = (item: ExtendedBudgetRecord) => parseAmount(item.spent_amount);

  // Derived collections based STRICTLY on approved plans for operational metric integrity
  const approvedBudgets = useMemo(() => budgets.filter((b) => b.status === "approved"), [budgets]);

  // Dynamic Metric Calculations based ONLY on approved plans
  const metrics = useMemo(() => {
    let totalAllocated = 0;
    let totalSpent = 0;
    let overBudgetCount = 0;

    approvedBudgets.forEach((item) => {
      const allocated = getAllocated(item);
      const spent = getSpent(item);

      totalAllocated += allocated;
      totalSpent += spent;

      // Only evaluate over-budget warnings against an approved allocation ceiling > 0
      if (spent > allocated && allocated > 0) {
        overBudgetCount += 1;
      }
    });

    const remainingBalance = totalAllocated - totalSpent;
    const rawUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    const utilizationRate = rawUtilization.toFixed(1);

    return {
      totalAllocated,
      totalSpent,
      remainingBalance,
      overBudgetCount,
      utilizationRate,
      rawUtilization,
      totalCount: approvedBudgets.length,
    };
  }, [approvedBudgets]);

  // Filtering Logic applies to the whole table so users can find proposed/closed/rejected plans
  const filteredBudgets = useMemo(() => {
    return budgets.filter((item) => {
      const searchLower = searchTerm.toLowerCase();
      const period = (item.period_name || "").toLowerCase();
      const dept = (item.department_name || "").toLowerCase();
      const startDate = (item.start_date || "").toLowerCase();
      const endDate = (item.end_date || "").toLowerCase();
      const matchId = String(item.id).toLowerCase().includes(searchLower);

      return (
        period.includes(searchLower) ||
        dept.includes(searchLower) ||
        startDate.includes(searchLower) ||
        endDate.includes(searchLower) ||
        matchId
      );
    });
  }, [budgets, searchTerm]);

  // Handle Form Submission for New Budget Plan
  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const allocated = parseFloat(budgetForm.allocated_amount);

    if (!budgetForm.period_name.trim()) {
      toast.error("Please provide a period name.");
      return;
    }

    if (isNaN(allocated) || !isFinite(allocated) || allocated <= 0) {
      toast.error("Please enter a valid positive allocated amount.");
      return;
    }

    const { start_date, end_date } = budgetForm;

    // Robust Date Validation
    if (start_date && !end_date) {
      toast.error("Please provide an end date if a start date is specified.");
      return;
    }
    if (end_date && !start_date) {
      toast.error("Please provide a start date if an end date is specified.");
      return;
    }
    if (start_date && end_date) {
      if (new Date(start_date) > new Date(end_date)) {
        toast.error("Start date must be less than or equal to the end date.");
        return;
      }
    }

    setSubmittingBudget(true);

    try {
      const { error } = await supabase.from("budget_plans").insert([
        {
          period_name: budgetForm.period_name.trim(),
          allocated_amount: allocated,
          start_date: start_date || null,
          end_date: end_date || null,
          // Status relies on the default 'proposed' in the DB.
        },
      ]);

      if (error) throw error;

      toast.success("Budget plan created successfully.");
      setIsAllocateOpen(false);
      setBudgetForm(EMPTY_BUDGET_FORM);
      fetchBudgets();
    } catch (err: any) {
      toast.error(`Failed to create budget plan: ${err.message}`);
    } finally {
      setSubmittingBudget(false);
    }
  };

  const handleFormChange = (field: keyof BudgetFormData, value: string) => {
    setBudgetForm((prev) => ({ ...prev, [field]: value }));
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredBudgets.length === 0) return;

    const headers = [
      "ID",
      "Period Name",
      "Department",
      "Status",
      "Start Date",
      "End Date",
      "Allocated Amount (PHP)",
      "Spent Amount (PHP)",
      "Remaining (PHP)",
    ];

    const rows = filteredBudgets.map((item) => {
      const allocated = getAllocated(item);
      const spent = getSpent(item);
      return [
        `"${item.id}"`,
        `"${item.period_name || "—"}"`,
        `"${item.department_name || "—"}"`,
        `"${item.status || "proposed"}"`,
        `"${formatDate(item.start_date)}"`,
        `"${formatDate(item.end_date)}"`,
        allocated,
        spent,
        allocated - spent,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `budget_plans_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Table columns with enhanced financial indicators
  const budgetColumns: ColumnDef<ExtendedBudgetRecord>[] = [
    {
      header: "Period / Department",
      accessor: (item) => (
        <div className="space-y-0.5">
          <span className="font-bold text-[#e5167e] truncate block max-w-[200px]">
            {item.period_name || `Plan #${item.id.slice(0, 8)}`}
          </span>
          {item.department_name && (
            <span className="text-xs font-medium text-foreground/80 block">
              {item.department_name}
            </span>
          )}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] text-muted-foreground font-mono">
              ID: {item.id.slice(0, 8)}
            </span>
            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${
              item.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
              item.status === 'rejected' ? 'bg-rose-500/10 text-rose-600' :
              item.status === 'closed' ? 'bg-slate-500/10 text-slate-600' :
              'bg-muted text-muted-foreground'
            }`}>
              {item.status || 'proposed'}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Timeline",
      accessor: (item) => (
        <div className="flex flex-col text-xs text-foreground/80 space-y-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#e5167e]/70 shrink-0" />
            <span>{formatDate(item.start_date)}</span>
            <span className="text-muted-foreground">→</span>
            <span>{formatDate(item.end_date)}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Allocated",
      accessor: (item) => (
        <span className="font-black text-foreground">{formatPeso(getAllocated(item))}</span>
      ),
    },
    {
      header: "Spent (GL Expense)",
      accessor: (item) => (
        <span className="text-foreground/70 font-semibold">{formatPeso(getSpent(item))}</span>
      ),
    },
    {
      header: "Remaining Capacity",
      accessor: (item) => {
        const remaining = getAllocated(item) - getSpent(item);
        const isApproved = item.status === "approved";
        const isNegative = remaining < 0;

        if (!isApproved) {
          return (
            <span className="font-extrabold px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1 bg-muted text-muted-foreground border border-border">
              {formatPeso(remaining)}
            </span>
          );
        }

        return (
          <span
            className={`font-extrabold px-2.5 py-1 rounded-lg text-xs inline-flex items-center gap-1 ${
              isNegative
                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            }`}
          >
            {formatPeso(remaining)}
          </span>
        );
      },
    },
    {
      header: "Utilization Status",
      className: "w-52",
      accessor: (item) => {
        const allocated = getAllocated(item);
        const spent = getSpent(item);
        const isApproved = item.status === "approved";
        
        const rawPercentage = (isApproved && allocated > 0) ? (spent / allocated) * 100 : 0;
        const displayPercentage = Math.min(Math.round(rawPercentage), 100);
        
        const isOver = isApproved && spent > allocated && allocated > 0;
        const isWarning = isApproved && rawPercentage >= 85 && !isOver;

        const statusLabel = !isApproved
          ? item.status === 'proposed' ? 'Pending' :
            item.status === 'rejected' ? 'Rejected' :
            item.status === 'closed' ? 'Closed' : 'Inactive'
          : (isOver ? "Exceeded" : isWarning ? "Near Limit" : "Normal");

        const barColor = isOver ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-[#e5167e]";

        return (
          <div className="space-y-1.5 min-w-[150px]">
            <div className="flex justify-between items-center text-[11px] font-bold">
              <span
                className={
                  !isApproved
                    ? "text-muted-foreground"
                    : isOver
                    ? "text-rose-500 flex items-center gap-1"
                    : isWarning
                    ? "text-amber-500"
                    : "text-foreground/70"
                }
              >
                {!isApproved ? (
                  "Not Operational"
                ) : (
                  <>
                    {isOver && <AlertTriangle className="w-3 h-3 shrink-0" />}
                    {Math.round(rawPercentage)}% Used
                  </>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {statusLabel}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              {isApproved && (
                <div
                  className={`h-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${displayPercentage}%` }}
                />
              )}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen text-foreground transition-colors duration-200">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card/90 to-background border border-border p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#e5167e]/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[#e5167e] text-xs font-extrabold uppercase tracking-widest">
              <Wallet className="w-4 h-4" />
              Financial Allocation & Planning Module
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mt-1">
              Budget Control <span className="text-[#e5167e]">& Variance</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Monitor departmental allocations, track GL expense utilization, evaluate capacity thresholds, and enforce budget discipline.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchBudgets}
              title="Refresh Budget Data"
              className="p-2.5 text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e5167e]" : "text-muted-foreground"}`} />
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm"
            >
              <Download className="w-4 h-4 text-muted-foreground" />
              Export Variance Report
            </button>

            <button
              onClick={() => setIsAllocateOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#e5167e] rounded-xl hover:bg-[#e5167e]/90 transition shadow-md shadow-[#e5167e]/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Create Budget Plan
            </button>
          </div>
        </div>
      </div>

      {/* PAYROLL BUDGET REVIEW INTEGRATION ENTRY POINT */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 md:p-6 shadow-sm hover:border-[#e5167e]/40 transition-all group">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-[#e5167e]/5 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start md:items-center gap-4">
            <div className="p-3 bg-[#e5167e]/10 border border-[#e5167e]/20 text-[#e5167e] rounded-xl shrink-0 group-hover:scale-105 transition-transform">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#e5167e] bg-[#e5167e]/10 px-2.5 py-0.5 rounded-full border border-[#e5167e]/20">
                  Payroll & Benefits Integration
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">• Labor Budget Approval Flow</span>
              </div>
              <h3 className="text-base font-bold text-foreground group-hover:text-[#e5167e] transition-colors">
                Payroll Budget Review
              </h3>
              <p className="text-xs text-muted-foreground max-w-2xl">
                Review, evaluate, and approve or reject labor and compensation budget submissions coming from Payroll & Benefits (HR4) before formal ledger allocation.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/payroll-budgetplan"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#e5167e] hover:bg-[#e5167e]/90 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#e5167e]/20 shrink-0 active:scale-95"
          >
            <FileCheck className="w-4 h-4" />
            <span>Payroll Budget Review</span>
            <ArrowUpRight className="w-4 h-4 ml-0.5" />
          </Link>
        </div>
      </div>

      {/* PRIMARY BUDGET CONTROL CENTER & UTILIZATION SPOTLIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Master Utilization Spotlight Card */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-[#e5167e]/40 transition-colors">
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#e5167e]/5 rounded-bl-full pointer-events-none" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#e5167e] bg-[#e5167e]/10 px-3 py-1 rounded-full flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5" /> Pool Utilization Spotlight
              </span>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Approved Capital Pool
              </div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground mt-1 break-words">
                {formatPeso(metrics.totalAllocated)}
              </div>
            </div>

            {/* Master Progress Track */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-muted-foreground">Cumulative Expenditure Utilization</span>
                <span className={metrics.rawUtilization > 100 ? "text-rose-500 font-extrabold" : "text-[#e5167e]"}>
                  {metrics.utilizationRate}% Depleted
                </span>
              </div>
              <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex p-0.5 border border-border/40">
                <div
                  style={{ width: `${Math.min(metrics.rawUtilization, 100)}%` }}
                  className={`h-full rounded-full transition-all duration-700 ${
                    metrics.rawUtilization > 100
                      ? "bg-rose-500"
                      : metrics.rawUtilization > 85
                      ? "bg-amber-500"
                      : "bg-[#e5167e]"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">
                    Utilized Expenditures
                  </span>
                  <span className="text-base sm:text-lg font-black text-foreground">
                    {formatPeso(metrics.totalSpent)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 block">
                    Remaining Capacity
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {formatPeso(metrics.remainingBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
            <span>Source: General Ledger matching on <code className="font-mono text-foreground">account_category = 'expense'</code></span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> General Ledger Sync
            </span>
          </div>
        </div>

        {/* Budget Health & Alert Card */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between hover:border-[#e5167e]/40 transition-colors">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Variance & Health</h3>
              <ShieldAlert className={`w-5 h-5 ${metrics.overBudgetCount > 0 ? "text-rose-500" : "text-emerald-500"}`} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Threshold Compliance</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                    metrics.overBudgetCount === 0
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  }`}
                >
                  {metrics.overBudgetCount === 0 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> All Plans Normal
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> {metrics.overBudgetCount} Over Budget
                    </>
                  )}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <div className="text-xs text-muted-foreground">Over-Budget Approved Plans</div>
                <div className="text-2xl font-black text-foreground">
                  {metrics.overBudgetCount} <span className="text-xs font-normal text-muted-foreground">/ {metrics.totalCount} plans</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <div className="text-xs text-muted-foreground">Average Pool / Plan</div>
                <div className="text-lg font-extrabold text-foreground">
                  {formatPeso(metrics.totalCount > 0 ? metrics.totalAllocated / metrics.totalCount : 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
            {metrics.overBudgetCount === 0
              ? "All approved plan expenditures remain strictly within authorized allocation caps."
              : "Exceeded allocation limits detected. Review individual plan limits in the register below."}
          </div>
        </div>
      </div>

      {/* SUPPORTING METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Approved Pool"
          value={formatPeso(metrics.totalAllocated)}
          subtitle={`Across ${metrics.totalCount} approved plans`}
          trend="Authorized"
          isPositive={true}
          icon={<PieChart className="w-5 h-5 text-[#e5167e]" />}
        />
        <SummaryCard
          title="Approved Plan Expenditures"
          value={formatPeso(metrics.totalSpent)}
          subtitle={`${metrics.utilizationRate}% pool utilized`}
          trend="Spent GL"
          isPositive={false}
          icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
        />
        <SummaryCard
          title="Remaining Capacity"
          value={formatPeso(metrics.remainingBalance)}
          subtitle="Available operating buffer"
          trend="Available"
          isPositive={metrics.remainingBalance >= 0}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        />
        <SummaryCard
          title="Over-Budget Alerts"
          value={`${metrics.overBudgetCount} Plan${metrics.overBudgetCount === 1 ? "" : "s"}`}
          subtitle="Requires allocation review"
          trend={metrics.overBudgetCount === 0 ? "Compliant" : "Exceeded"}
          isPositive={metrics.overBudgetCount === 0}
          icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
        />
      </div>

      {/* BUDGET REGISTER & VARIANCE TABLE */}
      <section className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Budget Allocation Register</h3>
            <p className="text-xs text-muted-foreground">
              Detailed list of all budget plans, matching general ledger expenditures, and available thresholds.
            </p>
          </div>
        </div>

        <SearchFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Search by period name, department, dates, or ID..."
        >
          <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap bg-muted px-3 py-1.5 rounded-lg border border-border/60">
            Showing {filteredBudgets.length} of {budgets.length} plans
          </span>
        </SearchFilterBar>

        <DataTable
          columns={budgetColumns}
          data={filteredBudgets}
          isLoading={loading}
          emptyMessage="No budget records found in budget_plans."
          getRowId={(item) => item.id}
        />
      </section>

      {/* CREATE BUDGET MODAL */}
      <Modal
        isOpen={isAllocateOpen}
        onClose={() => setIsAllocateOpen(false)}
        title="Create Budget Plan"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAllocateOpen(false)}
              className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground font-bold transition text-xs border border-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={BUDGET_FORM_ID}
              disabled={submittingBudget}
              className="px-4 py-2 rounded-xl bg-[#e5167e] text-white font-bold hover:bg-[#e5167e]/90 disabled:opacity-50 transition shadow-md shadow-[#e5167e]/20 text-xs flex items-center gap-1.5"
            >
              {submittingBudget && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Budget Plan
            </button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground mb-4 -mt-2">
          Define a new operational period and set its spending pool limit.
        </p>
        <BudgetForm formData={budgetForm} onChange={handleFormChange} onSubmit={handleCreateBudget} />
      </Modal>
    </div>
  );
}