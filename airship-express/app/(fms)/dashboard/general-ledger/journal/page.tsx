"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { NotebookPen, ArrowLeft, Loader2, Download } from "lucide-react";

import { DataTable, ColumnDef } from "../../../fmscomponents/ui/DataTable";
import { SearchFilterBar } from "../../../fmscomponents/ui/SearchFilterBar";
import { JournalEntryForm } from "../../../fmscomponents/financial/gl/JournalEntryForm";
import {
  GeneralLedgerEntry,
  GLFormData,
  EMPTY_GL_FORM,
  GL_ENTRY_FORM_ID,
  getEntryDebit,
  getEntryCredit,
  postJournalEntry,
} from "../../../fmscomponents/financial/gl/types";

export default function JournalPage() {
  const [entries, setEntries] = useState<GeneralLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<GLFormData>(EMPTY_GL_FORM);

  const formatPeso = (val: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(val);

  const fetchAllEntries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("general_ledger")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load journal entries", { description: error.message });
    } else if (data) {
      setEntries(data as GeneralLedgerEntry[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllEntries();
  }, [fetchAllEntries]);

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
      setForm(EMPTY_GL_FORM);
      fetchAllEntries();
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      const q = searchQuery.toLowerCase();
      return (
        (item.description || "").toLowerCase().includes(q) ||
        (item.account_name || "").toLowerCase().includes(q) ||
        (item.account_category || "").toLowerCase().includes(q) ||
        (item.reference_no || "").toLowerCase().includes(q)
      );
    });
  }, [entries, searchQuery]);

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) return;
    const headers = ["Ref No.", "Date", "Account Name", "Category", "Description", "Debit (PHP)", "Credit (PHP)"];
    const rows = filteredEntries.map((row) => [
      `"${row.reference_no || `JV-${row.id.slice(0, 6)}`}"`,
      new Date(row.created_at).toISOString().split("T")[0],
      `"${(row.account_name || "").replace(/"/g, '""')}"`,
      `"${row.account_category || ""}"`,
      `"${(row.description || "").replace(/"/g, '""')}"`,
      getEntryDebit(row),
      getEntryCredit(row),
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `journal_entries_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<GeneralLedgerEntry>[] = [
    {
      header: "Ref No.",
      accessor: (row) => (
        <span className="font-mono font-bold text-[#e5167e]">
          {row.reference_no || `JV-${row.id.slice(0, 6)}`}
        </span>
      ),
    },
    {
      header: "Date",
      accessor: (row) => new Date(row.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    },
    {
      header: "Account Name",
      accessor: (row) => <span className="font-bold capitalize">{row.account_name || row.account_category || "General Journal"}</span>,
    },
    {
      header: "Category",
      accessor: (row) => <span className="uppercase text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">{row.account_category || "—"}</span>,
    },
    {
      header: "Description",
      accessor: (row) => <span className="text-muted-foreground max-w-xs truncate block">{row.description || "—"}</span>,
    },
    {
      header: "Debit (PHP)",
      className: "text-right",
      accessor: (row) => {
        const debit = getEntryDebit(row);
        return debit > 0 ? <span className="font-bold text-blue-500">{formatPeso(debit)}</span> : <span className="text-muted-foreground/40">—</span>;
      },
    },
    {
      header: "Credit (PHP)",
      className: "text-right",
      accessor: (row) => {
        const credit = getEntryCredit(row);
        return credit > 0 ? <span className="font-bold text-purple-500">{formatPeso(credit)}</span> : <span className="text-muted-foreground/40">—</span>;
      },
    },
  ];

  return (
    <div className="p-6 md:p-10 space-y-8 bg-background min-h-screen text-foreground transition-colors duration-200">
      <div className="border-b border-border pb-6">
        <Link
          href="/dashboard/general-ledger"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to General Ledger Summary
        </Link>
        <div className="flex items-center gap-2 text-[#e5167e] text-xs font-extrabold uppercase tracking-widest">
          <NotebookPen className="w-4 h-4" />
          General Ledger / Journal Workflow
        </div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mt-1">
          Journal <span className="text-[#e5167e]">Entries & Posting</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive journal records table and direct double-entry posting workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Posting Form */}
        <section className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4 h-fit">
          <div>
            <h2 className="text-base font-bold text-foreground">Post New Journal Entry</h2>
            <p className="text-xs text-muted-foreground">Record manual journal adjustments directly to GL</p>
          </div>
          
          <JournalEntryForm formData={form} onChange={handleFormChange} onSubmit={handleSubmit} />
          
          <button
            type="submit"
            form={GL_ENTRY_FORM_ID}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#e5167e] text-white font-bold rounded-xl hover:bg-[#e5167e]/90 disabled:opacity-50 transition shadow-md shadow-[#e5167e]/20 active:scale-95 text-xs"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Post Entry to Ledger
          </button>
        </section>

        {/* Detailed Journal Records Table */}
        <section className="lg:col-span-3 bg-card rounded-2xl border border-border shadow-sm overflow-hidden h-fit space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Journal Audit Log</h2>
              <p className="text-xs text-muted-foreground">
                Showing {filteredEntries.length} of {entries.length} entries
              </p>
            </div>

            <SearchFilterBar
              onSearchChange={setSearchQuery}
              searchTerm={searchQuery}
              placeholder="Search Ref, Account, Description..."
            >
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 p-2 px-3 text-xs font-bold border rounded-xl text-foreground bg-background border-border hover:bg-muted/40 transition"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </SearchFilterBar>
          </div>

          <DataTable
            columns={columns}
            data={filteredEntries}
            getRowId={(row) => row.id}
            isLoading={loading}
            emptyMessage="No journal entries found."
          />
        </section>
      </div>
    </div>
  );
}