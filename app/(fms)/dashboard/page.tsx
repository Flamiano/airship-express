"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/app/(fms)/lib/supabase";
import { 
  CreditCard, 
  Wallet, 
  ReceiptText, 
  ArrowRightLeft, 
  Banknote,
  TrendingUp,
  PieChart as PieChartIcon,
  Loader2,
  RefreshCw,
  BookOpen,
  PiggyBank,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Activity,
  Layers,
  Scale
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  Cell 
} from "recharts";

interface MonthlyActivity {
  month: string;
  invoices: number;
  disbursements: number;
}

interface ArAgingBracket {
  bracket: string;
  amount: number;
  color: string;
}

const AGING_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444", "#be123c"];

const generate6MonthTimeline = () => {
  const timeline: { key: string; month: string; invoices: number; disbursements: number }[] = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleString("default", { month: "short" });
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    timeline.push({ key: monthKey, month: monthName, invoices: 0, disbursements: 0 });
  }
  return timeline;
};

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    arTotal: 0,
    arOverdue: 0,
    apTotal: 0,
    collectionsTotal: 0,
    liquidityTotal: 0,
    glTotal: 0,
    disbursementsTotal: 0,
    capitalReserveTotal: 0,
  });

  const [activityTrend, setActivityTrend] = useState<MonthlyActivity[]>([]);
  const [arAging, setArAging] = useState<ArAgingBracket[]>([
    { bracket: "Current", amount: 0, color: AGING_COLORS[0] },
    { bracket: "1-30 Days", amount: 0, color: AGING_COLORS[1] },
    { bracket: "31-60 Days", amount: 0, color: AGING_COLORS[2] },
    { bracket: "61-90 Days", amount: 0, color: AGING_COLORS[3] },
    { bracket: "90+ Days", amount: 0, color: AGING_COLORS[4] },
  ]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);

    try {
      const [
        invoicesRes, 
        billsRes, 
        collectionsRes, 
        disbursementsRes, 
        cashRes, 
        glRes
      ] = await Promise.all([
        supabase.from("ar_invoices").select("id, total_amount, amount_paid, status, due_date, created_at"),
        supabase.from("accounts_payable").select("id, total_amount, amount_paid, status, due_date, created_at"),
        supabase.from("collections").select("amount_received"),
        supabase.from("disbursements").select("amount, status, created_at"),
        supabase.from("cash_mngmt").select("current_balance, account_name"),
        supabase.from("general_ledger").select("*")
      ]);

      // --- ACCOUNTS RECEIVABLE (AR) & AR AGING ---
      let totalAR = 0;
      let totalOverdueAR = 0;
      const agingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (invoicesRes.error) {
        console.error("AR query error:", invoicesRes.error);
      } else if (invoicesRes.data) {
        invoicesRes.data.forEach((inv) => {
          const statusLower = inv.status ? String(inv.status).trim().toLowerCase() : "";
          if (statusLower === "paid" || statusLower === "cancelled" || statusLower === "canceled") {
            return;
          }

          const totalVal = Number(inv.total_amount ?? 0);
          const paidVal = Number(inv.amount_paid ?? 0);
          const outstandingBalance = Math.max(0, totalVal - paidVal);

          if (outstandingBalance > 0) {
            totalAR += outstandingBalance;

            if (inv.due_date) {
              const dueDate = new Date(inv.due_date);
              dueDate.setHours(0, 0, 0, 0);
              const diffTime = now.getTime() - dueDate.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

              if (diffDays <= 0) {
                agingBuckets.current += outstandingBalance;
              } else {
                totalOverdueAR += outstandingBalance;
                if (diffDays <= 30) agingBuckets.d1_30 += outstandingBalance;
                else if (diffDays <= 60) agingBuckets.d31_60 += outstandingBalance;
                else if (diffDays <= 90) agingBuckets.d61_90 += outstandingBalance;
                else agingBuckets.d90_plus += outstandingBalance;
              }
            } else {
              agingBuckets.current += outstandingBalance;
            }
          }
        });

        setArAging([
          { bracket: "Current", amount: agingBuckets.current, color: AGING_COLORS[0] },
          { bracket: "1-30 Days", amount: agingBuckets.d1_30, color: AGING_COLORS[1] },
          { bracket: "31-60 Days", amount: agingBuckets.d31_60, color: AGING_COLORS[2] },
          { bracket: "61-90 Days", amount: agingBuckets.d61_90, color: AGING_COLORS[3] },
          { bracket: "90+ Days", amount: agingBuckets.d90_plus, color: AGING_COLORS[4] },
        ]);
      }

      // --- ACCOUNTS PAYABLE (AP) ---
      let totalAP = 0;
      if (billsRes.error) {
        console.error("AP query error:", billsRes.error);
      } else if (billsRes.data) {
        totalAP = billsRes.data.reduce((sum, b) => {
          const statusLower = b.status ? String(b.status).trim().toLowerCase() : "";
          if (statusLower === "paid" || statusLower === "cancelled" || statusLower === "canceled") {
            return sum;
          }

          const totalVal = Number(b.total_amount ?? 0);
          const paidVal = Number(b.amount_paid ?? 0);
          const outstanding = Math.max(0, totalVal - paidVal);
          return sum + outstanding;
        }, 0);
      }

      // --- COLLECTIONS ---
      let totalCollections = 0;
      if (collectionsRes.error) {
        console.error("Collections query error:", collectionsRes.error);
      } else if (collectionsRes.data) {
        totalCollections = collectionsRes.data.reduce(
          (sum, c) => sum + Number(c.amount_received || 0),
          0
        );
      }

      // --- DISBURSEMENTS ---
      let totalDisbursements = 0;
      if (disbursementsRes.error) {
        console.error("Disbursements query error:", disbursementsRes.error);
      } else if (disbursementsRes.data) {
        totalDisbursements = disbursementsRes.data.reduce(
          (sum, d) => sum + Number(d.amount || 0),
          0
        );
      }

      // --- CASH MANAGEMENT ---
      let liquidity = 0;
      let reserve = 0;
      if (cashRes.error) {
        console.error("Cash Management query error:", cashRes.error);
      } else if (cashRes.data) {
        cashRes.data.forEach((acc) => {
          const bal = Number(acc.current_balance || 0);
          if (acc.account_name?.toLowerCase().includes("reserve")) {
            reserve += bal;
          } else {
            liquidity += bal;
          }
        });
      }

      // --- GENERAL LEDGER ---
      let totalGL = 0;
      if (glRes.error) {
        console.error("General Ledger query error:", glRes.error);
      } else if (glRes.data) {
        totalGL = glRes.data.reduce((sum, row) => {
          const debit = Number(row.debit ?? row.debit_amount ?? 0);
          const credit = Number(row.credit ?? row.credit_amount ?? 0);
          const amount = Number(row.amount ?? row.balance ?? 0);

          if (!isNaN(debit) && debit > 0) return sum + debit;
          if (!isNaN(credit) && credit > 0) return sum + credit;
          if (!isNaN(amount) && amount > 0) return sum + amount;

          return sum;
        }, 0);
      }

      setMetrics({
        arTotal: totalAR,
        arOverdue: totalOverdueAR,
        apTotal: totalAP,
        collectionsTotal: totalCollections,
        disbursementsTotal: totalDisbursements,
        liquidityTotal: liquidity,
        glTotal: totalGL,
        capitalReserveTotal: reserve,
      });

      // --- FINANCIAL ACTIVITY TIMELINE (6 MONTHS) ---
      const timeline = generate6MonthTimeline();

      if (!invoicesRes.error && invoicesRes.data) {
        invoicesRes.data.forEach((inv) => {
          if (inv.created_at) {
            const d = new Date(inv.created_at);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const target = timeline.find((t) => t.key === monthKey);
            if (target) {
              target.invoices += Number(inv.total_amount ?? 0);
            }
          }
        });
      }

      if (!disbursementsRes.error && disbursementsRes.data) {
        disbursementsRes.data.forEach((disb) => {
          if (disb.created_at) {
            const d = new Date(disb.created_at);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const target = timeline.find((t) => t.key === monthKey);
            if (target) {
              target.disbursements += Number(disb.amount || 0);
            }
          }
        });
      }

      setActivityTrend(
        timeline.map(({ month, invoices, disbursements }) => ({ month, invoices, disbursements }))
      );

    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Executive net liquidity position calculation
  const totalLiquidAssets = useMemo(() => {
    return metrics.liquidityTotal + metrics.capitalReserveTotal;
  }, [metrics.liquidityTotal, metrics.capitalReserveTotal]);

  const netWorkingPosition = useMemo(() => {
    return (totalLiquidAssets + metrics.arTotal) - metrics.apTotal;
  }, [totalLiquidAssets, metrics.arTotal, metrics.apTotal]);

  const arRiskPercentage = useMemo(() => {
    if (metrics.arTotal <= 0) return 0;
    return Math.round((metrics.arOverdue / metrics.arTotal) * 100);
  }, [metrics.arTotal, metrics.arOverdue]);

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 space-y-8 text-foreground transition-colors duration-200">
      
      {/* EXECUTIVE HUB HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-[#e5167e]/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e5167e]/10 border border-[#e5167e]/20 text-[#e5167e] text-xs font-extrabold uppercase tracking-widest">
              <Activity className="w-3.5 h-3.5" />
              Airship Express FMS • Executive Command
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mt-2">
              Financial Management <span className="text-[#e5167e]">Overview</span>
            </h1>
            <p className="text-xs sm:text-sm text-foreground/70 mt-1 max-w-2xl">
              Current financial dashboard summarizing treasury liquidity, ledger movement, credit exposure, and operational submodule balances.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end px-3 py-1.5 rounded-xl bg-background/60 border border-border text-right">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50">Data Status</span>
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Financial Data
              </span>
            </div>
            <button
              onClick={fetchOverviewData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground hover:bg-border/40 transition shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#e5167e]" : "text-foreground/70"}`} />
              <span>Refresh Overview</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: OVERALL FINANCIAL SNAPSHOT */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#e5167e]">
              Section 01
            </span>
            <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              Overall Financial Snapshot
            </h2>
          </div>
          <div className="hidden sm:block h-px flex-1 max-w-xs bg-gradient-to-r from-border to-transparent ml-4" />
        </div>

        {/* COMPOSED EXECUTIVE POSITION GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* NET WORKING POSITION - CENTRAL HIGHLIGHT PANEL (5 COLS) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-card via-card to-[#e5167e]/5 border border-[#e5167e]/30 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6 relative overflow-hidden">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#e5167e] flex items-center gap-1.5">
                  <Scale className="w-4 h-4" /> Consolidated Financial Position
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#e5167e]/10 text-[#e5167e] border border-[#e5167e]/20">
                  FMS Net Position
                </span>
              </div>

              <div>
                <span className="text-xs text-foreground/60 font-medium block mb-1">
                  Consolidated Financial Position
                </span>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-mono">
                  {loading ? "Calculating..." : formatCurrency(netWorkingPosition)}
                </div>
              </div>

              <p className="text-xs text-foreground/60 leading-relaxed">
                Calculated as total available liquid funds (Checking & Reserves) plus uncollected receivables, offset by outstanding vendor obligations.
              </p>
            </div>

            {/* BREAKDOWN SUB-BAR */}
            <div className="pt-4 border-t border-border/80 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-background/80 border border-border">
                <span className="text-[10px] font-bold text-foreground/50 uppercase block">Total Liquid Funds</span>
                <span className="font-extrabold text-foreground font-mono text-sm block mt-0.5">
                  {loading ? "..." : formatCurrency(totalLiquidAssets)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-background/80 border border-border">
                <span className="text-[10px] font-bold text-foreground/50 uppercase block">Net AR/AP Gap</span>
                <span className={`font-extrabold font-mono text-sm block mt-0.5 ${metrics.arTotal >= metrics.apTotal ? "text-emerald-500" : "text-rose-500"}`}>
                  {loading ? "..." : formatCurrency(metrics.arTotal - metrics.apTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* KEY FINANCIAL POSITION CARDS (7 COLS) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* CASH & LIQUIDITY */}
            <Link href="/dashboard/cash-management" className="group block">
              <div className="h-full bg-card border border-border hover:border-[#e5167e]/50 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50">Cash & Treasury</span>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-[#e5167e] transition-colors">
                      Active Liquidity
                    </h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl group-hover:bg-[#e5167e]/10 group-hover:text-[#e5167e] transition-colors">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-xl sm:text-2xl font-black text-foreground font-mono tracking-tight">
                    {loading ? "..." : formatCurrency(metrics.liquidityTotal)}
                  </div>
                  <span className="text-[11px] text-foreground/60 mt-1 block">
                    Operational checking & treasury accounts
                  </span>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-foreground/60 font-semibold">
                  <span>Reserves Held</span>
                  <span className="font-mono text-foreground font-bold">{formatCurrency(metrics.capitalReserveTotal)}</span>
                </div>
              </div>
            </Link>

            {/* ACCOUNTS RECEIVABLE */}
            <Link href="/dashboard/accounts-receivable" className="group block">
              <div className="h-full bg-card border border-border hover:border-[#e5167e]/50 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50">Accounts Receivable</span>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-[#e5167e] transition-colors">
                      Outstanding Invoices
                    </h3>
                  </div>
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl group-hover:bg-[#e5167e]/10 group-hover:text-[#e5167e] transition-colors">
                    <ReceiptText className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-xl sm:text-2xl font-black text-foreground font-mono tracking-tight">
                    {loading ? "..." : formatCurrency(metrics.arTotal)}
                  </div>
                  <span className="text-[11px] text-foreground/60 mt-1 block">
                    Uncollected billing balances
                  </span>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-foreground/60 font-semibold">
                  <span>Overdue Exposure</span>
                  <span className={`font-mono font-bold ${metrics.arOverdue > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                    {formatCurrency(metrics.arOverdue)}
                  </span>
                </div>
              </div>
            </Link>

            {/* ACCOUNTS PAYABLE */}
            <Link href="/dashboard/accounts-payable" className="group block">
              <div className="h-full bg-card border border-border hover:border-[#e5167e]/50 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50">Accounts Payable</span>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-[#e5167e] transition-colors">
                      Pending Vendor Bills
                    </h3>
                  </div>
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl group-hover:bg-[#e5167e]/10 group-hover:text-[#e5167e] transition-colors">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-xl sm:text-2xl font-black text-foreground font-mono tracking-tight">
                    {loading ? "..." : formatCurrency(metrics.apTotal)}
                  </div>
                  <span className="text-[11px] text-foreground/60 mt-1 block">
                    Vendor obligations & carrier payables
                  </span>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-foreground/60 font-semibold">
                  <span>Settlement Status</span>
                  <span className="text-amber-500 font-bold">Unpaid Queue</span>
                </div>
              </div>
            </Link>

            {/* COLLECTIONS & DISBURSEMENTS MOVEMENT */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50">Cash Movements</span>
                  <h3 className="text-sm font-bold text-foreground">
                    Receipts vs. Payouts
                  </h3>
                </div>
                <div className="p-2 bg-[#e5167e]/10 text-[#e5167e] rounded-xl">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <span className="text-[10px] text-foreground/50 font-sans block">Collections</span>
                  <span className="text-sm font-bold text-emerald-500 block">
                    {loading ? "..." : formatCurrency(metrics.collectionsTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-foreground/50 font-sans block">Disbursements</span>
                  <span className="text-sm font-bold text-rose-500 block">
                    {loading ? "..." : formatCurrency(metrics.disbursementsTotal)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-foreground/60 font-semibold">
                <span>Net Recorded Movement</span>
                <span className={`font-mono font-bold ${metrics.collectionsTotal >= metrics.disbursementsTotal ? "text-emerald-500" : "text-rose-500"}`}>
                  {formatCurrency(metrics.collectionsTotal - metrics.disbursementsTotal)}
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 2: FINANCIAL ACTIVITY & AR AGING */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FINANCIAL MOVEMENT / ACTIVITY (8 COLS) */}
        <div className="lg:col-span-8 bg-card border border-border p-6 rounded-2xl shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <span className="text-[10px] font-extrabold text-[#e5167e] uppercase tracking-widest block">
                Section 02 • Activity Horizon
              </span>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                6-Month Financial Movement
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </h3>
              <p className="text-xs text-foreground/60 mt-0.5">
                Comparative timeline of customer invoice generation against recorded disbursement payouts.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold shrink-0">
              <span className="flex items-center gap-1.5 text-foreground/80">
                <span className="w-3 h-3 rounded-full bg-[#e5167e]"></span> Invoice Activity
              </span>
              <span className="flex items-center gap-1.5 text-foreground/60">
                <span className="w-3 h-3 rounded-full bg-slate-500"></span> Disbursement Activity
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInvoices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e5167e" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#e5167e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDisbursements" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border opacity-50" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-foreground/60" />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-foreground/60" tickFormatter={(val) => `₱${val / 1000}k`} />
                <Tooltip 
                  wrapperClassName="[&_.recharts-default-tooltip]:!bg-card [&_.recharts-default-tooltip]:!border-border [&_.recharts-default-tooltip]:!text-foreground [&_.recharts-default-tooltip]:!rounded-xl [&_.recharts-default-tooltip]:!shadow-md"
                  formatter={(value: any, name: any) => [
                    `₱${Number(value || 0).toLocaleString()}`, 
                    name === "invoices" ? "Invoiced Volume" : "Disbursement Payouts"
                  ]}
                />
                <Area type="monotone" dataKey="invoices" stroke="#e5167e" strokeWidth={3} fillOpacity={1} fill="url(#colorInvoices)" />
                <Area type="monotone" dataKey="disbursements" stroke="#64748b" strokeWidth={2} fillOpacity={1} fill="url(#colorDisbursements)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs text-foreground/60">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#e5167e]" />
              <span>Data reflects recorded invoice and disbursement records.</span>
            </div>
            <Link href="/dashboard/financial-reports" className="font-bold text-[#e5167e] hover:underline flex items-center gap-1">
              View Detailed Analytics <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* AR AGING / RECEIVABLES RISK (4 COLS) */}
        <div className="lg:col-span-4 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-[#e5167e] uppercase tracking-widest block">
                  Section 03 • Credit Risk
                </span>
                <h3 className="text-lg font-bold text-foreground">AR Aging Schedule</h3>
              </div>
              <div className="p-2 bg-[#e5167e]/10 text-[#e5167e] rounded-xl">
                <PieChartIcon className="w-4 h-4" />
              </div>
            </div>

            <p className="text-xs text-foreground/60 mt-3">
              Uncollected billing balances grouped by aging exposure buckets.
            </p>

            <div className="h-52 w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arAging} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border opacity-50" />
                  <XAxis dataKey="bracket" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: 'currentColor' }} className="text-foreground/60" />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-foreground/60" tickFormatter={(val) => `₱${val / 1000}k`} />
                  <Tooltip 
                    wrapperClassName="[&_.recharts-default-tooltip]:!bg-card [&_.recharts-default-tooltip]:!border-border [&_.recharts-default-tooltip]:!text-foreground [&_.recharts-default-tooltip]:!rounded-xl [&_.recharts-default-tooltip]:!shadow-md"
                    formatter={(value: any) => [`₱${Number(value || 0).toLocaleString()}`, 'Exposure']}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {arAging.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Overdue Exposure Ratio
              </span>
              <span className="font-mono font-black text-foreground">{arRiskPercentage}%</span>
            </div>

            <Link 
              href="/dashboard/accounts-receivable"
              className="w-full py-2.5 bg-[#e5167e] hover:bg-[#e5167e]/90 text-white rounded-xl text-xs font-bold text-center block transition shadow-md shadow-[#e5167e]/20 active:scale-95"
            >
              Open Accounts Receivable Directory →
            </Link>
          </div>
        </div>

      </section>

      {/* SECTION 3: ATTENTION & RISK INDICATORS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#e5167e]">
              Section 04
            </span>
            <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              Financial Attention & Risk Summary
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50 block">AR Overdue Balance</span>
              <span className="text-lg font-black text-foreground font-mono block">
                {loading ? "..." : formatCurrency(metrics.arOverdue)}
              </span>
              <span className="text-[11px] text-foreground/60 block">Requires collection follow-up</span>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50 block">Queued AP Obligations</span>
              <span className="text-lg font-black text-foreground font-mono block">
                {loading ? "..." : formatCurrency(metrics.apTotal)}
              </span>
              <span className="text-[11px] text-foreground/60 block">Pending vendor settlement</span>
            </div>
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50 block">Capital Reserves</span>
              <span className="text-lg font-black text-foreground font-mono block">
                {loading ? "..." : formatCurrency(metrics.capitalReserveTotal)}
              </span>
              <span className="text-[11px] text-foreground/60 block">Earmarked liquidity buffer</span>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/50 block">Ledger Volume</span>
              <span className="text-lg font-black text-foreground font-mono block">
                {loading ? "..." : formatCurrency(metrics.glTotal)}
              </span>
              <span className="text-[11px] text-foreground/60 block">Total GL transaction volume</span>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 4: CROSS-MODULE FINANCIAL STATUS & LAUNCHPAD */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#e5167e]">
              Section 05
            </span>
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              Financial Management <span className="text-[#e5167e] font-extrabold">Submodules Directory</span>
            </h2>
          </div>
          <div className="w-32 h-1 bg-gradient-to-r from-[#e5167e] to-transparent rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* GENERAL LEDGER */}
          <Link href="/dashboard/general-ledger" className="group block">
            <div className="h-full p-5 rounded-2xl bg-card border border-border hover:border-[#e5167e]/50 transition-all shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-[#e5167e]/10 text-[#e5167e] rounded-xl group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold text-[#e5167e] bg-[#e5167e]/10 px-2 py-0.5 rounded-full">GL Core</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-[#e5167e] transition-colors">General Ledger</h3>
                <p className="text-xs text-foreground/60 mt-1">Double-entry journal records & financial ledger accounting.</p>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                <span className="text-foreground/50">Volume</span>
                <span className="font-bold text-foreground">{formatCurrency(metrics.glTotal)}</span>
              </div>
            </div>
          </Link>

          {/* ACCOUNTS RECEIVABLE */}
          <Link href="/dashboard/accounts-receivable" className="group block">
            <div className="h-full p-5 rounded-2xl bg-card border border-border hover:border-[#e5167e]/50 transition-all shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl group-hover:scale-110 transition-transform">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">AR Invoicing</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-[#e5167e] transition-colors">Accounts Receivable</h3>
                <p className="text-xs text-foreground/60 mt-1">Customer invoicing, waybill billing & credit aging tracking.</p>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                <span className="text-foreground/50">Uncollected</span>
                <span className="font-bold text-foreground">{formatCurrency(metrics.arTotal)}</span>
              </div>
            </div>
          </Link>

          {/* ACCOUNTS PAYABLE */}
          <Link href="/dashboard/accounts-payable" className="group block">
            <div className="h-full p-5 rounded-2xl bg-card border border-border hover:border-[#e5167e]/50 transition-all shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl group-hover:scale-110 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">AP Bills</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-[#e5167e] transition-colors">Accounts Payable</h3>
                <p className="text-xs text-foreground/60 mt-1">Vendor voucher management & due date obligations.</p>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                <span className="text-foreground/50">Payable Queue</span>
                <span className="font-bold text-foreground">{formatCurrency(metrics.apTotal)}</span>
              </div>
            </div>
          </Link>

          {/* COLLECTION MANAGEMENT */}
          <Link href="/dashboard/collections" className="group block">
            <div className="h-full p-5 rounded-2xl bg-card border border-border hover:border-[#e5167e]/50 transition-all shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl group-hover:scale-110 transition-transform">
                  <Banknote className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Receipts</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-[#e5167e] transition-colors">Collection Management</h3>
                <p className="text-xs text-foreground/60 mt-1">Payment posting, verification & cash receipt reconciliation.</p>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                <span className="text-foreground/50">Recorded Collections</span>
                <span className="font-bold text-[#e5167e]">{formatCurrency(metrics.collectionsTotal)}</span>
              </div>
            </div>
          </Link>

          {/* DISBURSEMENT MANAGEMENT */}
          <Link href="/dashboard/disbursements" className="group block">
            <div className="h-full p-5 rounded-2xl bg-card border border-border hover:border-[#e5167e]/50 transition-all shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl group-hover:scale-110 transition-transform">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">Payouts</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-[#e5167e] transition-colors">Disbursement Processing</h3>
                <p className="text-xs text-foreground/60 mt-1">Payment batching, vendor payout execution & cash outflow.</p>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                <span className="text-foreground/50">Recorded Disbursement Volume</span>
                <span className="font-bold text-foreground">{formatCurrency(metrics.disbursementsTotal)}</span>
              </div>
            </div>
          </Link>

          {/* CASH & TREASURY */}
          <Link href="/dashboard/cash-management" className="group block">
            <div className="h-full p-5 rounded-2xl bg-card border border-border hover:border-[#e5167e]/50 transition-all shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl group-hover:scale-110 transition-transform">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-full">Treasury</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-[#e5167e] transition-colors">Cash Management</h3>
                <p className="text-xs text-foreground/60 mt-1">Checking balances, reserve accounts & treasury transfers.</p>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                <span className="text-foreground/50">Liquid Treasury</span>
                <span className="font-bold text-foreground">{formatCurrency(metrics.liquidityTotal)}</span>
              </div>
            </div>
          </Link>

          {/* BUDGET MANAGEMENT */}
          <Link href="/dashboard/budget-management" className="group block">
            <div className="h-full p-5 rounded-2xl bg-card border border-border hover:border-[#e5167e]/50 transition-all shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-xl group-hover:scale-110 transition-transform">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">Budgets</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-[#e5167e] transition-colors">Budget Management</h3>
                <p className="text-xs text-foreground/60 mt-1">Departmental fiscal allocations, caps & limit enforcement.</p>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                <span className="text-foreground/50">Fiscal Controls</span>
                <span className="font-bold text-[#e5167e]">Budget Controls</span>
              </div>
            </div>
          </Link>

          {/* FINANCIAL REPORTING & ANALYTICS */}
          <Link href="/dashboard/financial-reports" className="group block">
            <div className="h-full p-5 rounded-2xl bg-card border border-border hover:border-[#e5167e]/50 transition-all shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-[#e5167e]/10 text-[#e5167e] rounded-xl group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-extrabold text-[#e5167e] bg-[#e5167e]/10 px-2 py-0.5 rounded-full">Reports</span>
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-[#e5167e] transition-colors">Reporting & Analytics</h3>
                <p className="text-xs text-foreground/60 mt-1">Balance sheet, cash flow audit logs & financial statements.</p>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                <span className="text-foreground/50">Audit Trails</span>
                <span className="font-bold text-foreground">Financial Analysis</span>
              </div>
            </div>
          </Link>

        </div>
      </section>

    </div>
  );
}