"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { SummaryCard } from "../../fmscomponents/dashboard/SummaryCard";
import { DataTable, ColumnDef } from "../../fmscomponents/ui/DataTable";
import { StatusBadge } from "../../fmscomponents/ui/StatusBadge";
import { SearchFilterBar } from "../../fmscomponents/ui/SearchFilterBar";
import { EmptyState } from "../../fmscomponents/ui/EmptyState";
import { LoadingState } from "../../fmscomponents/ui/LoadingState";
import { ReportDetails } from "../../fmscomponents/financial/reports/ReportDetails";
import { FinancialReportRecord, ReportTypeEnum, ReportStatusEnum } from "../../fmscomponents/financial/reports/types";
import { 
  BarChart3, 
  TrendingUp, 
  FileText, 
  Download,
  Loader2,
  Eye,
  Plus,
  PieChart,
  Percent,
  ShieldCheck,
  RefreshCw,
  Activity,
  CheckCircle2,
  Scale,
  Layers
} from "lucide-react";

export default function FinancialReportingPage() {
  const [reports, setReports] = useState<FinancialReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState<FinancialReportRecord | null>(null);
  const [isInserting, setIsInserting] = useState(false);
  const [activeTab, setActiveTab] = useState<"analytics" | "reports">("analytics");

  const formatPeso = (val: number) => 
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const getStatus = (item: FinancialReportRecord): string => {
    return (item.status || item.report_status || "").toLowerCase();
  };

  const formatReportTypeLabel = (type: ReportTypeEnum) => {
    switch (type) {
      case "profit_loss":
        return "Profit & Loss (Income Statement)";
      case "balance_sheet":
        return "Statement of Financial Position";
      case "cash_flow":
        return "Statement of Cash Flows";
      default:
        return type;
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financial_reports")
      .select("*")
      .order("id", { ascending: false });

    if (!error && data) {
      setReports(data as FinancialReportRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleGenerateDraftReport = async () => {
    setIsInserting(true);
    const newEntry = {
      report_type: "profit_loss" as ReportTypeEnum,
      period_start: "2026-07-01",
      period_end: "2026-09-30",
      report_status: "draft" as ReportStatusEnum,
      summary_data: {
        total_revenue: 1480200,
        operating_expenses: 1117550,
        net_income: 362650
      }
    };

    const { data, error } = await supabase
      .from("financial_reports")
      .insert([newEntry])
      .select();

    if (error) {
      alert(`Error creating report: ${error.message}`);
    } else if (data) {
      setReports((prev) => [data[0] as FinancialReportRecord, ...prev]);
    }
    setIsInserting(false);
  };

  // ANALYTICAL COMPUTATIONS FROM REPORT SNAPSHOTS
  const analyticsData = useMemo(() => {
    let aggregateRevenue = 0;
    let aggregateExpenses = 0;
    let aggregateNetIncome = 0;
    const periodBreakdowns: { period: string; revenue: number; expenses: number; netIncome: number }[] = [];

    reports.forEach((report) => {
      if (report.summary_data) {
        const rev = report.summary_data.total_revenue || 0;
        const exp = report.summary_data.operating_expenses || 0;
        const net = report.summary_data.net_income || (rev - exp);

        aggregateRevenue += rev;
        aggregateExpenses += exp;
        aggregateNetIncome += net;

        periodBreakdowns.push({
          period: `${formatDate(report.period_start)}`,
          revenue: rev,
          expenses: exp,
          netIncome: net
        });
      }
    });

    const netProfitMargin = aggregateRevenue > 0 ? ((aggregateNetIncome / aggregateRevenue) * 100).toFixed(1) : "0.0";
    const operatingRatio = aggregateRevenue > 0 ? ((aggregateExpenses / aggregateRevenue) * 100).toFixed(1) : "0.0";

    return {
      aggregateRevenue,
      aggregateExpenses,
      aggregateNetIncome,
      netProfitMargin,
      operatingRatio,
      periodBreakdowns
    };
  }, [reports]);

  const auditedCount = useMemo(
    () => reports.filter((r) => getStatus(r) === "audited").length,
    [reports]
  );

  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      const search = searchTerm.toLowerCase();
      const friendlyTitle = formatReportTypeLabel(item.report_type).toLowerCase();
      const statusStr = getStatus(item);
      
      return (
        friendlyTitle.includes(search) ||
        item.report_type.toLowerCase().includes(search) ||
        statusStr.includes(search) ||
        String(item.id).includes(search)
      );
    });
  }, [reports, searchTerm]);

  const handleExportCSV = (item?: FinancialReportRecord) => {
    const listToExport = item ? [item] : filteredReports;
    if (listToExport.length === 0) return;

    const headers = ["Report ID", "Report Type", "Formatted Title", "Period Start", "Period End", "Status"];
    const rows = listToExport.map((r) => [
      `"${r.id}"`,
      `"${r.report_type}"`,
      `"${formatReportTypeLabel(r.report_type)}"`,
      `"${formatDate(r.period_start)}"`,
      `"${formatDate(r.period_end)}"`,
      `"${getStatus(r).toUpperCase() || "N/A"}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `financial_analytics_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<FinancialReportRecord>[] = useMemo(
    () => [
      {
        header: "Report ID",
        accessor: (item) => (
          <span className="font-bold text-[#e5167e]">#{item.id}</span>
        ),
      },
      {
        header: "Statement Title",
        accessor: (item) => (
          <span className="font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#e5167e] shrink-0" />
            {formatReportTypeLabel(item.report_type)}
          </span>
        ),
      },
      {
        header: "Period Start",
        accessor: (item) => (
          <span className="text-foreground/70">{formatDate(item.period_start)}</span>
        ),
      },
      {
        header: "Period End",
        accessor: (item) => (
          <span className="text-foreground/70">{formatDate(item.period_end)}</span>
        ),
      },
      {
        header: "Audit Status",
        accessor: (item) => {
          const statusVal = getStatus(item);
          return <StatusBadge status={statusVal || "NO STATUS"} />;
        },
      },
      {
        header: "Actions",
        className: "text-right",
        accessor: (item) => (
          <div className="flex items-center justify-end gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReport(item);
              }}
              className="p-1.5 text-foreground/40 hover:text-[#e5167e] hover:bg-border/30 rounded-xl transition" 
              title="View Snapshot Data"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleExportCSV(item);
              }}
              className="p-1.5 text-foreground/40 hover:text-[#e5167e] hover:bg-border/30 rounded-xl transition" 
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-deps
    [filteredReports]
  );

  return (
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen text-foreground transition-colors duration-200">
      
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card/90 to-background border border-border p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#e5167e]/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[#e5167e] text-xs font-extrabold uppercase tracking-widest">
              <BarChart3 className="w-4 h-4" />
              Financial Ledger Submodule
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mt-1">
              Financial Reports & <span className="text-[#e5167e]">Analytics</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Executive performance interpretation, ratio analytics, profit reconciliation, and verified statement repository.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchReports}
              title="Refresh Reports"
              className="p-2.5 text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e5167e]" : "text-muted-foreground"}`} />
            </button>

            <button 
              onClick={() => handleExportCSV()}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm active:scale-95"
            >
              <Download className="w-4 h-4 text-muted-foreground" />
              Export Data
            </button>

            <button 
              onClick={handleGenerateDraftReport}
              disabled={isInserting}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#e5167e] rounded-xl hover:bg-[#e5167e]/90 transition shadow-md shadow-[#e5167e]/20 active:scale-95 disabled:opacity-50"
            >
              {isInserting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate Draft Statement
            </button>
          </div>
        </div>
      </div>

      {/* PERFORMANCE ANALYSIS CENTER (HERO ANALYTICAL CENTERPIECE) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Performance Overview Hero Card */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-[#e5167e]/40 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#e5167e]/5 rounded-bl-full pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#e5167e] bg-[#e5167e]/10 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Financial Performance Centerpiece
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {reports.length} {reports.length === 1 ? "Snapshot Period" : "Snapshot Periods"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="space-y-1 p-3.5 rounded-xl bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Gross Revenue</span>
                <div className="text-xl sm:text-2xl font-black text-foreground break-words">
                  {formatPeso(analyticsData.aggregateRevenue)}
                </div>
                <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Aggregated Inflow
                </span>
              </div>

              <div className="space-y-1 p-3.5 rounded-xl bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Operating Expenses</span>
                <div className="text-xl sm:text-2xl font-black text-foreground break-words">
                  {formatPeso(analyticsData.aggregateExpenses)}
                </div>
                <span className="text-[10px] text-[#e5167e] font-bold">
                  {analyticsData.operatingRatio}% Expense Ratio
                </span>
              </div>

              <div className="space-y-1 p-3.5 rounded-xl bg-[#e5167e]/5 border border-[#e5167e]/20">
                <span className="text-xs text-[#e5167e] font-bold">Net Income</span>
                <div className="text-xl sm:text-2xl font-black text-foreground break-words">
                  {formatPeso(analyticsData.aggregateNetIncome)}
                </div>
                <span className="text-[10px] text-emerald-500 font-bold">
                  {analyticsData.netProfitMargin}% Profit Margin
                </span>
              </div>
            </div>

            {/* Visual Conversion Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Expense vs Net Income Distribution</span>
                <span className="text-foreground">{analyticsData.netProfitMargin}% Margin Retained</span>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${Math.min(Number(analyticsData.operatingRatio), 100)}%` }}
                  className="bg-[#e5167e] h-full transition-all duration-500"
                  title={`Operating Expenses: ${analyticsData.operatingRatio}%`}
                />
                <div 
                  style={{ width: `${Math.max(100 - Number(analyticsData.operatingRatio), 0)}%` }}
                  className="bg-emerald-500 h-full transition-all duration-500"
                  title={`Retained Net Income: ${analyticsData.netProfitMargin}%`}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between text-xs gap-3">
            <span className="text-muted-foreground">Source: Real-time Supabase <code className="font-mono text-foreground">financial_reports</code> table</span>
            <span className="font-semibold text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
            </span>
          </div>
        </div>

        {/* Executive Ratios & Governance Card */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between hover:border-[#e5167e]/40 transition-colors">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Executive Ratios</h3>
              <Scale className="w-5 h-5 text-[#e5167e]" />
            </div>

            <div className="space-y-3">
              {/* Net Profit Ratio */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Net Profit Margin</span>
                  <span className="font-extrabold text-emerald-500">{analyticsData.netProfitMargin}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(Math.max(Number(analyticsData.netProfitMargin), 0), 100)}%` }}
                  />
                </div>
              </div>

              {/* Operating Ratio */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Operating Expense Ratio</span>
                  <span className="font-extrabold text-[#e5167e]">{analyticsData.operatingRatio}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#e5167e] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(Math.max(Number(analyticsData.operatingRatio), 0), 100)}%` }}
                  />
                </div>
              </div>

              {/* Audit Status */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Audited Coverage</div>
                  <div className="text-sm font-extrabold text-foreground">{auditedCount} of {reports.length} Statements</div>
                </div>
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
            Calculated dynamically from published & draft financial snapshots.
          </div>
        </div>
      </div>

      {/* SUPPORTING SUMMARY KPI GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Aggregated Revenue"
          value={formatPeso(analyticsData.aggregateRevenue)}
          subtitle="Sum of reported snapshot periods"
          trend="Gross Revenue"
          isPositive={true}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <SummaryCard
          title="Net Income Margin"
          value={`${analyticsData.netProfitMargin}%`}
          subtitle={`Total Profit: ${formatPeso(analyticsData.aggregateNetIncome)}`}
          trend="Profitability Ratio"
          isPositive={Number(analyticsData.netProfitMargin) > 0}
          icon={<Percent className="w-5 h-5" />}
        />
        <SummaryCard
          title="Operating Expense Ratio"
          value={`${analyticsData.operatingRatio}%`}
          subtitle={`Total Expenses: ${formatPeso(analyticsData.aggregateExpenses)}`}
          trend="Efficiency"
          isPositive={Number(analyticsData.operatingRatio) < 80}
          icon={<PieChart className="w-5 h-5" />}
        />
        <SummaryCard
          title="Audited Statements"
          value={`${auditedCount} / ${reports.length}`}
          subtitle="Verified by internal audit"
          trend="Compliance"
          isPositive={true}
          icon={<ShieldCheck className="w-5 h-5" />}
        />
      </section>

      {/* VIEW TOGGLE TABS */}
      <div className="flex items-center justify-between bg-card p-1.5 rounded-2xl border border-border max-w-md">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition ${
            activeTab === "analytics"
              ? "bg-[#e5167e] text-white shadow-md shadow-[#e5167e]/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Visual Analytics
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition ${
            activeTab === "reports"
              ? "bg-[#e5167e] text-white shadow-md shadow-[#e5167e]/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" /> Statement Repository ({reports.length})
        </button>
      </div>

      {/* ANALYTICS TAB VIEW */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          
          {/* VISUAL REVENUE VS EXPENSES COMPARISON & INTERPRETATION PANEL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Visual Breakdown (2 cols) */}
            <div className="lg:col-span-2 bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#e5167e]" /> Period-by-Period Statement Breakdown
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Proportional revenue vs. expense evaluation across active reporting periods.
                  </p>
                </div>
              </div>

              {analyticsData.periodBreakdowns.length === 0 ? (
                <EmptyState
                  title="No Analytics Data Available"
                  description="No report snapshot data is currently available in the database to generate visual analytics."
                />
              ) : (
                <div className="space-y-4">
                  {analyticsData.periodBreakdowns.map((item, idx) => {
                    const maxVal = Math.max(item.revenue, item.expenses, 1);
                    const revPercent = (item.revenue / maxVal) * 100;
                    const expPercent = (item.expenses / maxVal) * 100;

                    return (
                      <div key={idx} className="space-y-3 p-4 bg-muted/20 rounded-xl border border-border/60 hover:border-[#e5167e]/30 transition">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-[#e5167e] font-mono">{item.period} Statement</span>
                          <span className="text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            Net Income: {formatPeso(item.netIncome)}
                          </span>
                        </div>

                        {/* Revenue Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Revenue</span>
                            <span className="font-bold text-foreground">{formatPeso(item.revenue)}</span>
                          </div>
                          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${revPercent}%` }} />
                          </div>
                        </div>

                        {/* Expense Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Expenses</span>
                            <span className="font-bold text-foreground">{formatPeso(item.expenses)}</span>
                          </div>
                          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-[#e5167e] rounded-full transition-all duration-500" style={{ width: `${expPercent}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Financial Interpretation Cards (1 col) */}
            <div className="space-y-4">
              <div className="p-5 bg-card rounded-2xl border border-border shadow-sm space-y-2 hover:border-[#e5167e]/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-[#e5167e] tracking-wider bg-[#e5167e]/10 px-2 py-0.5 rounded">
                    Profitability Indicator
                  </span>
                  <Percent className="w-4 h-4 text-[#e5167e]" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Net Margin Efficiency</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Measures how much net income is generated as a percentage of total revenues. Current rating: <strong className="text-[#e5167e]">{analyticsData.netProfitMargin}%</strong>.
                </p>
              </div>

              <div className="p-5 bg-card rounded-2xl border border-border shadow-sm space-y-2 hover:border-[#e5167e]/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-[#e5167e] tracking-wider bg-[#e5167e]/10 px-2 py-0.5 rounded">
                    Expense Control
                  </span>
                  <PieChart className="w-4 h-4 text-[#e5167e]" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Operating Expense Burden</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Shows the ratio of operating expenses relative to total revenue pool. Lower values indicate better cost optimization.
                </p>
              </div>

              <div className="p-5 bg-card rounded-2xl border border-border shadow-sm space-y-2 hover:border-[#e5167e]/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-[#e5167e] tracking-wider bg-[#e5167e]/10 px-2 py-0.5 rounded">
                    Audit & Governance
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Compliance Coverage</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ensures published statements meet accounting policies and internal auditing standards prior to executive distribution.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* STATEMENT REPOSITORY TAB VIEW */}
      {activeTab === "reports" && (
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden p-6 space-y-6">
          <SearchFilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Search report type, status, or ID..."
          >
            <div className="text-xs text-muted-foreground font-semibold">
              Showing {filteredReports.length} of {reports.length} report records
            </div>
          </SearchFilterBar>

          {loading ? (
            <LoadingState message="Fetching reports from database..." />
          ) : reports.length === 0 ? (
            <EmptyState
              title="No reports found in financial_reports table"
              description="There are currently no report entries saved in the database."
              action={
                <button 
                  onClick={handleGenerateDraftReport}
                  disabled={isInserting}
                  className="px-4 py-2 bg-[#e5167e] text-white rounded-xl font-bold text-xs hover:bg-[#e5167e]/90 transition shadow-md shadow-[#e5167e]/20 disabled:opacity-50"
                >
                  {isInserting ? "Inserting..." : "Insert Test Draft Row"}
                </button>
              }
            />
          ) : filteredReports.length === 0 ? (
            <EmptyState
              title="No matching reports found"
              description={`No financial reports match "${searchTerm}". Try adjusting your search query.`}
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredReports}
              getRowId={(row) => String(row.id)}
            />
          )}
        </section>
      )}

      {/* DETAIL MODAL */}
      <ReportDetails
        report={selectedReport}
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        formatDate={formatDate}
        formatReportTypeLabel={formatReportTypeLabel}
        getStatus={getStatus}
        formatPeso={formatPeso}
      />

    </div>
  );
}