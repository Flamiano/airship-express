"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/app/(fms)/lib/supabase";
import { SummaryCard } from "@/app/(fms)/fmscomponents/dashboard/SummaryCard";
import { 
  CreditCard, 
  Wallet, 
  ReceiptText, 
  ArrowRightLeft, 
  Banknote,
  DollarSign,
  TrendingUp,
  PieChart as PieChartIcon,
  Loader2,
  RefreshCw
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

interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
}

interface ArAgingBracket {
  bracket: string;
  amount: number;
  color: string;
}

const AGING_COLORS = ["#ec4899", "#f472b6", "#fb7185", "#64748b", "#334155"];

const generate6MonthTimeline = () => {
  const timeline: { key: string; month: string; revenue: number; expenses: number }[] = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleString("default", { month: "short" });
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    timeline.push({ key: monthKey, month: monthName, revenue: 0, expenses: 0 });
  }
  return timeline;
};

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    arTotal: 0,
    apTotal: 0,
    collectionsTotal: 0,
    liquidityTotal: 0,
    glTotal: 0,
    disbursementsTotal: 0,
    capitalReserveTotal: 0,
  });

  const [revenueTrend, setRevenueTrend] = useState<MonthlyTrend[]>([]);
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

              if (diffDays <= 0) agingBuckets.current += outstandingBalance;
              else if (diffDays <= 30) agingBuckets.d1_30 += outstandingBalance;
              else if (diffDays <= 60) agingBuckets.d31_60 += outstandingBalance;
              else if (diffDays <= 90) agingBuckets.d61_90 += outstandingBalance;
              else agingBuckets.d90_plus += outstandingBalance;
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
        apTotal: totalAP,
        collectionsTotal: totalCollections,
        disbursementsTotal: totalDisbursements,
        liquidityTotal: liquidity,
        glTotal: totalGL,
        capitalReserveTotal: reserve,
      });

      // --- REVENUE VS EXPENSES TIMELINE (6 MONTHS) ---
      const timeline = generate6MonthTimeline();

      if (!invoicesRes.error && invoicesRes.data) {
        invoicesRes.data.forEach((inv) => {
          if (inv.created_at) {
            const d = new Date(inv.created_at);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const target = timeline.find((t) => t.key === monthKey);
            if (target) {
              target.revenue += Number(inv.total_amount ?? 0);
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
              target.expenses += Number(disb.amount || 0);
            }
          }
        });
      }

      setRevenueTrend(
        timeline.map(({ month, revenue, expenses }) => ({ month, revenue, expenses }))
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

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 space-y-8 text-foreground transition-colors duration-200">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-5 gap-4">
        <div>
          <span className="text-xs text-pink-600 dark:text-pink-500 font-extrabold tracking-widest uppercase block mb-1">
            Airship Express
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Financial Overview <span className="text-pink-600 dark:text-pink-500">(Executive Hub)</span>
          </h1>
        </div>

        <button
          onClick={fetchOverviewData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground hover:bg-border/30 transition shadow-sm active:scale-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-600" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* SECTION 1: PRIMARY SUBMODULE KPIS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link href="/dashboard/accounts-receivable" className="block">
          <SummaryCard
            title="Accounts Receivable (AR)"
            value={loading ? "Calculating..." : formatCurrency(metrics.arTotal)}
            subtitle="Uncollected invoice totals"
            trend="12.1%"
            isPositive={true}
            icon={<ReceiptText size={20} />}
          />
        </Link>

        <Link href="/dashboard/accounts-payable" className="block">
          <SummaryCard
            title="Accounts Payable (AP)"
            value={loading ? "Calculating..." : formatCurrency(metrics.apTotal)}
            subtitle="Unpaid vendor bills queued"
            trend="4.5%"
            isPositive={false}
            icon={<CreditCard size={20} />}
          />
        </Link>

        <Link href="/dashboard/collections" className="block">
          <SummaryCard
            title="Collection Management"
            value={loading ? "Calculating..." : formatCurrency(metrics.collectionsTotal)}
            subtitle="Verified collections received"
            trend="2.0%"
            isPositive={true}
            icon={<Banknote size={20} />}
          />
        </Link>

        <Link href="/dashboard/cash-management" className="block">
          <SummaryCard
            title="Cash & Liquidity"
            value={loading ? "Calculating..." : formatCurrency(metrics.liquidityTotal)}
            subtitle="Live checking & operational cash"
            trend="1.4%"
            isPositive={true}
            icon={<Wallet size={20} />}
          />
        </Link>
      </section>

      {/* SECTION 2: CHARTS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* REVENUE VS EXPENSES AREA CHART */}
        <div className="lg:col-span-8 bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <span className="text-[10px] font-extrabold text-pink-600 dark:text-pink-500 uppercase tracking-widest block">
                Financial Trajectory
              </span>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                Revenue vs. Operating Expenses
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-foreground/80">
                <span className="w-3 h-3 rounded-full bg-pink-500"></span> Revenue
              </span>
              <span className="flex items-center gap-1.5 text-foreground/60">
                <span className="w-3 h-3 rounded-full bg-slate-500"></span> Expenses
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border opacity-50" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-foreground/60" />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-foreground/60" tickFormatter={(val) => `₱${val / 1000}k`} />
                <Tooltip 
                  wrapperClassName="[&_.recharts-default-tooltip]:!bg-card [&_.recharts-default-tooltip]:!border-border [&_.recharts-default-tooltip]:!text-foreground [&_.recharts-default-tooltip]:!rounded-xl [&_.recharts-default-tooltip]:!shadow-md"
                  formatter={(value: any) => [`₱${Number(value || 0).toLocaleString()}`, '']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="expenses" stroke="#64748b" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AR AGING SCHEDULE BAR CHART */}
        <div className="lg:col-span-4 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-pink-600 dark:text-pink-500 uppercase tracking-widest block">
                  Collections Risk
                </span>
                <h3 className="text-lg font-bold text-foreground">AR Aging Schedule</h3>
              </div>
              <PieChartIcon className="w-5 h-5 text-foreground/40" />
            </div>

            <p className="text-xs text-foreground/60 mt-3">
              Uncollected invoice balances grouped by overdue days.
            </p>

            <div className="h-56 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arAging} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border opacity-50" />
                  <XAxis dataKey="bracket" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-foreground/60" />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-foreground/60" tickFormatter={(val) => `₱${val / 1000}k`} />
                  <Tooltip 
                    wrapperClassName="[&_.recharts-default-tooltip]:!bg-card [&_.recharts-default-tooltip]:!border-border [&_.recharts-default-tooltip]:!text-foreground [&_.recharts-default-tooltip]:!rounded-xl [&_.recharts-default-tooltip]:!shadow-md"
                    formatter={(value: any) => [`₱${Number(value || 0).toLocaleString()}`, 'Amount']}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {arAging.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Link 
            href="/dashboard/accounts-receivable"
            className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold text-center block transition shadow-md shadow-pink-600/20 active:scale-95"
          >
            Open Accounts Receivable →
          </Link>
        </div>

      </section>

      {/* SECTION 3: KEY SUBMODULE LEDGER POSITIONS */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            Key <span className="text-pink-600 dark:text-pink-500 font-extrabold">Submodule</span> Ledger Positions
          </h2>
          <div className="w-48 h-1 bg-gradient-to-r from-pink-500 to-border rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Link href="/dashboard/general-ledger" className="block">
            <SummaryCard
              title="General Ledger (GL)"
              value={loading ? "Calculating..." : formatCurrency(metrics.glTotal)}
              subtitle="Total ledger transaction debit volume"
              trend="8.9%"
              isPositive={true}
              icon={<Wallet size={20} />}
            />
          </Link>

          <Link href="/dashboard/disbursements" className="block">
            <SummaryCard
              title="Disbursement Processing"
              value={loading ? "Calculating..." : formatCurrency(metrics.disbursementsTotal)}
              subtitle="Total active disbursement volume"
              trend="6.2%"
              isPositive={false}
              icon={<ArrowRightLeft size={20} />}
            />
          </Link>

          <Link href="/dashboard/cash-management" className="block">
            <SummaryCard
              title="Available Capital Reserve"
              value={loading ? "Calculating..." : formatCurrency(metrics.capitalReserveTotal)}
              subtitle="Liquidity held in reserve accounts"
              trend="14.2%"
              isPositive={true}
              icon={<DollarSign size={20} />}
            />
          </Link>
        </div>
      </section>
    </div>
  );
}