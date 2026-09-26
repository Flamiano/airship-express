"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import {
  BookOpen,
  PlusCircle,
  RefreshCw,
  NotebookPen,
  Scale,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Layers,
  ArrowRight,
  Loader2,
} from "lucide-react";

import { SummaryCard } from "../../fmscomponents/dashboard/SummaryCard";
import { Modal } from "../../fmscomponents/ui/Modal";
import { JournalEntryForm } from "../../fmscomponents/financial/gl/JournalEntryForm";
import {
  GeneralLedgerEntry,
  GLFormData,
  EMPTY_GL_FORM,
  GL_ENTRY_FORM_ID,
  getEntryDebit,
  getEntryCredit,
  postJournalEntry,
} from "../../fmscomponents/financial/gl/types";

export default function GeneralLedgerPage() {
  const [entries, setEntries] = useState<GeneralLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<GLFormData>(EMPTY_GL_FORM);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("general_ledger")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch general ledger entries", { description: error.message });
      console.error("Error fetching GL entries:", error);
    } else if (data) {
      setEntries(data as GeneralLedgerEntry[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const formatPeso = (val: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  const handleFormChange = (field: keyof GLFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.account_name) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    const { error, parsedAmount } = await postJournalEntry(form);
    setSubmitting(false);

    if (error) {
      toast.error("Failed to post entry", { description: error.message });
    } else {
      toast.success("Journal entry posted successfully!", {
        description: `Recorded ${form.entry_type.toUpperCase()} of ${formatPeso(parsedAmount)} under ${form.account_name}.`,
      });
      setIsModalOpen(false);
      setForm(EMPTY_GL_FORM);
      fetchEntries();
    }
  };

  // Primary GL Calculations derived from actual general_ledger entries
  const totalDebit = useMemo(() => entries.reduce((acc, curr) => acc + getEntryDebit(curr), 0), [entries]);
  const totalCredit = useMemo(() => entries.reduce((acc, curr) => acc + getEntryCredit(curr), 0), [entries]);
  const primaryGLValue = totalDebit + totalCredit;
  
  const variance = Math.abs(totalDebit - totalCredit);
  const isBalanced = variance < 0.01;

  // Visualizations Calculations from actual GL data
  const categoryDistribution = useMemo(() => {
    const categories: Record<string, { count: number; total: number }> = {
      asset: { count: 0, total: 0 },
      liability: { count: 0, total: 0 },
      revenue: { count: 0, total: 0 },
      expense: { count: 0, total: 0 },
    };

    entries.forEach((item) => {
      const cat = (item.account_category || "").toLowerCase();
      const val = getEntryDebit(item) || getEntryCredit(item) || Number(item.amount) || 0;
      if (categories[cat]) {
        categories[cat].count += 1;
        categories[cat].total += val;
      }
    });

    const grandTotal = Object.values(categories).reduce((sum, c) => sum + c.total, 0) || 1;

    return Object.entries(categories).map(([key, data]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      count: data.count,
      total: data.total,
      percentage: Math.round((data.total / grandTotal) * 100),
    }));
  }, [entries]);

  const debitPercentage = primaryGLValue > 0 ? Math.round((totalDebit / primaryGLValue) * 100) : 50;
  const creditPercentage = primaryGLValue > 0 ? 100 - debitPercentage : 50;

  const recentFive = useMemo(() => entries.slice(0, 5), [entries]);

  return (
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen text-foreground transition-colors duration-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card/90 to-background border border-border p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#e5167e]/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-[#e5167e] text-xs font-extrabold uppercase tracking-widest">
              <BookOpen className="w-4 h-4" />
              General Ledger Administrative Control Dashboard
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mt-1">
              General Ledger <span className="text-[#e5167e]">Summary</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              High-level double-entry control, trial balance reconciliation health, and category metrics across all operational submodules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchEntries}
              title="Refresh Ledger"
              className="p-2.5 text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#e5167e]" : "text-muted-foreground"}`} />
            </button>

            <Link
              href="/dashboard/general-ledger/journal"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-foreground bg-card border border-border rounded-xl hover:bg-muted/50 transition shadow-sm group"
            >
              <NotebookPen className="w-4 h-4 text-[#e5167e]" />
              Open Journal
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#e5167e] rounded-xl hover:bg-[#e5167e]/90 transition shadow-md shadow-[#e5167e]/20 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              Post Quick Entry
            </button>
          </div>
        </div>
      </div>

      {/* Hero Primary GL Value & Reconciliation Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary GL Value Hero Card */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-[#e5167e]/40 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#e5167e]/5 rounded-bl-full pointer-events-none" />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#e5167e] bg-[#e5167e]/10 px-3 py-1 rounded-full">
                Primary Ledger Metric
              </span>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>
            
            <h2 className="text-sm font-semibold text-muted-foreground">Total Ledger Posting Activity</h2>
            <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground break-words">
              {formatPeso(primaryGLValue)}
            </div>
            <p className="text-xs text-muted-foreground max-w-lg pt-1">
              Aggregated sum of gross debit and credit activity recorded across the General Ledger. Represents total turnover evaluated across active financial submodules.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between text-xs gap-3">
            <span className="text-muted-foreground">Source: Real-time Supabase <code className="font-mono text-foreground">general_ledger</code> table</span>
            <span className="font-semibold text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
            </span>
          </div>
        </div>

        {/* Ledger Health & Reconciliation Card */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between hover:border-[#e5167e]/40 transition-colors">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ledger Health</h3>
              <Scale className="w-5 h-5 text-[#e5167e]" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Trial Balance Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                    isBalanced
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  }`}
                >
                  {isBalanced ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Balanced
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> Needs Reconciliation
                    </>
                  )}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                <div className="text-xs text-muted-foreground">Trial Balance Variance</div>
                <div className="text-xl font-extrabold text-foreground">
                  {formatPeso(variance)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
            {isBalanced
              ? "Debits match credits exactly. Double-entry integrity is intact."
              : "Variance detected between total debits and total credits. Inspect individual journal postings."}
          </div>
        </div>
      </div>

      {/* Supporting KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Posted Debits"
          value={formatPeso(totalDebit)}
          subtitle="Cumulative Debit Flow"
          trend="Live Ledger"
          isPositive={true}
        />
        <SummaryCard
          title="Total Posted Credits"
          value={formatPeso(totalCredit)}
          subtitle="Cumulative Credit Flow"
          trend="Live Ledger"
          isPositive={true}
        />
        <SummaryCard
          title="Total Posted Entries"
          value={entries.length.toLocaleString()}
          subtitle="Individual Journal Records"
          icon={<Layers className="w-5 h-5" />}
        />
      </div>

      {/* GL Visualizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Debit vs Credit Allocation Chart */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-foreground">Debit vs. Credit Allocation</h3>
            <p className="text-xs text-muted-foreground">Proportional breakdown of total ledger activity</p>
          </div>

          <div className="space-y-3">
            <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex">
              <div
                style={{ width: `${debitPercentage}%` }}
                className="bg-blue-500 h-full transition-all duration-500"
                title={`Debits: ${debitPercentage}%`}
              />
              <div
                style={{ width: `${creditPercentage}%` }}
                className="bg-purple-500 h-full transition-all duration-500"
                title={`Credits: ${creditPercentage}%`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-blue-500">
                  <span>Debits</span>
                  <span>{debitPercentage}%</span>
                </div>
                <div className="text-lg font-extrabold text-foreground">{formatPeso(totalDebit)}</div>
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-purple-500">
                  <span>Credits</span>
                  <span>{creditPercentage}%</span>
                </div>
                <div className="text-lg font-extrabold text-foreground">{formatPeso(totalCredit)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Category Distribution */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Account Category Distribution</h3>
            <p className="text-xs text-muted-foreground">Posting volume broken down by GL account category</p>
          </div>

          <div className="space-y-3.5">
            {categoryDistribution.map((cat) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="font-bold text-foreground">{cat.name}</span>
                  <span className="text-muted-foreground">
                    {cat.count} {cat.count === 1 ? "entry" : "entries"} · {formatPeso(cat.total)} ({cat.percentage}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.max(cat.percentage, cat.count > 0 ? 4 : 0)}%` }}
                    className="h-full bg-[#e5167e] rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Audit Stream */}
      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Recent Ledger Stream</h3>
            <p className="text-xs text-muted-foreground">Snapshot of the last 5 general ledger postings</p>
          </div>

          <Link
            href="/dashboard/general-ledger/journal"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e5167e] hover:underline"
          >
            View all entries in Journal <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-border/50 text-xs">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#e5167e]" /> Loading stream...
            </div>
          ) : recentFive.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground italic">No journal entries found.</div>
          ) : (
            recentFive.map((row) => {
              const debit = getEntryDebit(row);
              const credit = getEntryCredit(row);
              const isDebit = debit > 0;
              return (
                <div key={row.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#e5167e]">
                        {row.reference_no || `JV-${row.id.slice(0, 6)}`}
                      </span>
                      <span className="capitalize font-bold text-foreground">
                        {row.account_name || row.account_category || "General Account"}
                      </span>
                      <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {row.account_category || "general"}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate max-w-md">{row.description || "No description provided"}</p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    <span className="text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className={`font-bold text-sm ${isDebit ? "text-blue-500" : "text-purple-500"}`}>
                      {isDebit ? "Dr " : "Cr "}
                      {formatPeso(isDebit ? debit : credit)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 bg-muted/20 border-t border-border/60 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <span>Full browsing, search filtering, and posting workflows are hosted on the Journal page.</span>
          <Link href="/dashboard/general-ledger/journal" className="text-[#e5167e] font-bold hover:underline">
            Go to Journal
          </Link>
        </div>
      </section>

      {/* Quick Entry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Post Quick Journal Entry"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-border rounded-xl font-bold hover:bg-background transition text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={GL_ENTRY_FORM_ID}
              disabled={submitting}
              className="px-4 py-2 bg-[#e5167e] text-white font-bold rounded-xl hover:bg-[#e5167e]/90 transition text-xs flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Post Entry
            </button>
          </>
        }
      >
        <JournalEntryForm formData={form} onChange={handleFormChange} onSubmit={handleSubmit} />
      </Modal>
    </div>
  );
}